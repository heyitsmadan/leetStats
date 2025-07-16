import Chart from 'chart.js/auto';
import type { ChartData, ChartOptions, TooltipModel } from 'chart.js';

export type DoughnutChartInstance = Chart;

// Helper to create the tooltip element and styles
function getOrCreateTooltip(chart: Chart): HTMLElement {
    let tooltipEl = chart.canvas.parentNode?.querySelector('div.chart-tooltip') as HTMLElement;

    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.classList.add('chart-tooltip');
        const parent = chart.canvas.parentNode as HTMLElement;
        if (parent) {
            parent.style.position = 'relative';
            parent.appendChild(tooltipEl);
        }

        // Inject styles
        const style = document.createElement('style');
        style.textContent = `
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
            .tooltip-header { font-weight: 500; margin-bottom: 8px; color: #f9ffff; display: flex; align-items: center; gap: 8px; }
            .tooltip-subheader { margin-bottom: 12px; font-size: 12px; color: #bdbeb3; }
            .tooltip-subheader-value { font-weight: 500; color: #f9ffff; margin-left: 6px; }
            .tooltip-divider { border-top: 1px solid #353535; margin: 10px 0; }
            .tooltip-breakdown-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 5px; }
            .tooltip-breakdown-item { display: flex; align-items: center; justify-content: space-between; font-size: 12px; gap: 16px}
            .tooltip-breakdown-label { display: flex; align-items: center; gap: 8px; color: #bdbeb3; }
            .tooltip-breakdown-value { font-weight: 500; color: #f9ffff; }
            .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        `;
        document.head.appendChild(style);
    }
    return tooltipEl;
}


export function renderOrUpdateDoughnutChart(
    container: HTMLElement,
    data: any,
    filters: { difficulty: string },
    existingChart?: DoughnutChartInstance
): DoughnutChartInstance {
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Canvas element not found in the container.');

    const reversedLabels = data.labels.slice().reverse();
    const reversedData = data.datasets[0].data.slice().reverse();
    const reversedColors = data.datasets[0].backgroundColor.slice().reverse();
    const reversedTooltipsData = data.tooltipsData.slice().reverse();

    const chartData: ChartData<'doughnut'> = {
        labels: reversedLabels,
        datasets: [{
            data: reversedData,
            backgroundColor: reversedColors,
            borderColor: '#373737',
            borderWidth: 2,
            hoverBackgroundColor: reversedColors,
            hoverBorderColor: '#373737',
            hoverBorderWidth: 2,
        }],
    };

    const handleTooltip = (context: { chart: Chart, tooltip: TooltipModel<'doughnut'> }) => {
        const tooltipEl = getOrCreateTooltip(context.chart);
        const tooltipModel = context.tooltip;

        if (tooltipModel.opacity === 0) {
            tooltipEl.style.opacity = '0';
            tooltipEl.style.pointerEvents = 'none';
            return;
        }

        const dataIndex = tooltipModel.dataPoints[0]?.dataIndex;
        if (dataIndex === undefined) return;

        const tooltipData = reversedTooltipsData[dataIndex];
        const label = reversedLabels[dataIndex];
        const color = reversedColors[dataIndex]; // Get color for the dot

        // FIX: Add colored status dot to the header
        let innerHtml = `<div class="tooltip-header"><span class="status-dot" style="background-color: ${color};"></span><span>${label}</span></div>`;
        innerHtml += `<div class="tooltip-subheader">Count: <span class="tooltip-subheader-value">${tooltipData.count} (${tooltipData.percent})</span></div>`;

        if (filters.difficulty === 'All' && tooltipData.breakdown) {
            innerHtml += `<div class="tooltip-divider"></div>`;
            innerHtml += `<ul class="tooltip-breakdown-list">`;
            const breakdown = tooltipData.breakdown;
            const difficultyColors: { [key: string]: string } = { 'Easy': '#58b8b9', 'Medium': '#f4ba40', 'Hard': '#e24a41' };
            
            innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${difficultyColors['Easy']};"></span> Easy</span><span class="tooltip-breakdown-value">${breakdown.E || 0}</span></li>`;
            innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${difficultyColors['Medium']};"></span> Medium</span><span class="tooltip-breakdown-value">${breakdown.M || 0}</span></li>`;
            innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${difficultyColors['Hard']};"></span> Hard</span><span class="tooltip-breakdown-value">${breakdown.H || 0}</span></li>`;
            innerHtml += `</ul>`;
        }

        tooltipEl.innerHTML = innerHtml;

        const container = context.chart.canvas.parentNode as HTMLElement;
        let newLeft = tooltipModel.caretX + 10;
        let newTop = tooltipModel.caretY;

        if (newLeft + tooltipEl.offsetWidth > container.offsetWidth) {
            newLeft = tooltipModel.caretX - tooltipEl.offsetWidth - 10;
        }
        if (newTop + tooltipEl.offsetHeight > container.offsetHeight) {
            newTop = container.offsetHeight - tooltipEl.offsetHeight;
        }
        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;

        tooltipEl.style.opacity = '1';
        tooltipEl.style.pointerEvents = 'auto';
        tooltipEl.style.transform = `translate(${newLeft}px, ${newTop}px)`;
    };

    const options: ChartOptions<'doughnut'> = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            intersect: true,
            mode: 'point',
        },
        elements: {
            arc: {
                borderWidth: 2,
                hoverBorderWidth: 4, // Make hover more prominent
                hoverBorderColor: '#555',
            }
        },
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    color: 'rgba(255, 255, 255, 0.9)',
                    boxWidth: 15,
                    padding: 15,
                }
            },
            tooltip: {
                enabled: false,
                external: handleTooltip,
            },
        }
    };

    if (existingChart) {
        existingChart.data = chartData;
        existingChart.options = options as ChartOptions;
        existingChart.update();
        return existingChart;
    } else {
        return new Chart(canvas, {
            type: 'doughnut',
            data: chartData,
            options: options,
        });
    }
}
