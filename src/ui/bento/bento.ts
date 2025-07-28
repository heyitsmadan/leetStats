import type { ProcessedData, LegacyStats, CumulativeView, TimeRange, MilestoneData, InteractiveChartFilters, SkillMatrixData } from '../../types';
import { getLegacyStats } from '../../analysis/stats/getLegacyStats';
import { getSubmissionSignatureStats } from '../../analysis/stats/getSubmissionSignatureStats';
import { getLanguageStats } from '../../analysis/stats/getLanguageStats';
import { getCumulativeStats } from '../../analysis/stats/getCumulativeStats';
import { getCodingClockStats } from '../../analysis/stats/getCodingClockStats';
import { getInteractiveChartStats } from '../../analysis/stats/getInteractiveChartStats';
import { getSkillMatrixStats } from '../../analysis/stats/getSkillMatrixStats';
import { getSolvedStats } from '../../analysis/stats/getSolvedStats';
import { renderOrUpdateDoughnutChart } from '../components/DoughnutChart';
import { renderOrUpdateHorizontalBarChart } from '../components/HorizontalBarChart';
import { renderOrUpdateCumulativeLineChart } from '../components/CumulativeLineChart';
import { renderOrUpdateStackedBarChart } from '../components/StackedBarChart';
import { renderOrUpdateInteractiveChart } from '../components/InteractiveChart';
import { renderProgressRing } from '../components/ProgressRing';
import { getSmartCumulativeView } from '../layout';
import { colors } from '../theme/colors';
import { toBlob } from 'html-to-image';
import { styles } from '../theme/styles';
// --- Module-level state ---
let legacyStats: LegacyStats | null = null;
let skillMatrixData: SkillMatrixData | null = null;
let processedDataCache: ProcessedData | null = null;
let currentPreviewBlob: Blob | null = null;
let isRendering = false;
let usernameCache = '';

// --- Configuration ---
const RENDER_WIDTH = 900;

// --- Helper functions ---

/**
 * A debounce function to prevent a function from being called too frequently.
 * This is crucial for performance with expensive operations like image generation.
 * @param func The function to debounce.
 * @param delay The delay in milliseconds.
 * @returns A debounced version of the function.
 */
function debounce(func: (...args: any[]) => void, delay: number) {
    let timeoutId: number;
    return (...args: any[]) => {
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
            func(...args);
        }, delay);
    };
}


function getMilestoneColor(type: string): string {
  const colorMap: { [key: string]: string } = { 'easy': colors.problems.easy, 'medium': colors.problems.medium, 'hard': colors.problems.hard, 'problems_solved': colors.status.accepted, 'submissions': '#64b5f6' };
  return colorMap[type] || colors.text.primary;
}

function formatMilestoneType(type: string): string {
  const typeMap: { [key: string]: string } = { 'problems_solved': 'Problem', 'submissions': 'Submission', 'easy': 'Easy', 'medium': 'Medium', 'hard': 'Hard' };
  return typeMap[type] || type;
}

function getOrdinalSuffix(num: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
}

