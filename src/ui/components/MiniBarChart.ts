import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { colors } from '../theme/colors';

Chart.register(...registerables);

export interface MiniBarChartInstance {
  chart: Chart;
  destroy(): void;
}

export function renderOrUpdateMiniBarChart(
  canvas: HTMLCanvasElement,
  data: { easy: number; medium: number; hard: number },
  existingChart?: MiniBarChartInstance
): MiniBarChartInstance {
  if (existingChart) {
    existingChart.destroy();
  }

  const config: ChartConfiguration = {
    type: 'bar',
    data: {
      labels: ['Easy', 'Medium', 'Hard'],
      datasets: [{
        data: [data.easy, data.medium, data.hard],
        backgroundColor: [
          colors.problems.easy,
          colors.problems.medium,
          colors.problems.hard,
        ],
        borderColor: [
          colors.problems.easy,
          colors.problems.medium,
          colors.problems.hard,
        ],
        borderWidth: 1,
      }, ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: false, // Disable tooltips
        },
      },
      scales: {
        x: {
          display: false,
        },
        y: {
          display: false,
          beginAtZero: true,
        },
      },
    },
  };

  const chart = new Chart(canvas, config);

  return {
    chart,
    destroy() {
      chart.destroy();
    },
  };
}