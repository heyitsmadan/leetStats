import type { ProcessedData } from '../analysis/processor';
import { getCumulativeSubmissions } from '../analysis/stats/getChartData';
import { createLineChart } from './components/LineChart';

/**
 * Finds the injection point and renders the entire stats UI.
 * @param processedData The fully processed data for the extension.
 */
export function renderPageLayout(processedData: ProcessedData) {
  // Use a robust selector to find the main content column.
  const parentContainer = document.querySelector('div.lc-lg\\:max-w-\\[calc\\(100\\%_-_316px\\)\\]');

  if (!parentContainer) {
    console.error('❌ Could not find the main content container to inject UI.');
    return;
  }

  // --- Create our new section ---
  const statsSection = document.createElement('div');
  // Mimic LeetCode's styling for sections.
  statsSection.className = 'mt-4';
  statsSection.innerHTML = `
    <div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
      <h2 class="text-lg font-medium text-label-1 dark:text-dark-label-1 mb-4">
        ✨ Submission Analysis
      </h2>
      <div class="h-64">
        <canvas id="cumulative-submissions-chart"></canvas>
      </div>
    </div>
  `;

  // Append our new section to the page.
  parentContainer.appendChild(statsSection);

  // --- Render the chart ---
  const canvas = document.getElementById('cumulative-submissions-chart') as HTMLCanvasElement;
  if (canvas) {
    const { labels, data } = getCumulativeSubmissions(processedData);
    createLineChart(canvas, labels, data, 'Cumulative Submissions');
  }
}
