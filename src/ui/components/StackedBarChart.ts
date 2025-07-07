import Chart from 'chart.js/auto';
import type { ChartData, ChartOptions } from 'chart.js';

export type CodingClockChartInstance = Chart;

const GLOW_COLOR = 'rgba(255, 255, 0, 0.7)';
const GLOW_BLUR = 15;

/**
 * Renders or updates a stacked bar chart.
 */
export function renderOrUpdateStackedBarChart(
    canvas: HTMLCanvasElement,
    data: any,
    existingChart?: CodingClockChartInstance
): CodingClockChartInstance {

    const chartData: ChartData = {
        labels: data.labels,
        datasets: data.datasets,
    };

    const options: ChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            // **UPDATED:** Custom tooltip for entire bar
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    title: (tooltipItems: any) => {
                        const index = tooltipItems[0].dataIndex;
                        const tooltipData = data.tooltipsData[index];
                        return tooltipData.label;
                    },
                    label: () => '', // Remove individual dataset labels
                    afterBody: (tooltipItems: any) => {
                        const index = tooltipItems[0].dataIndex;
                        const tooltipData = data.tooltipsData[index];
                        return [
                            `Submissions: ${tooltipData.total}`,
                            `Accepted: ${tooltipData.accepted}`,
                            `Rate: ${tooltipData.rate}`
                        ];
                    },
                },
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#bdbeb3',
                bodyColor: '#bdbeb3',
                borderColor: '#5db666',
                borderWidth: 1,
            },
            // **UPDATED:** Remove legend
            legend: {
                display: false
            },
        },
        scales: {
            x: {
                stacked: true,
                ticks: { 
                    color: '#bdbeb3' // **UPDATED:** Numbers color
                },
                grid: { display: false }
            },
            y: {
                stacked: true,
                ticks: { 
                    color: '#bdbeb3' // **UPDATED:** Numbers color
                },
                // **UPDATED:** Remove background horizontal lines
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
        existingChart.options = options;
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
