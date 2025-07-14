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
  // ## CHANGE: Reordered toggles and updated default active states.
  container.innerHTML = `
    <div class="interactive-chart-container">
      <!-- Global Toggles -->
      <div class="flex justify-between items-center mb-4">
        <!-- Primary Toggle (Left) -->
        <div class="text-sd-muted-foreground inline-flex items-center justify-center bg-sd-muted rounded-full p-[1px]">
          <button id="primary-problems" data-view="Problems Solved" data-state="active" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">
            Problems Solved
          </button>
          <button id="primary-submissions" data-view="Submissions" data-state="inactive" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">
            Submissions
          </button>
        </div>
        
        <!-- Secondary Toggle (Right) -->
        <div class="text-sd-muted-foreground inline-flex items-center justify-center bg-sd-muted rounded-full p-[1px]">
          <button id="secondary-language" data-view="Language" data-state="inactive" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">
            Language
          </button>
          <button id="secondary-difficulty" data-view="Difficulty" data-state="active" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">
            Difficulty
          </button>
          <button id="secondary-status" data-view="Status" data-state="inactive" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">
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
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .interactive-chart-container {
      font-family: inherit;
    }

    .chart-tooltip {
      position: absolute;
      background: #353535;
      border: 1px solid #4a4a4a;
      border-radius: 8px;
      padding: 12px;
      font-size: 14px;
      color: #f9ffff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      pointer-events: none;
      z-index: 1000;
      display: none;
      max-width: 300px;
    }

    /* === REVISED NAVIGATOR/BRUSH STYLES === */

    .navigator-container .axis .domain,
    .navigator-container .axis .tick line {
        stroke: #bdbeb3;
        stroke-opacity: 0.5;
    }

    .navigator-container .axis .tick text {
        fill: #bdbeb3;
        font-size: 11px;
        font-family: inherit;
    }

    .navigator-area {
        fill: #5db666;
        fill-opacity: 0.25;
        stroke: #5db666;
        stroke-width: 1.5;
        stroke-opacity: 0.8;
    }

    /* The selection rectangle is now a semi-transparent highlight */
    .brush .selection {
      fill: rgba(249, 255, 255, 0.0); /* Lighter highlight color */
      stroke: #bdbeb3; /* Crisp white border */
      stroke-width: 1px;
      shape-rendering: crispEdges;
    }

    .brush .handle {
      fill: #353535;
      stroke: #bdbeb3;
      stroke-width: 1px;
      rx: 3;
      ry: 3;
    }
  `;
  document.head.appendChild(style);

  // Initialize state
  // ## FIX: Explicitly set default filters to match the default UI state.
  // This ensures the chart's initial data load is synced with the active buttons.
  let currentFilters: InteractiveChartFilters = { 
    ...initialFilters,
    primaryView: 'Problems Solved',
    secondaryView: 'Difficulty',
  };
  let mainChart: Chart | null = null;
  let brushData: BrushChartData | null = null;

  // Initialize charts after DOM is ready
  setTimeout(() => {
    initializeMainChart();
    initializeBrushChart();
    setupEventListeners();
  }, 100);

  function initializeMainChart() {
    const canvas = container.querySelector('#main-chart') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const chartData = getInteractiveChartStats(processedData, currentFilters);
    if (!chartData) return;
    const showLegend = currentFilters.secondaryView === 'Language';

    mainChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartData.labels,
        datasets: chartData.datasets.map(dataset => ({
          ...dataset,
          maxBarThickness: 20,
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { 
              display: showLegend,
              labels: {
                boxWidth: 12,
                padding: 15,
                font: { size: 12 },
                color: '#bdbeb3',
              } 
          },
          tooltip: { enabled: false, external: handleTooltip }
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { 
              color: '#bdbeb3',
              maxTicksLimit: 12,
              maxRotation: 45,
              minRotation: 0
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { display: false },
            ticks: { color: '#bdbeb3' }
          }
        },
        elements: { bar: { borderRadius: 4, borderSkipped: 'bottom' } },
        animation: { duration: 500, easing: 'easeInOutQuart' }
      }
    });
  }

  function initializeBrushChart() {
    brushData = getBrushChartData(processedData);
    if (!brushData || !mainChart) return;

    const svg = d3.select(container.querySelector('#brush-chart'));
    const margin = { top: 10, right: 20, bottom: 25, left: 20 };
    
    const mainChartCanvas = container.querySelector('#main-chart') as HTMLElement;
    const containerWidth = mainChartCanvas.offsetWidth;

    if (containerWidth <= 0) {
        console.warn('Container width not ready, retrying...');
        setTimeout(initializeBrushChart, 100);
        return;
    }
    const width = containerWidth - margin.left - margin.right;
    const height = 80 - margin.top - margin.bottom;

    svg.selectAll("*").remove();
    svg.attr("width", containerWidth).attr("height", 80);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const defs = g.append("defs");
    
    defs.append("clipPath")
      .attr("id", "navigator-clip")
      .append("rect")
      .attr("width", width)
      .attr("height", height);
    
    const selectedClip = defs.append("clipPath")
      .attr("id", "selected-area-clip")
      .append("rect")
      .attr("x", 0).attr("y", 0)
      .attr("width", width).attr("height", height);

    const dimmedClip = defs.append("clipPath")
      .attr("id", "dimmed-area-clip");
    
    dimmedClip.append("rect")
      .attr("class", "dim-left-rect")
      .attr("x", 0).attr("y", 0)
      .attr("width", 0).attr("height", height);
    
    dimmedClip.append("rect")
      .attr("class", "dim-right-rect")
      .attr("x", width).attr("y", 0)
      .attr("width", 0).attr("height", height);

    const xScale = d3.scaleTime()
      .domain(d3.extent(brushData.labels, d => new Date(d)) as [Date, Date])
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(brushData.data) as number])
      .range([height, 0]);

    const area = d3.area<any>()
      .x((d, i) => xScale(new Date(brushData!.labels[i])))
      .y0(height)
      .y1((d, i) => yScale(brushData!.data[i]))
      .curve(d3.curveBasis);

    const chartArea = g.append("g")
      .attr("clip-path", "url(#navigator-clip)");

    chartArea.append("path")
      .datum(brushData.data)
      .attr("class", "navigator-area-selected")
      .attr("d", area)
      .attr("clip-path", "url(#selected-area-clip)")
      .style("fill", "#5db666").style("fill-opacity", 0.25)
      .style("stroke", "#5db666").style("stroke-width", 1.5).style("stroke-opacity", 0.8);

    chartArea.append("path")
      .datum(brushData.data)
      .attr("class", "navigator-area-dimmed")
      .attr("d", area)
      .attr("clip-path", "url(#dimmed-area-clip)")
      .style("fill", "#5db666").style("fill-opacity", 0.1)
      .style("stroke", "#5db666").style("stroke-width", 1.5).style("stroke-opacity", 0.3);

    const brush = d3.brushX()
      .extent([[0, 0], [width, height]])
      .handleSize(8)
      .on("brush end", handleBrush);

    const brushG = g.append("g").attr("class", "brush");
    brush(brushG);

    // ## CHANGE: Set initial brush to last 12 months (or since first submission)
    // This logic replaces the previous `setTimeout` that selected the full range.
    setTimeout(() => {
        const [minDate, maxDate] = xScale.domain();

        // Guard against empty data
        if (!minDate || !maxDate) {
            brushG.call(brush.move, [0, width]);
            selectedClip.attr("x", 0).attr("width", width);
            dimmedClip.select(".dim-left-rect").attr("width", 0);
            dimmedClip.select(".dim-right-rect").attr("width", 0);
            return;
        }

        // Calculate the start date for the initial selection
        const twelveMonthsAgo = new Date(maxDate);
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        
        // The start date is the later of "12 months ago" or the "first submission date"
        const initialStartDate = new Date(Math.max(twelveMonthsAgo.getTime(), minDate.getTime()));
        const initialEndDate = maxDate;

        // Convert dates to pixel values for the brush
        const initialX0 = xScale(initialStartDate);
        const initialX1 = xScale(initialEndDate);

        // Programmatically move the brush to the initial selection
        brushG.call(brush.move, [initialX0, initialX1]);

        // Manually update clips because the brush handler will ignore this programmatic move
        selectedClip
          .attr("x", initialX0)
          .attr("width", initialX1 - initialX0);
        
        dimmedClip.select(".dim-left-rect")
          .attr("x", 0)
          .attr("width", initialX0);
            
        dimmedClip.select(".dim-right-rect")
          .attr("x", initialX1)
          .attr("width", width - initialX1);

        // Manually update the main chart for the initial view to match the brush
        currentFilters.brushWindow = [initialStartDate, initialEndDate];
        updateMainChart();
    }, 0);

    const xAxis = d3.axisBottom(xScale)
      .ticks(Math.min(6, Math.ceil(width / 100)))
      .tickFormat((domainValue, index) => {
        const date = domainValue as Date;
        const daysDiff = (xScale.domain()[1].getTime() - xScale.domain()[0].getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff <= 90) return d3.timeFormat("%d-%m")(date);
        else if (daysDiff <= 1095) return d3.timeFormat("%b %y")(date);
        else return d3.timeFormat("%Y")(date);
      });

    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis);

    function handleBrush(event: any) {
      if (!event.sourceEvent) return; // Important: Prevents infinite loops on programmatic brushing
      const selection = event.selection;
      if (!selection || !brushData) return;

      const [x0, x1] = selection;
      
      selectedClip
        .attr("x", x0)
        .attr("width", x1 - x0);
      
      dimmedClip.select(".dim-left-rect")
        .attr("x", 0)
        .attr("width", x0);
          
      dimmedClip.select(".dim-right-rect")
        .attr("x", x1)
        .attr("width", width - x1);

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
    mainChart.data.labels = chartData.labels;
    mainChart.data.datasets = chartData.datasets;
    const showLegend = currentFilters.secondaryView === 'Language';
    mainChart.options.plugins!.legend!.display = showLegend;
    mainChart.update('none');
  }

  function setupEventListeners() {
    const primaryButtons = container.querySelectorAll('[id^="primary-"]');
    primaryButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const newView = target.dataset.view as 'Submissions' | 'Problems Solved';
        if (newView === currentFilters.primaryView) return;
        primaryButtons.forEach(b => b.setAttribute('data-state', 'inactive'));
        target.setAttribute('data-state', 'active');
        currentFilters.primaryView = newView;
        updateMainChart();
      });
    });

    const secondaryButtons = container.querySelectorAll('[id^="secondary-"]');
    secondaryButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const newView = target.dataset.view as 'Difficulty' | 'Language' | 'Status';
        if (newView === currentFilters.secondaryView) return;
        secondaryButtons.forEach(b => b.setAttribute('data-state', 'inactive'));
        target.setAttribute('data-state', 'active');
        currentFilters.secondaryView = newView;
        updateMainChart();
      });
    });
  }

  function handleTooltip(context: any) {
    const tooltipEl = container.querySelector('#chart-tooltip') as HTMLElement;
    if (!tooltipEl) return;
    const tooltipModel = context.tooltip;

    if (tooltipModel.opacity === 0) {
      tooltipEl.style.opacity = '0';
      return;
    }

    const dataIndex = tooltipModel.dataPoints[0]?.dataIndex;
    if (dataIndex === undefined) return;

    const chartData = getInteractiveChartStats(processedData, currentFilters);
    if (!chartData) return;

    const label = chartData.labels[dataIndex];
    const tooltipData = getTooltipData(processedData, label, currentFilters);
    if (!tooltipData) return;

    let innerHtml = `<div class="font-medium mb-2">${tooltipData.date}</div>`;
    innerHtml += `<div class="text-sm space-y-1">`;
    innerHtml += `<div>Total Submissions: <span class="font-medium text-white">${tooltipData.totalSubmissions}</span></div>`;
    innerHtml += `<div>Problems Solved: <span class="font-medium text-white">${tooltipData.problemsSolved}</span></div>`;
    innerHtml += `</div>`;
    
    if (Object.keys(tooltipData.breakdown).length > 0) {
        innerHtml += '<div class="mt-2 pt-2 border-t" style="border-color: rgba(189, 190, 179, 0.2);">';
        Object.entries(tooltipData.breakdown).forEach(([key, value]) => {
            if (Number(value) > 0) {
               innerHtml += `<div class="text-sm">${key}: <span class="font-medium text-white">${value}</span></div>`;
            }
        });
        innerHtml += '</div>';
    }

    tooltipEl.innerHTML = innerHtml;
    
    const position = context.chart.canvas.getBoundingClientRect();
    tooltipEl.style.opacity = '1';
    tooltipEl.style.position = 'absolute';
    tooltipEl.style.left = position.left + window.pageXOffset + tooltipModel.caretX + 'px';
    tooltipEl.style.top = position.top + window.pageYOffset + tooltipModel.caretY - tooltipEl.offsetHeight - 8 + 'px';
    tooltipEl.style.pointerEvents = 'none';
  }

  return {
    updateData: (newData: ProcessedData) => {
      Object.assign(processedData, newData);
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
      d3.select(container.querySelector('#brush-chart')).selectAll("*").remove();
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }
  };
}
