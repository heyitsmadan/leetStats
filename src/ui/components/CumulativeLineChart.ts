import { Chart, ChartConfiguration, TooltipModel, ChartOptions } from 'chart.js';
import type { CumulativeChartStats } from '../../types';

export type CumulativeLineChartInstance = Chart<'line', number[], string>;

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
            .tooltip-subheader { margin-bottom: 4px; font-size: 12px; color: #bdbeb3; }
            .tooltip-subheader:last-of-type { margin-bottom: 12px; }
            .tooltip-subheader-value { font-weight: 500; color: #f9ffff; margin-left: 6px; }
            .tooltip-divider { border-top: 1px solid #353535; margin: 10px 0; }
            .tooltip-breakdown-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 5px; }
            .tooltip-breakdown-item { display: flex; align-items: center; justify-content: space-between; font-size: 12px; gap: 16px}
            .tooltip-breakdown-label { display: flex; align-items: center; gap: 8px; color: #bdbeb3; }
            .tooltip-breakdown-value { font-weight: 500; color: #f9ffff; }
            .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
        `;
        document.head.appendChild(style);
    }
    return tooltipEl;
}


export function renderOrUpdateCumulativeLineChart(
    container: HTMLElement,
    chartData: CumulativeChartStats,
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
            tooltipEl.style.pointerEvents = 'none';
            return;
        }

        const dataIndex = tooltipModel.dataPoints[0]?.dataIndex;
        if (dataIndex === undefined) return;

        const label = tooltipModel.title?.[0] || '';
        const datasets = context.chart.config.data.datasets;

        let totalSubmissions = 0, easy = 0, medium = 0, hard = 0;
        
        // FIX: Check for the correct dataset labels
        datasets.forEach(dataset => {
            const value = dataset.data[dataIndex] as number;
            if (dataset.label === 'Total Submissions') totalSubmissions = value;
            if (dataset.label === 'Easy Solved') easy = value;
            if (dataset.label === 'Medium Solved') medium = value;
            if (dataset.label === 'Hard Solved') hard = value;
        });
        const totalProblems = easy + medium + hard;

        let innerHtml = `<div class="tooltip-header">${label}</div>`;
        innerHtml += `<div class="tooltip-subheader">Total Problems Solved: <span class="tooltip-subheader-value">${totalProblems}</span></div>`;
        innerHtml += `<div class="tooltip-subheader">Total Submissions: <span class="tooltip-subheader-value">${totalSubmissions}</span></div>`;
        innerHtml += `<div class="tooltip-divider"></div>`;
        innerHtml += `<ul class="tooltip-breakdown-list">`;
        const colors: { [key: string]: string } = { 'Easy': '#58b8b9', 'Medium': '#f4ba40', 'Hard': '#e24a41' };
        innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${colors['Easy']};"></span> Easy</span><span class="tooltip-breakdown-value">${easy}</span></li>`;
        innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${colors['Medium']};"></span> Medium</span><span class="tooltip-breakdown-value">${medium}</span></li>`;
        innerHtml += `<li class="tooltip-breakdown-item"><span class="tooltip-breakdown-label"><span class="status-dot" style="background-color: ${colors['Hard']};"></span> Hard</span><span class="tooltip-breakdown-value">${hard}</span></li>`;
        innerHtml += `</ul>`;

        tooltipEl.innerHTML = innerHtml;

        const container = context.chart.canvas.parentNode as HTMLElement;
        let newLeft = tooltipModel.caretX + 15;
        let newTop = tooltipModel.caretY;

        if (newLeft + tooltipEl.offsetWidth > container.offsetWidth) {
            newLeft = tooltipModel.caretX - tooltipEl.offsetWidth - 15;
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
    
    const options: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { grid: { display: false }, ticks: { color: '#bdbeb3' } },
            y: { beginAtZero: true, grid: { display: false }, ticks: { color: '#bdbeb3' } },
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: false,
                external: handleTooltip,
                mode: 'index',
                intersect: false,
            },
        },
        interaction: {
            mode: 'index',
            intersect: false,
        },
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
