import Chart from 'chart.js/auto';
import type { ChartData, ChartOptions } from 'chart.js';

export type DoughnutChartInstance = Chart;

/**
 * Renders or updates a doughnut chart for submission signatures.
 * @param canvas The <canvas> element to draw on.
 * @param data The data from getSubmissionSignatureStats.
 * @param filters The current global filter settings.
 * @param existingChart An optional existing chart instance to update.
 * @returns The new or updated Chart.js instance.
 */
export function renderOrUpdateDoughnutChart(
    canvas: HTMLCanvasElement,
    data: any,
    filters: { difficulty: string },
    existingChart?: DoughnutChartInstance
): DoughnutChartInstance {
    
    const chartData: ChartData = {
        labels: data.labels,
        datasets: data.datasets,
    };

    const options: ChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: { 
                    color: 'rgba(255, 255, 255, 0.9)', 
                    boxWidth: 15,
                    padding: 15,
                }
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const index = context.dataIndex;
                        const tooltipData = data.tooltipsData[index];
                        return ` Count: ${tooltipData.count} (${tooltipData.percent})`;
                    },
                    footer: (tooltipItems) => {
                        const index = tooltipItems[0].dataIndex;
                        const breakdown = data.tooltipsData[index].breakdown;
                        // Only show breakdown if the 'All' difficulty filter is selected
                        if (filters.difficulty === 'All') {
                           return `\nEasy: ${breakdown.E} | Medium: ${breakdown.M} | Hard: ${breakdown.H}`;
                        }
                        return '';
                    },
                },
            },
        }
    };

    if (existingChart) {
        existingChart.data = chartData;
        existingChart.options = options;
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
