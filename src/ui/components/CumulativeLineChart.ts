import { Chart, ChartConfiguration, TooltipModel, ChartOptions } from 'chart.js';
import type { CumulativeChartStats, Difficulty, CumulativeView, TimeRange } from '../../types';

export type CumulativeLineChartInstance = Chart<'line', number[], string>;

// Helper function to get the ordinal suffix for a day (1st, 2nd, 3rd, 4th)
function getOrdinalSuffix(day: number): string {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
    }
}

// Helper to create the custom HTML tooltip element (Unchanged)
function getOrCreateTooltip(chart: Chart): HTMLElement {
    let tooltipEl = chart.canvas.parentNode?.querySelector('div.chart-tooltip') as HTMLElement;

    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'chart-tooltip';
        const parent = chart.canvas.parentNode as HTMLElement;
        if (parent) {
            parent.style.position = 'relative';
            parent.appendChild(tooltipEl);
        }

        const style = document.createElement('style');
        style.textContent = `
            .chart-tooltip {
                position: absolute; top: 0; left: 0; background: #282828; border: 2px solid #393939;
                border-radius: 8px; padding: 12px; font-size: 13px; color: #f9ffff;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); z-index: 1000; width: max-content;
                max-width: 300px; opacity: 0; pointer-events: none;
                transition: opacity 0.2s ease, transform 0.15s ease-out;
            }
            .tooltip-header { font-weight: 500; margin-bottom: 8px; color: #f9ffff; }
            .tooltip-subheader { margin-bottom: 4px; font-size: 12px; color: #bdbeb3; }
            .tooltip-subheader:last-of-type { margin-bottom: 12px; }
            .tooltip-subheader-value { font-weight: 500; color: #f9ffff; margin-left: 6px; }
            .tooltip-divider { border-top: 1px solid #353535; margin: 10px 0; }
            .tooltip-breakdown-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 5px; }
            .tooltip-breakdown-item { display: flex; align-items: center; justify-content: space-between; font-size: 12px; gap: 16px}
            .tooltip-breakdown-label { display: flex; align-items: center; gap: 8px; color: #bdbeb3; }
            .tooltip-breakdown-value { font-weight: 500; color: #f9ffff; }
            .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
        `;
        document.head.appendChild(style);
    }
    return tooltipEl;
}

