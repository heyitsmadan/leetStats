import Chart from 'chart.js/auto';
import type { ChartData, ChartOptions, TooltipModel, BarElement } from 'chart.js';
import { colors } from '../theme/colors'; // Import the centralized colors

export type HorizontalBarChartInstance = Chart;

// This color is not in the theme file, so it remains unchanged.
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

        // Inject styles using colors from the theme file
        const style = document.createElement('style');
        style.textContent = `
            .chart-tooltip {
                position: absolute;
                top: 0;
                left: 0;
                background: ${colors.background.section};
                border: 2px solid ${colors.background.empty};
                border-radius: 8px;
                padding: 12px;
                font-size: 13px;
                color: ${colors.text.primary};
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                z-index: 1000;
                width: max-content;
                max-width: 300px;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease, transform 0.15s ease-out;
            }
            .tooltip-header { font-weight: 500; margin-bottom: 8px; color: ${colors.text.primary}; }
            .tooltip-subheader { margin-bottom: 12px; font-size: 12px; color: ${colors.text.subtle}; }
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


export function renderOrUpdateHorizontalBarChart(
    container: HTMLElement,
    data: any,
    filters: { difficulty: string },
    existingChart?: HorizontalBarChartInstance
): HorizontalBarChartInstance {
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
        const breakdown = tooltipData.solvedBreakdown;

        let innerHtml = `<div class="tooltip-header">${tooltipData.label}</div>`;
        innerHtml += `<div class="tooltip-subheader">Acceptance Rate: <span class="tooltip-subheader-value">${tooltipData.rate}</span></div>`;
        
        if (filters.difficulty === 'All' && breakdown) {
            innerHtml += `<div class="tooltip-divider"></div>`;
            innerHtml += `<ul class="tooltip-breakdown-list">`;
            // Using colors from the theme file for the breakdown
            innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${colors.problems.easy};"></span> Easy</span><span class="tooltip-breakdown-value">${breakdown.E || 0}</span></li>`;
            innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${colors.problems.medium};"></span> Medium</span><span class="tooltip-breakdown-value">${breakdown.M || 0}</span></li>`;
            innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${colors.problems.hard};"></span> Hard</span><span class="tooltip-breakdown-value">${breakdown.H || 0}</span></li>`;
            innerHtml += `</ul>`;
        }

        innerHtml += `<div class="tooltip-divider"></div>`;
        innerHtml += `<ul class="tooltip-breakdown-list">`;
        innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label">First used</span><span class="tooltip-breakdown-value">${tooltipData.firstUsed}</span></li>`;
        innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label">Last used</span><span class="tooltip-breakdown-value">${tooltipData.lastUsed}</span></li>`;
        innerHtml += `</ul>`;

        tooltipEl.innerHTML = innerHtml;

        const activeElement = context.tooltip.dataPoints[0]?.element as BarElement;
        if (!activeElement) return;

        const totalValue = context.chart.data.datasets.reduce((sum, dataset) => {
            const value = dataset.data[dataIndex];
            return sum + (Number(value) || 0);
        }, 0);

        const barEndPixelPosition = context.chart.scales.x.getPixelForValue(totalValue);
        const chartContainer = context.chart.canvas.parentNode as HTMLElement;
        const desiredOffset = 15;
        const newLeft = barEndPixelPosition + desiredOffset;
        let newTop = activeElement.y - tooltipEl.offsetHeight / 2;

        if (newTop < 0) newTop = 0;
        if (newTop + tooltipEl.offsetHeight > chartContainer.offsetHeight) {
            newTop = chartContainer.offsetHeight - tooltipEl.offsetHeight;
        }

        tooltipEl.style.opacity = '1';
        tooltipEl.style.pointerEvents = 'none';
        tooltipEl.style.transform = `translate(${newLeft}px, ${newTop}px)`;
    };

    const options: ChartOptions<'bar'> = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            axis: 'y',
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
                ticks: { color: 'rgba(255, 255, 255, 0.7)' }, // This color is not in colors.ts
                grid: { display: false }
            },
            y: {
                stacked: true,
                ticks: { color: 'rgba(255, 255, 255, 0.7)' }, // This color is not in colors.ts
                grid: { display: false }
            },
        },
        elements: {
            bar: {
                borderRadius: 5,
                // @ts-ignore
                shadowOffsetX: 0,
                shadowOffsetY: 0,
                shadowBlur: (ctx: any) => (ctx.label === data.bestLang ? GLOW_BLUR : 0),
                shadowColor: (ctx: any) => (ctx.label === data.bestLang ? GLOW_COLOR : 'transparent'),
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