function formatTopicName(slug: string): string {
    return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

async function renderBentoPreview() {
    if (isRendering || !legacyStats || !processedDataCache || !skillMatrixData) return;
    const currentSkillMatrixData = skillMatrixData;
    isRendering = true;

    const loader = document.getElementById('bento-preview-loader');
    const previewCanvas = document.getElementById('bento-preview-canvas') as HTMLCanvasElement;
    const shareBtn = document.getElementById('share-bento-btn');

    if (loader) loader.style.display = 'block';
    if (previewCanvas) previewCanvas.style.display = 'none';
    if (shareBtn) shareBtn.setAttribute('disabled', 'true');
    currentPreviewBlob = null;

    try {
        // --- 1. GATHER SELECTIONS & DEFINE COMPONENT PERSONALITIES ---
        const selections = {
            history: document.querySelector('#bento-checkbox-history[data-state="checked"]') !== null,
            records: Array.from(document.querySelectorAll('.bento-record-checkbox[data-state="checked"]')).map(cb => (cb as HTMLElement).dataset.recordName),
            trophies: Array.from(document.querySelectorAll('.bento-trophy-checkbox[data-state="checked"]')).map(cb => (cb as HTMLElement).dataset.trophyId),
            milestones: Array.from(document.querySelectorAll('.bento-milestone-checkbox[data-state="checked"]')).map(cb => parseInt((cb as HTMLElement).dataset.milestoneIndex || '-1')),
            skills: Array.from(document.querySelectorAll('.bento-skill-checkbox[data-state="checked"]')).map(cb => (cb as HTMLElement).dataset.skillName).filter((name): name is string => !!name),
            activities: Array.from(document.querySelectorAll('.bento-activity-checkbox[data-state="checked"]')).map(cb => (cb as HTMLElement).dataset.activityName),
        };

        const componentDefinitions = {
            history: { type: 'large', span: 4, condition: selections.history },
            skills: { type: 'large', span: 4, condition: selections.skills.length > 0 },
            progressTracker: { type: 'large', span: 4, condition: selections.activities.includes('Progress Tracker') },
            
            records: { type: 'medium', span: 2, condition: selections.records.filter(r => r !== "Overall Progress").length > 0 },
            trophies: { type: 'medium', span: 2, condition: selections.trophies.length > 0 },

            milestones: { type: 'small', span: 2, condition: selections.milestones.length > 0 },

            overallProgress: { type: 'square', span: 2, condition: selections.records.includes("Overall Progress") },
            submissionSignature: { type: 'square', span: 2, condition: selections.activities.includes('Submission Signature') },
            languageStats: { type: 'square', span: 2, condition: selections.activities.includes('Language Stats') },
            codingClock: { type: 'square', span: 2, condition: selections.activities.includes('Coding Clock') },
        };

        // --- 2. LAYOUT ENGINE: Categorize selected components ---
        const skillsSelected = componentDefinitions.skills.condition;
        const largeItems = Object.keys(componentDefinitions).filter(key => key !== 'skills' && componentDefinitions[key as keyof typeof componentDefinitions].type === 'large' && componentDefinitions[key as keyof typeof componentDefinitions].condition);
        const mediumItems = Object.keys(componentDefinitions).filter(key => componentDefinitions[key as keyof typeof componentDefinitions].type === 'medium' && componentDefinitions[key as keyof typeof componentDefinitions].condition);
        const smallItems = Object.keys(componentDefinitions).filter(key => componentDefinitions[key as keyof typeof componentDefinitions].type === 'small' && componentDefinitions[key as keyof typeof componentDefinitions].condition);
        const squareItems = Object.keys(componentDefinitions).filter(key => componentDefinitions[key as keyof typeof componentDefinitions].type === 'square' && componentDefinitions[key as keyof typeof componentDefinitions].condition);

        // --- 3. CREATE HTML STRUCTURE OFF-SCREEN ---
        const offscreenContainer = document.createElement('div');
        offscreenContainer.style.position = 'absolute';
        offscreenContainer.style.left = '-9999px';
        offscreenContainer.style.top = '0px';
        offscreenContainer.style.width = `${RENDER_WIDTH}px`;
        offscreenContainer.style.height = 'auto';

        offscreenContainer.innerHTML = `
            <div id="bento-render-node" class="render-safe">
                <div id="bento-header">${usernameCache}'s leetStats</div>
                <div id="bento-grid-wrapper"><div id="bento-grid"></div></div>
                <div id="bento-footer">Generated by leetStats</div>
            </div>`;
        
        const grid = offscreenContainer.querySelector('#bento-grid')!;
        
        // --- 4. LAYOUT ENGINE: Place components onto the grid ---
        largeItems.forEach(key => {
            grid.appendChild(createCardElement(key, 4));
        });
        
        const remainingItems = [...mediumItems, ...smallItems, ...squareItems];
        let currentRowColumns = 0;

        while (remainingItems.length > 0) {
            if (remainingItems.length === 1 && currentRowColumns === 0) {
                const lastItemKey = remainingItems.shift()!;
                grid.appendChild(createCardElement(lastItemKey, 4));
                continue;
            }
            
            let itemPlacedInRow = false;
            const placementOrder = ['medium', 'small', 'square'];
            
            for (const itemType of placementOrder) {
                const itemIndex = remainingItems.findIndex(key => {
                    const def = componentDefinitions[key as keyof typeof componentDefinitions];
                    return def.type === itemType && (currentRowColumns + def.span <= 4);
                });

                if (itemIndex !== -1) {
                    const itemKey = remainingItems[itemIndex];
                    const itemDef = componentDefinitions[itemKey as keyof typeof componentDefinitions];
                    
                    grid.appendChild(createCardElement(itemKey, itemDef.span));
                    currentRowColumns += itemDef.span;
                    remainingItems.splice(itemIndex, 1);
                    itemPlacedInRow = true;
                    break;
                }
            }

            if (currentRowColumns >= 4 || !itemPlacedInRow) {
                currentRowColumns = 0;
            }
        }

        if (skillsSelected) {
            grid.appendChild(createCardElement('skills', 4));
        }

        document.body.appendChild(offscreenContainer);
        const renderNode = document.getElementById('bento-render-node') as HTMLElement;

        // --- 5. RENDER CHARTS & COMPONENTS ---
        await renderComponentContent(renderNode, selections, currentSkillMatrixData);
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const renderHeight = renderNode.scrollHeight;
        
        const blob = await toBlob(renderNode, {
            width: RENDER_WIDTH,
            height: renderHeight,
        });

        if (!blob) {
            throw new Error("Failed to generate image blob.");
        }
        
        currentPreviewBlob = blob;
        if (shareBtn) shareBtn.removeAttribute('disabled');

        // Draw the generated blob onto our preview canvas
        const ctx = previewCanvas.getContext('2d');
        if (ctx) {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            img.onload = () => {
                previewCanvas.width = img.width;
                previewCanvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url); // Clean up the object URL
            };
            img.src = url;
        }

        if (loader) loader.style.display = 'none';
        if (previewCanvas) previewCanvas.style.display = 'block';
        document.body.removeChild(offscreenContainer);

    } catch (error) {
        console.error("Failed to render bento preview:", error);
        if (loader) loader.style.display = 'none';
    } finally {
        isRendering = false;
    }
}

