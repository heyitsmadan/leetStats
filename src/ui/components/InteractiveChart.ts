import * as d3 from 'd3';
import { Chart, registerables } from 'chart.js';
import type { 
  InteractiveChartData, 
  BrushChartData, 
  InteractiveChartFilters,
  TooltipData,
  ProcessedData 
} from '../../types';
import { getInteractiveChartStats, getBrushChartData, getTooltipData } from '../../analysis/stats/getInteractiveChartStats';

Chart.register(...registerables);

export interface InteractiveChartInstance {
  updateData: (data: ProcessedData) => void;
  updateFilters: (filters: Partial<InteractiveChartFilters>) => void;
  destroy: () => void;
}

export function renderOrUpdateInteractiveChart(
  container: HTMLElement,
  processedData: ProcessedData,
  initialFilters: InteractiveChartFilters,
  existingInstance?: InteractiveChartInstance
): InteractiveChartInstance {

  if (existingInstance) {
    existingInstance.destroy();
  }

  // Create the HTML structure
  container.innerHTML = `
    <div class="interactive-chart-container">
      <!-- Global Toggles -->
<div class="flex justify-between items-center mb-4">
  <!-- Primary Toggle (Left) -->
  <div id="primary-view-toggle" class="flex text-xs bg-layer-2 dark:bg-dark-layer-2 p-1 rounded-md text-label-2 dark:text-dark-label-2">
    <button id="primary-submissions" data-view="Submissions" class="px-2 py-0.5 rounded-md bg-fill-3 dark:bg-dark-fill-3">
      Submissions
    </button>
    <button id="primary-problems" data-view="Problems Solved" class="px-2 py-0.5 rounded-md">
      Problems Solved
    </button>
  </div>
  
  <!-- Secondary Toggle (Right) -->
  <div id="secondary-view-toggle" class="flex text-xs bg-layer-2 dark:bg-dark-layer-2 p-1 rounded-md text-label-2 dark:text-dark-label-2">
    <button id="secondary-difficulty" data-view="Difficulty" class="px-2 py-0.5 rounded-md bg-fill-3 dark:bg-dark-fill-3">
      Difficulty
    </button>
    <button id="secondary-language" data-view="Language" class="px-2 py-0.5 rounded-md">
      Language
    </button>
    <button id="secondary-status" data-view="Status" class="px-2 py-0.5 rounded-md">
      Status
    </button>
  </div>
</div>


      <!-- Main Chart -->
      <div class="main-chart-container mb-4" style="height: 400px;">
        <canvas id="main-chart"></canvas>
      </div>

      <!-- Navigator -->
      <div class="navigator-container" style="height: 80px; width: 100%; min-width: 300px;">
        <svg id="brush-chart" width="100%" height="100%"></svg>
      </div>

      <!-- Tooltip -->
      <div id="chart-tooltip" class="chart-tooltip"></div>
    </div>
    <style>
    // Add these styles to your existing style.textContent:
.navigator-container {
  width: 100%;
  min-width: 300px;
  height: 80px;
  overflow: visible;
}

#brush-chart {
  width: 100%;
  height: 80px;
  display: block;
}

.main-chart-container {
  width: 100%;
  min-width: 300px;
  height: 400px;
}

    </style>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
  .interactive-chart-container {
  font-family: inherit;
}

/* Remove the old toggle button styles and replace with these */
#primary-view-toggle button,
#secondary-view-toggle button {
  transition: all 0.2s ease;
  font-weight: 500;
}

#primary-view-toggle button.active,
#secondary-view-toggle button.active {
  background: var(--fill-3, #e5e5e5);
  color: var(--label-1, #333);
}

#primary-view-toggle button:not(.active),
#secondary-view-toggle button:not(.active) {
  background: transparent;
  color: var(--label-2, #666);
}

#primary-view-toggle button:hover:not(.active),
#secondary-view-toggle button:hover:not(.active) {
  background: var(--fill-2, #f0f0f0);
}

/* Keep your existing tooltip and other styles */
.chart-tooltip {
  position: absolute;
  background: var(--layer-1, white);
  border: 1px solid var(--divider-3, #ddd);
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  color: var(--label-1, #333);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  pointer-events: none;
  z-index: 1000;
  display: none;
  max-width: 300px;
}

/* ... rest of your existing styles ... */

    .interactive-chart-container {
      font-family: inherit;
    }

    .primary-toggle-btn {
      background: var(--layer-2, #f5f5f5);
      color: var(--label-2, #666);
      border: 1px solid var(--divider-3, #ddd);
    }

    .primary-toggle-btn.active {
      background: var(--fill-3, #e5e5e5);
      color: var(--label-1, #333);
    }

    .secondary-toggle-btn {
      background: var(--layer-2, #f5f5f5);
      color: var(--label-2, #666);
      border: 1px solid var(--divider-3, #ddd);
    }

    .secondary-toggle-btn.active {
      background: var(--fill-3, #e5e5e5);
      color: var(--label-1, #333);
    }

    .chart-tooltip {
      position: absolute;
      background: var(--layer-1, white);
      border: 1px solid var(--divider-3, #ddd);
      border-radius: 8px;
      padding: 12px;
      font-size: 14px;
      color: var(--label-1, #333);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      pointer-events: none;
      z-index: 1000;
      display: none;
      max-width: 300px;
    }

    .brush .overlay {
      fill: none;
      pointer-events: all;
    }

    .brush .selection {
      fill: rgba(69, 183, 209, 0.3);
      stroke: #45b7d1;
      stroke-width: 2;
    }

    .brush .handle {
      fill: #45b7d1;
      stroke: #45b7d1;
      stroke-width: 2;
    }

    .navigator-area {
      fill: rgba(69, 183, 209, 0.2);
      stroke: #45b7d1;
      stroke-width: 1;
    }
  `;
  document.head.appendChild(style);

  // Initialize state
  let currentFilters: InteractiveChartFilters = { ...initialFilters };
  let mainChart: Chart | null = null;
  let brushChart: any = null;
  let brushData: BrushChartData | null = null;

// Initialize charts after DOM is ready
  setTimeout(() => {
    initializeMainChart();
    initializeBrushChart();
    setupEventListeners();
  }, 100); // Small delay to ensure DOM is rendered

  function initializeMainChart() {
    const canvas = container.querySelector('#main-chart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const chartData = getInteractiveChartStats(processedData, currentFilters);
    if (!chartData) return;

    mainChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartData.labels,
        datasets: chartData.datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index' as const,
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top' as const,
          },
          tooltip: {
            enabled: false, // We'll use custom tooltip
            external: handleTooltip
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: {
              display: false
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          }
        },
        animation: {
          duration: 750,
          easing: 'easeInOutQuart'
        }
      }
    });
  }

 function initializeBrushChart() {
  brushData = getBrushChartData(processedData);
  if (!brushData) return;

  const svg = d3.select(container.querySelector('#brush-chart'));
  const margin = { top: 10, right: 30, bottom: 30, left: 30 };
  
  // Fix: Get the actual container width and ensure it's valid
  const containerWidth = container.offsetWidth || 800; // fallback width
  const width = Math.max(containerWidth - margin.left - margin.right, 200); // minimum width
  const height = 80 - margin.top - margin.bottom;

  // Fix: Clear and set proper SVG dimensions
  svg.selectAll("*").remove();
  svg.attr("width", containerWidth).attr("height", 80);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Scales
  const xScale = d3.scaleTime()
    .domain(d3.extent(brushData.labels, d => new Date(d)) as [Date, Date])
    .range([0, width]);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(brushData.data) || 0])
    .range([height, 0]);

  // Area generator
  const area = d3.area<any>()
    .x((d, i) => xScale(new Date(brushData!.labels[i])))
    .y0(height)
    .y1((d, i) => yScale(brushData!.data[i]))
    .curve(d3.curveCardinal);

  // Add area
  g.append("path")
    .datum(brushData.data)
    .attr("class", "navigator-area")
    .attr("d", area);

  // Add brush
  const brush = d3.brushX()
    .extent([[0, 0], [width, height]])
    .on("brush end", handleBrush);

  const brushG = g.append("g")
    .attr("class", "brush");

  brush(brushG);

  // Fix: Set initial brush selection to entire width (wait a moment for DOM to update)
  setTimeout(() => {
    brushG.call(brush.move, [0, width]);
  }, 0);

  // Add x-axis
  const xAxis = d3.axisBottom(xScale)
    .tickFormat((domainValue: Date | d3.NumberValue) => {
      const date = domainValue instanceof Date ? domainValue : new Date(domainValue.valueOf());
      return d3.timeFormat("'%y")(date);
    })
    .ticks(d3.timeYear.every(1));

  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis);

  function handleBrush(event: any) {
    const selection = event.selection;
    if (!selection || !brushData) return;

    const [x0, x1] = selection;
    const startDate = xScale.invert(x0);
    const endDate = xScale.invert(x1);

    currentFilters.brushWindow = [startDate, endDate];
    updateMainChart();
  }
}


  function updateMainChart() {
  if (!mainChart) return;

  const chartData = getInteractiveChartStats(processedData, currentFilters);
  if (!chartData) return;

  // Update the chart data
  mainChart.data.labels = chartData.labels;
  mainChart.data.datasets = chartData.datasets;

  // Update the chart title based on the current mode
  if (mainChart.options.plugins?.title) {
    mainChart.options.plugins.title.text = `${currentFilters.primaryView} by ${currentFilters.secondaryView}`;
  }

  mainChart.update('active');
}


  function setupEventListeners() {
  // Primary toggle listeners
  const primaryButtons = container.querySelectorAll('#primary-view-toggle button');
  primaryButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const newView = target.dataset.view as 'Submissions' | 'Problems Solved';
      
      if (newView === currentFilters.primaryView) return;

      // Update active states
      primaryButtons.forEach(b => b.classList.remove('active'));
      target.classList.add('active');

      // Update filters and chart
      currentFilters.primaryView = newView;
      updateMainChart();
    });
  });

  // Secondary toggle listeners
  const secondaryButtons = container.querySelectorAll('#secondary-view-toggle button');
  secondaryButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const newView = target.dataset.view as 'Difficulty' | 'Language' | 'Status';
      
      if (newView === currentFilters.secondaryView) return;

      // Update active states
      secondaryButtons.forEach(b => b.classList.remove('active'));
      target.classList.add('active');

      // Update filters and chart
      currentFilters.secondaryView = newView;
      updateMainChart();
    });
  });
}


  function handleTooltip(context: any) {
    const tooltip = container.querySelector('#chart-tooltip') as HTMLElement;
    if (!tooltip) return;

    if (context.opacity === 0) {
      tooltip.style.display = 'none';
      return;
    }

    const dataIndex = context.dataPoints[0]?.dataIndex;
    if (dataIndex === undefined) return;

    const chartData = getInteractiveChartStats(processedData, currentFilters);
    if (!chartData) return;

    const label = chartData.labels[dataIndex];
    const tooltipData = getTooltipData(processedData, label, currentFilters);
    if (!tooltipData) return;

    // Build tooltip content
    let tooltipContent = `
      <div class="font-medium mb-2">${tooltipData.date}</div>
      <div class="text-sm">
        <div>Total Submissions: <span class="font-medium">${tooltipData.totalSubmissions}</span></div>
        <div>Problems Solved: <span class="font-medium">${tooltipData.problemsSolved}</span></div>
      </div>
    `;

    if (Object.keys(tooltipData.breakdown).length > 0) {
      tooltipContent += '<div class="mt-2 pt-2 border-t border-divider-3 dark:border-dark-divider-3">';
      Object.entries(tooltipData.breakdown).forEach(([key, value]) => {
        tooltipContent += `<div class="text-sm">${key}: <span class="font-medium">${value}</span></div>`;
      });
      tooltipContent += '</div>';
    }

    tooltip.innerHTML = tooltipContent;
    tooltip.style.display = 'block';
    tooltip.style.left = context.caretX + 'px';
    tooltip.style.top = context.caretY - tooltip.offsetHeight - 10 + 'px';
  }

  // Return the instance interface
  return {
    updateData: (newData: ProcessedData) => {
      Object.assign(processedData, newData);
      brushData = getBrushChartData(processedData);
      initializeBrushChart();
      updateMainChart();
    },

    updateFilters: (newFilters: Partial<InteractiveChartFilters>) => {
      Object.assign(currentFilters, newFilters);
      updateMainChart();
    },

    destroy: () => {
      if (mainChart) {
        mainChart.destroy();
        mainChart = null;
      }
      // Clean up D3 elements
      d3.select(container.querySelector('#brush-chart')).selectAll("*").remove();
      // Remove the style element
      document.head.removeChild(style);
    }
  };
}
