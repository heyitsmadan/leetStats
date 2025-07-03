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
        metric: 'acceptanceRate' | 'avgTries' | 'firstAceRate',
        view: 'Daily' | 'Monthly' | 'Yearly',
        split: boolean,
    }>();

    function renderInitialTable() {
        console.time('[Heatmap] renderInitialTable');
        const metrics = ['acceptanceRate', 'avgTries', 'firstAceRate'] as const;
        const metricLabels = {
            acceptanceRate: 'Success Rate',
            avgTries: 'Avg. Attempts',
            firstAceRate: 'First Try Rate'
        };

        container.innerHTML = `
            <div class="w-full">
                <h3 class="text-lg font-medium text-label-1 dark:text-dark-label-1 mb-4">Skill Matrix</h3>
                <div class="overflow-x-auto rounded-lg border border-divider-3 dark:border-dark-divider-3 bg-layer-1 dark:bg-dark-layer-1">
                    <table class="w-full border-collapse" style="table-layout: fixed;">
                        <thead>
                            <tr class="bg-layer-2 dark:bg-dark-layer-2 border-b border-divider-3 dark:border-dark-divider-3">
                                <th class="text-left p-3 text-sm font-medium text-label-2 dark:text-dark-label-2" style="width: 30%;">Topic</th>
                                ${metrics.map(metric => `<th class="text-center p-3 text-sm font-medium text-label-2 dark:text-dark-label-2" style="width: ${70/3}%;">${metricLabels[metric]}</th>`).join('')}
                                <th style="width: 40px;"></th>
                            </tr>
                        </thead>
                        <tbody id="skill-matrix-tbody">
                            ${data.topics.map(topic => `
                                <tr class="topic-row border-b border-divider-3 dark:border-dark-divider-3 last:border-b-0" data-topic-row="${topic}">
                                    <td class="p-3 text-sm text-label-1 dark:text-dark-label-1 font-medium">${topic}</td>
                                    ${metrics.map(metric => {
                                        const value = data.metrics[metric][topic] || 0;
                                        const color = getHeatmapColor(value, metric);
                                        return `<td class="p-0 text-center font-medium text-sm" style="background-color: ${color}; color: ${getTextColor(color)};">
                                            <div class="p-2">${formatMetricValue(value, metric)}</div>
                                        </td>`;
                                    }).join('')}
                                    <td class="p-3 text-center">
                                        <button class="expand-btn w-6 h-6 flex items-center justify-center cursor-pointer" data-topic="${topic}">
                                            <span class="text-xl font-light text-label-2 dark:text-dark-label-2">+</span>
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
        // Collapse logic (unchanged)
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
        // Expand with proper async handling
        expandedRows.add(topic);
        if (!chartOptions.has(topic)) {
            chartOptions.set(topic, { metric: 'acceptanceRate', view: 'Monthly', split: false });
        }
        
        const newRow = document.createElement('tr');
        newRow.className = 'expanded-row';
        newRow.innerHTML = getChartRowHtml(topic);
        
        topicRow.insertAdjacentElement('afterend', newRow);
        addChartControlListeners(newRow, topic);
        
        // Show loading state immediately
        const canvasId = `skill-chart-${topic.replace(/\s+/g, '-')}`;
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.textAlign = 'center';
                ctx.font = '14px sans-serif';
                ctx.fillText('Loading chart...', canvas.width / 2, canvas.height / 2);
            }
        }
        
        // Properly defer chart rendering
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    console.log(`[Heatmap] About to call renderChart for ${topic}`);
                    renderChart(topic);
                }, 100);
            });
        });
        
        button.querySelector('span')!.textContent = '−';
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
            <td colspan="5" class="p-0 bg-layer-2 dark:bg-dark-layer-2">
                <div class="p-4 border-t-2 border-divider-3 dark:border-dark-divider-3">
                    <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
                        <select class="metric-selector bg-layer-1 dark:bg-dark-layer-1 border border-divider-3 dark:border-dark-divider-3 rounded p-1 text-xs" data-topic="${topic}">
                            <option value="acceptanceRate">Success Rate</option>
                            <option value="avgTries">Avg. Attempts</option>
                            <option value="firstAceRate">First Try Rate</option>
                        </select>
                        <div class="flex gap-2 flex-wrap">
                            <div class="flex bg-layer-1 dark:bg-dark-layer-1 p-0.5 rounded border border-divider-3 dark:border-dark-divider-3">
                                <button class="chart-view-btn px-2 py-0.5 rounded text-xs" data-view="Daily" data-topic="${topic}">D</button>
                                <button class="chart-view-btn px-2 py-0.5 rounded text-xs bg-fill-3 dark:bg-dark-fill-3" data-view="Monthly" data-topic="${topic}">M</button>
                                <button class="chart-view-btn px-2 py-0.5 rounded text-xs" data-view="Yearly" data-topic="${topic}">Y</button>
                            </div>
                            <div class="flex bg-layer-1 dark:bg-dark-layer-1 p-0.5 rounded border border-divider-3 dark:border-dark-divider-3">
                                <button class="difficulty-toggle px-2 py-0.5 rounded text-xs" data-topic="${topic}">Split Difficulty</button>
                            </div>
                        </div>
                    </div>
                    <div class="relative h-60 w-full">
                        <canvas id="skill-chart-${topic.replace(/\s+/g, '-')}" class="w-full h-full"></canvas>
                    </div>
                </div>
            </td>
        `;
    }

    function addChartControlListeners(row: HTMLElement, topic: string) {
        row.querySelector('.metric-selector')?.addEventListener('change', e => {
            const select = e.currentTarget as HTMLSelectElement;
            const opts = chartOptions.get(topic)!;
            opts.metric = select.value as any;
            chartOptions.set(topic, opts);
            showLoadingState(topic);
            setTimeout(() => renderChart(topic), 10);
        });

        row.querySelector('.difficulty-toggle')?.addEventListener('click', e => {
            const button = e.currentTarget as HTMLButtonElement;
            const opts = chartOptions.get(topic)!;
            opts.split = !opts.split;
            chartOptions.set(topic, opts);
            button.classList.toggle('bg-fill-3', opts.split);
            button.classList.toggle('dark:bg-dark-fill-3', opts.split);
            showLoadingState(topic);
            setTimeout(() => renderChart(topic), 10);
        });

        row.querySelectorAll('.chart-view-btn').forEach(el => {
            el.addEventListener('click', e => {
                const button = e.currentTarget as HTMLButtonElement;
                const view = button.dataset.view as any;
                const opts = chartOptions.get(topic)!;
                opts.view = view;
                chartOptions.set(topic, opts);
                
                button.parentElement?.querySelectorAll('button').forEach(btn => {
                    btn.classList.toggle('bg-fill-3', btn === button);
                    btn.classList.toggle('dark:bg-dark-fill-3', btn === button);
                });

                showLoadingState(topic);
                setTimeout(() => renderChart(topic), 10);
            });
        });
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
    const colors = { easy: '#00af8c', medium: '#ffb800', hard: '#ff375f', aggregate: '#58b8b9' };
    
    if (localOpts.split) {
        (['easy', 'medium', 'hard'] as const).forEach(diff => {
            const diffData = validData.map(p => ({ 
                x: p.date, 
                y: typeof p[diff] === 'number' && !isNaN(p[diff]) ? p[diff] : 0 
            }));
            datasets.push({
                label: diff.charAt(0).toUpperCase() + diff.slice(1),
                data: diffData,
                borderColor: colors[diff],
                tension: 0.4,
                pointRadius: 2,
            });
        });
    } else {
        const overallData = validData.map(p => ({ x: p.date, y: p.value }));
        datasets.push({
            label: 'Overall',
            data: overallData,
            borderColor: colors.aggregate,
            tension: 0.4,
            pointRadius: 2,
        });
    }

    console.log(`[Heatmap] Created ${datasets.length} datasets`);
    console.log(`[Heatmap] Sample dataset structure:`, JSON.stringify(datasets[0], null, 2));

    // **SIMPLIFIED CHART CONFIG FOR TESTING**
    console.log(`[Heatmap] About to create Chart.js instance...`);
    
    try {
        const chart = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                elements: {
                    point: { radius: 0 }, // Remove points for performance
                    line: { tension: 0 }   // Remove curves for performance
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',  // Force to day unit for testing
                            tooltipFormat: 'MMM dd, yyyy'
                        }
                    },
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: { display: false } // Disable legend for testing
                }
            }
        });
        
        console.log(`[Heatmap] ✅ Chart created successfully!`);
        charts.set(chartId, chart);
        
    } catch (error) {
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
    function getHeatmapColor(value: number, metric: 'acceptanceRate' | 'avgTries' | 'firstAceRate'): string {
        const lcGreen = { r: 88, g: 184, b: 185 };
        const lcRed = { r: 226, g: 74, b: 65 };
        
        let percent = 0;
        if (metric === 'avgTries') {
            if (value <= 1) percent = 0;
            else percent = Math.min(1, (value - 1) / 4);
        } else {
            percent = 1 - (value / 100);
        }

        if (value === 0 && metric !== 'avgTries') return 'transparent';
        
        const r = Math.round(lcGreen.r + percent * (lcRed.r - lcGreen.r));
        const g = Math.round(lcGreen.g + percent * (lcRed.g - lcGreen.g));
        const b = Math.round(lcGreen.b + percent * (lcRed.b - lcGreen.b));

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
        return metric === 'avgTries' ? value.toFixed(1) : `${value.toFixed(0)}%`;
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
