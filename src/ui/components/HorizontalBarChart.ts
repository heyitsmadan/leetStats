import Chart from 'chart.js/auto';
import type { ChartData, ChartOptions, TooltipModel, BarElement } from 'chart.js';
import { colors } from '../theme/colors'; // Assuming this path is correct

export type HorizontalBarChartInstance = Chart;

function getOrCreateTooltip(chart: Chart): HTMLElement {
    let tooltipEl = chart.canvas.parentNode?.querySelector('div.chart-tooltip') as HTMLElement;

    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.classList.add('chart-tooltip');
        const parent = chart.canvas.parentNode as HTMLElement;
        if (parent) {
            // The parent needs a position context for the absolute tooltip
            parent.style.position = 'relative';
            parent.appendChild(tooltipEl);
        }

        // Tooltip styles are injected once
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
                visibility: visible;
            }
            .tooltip-header { font-weight: 500; margin-bottom: 8px; color: ${colors.text.primary}; }
            .tooltip-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 12px; }
            .tooltip-label { color: ${colors.text.subtle}; }
            .tooltip-value { font-weight: 500; color: ${colors.text.primary}; }
            .tooltip-divider { border-top: 1px solid ${colors.background.secondarySection}; margin: 10px 0; }
            .tooltip-breakdown-header { font-size: 12px; color: ${colors.text.subtle}; margin-bottom: 8px; }
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

    // Disable the default hover color change to rely on the tooltip
    chartData.datasets.forEach(dataset => {
        dataset.hoverBackgroundColor = dataset.backgroundColor;
        dataset.hoverBorderColor = dataset.borderColor;
    });

    const handleTooltip = (context: { chart: Chart, tooltip: TooltipModel<'bar'> }) => {
        const tooltipEl = getOrCreateTooltip(context.chart);
        const tooltipModel = context.tooltip;

        // Hide the tooltip if the mouse is not over an element
        if (tooltipModel.opacity === 0) {
            tooltipEl.style.opacity = '0';
            return;
        }

        const dataIndex = tooltipModel.dataPoints[0]?.dataIndex;
        if (dataIndex === undefined) return;

        // --- Populate Tooltip Content ---
        const tooltipData = data.tooltipsData[dataIndex];
        const breakdown = tooltipData.solvedBreakdown;

        let innerHtml = `<div class="tooltip-header">${tooltipData.label}</div>`;
        innerHtml += `<div class="tooltip-row"><span class="tooltip-label">Total Submissions</span><span class="tooltip-value">${tooltipData.totalSubmissions}</span></div>`;
        innerHtml += `<div class="tooltip-row"><span class="tooltip-label">Acceptance Rate</span><span class="tooltip-value">${tooltipData.acceptanceRate}</span></div>`;
        
        if (filters.difficulty === 'All' && breakdown) {
            innerHtml += `<div class="tooltip-divider"></div>`;
            innerHtml += `<div class="tooltip-breakdown-header">Problems Solved</div>`;
            innerHtml += `<ul class="tooltip-breakdown-list">`;
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

        // --- POSITIONING LOGIC ---
        const activeElement = context.tooltip.dataPoints[0]?.element as BarElement;
        if (!activeElement) return;

        // To get accurate dimensions, the tooltip must be rendered. We make it briefly
        // invisible while we measure it to prevent a flicker.
        const wasHidden = tooltipEl.style.opacity !== '1';
        if (wasHidden) {
            tooltipEl.style.visibility = 'hidden';
            tooltipEl.style.opacity = '1';
        }
        const tooltipWidth = tooltipEl.offsetWidth;
        const tooltipHeight = tooltipEl.offsetHeight;
        if (wasHidden) {
            tooltipEl.style.visibility = 'visible';
            tooltipEl.style.opacity = '0';
        }

        const chartContainer = context.chart.canvas.parentNode as HTMLElement;
        const containerRect = chartContainer.getBoundingClientRect();
        const desiredOffset = 15; // Space between bar and tooltip in pixels

        let newLeft: number;
        let newTop: number;

        // --- Fallback Strategy: Right -> Above -> Below ---

        // 1. Calculate potential positions
        const totalValue = context.chart.data.datasets.reduce((sum, dataset) => sum + (Number(dataset.data[dataIndex]) || 0), 0);
        const barEndPixelPosition = context.chart.scales.x.getPixelForValue(totalValue);
        const barStartPixelPosition = context.chart.scales.x.getPixelForValue(0);

        const posRight = {
            left: barEndPixelPosition + desiredOffset,
            top: activeElement.y - tooltipHeight / 2
        };

        const posBelow = {
            left: barStartPixelPosition + (barEndPixelPosition - barStartPixelPosition) / 2 - tooltipWidth / 2,
            top: activeElement.y + (activeElement as any).height / 2 + desiredOffset
        };

        const posAbove = {
            left: posBelow.left, // Same horizontal centering
            top: activeElement.y - (activeElement as any).height / 2 - tooltipHeight - desiredOffset
        };

        // 2. Decide which position to use
        // Default to the 'right' position
        newLeft = posRight.left;
        newTop = posRight.top;

        // Check if 'right' overflows the viewport
        if (containerRect.left + newLeft + tooltipWidth > window.innerWidth) {
            // It overflows. Try 'above'.
            newLeft = posAbove.left;
            newTop = posAbove.top;

            // Check if 'above' also overflows the viewport (top)
            if (containerRect.top + newTop < 0) {
                // It overflows. Use 'below' as the final fallback.
                newLeft = posBelow.left;
                newTop = posBelow.top;
            }
        }

        // 3. Final boundary clamping to ensure it's always visible
        // Clamp horizontal position
        if (containerRect.left + newLeft < 0) {
            newLeft = -containerRect.left;
        } else if (containerRect.left + newLeft + tooltipWidth > window.innerWidth) {
            newLeft = window.innerWidth - tooltipWidth - containerRect.left;
        }

        // Clamp vertical position
        if (containerRect.top + newTop < 0) {
            newTop = -containerRect.top;
        } else if (containerRect.top + newTop + tooltipHeight > window.innerHeight) {
            newTop = window.innerHeight - tooltipHeight - containerRect.top;
        }
        
        // Apply the final position and make the tooltip visible.
        tooltipEl.style.opacity = '1';
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
                enabled: false, // Disable native tooltip
                external: handleTooltip, // Use our custom one
            },
        },
        scales: {
            x: {
                stacked: true,
                ticks: { color: colors.text.subtle, precision: 0 },
                grid: { display: false }
            },
            y: {
                stacked: true,
                ticks: { color: colors.text.subtle },
                grid: { display: false }
            },
        },
        elements: {
            bar: {
                borderRadius: 5,
            }
        }
    };

    if (existingChart) {
        existingChart.data = chartData;
        // It's important to cast to ChartOptions to avoid type conflicts
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