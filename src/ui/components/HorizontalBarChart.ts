import Chart from 'chart.js/auto';
import type { ChartData, ChartOptions, TooltipModel, BarElement } from 'chart.js';
import { colors } from '../theme/colors';

export type HorizontalBarChartInstance = Chart;

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
            .tooltip-header { 
                font-weight: 500; 
                margin-bottom: 8px; 
                color: ${colors.text.primary}; 
            }
            .tooltip-row { 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                margin-bottom: 6px; 
                font-size: 12px; 
            }
            .tooltip-label { 
                color: ${colors.text.subtle}; 
            }
            .tooltip-value { 
                font-weight: 500; 
                color: ${colors.text.primary}; 
            }
            .tooltip-divider { 
                border-top: 1px solid ${colors.background.secondarySection}; 
                margin: 10px 0; 
            }
            .tooltip-breakdown-header { 
                font-size: 12px; 
                color: ${colors.text.subtle}; 
                margin-bottom: 8px; 
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
                gap: 16px
            }
            .tooltip-breakdown-label { 
                display: flex; 
                align-items: center; 
                gap: 8px; 
                color: ${colors.text.subtle}; 
            }
            .tooltip-breakdown-value { 
                font-weight: 500; 
                color: ${colors.text.primary}; 
            }
            .status-dot { 
                display: inline-block; 
                width: 8px; 
                height: 8px; 
                border-radius: 50%; 
            }
        `;
        document.head.appendChild(style);
    }
    return tooltipEl;
}


export function renderOrUpdateHorizontalBarChart(
    container: HTMLElement,
    data: any,
    filters: { difficulty: string },
    existingChart?: HorizontalBarChartInstance,
    config: { isInteractive?: boolean } = { isInteractive: true }
): HorizontalBarChartInstance {
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) {
        throw new Error('Canvas element not found in the container.');
    }

    const chartData: ChartData<'bar'> = {
        labels: data.labels,
        datasets: data.datasets,
    };

    chartData.datasets.forEach((dataset: any) => {
        dataset.hoverBackgroundColor = dataset.backgroundColor;
        dataset.hoverBorderColor = dataset.borderColor;
    });

    const handleTooltip = (context: { chart: Chart, tooltip: TooltipModel<'bar'> }) => {
        const tooltipEl = getOrCreateTooltip(context.chart);
        const tooltipModel = context.tooltip;

        if (tooltipModel.opacity === 0) {
            tooltipEl.style.opacity = '0';
            return;
        }

        const dataIndex = tooltipModel.dataPoints[0]?.dataIndex;
        if (dataIndex === undefined) {
            return;
        }

        const tooltipData = data.tooltipsData[dataIndex];
        const breakdown = tooltipData.solvedBreakdown;

        // Clear previous tooltip content safely
        while (tooltipEl.firstChild) {
            tooltipEl.removeChild(tooltipEl.firstChild);
        }

        const createText = (text: string) => document.createTextNode(text);

        // Header
        const header = document.createElement('div');
        header.className = 'tooltip-header';
        header.textContent = tooltipData.label;
        tooltipEl.appendChild(header);

        // Main info rows
        const createRow = (label: string, value: string | number) => {
            const row = document.createElement('div');
            row.className = 'tooltip-row';
            const labelSpan = document.createElement('span');
            labelSpan.className = 'tooltip-label';
            labelSpan.textContent = label;
            const valueSpan = document.createElement('span');
            valueSpan.className = 'tooltip-value';
            valueSpan.textContent = String(value);
            row.appendChild(labelSpan);
            row.appendChild(valueSpan);
            return row;
        };
        tooltipEl.appendChild(createRow('Total Submissions', tooltipData.totalSubmissions));
        tooltipEl.appendChild(createRow('Acceptance Rate', tooltipData.acceptanceRate));

        // Helper for breakdown lists
        const createBreakdownItem = (label: string, value: string | number, color?: string) => {
            const item = document.createElement('li');
            item.className = 'tooltip-breakdown-item';
            const labelSpan = document.createElement('span');
            labelSpan.className = 'tooltip-breakdown-label';
            if (color) {
                const dot = document.createElement('span');
                dot.className = 'status-dot';
                dot.style.backgroundColor = color;
                labelSpan.appendChild(dot);
                labelSpan.appendChild(createText(` ${label}`));
            } else {
                labelSpan.textContent = label;
            }
            const valueSpan = document.createElement('span');
            valueSpan.className = 'tooltip-breakdown-value';
            valueSpan.textContent = String(value);
            item.appendChild(labelSpan);
            item.appendChild(valueSpan);
            return item;
        };

        const createDivider = () => {
            const divider = document.createElement('div');
            divider.className = 'tooltip-divider';
            return divider;
        };

        // Problems solved breakdown
        if (filters.difficulty === 'All' && breakdown) {
            tooltipEl.appendChild(createDivider());
            const breakdownHeader = document.createElement('div');
            breakdownHeader.className = 'tooltip-breakdown-header';
            breakdownHeader.textContent = 'Problems Solved';
            tooltipEl.appendChild(breakdownHeader);
            const list = document.createElement('ul');
            list.className = 'tooltip-breakdown-list';
            list.appendChild(createBreakdownItem('Easy', breakdown.E || 0, colors.problems.easy));
            list.appendChild(createBreakdownItem('Medium', breakdown.M || 0, colors.problems.medium));
            list.appendChild(createBreakdownItem('Hard', breakdown.H || 0, colors.problems.hard));
            tooltipEl.appendChild(list);
        }

        // Usage dates
        tooltipEl.appendChild(createDivider());
        const usageList = document.createElement('ul');
        usageList.className = 'tooltip-breakdown-list';
        usageList.appendChild(createBreakdownItem('First used', tooltipData.firstUsed));
        usageList.appendChild(createBreakdownItem('Last used', tooltipData.lastUsed));
        tooltipEl.appendChild(usageList);

        const activeElement = context.tooltip.dataPoints[0]?.element as BarElement;
        if (!activeElement) {
            return;
        }

        const tooltipWidth = tooltipEl.offsetWidth;
        const tooltipHeight = tooltipEl.offsetHeight;
        const chartContainer = context.chart.canvas.parentNode as HTMLElement;
        const desiredOffset = 15;

        const totalValue = context.chart.data.datasets.reduce((sum, dataset) => sum + (Number(dataset.data[dataIndex]) || 0), 0);
        const barEndPixelPosition = context.chart.scales.x.getPixelForValue(totalValue);

        let newLeft = barEndPixelPosition + desiredOffset;
        let newTop = activeElement.y - tooltipHeight / 2;

        if (newLeft + tooltipWidth > chartContainer.offsetWidth) {
            const barStartPixelPosition = context.chart.scales.x.getPixelForValue(0);
            const posBelow = {
                left: barStartPixelPosition + (barEndPixelPosition - barStartPixelPosition) / 2 - tooltipWidth / 2,
                top: activeElement.y + (activeElement as any).height / 2 + desiredOffset
            };
            const posAbove = {
                left: posBelow.left,
                top: activeElement.y - (activeElement as any).height / 2 - tooltipHeight - desiredOffset
            };

            newLeft = posAbove.left;
            newTop = posAbove.top;

            if (newTop < 0) {
                newLeft = posBelow.left;
                newTop = posBelow.top;
            }
        }

        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;
        if (newLeft + tooltipWidth > chartContainer.offsetWidth) newLeft = chartContainer.offsetWidth - tooltipWidth;
        if (newTop + tooltipHeight > chartContainer.offsetHeight) newTop = chartContainer.offsetHeight - tooltipHeight;


        tooltipEl.style.opacity = '1';
        tooltipEl.style.transform = `translate(${newLeft}px, ${newTop}px)`;
    };

    const options: ChartOptions<'bar'> = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: config.isInteractive ? 1000 : 0
        },
        events: config.isInteractive ? ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'] : [],
        interaction: {
            mode: 'index',
            axis: 'y',
            intersect: false,
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: false,
                external: config.isInteractive ? handleTooltip : undefined,
            },
        },
        scales: {
            x: {
                stacked: true,
                ticks: {
                    color: colors.text.subtle,
                    precision: 0,
                    font: {
                        size: config.isInteractive ? 12 : 16
                    },
                    maxTicksLimit: config.isInteractive ? undefined : 5
                },
                grid: { display: false }
            },
            y: {
                stacked: true,
                ticks: { color: colors.text.subtle, font: { size: 12 } },
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