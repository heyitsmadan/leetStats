import * as d3 from 'd3';
import type { ProcessedData, Difficulty, TimeRange } from '../../types';

export interface DNAStrandChartInstance {
  destroy(): void;
  update(data: DNAStrandData): void;
  updateOptions(options: DNAStrandOptions): void;
}

export interface DNAStrandData {
  timeBlocks: TimeBlock[];
  overview: OverviewData;
}

export interface DNAStrandOptions {
  viewMode: 'problems' | 'submissions';
  stackMode: 'difficulty' | 'language';
  timeRange: 'daily' | 'weekly' | 'monthly';
}

interface TimeBlock {
  date: Date;
  dateLabel: string;
  problems: { easy: number; medium: number; hard: number };
  submissions: { accepted: number; failed: number };
  languages: { [lang: string]: number };
}

interface OverviewData {
  startDate: Date;
  endDate: Date;
  maxValue: number;
}

export function renderOrUpdateDNAStrandChart(
  container: HTMLElement,
  data: DNAStrandData,
  options: DNAStrandOptions,
  existingInstance?: DNAStrandChartInstance
): DNAStrandChartInstance {
  
  if (existingInstance) {
    existingInstance.update(data);
    return existingInstance;
  }

  return new DNAStrandChart(container, data, options);
}

class DNAStrandChart implements DNAStrandChartInstance {
  private container: HTMLElement;
  private data: DNAStrandData;
  private options: DNAStrandOptions;
  
  private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private mainChart!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private overviewChart!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private tooltip!: d3.Selection<HTMLDivElement, unknown, null, undefined>;
  private brush!: d3.BrushBehavior<unknown>;
  private xScale!: d3.ScaleTime<number, number>;
  private yScale!: d3.ScaleLinear<number, number>;
  private xScaleOverview!: d3.ScaleTime<number, number>;
  private yScaleOverview!: d3.ScaleLinear<number, number>;
  private clipPath!: d3.Selection<SVGClipPathElement, unknown, null, undefined>;
  private clipRect!: d3.Selection<SVGRectElement, unknown, null, undefined>;

  private clipId: string;
  
  // Fix 2: Flipped color order - red on top, yellow middle, green bottom
  private readonly colors = {
    hard: '#ef4743',     // Red on top
    medium: '#ffc01e',   // Yellow in middle  
    easy: '#00b8a3',     // Green at bottom
    accepted: '#00b8a3',
    failed: '#ef4743',
    python: '#3776ab',
    javascript: '#f7df1e',
    java: '#ed8b00',
    cpp: '#00599c',
    csharp: '#239120',
    ghost: 'rgba(156, 163, 175, 0.1)' // Fix 5: Much more subtle
  };

  private dimensions = {
    width: 0,
    height: 320,
    overviewHeight: 60,
    margin: { top: 20, right: 20, bottom: 80, left: 40 },
    overviewMargin: { top: 10, right: 20, bottom: 20, left: 40 }
  };

  constructor(container: HTMLElement, data: DNAStrandData, options: DNAStrandOptions) {
    this.container = container;
    this.data = data;
    this.options = options;
    this.clipId = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; // Unique ID
    this.init();
  }

  private init() {
    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.style.width = '100%';
    this.container.style.height = '384px';
    
    if (this.container.clientWidth === 0) {
      this.container.style.minWidth = '800px';
    }
    
    this.dimensions.width = this.container.clientWidth || 800;
    
    // Create main SVG
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.dimensions.width)
      .attr('height', this.dimensions.height + this.dimensions.overviewHeight + 20)
      .style('display', 'block');

    // Fix 3: Add clipping path
    const defs = this.svg.append('defs');
    this.clipPath = defs.append('clipPath')
    .attr('id', this.clipId);

    

    // Create rect inside clipPath

    this.clipRect = this.clipPath.append('rect')
      .attr('width', this.dimensions.width - this.dimensions.margin.left - this.dimensions.margin.right)
      .attr('height', this.dimensions.height - this.dimensions.margin.top - this.dimensions.margin.bottom);

    // Create tooltip
    this.tooltip = d3.select(this.container)
      .append('div')
      .attr('class', 'dna-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'white')
      .style('border', '1px solid #ccc')
      .style('border-radius', '8px')
      .style('padding', '12px')
      .style('font-size', '12px')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.1)')
      .style('z-index', '1000')
      .style('pointer-events', 'none')
      .style('color', 'black');

