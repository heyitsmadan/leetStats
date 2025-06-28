import Chart from 'chart.js/auto';
import type { ChartData, ChartOptions } from 'chart.js';

export type CodingClockChartInstance = Chart;

const GLOW_COLOR = 'rgba(255, 255, 0, 0.7)';
const GLOW_BLUR = 15;

/**
 * Renders or updates a stacked bar chart.
 * @param canvas The <canvas> element to draw on.
 * @param data The data from getCodingClockStats.
 * @returns The Chart.js instance.
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
        // **FIX:** indexAxis is removed, making the chart vertical by default.
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: {
                callbacks: {
                    footer: (tooltipItems: any) => {
                        const index = tooltipItems[0].dataIndex;
                        const tooltipData = data.tooltipsData[index];
                        return `Total: ${tooltipData.total}\nAccepted: ${tooltipData.accepted}\nRate: ${tooltipData.rate}`;
                    },
                },
            },
            legend: {
                position: 'top',
                labels: { color: 'rgba(255, 255, 255, 0.9)' }
            },
        },
        scales: {
            // **FIX:** Swapped x and y axis configurations for vertical orientation.
            x: { // This is now the category axis (Hour/Day)
                stacked: true,
                ticks: { color: 'rgba(255, 255, 255, 0.7)' },
                grid: { display: false }
            },
            y: { // This is now the value axis (Submission Count)
                stacked: true,
                ticks: { color: 'rgba(255, 255, 255, 0.7)' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
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
