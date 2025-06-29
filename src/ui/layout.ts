import type { ProcessedData, Difficulty, TimeRange, ClockView, CumulativeView } from '../types';
import { getCodingClockStats } from '../analysis/stats/getCodingClockStats';
import { getCumulativeStats } from '../analysis/stats/getCumulativeStats';
import { getSubmissionSignatureStats } from '../analysis/stats/getSubmissionSignatureStats'; // <-- ADD THIS
import { renderOrUpdateStackedBarChart, CodingClockChartInstance } from './components/StackedBarChart';
import { renderOrUpdateCumulativeLineChart, CumulativeLineChartInstance } from './components/CumulativeLineChart';
import { renderOrUpdateDoughnutChart, DoughnutChartInstance } from './components/DoughnutChart'; // <-- ADD THIS

// --- Constants ---
const ACTIVE_INNER_DIV_CLASSES = 'text-label-1 dark:text-dark-label-1 bg-fill-3 dark:bg-dark-fill-3'.split(' ');

// --- State Management ---
let codingClockChart: CodingClockChartInstance | undefined;
let cumulativeLineChart: CumulativeLineChartInstance | undefined;
let signatureChart: DoughnutChartInstance | undefined; // <-- ADD THIS
let currentFilters = {
    timeRange: 'All Time' as TimeRange,
    difficulty: 'All' as Difficulty,
    clockView: 'HourOfDay' as ClockView,
    cumulativeView: 'Monthly' as CumulativeView,
};

/**
 * Main function to inject and manage the tabbed stats UI.
 */
export function renderPageLayout(processedData: ProcessedData) {
  const tabBar = document.querySelector('div.lc-lg\\:max-w-\\[calc\\(100\\%_-_316px\\)\\] a[href="/submissions/"]')?.closest('div.flex.w-full');
  const contentSection = tabBar?.parentElement;
  if (!tabBar || !contentSection || document.getElementById('lc-stats-tab')) return;

  const statsTab = createStatsTab(tabBar);
  if (!statsTab) return;

  const statsPane = createStatsPaneWithGrid();
  contentSection.appendChild(statsPane);
  
  // Render all charts initially
  renderAllCharts(processedData);

  setupTabLogic(statsTab, tabBar, contentSection, statsPane);
  setupFilterListeners(processedData);
}

/**
 * A master function to render or update all charts at once.
 */
function renderAllCharts(processedData: ProcessedData) {
    renderCodingClock(processedData);
    renderCumulativeChart(processedData);
    renderSubmissionSignature(processedData); // <-- ADD THIS
}

function renderCodingClock(processedData: ProcessedData) {
    const canvas = document.getElementById('coding-clock-chart') as HTMLCanvasElement;
    if (!canvas) return;
    const chartData = getCodingClockStats(processedData, currentFilters);
    if(chartData) {
        canvas.style.display = 'block';
        codingClockChart = renderOrUpdateStackedBarChart(canvas, chartData, codingClockChart);
    } else {
        canvas.style.display = 'none';
    }
}

function renderCumulativeChart(processedData: ProcessedData) {
    const canvas = document.getElementById('cumulative-chart') as HTMLCanvasElement;
    if (!canvas) return;
    const chartData = getCumulativeStats(processedData, currentFilters);
    if (chartData) {
        canvas.style.display = 'block';
        cumulativeLineChart = renderOrUpdateCumulativeLineChart(canvas, chartData, cumulativeLineChart);
    } else {
        canvas.style.display = 'none';
    }
}

/**
 * Handles logic for rendering or updating the Submission Signature chart. // <-- ADD THIS
 */
function renderSubmissionSignature(processedData: ProcessedData) {
    const canvas = document.getElementById('submission-signature-chart') as HTMLCanvasElement;
    if (!canvas) return;
    const chartData = getSubmissionSignatureStats(processedData, currentFilters);
    if (chartData) {
        canvas.style.display = 'block';
        signatureChart = renderOrUpdateDoughnutChart(canvas, chartData, currentFilters, signatureChart);
    } else {
        canvas.style.display = 'none';
    }
}