function createCardElement(key: string, span: number): HTMLElement {
    const card = document.createElement('div');
    card.className = 'bento-card';
    card.style.gridColumn = `span ${span}`;
    card.id = `bento-card-${key}`;
    return card;
}

async function renderComponentContent(container: HTMLElement, selections: any, skillData: SkillMatrixData) {
    if (!legacyStats || !processedDataCache) return;

    const { history, records, trophies, milestones, skills, activities } = selections;
    const historyStartDate = (document.getElementById('bento-history-start-date') as HTMLInputElement)?.valueAsDate;
    const historyEndDate = (document.getElementById('bento-history-end-date') as HTMLInputElement)?.valueAsDate;
    
    // Helper to check if a card is full-width
    const isFullWidth = (card: Element | null) => card ? (card as HTMLElement).style.gridColumn.includes('4') : false;

    // Render History
    if (history && historyStartDate && historyEndDate) {
        const card = container.querySelector('#bento-card-history');
        if (card) {
            const primaryView = (document.querySelector('#bento-history-primary-toggle button[data-state="active"]') as HTMLElement)?.dataset.view || 'Problems Solved';
            const secondaryView = (document.querySelector('#bento-history-secondary-toggle button[data-state="active"]') as HTMLElement)?.dataset.view || 'Difficulty';

            card.innerHTML = `<h3 class="bento-card-title" style="color: ${colors.text.primary};">${primaryView}</h3><div class="bento-card-content"><div class="chart-container" style="height: 100%;"><canvas id="bento-history-chart-canvas"></canvas></div></div>`;
            const chartContainer = card.querySelector('.chart-container');
            
            const bentoInteractiveFilters: InteractiveChartFilters = {
                primaryView: primaryView as 'Problems Solved' | 'Submissions',
                secondaryView: secondaryView as 'Difficulty' | 'Language' | 'Status',
                timeRange: 'All Time', 
                difficulty: 'All', 
                brushWindow: [historyStartDate, historyEndDate]
            };

            renderOrUpdateInteractiveChart(chartContainer as HTMLElement, processedDataCache, bentoInteractiveFilters, undefined, { 
                isBentoMode: true,
                scales: {
                    x: {
                        ticks: {
                            maxTicksLimit: 4,
                            maxRotation: 0,
                            minRotation: 0,
                        }
                    }
                }
            } as any);
        }
    }

    // Render Overall Progress
    if (records.includes("Overall Progress")) {
        const card = container.querySelector('#bento-card-overallProgress');
        if (card) {
            card.innerHTML = `<div class="bento-card-content progress-ring-container" id="bento-progress-ring-container" style="display: flex; align-items: center; justify-content: center; height: 100%; width: 100%; padding: 1rem;"></div>`;
            const ringContainer = card.querySelector('#bento-progress-ring-container');
            if (ringContainer) {
                const stats = getSolvedStats(processedDataCache);
                renderProgressRing(ringContainer as HTMLElement, stats);
            }
        }
    }

    // Render Records
    const selectedRecords = legacyStats.records.filter(r => records.includes(r.name) && r.name !== "Overall Progress");
    if (selectedRecords.length > 0) {
        const card = container.querySelector('#bento-card-records');
        if (card) {
            let listHtml = '';
            selectedRecords.forEach(r => { listHtml += `<div class="record-item"><span class="record-label">${r.name}</span><div class="record-value"><span>${r.mainStat || r.value}</span><span class="record-context">${r.dateStat || ''}</span></div></div>`; });
            card.innerHTML = `<h3 class="bento-card-title" style="color: ${colors.text.primary};">Records</h3><div class="bento-card-content"><div class="record-list">${listHtml}</div></div>`;
        }
    }

    // Render Trophies
    const selectedTrophies = legacyStats.trophies.filter(t => t.achieved && trophies.includes(t.id));
    if (selectedTrophies.length > 0) {
        const card = container.querySelector('#bento-card-trophies');
        if (card) {
            const titleAlign = isFullWidth(card) ? 'text-align: center;' : '';
            let listHtml = '';
            selectedTrophies.forEach(t => { listHtml += `<div class="trophy-item"><img src="${chrome.runtime.getURL(t.icon)}" alt="${t.title}" class="trophy-icon" /><div class="trophy-details"><div class="trophy-title">${t.title}</div><div class="trophy-subtitle">${t.subtitle}</div>${t.problemSlug !== 'placeholder' ? `<a href="https://leetcode.com/problems/${t.problemSlug}/" target="_blank" class="trophy-problem">${t.problemTitle}</a>` : ''}</div></div>`; });
            card.innerHTML = `<h3 class="bento-card-title" style="color: ${colors.text.primary}; ${titleAlign}">Trophies</h3><div class="bento-card-content" style="display: grid; place-items: center; height: 100%;"><div class="trophy-list">${listHtml}</div></div>`;
        }
    }
    
    // Render Milestones
    const selectedMilestones = legacyStats.milestones.filter((m, index) => milestones.includes(index));
    if (selectedMilestones.length > 0) {
        const card = container.querySelector('#bento-card-milestones');
        if (card) {
            const titleAlign = isFullWidth(card) ? 'text-align: center;' : '';
            let html = `<h3 class="bento-card-title" style="color: ${colors.text.primary}; ${titleAlign}">Milestones</h3><div class="bento-card-content" style="display: grid; place-items: center; height: 100%;"><div class="milestone-timeline"><div class="timeline-line"></div><div class="milestone-list">`;
            selectedMilestones.forEach(m => {
                const color = getMilestoneColor(m.type);
                html += `<div class="milestone-item"><div class="milestone-dot" style="background-color: ${color};"></div><div class="milestone-event" style="color: ${color};">${m.milestone}${getOrdinalSuffix(m.milestone)} ${formatMilestoneType(m.type)}</div><div class="milestone-date">${m.date.toLocaleDateString('en-GB')}</div>${m.problemTitle ? `<a href="https://leetcode.com/problems/${m.problemSlug}/" target="_blank" class="${styles.milestoneProblem}milestone-problem">${m.problemTitle}</a>` : ''}</div>`;
            });
            html += `</div></div></div>`;
            card.innerHTML = html;
        }
    }

    // Render Skills
    if (skills.length > 0) {
        const card = container.querySelector('#bento-card-skills');
        if (card) {
            let html = `<h3 class="bento-card-title" style="color: ${colors.text.primary};">Skills</h3><div class="bento-card-content"><div class="skills-table"><div class="skills-header"><div class="skill-cell" style="text-align: left;">Topic</div><div class="skill-cell">Solved</div><div class="skill-cell">Avg. Attempts</div><div class="skill-cell">First Ace</div></div>`;
            skills.forEach((skill: string) => {
                const metrics = skillData.metrics;
                const solved = metrics.problemsSolved[skill] || 0;
                const avgTries = metrics.avgTries[skill];
                const firstAce = metrics.firstAceRate[skill] || 0;
                html += `<div class="skill-row"><div class="skill-cell" style="text-align: left;">${formatTopicName(skill)}</div><div class="skill-cell">${solved}</div><div class="skill-cell">${avgTries === Infinity ? '∞' : avgTries.toFixed(1)}</div><div class="skill-cell">${firstAce.toFixed(0)}%</div></div>`;
            });
            html += `</div></div>`;
            card.innerHTML = html;
        }
    }

    // Render Activity Charts
    if (activities.includes("Progress Tracker")) {
        const card = container.querySelector('#bento-card-progressTracker');
        if (card) {
            card.innerHTML = `<h3 class="bento-card-title" style="color: ${colors.text.primary};">Problems Solved Over Time</h3><div class="bento-card-content"><div class="chart-container"><canvas id="bento-progress-tracker-canvas"></canvas></div></div>`;
            const chartContainer = card.querySelector('.chart-container');
            if (chartContainer) {
                const cumulativeView = getSmartCumulativeView('All Time', processedDataCache);
                const stats = getCumulativeStats(processedDataCache, { timeRange: 'All Time', difficulty: 'All', cumulativeView });
                if (stats) renderOrUpdateCumulativeLineChart(chartContainer as HTMLElement, stats, { timeRange: 'All Time', difficulty: 'All', cumulativeView }, undefined, { isInteractive: false, hidePoints: true });
            }
        }
    }
    if (activities.includes("Coding Clock")) {
        const card = container.querySelector('#bento-card-codingClock');
        if (card) {
            const clockView = (document.querySelector('#bento-coding-clock-toggle button[data-state="active"]') as HTMLElement)?.dataset.view || 'HourOfDay';
            const title = clockView === 'HourOfDay' ? 'Submissions by Hour' : 'Submissions by Day';
            
            card.innerHTML = `<h3 class="bento-card-title" style="color: ${colors.text.primary};">${title}</h3><div class="bento-card-content"><div class="chart-container"><canvas id="bento-coding-clock-canvas"></canvas></div></div>`;
            const chartContainer = card.querySelector('.chart-container');
            
            if (chartContainer) {
                const stats = getCodingClockStats(processedDataCache, { timeRange: 'All Time', difficulty: 'All', clockView: clockView as 'HourOfDay' | 'DayOfWeek' });
                
                const bentoOptions = {
                    maxTicksLimit: clockView === 'HourOfDay' ? 12 : 7
                };

                renderOrUpdateStackedBarChart(chartContainer as HTMLElement, stats, undefined, { 
                    isInteractive: false, 
                    bentoOptions: bentoOptions 
                });
            }
        }
    }
    if (activities.includes("Submission Signature")) {
        const card = container.querySelector('#bento-card-submissionSignature');
        if (card) {
            const titleAlign = isFullWidth(card) ? 'text-align: center;' : 'text-align: center;'; // Always center for this one
            card.innerHTML = `<h3 class="bento-card-title" style="color: ${colors.text.primary}; ${titleAlign}">Submission Signature</h3><div class="bento-card-content"><div class="chart-container"><canvas id="bento-submission-signature-canvas"></canvas></div></div>`;
            const chartContainer = card.querySelector('.chart-container');
            if (chartContainer) {
                const stats = getSubmissionSignatureStats(processedDataCache, { timeRange: 'All Time', difficulty: 'All' });
                renderOrUpdateDoughnutChart(chartContainer as HTMLElement, stats, { difficulty: 'All' }, undefined, { 
                    isInteractive: false, 
                    legendConfig: { display: true, position: 'bottom', fontSize: 13 },
                    cutout: '65%',
                    layout: { padding: { top: 15, right: 20, bottom: 20, left: 20 } }
                });
            }
        }
    }
    if (activities.includes("Language Stats")) {
        const card = container.querySelector('#bento-card-languageStats');
        if (card) {
            card.innerHTML = `<h3 class="bento-card-title" style="color: ${colors.text.primary};">Language Stats</h3><div class="bento-card-content"><div class="chart-container"><canvas id="bento-language-stats-canvas"></canvas></div></div>`;
            const chartContainer = card.querySelector('.chart-container');
            if (chartContainer) {
                const stats = getLanguageStats(processedDataCache, { timeRange: 'All Time', difficulty: 'All' });
                renderOrUpdateHorizontalBarChart(chartContainer as HTMLElement, stats, { difficulty: 'All' }, undefined, { isInteractive: false });
            }
        }
    }
}

