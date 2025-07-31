import { colors } from '../ui/theme/colors';
import type { ProcessedData, Difficulty, TimeRange, ClockView, CumulativeView } from '../types';
import { getCodingClockStats } from '../analysis/stats/getCodingClockStats';
import { getCumulativeStats } from '../analysis/stats/getCumulativeStats';
import { getSubmissionSignatureStats } from '../analysis/stats/getSubmissionSignatureStats';
import { getLanguageStats } from '../analysis/stats/getLanguageStats';
import { getLegacyStats } from '../analysis/stats/getLegacyStats';
import { getSkillMatrixStats } from '../analysis/stats/getSkillMatrixStats';
import { renderOrUpdateStackedBarChart, CodingClockChartInstance } from './components/StackedBarChart';
import { renderOrUpdateCumulativeLineChart, CumulativeLineChartInstance } from './components/CumulativeLineChart';
import { renderOrUpdateDoughnutChart, DoughnutChartInstance } from './components/DoughnutChart';
import { renderOrUpdateHorizontalBarChart, HorizontalBarChartInstance } from './components/HorizontalBarChart';
import { renderOrUpdateMiniBarChart, MiniBarChartInstance } from './components/MiniBarChart';
import { renderOrUpdateSkillMatrixHeatmap, SkillMatrixHeatmapInstance } from './components/SkillMatrixHeatmap';
import { renderOrUpdateInteractiveChart, InteractiveChartInstance } from './components/InteractiveChart';
import { initializeBentoGenerator } from './bento/bento';
import { createBentoModalHTML } from './bento/bentoModal';
import { styles } from './theme/styles';

// --- Global Augmentation ---
declare global {
    interface Window {
        statsRendered?: boolean;
    }
}

// --- Constants ---
const ACTIVE_INNER_DIV_CLASSES = 'text-label-1 dark:text-dark-label-1 bg-fill-3 dark:bg-dark-fill-3'.split(' ');

// --- State Management ---
let codingClockChart: CodingClockChartInstance | undefined;
let cumulativeLineChart: CumulativeLineChartInstance | undefined;
let signatureChart: DoughnutChartInstance | undefined;
let languageChart: HorizontalBarChartInstance | undefined;
let interactiveChart: InteractiveChartInstance | undefined;
let skillMatrixHeatmap: SkillMatrixHeatmapInstance | undefined;

let miniBarCharts: Map < string, MiniBarChartInstance > = new Map();
let legacyStats: any = null;

let currentFilters = {
    timeRange: 'All Time' as TimeRange,
    difficulty: 'All' as Difficulty,
    clockView: 'DayOfWeek' as ClockView,
    cumulativeView: 'Daily' as CumulativeView,
};

let interactiveChartFilters = {
    primaryView: 'Problems Solved' as 'Submissions' | 'Problems Solved',
    secondaryView: 'Difficulty' as 'Difficulty' | 'Language' | 'Status',
    timeRange: 'All Time' as TimeRange,
    difficulty: 'All' as Difficulty,
};

let skillMatrixOptions = {
    timeRange: 'All Time' as 'Last 30 Days' | 'Last 90 Days' | 'Last 365 Days' | 'All Time',
    chartView: 'Monthly' as 'Daily' | 'Monthly' | 'Yearly',
    showDifficultySplit: false,
    selectedMetric: 'problemsSolved' as 'problemsSolved' | 'avgTries' | 'firstAceRate'
};


/**
 * Main function to inject and manage the tabbed stats UI.
 */
