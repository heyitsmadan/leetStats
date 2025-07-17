import Chart, { LegendItem } from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import type { SkillMatrixData, SkillMatrixOptions, TimeSeriesPoint } from '../../types';

export interface SkillMatrixHeatmapInstance {
    update: (data: SkillMatrixData, options: SkillMatrixOptions) => void;
    destroy: () => void;
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

    console.log('[Heatmap] Initializing component...');

    let expandedRows = new Set<string>();
    let charts = new Map<string, Chart>();
    let chartOptions = new Map<string, {
        metric: 'problemsSolved' | 'avgTries' | 'firstAceRate',
        view: 'Daily' | 'Monthly' | 'Yearly',
        split: boolean,
    }>();

    function renderInitialTable() {
    console.time('[Heatmap] renderInitialTable');
    const metrics = ['problemsSolved', 'avgTries', 'firstAceRate'] as const;
    const metricLabels = {
        problemsSolved: 'Problems Solved', // ✅ CHANGED
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
    console.timeEnd('[Heatmap] renderInitialTable');
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
    console.log(`[Heatmap] Toggling row for topic: "${topic}"`);
    const topicRow = container.querySelector(`tr[data-topic-row="${topic}"]`);
    if (!topicRow) {
        console.error(`[Heatmap] Could not find topic row for "${topic}"`);
        return;
    }

    if (expandedRows.has(topic)) {
        // Collapse logic
        expandedRows.delete(topic);
        const chartRow = topicRow.nextElementSibling;
        if (chartRow && chartRow.classList.contains('expanded-row')) {
            const expandableContent = chartRow.querySelector('.expandable-content') as HTMLElement;
            if (expandableContent) {
                // Set current height explicitly, then animate to 0 with opacity fade
                expandableContent.style.maxHeight = expandableContent.scrollHeight + 'px';
                expandableContent.style.opacity = '1';
                // Force reflow
                expandableContent.offsetHeight;
                expandableContent.style.maxHeight = '0px';
                expandableContent.style.opacity = '0';
                
                // Remove row after animation completes
                expandableContent.addEventListener('transitionend', () => {
                    if (chartRow.parentNode) {
                        chartRow.remove();
                    }
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
        // Expand logic
        expandedRows.add(topic);
        if (!chartOptions.has(topic)) {
            chartOptions.set(topic, { metric: 'problemsSolved', view: 'Monthly', split: false });
        }
        
        const newRow = document.createElement('tr');
        newRow.className = 'expanded-row';
        newRow.innerHTML = getChartRowHtml(topic);
        
        topicRow.insertAdjacentElement('afterend', newRow);
        addChartControlListeners(newRow, topic);
        
        // Get the expandable content and measure its natural height
        const expandableContent = newRow.querySelector('.expandable-content') as HTMLElement;
        if (expandableContent) {
            // Temporarily set max-height to auto to measure content
            expandableContent.style.maxHeight = 'auto';
            const scrollHeight = expandableContent.scrollHeight;
            
            // Reset to 0 with opacity 0, then animate to the measured height with opacity 1
            expandableContent.style.maxHeight = '0px';
            expandableContent.style.opacity = '0';
            // Force reflow
            expandableContent.offsetHeight;
            expandableContent.style.maxHeight = scrollHeight + 'px';
            expandableContent.style.opacity = '1';
        }
        
        button.querySelector('span')!.textContent = '−';
        
        // Defer chart rendering
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    console.log(`[Heatmap] About to call renderChart for ${topic}`);
                    renderChart(topic);
                }, 0);
            });
        });
    }
}







    function showLoadingState(topic: string) {
        const canvasId = `skill-chart-${topic.replace(/\s+/g, '-')}`;
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Clear and show loading
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.textAlign = 'center';
                ctx.font = '14px sans-serif';
                ctx.fillText('Loading chart...', canvas.width / 2, canvas.height / 2);
            }
        }
    }
    
    function getChartRowHtml(topic: string): string {
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
                        <!-- Time View Toggle -->
                        <div class="text-sd-muted-foreground inline-flex items-center justify-center bg-sd-muted rounded-full p-[1px]">
                            <button class="chart-view-btn whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs" data-view="Daily" data-topic="${topic}" data-state="inactive">
                                Daily
                            </button>
                            <button class="chart-view-btn whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs" data-view="Monthly" data-topic="${topic}" data-state="active">
                                Monthly
                            </button>
                            <button class="chart-view-btn whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs" data-view="Yearly" data-topic="${topic}" data-state="inactive">
                                Yearly
                            </button>
                        </div>
                        <!-- Difficulty Split Toggle -->
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
    .expandable-content {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.4s ease, opacity 0.4s ease;
    }
    .chart-tooltip {
        position: absolute;
        top: 0;
        left: 0;
        background: #282828;
        border: 2px solid #393939;
        border-radius: 8px;
        padding: 12px;
        font-size: 13px;
        color: #f9ffff;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        width: max-content;
        max-width: 300px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease, transform 0.15s ease-out;
    }
    .tooltip-header { 
        font-weight: 500; 
        margin-bottom: 8px; 
        color: #f9ffff; 
    }
    .tooltip-subheader { 
        margin-bottom: 12px; 
        font-size: 12px; 
        color: #bdbeb3; 
    }
    .tooltip-subheader-value { 
        font-weight: 500; 
        color: #f9ffff; 
        margin-left: 6px; 
    }
    .tooltip-divider { 
        border-top: 1px solid #353535; 
        margin: 10px 0; 
    }
    .tooltip-breakdown-list { 
        list-style: none; 
        padding: 0; 
        margin: 0; 
        display: flex; 
        flex-direction: column; 
        gap: 5px; 
    }
    .tooltip-breakdown-item { 
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        font-size: 12px; 
        gap: 16px;
    }
    .tooltip-breakdown-label { 
        display: flex; 
        align-items: center; 
        gap: 8px; 
        color: #bdbeb3; 
    }
    .tooltip-breakdown-value { 
        font-weight: 500; 
        color: #f9ffff; 
    }
    .status-dot { 
        display: inline-block; 
        width: 8px; 
        height: 8px; 
        border-radius: 50%; 
    }
</style>
    `;
}



    function addChartControlListeners(row: HTMLElement, topic: string) {
    const metricSelector = row.querySelector('.metric-selector');
    const metricOptions = row.querySelector('.metric-options');
    
    // Dropdown toggle
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
        option.addEventListener('click', (e) => {
            const value = option.getAttribute('data-value') as 'problemsSolved' | 'avgTries' | 'firstAceRate';
            const span = metricSelector?.querySelector('span');
            const labels = {
                problemsSolved: 'Problems Solved', // ✅ CHANGED
                avgTries: 'Average Attempts', 
                firstAceRate: 'First Ace Rate'
            };
            if (span) span.textContent = labels[value];
            
            const opts = chartOptions.get(topic)!;
            opts.metric = value;
            chartOptions.set(topic, opts);
            
            // Update visual selection
            metricOptions?.querySelectorAll('[data-value]').forEach(opt => {
                const checkIcon = opt.querySelector('span');
                if (checkIcon) {
                    checkIcon.classList.toggle('visible', opt === option);
                    checkIcon.classList.toggle('invisible', opt !== option);
                }
                opt.classList.toggle('bg-fill-3', opt === option);
                opt.classList.toggle('dark:bg-dark-fill-3', opt === option);
                opt.classList.toggle('font-medium', opt === option);
            });
            
            metricOptions?.classList.add('hidden');
            metricSelector?.setAttribute('aria-expanded', 'false');
            

            renderChart(topic)
        });
    });

    // Updated chart view toggle logic
    row.querySelectorAll('.chart-view-btn').forEach(el => {
        el.addEventListener('click', e => {
            const button = e.currentTarget as HTMLButtonElement;
            const view = button.dataset.view as any;
            const opts = chartOptions.get(topic)!;
            opts.view = view;
            chartOptions.set(topic, opts);
            
            // Update toggle states
            button.parentElement?.querySelectorAll('button').forEach(btn => {
                btn.setAttribute('data-state', btn === button ? 'active' : 'inactive');
            });

            renderChart(topic)
        });
    });

    // Updated difficulty toggle logic
    row.querySelectorAll('.difficulty-toggle').forEach(el => {
        el.addEventListener('click', e => {
            const button = e.currentTarget as HTMLButtonElement;
            const isAggregate = button.textContent?.trim() === 'Aggregate';
            const opts = chartOptions.get(topic)!;
            opts.split = !isAggregate;
            chartOptions.set(topic, opts);
            
            // Update toggle states
            button.parentElement?.querySelectorAll('button').forEach(btn => {
                const btnIsAggregate = btn.textContent?.trim() === 'Aggregate';
                btn.setAttribute('data-state', (btnIsAggregate === isAggregate) ? 'active' : 'inactive');
            });

            renderChart(topic)
        });
    });
}



function aggregateTimeSeriesData(
    data: TimeSeriesPoint[], 
    view: 'Daily' | 'Monthly' | 'Yearly'
): TimeSeriesPoint[] {
    if (view === 'Daily') return data;
    
    const grouped = new Map<string, TimeSeriesPoint[]>();
    
    data.forEach(point => {
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
    
    // For each period, take the LAST value (most recent state)
    const aggregated: TimeSeriesPoint[] = [];
    
    for (const [period, points] of grouped.entries()) {
        const sortedPoints = points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const lastPoint = sortedPoints[sortedPoints.length - 1];
        
        // Create period-end date for proper chart display
        let periodDate: string;
if (view === 'Monthly') {
    // For 'Monthly' view, 'period' is 'YYYY-MM'. Set date to the 1st.
    periodDate = `${period}-01`;
} else {
    // For 'Yearly' view, 'period' is 'YYYY'. Set date to Jan 1st.
    periodDate = `${period}-01-01`;
}
        
        aggregated.push({
            date: periodDate,
            value: lastPoint.value,
            easy: lastPoint.easy,
            medium: lastPoint.medium,
            hard: lastPoint.hard
        });
    }
    
    return aggregated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}


 function renderChart(topic: string) {
        const canvas = container.querySelector(`#skill-chart-${topic.replace(/\s+/g, '-')}`) as HTMLCanvasElement;
        if (!canvas || !canvas.getContext) return;

        const chartId = canvas.id;
        if (charts.has(chartId)) {
            charts.get(chartId)!.destroy();
            charts.delete(chartId);
        }

        const ctx = canvas.getContext('2d')!;
        const timeSeries = data.timeSeriesData[topic];
        const localOpts = chartOptions.get(topic)!;
        const metricData = timeSeries?.[localOpts.metric];

        if (!metricData || metricData.length === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgb(107, 114, 128)';
            ctx.textAlign = 'center';
            ctx.font = '14px sans-serif';
            ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
            return;
        }

        const aggregatedData = aggregateTimeSeriesData(metricData, localOpts.view);
        const colors = { easy: '#58b8b9', medium: '#f4ba40', hard: '#e24a41', aggregate: '#5db666' };
        const datasets: any[] = [];

        if (localOpts.split) {
            (['easy', 'medium', 'hard'] as const).forEach(diff => {
                datasets.push({
                    label: diff.charAt(0).toUpperCase() + diff.slice(1),
                    data: aggregatedData.map(p => ({ x: p.date, y: p[diff] })),
                    borderColor: colors[diff],
                });
            });
        } else {
            datasets.push({
                label: 'Overall',
                data: aggregatedData.map(p => ({ x: p.date, y: p.value })),
                borderColor: colors.aggregate,
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
                        radius: 0, // No points by default
                        hoverRadius: 5, // Show a 5px radius circle on hover
                        hoverBorderWidth: 2, // With a 2px border
                    },
                    line: {
                        tension: 0.4,
                        cubicInterpolationMode: 'monotone',
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: timeScaleConfig[localOpts.view].unit,
                            tooltipFormat: timeScaleConfig[localOpts.view].tooltipFormat
                        },
                        grid: { display: false },
                        ticks: { color: '#bdbeb3' }
                    },
                    y: {
                        beginAtZero: localOpts.metric !== 'avgTries',
                        min: localOpts.metric === 'avgTries' ? 1 : undefined,
                        grid: { display: false },
                        ticks: { color: '#bdbeb3' }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false, // Disable native tooltip
                        // Located in: renderChart > options > plugins > tooltip
// Replace the ENTIRE external callback function body with this:

external: (context) => {
    // 1. Get references and handle hiding the tooltip
    const tooltipId = `tooltip-${topic.replace(/\s+/g, '-')}`;
    const tooltipEl = document.getElementById(tooltipId);
    if (!tooltipEl) return;

    const tooltipModel = context.tooltip;
    if (tooltipModel.opacity === 0 || !tooltipModel.dataPoints.length) {
        tooltipEl.style.opacity = '0';
        tooltipEl.style.pointerEvents = 'none';
        return;
    }

    // 2. Get the data for the hovered point
    const dataIndex = tooltipModel.dataPoints[0].dataIndex;
    const dataPoint = aggregatedData[dataIndex];
    if (!dataPoint) {
        tooltipEl.style.opacity = '0';
        tooltipEl.style.pointerEvents = 'none';
        return;
    };

    // 3. Build the tooltip's inner HTML (this logic is unchanged)
    let formattedDate = new Date(dataPoint.date).toLocaleDateString('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: localOpts.view === 'Daily' ? 'short' : 'long',
        day: localOpts.view === 'Daily' ? 'numeric' : undefined,
    });
     if (localOpts.view === 'Yearly') {
        formattedDate = new Date(dataPoint.date).getUTCFullYear().toString();
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
            if (value !== undefined && value !== null && value > 0) {
                innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${colors[diff.toLowerCase() as 'easy' | 'medium' | 'hard']};"></span>${diff}</span><span class="tooltip-breakdown-value">${formatValue(value, localOpts.metric)}</span></li>`;
            }
        });
        innerHtml += `</ul>`;
    }

    tooltipEl.innerHTML = innerHtml;

    // 4. Position the tooltip (ADAPTED FROM THE WORKING CUMULATIVE CHART)
    const container = context.chart.canvas.parentNode as HTMLElement;
    if (!container) return;

    // Default position is 15px to the right of the cursor
    let newLeft = tooltipModel.caretX + 15;
    let newTop = tooltipModel.caretY;

    // If it overflows the right edge, flip it to the left of the cursor
    if (newLeft + tooltipEl.offsetWidth > container.offsetWidth) {
        newLeft = tooltipModel.caretX - tooltipEl.offsetWidth - 15;
    }

    // Prevent it from going off the top or left edges
    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;
    
    // Prevent it from going off the bottom edge
    if (newTop + tooltipEl.offsetHeight > container.offsetHeight) {
        newTop = container.offsetHeight - tooltipEl.offsetHeight;
    }

    // 5. Apply the position and make it visible
    tooltipEl.style.opacity = '1';
    tooltipEl.style.pointerEvents = 'none'; // This is safer to prevent flickering
    tooltipEl.style.transform = `translate(${newLeft}px, ${newTop}px)`;
}
                    }
                }
            }
        });
        charts.set(chartId, chart);
    }



    // Helper Functions
    function getHeatmapColor(value: number, metric: 'problemsSolved' | 'avgTries' | 'firstAceRate'): string {
    const bestColor = { r: 93, g: 182, b: 102 };   // #5db666 (Green)
    const middleColor = { r: 244, g: 186, b: 64 }; // #f4ba40 (Yellow)
    const worstColor = { r: 230, g: 107, b: 98 };  // #e66b62 (Red)
    
    // Percent represents "badness": 0.0 is best (green), 0.5 is middle (yellow), 1.0 is worst (red)
    let percent = 0;

    if (metric === 'avgTries') {
        // Lower is better. Anything >= 6 attempts is considered "worst".
        // Use an exponential scale to penalize higher attempts more.
        const WORST_CASE_ATTEMPTS = 4;
        if (value <= 1) {
            percent = 0; // Best case
        } else {
            const scale = (value - 1) / (WORST_CASE_ATTEMPTS - 1);
            percent = Math.min(1, scale ** 1.5); // Power of 1.5 makes it non-linear
        }
    } else if (metric === 'problemsSolved') {
        // Higher is better. Target of 30 problems for "mastery".
        // Use a sqrt scale for diminishing returns.rgb(230, 107, 98)
        const TARGET_PROBLEMS = 20;
        const ratio = Math.min(1, value / TARGET_PROBLEMS);
        percent = 1 - Math.sqrt(ratio); // The sqrt makes the color improve faster at the beginning.
    } else { // firstAceRate
        // Higher is better (0-100).
        // Use a sqrt scale so high percentages (e.g., 80%+) look very good.
        const ratio = value / 100;
        percent = 1 - Math.sqrt(ratio); // An ACE rate of 25% will be the 0.5 (yellow) mark.
    }
    
    let r, g, b;
    
    if (percent <= 0.5) {
        // Interpolate between best (green) and middle (yellow)
        const localPercent = percent * 2;
        r = Math.round(bestColor.r + localPercent * (middleColor.r - bestColor.r));
        g = Math.round(bestColor.g + localPercent * (middleColor.g - bestColor.g));
        b = Math.round(bestColor.b + localPercent * (middleColor.b - bestColor.b));
    } else {
        // Interpolate between middle (yellow) and worst (red)
        const localPercent = (percent - 0.5) * 2;
        r = Math.round(middleColor.r + localPercent * (worstColor.r - middleColor.r));
        g = Math.round(middleColor.g + localPercent * (worstColor.g - middleColor.g));
        b = Math.round(middleColor.b + localPercent * (worstColor.b - middleColor.b));
    }

    // You had a 0.6 opacity in your example, which is great for softening the colors.
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
        if (value === Infinity) {
            return '∞';
        }
        return value.toFixed(1);
    } else if (metric === 'problemsSolved') {
        // ✅ NEW: Format problems solved as whole number
        return value.toString();
    }
    return `${value.toFixed(0)}%`;
}


    const instance: SkillMatrixHeatmapInstance = {
        update: (newData, newOptions) => {
            console.log('[Heatmap] Full update triggered.');
            Object.assign(data, newData);
            Object.assign(options, newOptions);
            // Enhanced cleanup
            charts.forEach((chart, id) => {
                chart.destroy();
                delete (chart as any).canvas;
                delete (chart as any).ctx;
            });
            charts.clear();
            expandedRows.clear();
            chartOptions.clear();
            renderInitialTable();
        },
        destroy: () => {
            console.log('[Heatmap] Destroying component.');
            // Enhanced cleanup
            charts.forEach((chart, id) => {
                chart.destroy();
                delete (chart as any).canvas;
                delete (chart as any).ctx;
            });
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
