import { colors } from '../ui/theme/colors';
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
// Add to very top of layout.ts
declare global {
  interface Window {
    statsRendered?: boolean;
  }
}
const styles = {
  // === Structural Headers ===
  sectionHeader: "text-2xl font-semibold text-gray-100", // Added margin-bottom for spacing
  subSectionHeader: "text-xl font-medium text-gray-300", // Made larger (xl) and distinct from content

  // === Milestone Styles ===
  milestoneEvent: "text-base font-semibold text-gray-200", // Brightest text for the title
  milestoneDate: "text-sm text-gray-400 dark:text-dark-label-2", // Secondary info
  milestoneProblem: "text-sm text-gray-500 hover:underline", // Can be a problem name or a mono ID

  // === Trophy Card Styles (to be used with new design below) ===
  trophyName: "text-base font-semibold text-gray-200", // Unchanged, as requested.
trophyProblem: "text-sm text-sky-400 hover:underline", // The problem link remains a prominent secondary element.
trophyDescription: "text-[13px] text-gray-400", // **Crucial Change**: Made smaller (xs) and a standard gray.
trophyPersonalNote: "text-xs italic text-gray-500 dark:text-dark-label-2", // Muted, tertiary text

  // === Records Section Styles (to be used with new design below) ===
  recordLabel: "text-base font-medium text-gray-300",
  recordValue: "text-base font-semibold text-gray-100", // For the main number/stat
  recordContext: "text-sm text-gray-400", // For the date/context text

  // === Skill Matrix ===
  skillMatrixColumnHeader: "text-xs font-semibold uppercase tracking-wider text-gray-400",
  skillMatrixRowLabel: "text-base font-medium text-gray-300",
  skillMatrixCellValue: "text-base text-gray-200",
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
    // *** CHANGE: Set a temporary default. This will be corrected on load. ***
    cumulativeView: 'Daily' as CumulativeView, 
};
// Add this to your state management section
let skillMatrixHeatmap: SkillMatrixHeatmapInstance | undefined;
let skillMatrixOptions = {
  timeRange: 'All Time' as 'Last 30 Days' | 'Last 90 Days' | 'Last 365 Days' | 'All Time',
  chartView: 'Monthly' as 'Daily' | 'Monthly' | 'Yearly',
  showDifficultySplit: false,
  selectedMetric: 'problemsSolved' as 'problemsSolved' | 'avgTries' | 'firstAceRate'
};

/**
 * Main function to inject and manage the tabbed stats UI.
 */
// Add at top of file
const MAX_RETRIES = 5;
const RETRY_DELAY = 300;

/** Main function to inject stats UI */
export function renderPageLayout(processedData: ProcessedData) {
  // 1. Find the main container (A)
  const contentContainer = document.querySelector('.space-y-\\[18px\\]') || 
                          document.querySelector('[class*="space-y-["]');
  
  if (!contentContainer) {
    console.error('Content container not found');
    return;
  }

  // 2. Create and insert stats tab immediately
  const tabBar = contentContainer.firstElementChild as HTMLElement;
  if (!tabBar || !tabBar.classList.contains('flex')) {
    console.error('Tab bar not found');
    return;
  }

  const statsTab = createStatsTab();
  const discussTab = Array.from(tabBar.children).find(el => 
    el.textContent?.includes('Discuss')
  );
  
  if (discussTab) {
    discussTab.after(statsTab);
  } else {
    tabBar.append(statsTab);
  }

  // 3. Create stats content pane
  const statsPane = createStatsPaneWithGrid();
  contentContainer.append(statsPane);
  statsPane.style.display = 'none'; // Start hidden

  // 4. Setup content observer
  let contentObserver: MutationObserver | null = null;
  
  const startContentObservation = () => {
    // Clean up any existing observer
    if (contentObserver) contentObserver.disconnect();
    
    contentObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check if LeetCode content pane exists
        const leetcodeContent = Array.from(contentContainer.children).find(
          child => child !== tabBar && child !== statsPane
        );
        
        if (leetcodeContent) {
          // Initialize tab logic now that content exists
          setupTabLogic(statsTab, tabBar, contentContainer, statsPane, processedData);
          contentObserver?.disconnect();
          contentObserver = null;
          return;
        }
      }
    });
    
    // Observe for child additions
    contentObserver.observe(contentContainer, {
      childList: true,
      subtree: false
    });
    
    // Set timeout as fallback
    setTimeout(() => {
      if (contentObserver) {
        console.warn('Content not detected, forcing setup');
        setupTabLogic(statsTab, tabBar, contentContainer, statsPane, processedData);
        contentObserver.disconnect();
        contentObserver = null;
      }
    }, 5000);
  };

  // 5. Check if content already exists
  const initialContent = Array.from(contentContainer.children).find(
    child => child !== tabBar && child !== statsPane
  );
  
  if (initialContent) {
    setupTabLogic(statsTab, tabBar, contentContainer, statsPane, processedData);
    // First-time chart rendering
    if (!window.statsRendered) {
      requestAnimationFrame(() => {
        renderAllCharts(processedData);
        window.statsRendered = true;
      });
    }
  } else {
    console.log('Waiting for LeetCode content to load...');
    startContentObservation();
  }
}



