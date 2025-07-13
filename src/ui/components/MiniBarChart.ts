import { Chart, ChartConfiguration, registerables } from 'chart.js';

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
          'rgb(88, 184, 185)',  // Green for Easy
          'rgb(251, 191, 36)', // Yellow for Medium
          'rgb(239, 68, 68)'   // Red for Hard
        ],
        borderColor: [
          'rgb(88, 184, 185)',
          'rgb(251, 191, 36)',
          'rgb(239, 68, 68)'
        ],
        borderWidth: 1
      }]
    },
    options: {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      enabled: false // Disable tooltips
    }
  },
  scales: {
    x: {
      display: false
    },
    y: {
      display: false,
      beginAtZero: true
    }
  }
}
  };

  const chart = new Chart(canvas, config);

  return {
    chart,
    destroy() {
      chart.destroy();
    }
  };
}