export function renderOrUpdateCumulativeLineChart(
    container: HTMLElement,
    chartData: CumulativeChartStats,
    // *** FIX: Pass filters object for more context ***
    filters: { difficulty: Difficulty; cumulativeView: CumulativeView; timeRange: TimeRange },
    existingChart?: CumulativeLineChartInstance
): CumulativeLineChartInstance {
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Canvas element not found in the container.');

    // *** FIX: Restore original point styling by processing datasets ***
    const processedChartData = {
        ...chartData,
        datasets: chartData.datasets.map(dataset => ({
            ...dataset,
            pointRadius: 0,
            pointHoverRadius: 4,
        }))
    };

    const handleTooltip = (context: { chart: Chart, tooltip: TooltipModel<'line'> }) => {
        const tooltipEl = getOrCreateTooltip(context.chart);
        const tooltipModel = context.tooltip;

        if (tooltipModel.opacity === 0) {
            tooltipEl.style.opacity = '0';
            return;
        }

        const dataIndex = tooltipModel.dataPoints[0]?.dataIndex;
        if (dataIndex === undefined) return;

        const rawLabel = tooltipModel.title?.[0] || '';
        const datasets = context.chart.config.data.datasets;

        const date = new Date(rawLabel);
        const day = date.getDate();
        const month = date.toLocaleString('default', { month: 'long' });
        const year = date.getFullYear();
        const formattedDate = `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
        
        let totalSubmissions = 0, easy = 0, medium = 0, hard = 0;
        
        datasets.forEach(dataset => {
            const value = (dataset.data[dataIndex] as number) || 0;
            if (dataset.label === 'Total Submissions') totalSubmissions = value;
            if (dataset.label === 'Easy Solved') easy = value;
            if (dataset.label === 'Medium Solved') medium = value;
            if (dataset.label === 'Hard Solved') hard = value;
        });
        const totalProblems = easy + medium + hard;

        let innerHtml = `<div class="tooltip-header">${formattedDate}</div>`;
        innerHtml += `<div class="tooltip-subheader">Total Problems Solved: <span class="tooltip-subheader-value">${totalProblems}</span></div>`;
        innerHtml += `<div class="tooltip-subheader">Total Submissions: <span class="tooltip-subheader-value">${totalSubmissions}</span></div>`;
        innerHtml += `<div class="tooltip-divider"></div>`;
        innerHtml += `<ul class="tooltip-breakdown-list">`;
        const colors: { [key: string]: string } = { 'Easy': '#58b8b9', 'Medium': '#f4ba40', 'Hard': '#e24a41' };
        
        if (filters.difficulty === 'All' || filters.difficulty === 'Easy') {
            innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${colors['Easy']};"></span> Easy</span><span class="tooltip-breakdown-value">${easy}</span></li>`;
        }
        if (filters.difficulty === 'All' || filters.difficulty === 'Medium') {
            innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${colors['Medium']};"></span> Medium</span><span class="tooltip-breakdown-value">${medium}</span></li>`;
        }
        if (filters.difficulty === 'All' || filters.difficulty === 'Hard') {
            innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${colors['Hard']};"></span> Hard</span><span class="tooltip-breakdown-value">${hard}</span></li>`;
        }
        innerHtml += `</ul>`;

        tooltipEl.innerHTML = innerHtml;

        const parentContainer = context.chart.canvas.parentNode as HTMLElement;
        let newLeft = tooltipModel.caretX + 15;
        let newTop = tooltipModel.caretY;

        if (newLeft + tooltipEl.offsetWidth > parentContainer.offsetWidth) newLeft = tooltipModel.caretX - tooltipEl.offsetWidth - 15;
        if (newTop + tooltipEl.offsetHeight > parentContainer.offsetHeight) newTop = parentContainer.offsetHeight - tooltipEl.offsetHeight;
        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;

        tooltipEl.style.opacity = '1';
        tooltipEl.style.transform = `translate(${newLeft}px, ${newTop}px)`;
    };
    
    const options: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            // *** FIX: Reverted to category scale to fix hover. Dynamic formatting is now in the callback. ***
            x: { 
                grid: { display: false }, 
                ticks: { 
                    color: '#bdbeb3',
                    maxTicksLimit: 6,
                    callback: function(value, index, ticks) {
                        const label = this.getLabelForValue(value as number); // label is ISO string
                        const date = new Date(label);
                        const range = filters.timeRange;
                        
                        if (range === 'All Time') {
                            const labels = this.chart.data.labels as string[];
                            if (labels.length > 0) {
                                const firstDate = new Date(labels[0]);
                                const lastDate = new Date(labels[labels.length - 1]);
                                const yearDiff = lastDate.getFullYear() - firstDate.getFullYear();
                                if (yearDiff >= 2) {
                                     return date.toLocaleDateString(undefined, { year: 'numeric' });
                                }
                            }
                            return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                        }
                        if (range === 'Last 365 Days') {
                            return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                        }
                        // Default for Last 90/30 Days
                        return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
                    }
                } 
            },
            // *** FIX: Reverted y-axis grid to original styling ***
            y: { beginAtZero: true, grid: { display: false }, ticks: { color: '#bdbeb3' } },
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: false,
                external: handleTooltip,
                mode: 'index',
                intersect: false,
            },
        },
        interaction: {
            mode: 'index',
            intersect: false,
        },
    };

    const config: ChartConfiguration<'line', number[], string> = {
        type: 'line',
        data: processedChartData, // Use the data with styling restored
        options: options,
    };

    if (existingChart) {
        existingChart.data = config.data;
        existingChart.options = config.options!;
        existingChart.update();
        return existingChart;
    }
    return new Chart(canvas, config);
}
