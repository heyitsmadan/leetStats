import Chart from 'chart.js/auto';
import type { ChartData, ChartOptions } from 'chart.js';

export type DoughnutChartInstance = Chart;

export function renderOrUpdateDoughnutChart(
    canvas: HTMLCanvasElement,
    data: any,
    filters: { difficulty: string },
    existingChart?: DoughnutChartInstance
): DoughnutChartInstance {
    
    // Reverse arrays to achieve anticlockwise direction
    const reversedLabels = data.labels.slice().reverse();
    const reversedData = data.datasets[0].data.slice().reverse();
    const reversedColors = data.datasets[0].backgroundColor.slice().reverse();
    const reversedTooltipsData = data.tooltipsData.slice().reverse();
    
    const chartData: ChartData = {
        labels: reversedLabels,
        datasets: [{
            data: reversedData,
            backgroundColor: reversedColors,
            borderColor: '#373737',
            borderWidth: 2,
            hoverBackgroundColor: reversedColors,
            hoverBorderColor: '#373737',
            hoverBorderWidth: 2,
        }],
    };

    const options: ChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        // FIX: Configure precise interaction behavior
        interaction: {
            intersect: true, // Only trigger when directly over elements
            mode: 'point' as const,
        },
        elements: {
            arc: {
                borderWidth: 2,
                hoverBorderWidth: 2,
                hoverBorderColor: '#373737',
            }
        },
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
                intersect: true, // FIX: Only show when directly over segments
                mode: 'point', // FIX: Use point mode for precise detection
                callbacks: {
                    label: (context) => {
                        const tooltipData = reversedTooltipsData[context.dataIndex];
                        return ` Count: ${tooltipData.count} (${tooltipData.percent})`;
                    },
                    footer: (tooltipItems) => {
                        const breakdown = reversedTooltipsData[tooltipItems[0].dataIndex].breakdown;
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

