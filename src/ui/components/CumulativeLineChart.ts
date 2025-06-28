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
            }
        });
        existingChart.update();
        return existingChart;
    }

    const config: ChartConfiguration<'line', number[], string> = {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                    },
                    ticks: {
                        color: '#a0aec0', // Gray-400
                    },
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                    },
                    ticks: {
                        color: '#a0aec0', // Gray-400
                    },
                },
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#a0aec0',
                        boxWidth: 20,
                    },
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    position: 'nearest',
                    backgroundColor: '#2d3748', // Gray-800
                    titleColor: '#e2e8f0', // Gray-200
                    bodyColor: '#e2e8f0',
                    callbacks: {
                        // Custom tooltip formatting
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