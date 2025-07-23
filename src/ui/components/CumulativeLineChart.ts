import { Chart, ChartConfiguration, TooltipModel, ChartOptions } from 'chart.js';
import type { CumulativeChartStats, Difficulty, CumulativeView, TimeRange } from '../../types';
import { colors } from '../theme/colors'; // Import the centralized colors

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

// Helper to create the custom HTML tooltip element
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

        // Use colors from the theme file to style the tooltip
        const style = document.createElement('style');
        style.textContent = `
            .chart-tooltip {
                position: absolute; top: 0; left: 0; background: ${colors.background.section}; border: 2px solid ${colors.background.empty};
                border-radius: 8px; padding: 12px; font-size: 13px; color: ${colors.text.primary};
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); z-index: 1000; width: max-content;
                max-width: 300px; opacity: 0; pointer-events: none;
                transition: opacity 0.2s ease, transform 0.15s ease-out;
            }
            .tooltip-header { font-weight: 500; margin-bottom: 8px; color: ${colors.text.primary}; }
            .tooltip-subheader { margin-bottom: 4px; font-size: 12px; color: ${colors.text.subtle}; }
            .tooltip-subheader:last-of-type { margin-bottom: 12px; }
            .tooltip-subheader-value { font-weight: 500; color: ${colors.text.primary}; margin-left: 6px; }
            .tooltip-divider { border-top: 1px solid ${colors.background.secondarySection}; margin: 10px 0; }
            .tooltip-breakdown-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 5px; }
            .tooltip-breakdown-item { display: flex; align-items: center; justify-content: space-between; font-size: 12px; gap: 16px}
            .tooltip-breakdown-label { display: flex; align-items: center; gap: 8px; color: ${colors.text.subtle}; }
            .tooltip-breakdown-value { font-weight: 500; color: ${colors.text.primary}; }
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

        const rawLabel = tooltipModel.title?.[0] || '';
        const datasets = context.chart.config.data.datasets;
        const date = new Date(rawLabel);

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

        // Build tooltip HTML using colors from the theme file
        let innerHtml = `<div class="tooltip-header">${formattedDate}</div>`;
        innerHtml += `<div class="tooltip-subheader">Total Problems Solved: <span class="tooltip-subheader-value">${totalProblems}</span></div>`;
        innerHtml += `<div class="tooltip-subheader">Total Submissions: <span class="tooltip-subheader-value">${totalSubmissions}</span></div>`;
        innerHtml += `<div class="tooltip-divider"></div>`;
        innerHtml += `<ul class="tooltip-breakdown-list">`;
        if (filters.difficulty === 'All' || filters.difficulty === 'Easy') innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${colors.problems.easy};"></span> Easy</span><span class="tooltip-breakdown-value">${easy}</span></li>`;
        if (filters.difficulty === 'All' || filters.difficulty === 'Medium') innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${colors.problems.medium};"></span> Medium</span><span class="tooltip-breakdown-value">${medium}</span></li>`;
        if (filters.difficulty === 'All' || filters.difficulty === 'Hard') innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${colors.problems.hard};"></span> Hard</span><span class="tooltip-breakdown-value">${hard}</span></li>`;
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
            x: { 
                grid: { display: false }, 
                ticks: { 
                    color: colors.text.subtle, // Using color from theme
                    maxTicksLimit: 5,
                    // --- MODIFIED LOGIC ---
                    // This callback now formats the x-axis labels based on the aggregation level (cumulativeView)
                    // for a more intuitive and less confusing result.
                    callback: function(value, index, ticks) {
                        const label = this.getLabelForValue(value as number);
                        const date = new Date(label);
                        const view = filters.cumulativeView; // Use the aggregation view directly

                        // Format the label based on the selected aggregation level
                        switch (view) {
                            case 'Yearly':
                                // For a yearly view, the label should ONLY be the year.
                                return date.toLocaleDateString(undefined, { year: 'numeric' });
                            case 'Monthly':
                                // For a monthly view, show the short month and year.
                                return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
                            case 'Daily':
                            default:
                                // For a daily view, show the short month and day.
                                return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                        }
                    }
                } 
            },
            y: { 
                beginAtZero: true, 
                grid: { display: false }, 
                ticks: { color: colors.text.subtle, precision: 0 } // Using color from theme
            },
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