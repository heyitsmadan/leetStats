import { Chart, ChartConfiguration, TooltipModel, ChartOptions } from 'chart.js';
import type { CumulativeChartStats, Difficulty, CumulativeView, TimeRange } from '../../types';

export type CumulativeLineChartInstance = Chart<'line', number[], string>;

// Helper function to get the ordinal suffix for a day (e.g., 1st, 2nd, 3rd)
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
    filters: { difficulty: Difficulty; cumulativeView: CumulativeView; timeRange: TimeRange },
    existingChart?: CumulativeLineChartInstance
): CumulativeLineChartInstance {
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Canvas element not found in the container.');

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

        const rawLabel = tooltipModel.title?.[0] || ''; // This is the ISO date string
        const datasets = context.chart.config.data.datasets;
        const date = new Date(rawLabel);

        // Format tooltip header based on the cumulative view (This logic is correct and remains)
        let formattedDate: string;
        if (filters.cumulativeView === 'Yearly') {
            formattedDate = date.toLocaleDateString(undefined, { year: 'numeric' });
        } else if (filters.cumulativeView === 'Monthly') {
            formattedDate = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        } else { // Daily
            const day = date.getDate();
            formattedDate = `${day}${getOrdinalSuffix(day)} ${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
        }
        
        let totalSubmissions = 0, easy = 0, medium = 0, hard = 0;
        
        datasets.forEach(dataset => {
            const value = (dataset.data[dataIndex] as number) || 0;
            if (dataset.label === 'Total Submissions') totalSubmissions = value;
            if (dataset.label === 'Easy Solved') easy = value;
            if (dataset.label === 'Medium Solved') medium = value;
            if (dataset.label === 'Hard Solved') hard = value;
        });
        const totalProblems = easy + medium + hard;

        // Build tooltip HTML
        let innerHtml = `<div class="tooltip-header">${formattedDate}</div>`;
        innerHtml += `<div class="tooltip-subheader">Total Problems Solved: <span class="tooltip-subheader-value">${totalProblems}</span></div>`;
        innerHtml += `<div class="tooltip-subheader">Total Submissions: <span class="tooltip-subheader-value">${totalSubmissions}</span></div>`;
        innerHtml += `<div class="tooltip-divider"></div>`;
        innerHtml += `<ul class="tooltip-breakdown-list">`;
        const colors: { [key: string]: string } = { 'Easy': '#58b8b9', 'Medium': '#f4ba40', 'Hard': '#e24a41' };
        if (filters.difficulty === 'All' || filters.difficulty === 'Easy') innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${colors['Easy']};"></span> Easy</span><span class="tooltip-breakdown-value">${easy}</span></li>`;
        if (filters.difficulty === 'All' || filters.difficulty === 'Medium') innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${colors['Medium']};"></span> Medium</span><span class="tooltip-breakdown-value">${medium}</span></li>`;
        if (filters.difficulty === 'All' || filters.difficulty === 'Hard') innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${colors['Hard']};"></span> Hard</span><span class="tooltip-breakdown-value">${hard}</span></li>`;
        innerHtml += `</ul>`;
        tooltipEl.innerHTML = innerHtml;

        // Position tooltip
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
            x: { 
                grid: { display: false }, 
                ticks: { 
                    color: '#bdbeb3',
                    maxTicksLimit: 6,
                    // *** FIX: Format x-axis labels based on the TimeRange filter ***
                    callback: function(value, index, ticks) {
                        const label = this.getLabelForValue(value as number);
                        const date = new Date(label);
                        const range = filters.timeRange;
                        
                        // For short time ranges, show Month and Day
                        if (range === 'Last 30 Days' || range === 'Last 90 Days') {
                            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); // "Sep 17"
                        }

                        // For a year-long range, show Month and Year
                        if (range === 'Last 365 Days') {
                             return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }); // "Sep 2024"
                        }
                        
                        // For 'All Time', the format depends on the total span
                        if (range === 'All Time') {
                            const labels = this.chart.data.labels as string[];
                            if (labels && labels.length > 1) {
                                const firstDate = new Date(labels[0]);
                                const lastDate = new Date(labels[labels.length - 1]);
                                const yearDifference = lastDate.getFullYear() - firstDate.getFullYear();

                                // If data spans 2 or more years, just show the year
                                if (yearDifference >= 2) {
                                    return date.toLocaleDateString(undefined, { year: 'numeric' }); // "2024"
                                }
                            }
                            // Default for 'All Time' if span is less than 2 years is Month and Year
                            return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }); // "Sep 2024"
                        }

                        // A fallback format
                        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    }
                } 
            },
            y: { beginAtZero: true, grid: { display: false }, ticks: { color: '#bdbeb3' } },
        },
        plugins: {
            legend: { display: false },
            tooltip: { enabled: false, external: handleTooltip, mode: 'index', intersect: false },
        },
        interaction: { mode: 'index', intersect: false },
    };

    const config: ChartConfiguration<'line', number[], string> = {
        type: 'line',
        data: processedChartData,
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