function setupFilterListeners(processedData: ProcessedData) {
    const timeRangeSelect = document.getElementById('time-range-filter') as HTMLSelectElement;
    const difficultySelect = document.getElementById('difficulty-filter') as HTMLSelectElement;
    const clockViewToggle = document.getElementById('clock-view-toggle') as HTMLButtonElement;
    const cumulativeViewToggle = document.getElementById('cumulative-view-toggle') as HTMLDivElement;

    timeRangeSelect.addEventListener('change', () => {
        currentFilters.timeRange = timeRangeSelect.value as TimeRange;
        renderAllCharts(processedData); // <-- Use master render function
    });

    difficultySelect.addEventListener('change', () => {
        currentFilters.difficulty = difficultySelect.value as Difficulty;
        renderAllCharts(processedData); // <-- Use master render function
    });

    clockViewToggle.addEventListener('click', () => {
        currentFilters.clockView = currentFilters.clockView === 'HourOfDay' ? 'DayOfWeek' : 'HourOfDay';
        clockViewToggle.textContent = `View by ${currentFilters.clockView === 'HourOfDay' ? 'Day' : 'Hour'}`;
        renderCodingClock(processedData); // This filter is specific to one chart
    });

    cumulativeViewToggle.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        if (target.tagName !== 'BUTTON' || target.dataset.view === currentFilters.cumulativeView) return;
        currentFilters.cumulativeView = target.dataset.view as CumulativeView;
        cumulativeViewToggle.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('bg-fill-3', btn.dataset.view === currentFilters.cumulativeView);
            btn.classList.toggle('dark:bg-dark-fill-3', btn.dataset.view === currentFilters.cumulativeView);
        });
        renderCumulativeChart(processedData); // This filter is specific to one chart
    });
}

function createStatsPaneWithGrid(): HTMLElement {
    const statsPane = document.createElement('div');
    statsPane.id = 'lc-stats-pane';
    statsPane.style.display = 'none';
    statsPane.className = 'w-full';
    statsPane.innerHTML = `
    <div class="space-y-4">
      <!-- FILTERS -->
      <div class="flex items-center space-x-4 p-4 bg-layer-1 dark:bg-dark-layer-1 rounded-lg">
        <select id="time-range-filter" class="bg-layer-2 dark:bg-dark-layer-2 rounded-md p-2 text-sm text-label-1 dark:text-dark-label-1">
          <option>All Time</option>
          <option>Last 30 Days</option>
          <option>Last Year</option>
        </select>
        <select id="difficulty-filter" class="bg-layer-2 dark:bg-dark-layer-2 rounded-md p-2 text-sm text-label-1 dark:text-dark-label-1">
          <option>All</option>
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
        </select>
      </div>

      <!-- **FIX:** Changed lg:grid-cols-2 to md:grid-cols-2 for better responsiveness -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- TOP-LEFT: CODING CLOCK -->
        <div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-md font-medium text-label-1 dark:text-dark-label-1">Coding Clock</h3>
            <button id="clock-view-toggle" class="text-xs bg-layer-2 dark:bg-dark-layer-2 px-2 py-1 rounded-md text-label-2 dark:text-dark-label-2 hover:bg-fill-3 dark:hover:bg-dark-fill-3">View by Day</button>
          </div>
          <div class="relative h-80 w-full">
            <canvas id="coding-clock-chart"></canvas>
          </div>
        </div>
        
        <!-- TOP-RIGHT: CUMULATIVE PROGRESS -->
        <div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-md font-medium text-label-1 dark:text-dark-label-1">Cumulative Progress</h3>
            <div id="cumulative-view-toggle" class="flex text-xs bg-layer-2 dark:bg-dark-layer-2 p-1 rounded-md text-label-2 dark:text-dark-label-2">
                <button data-view="Daily" class="px-2 py-0.5 rounded-md">Daily</button>
                <button data-view="Monthly" class="px-2 py-0.5 rounded-md bg-fill-3 dark:bg-dark-fill-3">Monthly</button>
                <button data-view="Yearly" class="px-2 py-0.5 rounded-md">Yearly</button>
            </div>
          </div>
          <div class="relative h-80 w-full">
            <canvas id="cumulative-chart"></canvas>
          </div>
        </div>

        <!-- BOTTOM-LEFT: SUBMISSION SIGNATURE -->
        <div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
            <h3 class="text-md font-medium text-label-1 dark:text-dark-label-1 mb-4">Submission Signature</h3>
            <div class="relative h-80 w-full">
                <canvas id="submission-signature-chart"></canvas>
            </div>
        </div>

        <!-- BOTTOM-RIGHT: Empty for now -->
        <div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4 h-96"></div>
      </div>
    </div>
  `;
    return statsPane;
}