const debouncedRenderBentoPreview = debounce(renderBentoPreview, 400);

export function initializeBentoGenerator(data: ProcessedData, username: string) {
    processedDataCache = data;
    if (!legacyStats) legacyStats = getLegacyStats(data);
    if (!skillMatrixData) skillMatrixData = getSkillMatrixStats(data, { timeRange: 'All Time', difficulty: 'All' }, 'All Time');
    usernameCache = username;

    const generateCardBtn = document.getElementById('generate-card-btn');
    const modal = document.getElementById('bento-modal');
    const closeModalBtn = document.getElementById('bento-modal-close-btn');
    const shareBtn = document.getElementById('share-bento-btn') as HTMLButtonElement;

    if (!generateCardBtn || !modal || !closeModalBtn || !shareBtn) return;
    
    shareBtn.className = 'bg-green-0 dark:bg-dark-green-0 text-green-s dark:text-dark-green-s hover:text-green-s dark:hover:text-dark-green-s w-48 rounded-lg py-[7px] text-center font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
    shareBtn.textContent = 'Share';


    generateCardBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
        if (!document.getElementById('bento-records-accordion-content')?.hasChildNodes()) {
            populateAccordion();
        }
        renderBentoPreview();
    });

    closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    shareBtn.addEventListener('click', async () => {
        if (!currentPreviewBlob) return;
        const file = new File([currentPreviewBlob], `leetstats_${username}.png`, { type: 'image/png' });
        try {
            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({ title: 'My LeetCode Stats', text: 'Check out my LeetCode stats card!', files: [file] });
            } else {
                throw new Error('Web Share API not supported.');
            }
        } catch (err) {
            const link = document.createElement('a');
            link.download = `leetstats_${username}.png`;
            link.href = URL.createObjectURL(currentPreviewBlob);
            link.click();
            URL.revokeObjectURL(link.href);
        }
    });

    document.querySelectorAll('.bento-accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling as HTMLElement;
            const icon = header.querySelector('svg');
            if (content && icon) {
                const isVisible = content.style.display === 'block';
                content.style.display = isVisible ? 'none' : 'block';
                icon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        });
    });
}

