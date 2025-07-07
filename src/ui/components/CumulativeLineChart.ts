// src/ui/components/CumulativeLineChart.ts

import type { CumulativeChartStats } from '../../types';
import { Chart, ChartConfiguration, ChartTypeRegistry } from 'chart.js';

// Define a type for our specific chart instance to make updates easier
export type CumulativeLineChartInstance = Chart<'line', number[], string>;

export function renderOrUpdateCumulativeLineChart(
    canvas: HTMLCanvasElement,
    chartData: CumulativeChartStats,
    existingChart?: CumulativeLineChartInstance
): CumulativeLineChartInstance {
    if (existingChart) {
        existingChart.data.labels = chartData.labels;
        // Important: Update each dataset individually to preserve styling and settings
        chartData.datasets.forEach((newDataset, index) => {
            if (existingChart.data.datasets[index]) {
                existingChart.data.datasets[index].data = newDataset.data;
                existingChart.data.datasets[index].label = newDataset.label;
                existingChart.data.datasets[index].borderColor = newDataset.borderColor;
            }
        });
        existingChart.update();
        return existingChart;
    }

    // **UPDATED:** Add pointRadius: 0 to remove circles
    const processedChartData = {
        ...chartData,
        datasets: chartData.datasets.map(dataset => ({
            ...dataset,
            pointRadius: 0, // **NEW:** Remove circles on data points
            pointHoverRadius: 4, // **NEW:** Show small circle only on hover
        }))
    };

    const config: ChartConfiguration<'line', number[], string> = {
        type: 'line',
        data: processedChartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    // **UPDATED:** Remove background grid lines
                    grid: {
                        display: false,
                    },
                    ticks: {
                        color: '#bdbeb3', // **UPDATED:** Numbers color
                    },
                },
                y: {
                    beginAtZero: true,
                    // **UPDATED:** Remove background grid lines
                    grid: {
                        display: false,
                    },
                    ticks: {
                        color: '#bdbeb3', // **UPDATED:** Numbers color
                    },
                },
            },
            plugins: {
                // **UPDATED:** Remove legend
                legend: {
                    display: false,
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    position: 'nearest',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#bdbeb3',
                    bodyColor: '#bdbeb3',
                    borderColor: '#5db666',
                    borderWidth: 1,
                    callbacks: {
                        title: function (tooltipItems) {
                             return tooltipItems[0].label;
                        },
                    },
                },
            },
            // This creates the vertical line on hover
            interaction: {
                mode: 'index',
                intersect: false,
            },
        },
    };

    return new Chart(canvas, config);
}