export function renderPageLayout(processedData: ProcessedData, username: string) {
    const contentContainer = document.querySelector('.space-y-\\[18px\\]') ||
        document.querySelector('[class*="space-y-["]');
    if (!contentContainer) {
        return;
    }

    const tabBar = contentContainer.firstElementChild as HTMLElement;
    if (!tabBar || !tabBar.classList.contains('flex')) {
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

    let generateCardBtn: HTMLElement | null = null;
    if (processedData.submissions.length > 0) {
        generateCardBtn = createGenerateCardButton();
        tabBar.appendChild(generateCardBtn);
    }

    const statsPane = document.createElement('div');
    statsPane.id = 'lc-stats-pane';
    statsPane.style.display = 'none';
    statsPane.className = 'w-full';

    if (processedData.submissions.length === 0) {
        const imageUrl = chrome.runtime.getURL('assets/images/null_dark.png');
        const wrapper = document.createElement('div');
        wrapper.className = 'mb-[70px] mt-[57px] flex-1';
        const innerWrapper = document.createElement('div');
        innerWrapper.className = 'flex h-full flex-col items-center justify-center';
        const img = document.createElement('img');
        img.className = 'w-[200px]';
        img.alt = '数据为空';
        img.src = imageUrl;
        const span = document.createElement('span');
        span.className = 'mt-3 text-sm font-medium text-label-4 dark:text-dark-label-4';
        span.textContent = 'No stats';
        innerWrapper.appendChild(img);
        innerWrapper.appendChild(span);
        wrapper.appendChild(innerWrapper);
        statsPane.appendChild(wrapper);
    } else {
        const grid = createStatsPaneWithGrid(username);
        while (grid.firstChild) {
            statsPane.appendChild(grid.firstChild);
        }
    }

    contentContainer.append(statsPane);

    let contentObserver: MutationObserver | null = null;
    const startContentObservation = () => {
        if (contentObserver) contentObserver.disconnect();
        contentObserver = new MutationObserver(() => {
            const leetcodeContent = Array.from(contentContainer.children).find(
                child => child !== tabBar && child !== statsPane
            );
            if (leetcodeContent) {
                setupTabLogic(statsTab, tabBar, contentContainer, statsPane, processedData, username, generateCardBtn);
                contentObserver?.disconnect();
                contentObserver = null;
            }
        });
        contentObserver.observe(contentContainer, {
            childList: true,
            subtree: false
        });
        setTimeout(() => {
            if (contentObserver) {
                setupTabLogic(statsTab, tabBar, contentContainer, statsPane, processedData, username, generateCardBtn);
                contentObserver.disconnect();
                contentObserver = null;
            }
        }, 5000);
    };

    const initialContent = Array.from(contentContainer.children).find(
        child => child !== tabBar && child !== statsPane
    );

    if (initialContent) {
        setupTabLogic(statsTab, tabBar, contentContainer, statsPane, processedData, username, generateCardBtn);
        if (!window.statsRendered && processedData.submissions.length > 0) {
            requestAnimationFrame(() => {
                renderAllCharts(processedData, username);
                window.statsRendered = true;
            });
        }
    } else {
        startContentObservation();
    }
}

/**
 * Renders or updates all charts at once.
 */
function renderAllCharts(processedData: ProcessedData, username: string) {
    currentFilters.cumulativeView = getSmartCumulativeView(currentFilters.timeRange, processedData);
    renderInteractiveChart(processedData);
    renderLegacySection(processedData);
    renderCodingClock(processedData);
    renderCumulativeChart(processedData);
    renderSubmissionSignature(processedData);
    renderLanguageChart(processedData);
    renderSkillMatrix(processedData);
    setupFilterListeners(processedData);
    initializeBentoGenerator(processedData, username);

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

    setTimeout(() => {
        if (codingClockChart) codingClockChart.resize();
        if (cumulativeLineChart) cumulativeLineChart.resize();
        if (signatureChart) signatureChart.resize();
        if (languageChart) languageChart.resize();
    }, 100);
}

/**
 * Renders only the charts that are affected by the main filters.
 */
function renderFilteredCharts(processedData: ProcessedData) {
    renderCodingClock(processedData);
    renderCumulativeChart(processedData);
    renderSubmissionSignature(processedData);
    renderLanguageChart(processedData);
}

/**
 * Renders the main interactive history chart.
 */
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

/**
 * Renders the legacy section containing milestones, trophies, and records.
 */
function renderLegacySection(processedData: ProcessedData) {
    legacyStats = getLegacyStats(processedData);
    const legacyContainer = document.getElementById('legacy-section');
    if (!legacyContainer || !legacyStats) return;

    while (legacyContainer.firstChild) {
        legacyContainer.removeChild(legacyContainer.firstChild);
    }
    
    const sectionHeader = document.createElement('div');
    sectionHeader.className = styles.sectionHeader;
    sectionHeader.textContent = 'Legacy';
    legacyContainer.appendChild(sectionHeader);

    const mainFlexContainer = document.createElement('div');
    mainFlexContainer.className = 'flex flex-col lg:flex-row gap-4 h-full';

    // Left Half: Milestones
    const milestonesContainer = document.createElement('div');
    milestonesContainer.className = 'flex-1 rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4';
    const milestonesHeader = document.createElement('div');
    milestonesHeader.className = styles.subSectionHeader;
    milestonesHeader.textContent = 'Milestones';
    const milestonesContent = document.createElement('div');
    milestonesContent.className = 'mt-4 relative';
    const timelineBar = document.createElement('div');
    timelineBar.className = 'absolute left-3 top-0 bottom-0 w-0.5 bg-fill-3 dark:bg-dark-fill-3';
    const milestonesList = document.createElement('div');
    milestonesList.className = 'space-y-4';

    legacyStats.milestones.forEach((milestone: any) => {
        const milestoneColor = getMilestoneColor(milestone.type);
        const item = document.createElement('div');
        item.className = 'relative';
        const dot = document.createElement('div');
        dot.className = 'absolute left-2 top-2 w-2.5 h-2.5 rounded-full';
        dot.style.backgroundColor = milestoneColor;
        const textContainer = document.createElement('div');
        textContainer.className = 'ml-10';
        const eventDiv = document.createElement('div');
        eventDiv.className = styles.milestoneEvent;
        eventDiv.style.color = milestoneColor;
        eventDiv.textContent = `${milestone.milestone}${getOrdinalSuffix(milestone.milestone)} ${formatMilestoneType(milestone.type)}`;
        const dateDiv = document.createElement('div');
        dateDiv.className = styles.milestoneDate;
        dateDiv.textContent = milestone.date.toLocaleDateString('en-GB');
        textContainer.appendChild(eventDiv);
        textContainer.appendChild(dateDiv);
        if (milestone.type === 'submissions' || milestone.problemTitle) {
            const link = document.createElement('a');
            link.className = `inline-flex items-center gap-1 ${styles.milestoneProblem}`;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            if (milestone.type === 'submissions') {
                link.href = `https://leetcode.com/submissions/detail/${milestone.submissionId || milestone.id}/`;
                link.textContent = `Submission #${milestone.submissionId || milestone.id}`;
            } else {
                link.href = `https://leetcode.com/problems/${milestone.problemSlug}/`;
                link.textContent = milestone.problemTitle;
            }
            textContainer.appendChild(link);
        }
        item.appendChild(dot);
        item.appendChild(textContainer);
        milestonesList.appendChild(item);
    });
    
    milestonesContent.appendChild(timelineBar);
    milestonesContent.appendChild(milestonesList);
    milestonesContainer.appendChild(milestonesHeader);
    milestonesContainer.appendChild(milestonesContent);
    mainFlexContainer.appendChild(milestonesContainer);

    // Right Half
    const rightHalfContainer = document.createElement('div');
    rightHalfContainer.className = 'flex-1 flex flex-col gap-4';

    // Trophies
    const trophiesContainer = document.createElement('div');
    trophiesContainer.className = 'rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4';
    const trophiesHeader = document.createElement('div');
    trophiesHeader.className = styles.subSectionHeader;
    trophiesHeader.textContent = 'Trophies';
    const trophiesList = document.createElement('div');
    trophiesList.className = 'mt-4 space-y-3';
    legacyStats.trophies.forEach((trophy: any) => {
        const item = document.createElement('div');
        item.className = `flex items-center space-x-4 p-3 rounded-lg bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.06)] ${!trophy.achieved ? 'opacity-75' : ''}`;
        const img = document.createElement('img');
        img.src = chrome.runtime.getURL(trophy.icon);
        img.alt = `${trophy.title} Trophy`;
        img.className = 'w-10 h-10 flex-shrink-0';
        item.appendChild(img);

        const textContainer = document.createElement('div');
        textContainer.className = 'flex-1 flex flex-col space-y-1';
        const titleDiv = document.createElement('div');
        titleDiv.className = styles.trophyName;
        titleDiv.textContent = trophy.title;
        textContainer.appendChild(titleDiv);
        const divider = document.createElement('div');
        divider.className = 'border-divider-3 dark:border-dark-divider-3 mb-4 mt-4 h-px w-full border-b';
        textContainer.appendChild(divider);

        const problemEl = (trophy.achieved && trophy.problemSlug !== 'placeholder') ? document.createElement('a') : document.createElement('div');
        if (problemEl.tagName === 'A') {
            (problemEl as HTMLAnchorElement).href = `https://leetcode.com/problems/${trophy.problemSlug}/`;
            problemEl.className = styles.trophyProblem;
            (problemEl as HTMLAnchorElement).target = '_blank';
            (problemEl as HTMLAnchorElement).rel = 'noopener noreferrer';
        } else {
            problemEl.className = `${styles.trophyProblem} trophy-hidden cursor-default`;
        }
        problemEl.textContent = trophy.problemTitle;
        textContainer.appendChild(problemEl);
        
        const subtitleDiv = document.createElement('div');
        subtitleDiv.className = `${styles.trophyDescription} pt-1 ${!trophy.achieved ? 'trophy-hidden' : ''}`;
        subtitleDiv.textContent = trophy.subtitle;
        textContainer.appendChild(subtitleDiv);

        if (trophy.personalNote) {
            const noteDiv = document.createElement('div');
            noteDiv.className = `${styles.trophyPersonalNote} pt-1.5 ${!trophy.achieved ? 'trophy-hidden' : ''}`;
            noteDiv.textContent = trophy.personalNote;
            textContainer.appendChild(noteDiv);
        }
        item.appendChild(textContainer);
        trophiesList.appendChild(item);
    });
    trophiesContainer.appendChild(trophiesHeader);
    trophiesContainer.appendChild(trophiesList);
    rightHalfContainer.appendChild(trophiesContainer);

    // Records
    const recordsContainer = document.createElement('div');
    recordsContainer.className = 'flex-1 rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4';
    const recordsHeader = document.createElement('div');
    recordsHeader.className = styles.subSectionHeader;
    recordsHeader.textContent = 'Records';
    const recordsList = document.createElement('div');
    recordsList.className = 'mt-4 space-y-2';
    legacyStats.records.forEach((record: any) => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-start p-2 rounded-md';
        const labelSpan = document.createElement('span');
        labelSpan.className = styles.recordLabel;
        labelSpan.textContent = record.name;
        item.appendChild(labelSpan);
        const valueContainer = document.createElement('div');
        valueContainer.className = 'flex flex-col items-end';
        if (record.mainStat) {
            const valueSpan = document.createElement('span');
            valueSpan.className = styles.recordValue;
            valueSpan.textContent = record.mainStat;
            valueContainer.appendChild(valueSpan);
        } else {
            const innerFlex = document.createElement('div');
            innerFlex.className = 'flex items-center';
            const valueSpan = document.createElement('span');
            valueSpan.className = styles.recordValue;
            valueSpan.textContent = record.value;
            innerFlex.appendChild(valueSpan);
            if (record.subStats) {
                const chartDiv = document.createElement('div');
                chartDiv.className = 'ml-2 w-12 h-6';
                chartDiv.style.transform = 'translateY(-5px)';
                const canvas = document.createElement('canvas');
                canvas.id = `mini-chart-${record.name.replace(/\s+/g, '-').toLowerCase()}`;
                canvas.width = 48;
                canvas.height = 24;
                chartDiv.appendChild(canvas);
                innerFlex.appendChild(chartDiv);
            }
            valueContainer.appendChild(innerFlex);
        }
        const contextSpan = document.createElement('span');
        contextSpan.className = styles.recordContext;
        contextSpan.innerHTML = record.dateStat || '&nbsp;';
        valueContainer.appendChild(contextSpan);
        item.appendChild(valueContainer);
        recordsList.appendChild(item);
    });
    recordsContainer.appendChild(recordsHeader);
    recordsContainer.appendChild(recordsList);
    rightHalfContainer.appendChild(recordsContainer);

    mainFlexContainer.appendChild(rightHalfContainer);
    legacyContainer.appendChild(mainFlexContainer);
}