function populateAccordion() {
    const historyContent = document.getElementById('bento-history-accordion-content');
    const recordsContent = document.getElementById('bento-records-accordion-content');
    const trophiesContent = document.getElementById('bento-trophies-accordion-content');
    const milestonesContent = document.getElementById('bento-milestones-accordion-content');
    const skillsContent = document.getElementById('bento-skills-accordion-content');
    const activityContent = document.getElementById('bento-activity-accordion-content');

    if (historyContent) {
        historyContent.innerHTML = ''; // Clear previous content

        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'history-controls-container';
        controlsContainer.className = 'space-y-2 mt-2 pl-8';
        controlsContainer.style.display = 'none'; // Initially hidden

        const togglesWrapper = document.createElement('div');
        togglesWrapper.className = 'flex gap-2 items-center';

        // Primary View Toggle
        const primaryToggleContainer = document.createElement('div');
        primaryToggleContainer.id = 'bento-history-primary-toggle';
        primaryToggleContainer.className = 'text-sd-muted-foreground inline-flex items-center justify-center bg-sd-muted rounded-full p-[1px]';
        primaryToggleContainer.innerHTML = `
            <button data-view="Problems Solved" data-state="active" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">Problems Solved</button>
            <button data-view="Submissions" data-state="inactive" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">Submissions</button>
        `;
        togglesWrapper.appendChild(primaryToggleContainer);
        
        // Secondary View Toggle
        const secondaryToggleContainer = document.createElement('div');
        secondaryToggleContainer.id = 'bento-history-secondary-toggle';
        secondaryToggleContainer.className = 'text-sd-muted-foreground inline-flex items-center justify-center bg-sd-muted rounded-full p-[1px]';
        secondaryToggleContainer.innerHTML = `
            <button data-view="Language" data-state="inactive" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">Language</button>
            <button data-view="Difficulty" data-state="active" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">Difficulty</button>
            <button data-view="Status" data-state="inactive" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">Status</button>
        `;
        togglesWrapper.appendChild(secondaryToggleContainer);
        controlsContainer.appendChild(togglesWrapper);

        // Date Pickers
        const datePickers = document.createElement('div');
        datePickers.id = 'history-date-pickers';
        datePickers.className = 'flex gap-2 items-center mt-2';
        datePickers.innerHTML = `
            <input type="date" id="bento-history-start-date" class="bg-dark-layer-0 rounded p-1 text-sm text-gray-300 border border-dark-divider-3">
            <span class="text-gray-400">-</span>
            <input type="date" id="bento-history-end-date" class="bg-dark-layer-0 rounded p-1 text-sm text-gray-300 border border-dark-divider-3">
        `;
        controlsContainer.appendChild(datePickers);

        // Main Checkbox
        const historyCheckboxCallback = (isChecked: boolean) => {
            controlsContainer.style.display = isChecked ? 'block' : 'none';
        };
        const checkboxContainer = createCheckbox('bento-checkbox-history', 'Show History Chart', 'historyToggle', 'true', 'bento-history-checkbox', historyCheckboxCallback);
        
        historyContent.appendChild(checkboxContainer);
        historyContent.appendChild(controlsContainer);

        // Set up event listeners for toggles
        document.querySelectorAll('#bento-history-primary-toggle button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                document.querySelectorAll('#bento-history-primary-toggle button').forEach(b => b.setAttribute('data-state', 'inactive'));
                target.setAttribute('data-state', 'active');
                debouncedRenderBentoPreview();
            });
        });

        document.querySelectorAll('#bento-history-secondary-toggle button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                document.querySelectorAll('#bento-history-secondary-toggle button').forEach(b => b.setAttribute('data-state', 'inactive'));
                target.setAttribute('data-state', 'active');
                debouncedRenderBentoPreview();
            });
        });

        // Set up date pickers
        const startDateInput = datePickers.querySelector('#bento-history-start-date') as HTMLInputElement;
        const endDateInput = datePickers.querySelector('#bento-history-end-date') as HTMLInputElement;
        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        endDateInput.valueAsDate = today;
        startDateInput.valueAsDate = oneYearAgo;
        
        startDateInput.addEventListener('change', debouncedRenderBentoPreview);
        endDateInput.addEventListener('change', debouncedRenderBentoPreview);
    }

    if (recordsContent && legacyStats?.records && processedDataCache) {
        recordsContent.innerHTML = '';
        const solvedStats = getSolvedStats(processedDataCache);
        const overallProgressCheckbox = createCheckbox(`bento-checkbox-record-overall-progress`, "Overall Progress", 'recordName', "Overall Progress", 'bento-record-checkbox');
        const overallProgressStat = document.createElement('div');
        overallProgressStat.className = 'text-sm text-label-3 dark:text-dark-label-3 pl-4';
        overallProgressStat.textContent = `${solvedStats.totalSolved} Solved`;
        overallProgressStat.style.pointerEvents = 'none';
        overallProgressCheckbox.appendChild(overallProgressStat);
        recordsContent.appendChild(overallProgressCheckbox);

        legacyStats.records.forEach(record => {
            if (record && record.name) {
                const checkboxRow = createCheckbox(
                    `bento-checkbox-record-${record.name.replace(/\s+/g, '-')}`, 
                    record.name, 
                    'recordName', 
                    record.name, 
                    'bento-record-checkbox'
                );

                const leftSide = checkboxRow.firstElementChild as HTMLElement;
                if (leftSide) {
                    leftSide.classList.remove('w-full', 'max-w-[192px]', 'flex-1');
                    leftSide.classList.add('flex-grow');
                }

                const statValue = record.mainStat || record.value?.toString() || '';
                
                if (statValue) {
                    const statContainer = document.createElement('div');
                    statContainer.className = 'text-sm text-label-3 dark:text-dark-label-3 pl-4';
                    statContainer.textContent = statValue;
                    statContainer.style.pointerEvents = 'none';
                    checkboxRow.appendChild(statContainer);
                }
                
                recordsContent.appendChild(checkboxRow);
            }
        });
    }

    if (trophiesContent && legacyStats?.trophies) {
        trophiesContent.innerHTML = '';
        legacyStats.trophies.filter(t => t.achieved).forEach(trophy => {
            if (trophy && trophy.id && trophy.title) {
                const checkboxRow = createCheckbox(`bento-checkbox-trophy-${trophy.id}`, trophy.title, 'trophyId', trophy.id, 'bento-trophy-checkbox');
                
                const leftSide = checkboxRow.firstElementChild as HTMLElement;
                if (leftSide) {
                    leftSide.classList.remove('w-full', 'max-w-[192px]', 'flex-1');
                    leftSide.classList.add('flex-grow');
                }

                const subtitleContainer = document.createElement('div');
                subtitleContainer.className = 'text-sm text-label-3 dark:text-dark-label-3 pl-4 truncate';
                subtitleContainer.textContent = trophy.subtitle;
                subtitleContainer.style.pointerEvents = 'none';
                checkboxRow.appendChild(subtitleContainer);
                
                trophiesContent.appendChild(checkboxRow);
            }
        });
    }

    if (milestonesContent && legacyStats?.milestones) {
        milestonesContent.innerHTML = '';
        legacyStats.milestones.forEach((milestone, index) => {
            if (milestone) {
                const labelText = `${milestone.milestone}${getOrdinalSuffix(milestone.milestone)} ${formatMilestoneType(milestone.type)}`;
                const checkboxRow = createCheckbox(`bento-checkbox-milestone-${index}`, labelText, 'milestoneIndex', index.toString(), 'bento-milestone-checkbox');
                
                const dateContainer = document.createElement('div');
                dateContainer.className = 'text-sm text-label-3 dark:text-dark-label-3 pl-4';
                dateContainer.textContent = milestone.date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                dateContainer.style.pointerEvents = 'none';
                checkboxRow.appendChild(dateContainer);

                milestonesContent.appendChild(checkboxRow);
            }
        });
    }

    if (skillsContent && skillMatrixData?.topics) {
        skillsContent.innerHTML = ''; // Clear previous content

        const header = document.createElement('div');
        header.className = 'flex w-full items-center justify-between rounded-lg px-2 py-[5px] text-xs text-label-3 dark:text-dark-label-3';
        header.innerHTML = `
            <div class="w-3/5 pl-8 font-medium">Topic</div>
            <div class="flex w-2/5 justify-end text-center font-medium">
                <span class="w-1/3" title="Problems Solved">Solved</span>
                <span class="w-1/3" title="Average Attempts">Avg. Attempts</span>
                <span class="w-1/3" title="First Ace Rate">First Ace %</span>
            </div>
        `;
        skillsContent.appendChild(header);

        const metrics = skillMatrixData.metrics;
        skillMatrixData.topics.forEach(topic => {
            if (topic) {
                const checkboxRow = createCheckbox(
                    `bento-checkbox-skill-${topic}`, 
                    formatTopicName(topic), 
                    'skillName', 
                    topic, 
                    'bento-skill-checkbox'
                );

                const leftSide = checkboxRow.firstElementChild as HTMLElement;
                if (leftSide) {
                    leftSide.classList.remove('w-full', 'max-w-[192px]', 'flex-1', 'truncate');
                    leftSide.classList.add('w-3/5');
                    const textContainer = leftSide.querySelector('.truncate');
                    textContainer?.classList.remove('truncate');
                }
                
                const solved = metrics.problemsSolved[topic] || 0;
                const avgTries = metrics.avgTries[topic];
                const firstAce = metrics.firstAceRate[topic] || 0;

                const metricsContainer = document.createElement('div');
                metricsContainer.className = 'flex w-2/5 justify-end text-center text-sm items-center';
                metricsContainer.style.pointerEvents = 'none'; 
                metricsContainer.innerHTML = `
                    <span class="w-1/3">${solved}</span>
                    <span class="w-1/3">${avgTries === Infinity ? '∞' : avgTries.toFixed(1)}</span>
                    <span class="w-1/3">${firstAce.toFixed(0)}%</span>
                `;

                checkboxRow.appendChild(metricsContainer);
                
                skillsContent.appendChild(checkboxRow);
            }
        });
    }

    if (activityContent) {
        activityContent.innerHTML = '';
        const ACTIVITY_CHARTS = ["Submission Signature", "Language Stats", "Progress Tracker", "Coding Clock"];
        ACTIVITY_CHARTS.forEach(name => {
            if (name === "Coding Clock") {
                const controlsContainer = document.createElement('div');
                controlsContainer.id = 'coding-clock-controls-container';
                controlsContainer.className = 'space-y-2 mt-1 pl-8';
                controlsContainer.style.display = 'none'; // Initially hidden

                const toggleContainer = document.createElement('div');
                toggleContainer.id = 'bento-coding-clock-toggle';
                toggleContainer.className = 'text-sd-muted-foreground inline-flex items-center justify-center bg-sd-muted rounded-full p-[1px]';
                toggleContainer.innerHTML = `
                    <button data-view="HourOfDay" data-state="active" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">Hourly</button>
                    <button data-view="DayOfWeek" data-state="inactive" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">Weekly</button>
                `;
                controlsContainer.appendChild(toggleContainer);

                const checkboxCallback = (isChecked: boolean) => {
                    controlsContainer.style.display = isChecked ? 'block' : 'none';
                };

                const checkboxContainer = createCheckbox(`bento-checkbox-activity-${name.replace(/\s+/g, '-')}`, name, 'activityName', name, 'bento-activity-checkbox', checkboxCallback);
                
                activityContent.appendChild(checkboxContainer);
                activityContent.appendChild(controlsContainer);

                // Add event listeners for the new toggle
                document.querySelectorAll('#bento-coding-clock-toggle button').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const target = e.currentTarget as HTMLElement;
                        document.querySelectorAll('#bento-coding-clock-toggle button').forEach(b => b.setAttribute('data-state', 'inactive'));
                        target.setAttribute('data-state', 'active');
                        debouncedRenderBentoPreview();
                    });
                });
            } else {
                activityContent.appendChild(createCheckbox(`bento-checkbox-activity-${name.replace(/\s+/g, '-')}`, name, 'activityName', name, 'bento-activity-checkbox'));
            }
        });
    }
}