// (The rest of the helper functions: setupTabLogic, createStatsTab, etc. remain the same)
// ... all other helper functions from the previous version go here ...
function setupTabLogic(statsTab: HTMLElement, tabBar: Element, contentSection: Element, statsPane: HTMLElement) {
    const originalTabs = Array.from(tabBar.querySelectorAll('div.cursor-pointer:not(#lc-stats-tab)'));
    let lastVisibleLeetCodePane: HTMLElement | null = findVisibleLeetCodePane(contentSection, tabBar, statsPane);

    originalTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            deactivateStatsTab(statsTab);
            statsPane.style.display = 'none';
            setTimeout(() => {
                lastVisibleLeetCodePane = findVisibleLeetCodePane(contentSection, tabBar, statsPane);
            }, 50);
        });
    });

    statsTab.addEventListener('click', () => {
        originalTabs.forEach(t => deactivateOriginalTab(t));
        activateStatsTab(statsTab);
        if (lastVisibleLeetCodePane) {
            lastVisibleLeetCodePane.style.display = 'none';
        }
        statsPane.style.display = 'block';
    });
}

function createStatsTab(tabBar: Element): HTMLElement | null {
    const sampleTab = tabBar.querySelector('div.cursor-pointer:nth-child(2)');
    if (!sampleTab) return null;
    const statsTab = sampleTab.cloneNode(true) as HTMLElement;
    statsTab.id = 'lc-stats-tab';
    const textSpan = statsTab.querySelector('span:last-child');
    if (textSpan) textSpan.textContent = 'Stats';
    const iconSpan = statsTab.querySelector('span:first-child');
    if (iconSpan) iconSpan.textContent = '✨';
    const rightAlignedContainer = tabBar.querySelector('div.ml-auto, a.ml-auto');
    tabBar.insertBefore(statsTab, rightAlignedContainer);
    return statsTab;
}

function activateStatsTab(tab: HTMLElement) {
  const innerDiv = tab.querySelector('div');
  if (innerDiv) innerDiv.classList.add(...ACTIVE_INNER_DIV_CLASSES);
}

function deactivateStatsTab(tab: HTMLElement) {
  const innerDiv = tab.querySelector('div');
  if (innerDiv) innerDiv.classList.remove(...ACTIVE_INNER_DIV_CLASSES);
}

function deactivateOriginalTab(tab: Element) {
    const innerDiv = tab.querySelector('div');
    if (innerDiv) innerDiv.classList.remove(...ACTIVE_INNER_DIV_CLASSES);
}

function findVisibleLeetCodePane(contentSection: Element, tabBar: Element, statsPane: HTMLElement): HTMLElement | null {
    const children = Array.from(contentSection.children);
    for (const child of children) {
        if (child !== tabBar && child !== statsPane && (child as HTMLElement).style.display !== 'none') {
            return child as HTMLElement;
        }
    }
    return null;
}