/**
 * Renders the coding frequency chart (stacked bar chart).
 */
function renderCodingClock(processedData: ProcessedData) {
    const canvas = document.getElementById('coding-clock-chart') as HTMLCanvasElement;
    if (!canvas || !canvas.parentElement) return;

    const chartData = getCodingClockStats(processedData, currentFilters);
    if (chartData) {
        canvas.parentElement.style.display = 'block';
        codingClockChart = renderOrUpdateStackedBarChart(canvas.parentElement, chartData, codingClockChart);
    } else {
        canvas.parentElement.style.display = 'none';
    }
}

/**
 * Renders the cumulative progress chart (line chart).
 */
function renderCumulativeChart(processedData: ProcessedData) {
    const canvas = document.getElementById('cumulative-chart') as HTMLCanvasElement;
    if (!canvas || !canvas.parentElement) return;

    const chartData = getCumulativeStats(processedData, currentFilters);

    if (chartData && chartData.labels.length > 0) {
        canvas.parentElement.style.display = 'block';
        cumulativeLineChart = renderOrUpdateCumulativeLineChart(
            canvas.parentElement,
            chartData, {
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
 * Renders the submission breakdown chart (doughnut chart).
 */
function renderSubmissionSignature(processedData: ProcessedData) {
    const canvas = document.getElementById('submission-signature-chart') as HTMLCanvasElement;
    if (!canvas || !canvas.parentElement) return;

    const chartData = getSubmissionSignatureStats(processedData, currentFilters);
    if (chartData) {
        canvas.parentElement.style.display = 'block';
        signatureChart = renderOrUpdateDoughnutChart(canvas.parentElement, chartData, currentFilters, signatureChart);
    } else {
        canvas.parentElement.style.display = 'none';
    }
}

/**
 * Renders the language stats chart (horizontal bar chart).
 */
function renderLanguageChart(processedData: ProcessedData) {
    const canvas = document.getElementById('language-stats-chart') as HTMLCanvasElement;
    if (!canvas || !canvas.parentElement) return;

    const chartData = getLanguageStats(processedData, currentFilters);
    if (chartData) {
        canvas.parentElement.style.display = 'block';
        languageChart = renderOrUpdateHorizontalBarChart(canvas.parentElement, chartData, currentFilters, languageChart);
    } else {
        canvas.parentElement.style.display = 'none';
    }
}

/**
 * Renders the skill matrix heatmap.
 */
function renderSkillMatrix(processedData: ProcessedData) {
    const container = document.getElementById('skill-matrix-container') as HTMLElement;
    if (!container) return;

    const skillMatrixData = getSkillMatrixStats(
        processedData, { ...currentFilters,
            difficulty: 'All'
        },
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

/**
 * Sets up event listeners for all filter controls.
 */
function setupFilterListeners(processedData: ProcessedData) {
    const setupDropdown = (
        btnId: string,
        optionsId: string,
        filterKey: keyof typeof currentFilters | keyof typeof skillMatrixOptions,
        isSkillMatrix: boolean = false
    ) => {
        const dropdownBtn = document.getElementById(btnId) as HTMLButtonElement;
        const dropdownOptions = document.getElementById(optionsId) as HTMLDivElement;
        const optionElements = dropdownOptions?.querySelectorAll('[data-value]');

        if (!dropdownBtn || !dropdownOptions || !optionElements) return;

        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = dropdownOptions.classList.contains('hidden');
            document.querySelectorAll('.stats-dropdown-options').forEach(el => {
                if (el.id !== optionsId) {
                    el.classList.add('hidden');
                    const associatedBtnId = el.id.replace('-options', '-btn');
                    document.getElementById(associatedBtnId)?.setAttribute('aria-expanded', 'false');
                }
            });
            dropdownOptions.classList.toggle('hidden', !isHidden);
            dropdownBtn.setAttribute('aria-expanded', String(isHidden));
        });

        optionElements.forEach(option => {
            option.addEventListener('click', () => {
                const value = option.getAttribute('data-value') as any;
                const btnTextSpan = dropdownBtn.querySelector('span:not(.check-icon-span)');

                if (btnTextSpan) {
                    btnTextSpan.textContent = value;
                }

                if (isSkillMatrix) {
                    (skillMatrixOptions as any)[filterKey] = value;
                } else {
                    (currentFilters as any)[filterKey] = value;
                }

                optionElements.forEach(opt => {
                    const isSelected = opt === option;
                    opt.classList.toggle('bg-fill-3', isSelected);
                    opt.classList.toggle('dark:bg-dark-fill-3', isSelected);
                    opt.classList.toggle('font-medium', isSelected);

                    const checkIcon = opt.querySelector('.check-icon-span');
                    if (checkIcon) {
                        checkIcon.classList.toggle('visible', isSelected);
                        checkIcon.classList.toggle('invisible', !isSelected);
                    }
                });

                dropdownOptions.classList.add('hidden');
                dropdownBtn.setAttribute('aria-expanded', 'false');

                if (isSkillMatrix) {
                    renderSkillMatrix(processedData);
                } else {
                    if (filterKey === 'timeRange') {
                        const smartView = getSmartCumulativeView(value, processedData);
                        currentFilters.cumulativeView = smartView;
                        updateCumulativeViewToggle(smartView);
                    }
                    renderFilteredCharts(processedData);
                }
            });
        });
    };

    setupDropdown('time-range-dropdown-btn', 'time-range-dropdown-options', 'timeRange');
    setupDropdown('difficulty-dropdown-btn', 'difficulty-dropdown-options', 'difficulty');
    setupDropdown('skill-matrix-time-filter-btn', 'skill-matrix-time-filter-options', 'timeRange', true);

    document.addEventListener('click', (event) => {
        document.querySelectorAll('.stats-dropdown-options').forEach(el => {
            const btnId = el.id.replace('-options', '-btn');
            const btn = document.getElementById(btnId);
            if (btn && !btn.contains(event.target as Node)) {
                el.classList.add('hidden');
                btn.setAttribute('aria-expanded', 'false');
            }
        });
    });

    const dayViewBtn = document.getElementById('day-view-btn') as HTMLButtonElement;
    const hourViewBtn = document.getElementById('hour-view-btn') as HTMLButtonElement;

    dayViewBtn.addEventListener('click', () => {
        if (currentFilters.clockView !== 'DayOfWeek') {
            currentFilters.clockView = 'DayOfWeek';
            dayViewBtn.setAttribute('data-state', 'active');
            hourViewBtn.setAttribute('data-state', 'inactive');
            renderCodingClock(processedData);
        }
    });

    hourViewBtn.addEventListener('click', () => {
        if (currentFilters.clockView !== 'HourOfDay') {
            currentFilters.clockView = 'HourOfDay';
            hourViewBtn.setAttribute('data-state', 'active');
            dayViewBtn.setAttribute('data-state', 'inactive');
            renderCodingClock(processedData);
        }
    });

    const dailyViewBtn = document.getElementById('daily-view-btn') as HTMLButtonElement;
    const monthlyViewBtn = document.getElementById('monthly-view-btn') as HTMLButtonElement;
    const yearlyViewBtn = document.getElementById('yearly-view-btn') as HTMLButtonElement;

    const handleToggleClick = (view: CumulativeView) => {
        if (currentFilters.cumulativeView !== view) {
            currentFilters.cumulativeView = view;
            updateCumulativeViewToggle(view);
            renderCumulativeChart(processedData);
        }
    };

    dailyViewBtn.addEventListener('click', () => handleToggleClick('Daily'));
    monthlyViewBtn.addEventListener('click', () => handleToggleClick('Monthly'));
    yearlyViewBtn.addEventListener('click', () => handleToggleClick('Yearly'));

    updateCumulativeViewToggle(currentFilters.cumulativeView);
}

/**
 * Creates the main stats pane container with the grid layout for charts.
 */
function createStatsPaneWithGrid(username: string): HTMLElement {
    const statsPane = document.createElement('div');
    statsPane.id = 'lc-stats-pane-grid';
    statsPane.className = 'w-full';
    statsPane.innerHTML = `
    <div class="space-y-4">
        <!-- INTERACTIVE CHART SECTION -->
        <div class="rounded-lg p-4">
            <div class="${styles.sectionHeader}">History</div>
            <div class="mt-4" id="interactive-chart-container"></div>
        </div>
        <div class="border-divider-3 dark:border-dark-divider-3 mb-4 mt-4 h-px w-full border-b"></div>
        
        <!-- LEGACY SECTION -->
        <div class="rounded-lg p-4">
            <div id="legacy-section" class="min-h-96"></div>
        </div>
        <div class="border-divider-3 dark:border-dark-divider-3 mb-4 mt-4 h-px w-full border-b"></div>

        <!-- HEADER + FILTERS -->
        <div class="flex items-center justify-between p-4 bg-layer-1 dark:bg-dark-layer-1 rounded-lg">
            <h2 class="${styles.sectionHeader}">Activity</h2>
            <div class="flex items-center space-x-4">
                <!-- Time Range Dropdown -->
                <div class="relative">
                    <button id="time-range-dropdown-btn" class="flex cursor-pointer items-center rounded px-3 py-1.5 text-left focus:outline-none whitespace-nowrap bg-fill-3 dark:bg-dark-fill-3 text-label-2 dark:text-dark-label-2 hover:bg-fill-2 dark:hover:bg-dark-fill-2 active:bg-fill-3 dark:active:bg-dark-fill-3" type="button" aria-haspopup="listbox" aria-expanded="false">
                        <span class="whitespace-nowrap">All Time</span>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="pointer-events-none ml-3 w-4 h-4" aria-hidden="true"><path fill-rule="evenodd" d="M4.929 7.913l7.078 7.057 7.064-7.057a1 1 0 111.414 1.414l-7.77 7.764a1 1 0 01-1.415 0L3.515 9.328a1 1 0 011.414-1.414z" clip-rule="evenodd"></path></svg>
                    </button>
                    <div id="time-range-dropdown-options" class="stats-dropdown-options hidden z-dropdown absolute max-h-56 w-full min-w-max overflow-auto rounded-lg p-2 focus:outline-none bg-overlay-3 dark:bg-dark-overlay-3 right-0 mt-2 shadow-level3 dark:shadow-dark-level3" role="listbox">
                        <div class="relative flex h-8 cursor-pointer select-none items-center py-1.5 pl-2 pr-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1 rounded bg-fill-3 dark:bg-dark-fill-3 font-medium" data-value="All Time" role="option">
                            <div class="flex-1 whitespace-nowrap">All Time</div>
                            <span class="check-icon-span text-blue dark:text-dark-blue flex items-center pl-2 visible"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path></svg></span>
                        </div>
                        <div class="relative flex h-8 cursor-pointer select-none items-center py-1.5 pl-2 pr-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1 rounded" data-value="Last 30 Days" role="option">
                            <div class="flex-1 whitespace-nowrap">Last 30 Days</div>
                            <span class="check-icon-span text-blue dark:text-dark-blue flex items-center pl-2 invisible"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path></svg></span>
                        </div>
                        <div class="relative flex h-8 cursor-pointer select-none items-center py-1.5 pl-2 pr-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1 rounded" data-value="Last 90 Days" role="option">
                            <div class="flex-1 whitespace-nowrap">Last 90 Days</div>
                            <span class="check-icon-span text-blue dark:text-dark-blue flex items-center pl-2 invisible"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path></svg></span>
                        </div>
                        <div class="relative flex h-8 cursor-pointer select-none items-center py-1.5 pl-2 pr-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1 rounded" data-value="Last 365 Days" role="option">
                            <div class="flex-1 whitespace-nowrap">Last 365 Days</div>
                            <span class="check-icon-span text-blue dark:text-dark-blue flex items-center pl-2 invisible"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path></svg></span>
                        </div>
                    </div>
                </div>

                <!-- Difficulty Dropdown -->
                <div class="relative">
                    <button id="difficulty-dropdown-btn" class="flex cursor-pointer items-center rounded px-3 py-1.5 text-left focus:outline-none whitespace-nowrap bg-fill-3 dark:bg-dark-fill-3 text-label-2 dark:text-dark-label-2 hover:bg-fill-2 dark:hover:bg-dark-fill-2 active:bg-fill-3 dark:active:bg-dark-fill-3" type="button" aria-haspopup="listbox" aria-expanded="false">
                        <span class="whitespace-nowrap">All</span>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="pointer-events-none ml-3 w-4 h-4" aria-hidden="true"><path fill-rule="evenodd" d="M4.929 7.913l7.078 7.057 7.064-7.057a1 1 0 111.414 1.414l-7.77 7.764a1 1 0 01-1.415 0L3.515 9.328a1 1 0 011.414-1.414z" clip-rule="evenodd"></path></svg>
                    </button>
                    <div id="difficulty-dropdown-options" class="stats-dropdown-options hidden z-dropdown absolute max-h-56 w-full min-w-max overflow-auto rounded-lg p-2 focus:outline-none bg-overlay-3 dark:bg-dark-overlay-3 right-0 mt-2 shadow-level3 dark:shadow-dark-level3" role="listbox">
                        <div class="relative flex h-8 cursor-pointer select-none items-center py-1.5 pl-2 pr-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1 rounded bg-fill-3 dark:bg-dark-fill-3 font-medium" data-value="All" role="option">
                            <div class="flex-1 whitespace-nowrap">All</div>
                            <span class="check-icon-span text-blue dark:text-dark-blue flex items-center pl-2 visible"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path></svg></span>
                        </div>
                        <div class="relative flex h-8 cursor-pointer select-none items-center py-1.5 pl-2 pr-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1 rounded" data-value="Easy" role="option">
                            <div class="flex-1 whitespace-nowrap">Easy</div>
                            <span class="check-icon-span text-blue dark:text-dark-blue flex items-center pl-2 invisible"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path></svg></span>
                        </div>
                        <div class="relative flex h-8 cursor-pointer select-none items-center py-1.5 pl-2 pr-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1 rounded" data-value="Medium" role="option">
                            <div class="flex-1 whitespace-nowrap">Medium</div>
                            <span class="check-icon-span text-blue dark:text-dark-blue flex items-center pl-2 invisible"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path></svg></span>
                        </div>
                        <div class="relative flex h-8 cursor-pointer select-none items-center py-1.5 pl-2 pr-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1 rounded" data-value="Hard" role="option">
                            <div class="flex-1 whitespace-nowrap">Hard</div>
                            <span class="check-icon-span text-blue dark:text-dark-blue flex items-center pl-2 invisible"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path></svg></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- CHARTS GRID -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- TOP-LEFT: CODING CLOCK -->
            <div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
                <div class="flex justify-between items-center mb-4">
                    <div class="${styles.subSectionHeader}">Coding Frequency</div>
                    <div class="text-sd-muted-foreground inline-flex items-center justify-center bg-sd-muted rounded-full p-[1px]">
                        <button id="day-view-btn" data-state="active" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">Daily</button>
                        <button id="hour-view-btn" data-state="inactive" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">Hourly</button>
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
                    <div class="text-sd-muted-foreground inline-flex items-center justify-center bg-sd-muted rounded-full p-[1px]">
                        <button id="daily-view-btn" data-view="Daily" data-state="inactive" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">Daily</button>
                        <button id="monthly-view-btn" data-view="Monthly" data-state="active" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">Monthly</button>
                        <button id="yearly-view-btn" data-view="Yearly" data-state="inactive" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">Yearly</button>
                    </div>
                </div>
                <div class="mt-4 relative h-64 w-full">
                    <canvas id="cumulative-chart"></canvas>
                </div>
            </div>

            <!-- BOTTOM-LEFT: SUBMISSION BREAKDOWN -->
            <div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
                <div class="${styles.subSectionHeader}">Submission Breakdown</div>
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
        
        <!-- SKILL MATRIX SECTION -->
        <div class="border-divider-3 dark:border-dark-divider-3 mb-4 mt-4 h-px w-full border-b"></div>
        <div class="rounded-lg bg-layer-1 dark:bg-dark-layer-1 p-4">
            <div class="flex justify-between items-center mb-4">
                <div class="${styles.sectionHeader}">Skills</div>
                <div class="relative">
                    <button id="skill-matrix-time-filter-btn" class="flex cursor-pointer items-center rounded px-3 py-1.5 text-left focus:outline-none whitespace-nowrap bg-fill-3 dark:bg-dark-fill-3 text-label-2 dark:text-dark-label-2 hover:bg-fill-2 dark:hover:bg-dark-fill-2 active:bg-fill-3 dark:active:bg-dark-fill-3" type="button" aria-haspopup="listbox" aria-expanded="false">
                        <span class="whitespace-nowrap">All Time</span>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="pointer-events-none ml-3 w-4 h-4" aria-hidden="true"><path fill-rule="evenodd" d="M4.929 7.913l7.078 7.057 7.064-7.057a1 1 0 111.414 1.414l-7.77 7.764a1 1 0 01-1.415 0L3.515 9.328a1 1 0 011.414-1.414z" clip-rule="evenodd"></path></svg>
                    </button>
                    <div id="skill-matrix-time-filter-options" class="stats-dropdown-options hidden z-dropdown absolute max-h-56 w-full min-w-max overflow-auto rounded-lg p-2 focus:outline-none bg-overlay-3 dark:bg-dark-overlay-3 right-0 mt-2 shadow-level3 dark:shadow-dark-level3" role="listbox">
                         <div class="relative flex h-8 cursor-pointer select-none items-center py-1.5 pl-2 pr-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1 rounded bg-fill-3 dark:bg-dark-fill-3 font-medium" data-value="All Time" role="option">
                            <div class="flex-1 whitespace-nowrap">All Time</div>
                            <span class="check-icon-span text-blue dark:text-dark-blue flex items-center pl-2 visible"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path></svg></span>
                        </div>
                        <div class="relative flex h-8 cursor-pointer select-none items-center py-1.5 pl-2 pr-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1 rounded" data-value="Last 365 Days" role="option">
                            <div class="flex-1 whitespace-nowrap">Last 365 Days</div>
                            <span class="check-icon-span text-blue dark:text-dark-blue flex items-center pl-2 invisible"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path></svg></span>
                        </div>
                        <div class="relative flex h-8 cursor-pointer select-none items-center py-1.5 pl-2 pr-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1 rounded" data-value="Last 90 Days" role="option">
                            <div class="flex-1 whitespace-nowrap">Last 90 Days</div>
                            <span class="check-icon-span text-blue dark:text-dark-blue flex items-center pl-2 invisible"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path></svg></span>
                        </div>
                        <div class="relative flex h-8 cursor-pointer select-none items-center py-1.5 pl-2 pr-2 text-label-2 dark:text-dark-label-2 hover:text-label-1 dark:hover:text-dark-label-1 rounded" data-value="Last 30 Days" role="option">
                            <div class="flex-1 whitespace-nowrap">Last 30 Days</div>
                            <span class="check-icon-span text-blue dark:text-dark-blue flex items-center pl-2 invisible"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"></path></svg></span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="mt-4" id="skill-matrix-container"></div>
        </div>
    </div>
    ${createBentoModalHTML()} 
    `;
    return statsPane;
}

/**
 * Sets up the logic for switching between the original LeetCode tabs and the new stats tab.
 */
function setupTabLogic(
    statsTab: HTMLElement,
    tabBar: Element,
    contentSection: Element,
    statsPane: HTMLElement,
    processedData: ProcessedData,
    username: string,
    generateCardBtn: HTMLElement | null
) {
    let isStatsActive = false;
    let lastActiveTab: Element | null = null;
    let contentObserver: MutationObserver | null = null;

    const initActiveTab = () => {
        const tabs = Array.from(tabBar.querySelectorAll('.cursor-pointer'));
        for (const tab of tabs) {
            const innerDiv = tab.querySelector('div');
            if (innerDiv && ACTIVE_INNER_DIV_CLASSES.every(c => innerDiv.classList.contains(c))) {
                lastActiveTab = tab;
                return;
            }
        }
        lastActiveTab = tabs[0] || null;
    };

    initActiveTab();

    const hideNonStatsContent = () => {
        Array.from(contentSection.children).forEach(child => {
            if (child !== statsPane && child !== tabBar) {
                (child as HTMLElement).style.display = 'none';
            }
        });
    };

    const startContentObservation = () => {
        if (contentObserver) contentObserver.disconnect();
        contentObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as HTMLElement;
                        if (element !== tabBar && element !== statsPane && isStatsActive) {
                            element.style.display = 'none';
                        }
                    }
                });
            });
        });
        contentObserver.observe(contentSection, {
            childList: true,
            subtree: false
        });
    };

    const stopContentObservation = () => {
        if (contentObserver) {
            contentObserver.disconnect();
            contentObserver = null;
        }
    };

    if (isStatsActive) {
        hideNonStatsContent();
    }

    statsTab.addEventListener('click', () => {
        if (isStatsActive) return;
        isStatsActive = true;

        if (lastActiveTab && lastActiveTab !== statsTab) {
            const activeInner = lastActiveTab.querySelector('div');
            if (activeInner) activeInner.classList.remove(...ACTIVE_INNER_DIV_CLASSES);
        }

        const statsInner = statsTab.querySelector('div');
        if (statsInner) statsInner.classList.add(...ACTIVE_INNER_DIV_CLASSES);
        lastActiveTab = statsTab;

        hideNonStatsContent();
        statsPane.style.display = 'block';

        const rightElements = tabBar.querySelectorAll(`
            .ml-auto:not(#generate-card-btn),
            a[href*="/submissions/"],
            a[href*="/problem-list/"]
        `);
        rightElements.forEach(el => (el as HTMLElement).style.display = 'none');

        if (generateCardBtn) {
            generateCardBtn.style.display = 'inline-flex';
        }

        startContentObservation();

        if (!window.statsRendered && processedData.submissions.length > 0) {
            requestAnimationFrame(() => {
                renderAllCharts(processedData, username);
                window.statsRendered = true;
            });
        }
    });

    const leetcodeTabs = Array.from(tabBar.querySelectorAll('.cursor-pointer')).filter(t => t !== statsTab);
    leetcodeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            isStatsActive = false;

            const statsInner = statsTab.querySelector('div');
            if (statsInner) statsInner.classList.remove(...ACTIVE_INNER_DIV_CLASSES);

            const tabInner = tab.querySelector('div');
            if (tabInner) tabInner.classList.add(...ACTIVE_INNER_DIV_CLASSES);
            lastActiveTab = tab;

            statsPane.style.display = 'none';
            stopContentObservation();

            if (generateCardBtn) {
                generateCardBtn.style.display = 'none';
            }
            const rightElements = tabBar.querySelectorAll(`
                .ml-auto:not(#generate-card-btn),
                a[href*="/submissions/"],
                a[href*="/problem-list/"]
            `);
            rightElements.forEach(el => (el as HTMLElement).style.display = '');

            const content = Array.from(contentSection.children).find(
                c => c !== tabBar && c !== statsPane
            );
            if (content) {
                (content as HTMLElement).style.display = 'block';
            }
        });
    });

    (tabBar as HTMLElement).style.display = 'flex';
    startContentObservation();
}

