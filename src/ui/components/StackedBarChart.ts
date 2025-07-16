import Chart from 'chart.js/auto';
import type { ChartData, ChartOptions, TooltipModel, BarElement } from 'chart.js';

export type CodingClockChartInstance = Chart;

const GLOW_COLOR = 'rgba(255, 255, 0, 0.7)';
const GLOW_BLUR = 15;

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
            .tooltip-header { font-weight: 500; margin-bottom: 8px; color: #f9ffff; }
            .tooltip-breakdown-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 5px; }
            .tooltip-breakdown-item { display: flex; align-items: center; justify-content: space-between; font-size: 12px; gap: 16px}
            .tooltip-breakdown-label { color: #bdbeb3; }
            .tooltip-breakdown-value { font-weight: 500; color: #f9ffff; }
        `;
        document.head.appendChild(style);
    }
    return tooltipEl;
}

export function renderOrUpdateStackedBarChart(
    container: HTMLElement,
    data: any,
    existingChart?: CodingClockChartInstance
): CodingClockChartInstance {
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Canvas element not found in the container.');

    const chartData: ChartData<'bar'> = {
        labels: data.labels,
        datasets: data.datasets,
    };

    const handleTooltip = (context: { chart: Chart, tooltip: TooltipModel<'bar'> }) => {
        const tooltipEl = getOrCreateTooltip(context.chart);
        const tooltipModel = context.tooltip;

        if (tooltipModel.opacity === 0) {
            tooltipEl.style.opacity = '0';
            tooltipEl.style.pointerEvents = 'none';
            return;
        }

        const dataIndex = tooltipModel.dataPoints[0]?.dataIndex;
        if (dataIndex === undefined) return;

        const tooltipData = data.tooltipsData[dataIndex];

        let innerHtml = `<div class="tooltip-header">${tooltipData.label}</div>`;
        innerHtml += `<ul class="tooltip-breakdown-list">`;
        innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label">Submissions</span><span class="tooltip-breakdown-value">${tooltipData.total}</span></li>`;
        innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label">Accepted</span><span class="tooltip-breakdown-value">${tooltipData.accepted}</span></li>`;
        innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label">Acceptance Rate</span><span class="tooltip-breakdown-value">${tooltipData.rate}</span></li>`;
        innerHtml += `</ul>`;

        tooltipEl.innerHTML = innerHtml;

        const activeElement = context.tooltip.dataPoints[0]?.element as BarElement & { width: number, x: number };
        if (!activeElement) return;

        const container = context.chart.canvas.parentNode as HTMLElement;
        const barRightEdgeX = activeElement.x + (activeElement.width / 2);
        const barLeftEdgeX = activeElement.x - (activeElement.width / 2);
        const desiredOffset = 10;
        
        let newLeft = barRightEdgeX + desiredOffset;
        if (newLeft + tooltipEl.offsetWidth > container.offsetWidth) {
            newLeft = barLeftEdgeX - tooltipEl.offsetWidth - desiredOffset;
        }

        let newTop = tooltipModel.caretY - tooltipEl.offsetHeight / 2;
        if (newTop < 0) newTop = 0;
        if (newTop + tooltipEl.offsetHeight > container.offsetHeight) {
            newTop = container.offsetHeight - tooltipEl.offsetHeight;
        }

        tooltipEl.style.opacity = '1';
        tooltipEl.style.pointerEvents = 'auto';
        tooltipEl.style.transform = `translate(${newLeft}px, ${newTop}px)`;
    };

    const options: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        // FIX: Make tooltip easier to trigger on small bars
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: false,
                external: handleTooltip,
            },
        },
        scales: {
            x: {
                stacked: true,
                ticks: { color: '#bdbeb3' },
                grid: { display: false }
            },
            y: {
                stacked: true,
                ticks: { color: '#bdbeb3' },
                grid: { display: false }
            },
        },
        elements: {
            bar: {
                borderRadius: 5,
                // @ts-ignore
                shadowOffsetX: 0,
                shadowOffsetY: 0,
                shadowBlur: (ctx: any) => (ctx.dataIndex === data.bestIndex ? GLOW_BLUR : 0),
                shadowColor: (ctx: any) => (ctx.dataIndex === data.bestIndex ? GLOW_COLOR : 'transparent'),
            }
        }
    };

    if (existingChart) {
        existingChart.data = chartData;
        existingChart.options = options as ChartOptions;
        existingChart.update();
        return existingChart;
    } else {
        return new Chart(canvas, {
            type: 'bar',
            data: chartData,
            options: options,
        });
    }
}
