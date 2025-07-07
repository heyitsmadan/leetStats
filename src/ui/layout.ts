import type { ProcessedData, Difficulty, TimeRange, ClockView, CumulativeView } from '../types';
import { getCodingClockStats } from '../analysis/stats/getCodingClockStats';
import { getCumulativeStats } from '../analysis/stats/getCumulativeStats';
import { getSubmissionSignatureStats } from '../analysis/stats/getSubmissionSignatureStats'; // <-- ADD THIS
import { getLanguageStats } from '../analysis/stats/getLanguageStats'; // <-- ADD THIS
import { renderOrUpdateStackedBarChart, CodingClockChartInstance } from './components/StackedBarChart';
import { renderOrUpdateCumulativeLineChart, CumulativeLineChartInstance } from './components/CumulativeLineChart';
import { renderOrUpdateDoughnutChart, DoughnutChartInstance } from './components/DoughnutChart'; // <-- ADD THIS
import { renderOrUpdateHorizontalBarChart, HorizontalBarChartInstance } from './components/HorizontalBarChart'; // <-- ADD THIS
import { getLegacyStats } from '../analysis/stats/getLegacyStats';
import { renderOrUpdateMiniBarChart, MiniBarChartInstance } from './components/MiniBarChart';
// Add these imports at the top
import { getSkillMatrixStats } from '../analysis/stats/getSkillMatrixStats';
import { renderOrUpdateSkillMatrixHeatmap, SkillMatrixHeatmapInstance } from './components/SkillMatrixHeatmap';
import { renderOrUpdateInteractiveChart, InteractiveChartInstance } from './components/InteractiveChart';

// --- Constants ---
const ACTIVE_INNER_DIV_CLASSES = 'text-label-1 dark:text-dark-label-1 bg-fill-3 dark:bg-dark-fill-3'.split(' ');
let interactiveChart: InteractiveChartInstance | undefined;
let interactiveChartFilters = {
  primaryView: 'Submissions' as 'Submissions' | 'Problems Solved',
  secondaryView: 'Difficulty' as 'Difficulty' | 'Language' | 'Status',
  timeRange: 'All Time' as TimeRange,
  difficulty: 'All' as Difficulty,
};

// --- State Management ---
let codingClockChart: CodingClockChartInstance | undefined;
let cumulativeLineChart: CumulativeLineChartInstance | undefined;
let signatureChart: DoughnutChartInstance | undefined; // <-- ADD THIS
let languageChart: HorizontalBarChartInstance | undefined; // <-- ADD THIS
let miniBarCharts: Map<string, MiniBarChartInstance> = new Map();
let legacyStats: any = null;
let currentFilters = {
    timeRange: 'All Time' as TimeRange,
    difficulty: 'All' as Difficulty,
    clockView: 'DayOfWeek' as ClockView,
    cumulativeView: 'Monthly' as CumulativeView,
};
// Add this to your state management section
let skillMatrixHeatmap: SkillMatrixHeatmapInstance | undefined;
let skillMatrixOptions = {
  timeRange: 'All Time' as 'Last 30 Days' | 'Last 90 Days' | 'Last 365 Days' | 'All Time',
  chartView: 'Monthly' as 'Daily' | 'Monthly' | 'Yearly',
  showDifficultySplit: false,
  selectedMetric: 'acceptanceRate' as 'acceptanceRate' | 'avgTries' | 'firstAceRate'
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
  
  renderAllCharts(processedData);

  setupTabLogic(statsTab, tabBar, contentSection, statsPane);
  setupFilterListeners(processedData);
}



/**
 * A master function to render or update all charts at once.
 */