/**
 * Creates the stats tab element.
 */
function createStatsTab(): HTMLElement {
    const tab = document.createElement('div');
    tab.id = 'lc-stats-tab';
    tab.className = 'cursor-pointer';
    const iconUrl = chrome.runtime.getURL('assets/icons/sparkles.svg');

    const div = document.createElement('div');
    div.className = 'lc-md:space-x-2 flex items-center rounded-[5px] px-5 py-[10px] font-medium hover:text-label-1 dark:hover:text-dark-label-1';
    const img = document.createElement('img');
    img.src = iconUrl;
    img.alt = 'Stats Icon';
    img.className = 'lc-md:inline hidden w-6 h-6';
    const span = document.createElement('span');
    span.className = 'whitespace-nowrap';
    span.textContent = 'Stats';
    div.appendChild(img);
    div.appendChild(span);
    tab.appendChild(div);
    return tab;
}

/**
 * Creates the "Share Stats" button with an animated border.
 */
function createGenerateCardButton(): HTMLElement {
    const button = document.createElement('button');
    button.id = 'generate-card-btn';
    button.className = 'animated-border-btn ml-auto inline-flex items-center px-5 py-[10px] text-sm font-medium text-label-2 dark:text-dark-label-2 rounded-lg focus:outline-none transition-all';
    button.style.display = 'none';
    const span = document.createElement('span');
    span.textContent = 'Share Stats';
    button.appendChild(span);

    if (!document.querySelector('#animated-border-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'animated-border-styles';
        styleSheet.textContent = `
            .animated-border-btn {
                position: relative;
                z-index: 1;
                border: none;
                overflow: hidden;
                background-color: transparent;
            }
            .animated-border-btn::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 150%;
                height: 300%;
                z-index: -2;
                background: conic-gradient(from 180deg at 50% 50%, transparent 0%, #818cf8 15%, transparent 30%, transparent 50%, #f472b6 65%, transparent 80%, transparent 100%);
                animation: rotate-gradient 4s linear infinite;
            }
            .animated-border-btn::after {
                content: '';
                position: absolute;
                top: 1px;
                left: 1px;
                right: 1px;
                bottom: 1px;
                background-color: #262626;
                border-radius: 0.45rem;
                z-index: -1;
                transition: background-color 0.2s ease-in-out;
            }
            html:not(.dark) .animated-border-btn::after {
                background-color: #ffffff;
            }
            html:not(.dark) .animated-border-btn span {
                color: #4a4a4a;
            }
            html:not(.dark) .animated-border-btn:hover span {
                 color: #000000;
            }
            .animated-border-btn span {
                position: relative;
                z-index: 2;
                transition: color 0.2s ease-in-out;
            }
            .animated-border-btn:hover span {
                color: #ffffff;
            }
            @keyframes rotate-gradient {
                0% { transform: translate(-50%, -50%) rotate(0deg); }
                100% { transform: translate(-50%, -50%) rotate(360deg); }
            }
        `;
        document.head.appendChild(styleSheet);
    }

    return button;
}

/**
 * Gets the appropriate ordinal suffix for a number (e.g., 1st, 2nd, 3rd).
 */
function getOrdinalSuffix(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const value = num % 100;
    return suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0];
}