function createCheckbox(id: string, text: string, dataAttribute: string, dataValue: string, customClass: string, onClickCallback?: (isChecked: boolean) => void): HTMLElement {
    const container = document.createElement('div');
    container.className = 'flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-[5px] text-label-1 dark:text-dark-label-1 hover:bg-sd-accent';
    
    const leftSide = document.createElement('div');
    leftSide.className = 'text-md flex w-full max-w-[192px] flex-1 items-center space-x-2 truncate';

    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = `${customClass} border-sd-primary focus-visible:ring-sd-ring data-[state=checked]:bg-sd-primary data-[state=checked]:text-sd-primary-foreground rounded-sm peer h-4 w-4 shrink-0 border focus-visible:outline-none focus-visible:ring-1`;
    button.setAttribute('role', 'checkbox');
    button.setAttribute('aria-checked', 'false');
    button.dataset.state = 'unchecked';
    
    button.dataset[dataAttribute] = dataValue;

    const checkmarkSpanHTML = `
        <span data-state="checked" class="flex items-center justify-center text-current" style="pointer-events: none;">
            <div class="relative before:block before:h-3 before:w-3 h-2 w-2 text-[8px]">
                <svg aria-hidden="true" focusable="false" data-prefix="far" data-icon="check" class="svg-inline--fa fa-check absolute left-1/2 top-1/2 h-[1em] -translate-x-1/2 -translate-y-1/2 align-[-0.125em]" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
                    <path fill="currentColor" d="M441 103c9.4 9.4 9.4 24.6 0 33.9L177 401c-9.4 9.4-24.6 9.4-33.9 0L7 265c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l119 119L407 103c9.4-9.4 24.6-9.4 33.9 0z"></path>
                </svg>
            </div>
        </span>
    `;

    const textContainer = document.createElement('div');
    textContainer.className = 'truncate';
    const textSpan = document.createElement('span');
    textSpan.className = '';
    textSpan.textContent = text;
    textContainer.appendChild(textSpan);

    leftSide.appendChild(button);
    leftSide.appendChild(textContainer);
    container.appendChild(leftSide);

    const toggleCheckbox = () => {
        const isChecked = button.getAttribute('aria-checked') === 'true';
        const newStateIsChecked = !isChecked;
        
        if (newStateIsChecked) {
            button.setAttribute('aria-checked', 'true');
            button.dataset.state = 'checked';
            button.innerHTML = checkmarkSpanHTML;
        } else {
            button.setAttribute('aria-checked', 'false');
            button.dataset.state = 'unchecked';
            button.innerHTML = '';
        }
        
        if (onClickCallback) {
            onClickCallback(newStateIsChecked);
        }

        debouncedRenderBentoPreview();
    };

    container.addEventListener('click', toggleCheckbox);
    
    return container;
}
