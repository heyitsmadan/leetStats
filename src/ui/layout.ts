import type { ProcessedData } from '../analysis/processor';
import { getCumulativeSubmissions } from '../analysis/stats/getChartData';
import { createLineChart } from './components/LineChart';

// --- Constants for Tab Styling ---
// These are the classes on the *inner* div of an active tab.
const ACTIVE_INNER_DIV_CLASSES = 'text-label-1 dark:text-dark-label-1 bg-fill-3 dark:bg-dark-fill-3'.split(' ');

/**
 * Main function to inject and manage the tabbed stats UI.
 * @param processedData The fully processed data for the extension.
 */
export function renderPageLayout(processedData: ProcessedData) {
  // --- Step 1: Find our anchor and the key container elements ---
  const submissionsLink = document.querySelector(
    'div.lc-lg\\:max-w-\\[calc\\(100\\%_-_316px\\)\\] a[href="/submissions/"]'
  );
  const tabBar = submissionsLink?.closest('div.flex.w-full');
  
  // The 'space-y-[18px]' div is the parent container for the tab bar and all content panes.
  const contentSection = tabBar?.parentElement;

  if (!tabBar || !contentSection) {
    console.error('❌ LeetCode Stats: Could not find the tab bar or content section.');
    return;
  }
  
  if (document.getElementById('lc-stats-tab')) {
    console.log('✅ LeetCode Stats: UI already injected.');
    return;
  }

  // --- Step 2: Create our custom elements ---
  const statsTab = createStatsTab(tabBar);
  if (!statsTab) return;
  
  const statsPane = createStatsContentPane();
  // Append our pane to the main content section alongside LeetCode's panes.
  contentSection.appendChild(statsPane);

  // --- Step 3: Set up the tab switching logic ---
  const originalTabs = Array.from(tabBar.querySelectorAll('div.cursor-pointer:not(#lc-stats-tab)'));

  // Logic for when an ORIGINAL LeetCode tab is clicked.
  originalTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      deactivateStatsTab(statsTab);
      statsPane.style.display = 'none';
      // We don't need to manage LeetCode's panes here.
      // Their own scripts will handle showing the correct content.
    });
  });

  // Logic for when OUR "Stats" tab is clicked.
  statsTab.addEventListener('click', () => {
    // Deactivate all original tabs by finding their inner divs.
    originalTabs.forEach(t => {
      const innerDiv = t.querySelector('div');
      if (innerDiv) {
        innerDiv.classList.remove(...ACTIVE_INNER_DIV_CLASSES);
      }
    });
    
    // Activate our tab.
    activateStatsTab(statsTab);
    
    // **FIX 2: Hide ALL other content panes within the section.**
    // Iterate through all children of the content section.
    Array.from(contentSection.children).forEach(child => {
      // If a child is not the tab bar and not our stats pane, hide it.
      if (child !== tabBar && child !== statsPane) {
        (child as HTMLElement).style.display = 'none';
      }
    });
    
    // Show our pane.
    statsPane.style.display = 'block';
  });

  // --- Step 4: Render the chart ---
  const canvas = document.getElementById('cumulative-submissions-chart') as HTMLCanvasElement;
  if (canvas) {
    const { labels, data } = getCumulativeSubmissions(processedData);
    createLineChart(canvas, labels, data, 'Cumulative Submissions');
  }
}

/**
 * Creates the "Stats" tab with proper styling by cloning an INACTIVE tab.
 */
function createStatsTab(tabBar: Element): HTMLElement | null {
  // **FIX 1: Clone the second tab, which is inactive by default.**
  const sampleTab = tabBar.querySelector('div.cursor-pointer:nth-child(2)');
  if (!sampleTab) {
    console.error("❌ LeetCode Stats: Could not find a sample inactive tab to clone.");
    return null;
  }

  const statsTab = sampleTab.cloneNode(true) as HTMLElement;
  statsTab.id = 'lc-stats-tab';

  const textSpan = statsTab.querySelector('span:last-child');
  if (textSpan) textSpan.textContent = 'Stats';
  else statsTab.textContent = 'Stats';

  const iconSpan = statsTab.querySelector('span:first-child');
  if (iconSpan) {
    iconSpan.textContent = '✨';
    iconSpan.classList.remove('hidden');
    iconSpan.classList.add('lc-md:inline');
  }

  const rightAlignedContainer = tabBar.querySelector('div.ml-auto, a.ml-auto');
  if (rightAlignedContainer) {
    tabBar.insertBefore(statsTab, rightAlignedContainer);
  } else {
    tabBar.appendChild(statsTab);
  }

  return statsTab;
}

/**
 * Creates the content pane that holds our statistics and charts.
 */
function createStatsContentPane(): HTMLElement {
  const statsPane = document.createElement('div');
  statsPane.id = 'lc-stats-pane';
  statsPane.style.display = 'none'; // Initially hidden.
  statsPane.className = 'w-full';
  statsPane.innerHTML = `
    <div class="space-y-4">
      <div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
        <h2 class="text-lg font-medium text-label-1 dark:text-dark-label-1 mb-4">
          Submission Analysis
        </h2>
        <div class="h-80 w-full">
          <canvas id="cumulative-submissions-chart"></canvas>
        </div>
      </div>
    </div>
  `;
  return statsPane;
}

// --- Helper functions for activating/deactivating our tab ---

function activateStatsTab(tab: HTMLElement) {
  const innerDiv = tab.querySelector('div');
  if (innerDiv) {
    innerDiv.classList.add(...ACTIVE_INNER_DIV_CLASSES);
  }
}

function deactivateStatsTab(tab: HTMLElement) {
  const innerDiv = tab.querySelector('div');
  if (innerDiv) {
    innerDiv.classList.remove(...ACTIVE_INNER_DIV_CLASSES);
  }
}