/**
 * Formats a milestone type string for display.
 */
function formatMilestoneType(type: string): string {
    const typeMap: {
        [key: string]: string
    } = {
        'problems_solved': 'Problem',
        'submissions': 'Submission',
        'easy': 'Easy',
        'medium': 'Medium',
        'hard': 'Hard'
    };
    return typeMap[type] || type;
}

/**
 * Gets the corresponding color for a milestone type.
 */
function getMilestoneColor(type: string): string {
    const colorMap: {
        [key: string]: string
    } = {
        'easy': colors.problems.easy,
        'medium': colors.problems.medium,
        'hard': colors.problems.hard,
        'problems_solved': colors.status.accepted,
        'submissions': '#64b5f6'
    };
    return colorMap[type] || colors.text.primary;
}

/**
 * Updates the visual state of the cumulative view toggle buttons.
 */
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

/**
 * Calculates the best cumulative view (Daily, Monthly, Yearly) based on the time range and data span.
 */
export function getSmartCumulativeView(timeRange: TimeRange, processedData: ProcessedData): CumulativeView {
    if (timeRange === 'Last 30 Days' || timeRange === 'Last 90 Days') {
        return 'Daily';
    }
    if (timeRange === 'Last 365 Days') {
        return 'Monthly';
    }

    if (processedData.submissions.length > 1) {
        const firstSub = processedData.submissions.reduce((earliest, current) =>
            current.date < earliest.date ? current : earliest
        );
        const lastSub = processedData.submissions.reduce((latest, current) =>
            current.date > latest.date ? current : latest
        );
        const dayDifference = (lastSub.date.getTime() - firstSub.date.getTime()) / (1000 * 3600 * 24);

        if (dayDifference > 365 * 4) {
            return 'Yearly';
        }
        if (dayDifference > 90) {
            return 'Monthly';
        }
    }

    return 'Daily';
}