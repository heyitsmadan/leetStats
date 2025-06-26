import Chart from 'chart.js/auto';

/**
 * Renders a line chart onto a given canvas element.
 * @param canvas The <canvas> element to draw the chart on.
 * @param labels The labels for the X-axis.
 * @param data The data points for the Y-axis.
 * @param label The label for the dataset (e.g., 'Cumulative Submissions').
 */
export function createLineChart(
  canvas: HTMLCanvasElement,
  labels: string[],
  data: number[],
  label: string
) {
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: label,
          data: data,
          fill: true,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
          pointRadius: 0, // Hide points for a cleaner look
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            color: 'rgba(255, 255, 255, 0.7)',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 7, // Limit ticks to avoid clutter
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
          }
        },
        y: {
          ticks: {
            color: 'rgba(255, 255, 255, 0.7)',
          },
           grid: {
            color: 'rgba(255, 255, 255, 0.1)',
          }
        },
      },
      plugins: {
        legend: {
          labels: {
            color: 'rgba(255, 255, 255, 0.9)',
          }
        }
      }
    },
  });
}