/**
 * A master function to render or update all charts at once.
 */
function renderAllCharts(processedData: ProcessedData) {
    currentFilters.cumulativeView = getSmartCumulativeView(currentFilters.timeRange, processedData);
    renderInteractiveChart(processedData); // Add this line BEFORE 
    renderLegacySection(processedData); // Add this line
    renderCodingClock(processedData);
    renderCumulativeChart(processedData);
    renderSubmissionSignature(processedData); // <-- ADD THIS
    renderLanguageChart(processedData); // <-- ADD THIS
    renderSkillMatrix(processedData); // Add this line
    setupFilterListeners(processedData);
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
  <div class="${styles.sectionHeader}">Legacy</div>
    <div class="flex flex-col lg:flex-row gap-4 h-full">
      <!-- Left Half: Milestones -->
      <div class="flex-1 rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
        <div class="${styles.subSectionHeader}">Milestones</div>
        <div class="mt-4 relative">
          <!-- Timeline line -->
          <div class="absolute left-3 top-0 bottom-0 w-0.5 bg-fill-3 dark:bg-dark-fill-3"></div>
          <div class="space-y-4">
            
${legacyStats.milestones.map((milestone: any, index: number) => {
    const milestoneColor = getMilestoneColor(milestone.type);
    
    // Each item is a simple relative container.
    // The spacing is now determined by the natural height of the content.
    return `
      <div class="relative">

        <!-- Timeline Dot: Made smaller with w-2.5 and h-2.5. -->
        <div class="absolute left-3 top-2 w-2.5 h-2.5 transform -translate-x-1/2 rounded-full" style="background-color: ${milestoneColor}"></div>
        
        <!-- Content -->
        <!-- "ml-10" (margin-left) gives the content space so it doesn't overlap the timeline line and dot. -->
        <div class="ml-10">
          <div class="${styles.milestoneEvent}" style="color: ${milestoneColor}">
            ${milestone.milestone}${getOrdinalSuffix(milestone.milestone)} ${formatMilestoneType(milestone.type)}
          </div>
          <div class="${styles.milestoneDate}">
            ${milestone.date.toLocaleDateString('en-GB')}
          </div>
          ${milestone.type === 'submissions' ? `
            <a href="https://leetcode.com/submissions/detail/${milestone.submissionId || milestone.id}/" 
               class="inline-flex items-center gap-1 ${styles.milestoneProblem}" target="_blank" rel="noopener noreferrer">
              Submission #${milestone.submissionId || milestone.id}
            </a>
          ` : milestone.problemTitle ? `
            <a href="https://leetcode.com/problems/${milestone.problemSlug}/" 
               class="inline-flex items-center gap-1 ${styles.milestoneProblem}" target="_blank" rel="noopener noreferrer">
              ${milestone.problemTitle}
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }).join('')}
          </div>
        </div>
</div>
      
      
<!-- Right Half -->
<div class="flex-1 flex flex-col gap-4">
<div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
  <div class="${styles.subSectionHeader}">Trophies</div>
  <div class="mt-4 space-y-3">
    ${legacyStats.trophies.map((trophy: any) => `
      <div class="flex items-center space-x-4 p-3 rounded-lg bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.06)]">
    <span class="text-2xl flex-shrink-0 pt-0.5">${trophy.icon}</span>

    <div class="flex-1 flex flex-col space-y-1">
        <div class="${styles.trophyName}">
            ${trophy.title}
        </div>
        <div class="border-divider-3 dark:border-dark-divider-3 mb-4 mt-4 h-px w-full border-b"></div>
        <a href="https://leetcode.com/problems/${trophy.problemSlug}/" class="${styles.trophyProblem}" target="_blank" rel="noopener noreferrer">
            ${trophy.problemTitle}
        </a>
        
        <div class="${styles.trophyDescription} pt-1"> ${trophy.subtitle}
        </div>

        ${trophy.personalNote ? `
            <div class="${styles.trophyPersonalNote} pt-1.5"> ${trophy.personalNote}
            </div>
        ` : ''}
    </div>
</div>
    `).join('')}
  </div>
</div>

  
<!-- Records - takes remaining space -->
<!-- Records - takes remaining space -->
<div class="flex-1 rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
  <div class="${styles.subSectionHeader}">Records</div>
  <div class="mt-4 space-y-2">
    ${legacyStats.records.map((record: any) => `
      <div class="flex justify-between items-center p-2 rounded-md">
        <span class="${styles.milestoneEvent}">${record.name}</span>
        <div class="text-right flex items-center">
          ${record.value !== undefined ? `
            <span class="text-sm font-medium text-label-1 dark:text-dark-label-1">${record.value}</span>
            ${record.subStats ? `
              <div class="ml-2 w-12 h-6">
                <canvas id="mini-chart-${record.name.replace(/\s+/g, '-').toLowerCase()}" width="48" height="24"></canvas>
              </div>
            ` : ''}
          ` : `
            <div class="flex flex-col items-end">
              <span class="${styles.milestoneEvent}">${record.mainStat}</span>
              <span class="${styles.milestoneDate}">${record.dateStat}</span>
            </div>
          `}
        </div>
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
    // FIX: Ensure the canvas and its parent element exist
    if (!canvas || !canvas.parentElement) return; 
    
    const chartData = getCodingClockStats(processedData, currentFilters);
    if(chartData) {
        canvas.parentElement.style.display = 'block';
        // FIX: Pass the parent container, not the canvas itself
        codingClockChart = renderOrUpdateStackedBarChart(canvas.parentElement, chartData, codingClockChart);
    } else {
        canvas.parentElement.style.display = 'none';
    }
}

function renderCumulativeChart(processedData: ProcessedData) {
    const canvas = document.getElementById('cumulative-chart') as HTMLCanvasElement;
    if (!canvas || !canvas.parentElement) return;

    const chartData = getCumulativeStats(processedData, currentFilters);
    
    if (chartData && chartData.labels.length > 0) {
        canvas.parentElement.style.display = 'block';
        
        // *** FIX: Pass the full filters object to the render function ***
        // This gives the chart component all the context it needs for hover and labels.
        cumulativeLineChart = renderOrUpdateCumulativeLineChart(
            canvas.parentElement, 
            chartData, 
            {
                difficulty: currentFilters.difficulty,
                cumulativeView: currentFilters.cumulativeView,
                timeRange: currentFilters.timeRange,
            },
            cumulativeLineChart
        );
    } else {
        canvas.parentElement.style.display = 'none';
    }
}

/**
 * Handles logic for rendering or updating the Submission Signature chart. // <-- ADD THIS
 */
function renderSubmissionSignature(processedData: ProcessedData) {
    const canvas = document.getElementById('submission-signature-chart') as HTMLCanvasElement;
    // FIX: Ensure the canvas and its parent element exist
    if (!canvas || !canvas.parentElement) return;

    const chartData = getSubmissionSignatureStats(processedData, currentFilters);
    if (chartData) {
        canvas.parentElement.style.display = 'block';
        // FIX: Pass the parent container, not the canvas itself
        signatureChart = renderOrUpdateDoughnutChart(canvas.parentElement, chartData, currentFilters, signatureChart);
    } else {
        canvas.parentElement.style.display = 'none';
    }
}

function renderLanguageChart(processedData: ProcessedData) {
    const canvas = document.getElementById('language-stats-chart') as HTMLCanvasElement;
    // FIX: Ensure the canvas and its parent element exist
    if (!canvas || !canvas.parentElement) return;

    const chartData = getLanguageStats(processedData, currentFilters);
    if (chartData) {
        canvas.parentElement.style.display = 'block';
        // FIX: Pass the parent container, not the canvas itself
        languageChart = renderOrUpdateHorizontalBarChart(canvas.parentElement, chartData, currentFilters, languageChart);
    } else {
        canvas.parentElement.style.display = 'none';
    }
}

// Add this function to render the skill matrix
function renderSkillMatrix(processedData: ProcessedData) {
  const container = document.getElementById('skill-matrix-container') as HTMLElement;
  if (!container) return;
  
  // FIX: Pass a modified filter object to getSkillMatrixStats.
  // This creates a copy of the main filters but forces 'difficulty' to 'All'.
  // This prevents the main difficulty dropdown from affecting the skill matrix.
  // The skill matrix's own time range (from skillMatrixOptions.timeRange) is
  // passed as the third argument and is expected to be used for filtering time.
  const skillMatrixData = getSkillMatrixStats(
    processedData,
    { ...currentFilters, difficulty: 'All' },
    skillMatrixOptions.timeRange
  );

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
  // Time Range Dropdown Logic
    const timeRangeBtn = document.getElementById('time-range-dropdown-btn') as HTMLButtonElement;
    const timeRangeOptions = document.getElementById('time-range-dropdown-options') as HTMLDivElement;
    const timeRangeOptionElements = timeRangeOptions?.querySelectorAll('[data-value]');

    timeRangeBtn?.addEventListener('click', () => {
        const isOpen = timeRangeOptions.classList.contains('hidden');
        if (isOpen) {
            timeRangeOptions.classList.remove('hidden');
            timeRangeBtn.setAttribute('aria-expanded', 'true');
        } else {
            timeRangeOptions.classList.add('hidden');
            timeRangeBtn.setAttribute('aria-expanded', 'false');
        }
    });

    timeRangeOptionElements?.forEach(option => {
        option.addEventListener('click', () => {
            const value = option.getAttribute('data-value') as TimeRange;
            currentFilters.timeRange = value;
            
            // *** CHANGE: Replace previous logic with this new block ***
            // --- Point 5: Set Default Cumulative View based on Time Range ---
            const smartView = getSmartCumulativeView(value, processedData);
            currentFilters.cumulativeView = smartView;
            updateCumulativeViewToggle(smartView);

            // Update the dropdown button text
            const btnText = timeRangeBtn.querySelector('span');
            if(btnText) btnText.textContent = value;

            // Re-render all charts with the new filters
            renderFilteredCharts(processedData);
            timeRangeOptions.classList.add('hidden'); // Hide dropdown
        });
    });

    // Difficulty Dropdown Logic
    const difficultyBtn = document.getElementById('difficulty-dropdown-btn') as HTMLButtonElement;
    const difficultyOptions = document.getElementById('difficulty-dropdown-options') as HTMLDivElement;
    const difficultyOptionElements = difficultyOptions?.querySelectorAll('[data-value]');

    difficultyBtn?.addEventListener('click', () => {
        const isOpen = difficultyOptions.classList.contains('hidden');
        if (isOpen) {
            difficultyOptions.classList.remove('hidden');
            difficultyBtn.setAttribute('aria-expanded', 'true');
        } else {
            difficultyOptions.classList.add('hidden');
            difficultyBtn.setAttribute('aria-expanded', 'false');
        }
    });

    difficultyOptionElements?.forEach(option => {
        option.addEventListener('click', () => {
            const value = option.getAttribute('data-value') as Difficulty;
            const span = difficultyBtn.querySelector('span');
            if (span) span.textContent = value;
            
            currentFilters.difficulty = value;
            difficultyOptions.classList.add('hidden');
            difficultyBtn.setAttribute('aria-expanded', 'false');
            
            // Update visual selection
            difficultyOptionElements.forEach(opt => {
                opt.classList.remove('bg-fill-3', 'dark:bg-dark-fill-3', 'font-medium');
            });
            option.classList.add('bg-fill-3', 'dark:bg-dark-fill-3', 'font-medium');
            
            renderFilteredCharts(processedData);
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        if (!timeRangeBtn?.contains(target) && !timeRangeOptions?.contains(target)) {
            timeRangeOptions?.classList.add('hidden');
            timeRangeBtn?.setAttribute('aria-expanded', 'false');
        }
        if (!difficultyBtn?.contains(target) && !difficultyOptions?.contains(target)) {
            difficultyOptions?.classList.add('hidden');
            difficultyBtn?.setAttribute('aria-expanded', 'false');
        }
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

    
    // Cumulative View Toggle Logic
    const dailyViewBtn = document.getElementById('daily-view-btn') as HTMLButtonElement;
    const monthlyViewBtn = document.getElementById('monthly-view-btn') as HTMLButtonElement;
    const yearlyViewBtn = document.getElementById('yearly-view-btn') as HTMLButtonElement;

    // *** CHANGE: Simplify the toggle button event listeners ***
    const handleToggleClick = (view: CumulativeView) => {
        if (currentFilters.cumulativeView !== view) {
            currentFilters.cumulativeView = view;
            updateCumulativeViewToggle(view);
            renderCumulativeChart(processedData); // Re-render only this chart
        }
    };

    dailyViewBtn.addEventListener('click', () => handleToggleClick('Daily'));
    monthlyViewBtn.addEventListener('click', () => handleToggleClick('Monthly'));
    yearlyViewBtn.addEventListener('click', () => handleToggleClick('Yearly'));
    
    // Set initial toggle state on load
    updateCumulativeViewToggle(currentFilters.cumulativeView);

// Add skill matrix dropdown logic
const skillMatrixBtn = document.getElementById('skill-matrix-time-filter-btn') as HTMLButtonElement;
const skillMatrixDropdown = document.getElementById('skill-matrix-time-filter-options') as HTMLDivElement; // ✅ Renamed
const skillMatrixOptionElements = skillMatrixDropdown?.querySelectorAll('[data-value]'); // ✅ Updated reference

skillMatrixBtn?.addEventListener('click', () => {
    const isOpen = skillMatrixDropdown.classList.contains('hidden'); // ✅ Updated reference
    if (isOpen) {
        skillMatrixDropdown.classList.remove('hidden'); // ✅ Updated reference
        skillMatrixBtn.setAttribute('aria-expanded', 'true');
    } else {
        skillMatrixDropdown.classList.add('hidden'); // ✅ Updated reference
        skillMatrixBtn.setAttribute('aria-expanded', 'false');
    }
});

skillMatrixOptionElements?.forEach(option => {
    option.addEventListener('click', () => {
        const value = option.getAttribute('data-value') as 'Last 30 Days' | 'Last 90 Days' | 'Last 365 Days' | 'All Time';
        const span = skillMatrixBtn.querySelector('span');
        if (span) span.textContent = value;
        
        skillMatrixOptions.timeRange = value; // ✅ Now refers to the state object
        skillMatrixDropdown.classList.add('hidden'); // ✅ Updated reference
        skillMatrixBtn.setAttribute('aria-expanded', 'false');
        
        // Update visual selection
        skillMatrixOptionElements.forEach(opt => {
            const checkIcon = opt.querySelector('span');
            if (checkIcon) {
                checkIcon.classList.toggle('visible', opt === option);
                checkIcon.classList.toggle('invisible', opt !== option);
            }
            opt.classList.toggle('bg-fill-3', opt === option);
            opt.classList.toggle('dark:bg-dark-fill-3', opt === option);
            opt.classList.toggle('font-medium', opt === option);
        });
        
        renderSkillMatrix(processedData);
    });
});

// Close skill matrix dropdown when clicking outside
document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (!skillMatrixBtn?.contains(target) && !skillMatrixDropdown?.contains(target)) { // ✅ Updated reference
        skillMatrixDropdown?.classList.add('hidden'); // ✅ Updated reference
        skillMatrixBtn?.setAttribute('aria-expanded', 'false');
    }
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
      <div class="rounded-lg p-4">
        <div class="${styles.sectionHeader}">History</div>
        <div class="mt-4" id="interactive-chart-container"></div>
      </div>
      <div class="border-divider-3 dark:border-dark-divider-3 mb-4 mt-4 h-px w-full border-b"></div>
       <!-- YOUR LEGACY SECTION -->
      <div class="rounded-lg p-4">
        <div id="legacy-section" class="min-h-96"></div>
      </div>
<div class="border-divider-3 dark:border-dark-divider-3 mb-4 mt-4 h-px w-full border-b"></div>
<!-- FILTERS -->
<!-- HEADER + FILTERS -->
<div class="flex items-center justify-between p-4 bg-layer-1 dark:bg-dark-layer-1 rounded-lg">
  <!-- Left Header -->
  <h2 class="${styles.sectionHeader}">Activity</h2>

  <!-- FILTERS -->
  <div class="flex items-center space-x-4">
    <!-- Time Range Dropdown -->
    <div class="relative" data-headlessui-state>
      <button id="time-range-dropdown-btn" class="flex cursor-pointer items-center rounded px-3 py-1.5 text-left focus:outline-none whitespace-nowrap bg-fill-3 dark:bg-dark-fill-3 text-label-2 dark:text-dark-label-2 hover:bg-fill-2 dark:hover:bg-dark-fill-2 active:bg-fill-3 dark:active:bg-dark-fill-3 w-40" type="button" aria-haspopup="listbox" aria-expanded="false" data-headlessui-state>
        <span class="whitespace-nowrap flex-1 pr-2">All Time</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="pointer-events-none flex-shrink-0 w-4 h-4" aria-hidden="true">
          <path fill-rule="evenodd" d="M4.929 7.913l7.078 7.057 7.064-7.057a1 1 0 111.414 1.414l-7.77 7.764a1 1 0 01-1.415 0L3.515 9.328a1 1 0 011.414-1.414z" clip-rule="evenodd"></path>
        </svg>
      </button>
      <div id="time-range-dropdown-options" class="hidden z-dropdown absolute max-h-56 overflow-auto rounded-lg p-2 focus:outline-none bg-overlay-3 dark:bg-dark-overlay-3 right-0 mt-2 shadow-level3 dark:shadow-dark-level3 w-40" role="listbox" tabindex="0" data-headlessui-state>
        <div class="relative flex h-8 cursor-pointer select-none py-1.5 pl-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1 rounded bg-fill-3 dark:bg-dark-fill-3" data-value="All Time" role="option" tabindex="-1">
          <div class="flex h-5 flex-1 items-center pr-2 font-medium">
            <div class="whitespace-nowrap">All Time</div>
          </div>
        </div>
        <div class="relative flex h-8 cursor-pointer select-none py-1.5 pl-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1" data-value="Last 30 Days" role="option" tabindex="-1">
          <div class="flex h-5 flex-1 items-center pr-2">
            <div class="whitespace-nowrap">Last 30 Days</div>
          </div>
        </div>
        <div class="relative flex h-8 cursor-pointer select-none py-1.5 pl-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1" data-value="Last 90 Days" role="option" tabindex="-1">
          <div class="flex h-5 flex-1 items-center pr-2">
            <div class="whitespace-nowrap">Last 90 Days</div>
          </div>
        </div>
        <div class="relative flex h-8 cursor-pointer select-none py-1.5 pl-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1" data-value="Last 365 Days" role="option" tabindex="-1">
          <div class="flex h-5 flex-1 items-center pr-2">
            <div class="whitespace-nowrap">Last 365 Days</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Difficulty Dropdown -->
    <div class="relative" data-headlessui-state>
      <button id="difficulty-dropdown-btn" class="flex cursor-pointer items-center rounded px-3 py-1.5 text-left focus:outline-none whitespace-nowrap bg-fill-3 dark:bg-dark-fill-3 text-label-2 dark:text-dark-label-2 hover:bg-fill-2 dark:hover:bg-dark-fill-2 active:bg-fill-3 dark:active:bg-dark-fill-3 w-24" type="button" aria-haspopup="listbox" aria-expanded="false" data-headlessui-state>
        <span class="whitespace-nowrap flex-1 pr-2">All</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="pointer-events-none flex-shrink-0 w-4 h-4" aria-hidden="true">
          <path fill-rule="evenodd" d="M4.929 7.913l7.078 7.057 7.064-7.057a1 1 0 111.414 1.414l-7.77 7.764a1 1 0 01-1.415 0L3.515 9.328a1 1 0 011.414-1.414z" clip-rule="evenodd"></path>
        </svg>
      </button>
      <div id="difficulty-dropdown-options" class="hidden z-dropdown absolute max-h-56 overflow-auto rounded-lg p-2 focus:outline-none bg-overlay-3 dark:bg-dark-overlay-3 right-0 mt-2 shadow-level3 dark:shadow-dark-level3 w-24" role="listbox" tabindex="0" data-headlessui-state>
        <div class="relative flex h-8 cursor-pointer select-none py-1.5 pl-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1 rounded bg-fill-3 dark:bg-dark-fill-3" data-value="All" role="option" tabindex="-1">
          <div class="flex h-5 flex-1 items-center pr-2 font-medium">
            <div class="whitespace-nowrap">All</div>
          </div>
        </div>
        <div class="relative flex h-8 cursor-pointer select-none py-1.5 pl-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1" data-value="Easy" role="option" tabindex="-1">
          <div class="flex h-5 flex-1 items-center pr-2">
            <div class="whitespace-nowrap">Easy</div>
          </div>
        </div>
        <div class="relative flex h-8 cursor-pointer select-none py-1.5 pl-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1" data-value="Medium" role="option" tabindex="-1">
          <div class="flex h-5 flex-1 items-center pr-2">
            <div class="whitespace-nowrap">Medium</div>
          </div>
        </div>
        <div class="relative flex h-8 cursor-pointer select-none py-1.5 pl-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1" data-value="Hard" role="option" tabindex="-1">
          <div class="flex h-5 flex-1 items-center pr-2">
            <div class="whitespace-nowrap">Hard</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>


      <!-- **FIX:** Changed lg:grid-cols-2 to md:grid-cols-2 for better responsiveness -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- TOP-LEFT: CODING CLOCK -->
        <div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
          <div class="flex justify-between items-center mb-4">
            <!-- **UPDATED:** Heading color -->
            <div class="${styles.subSectionHeader}">Coding Clock</div>
            <!-- **UPDATED:** Button text for default day view -->
            <!-- NEW: Two-button toggle -->
<div class="text-sd-muted-foreground inline-flex items-center justify-center bg-sd-muted rounded-full p-[1px]">
  <button id="day-view-btn" 
          data-state="active"
          class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">
    Daily
  </button>
  <button id="hour-view-btn" 
          data-state="inactive"
          class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">
    Hourly
  </button>
</div>
          </div>
          <div class="mt-4 relative h-64 w-full">
            <canvas id="coding-clock-chart"></canvas>
          </div>
        </div>
        
        <!-- TOP-RIGHT: CUMULATIVE PROGRESS -->
<div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
  <div class="flex justify-between items-center mb-4">
    <div class="${styles.subSectionHeader}">Progress Tracker</div>
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
  <div class="mt-4 relative h-64 w-full">
    <canvas id="cumulative-chart"></canvas>
  </div>
</div>

        <!-- BOTTOM-LEFT: SUBMISSION SIGNATURE -->
        <div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
            <div class="${styles.subSectionHeader}">Submission Signature</div>
            <div class="mt-4 relative h-64 w-full">
                <canvas id="submission-signature-chart"></canvas>
            </div>
        </div>

        <!-- BOTTOM-RIGHT: LANGUAGE STATS -->
        <div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
            <div class="${styles.subSectionHeader}">Language Stats</div>
            <div class="mt-4 relative h-64 w-full">
                <canvas id="language-stats-chart"></canvas>
            </div>
        </div>
      </div>
      <div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
      <!-- SKILL MATRIX SECTION -->
      <div class="border-divider-3 dark:border-dark-divider-3 mb-4 mt-4 h-px w-full border-b"></div>
<div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
  <div class="flex justify-between items-center mb-4">
    <div class="${styles.sectionHeader}">Skills</div>
    
    <!-- Updated dropdown with HeadlessUI style -->
    <div class="ml-[21px]">
      <div class="relative" data-headlessui-state>
        <button id="skill-matrix-time-filter-btn" class="flex cursor-pointer items-center rounded px-3 py-1.5 text-left focus:outline-none whitespace-nowrap bg-fill-3 dark:bg-dark-fill-3 text-label-2 dark:text-dark-label-2 hover:bg-fill-2 dark:hover:bg-dark-fill-2 active:bg-fill-3 dark:active:bg-dark-fill-3" type="button" aria-haspopup="listbox" aria-expanded="false" data-headlessui-state>
          <span class="whitespace-nowrap">All Time</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="pointer-events-none ml-3 w-4 h-4" aria-hidden="true">
            <path fill-rule="evenodd" d="M4.929 7.913l7.078 7.057 7.064-7.057a1 1 0 111.414 1.414l-7.77 7.764a1 1 0 01-1.415 0L3.515 9.328a1 1 0 011.414-1.414z" clip-rule="evenodd"></path>
          </svg>
        </button>
        <div id="skill-matrix-time-filter-options" class="hidden z-dropdown absolute max-h-56 overflow-auto rounded-lg p-2 focus:outline-none bg-overlay-3 dark:bg-dark-overlay-3 right-0 mt-2 shadow-level3 dark:shadow-dark-level3" style="filter: drop-shadow(rgba(0, 0, 0, 0.04) 0px 1px 3px) drop-shadow(rgba(0, 0, 0, 0.12) 0px 6px 16px);">
          
          <div class="relative flex h-8 cursor-pointer select-none py-1.5 pl-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1 rounded bg-fill-3 dark:bg-dark-fill-3" data-value="All Time">
            <div class="flex h-5 flex-1 items-center pr-2 font-medium">
              <div class="whitespace-nowrap">All Time</div>
            </div>
            <span class="text-blue dark:text-dark-blue flex items-center pr-2 visible">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4" aria-hidden="true">
                <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path>
              </svg>
            </span>
          </div>
          
          <div class="relative flex h-8 cursor-pointer select-none py-1.5 pl-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1" data-value="Last 365 Days">
            <div class="flex h-5 flex-1 items-center pr-2">
              <div class="whitespace-nowrap">Last 365 Days</div>
            </div>
            <span class="text-blue dark:text-dark-blue flex items-center pr-2 invisible">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4" aria-hidden="true">
                <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path>
              </svg>
            </span>
          </div>
          
          <div class="relative flex h-8 cursor-pointer select-none py-1.5 pl-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1" data-value="Last 90 Days">
            <div class="flex h-5 flex-1 items-center pr-2">
              <div class="whitespace-nowrap">Last 90 Days</div>
            </div>
            <span class="text-blue dark:text-dark-blue flex items-center pr-2 invisible">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4" aria-hidden="true">
                <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path>
              </svg>
            </span>
          </div>
          
          <div class="relative flex h-8 cursor-pointer select-none py-1.5 pl-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1" data-value="Last 30 Days">
            <div class="flex h-5 flex-1 items-center pr-2">
              <div class="whitespace-nowrap">Last 30 Days</div>
            </div>
            <span class="text-blue dark:text-dark-blue flex items-center pr-2 invisible">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4" aria-hidden="true">
                <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path>
              </svg>
            </span>
          </div>
          
        </div>
      </div>
    </div>
  </div>
  <div class="mt-4" id="skill-matrix-container"></div>
</div>

  `;
    return statsPane;
}

// (The rest of the helper functions: setupTabLogic, createStatsTab, etc. remain the same)
// ... all other helper functions from the previous version go here ...
function setupTabLogic(
  statsTab: HTMLElement,
  tabBar: Element,
  contentSection: Element,
  statsPane: HTMLElement,
  processedData: ProcessedData
) {
  const ACTIVE_CLASSES = 'text-label-1 dark:text-dark-label-1 bg-fill-3 dark:bg-dark-fill-3'.split(' ');
  let isStatsActive = false;
  let lastActiveTab: Element | null = null;

  // Initialize: Find which tab is currently active
  const initActiveTab = () => {
    const tabs = Array.from(tabBar.querySelectorAll('.cursor-pointer'));
    for (const tab of tabs) {
      const innerDiv = tab.querySelector('div');
      if (innerDiv && ACTIVE_CLASSES.every(c => innerDiv.classList.contains(c))) {
        lastActiveTab = tab;
        return;
      }
    }
    // Fallback to first tab if none active
    lastActiveTab = tabs[0] || null;
  };
  initActiveTab();

  // Function to hide non-stats content
  const hideNonStatsContent = () => {
    Array.from(contentSection.children).forEach(child => {
      if (child !== statsPane && child !== tabBar) {
        (child as HTMLElement).style.display = 'none';
      }
    });
  };

  // Initial hide of non-stats content if needed
  if (isStatsActive) hideNonStatsContent();

  // Stats tab click handler
  statsTab.addEventListener('click', () => {
    if (isStatsActive) return;
    isStatsActive = true;
    
    // Deactivate previously active tab
    if (lastActiveTab && lastActiveTab !== statsTab) {
      const activeInner = lastActiveTab.querySelector('div');
      if (activeInner) activeInner.classList.remove(...ACTIVE_CLASSES);
    }
    
    // Activate stats tab
    const statsInner = statsTab.querySelector('div');
    if (statsInner) statsInner.classList.add(...ACTIVE_CLASSES);
    lastActiveTab = statsTab;
    
    // Hide all non-stats content
    hideNonStatsContent();
    
    // Show stats content
    statsPane.style.display = 'block';
    
    // Hide right-aligned elements
    const rightElements = tabBar.querySelectorAll(`
      .ml-auto,
      a[href*="/submissions/"],
      a[href*="/problem-list/"]
    `);
    rightElements.forEach(el => (el as HTMLElement).style.display = 'none');
    
    
  });

  // LeetCode tab click handler
  const leetcodeTabs = Array.from(tabBar.querySelectorAll('.cursor-pointer')).filter(t => t !== statsTab);
  leetcodeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      isStatsActive = false;
      
      // Deactivate stats tab
      const statsInner = statsTab.querySelector('div');
      if (statsInner) statsInner.classList.remove(...ACTIVE_CLASSES);
      
      // Activate clicked tab
      const tabInner = tab.querySelector('div');
      if (tabInner) tabInner.classList.add(...ACTIVE_CLASSES);
      lastActiveTab = tab;
      
      // Hide stats content
      statsPane.style.display = 'none';
      
      // Restore right-aligned elements
      const rightElements = tabBar.querySelectorAll(`
        .ml-auto,
        a[href*="/submissions/"],
        a[href*="/problem-list/"]
      `);
      rightElements.forEach(el => (el as HTMLElement).style.display = '');
      
      // Show content for this tab
      const content = Array.from(contentSection.children).find(
        c => c !== tabBar && c !== statsPane
      );
      
      if (content) {
        (content as HTMLElement).style.display = 'block';
      } else {
        console.warn('Content not found for tab', tab.textContent);
      }
    });
  });
  
  // Initialize tab bar as visible
  (tabBar as HTMLElement).style.display = 'flex';
}

