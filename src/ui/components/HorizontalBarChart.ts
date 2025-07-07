import Chart from 'chart.js/auto';
import type { ChartData, ChartOptions } from 'chart.js';

export type HorizontalBarChartInstance = Chart;

const GLOW_COLOR = 'rgba(255, 255, 0, 0.7)';
const GLOW_BLUR = 15;

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
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index', // Single tooltip for entire bar
                intersect: false,
                callbacks: {
                    title: (tooltipItems) => {
                        return tooltipItems[0].label; // Language name
                    },
                    label: () => {
                        return []; // Remove individual dataset labels
                    },
                    footer: (tooltipItems) => {
                        const index = tooltipItems[0].dataIndex;
                        const tooltipData = data.tooltipsData[index];
                        const breakdown = tooltipData.solvedBreakdown;
                        
                        let footerText = `Total Submissions: ${tooltipData.total}`;
                        footerText += `\nAccepted: ${tooltipData.accepted}`;
                        footerText += `\nSuccess Rate: ${tooltipData.rate}`;
                        
                        if (filters.difficulty === 'All') {
                            footerText += `\nSolved: E:${breakdown.E} M:${breakdown.M} H:${breakdown.H}`;
                        }
                        
                        footerText += `\nFirst used: ${tooltipData.firstUsed}`;
                        footerText += `\nLast used: ${tooltipData.lastUsed}`;
                        
                        return footerText;
                    },
                },
            },
        },
        scales: {
            x: {
                stacked: true,
                ticks: { color: 'rgba(255, 255, 255, 0.7)' },
                grid: { display: false } // Remove background lines
            },
            y: {
                stacked: true,
                ticks: { color: 'rgba(255, 255, 255, 0.7)' },
                grid: { display: false } // Remove background lines
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
