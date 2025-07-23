import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import type { SkillMatrixData, SkillMatrixOptions, TimeSeriesPoint, TimeRange } from '../../types';
import { colors } from '../theme/colors';

export interface SkillMatrixHeatmapInstance {
    update: (data: SkillMatrixData, options: SkillMatrixOptions) => void;
    destroy: () => void;
}

// Helper function to convert hex color to an RGB object
function parseRgb(rgbString: string): { r: number; g: number; b: number } {
  const match = rgbString.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!match) throw new Error('Invalid rgb format');

  const [, r, g, b] = match;
  return { r: Number(r), g: Number(g), b: Number(b) };
}


// Helper function to determine the best default chart view based on time span
function getOptimalChartView(
    points: TimeSeriesPoint[] | undefined,
    timeRange: TimeRange
): 'Daily' | 'Monthly' | 'Yearly' {
    if (!points || points.length < 2) {
        return 'Daily';
    }

    const firstDate = new Date(points[0].date);
    const lastDate = new Date(points[points.length - 1].date);
    const spanInDays = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);

    switch (timeRange) {
        case 'Last 30 Days':
        case 'Last 90 Days':
            return 'Daily';
        case 'Last 365 Days':
            return spanInDays < 90 ? 'Daily' : 'Monthly';
        case 'All Time':
            if (spanInDays > 365 * 4) return 'Yearly';
            if (spanInDays > 90) return 'Monthly';
            return 'Daily';
        default:
            return 'Monthly';
    }
}

function aggregateTimeSeriesData(
    points: TimeSeriesPoint[],
    view: 'Daily' | 'Monthly' | 'Yearly'
): TimeSeriesPoint[] {
    if (view === 'Daily' || points.length === 0) {
        return points;
    }

    const grouped = new Map<string, TimeSeriesPoint[]>();

    points.forEach(point => {
        const date = new Date(point.date);
        let key: string;

        if (view === 'Monthly') {
            key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        } else { // Yearly
            key = date.getFullYear().toString();
        }

        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key)!.push(point);
    });

    const aggregated: TimeSeriesPoint[] = [];

    for (const [period, periodPoints] of grouped.entries()) {
        const sortedPoints = periodPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const lastPoint = sortedPoints[sortedPoints.length - 1];

        let periodDateStr: string;
        if (view === 'Monthly') {
            periodDateStr = `${period}-01`;
        } else { // Yearly
            periodDateStr = `${period}-01-01`;
        }

        aggregated.push({
            date: periodDateStr,
            value: lastPoint.value,
            easy: lastPoint.easy,
            medium: lastPoint.medium,
            hard: lastPoint.hard
        });
    }

    return aggregated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}