    // Create main chart group with clipping
    this.mainChart = this.svg.append('g')
      .attr('transform', `translate(${this.dimensions.margin.left}, ${this.dimensions.margin.top})`)
      .attr('clip-path', `url(#${this.clipId})`); // Apply clipping

    // Create overview chart group
    this.overviewChart = this.svg.append('g')
      .attr('transform', `translate(${this.dimensions.overviewMargin.left}, ${this.dimensions.height + 20})`);

    this.initScales();
    this.initBrush();
    this.render();
  }

  private initScales() {
    const chartWidth = this.dimensions.width - this.dimensions.margin.left - this.dimensions.margin.right;
    const chartHeight = this.dimensions.height - this.dimensions.margin.top - this.dimensions.margin.bottom;
    const overviewWidth = this.dimensions.width - this.dimensions.overviewMargin.left - this.dimensions.overviewMargin.right;
    const overviewHeight = this.dimensions.overviewHeight - this.dimensions.overviewMargin.top - this.dimensions.overviewMargin.bottom;
    // Update clip rect dimensions

    this.clipRect

      .attr('width', chartWidth)

      .attr('height', chartHeight);
    this.xScale = d3.scaleTime()
      .domain(d3.extent(this.data.timeBlocks, d => d.date) as [Date, Date])
      .range([0, chartWidth]);

    this.yScale = d3.scaleLinear()
      .domain([0, this.data.overview.maxValue])
      .range([chartHeight, 0]);

    this.xScaleOverview = d3.scaleTime()
      .domain(d3.extent(this.data.timeBlocks, d => d.date) as [Date, Date])
      .range([0, overviewWidth]);

    this.yScaleOverview = d3.scaleLinear()
      .domain([0, this.data.overview.maxValue])
      .range([overviewHeight, 0]);
  }

  private initBrush() {
    const overviewWidth = this.dimensions.width - this.dimensions.overviewMargin.left - this.dimensions.overviewMargin.right;
    const overviewHeight = this.dimensions.overviewHeight - this.dimensions.overviewMargin.top - this.dimensions.overviewMargin.bottom;

    this.brush = d3.brushX()
      .extent([[0, 0], [overviewWidth, overviewHeight]])
      .on('brush end', (event: d3.D3BrushEvent<unknown>) => {
        if (!event.selection) return;
        
        const [x0, x1] = event.selection as [number, number];
        const newDomain: [Date, Date] = [
          this.xScaleOverview.invert(x0),
          this.xScaleOverview.invert(x1)
        ];
        
        this.xScale.domain(newDomain);
        this.updateMainChart();
      });
  }

  private render() {
    this.renderMainChart();
    this.renderOverviewChart();
    this.renderAxes();
  }

  private renderMainChart() {
    // Fix 4: Dynamic bar width based on visible data
    const visibleData = this.getVisibleData();
    const chartWidth = this.dimensions.width - this.dimensions.margin.left - this.dimensions.margin.right;
    const barWidth = Math.max(Math.min(chartWidth / visibleData.length - 2, 20), 4); // Min 4px, max 20px

    console.log('Visible data points:', visibleData.length, 'Bar width:', barWidth);

    const barGroups = this.mainChart.selectAll<SVGGElement, TimeBlock>('.bar-group')
      .data(visibleData, d => d.date.getTime().toString());

    const enterGroups = barGroups.enter()
      .append('g')
      .attr('class', 'bar-group')
      .attr('transform', d => `translate(${this.xScale(d.date) - barWidth/2}, 0)`);

    const updateGroups = barGroups.merge(enterGroups);
    
    updateGroups
      .transition()
      .duration(750)
      .ease(d3.easeQuadOut)
      .attr('transform', d => `translate(${this.xScale(d.date) - barWidth/2}, 0)`);

    barGroups.exit()
      .transition()
      .duration(500)
      .style('opacity', 0)
      .remove();

    this.renderGhostBars(updateGroups, barWidth);
    this.renderBars(updateGroups, barWidth);
  }

  private getVisibleData(): TimeBlock[] {
    const [start, end] = this.xScale.domain();
    return this.data.timeBlocks.filter(d => d.date >= start && d.date <= end);
  }

  private renderGhostBars(selection: d3.Selection<SVGGElement, TimeBlock, SVGGElement, unknown>, barWidth: number) {
    const ghostSegments = this.getGhostSegments();
    
    selection.each((d, i, nodes) => {
      const group = d3.select(nodes[i]);
      
      group.selectAll('.ghost-bar').remove();
      
      if (ghostSegments.length === 0) return;
      
      const ghostHeight = this.calculateGhostHeight(d, ghostSegments);
      
      if (ghostHeight > 0) {
        // Fix 5: More subtle ghost bars - no border, very low opacity
        group.append('rect')
          .attr('class', 'ghost-bar')
          .attr('x', 0)
          .attr('width', barWidth)
          .attr('rx', 4)
          .attr('ry', 4)
          .attr('fill', this.colors.ghost)
          .attr('stroke', 'none') // No border
          .attr('y', this.yScale(0))
          .attr('height', 0)
          .transition()
          .duration(500)
          .attr('y', this.yScale(ghostHeight))
          .attr('height', this.yScale(0) - this.yScale(ghostHeight));
      }
    });
  }

  private renderBars(selection: d3.Selection<SVGGElement, TimeBlock, SVGGElement, unknown>, barWidth: number) {
    selection.each((d, i, nodes) => {
      const group = d3.select(nodes[i]);
      
      const barSegments = this.getBarSegments(d);
      const totalValue = barSegments.reduce((sum, seg) => sum + seg.value, 0);
      
      const segmentSelection = group.selectAll<SVGRectElement, any>('.bar-segment')
        .data(barSegments, (seg: any) => seg.label);

      const enterSegments = segmentSelection.enter()
        .append('rect')
        .attr('class', 'bar-segment')
        .attr('x', 0)
        .attr('width', barWidth)
        .attr('fill', (seg: any) => seg.color)
        .attr('y', this.yScale(0))
        .attr('height', 0)
        .style('cursor', 'pointer');

      const updateSegments = segmentSelection.merge(enterSegments);
      
      updateSegments
        .on('mouseover', (event, seg) => this.showTooltip(event, d, seg))
        .on('mouseout', () => this.hideTooltip())
        .transition()
        .duration(750)
        .ease(d3.easeQuadOut)
        .attr('fill', (seg: any) => seg.color)
        .attr('y', (seg: any, idx: number) => {
          const prevHeight = barSegments.slice(0, idx).reduce((sum, s) => sum + s.value, 0);
          return this.yScale(totalValue - prevHeight);
        })
        .attr('height', (seg: any) => this.yScale(0) - this.yScale(seg.value))
        // Fix 2: Remove rounded corners on inner segments, only keep on outer edges
        .attr('rx', (seg: any, idx: number) => {
          if (barSegments.length === 1) return 4; // Single segment - round all corners
          if (idx === 0) return 4; // Top segment - round top only
          if (idx === barSegments.length - 1) return 4; // Bottom segment - round bottom only
          return 0; // Middle segments - no rounding
        })
        .attr('ry', (seg: any, idx: number) => {
          if (barSegments.length === 1) return 4;
          if (idx === 0) return 4;
          if (idx === barSegments.length - 1) return 4;
          return 0;
        });

      segmentSelection.exit()
        .transition()
        .duration(500)
        .attr('height', 0)
        .attr('y', this.yScale(0))
        .style('opacity', 0)
        .remove();
    });
  }

  private renderOverviewChart() {
    const overviewWidth = this.dimensions.width - this.dimensions.overviewMargin.left - this.dimensions.overviewMargin.right;
    const barWidth = Math.max(overviewWidth / this.data.timeBlocks.length - 1, 2);

    const overviewBars = this.overviewChart.selectAll<SVGRectElement, TimeBlock>('.overview-bar')
      .data(this.data.timeBlocks);

    overviewBars.enter()
      .append('rect')
      .attr('class', 'overview-bar')
      .attr('x', d => this.xScaleOverview(d.date) - barWidth/2)
      .attr('width', barWidth)
      .attr('rx', 2)
      .attr('ry', 2)
      .attr('fill', '#999')
      .attr('y', d => this.yScaleOverview(this.getTotalValue(d)))
      .attr('height', d => this.yScaleOverview(0) - this.yScaleOverview(this.getTotalValue(d)));

    const brushGroup = this.overviewChart.append('g').attr('class', 'brush');
    brushGroup.call(this.brush as any);

    const initialSelection: [number, number] = [0, overviewWidth];
    brushGroup.call(this.brush.move, initialSelection);
  }

  private renderAxes() {
    const chartHeight = this.dimensions.height - this.dimensions.margin.top - this.dimensions.margin.bottom;
    const overviewHeight = this.dimensions.overviewHeight - this.dimensions.overviewMargin.top - this.dimensions.overviewMargin.bottom;
    
    const timeFormat = d3.timeFormat('%b %d');
    const tickFormatter = (domainValue: d3.AxisDomain, index: number) => {
      return timeFormat(domainValue as Date);
    };

    this.mainChart.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(this.xScale).tickFormat(tickFormatter))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');

    this.mainChart.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(this.yScale));

    const overviewTimeFormat = d3.timeFormat('%b');
    const overviewTickFormatter = (domainValue: d3.AxisDomain, index: number) => {
      return overviewTimeFormat(domainValue as Date);
    };

    this.overviewChart.append('g')
      .attr('class', 'x-axis-overview')
      .attr('transform', `translate(0, ${overviewHeight})`)
      .call(d3.axisBottom(this.xScaleOverview).tickFormat(overviewTickFormatter));
  }

  private updateMainChart() {
    const timeFormat = d3.timeFormat('%b %d');
    const tickFormatter = (domainValue: d3.AxisDomain, index: number) => {
      return timeFormat(domainValue as Date);
    };

    this.mainChart.select<SVGGElement>('.x-axis')
      .transition()
      .duration(500)
      .call(d3.axisBottom(this.xScale).tickFormat(tickFormatter));

    this.renderMainChart();
  }

  private getGhostSegments(): string[] {
    if (this.options.viewMode === 'problems') {
      return ['accepted', 'failed'];
    } else {
      return ['easy', 'medium', 'hard'];
    }
  }

  private getBarSegments(block: TimeBlock) {
    if (this.options.viewMode === 'problems') {
      if (this.options.stackMode === 'difficulty') {
        // Fix 2: Flipped order - hard (red) first, then medium (yellow), then easy (green)
        return [
          { label: 'Hard', value: block.problems.hard, color: this.colors.hard },
          { label: 'Medium', value: block.problems.medium, color: this.colors.medium },
          { label: 'Easy', value: block.problems.easy, color: this.colors.easy }
        ].filter(seg => seg.value > 0);
      } else {
        return Object.entries(block.languages).map(([lang, count]) => ({
          label: lang,
          value: count,
          color: (this.colors as any)[lang] || '#6b7280'
        })).filter(seg => seg.value > 0);
      }
    } else {
      return [
        { label: 'Failed', value: block.submissions.failed, color: this.colors.failed },
        { label: 'Accepted', value: block.submissions.accepted, color: this.colors.accepted }
      ].filter(seg => seg.value > 0);
    }
  }

  private calculateGhostHeight(block: TimeBlock, ghostSegments: string[]): number {
    if (this.options.viewMode === 'problems' && ghostSegments.includes('accepted')) {
      return block.submissions.accepted + block.submissions.failed;
    } else if (this.options.viewMode === 'submissions' && ghostSegments.includes('easy')) {
      return block.problems.easy + block.problems.medium + block.problems.hard;
    }
    return 0;
  }

  private getTotalValue(block: TimeBlock): number {
    if (this.options.viewMode === 'problems') {
      return block.problems.easy + block.problems.medium + block.problems.hard;
    } else {
      return block.submissions.accepted + block.submissions.failed;
    }
  }

  private showTooltip(event: MouseEvent, block: TimeBlock, segment: any) {
    const [mouseX, mouseY] = d3.pointer(event, this.container);
    
    this.tooltip
      .style('visibility', 'visible')
      .style('left', `${mouseX + 10}px`)
      .style('top', `${mouseY - 10}px`)
      .html(`
        <div style="font-weight: 500; margin-bottom: 8px;">
          ${block.dateLabel}
        </div>
        <div style="margin-bottom: 4px;">
          <span>${segment.label}:</span>
          <span style="font-weight: 500; margin-left: 8px;">${segment.value}</span>
        </div>
        <div style="border-top: 1px solid #ccc; padding-top: 4px; margin-top: 8px; font-size: 11px;">
          ${this.options.viewMode === 'problems' ? 
            `Total Problems: ${block.problems.easy + block.problems.medium + block.problems.hard}` :
            `Total Submissions: ${block.submissions.accepted + block.submissions.failed}`
          }
        </div>
      `);
  }

  private hideTooltip() {
    this.tooltip.style('visibility', 'hidden');
  }

  public update(data: DNAStrandData) {
    this.data = data;
    this.initScales();
    this.renderMainChart();
    this.renderOverviewChart();
  }

  // Fix 1: Proper updateOptions method
  public updateOptions(options: DNAStrandOptions) {
    const oldOptions = { ...this.options };
    this.options = options;
    
    console.log('Updating options:', oldOptions, '->', options); // Debug
    
    // Force re-render with animations
    this.renderMainChart();
  }

  public destroy() {
    this.container.innerHTML = '';
  }
}
