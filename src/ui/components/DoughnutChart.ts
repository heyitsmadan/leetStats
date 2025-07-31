import Chart from 'chart.js/auto';
import type { ChartData, ChartOptions, TooltipModel } from 'chart.js';
import { colors } from '../theme/colors';

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
        display: flex; 
        align-items: center; 
        gap: 8px; 
      }
      .tooltip-subheader { 
        margin-bottom: 12px; 
        font-size: 12px; 
        color: ${colors.text.subtle}; 
      }
      .tooltip-subheader-value { 
        font-weight: 500; 
        color: ${colors.text.primary}; 
        margin-left: 6px; 
      }
      .tooltip-divider { 
        border-top: 1px solid ${colors.background.secondarySection}; 
        margin: 10px 0; 
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
        flex-shrink: 0; 
      }
    `;
    document.head.appendChild(style);
  }
  return tooltipEl;
}

export function renderOrUpdateDoughnutChart(
  container: HTMLElement,
  data: any,
  filters: { difficulty: string },
  existingChart?: DoughnutChartInstance,
  config: {
    isInteractive?: boolean;
    legendConfig?: {
      display: boolean;
      position: 'right' | 'bottom';
      fontSize?: number;
    };
    cutout?: string;
    layout?: {
      padding?: number | { top?: number, right?: number, bottom?: number, left?: number };
    };
  } = { isInteractive: true }
): DoughnutChartInstance {
  const canvas = container.querySelector('canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element not found in the container.');
  }

  const reversedLabels = data.labels.slice().reverse();
  const reversedData = data.datasets[0].data.slice().reverse();
  const reversedColors = data.datasets[0].backgroundColor.slice().reverse();
  const reversedTooltipsData = data.tooltipsData.slice().reverse();

  const chartData: ChartData<'doughnut'> = {
    labels: reversedLabels,
    datasets: [{
      data: reversedData,
      backgroundColor: reversedColors,
      borderColor: data.datasets[0].borderColor,
      borderWidth: 2,
      hoverBackgroundColor: reversedColors,
      hoverBorderColor: colors.background.section,
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
    if (dataIndex === undefined) {
      return;
    }

    const tooltipData = reversedTooltipsData[dataIndex];
    const label = reversedLabels[dataIndex];
    const color = reversedColors[dataIndex];

    // Clear previous tooltip content safely
    while (tooltipEl.firstChild) {
        tooltipEl.removeChild(tooltipEl.firstChild);
    }

    // Create elements programmatically to avoid innerHTML
    const createText = (text: string) => document.createTextNode(text);

    // Header
    const header = document.createElement('div');
    header.className = 'tooltip-header';
    const dot = document.createElement('span');
    dot.className = 'status-dot';
    dot.style.backgroundColor = color;
    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    header.appendChild(dot);
    header.appendChild(labelSpan);
    tooltipEl.appendChild(header);

    // Subheader
    const subheader = document.createElement('div');
    subheader.className = 'tooltip-subheader';
    subheader.appendChild(createText('Count: '));
    const valueSpan = document.createElement('span');
    valueSpan.className = 'tooltip-subheader-value';
    valueSpan.textContent = `${tooltipData.count} (${tooltipData.percent})`;
    subheader.appendChild(valueSpan);
    tooltipEl.appendChild(subheader);

    // Breakdown section
    if (filters.difficulty === 'All' && tooltipData.breakdown) {
        const divider = document.createElement('div');
        divider.className = 'tooltip-divider';
        tooltipEl.appendChild(divider);

        const list = document.createElement('ul');
        list.className = 'tooltip-breakdown-list';

        const createBreakdownItem = (difficultyLabel: string, value: number, difficultyColor: string) => {
            const item = document.createElement('li');
            item.className = 'tooltip-breakdown-item';

            const breakdownLabel = document.createElement('span');
            breakdownLabel.className = 'tooltip-breakdown-label';
            const breakdownDot = document.createElement('span');
            breakdownDot.className = 'status-dot';
            breakdownDot.style.backgroundColor = difficultyColor;
            breakdownLabel.appendChild(breakdownDot);
            breakdownLabel.appendChild(createText(` ${difficultyLabel}`));

            const breakdownValue = document.createElement('span');
            breakdownValue.className = 'tooltip-breakdown-value';
            breakdownValue.textContent = String(value);

            item.appendChild(breakdownLabel);
            item.appendChild(breakdownValue);
            return item;
        };
        
        const breakdown = tooltipData.breakdown;
        list.appendChild(createBreakdownItem('Easy', breakdown.E || 0, colors.problems.easy));
        list.appendChild(createBreakdownItem('Medium', breakdown.M || 0, colors.problems.medium));
        list.appendChild(createBreakdownItem('Hard', breakdown.H || 0, colors.problems.hard));
        tooltipEl.appendChild(list);
    }

    const chartContainer = context.chart.canvas.parentNode as HTMLElement;
    let newLeft = tooltipModel.caretX + 10;
    let newTop = tooltipModel.caretY;

    if (newLeft + tooltipEl.offsetWidth > chartContainer.offsetWidth) {
      newLeft = tooltipModel.caretX - tooltipEl.offsetWidth - 10;
    }
    if (newTop + tooltipEl.offsetHeight > chartContainer.offsetHeight) {
      newTop = chartContainer.offsetHeight - tooltipEl.offsetHeight;
    }
    if (newLeft < 0) {
      newLeft = 0;
    }
    if (newTop < 0) {
      newTop = 0;
    }

    tooltipEl.style.opacity = '1';
    tooltipEl.style.pointerEvents = 'none';
    tooltipEl.style.transform = `translate(${newLeft}px, ${newTop}px)`;
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: config.cutout || '60%',
    layout: {
      padding: config.layout?.padding ?? 0
    },
    animation: {
      duration: config.isInteractive ? 1000 : 0
    },
    events: config.isInteractive ? ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'] : [],
    plugins: {
      legend: {
        display: config.legendConfig ? config.legendConfig.display : config.isInteractive,
        position: config.legendConfig ? config.legendConfig.position : 'right',
        reverse: true,
        labels: {
          color: colors.text.subtle,
          boxWidth: config.legendConfig?.position === 'bottom' ? 10 : 15,
          padding: 10,
          font: {
            size: config.legendConfig?.fontSize || 11,
          }
        },
        align: 'center',
      },
      tooltip: {
        enabled: false,
        external: config.isInteractive ? handleTooltip : undefined,
      },
    },
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