/** Creates stats tab element */
function createStatsTab(): HTMLElement {
  const tab = document.createElement('div');
  tab.id = 'lc-stats-tab';
  tab.className = 'cursor-pointer';
  tab.innerHTML = `
    <div class="lc-md:space-x-2 flex items-center rounded-[5px] px-5 py-[10px] font-medium hover:text-label-1 dark:hover:text-dark-label-1">
      <span class="lc-md:inline hidden text-2xl">✨</span>
      <span class="whitespace-nowrap">Stats</span>
    </div>
  `;
  return tab;
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

// Helper function to get milestone colors
function getMilestoneColor(type: string): string {
  const colorMap: { [key: string]: string } = {
    'easy': colors.problems.easy,
    'medium': colors.problems.medium, 
    'hard': colors.problems.hard,
    'problems_solved': colors.status.accepted,
    'submissions': '#64b5f6' // This color is not in colors.ts, so it remains unchanged.
  };
  return colorMap[type] || colors.text.primary; // Default to problem color
}

function updateCumulativeViewToggle(activeView: CumulativeView) {
    const buttons = {
        'Daily': document.getElementById('daily-view-btn'),
        'Monthly': document.getElementById('monthly-view-btn'),
        'Yearly': document.getElementById('yearly-view-btn'),
    };

    for (const [view, button] of Object.entries(buttons)) {
        if (button) {
            button.setAttribute('data-state', view === activeView ? 'active' : 'inactive');
        }
    }
}

// In layout.ts, add this new function somewhere before setupFilterListeners

/**
 * Calculates the best cumulative view (Daily, Monthly, Yearly) based on the selected time range and data span.
 */
function getSmartCumulativeView(timeRange: TimeRange, processedData: ProcessedData): CumulativeView {
    if (timeRange === 'Last 30 Days' || timeRange === 'Last 90 Days') {
        return 'Daily';
    }
    if (timeRange === 'Last 365 Days') {
        return 'Monthly';
    }

    // This handles the 'All Time' case, which is the default on load.
    // We determine the view based on the total span of submissions.
    if (processedData.submissions.length > 1) {
        const firstSub = processedData.submissions.reduce((earliest, current) =>
            current.date < earliest.date ? current : earliest
        );
        const lastSub = processedData.submissions.reduce((latest, current) =>
            current.date > latest.date ? current : latest
        );
        const dayDifference = (lastSub.date.getTime() - firstSub.date.getTime()) / (1000 * 3600 * 24);

        if (dayDifference > 365 * 4) { // Over 2 years of history
            return 'Yearly';
        }
        if (dayDifference > 90) { // Over 3 months of history
            return 'Monthly';
        }
    }

    // Default to 'Daily' for short histories or if there's no data.
    return 'Daily';
}