function renderAllCharts(processedData: ProcessedData) {
   renderInteractiveChart(processedData); // Add this line BEFORE 
    renderLegacySection(processedData); // Add this line
    renderCodingClock(processedData);
    renderCumulativeChart(processedData);
    renderSubmissionSignature(processedData); // <-- ADD THIS
    renderLanguageChart(processedData); // <-- ADD THIS
    renderSkillMatrix(processedData); // Add this line
    setTimeout(() => {
  legacyStats.records.forEach((record: any) => {
    if (record.subStats) {
      const canvasId = `mini-chart-${record.name.replace(/\s+/g, '-').toLowerCase()}`;
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (canvas) {
        const existingChart = miniBarCharts.get(canvasId);
        const newChart = renderOrUpdateMiniBarChart(canvas, record.subStats, existingChart);
        miniBarCharts.set(canvasId, newChart);
      }
    }
  });
}, 100);
}

// Add a new function for rendering only the filtered charts
function renderFilteredCharts(processedData: ProcessedData) {
    renderCodingClock(processedData);
    renderCumulativeChart(processedData);
    renderSubmissionSignature(processedData);
    renderLanguageChart(processedData);
    // Legacy section is NOT included here
}

function renderInteractiveChart(processedData: ProcessedData) {
  const container = document.getElementById('interactive-chart-container') as HTMLElement;
  if (!container) return;
  
  interactiveChart = renderOrUpdateInteractiveChart(
    container,
    processedData,
    interactiveChartFilters,
    interactiveChart
  );
}

