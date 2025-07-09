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
                            <th class="text-left p-3 text-sm font-medium text-label-1 dark:text-dark-label-1" style="width: 30%;"></th>
                            ${metrics.map(metric => `<th class="text-center p-3 text-sm font-medium text-label-1 dark:text-dark-label-1" style="width: ${70/3}%;">${metricLabels[metric]}</th>`).join('')}
                            <th style="width: 40px;"></th>
                        </tr>
                    </thead>
                    <tbody id="skill-matrix-tbody">
                        ${data.topics.map(topic => `
                            <tr class="topic-row last:border-b-0" data-topic-row="${topic}">
                                <td class="p-3 text-sm text-label-1 dark:text-dark-label-1 font-medium">${formatTopicName(topic)}</td>
                                ${metrics.map(metric => {
                                    const value = data.metrics[metric][topic] || 0;
                                    const color = getHeatmapColor(value, metric);
                                    return `<td class="p-0 text-center font-medium text-sm" style="background-color: ${color}; color: ${getTextColor(color)};">
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
            chartRow.remove();
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
        
        
        button.querySelector('span')!.textContent = '−';
        
        // Properly defer chart rendering
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
                </div>
            </div>
        </td>
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
            const [year, month] = period.split('-');
            const lastDayOfMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
            periodDate = `${year}-${month}-${lastDayOfMonth.toString().padStart(2, '0')}`;
        } else {
            periodDate = `${period}-12-31`;
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
    console.log(`[Heatmap] Starting renderChart for topic: "${topic}"`);
    
    const canvas = container.querySelector(`#skill-chart-${topic.replace(/\s+/g, '-')}`) as HTMLCanvasElement;
    if (!canvas) {
        console.error(`[Heatmap] Canvas not found`);
        return;
    }

    // Check canvas dimensions
    console.log(`[Heatmap] Canvas dimensions: ${canvas.offsetWidth}x${canvas.offsetHeight}`);
    if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) {
        console.error(`[Heatmap] Canvas has zero dimensions`);
        return;
    }

    const chartId = canvas.id;
    if (charts.has(chartId)) {
        charts.get(chartId)!.destroy();
        charts.delete(chartId);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error(`[Heatmap] Failed to get 2D context`);
        return;
    }

    const timeSeries = data.timeSeriesData[topic];
    const localOpts = chartOptions.get(topic)!;
    
    if (!timeSeries || !localOpts) {
        console.warn(`[Heatmap] Missing data or options`);
        return;
    }
    
    const metricData = timeSeries[localOpts.metric];
    console.log(`[Heatmap] Data validation - Topic: "${topic}", Metric: "${localOpts.metric}", Points: ${metricData?.length || 0}`);

    if (!metricData || metricData.length === 0) {
        console.warn(`[Heatmap] No metric data available`);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgb(107, 114, 128)';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
        return;
    }

    // **CRITICAL**: Detailed data inspection
    console.log(`[Heatmap] Raw sample data points:`, JSON.stringify(metricData.slice(0, 3), null, 2));
    const aggregatedData = aggregateTimeSeriesData(metricData, localOpts.view);
    // Validate and sanitize data
    // const validData = metricData.filter(point => {
    //     const date = new Date(point.date);
    //     const isValidDate = !isNaN(date.getTime());
    //     const isValidValue = typeof point.value === 'number' && !isNaN(point.value) && isFinite(point.value);
        
    //     if (!isValidDate) {
    //         console.error(`[Heatmap] Invalid date: "${point.date}"`);
    //         return false;
    //     }
    //     if (!isValidValue) {
    //         console.error(`[Heatmap] Invalid value: ${point.value}`);
    //         return false;
    //     }
    //     return true;
    // });
    const validData = metricData
    console.log(`[Heatmap] Filtered ${metricData.length} -> ${validData.length} valid data points`);

    if (validData.length === 0) {
        console.error(`[Heatmap] No valid data points after filtering`);
        ctx.fillStyle = 'rgb(255, 0, 0)';
        ctx.textAlign = 'center';
        ctx.fillText('Invalid data format', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Limit data points for performance (testing with 50 points max)
    // const limitedData = validData.slice(-50);
    console.log(`[Heatmap] Using ${validData.length} data points (limited for performance)`);

    console.log(`[Heatmap] Creating datasets...`);
    const datasets: any[] = [];
    const colors = { easy: '#00af8c', medium: '#ffb800', hard: '#ff375f', aggregate: '#5db666' };
    
    // In the renderChart function, update the dataset creation:
    if (localOpts.split) {
        (['easy', 'medium', 'hard'] as const).forEach(diff => {
            const diffData = aggregatedData
                .filter(p => p[diff] !== undefined)
                .map(p => ({ 
                    x: p.date, 
                    y: p[diff] 
                }));
            
            if (diffData.length > 0) {
                datasets.push({
                    label: diff.charAt(0).toUpperCase() + diff.slice(1),
                    data: diffData,
                    borderColor: colors[diff],
                    tension: 0.4,
                    cubicInterpolationMode: 'monotone',
                    pointRadius: 0,
                    pointHoverRadius: 0,
                });
            }
        });
    } else {
        const overallData = aggregatedData.map(p => ({ x: p.date, y: p.value }));
        datasets.push({
            label: 'Overall',
            data: overallData, 
            borderColor: colors.aggregate,
            tension: 0.4,
            cubicInterpolationMode: 'monotone',
            pointRadius: 0,
            pointHoverRadius: 0,
        });
    }


    console.log(`[Heatmap] Created ${datasets.length} datasets`);
    console.log(`[Heatmap] Sample dataset structure:`, JSON.stringify(datasets[0], null, 2));

    // **SIMPLIFIED CHART CONFIG FOR TESTING**
    console.log(`[Heatmap] About to create Chart.js instance...`);
    // In renderChart function, update the time scale configuration
const timeScaleConfig = {
    'Daily': { unit: 'day', tooltipFormat: 'MMM dd, yyyy' },
    'Monthly': { unit: 'month', tooltipFormat: 'MMM yyyy' },
    'Yearly': { unit: 'year', tooltipFormat: 'yyyy' }
} as const;

const scaleConfig = timeScaleConfig[localOpts.view];

// Apply aggregation to your data
    try {
    const chart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            backgroundColor: 'transparent', // Match table background // Match table background
                // ✅ NEW: Disable all interactions and tooltips
                interaction: {
                    intersect: false,
                    mode: null as any, // Disable all interactions
                },
            elements: {
                point: { 
                    radius: 0, // Remove circles
                    hoverRadius: 0 
                },
                line: { tension: 0.4 }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: scaleConfig.unit,
                        tooltipFormat: scaleConfig.tooltipFormat
                    },
                    grid: {
                        display: false // Remove gridlines
                    }
                },
                y: {
                    beginAtZero: localOpts.metric !== 'avgTries',
                    min: localOpts.metric === 'avgTries' ? 1 : undefined, // ✅ Start at 1
                    grid: {
                        display: false // Remove gridlines
                    }
                }
            },
            plugins: {
                legend: { 
                    display: false
                }
            }
        }
    });
    
    console.log(`[Heatmap] ✅ Chart created successfully!`);
    charts.set(chartId, chart);
    
}catch (error) {
    if (error instanceof Error) {
        console.error(`[Heatmap] ❌ Chart creation failed:`, error);
        console.error(`[Heatmap] Error stack:`, error.stack);

        // Show error on canvas
        ctx.fillStyle = 'rgb(255, 0, 0)';
        ctx.textAlign = 'center';
        ctx.font = '12px sans-serif';
        ctx.fillText(`Chart Error: ${error.message}`, canvas.width / 2, canvas.height / 2);
    } else {
        console.error(`[Heatmap] ❌ Chart creation failed with unknown error:`, error);

        ctx.fillStyle = 'rgb(255, 0, 0)';
        ctx.textAlign = 'center';
        ctx.font = '12px sans-serif';
        ctx.fillText(`Unknown chart error`, canvas.width / 2, canvas.height / 2);
    }
}

}



    // Helper Functions
    function getHeatmapColor(value: number, metric: 'problemsSolved' | 'avgTries' | 'firstAceRate'): string {
    const bestColor = { r: 93, g: 182, b: 102 };   // #5db666
    const worstColor = { r: 230, g: 107, b: 98 };  // #e66b62
    
    let percent = 0;
    if (metric === 'avgTries') {
        // For average attempts, lower is better
        if (value <= 1) percent = 0; // Best case
        else percent = Math.min(1, (value - 1) / 4); // Worst case approaches 1
    } else if (metric === 'problemsSolved') {
        // ✅ NEW: For problems solved, higher is better (similar to acceptance rate)
        // Use a reasonable scale - assume max ~50 problems per topic as "excellent"
        const maxExpected = 20;
        percent = 1 - Math.min(1, value / maxExpected);
    } else {
        // For first ace rate, higher is better
        percent = 1 - (value / 100); // Invert so 100% = 0 (best), 0% = 1 (worst)
    }
    
    const r = Math.round(bestColor.r + percent * (worstColor.r - bestColor.r));
    const g = Math.round(bestColor.g + percent * (worstColor.g - bestColor.g));
    const b = Math.round(bestColor.b + percent * (worstColor.b - bestColor.b));

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