export function renderOrUpdateSkillMatrixHeatmap(
    container: HTMLElement,
    data: SkillMatrixData,
    options: SkillMatrixOptions,
    existingInstance?: SkillMatrixHeatmapInstance
): SkillMatrixHeatmapInstance {

    if (existingInstance) {
        existingInstance.update(data, options);
        return existingInstance;
    }

    let expandedRows = new Set<string>();
    let charts = new Map<string, Chart>();
    let chartOptions = new Map<string, {
        metric: 'problemsSolved' | 'avgTries' | 'firstAceRate',
        view: 'Daily' | 'Monthly' | 'Yearly',
        split: boolean,
    }>();

    function renderInitialTable() {
        // --- START OF NEW CODE ---
        if (data.topics.length === 0) {
            // No topics match the current filters, so display the empty state message.
            const imageUrl = chrome.runtime.getURL('assets/images/null_dark.png');
            container.innerHTML = `
              <div class="flex h-full flex-col items-center justify-center py-16">
                <img class="w-[200px]" src="${imageUrl}" alt="No data available">
                <span class="mt-3 text-sm font-medium text-label-4 dark:text-dark-label-4">
                  No data for the selected period
                </span>
              </div>
            `;
            return; // Stop the function here to prevent rendering an empty table.
        }
        // --- END OF NEW CODE ---
        const metrics = ['problemsSolved', 'avgTries', 'firstAceRate'] as const;
        const metricLabels = {
            problemsSolved: 'Problems Solved',
            avgTries: 'Average Attempts',
            firstAceRate: 'First Ace Rate'
        };

        container.innerHTML = `
            <div class="w-full">
                <div class="overflow-x-auto rounded-lg bg-layer-1 dark:bg-dark-layer-1">
                    <table class="w-full border-collapse" style="table-layout: fixed;">
                        <thead>
                            <tr class="bg-layer-1 dark:bg-dark-layer-1">
                                <th class="text-left p-3 text-base font-semibold text-gray-200" style="width: 30%;"></th>
                                ${metrics.map(metric => `<th class="text-center p-3 text-base font-semibold text-gray-200" style="width: ${70/3}%;">${metricLabels[metric]}</th>`).join('')}
                                <th style="width: 40px;"></th>
                            </tr>
                        </thead>
                        <tbody id="skill-matrix-tbody">
                            ${data.topics.map(topic => `
                                <tr class="topic-row last:border-b-0" data-topic-row="${topic}">
                                    <td class="p-3 text-base font-semibold text-gray-200">${formatTopicName(topic)}</td>
                                    ${metrics.map(metric => {
                                        const value = data.metrics[metric][topic] || 0;
                                        const color = getHeatmapColor(value, metric);
                                        return `<td class="p-0 text-center text-base font-semibold text-gray-200" style="background-color: ${color}; color: ${getTextColor(color)};">
                                            <div class="p-2">${formatMetricValue(value, metric)}</div>
                                        </td>`;
                                    }).join('')}
                                    <td class="p-3 text-center">
                                        <button class="expand-btn w-6 h-6 flex items-center justify-center cursor-pointer" data-topic="${topic}">
                                            <span class="text-xl font-light text-label-1 dark:text-dark-label-1">+</span>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        addEventListeners();
    }

    function addEventListeners() {
        container.querySelectorAll('.expand-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const topic = (e.currentTarget as HTMLElement).dataset.topic!;
                toggleRow(topic, e.currentTarget as HTMLButtonElement);
            });
        });
    }

    function toggleRow(topic: string, button: HTMLButtonElement) {
        const topicRow = container.querySelector(`tr[data-topic-row="${topic}"]`);
        if (!topicRow) return;

        if (expandedRows.has(topic)) {
            expandedRows.delete(topic);
            const chartRow = topicRow.nextElementSibling;
            if (chartRow && chartRow.classList.contains('expanded-row')) {
                const expandableContent = chartRow.querySelector('.expandable-content') as HTMLElement;
                if (expandableContent) {
                    expandableContent.style.maxHeight = expandableContent.scrollHeight + 'px';
                    expandableContent.style.opacity = '1';
                    expandableContent.offsetHeight;
                    expandableContent.style.maxHeight = '0px';
                    expandableContent.style.opacity = '0';

                    expandableContent.addEventListener('transitionend', () => {
                        if (chartRow.parentNode) chartRow.remove();
                    }, { once: true });
                }
            }
            const chartId = `skill-chart-${topic.replace(/\s+/g, '-')}`;
            if (charts.has(chartId)) {
                const chart = charts.get(chartId)!;
                chart.destroy();
                charts.delete(chartId);
            }
            button.querySelector('span')!.textContent = '+';
        } else {
            expandedRows.add(topic);

            if (!chartOptions.has(topic)) {
                const timeSeriesForMetric = data.timeSeriesData[topic]?.['problemsSolved'];
                const optimalView = getOptimalChartView(timeSeriesForMetric, options.timeRange);
                chartOptions.set(topic, { metric: 'problemsSolved', view: optimalView, split: false });
            }
            const currentChartOptions = chartOptions.get(topic)!;

            const newRow = document.createElement('tr');
newRow.className = 'expanded-row';
            newRow.innerHTML = getChartRowHtml(topic, currentChartOptions.view);

            topicRow.insertAdjacentElement('afterend', newRow);
            addChartControlListeners(newRow, topic);

            const expandableContent = newRow.querySelector('.expandable-content') as HTMLElement;
            if (expandableContent) {
                expandableContent.style.maxHeight = '0px';
                expandableContent.style.opacity = '0';
                expandableContent.offsetHeight;
                expandableContent.style.maxHeight = expandableContent.scrollHeight + 'px';
                expandableContent.style.opacity = '1';
            }

            button.querySelector('span')!.textContent = '−';

            requestAnimationFrame(() => renderChart(topic));
        }
    }

    function getChartRowHtml(topic: string, defaultView: 'Daily' | 'Monthly' | 'Yearly'): string {
        return `
            <td colspan="5" class="p-0 bg-layer-1 dark:bg-dark-layer-1">
                <div class="expandable-content">
                    <div class="p-4 border-t-2 border-divider-3 dark:border-dark-divider-3">
                        <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
                            <div class="ml-[21px]">
                                <div class="relative" data-headlessui-state>
                                    <button class="flex cursor-pointer items-center rounded px-3 py-1.5 text-left focus:outline-none whitespace-nowrap bg-fill-3 dark:bg-dark-fill-3 text-label-2 dark:text-dark-label-2 hover:bg-fill-2 dark:hover:bg-dark-fill-2 active:bg-fill-3 dark:active:bg-dark-fill-3 metric-selector" data-topic="${topic}" type="button" aria-haspopup="listbox" aria-expanded="false">
                                        <span class="whitespace-nowrap">Problems Solved</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="pointer-events-none ml-3 w-4 h-4" aria-hidden="true">
                                            <path fill-rule="evenodd" d="M4.929 7.913l7.078 7.057 7.064-7.057a1 1 0 111.414 1.414l-7.77 7.764a1 1 0 01-1.415 0L3.515 9.328a1 1 0 011.414-1.414z" clip-rule="evenodd"></path>
                                        </svg>
                                    </button>
                                    <div class="hidden z-dropdown absolute max-h-56 overflow-auto rounded-lg p-2 focus:outline-none bg-overlay-3 dark:bg-dark-overlay-3 left-0 mt-2 shadow-level3 dark:shadow-dark-level3 metric-options" style="filter: drop-shadow(rgba(0, 0, 0, 0.04) 0px 1px 3px) drop-shadow(rgba(0, 0, 0, 0.12) 0px 6px 16px);">
                                        <div class="relative flex h-8 cursor-pointer select-none py-1.5 pl-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1 rounded bg-fill-3 dark:bg-dark-fill-3" data-value="problemsSolved">
                                            <div class="flex h-5 flex-1 items-center pr-2 font-medium">
                                                <div class="whitespace-nowrap">Problems Solved</div>
                                            </div>
                                            <span class="text-blue dark:text-dark-blue flex items-center pr-2 visible">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4" aria-hidden="true">
                                                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path>
                                                </svg>
                                            </span>
                                        </div>
                                        <div class="relative flex h-8 cursor-pointer select-none py-1.5 pl-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1" data-value="avgTries">
                                            <div class="flex h-5 flex-1 items-center pr-2">
                                                <div class="whitespace-nowrap">Average Attempts</div>
                                            </div>
                                            <span class="text-blue dark:text-dark-blue flex items-center pr-2 invisible">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4" aria-hidden="true">
                                                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path>
                                                </svg>
                                            </span>
                                        </div>
                                        <div class="relative flex h-8 cursor-pointer select-none py-1.5 pl-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1" data-value="firstAceRate">
                                            <div class="flex h-5 flex-1 items-center pr-2">
                                                <div class="whitespace-nowrap">First Ace Rate</div>
                                            </div>
                                            <span class="text-blue dark:text-dark-blue flex items-center pr-2 invisible">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4" aria-hidden="true">
                                                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path>
                                                </svg>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="flex gap-2 flex-wrap">
                                <div class="text-sd-muted-foreground inline-flex items-center justify-center bg-sd-muted rounded-full p-[1px]">
                                    <button class="chart-view-btn whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs" data-view="Daily" data-topic="${topic}" data-state="${defaultView === 'Daily' ? 'active' : 'inactive'}">
                                        Daily
                                    </button>
                                    <button class="chart-view-btn whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs" data-view="Monthly" data-topic="${topic}" data-state="${defaultView === 'Monthly' ? 'active' : 'inactive'}">
                                        Monthly
                                    </button>
                                    <button class="chart-view-btn whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs" data-view="Yearly" data-topic="${topic}" data-state="${defaultView === 'Yearly' ? 'active' : 'inactive'}">
                                        Yearly
                                    </button>
                                </div>
                                <div class="text-sd-muted-foreground inline-flex items-center justify-center bg-sd-muted rounded-full p-[1px]">
                                    <button class="difficulty-toggle whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs" data-topic="${topic}" data-state="active">
                                        Aggregate
                                    </button>
                                    <button class="difficulty-toggle whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs" data-topic="${topic}" data-state="inactive">
                                        Split
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="relative h-60 w-full bg-layer-1 dark:bg-dark-layer-1">
                            <canvas id="skill-chart-${topic.replace(/\s+/g, '-')}" class="w-full h-full"></canvas>
                            <div id="tooltip-${topic.replace(/\s+/g, '-')}" class="chart-tooltip"></div>
                        </div>
                    </div>
                </div>
            </td>
            <style>
                .expandable-content { max-height: 0; overflow: hidden; transition: max-height 0.4s ease, opacity 0.4s ease; }
                .chart-tooltip {
                    position: absolute; top: 0; left: 0; background: ${colors.background.section}; border: 2px solid ${colors.background.empty};
                    border-radius: 8px; padding: 12px; font-size: 13px; color: ${colors.text.primary};
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); z-index: 1000; width: max-content;
                    max-width: 300px; opacity: 0; pointer-events: none;
                    transition: opacity 0.2s ease, transform 0.15s ease-out;
                }
                .tooltip-header { font-weight: 500; margin-bottom: 8px; color: ${colors.text.primary}; }
                .tooltip-subheader { margin-bottom: 12px; font-size: 12px; color: ${colors.text.subtle}; }
                .tooltip-subheader-value { font-weight: 500; color: ${colors.text.primary}; margin-left: 6px; }
                .tooltip-divider { border-top: 1px solid ${colors.background.secondarySection}; margin: 10px 0; }
                .tooltip-breakdown-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 5px; }
                .tooltip-breakdown-item { display: flex; align-items: center; justify-content: space-between; font-size: 12px; gap: 16px; }
                .tooltip-breakdown-label { display: flex; align-items: center; gap: 8px; color: ${colors.text.subtle}; }
                .tooltip-breakdown-value { font-weight: 500; color: ${colors.text.primary}; }
                .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
            </style>
        `;
    }

    function addChartControlListeners(row: HTMLElement, topic: string) {
        const metricSelector = row.querySelector('.metric-selector');
        const metricOptions = row.querySelector('.metric-options');

        metricSelector?.addEventListener('click', (e) => {
            e.preventDefault();
            const isHidden = metricOptions?.classList.contains('hidden');
            if (isHidden) {
                metricOptions?.classList.remove('hidden');
                metricSelector.setAttribute('aria-expanded', 'true');
            } else {
                metricOptions?.classList.add('hidden');
                metricSelector.setAttribute('aria-expanded', 'false');
            }
        });

        // Option selection
        metricOptions?.querySelectorAll('[data-value]').forEach(option => {
            option.addEventListener('click', () => {
                const value = option.getAttribute('data-value') as 'problemsSolved' | 'avgTries' | 'firstAceRate';
                const span = metricSelector?.querySelector('span');
                const labels = {
                    problemsSolved: 'Problems Solved',
                    avgTries: 'Average Attempts',
                    firstAceRate: 'First Ace Rate'
                };
                if (span) span.textContent = labels[value];

                const opts = chartOptions.get(topic)!;
                opts.metric = value;
                chartOptions.set(topic, opts);

                metricOptions?.querySelectorAll('[data-value]').forEach(opt => {
                    const checkIcon = opt.querySelector('span:last-child');
                    if (checkIcon) {
                        checkIcon.classList.toggle('visible', opt === option);
                        checkIcon.classList.toggle('invisible', opt !== option);
                    }
                });

                metricOptions?.classList.add('hidden');
                metricSelector?.setAttribute('aria-expanded', 'false');

                renderChart(topic);
            });
        });

        row.querySelectorAll('.chart-view-btn').forEach(el => {
            el.addEventListener('click', e => {
                const button = e.currentTarget as HTMLButtonElement;
                const view = button.dataset.view as any;
                const opts = chartOptions.get(topic)!;
                opts.view = view;
                chartOptions.set(topic, opts);

                button.parentElement?.querySelectorAll('button').forEach(btn => {
                    btn.setAttribute('data-state', btn === button ? 'active' : 'inactive');
                });

                renderChart(topic);
            });
        });

        row.querySelectorAll('.difficulty-toggle').forEach(el => {
            el.addEventListener('click', e => {
                const button = e.currentTarget as HTMLButtonElement;
                const isAggregate = button.textContent?.trim() === 'Aggregate';
                const opts = chartOptions.get(topic)!;
                opts.split = !isAggregate;
                chartOptions.set(topic, opts);

                button.parentElement?.querySelectorAll('button').forEach(btn => {
                    const btnIsAggregate = btn.textContent?.trim() === 'Aggregate';
                    btn.setAttribute('data-state', (btnIsAggregate === isAggregate) ? 'active' : 'inactive');
                });

                renderChart(topic);
            });
        });
    }

    function renderChart(topic: string) {
        const canvas = container.querySelector(`#skill-chart-${topic.replace(/\s+/g, '-')}`) as HTMLCanvasElement;
        if (!canvas) return;

        const chartId = canvas.id;
        if (charts.has(chartId)) {
            charts.get(chartId)!.destroy();
        }

        const ctx = canvas.getContext('2d')!;
        const localOpts = chartOptions.get(topic)!;
        const metricData = data.timeSeriesData[topic]?.[localOpts.metric];

        if (!metricData || metricData.length === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgb(107, 114, 128)'; // This color is not in colors.ts
            ctx.textAlign = 'center';
            ctx.font = '14px sans-serif';
            ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
            return;
        }

        // --- START OF FIX ---

        const timeRangeStartDate = new Date(data.timeRangeStart);

        // Filter points to be within the selected time range.
        let dataForChart = metricData.filter(point =>
            new Date(point.date) >= timeRangeStartDate
        );

        // For time ranges other than "All Time", find the cumulative value at the start of the range
        // to draw the line correctly from the beginning of the x-axis.
        if (options.timeRange !== 'All Time') {
            // Find the last data point *before* the start of the current time range.
            const lastPointBeforeRange = metricData
                .slice()
                .reverse()
                .find(point => new Date(point.date) < timeRangeStartDate);

            if (lastPointBeforeRange) {
                // Check if there's already a data point exactly on the start date.
                const firstPointIsOnStartDate = dataForChart.length > 0 &&
                    new Date(dataForChart[0].date).getTime() === timeRangeStartDate.getTime();

                // If not, prepend an artificial point to carry over the cumulative value.
                if (!firstPointIsOnStartDate) {
                    dataForChart.unshift({
                        ...lastPointBeforeRange,
                        date: data.timeRangeStart, // Set its date to the exact start of the range.
                    });
                }
            }
        }

        const aggregatedData = aggregateTimeSeriesData(
            dataForChart,
            localOpts.view
        );

        // For "All Time", adjust the axis to start at the first submission instead of 1970.
        // For other views, it starts at the beginning of the time range (e.g., 90 days ago).
        const xScaleMin = options.timeRange === 'All Time' && aggregatedData.length > 0
            ? aggregatedData[0].date // Use the date of the first data point
            : data.timeRangeStart;   // Use the calculated range start

        // --- END OF FIX ---


        const datasets: any[] = [];

        if (localOpts.split) {
            (['easy', 'medium', 'hard'] as const).forEach(diff => {
                datasets.push({
                    label: diff.charAt(0).toUpperCase() + diff.slice(1),
                    data: aggregatedData.map(p => ({ x: p.date, y: p[diff] })),
                    borderColor: colors.problems[diff],
                });
            });
        } else {
            datasets.push({
                label: 'Overall',
                data: aggregatedData.map(p => ({ x: p.date, y: p.value })),
                borderColor: colors.status.accepted,
            });
        }

        const timeScaleConfig = {
            'Daily': { unit: 'day', tooltipFormat: 'MMM dd, yyyy' },
            'Monthly': { unit: 'month', tooltipFormat: 'MMM yyyy' },
            'Yearly': { unit: 'year', tooltipFormat: 'yyyy' }
        } as const;

        const chart = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                elements: {
                    point: {
                        radius: 0,
                        hoverRadius: 5,
                        hoverBorderWidth: 2,
                    },
                    line: {
                        tension: 0.4,
                        cubicInterpolationMode: 'monotone',
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        min: xScaleMin, // Use the dynamically determined minimum
                        time: {
                            unit: timeScaleConfig[localOpts.view].unit,
                            tooltipFormat: timeScaleConfig[localOpts.view].tooltipFormat
                        },
                        grid: { display: false },
                        ticks: { color: colors.text.subtle }
                    },
                    y: {
                        beginAtZero: localOpts.metric !== 'avgTries',
                        min: localOpts.metric === 'avgTries' ? 1 : undefined,
                        grid: { display: false },
                        ticks: { color: colors.text.subtle, precision: localOpts.metric === 'problemsSolved' ? 0 : undefined }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: (context) => {
                            const tooltipId = `tooltip-${topic.replace(/\s+/g, '-')}`;
                            const tooltipEl = document.getElementById(tooltipId);
                            if (!tooltipEl) return;

                            const tooltipModel = context.tooltip;
                            if (tooltipModel.opacity === 0 || !tooltipModel.dataPoints.length) {
                                tooltipEl.style.opacity = '0';
                                tooltipEl.style.pointerEvents = 'none';
                                return;
                            }

                            const dataIndex = tooltipModel.dataPoints[0].dataIndex;
                            const dataPoint = aggregatedData[dataIndex];
                            if (!dataPoint) {
                                tooltipEl.style.opacity = '0';
                                tooltipEl.style.pointerEvents = 'none';
                                return;
                            };

                            let formattedDate: string;
                            const pointDate = new Date(dataPoint.date);

                            if (localOpts.view === 'Yearly') {
                                formattedDate = pointDate.getUTCFullYear().toString();
                            } else if (localOpts.view === 'Monthly') {
                                // For a monthly key like "2023-04-01", we want "April 2023"
                                formattedDate = pointDate.toLocaleDateString(undefined, {
                                    month: 'long',
                                    year: 'numeric',
                                    timeZone: 'UTC' // Keep UTC here to show 'January 2023' not 'December 2022' for a '2023-01-01' key
                                });
                            } else { // Daily
                                // For a daily key, show the full date
                                formattedDate = pointDate.toLocaleDateString(undefined, {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    timeZone: 'UTC' // Likewise, keep UTC to avoid day-before issues
                                });
                            }

                            const metricLabels = { problemsSolved: 'Problems Solved', avgTries: 'Avg. Attempts', firstAceRate: 'First Ace Rate' };
                            const formatValue = (val: number, metric: string) => {
                                if (val === undefined || val === null) return 'N/A';
                                if (metric === 'avgTries') return val.toFixed(2);
                                if (metric === 'firstAceRate') return `${val.toFixed(1)}%`;
                                return Math.round(val).toString();
                            };

                            let innerHtml = `<div class="tooltip-header">${formattedDate}</div>`;
                            innerHtml += `<div class="tooltip-subheader">${metricLabels[localOpts.metric]}:<span class="tooltip-subheader-value">${formatValue(dataPoint.value, localOpts.metric)}</span></div>`;

                            if (localOpts.split) {
                                innerHtml += `<div class="tooltip-divider"></div><ul class="tooltip-breakdown-list">`;
                                (['Easy', 'Medium', 'Hard'] as const).forEach(diff => {
                                    const value = dataPoint[diff.toLowerCase() as 'easy' | 'medium' | 'hard'];
                                    const diffKey = diff.toLowerCase() as keyof typeof colors.problems;
                                    if (value !== undefined && value !== null && value > 0) {
                                        innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${colors.problems[diffKey]};"></span>${diff}</span><span class="tooltip-breakdown-value">${formatValue(value, localOpts.metric)}</span></li>`;
                                    }
                                });
                                innerHtml += `</ul>`;
                            }

                            tooltipEl.innerHTML = innerHtml;

                            const chartContainer = context.chart.canvas.parentNode as HTMLElement;
                            if (!chartContainer) return;

                            let newLeft = tooltipModel.caretX + 15;
                            let newTop = tooltipModel.caretY;

                            if (newLeft + tooltipEl.offsetWidth > chartContainer.offsetWidth) {
                                newLeft = tooltipModel.caretX - tooltipEl.offsetWidth - 15;
                            }
                            if (newLeft < 0) newLeft = 0;
                            if (newTop < 0) newTop = 0;
                            if (newTop + tooltipEl.offsetHeight > chartContainer.offsetHeight) {
                                newTop = chartContainer.offsetHeight - tooltipEl.offsetHeight;
                            }

                            tooltipEl.style.opacity = '1';
                            tooltipEl.style.pointerEvents = 'none';
                            tooltipEl.style.transform = `translate(${newLeft}px, ${newTop}px)`;
                        }
                    }
                }
            }
        });
        charts.set(chartId, chart);
    }

    function getHeatmapColor(value: number, metric: 'problemsSolved' | 'avgTries' | 'firstAceRate'): string {
        const bestColor = parseRgb(colors.status.accepted);
        const middleColor = parseRgb(colors.problems.medium);
        const worstColor = parseRgb(colors.status.wrongAnswer);

        if (!bestColor || !middleColor || !worstColor) return 'transparent';

        let percent = 0;

        if (metric === 'avgTries') {
            const WORST_CASE_ATTEMPTS = 4;
            if (value <= 1) percent = 0;
            else percent = Math.min(1, ((value - 1) / (WORST_CASE_ATTEMPTS - 1)) ** 1.5);
        } else if (metric === 'problemsSolved') {
            const TARGET_PROBLEMS = 20;
            percent = 1 - Math.sqrt(Math.min(1, value / TARGET_PROBLEMS));
        } else { // firstAceRate
            percent = 1 - Math.sqrt(value / 100);
        }

        let r, g, b;
        if (percent <= 0.5) {
            const localPercent = percent * 2;
            r = Math.round(bestColor.r + localPercent * (middleColor.r - bestColor.r));
            g = Math.round(bestColor.g + localPercent * (middleColor.g - bestColor.g));
            b = Math.round(bestColor.b + localPercent * (middleColor.b - bestColor.b));
        } else {
            const localPercent = (percent - 0.5) * 2;
            r = Math.round(middleColor.r + localPercent * (worstColor.r - middleColor.r));
            g = Math.round(middleColor.g + localPercent * (worstColor.g - middleColor.g));
            b = Math.round(middleColor.b + localPercent * (worstColor.b - middleColor.b));
        }

        return `rgba(${r}, ${g}, ${b}, 0.6)`;
    }

    function getTextColor(backgroundColor: string): string {
        if (backgroundColor === 'transparent') return 'rgb(107, 114, 128)';
        const rgbMatch = backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!rgbMatch) return '#ffffff';
        const [r, g, b] = [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    function formatMetricValue(value: number, metric: string): string {
        if (metric === 'avgTries') {
            if (value === Infinity) return '∞';
            return value.toFixed(1);
        } else if (metric === 'problemsSolved') {
            return value.toString();
        }
        return `${value.toFixed(0)}%`;
    }

    const instance: SkillMatrixHeatmapInstance = {
        update: (newData, newOptions) => {
            Object.assign(data, newData);
            Object.assign(options, newOptions);
            charts.forEach(chart => chart.destroy());
            charts.clear();
            expandedRows.clear();
            chartOptions.clear();
            renderInitialTable();
        },
        destroy: () => {
            charts.forEach(chart => chart.destroy());
            charts.clear();
            expandedRows.clear();
            chartOptions.clear();
            container.innerHTML = '';
        }
    };

    renderInitialTable();
    return instance;
}

function formatTopicName(slug: string): string {
    return slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}