function renderLegacySection(processedData: ProcessedData) {
  legacyStats = getLegacyStats(processedData);
  const legacyContainer = document.getElementById('legacy-section');
  if (!legacyContainer || !legacyStats) return;
  
  legacyContainer.innerHTML = `
    <div class="flex flex-col lg:flex-row gap-4 h-full">
      <!-- Left Half: Milestones -->
      <div class="flex-1 rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
        <h3 class="text-lg font-medium text-label-1 dark:text-dark-label-1 mb-4">Milestones</h3>
        <div class="relative">
          <!-- Timeline line -->
          <div class="absolute left-3 top-0 bottom-0 w-0.5 bg-fill-3 dark:bg-dark-fill-3"></div>
          <div class="space-y-4">
            ${legacyStats.milestones.map((milestone: any) => `
              <div class="relative flex items-center">
                <!-- Timeline dot -->
                <div class="absolute left-0 w-6 h-6 bg-green-500 rounded-full border-4 border-layer-1 dark:border-dark-layer-1 flex items-center justify-center">
                  <div class="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <!-- Content -->
                <div class="ml-10">
                  <div class="text-sm font-medium text-label-1 dark:text-dark-label-1">
                    ${milestone.milestone}${getOrdinalSuffix(milestone.milestone)} ${formatMilestoneType(milestone.type)}
                  </div>
                  <div class="text-xs text-label-2 dark:text-dark-label-2">
                    ${milestone.date.toLocaleDateString('en-GB')}
                  </div>
                  ${milestone.problemTitle ? `
                    <a href="https://leetcode.com/problems/${milestone.problemSlug}/" 
                       class="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300">
                      ${milestone.problemTitle}
                    </a>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      
      
<!-- Right Half -->
<div class="flex-1 flex flex-col gap-4">
  <!-- Trophy Room - takes as much space as it needs -->
  <div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
    <h3 class="text-lg font-medium text-label-1 dark:text-dark-label-1 mb-4">Trophy Room</h3>
    <div class="space-y-3">
      ${legacyStats.trophies.map((trophy: any) => `
        <div class="flex items-center space-x-3 p-3 rounded-md bg-fill-3 dark:bg-dark-fill-3">
          <span class="text-2xl">${trophy.icon}</span>
          <div class="flex-1">
            <div class="font-medium text-label-1 dark:text-dark-label-1">${trophy.title}</div>
            <div class="text-sm text-label-2 dark:text-dark-label-2">${trophy.subtitle}</div>
            <a href="https://leetcode.com/problems/${trophy.problemSlug}/" 
               class="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300">
              ${trophy.problemTitle}
            </a>
            ${trophy.personalNote ? `
              <div class="text-xs italic text-label-3 dark:text-dark-label-3 mt-1">
                ${trophy.personalNote}
              </div>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  
<!-- Records - takes remaining space -->
<div class="flex-1 rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
  <h3 class="text-lg font-medium text-label-1 dark:text-dark-label-1 mb-4">Records</h3>
  <div class="space-y-2">
    ${legacyStats.records.filter((record: any) => !record.isHighlight).map((record: any) => `
      <div class="flex justify-between items-center p-2 rounded-md">
        <span class="text-sm text-label-1 dark:text-dark-label-1">${record.name}</span>
        <div class="text-right flex items-center">
          <span class="text-sm font-medium text-label-1 dark:text-dark-label-1">${record.value}</span>
          ${record.subStats ? `
            <div class="ml-2 w-12 h-6">
              <canvas id="mini-chart-${record.name.replace(/\s+/g, '-').toLowerCase()}" width="48" height="24"></canvas>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('')}
    
    <!-- Best periods section with single border -->
    <div class="border border-yellow-500/30 bg-yellow-500/10 rounded-md p-3 mt-4">
      <div class="text-sm font-medium text-label-1 dark:text-dark-label-1 mb-2">Best Periods</div>
      <div class="space-y-2">
        ${legacyStats.records.filter((record: any) => record.isHighlight).map((record: any) => `
          <div class="flex justify-between items-center">
            <span class="text-sm text-label-1 dark:text-dark-label-1">${record.name}</span>
            <span class="text-sm font-medium text-label-1 dark:text-dark-label-1">${record.value}</span>
          </div>
        `).join('')}
      </div>
    </div>
  </div>
</div>


  `;
}

function getOrdinalSuffix(num: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const value = num % 100;
  return suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0];
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

function renderLanguageChart(processedData: ProcessedData) {
    const canvas = document.getElementById('language-stats-chart') as HTMLCanvasElement;
    if (!canvas) return;
    const chartData = getLanguageStats(processedData, currentFilters);
    if (chartData) {
        canvas.style.display = 'block';
        languageChart = renderOrUpdateHorizontalBarChart(canvas, chartData, currentFilters, languageChart);
    } else {
        canvas.style.display = 'none';
    }
}

// Add this function to render the skill matrix
function renderSkillMatrix(processedData: ProcessedData) {
  const container = document.getElementById('skill-matrix-container') as HTMLElement;
  if (!container) return;
  
  const skillMatrixData = getSkillMatrixStats(processedData, currentFilters, skillMatrixOptions.timeRange );
  if (skillMatrixData) {
    container.style.display = 'block';
    skillMatrixHeatmap = renderOrUpdateSkillMatrixHeatmap(
      container, 
      skillMatrixData, 
      skillMatrixOptions, 
      skillMatrixHeatmap
    );
  } else {
    container.style.display = 'none';
  }
}


function setupFilterListeners(processedData: ProcessedData) {
    const timeRangeSelect = document.getElementById('time-range-filter') as HTMLSelectElement;
    const difficultySelect = document.getElementById('difficulty-filter') as HTMLSelectElement;
    const cumulativeViewToggle = document.getElementById('cumulative-view-toggle') as HTMLDivElement;

    timeRangeSelect.addEventListener('change', () => {
        currentFilters.timeRange = timeRangeSelect.value as TimeRange;
        renderFilteredCharts(processedData);
    });

    difficultySelect.addEventListener('change', () => {
        currentFilters.difficulty = difficultySelect.value as Difficulty;
        renderFilteredCharts(processedData);
    });

    // NEW: Two-button toggle logic
    const dayViewBtn = document.getElementById('day-view-btn') as HTMLButtonElement;
    const hourViewBtn = document.getElementById('hour-view-btn') as HTMLButtonElement;
    // NEW: Day View button click handler
    dayViewBtn.addEventListener('click', () => {
        if (currentFilters.clockView !== 'DayOfWeek') {
            currentFilters.clockView = 'DayOfWeek';
            
            // Update button states
            dayViewBtn.setAttribute('data-state', 'active');
            hourViewBtn.setAttribute('data-state', 'inactive');
            
            renderCodingClock(processedData);
        }
    });

    // NEW: Hour View button click handler
    hourViewBtn.addEventListener('click', () => {
        if (currentFilters.clockView !== 'HourOfDay') {
            currentFilters.clockView = 'HourOfDay';
            
            // Update button states
            hourViewBtn.setAttribute('data-state', 'active');
            dayViewBtn.setAttribute('data-state', 'inactive');
            
            renderCodingClock(processedData);
        }
    });

    
    // NEW: Three-button toggle logic for cumulative view
    const dailyViewBtn = document.getElementById('daily-view-btn') as HTMLButtonElement;
    const monthlyViewBtn = document.getElementById('monthly-view-btn') as HTMLButtonElement;
    const yearlyViewBtn = document.getElementById('yearly-view-btn') as HTMLButtonElement;

    // Daily button click handler
    dailyViewBtn.addEventListener('click', () => {
        if (currentFilters.cumulativeView !== 'Daily') {
            currentFilters.cumulativeView = 'Daily';
            
            // Update button states
            dailyViewBtn.setAttribute('data-state', 'active');
            monthlyViewBtn.setAttribute('data-state', 'inactive');
            yearlyViewBtn.setAttribute('data-state', 'inactive');
            
            renderCumulativeChart(processedData);
        }
    });

    // Monthly button click handler
    monthlyViewBtn.addEventListener('click', () => {
        if (currentFilters.cumulativeView !== 'Monthly') {
            currentFilters.cumulativeView = 'Monthly';
            
            // Update button states
            monthlyViewBtn.setAttribute('data-state', 'active');
            dailyViewBtn.setAttribute('data-state', 'inactive');
            yearlyViewBtn.setAttribute('data-state', 'inactive');
            
            renderCumulativeChart(processedData);
        }
    });

    // Yearly button click handler
    yearlyViewBtn.addEventListener('click', () => {
        if (currentFilters.cumulativeView !== 'Yearly') {
            currentFilters.cumulativeView = 'Yearly';
            
            // Update button states
            yearlyViewBtn.setAttribute('data-state', 'active');
            dailyViewBtn.setAttribute('data-state', 'inactive');
            monthlyViewBtn.setAttribute('data-state', 'inactive');
            
            renderCumulativeChart(processedData);
        }
    });


    
  //   const skillMatrixContainer = document.getElementById('skill-matrix-container');
  // skillMatrixContainer?.addEventListener('skillMatrixUpdate', (e: any) => {
  //   Object.assign(skillMatrixOptions, e.detail);
  //   renderSkillMatrix(processedData);
  // });

  // Add skill matrix global time filter listener
    const skillMatrixTimeFilter = document.getElementById('skill-matrix-time-filter') as HTMLSelectElement;
    skillMatrixTimeFilter?.addEventListener('change', () => {
        skillMatrixOptions.timeRange = skillMatrixTimeFilter.value as 'Last 30 Days' | 'Last 90 Days' | 'Last 365 Days' | 'All Time';
        renderSkillMatrix(processedData);
    });

    }

function createStatsPaneWithGrid(): HTMLElement {
    const statsPane = document.createElement('div');
    statsPane.id = 'lc-stats-pane';
    statsPane.style.display = 'none';
    statsPane.className = 'w-full';
    statsPane.innerHTML = `
    <div class="space-y-4">
    <!-- INTERACTIVE CHART SECTION - Add this BEFORE the legacy section -->
      <div class="rounded-lg bg-layer-2 dark:bg-dark-layer-2 p-4">
        <h2 class="text-xl font-bold text-label-1 dark:text-dark-label-1 mb-4">DNA Strand</h2>
        <div id="interactive-chart-container"></div>
      </div>
       <!-- YOUR LEGACY SECTION -->
      <div class="rounded-lg bg-layer-2 dark:bg-dark-layer-2 p-4">
        <h2 class="text-xl font-bold text-label-1 dark:text-dark-label-1 mb-4">Your Legacy</h2>
        <div id="legacy-section" class="min-h-96"></div>
      </div>

      <!-- FILTERS -->
      <div class="flex items-center space-x-4 p-4 bg-layer-1 dark:bg-dark-layer-1 rounded-lg">
        <select id="time-range-filter" class="bg-layer-2 dark:bg-dark-layer-2 rounded-md p-2 text-sm text-label-1 dark:text-dark-label-1">
    <option>All Time</option>
    <option>Last 30 Days</option>
    <option>Last 90 Days</option>
    <option>Last 365 Days</option>
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
            <!-- **UPDATED:** Heading color -->
            <h3 class="text-md font-medium" style="color: #f9ffff;">Coding Clock</h3>
            <!-- **UPDATED:** Button text for default day view -->
            <!-- NEW: Two-button toggle -->
<div class="text-sd-muted-foreground inline-flex items-center justify-center bg-sd-muted rounded-full p-[1px]">
  <button id="day-view-btn" 
          data-state="active"
          class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">
    Day View
  </button>
  <button id="hour-view-btn" 
          data-state="inactive"
          class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">
    Hour View
  </button>
</div>
          </div>
          <div class="relative h-80 w-full">
            <canvas id="coding-clock-chart"></canvas>
          </div>
        </div>
        
        <!-- TOP-RIGHT: CUMULATIVE PROGRESS -->
<div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
  <div class="flex justify-between items-center mb-4">
    <h3 class="text-md font-medium text-label-1 dark:text-dark-label-1">Cumulative Progress</h3>
    <!-- NEW: Three-button toggle with same design as coding clock -->
    <div class="text-sd-muted-foreground inline-flex items-center justify-center bg-sd-muted rounded-full p-[1px]">
      <button id="daily-view-btn" 
              data-view="Daily"
              data-state="inactive"
              class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">
        Daily
      </button>
      <button id="monthly-view-btn" 
              data-view="Monthly"
              data-state="active"
              class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">
        Monthly
      </button>
      <button id="yearly-view-btn" 
              data-view="Yearly"
              data-state="inactive"
              class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">
        Yearly
      </button>
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

        <!-- BOTTOM-RIGHT: LANGUAGE STATS -->
        <div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
            <h3 class="text-md font-medium text-label-1 dark:text-dark-label-1 mb-4">Language Stats</h3>
            <div class="relative h-80 w-full">
                <canvas id="language-stats-chart"></canvas>
            </div>
        </div>
      </div>
      <div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
  <div class="flex justify-between items-center mb-4">
    <h3 class="text-lg font-medium text-label-1 dark:text-dark-label-1">Skill Matrix</h3>
    <select id="skill-matrix-time-filter" class="bg-layer-2 dark:bg-dark-layer-2 rounded-md p-2 text-sm text-label-1 dark:text-dark-label-1 border border-divider-3 dark:border-dark-divider-3">
      <option value="All Time">All Time</option>
      <option value="Last 365 Days">Last 365 Days</option>
      <option value="Last 90 Days">Last 90 Days</option>
      <option value="Last 30 Days">Last 30 Days</option>
    </select>
  </div>
      <!-- SKILL MATRIX SECTION -->
      <div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
        <div id="skill-matrix-container"></div>
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

// Add this helper function to layout.ts
function formatMilestoneType(type: string): string {
  const typeMap: { [key: string]: string } = {
    'problems_solved': 'Problem',
    'submissions': 'Submission',
    'easy': 'Easy',
    'medium': 'Medium',
    'hard': 'Hard'
  };
  
  return typeMap[type] || type;
}