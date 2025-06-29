import Chart from 'chart.js/auto';
import type { ChartData, ChartOptions } from 'chart.js';

export type HorizontalBarChartInstance = Chart;

const GLOW_COLOR = 'rgba(255, 255, 0, 0.7)';
const GLOW_BLUR = 15;

/**
 * Renders or updates a horizontal stacked bar chart for language stats.
 * @param canvas The <canvas> element to draw on.
 * @param data The data from getLanguageStats.
 * @param filters The current global filter settings.
 * @param existingChart An optional existing chart instance to update.
 * @returns The new or updated Chart.js instance.
 */
export function renderOrUpdateHorizontalBarChart(
    canvas: HTMLCanvasElement,
    data: any,
    filters: { difficulty: string },
    existingChart?: HorizontalBarChartInstance
): HorizontalBarChartInstance {
    
    const chartData: ChartData = {
        labels: data.labels,
        datasets: data.datasets,
    };

    const options: ChartOptions = {
        indexAxis: 'y', // This makes it a horizontal bar chart
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    title: (tooltipItems) => {
                        // Use the language name as the title
                        return tooltipItems[0].label;
                    },
                    label: (context) => {
                        // Show "Accepted: X" or "Failed: Y"
                        return ` ${context.dataset.label}: ${context.raw}`;
                    },
                    footer: (tooltipItems) => {
                        const index = tooltipItems[0].dataIndex;
                        const tooltipData = data.tooltipsData[index];
                        const breakdown = tooltipData.solvedBreakdown;
                        let footerText = `\nTotal: ${tooltipData.total}\nSuccess Rate: ${tooltipData.rate}`;
                        
                        // Only show difficulty breakdown if 'All' is selected
                        if (filters.difficulty === 'All') {
                            footerText += `\nSolved: E:${breakdown.E} M:${breakdown.M} H:${breakdown.H}`;
                        }
                        
                        footerText += `\n\nFirst used: ${tooltipData.firstUsed}\nLast used: ${tooltipData.lastUsed}`;
                        return footerText;
                    },
                },
            },
        },
        scales: {
            x: {
                stacked: true,
                ticks: { color: 'rgba(255, 255, 255, 0.7)' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            y: {
                stacked: true,
                ticks: { color: 'rgba(255, 255, 255, 0.7)' },
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
