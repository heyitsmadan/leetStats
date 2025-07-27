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
import html2canvas from 'html2canvas';

// --- Module-level state ---
let legacyStats: LegacyStats | null = null;
let skillMatrixData: SkillMatrixData | null = null;
let processedDataCache: ProcessedData | null = null;
let currentPreviewBlob: Blob | null = null;
let isRendering = false;
let usernameCache = '';

// Define fixed dimensions for high-resolution 9:16 rendering
const RENDER_WIDTH = 900;
const RENDER_HEIGHT = 1600;

// --- Helper functions ---
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
            history: (document.getElementById('bento-checkbox-history') as HTMLInputElement)?.checked,
            records: Array.from(document.querySelectorAll('.bento-record-checkbox:checked')).map(cb => (cb as HTMLElement).dataset.recordName),
            trophies: Array.from(document.querySelectorAll('.bento-trophy-checkbox:checked')).map(cb => (cb as HTMLElement).dataset.trophyId),
            milestones: Array.from(document.querySelectorAll('.bento-milestone-checkbox:checked')).map(cb => parseInt((cb as HTMLElement).dataset.milestoneIndex || '-1')),
            skills: Array.from(document.querySelectorAll('.bento-skill-checkbox:checked')).map(cb => (cb as HTMLElement).dataset.skillName).filter((name): name is string => !!name),
            activities: Array.from(document.querySelectorAll('.bento-activity-checkbox:checked')).map(cb => (cb as HTMLElement).dataset.activityName),
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
        const largeItems = Object.keys(componentDefinitions).filter(key => componentDefinitions[key as keyof typeof componentDefinitions].type === 'large' && componentDefinitions[key as keyof typeof componentDefinitions].condition);
        const mediumItems = Object.keys(componentDefinitions).filter(key => componentDefinitions[key as keyof typeof componentDefinitions].type === 'medium' && componentDefinitions[key as keyof typeof componentDefinitions].condition);
        const smallItems = Object.keys(componentDefinitions).filter(key => componentDefinitions[key as keyof typeof componentDefinitions].type === 'small' && componentDefinitions[key as keyof typeof componentDefinitions].condition);
        const squareItems = Object.keys(componentDefinitions).filter(key => componentDefinitions[key as keyof typeof componentDefinitions].type === 'square' && componentDefinitions[key as keyof typeof componentDefinitions].condition);

        // --- 3. CREATE HTML STRUCTURE OFF-SCREEN ---
        const offscreenContainer = document.createElement('div');
        offscreenContainer.style.position = 'absolute';
        offscreenContainer.style.left = '-9999px';
        offscreenContainer.style.top = '0px';
        offscreenContainer.style.width = `${RENDER_WIDTH}px`;
        offscreenContainer.style.height = `${RENDER_HEIGHT}px`;

        offscreenContainer.innerHTML = `
            <div id="bento-render-node" class="render-safe" style="width: 100%; height: 100%; background: radial-gradient(circle, #282828 0%, #1a1a1a 100%); display: flex; flex-direction: column;">
                <div id="bento-header">${usernameCache}'s LeetStats</div>
                <div id="bento-grid-wrapper"><div id="bento-grid" style="grid-template-columns: repeat(4, 1fr);"></div></div>
                <div id="bento-footer">Generated by LeetStats Extension</div>
            </div>`;
        
        const grid = offscreenContainer.querySelector('#bento-grid')!;
        
        // --- 4. LAYOUT ENGINE: Place components onto the grid ---
        
        // Rule 1: Place all large items first, each in its own row
        largeItems.forEach(key => {
            const card = createCardElement(key, 4);
            grid.appendChild(card);
        });
        
        // Rule 2: Pack the remaining items into rows
        const remainingItems = [...mediumItems, ...smallItems, ...squareItems];
        let currentRowColumns = 0;

        while (remainingItems.length > 0) {
            let itemPlacedInRow = false;
            // Create a prioritized list of item types to try and place
            const placementOrder = ['medium', 'small', 'square'];
            
            for (const itemType of placementOrder) {
                const itemIndex = remainingItems.findIndex(key => componentDefinitions[key as keyof typeof componentDefinitions].type === itemType);
                if (itemIndex !== -1) {
                    const itemKey = remainingItems[itemIndex];
                    const itemDef = componentDefinitions[itemKey as keyof typeof componentDefinitions];
                    if (currentRowColumns + itemDef.span <= 4) {
                        const card = createCardElement(itemKey, itemDef.span);
                        grid.appendChild(card);
                        currentRowColumns += itemDef.span;
                        remainingItems.splice(itemIndex, 1);
                        itemPlacedInRow = true;
                    }
                }
            }

            // If we've filled the row, or if we can't fit any more items, start a new row
            if (currentRowColumns >= 4 || !itemPlacedInRow) {
                currentRowColumns = 0;
            }
            
            // Failsafe: if no item was placed but items remain, force the largest remaining item into a new row
            if (!itemPlacedInRow && remainingItems.length > 0) {
                 const nextItemKey = remainingItems.shift()!;
                 const nextItemDef = componentDefinitions[nextItemKey as keyof typeof componentDefinitions];
                 const card = createCardElement(nextItemKey, 4); // Place it in a full row
                 grid.appendChild(card);
                 currentRowColumns = 0;
            }
        }


        document.body.appendChild(offscreenContainer);
        const renderNode = document.getElementById('bento-render-node') as HTMLElement;

        // --- 5. RENDER CHARTS & COMPONENTS ---
        await renderComponentContent(offscreenContainer, selections, currentSkillMatrixData);
        
        await new Promise(resolve => setTimeout(resolve, 50));
        const generatedCanvas = await html2canvas(renderNode, { backgroundColor: null, useCORS: true, width: RENDER_WIDTH, height: RENDER_HEIGHT, scale: 1 });

        const ctx = previewCanvas.getContext('2d');
        if (ctx) {
            previewCanvas.width = generatedCanvas.width;
            previewCanvas.height = generatedCanvas.height;
            ctx.drawImage(generatedCanvas, 0, 0);
        }
        generatedCanvas.toBlob((blob) => {
            currentPreviewBlob = blob;
            if (shareBtn) shareBtn.removeAttribute('disabled');
        }, 'image/png');

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

// Helper to create the basic card structure
function createCardElement(key: string, span: number): HTMLElement {
    const card = document.createElement('div');
    card.className = 'bento-card';
    card.style.gridColumn = `span ${span}`;
    card.id = `bento-card-${key}`; // Assign a unique ID for content rendering
    return card;
}

// Helper to populate cards with their specific content
async function renderComponentContent(container: HTMLElement, selections: any, skillData: SkillMatrixData) {
    if (!legacyStats || !processedDataCache) return;

    const { history, records, trophies, milestones, skills, activities } = selections;
    const historyStartDate = (document.getElementById('bento-history-start-date') as HTMLInputElement)?.valueAsDate;
    const historyEndDate = (document.getElementById('bento-history-end-date') as HTMLInputElement)?.valueAsDate;
    
    // Render History
    if (history && historyStartDate && historyEndDate) {
        const card = container.querySelector('#bento-card-history');
        if (card) {
            card.innerHTML = `<h3 class="bento-card-title">Activity: ${historyStartDate.toLocaleDateString()} - ${historyEndDate.toLocaleDateString()}</h3><div class="bento-card-content"><div class="chart-container" style="height: 100%;"><canvas id="bento-history-chart-canvas"></canvas></div></div>`;
            const chartContainer = card.querySelector('.chart-container');
            const bentoInteractiveFilters: InteractiveChartFilters = { primaryView: 'Problems Solved', secondaryView: 'Difficulty', timeRange: 'All Time', difficulty: 'All', brushWindow: [historyStartDate, historyEndDate] };
            renderOrUpdateInteractiveChart(chartContainer as HTMLElement, processedDataCache, bentoInteractiveFilters, undefined, { isBentoMode: true });
        }
    }

    // Render Overall Progress
    if (records.includes("Overall Progress")) {
        const card = container.querySelector('#bento-card-overallProgress');
        if (card) {
            card.innerHTML = `<div class="bento-card-content progress-ring-container" id="bento-progress-ring-container"></div>`;
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
            let html = `<div class="bento-card-content">`;
            selectedRecords.forEach(r => { html += `<div class="record-item"><span class="record-label">${r.name}</span><div class="record-value"><span>${r.mainStat || r.value}</span><span class="record-context">${r.dateStat || ''}</span></div></div>`; });
            html += `</div>`;
            card.innerHTML = html;
        }
    }

    // Render Trophies
    const selectedTrophies = legacyStats.trophies.filter(t => t.achieved && trophies.includes(t.id));
    if (selectedTrophies.length > 0) {
        const card = container.querySelector('#bento-card-trophies');
        if (card) {
            let html = `<div class="bento-card-content">`;
            selectedTrophies.forEach(t => { html += `<div class="trophy-item"><img src="${chrome.runtime.getURL(t.icon)}" alt="${t.title}" class="trophy-icon" /><div class="trophy-details"><div class="trophy-title">${t.title}</div><div class="trophy-subtitle">${t.subtitle}</div>${t.problemSlug !== 'placeholder' ? `<a href="https://leetcode.com/problems/${t.problemSlug}/" class="trophy-problem">${t.problemTitle}</a>` : ''}</div></div>`; });
            html += `</div>`;
            card.innerHTML = html;
        }
    }
    
    // Render Milestones
    const selectedMilestones = legacyStats.milestones.filter((m, index) => milestones.includes(index));
    if (selectedMilestones.length > 0) {
        const card = container.querySelector('#bento-card-milestones');
        if (card) {
            let html = `<div class="bento-card-content"><div class="milestone-timeline"><div class="timeline-line"></div><div class="milestone-list">`;
            selectedMilestones.forEach(m => {
                const color = getMilestoneColor(m.type);
                html += `<div class="milestone-item"><div class="milestone-dot" style="background-color: ${color};"></div><div class="milestone-event" style="color: ${color};">${m.milestone}${getOrdinalSuffix(m.milestone)} ${formatMilestoneType(m.type)}</div><div class="milestone-date">${m.date.toLocaleDateString('en-GB')}</div>${m.problemTitle ? `<a href="https://leetcode.com/problems/${m.problemSlug}/" class="milestone-problem">${m.problemTitle}</a>` : ''}</div>`;
            });
            html += `</div></div></div>`;
            card.innerHTML = html;
        }
    }

    // Render Skills
    if (skills.length > 0) {
        const card = container.querySelector('#bento-card-skills');
        if (card) {
            let html = `<div class="bento-card-content"><div class="skills-table"><div class="skills-header"><div class="skill-cell" style="text-align: left;">Topic</div><div class="skill-cell">Solved</div><div class="skill-cell">Avg. Attempts</div><div class="skill-cell">First Ace</div></div>`;
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
            card.innerHTML = `<h3 class="bento-card-title">Problems Solved Over Time</h3><div class="bento-card-content"><div class="chart-container"><canvas id="bento-progress-tracker-canvas"></canvas></div></div>`;
            const chartContainer = card.querySelector('.chart-container');
            if (chartContainer) {
                const cumulativeView = getSmartCumulativeView('All Time', processedDataCache);
                const stats = getCumulativeStats(processedDataCache, { timeRange: 'All Time', difficulty: 'All', cumulativeView });
                if (stats) renderOrUpdateCumulativeLineChart(chartContainer as HTMLElement, stats, { timeRange: 'All Time', difficulty: 'All', cumulativeView }, undefined, { isInteractive: false });
            }
        }
    }
    if (activities.includes("Coding Clock")) {
        const card = container.querySelector('#bento-card-codingClock');
        if (card) {
            card.innerHTML = `<h3 class="bento-card-title">Submissions by Hour</h3><div class="bento-card-content"><div class="chart-container"><canvas id="bento-coding-clock-canvas"></canvas></div></div>`;
            const chartContainer = card.querySelector('.chart-container');
            if (chartContainer) {
                const stats = getCodingClockStats(processedDataCache, { timeRange: 'All Time', difficulty: 'All', clockView: 'HourOfDay' });
                renderOrUpdateStackedBarChart(chartContainer as HTMLElement, stats, undefined, { isInteractive: false });
            }
        }
    }
    if (activities.includes("Submission Signature")) {
        const card = container.querySelector('#bento-card-submissionSignature');
        if (card) {
            card.innerHTML = `<div class="bento-card-content"><div class="chart-container"><canvas id="bento-submission-signature-canvas"></canvas></div></div>`;
            const chartContainer = card.querySelector('.chart-container');
            if (chartContainer) {
                const stats = getSubmissionSignatureStats(processedDataCache, { timeRange: 'All Time', difficulty: 'All' });
                renderOrUpdateDoughnutChart(chartContainer as HTMLElement, stats, { difficulty: 'All' }, undefined, { isInteractive: false, legendConfig: { display: true, position: 'bottom' } });
            }
        }
    }
    if (activities.includes("Language Stats")) {
        const card = container.querySelector('#bento-card-languageStats');
        if (card) {
            card.innerHTML = `<div class="bento-card-content"><div class="chart-container"><canvas id="bento-language-stats-canvas"></canvas></div></div>`;
            const chartContainer = card.querySelector('.chart-container');
            if (chartContainer) {
                const stats = getLanguageStats(processedDataCache, { timeRange: 'All Time', difficulty: 'All' });
                renderOrUpdateHorizontalBarChart(chartContainer as HTMLElement, stats, { difficulty: 'All' }, undefined, { isInteractive: false });
            }
        }
    }
}


export function initializeBentoGenerator(data: ProcessedData, username: string) {
    processedDataCache = data;
    if (!legacyStats) legacyStats = getLegacyStats(data);
    if (!skillMatrixData) skillMatrixData = getSkillMatrixStats(data, { timeRange: 'All Time', difficulty: 'All' }, 'All Time');
    usernameCache = username;

    const generateCardBtn = document.getElementById('generate-card-btn');
    const modal = document.getElementById('bento-modal');
    const closeModalBtn = document.getElementById('bento-modal-close-btn');
    const shareBtn = document.getElementById('share-bento-btn');

    if (!generateCardBtn || !modal || !closeModalBtn || !shareBtn) return;

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
        if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({ title: 'My LeetCode Stats', text: 'Check out my LeetCode stats card!', files: [file] });
        } else {
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
        const historyCheckbox = historyContent.querySelector('#bento-checkbox-history') as HTMLInputElement;
        const datePickers = historyContent.querySelector('#history-date-pickers') as HTMLElement;
        const startDateInput = historyContent.querySelector('#bento-history-start-date') as HTMLInputElement;
        const endDateInput = historyContent.querySelector('#bento-history-end-date') as HTMLInputElement;
        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        endDateInput.valueAsDate = today;
        startDateInput.valueAsDate = oneYearAgo;
        historyCheckbox.addEventListener('change', (e) => { datePickers.style.display = (e.target as HTMLInputElement).checked ? 'block' : 'none'; renderBentoPreview(); });
        startDateInput.addEventListener('change', renderBentoPreview);
        endDateInput.addEventListener('change', renderBentoPreview);
    }

    if (recordsContent && legacyStats?.records) {
        recordsContent.innerHTML = '';
        recordsContent.appendChild(createCheckbox(`bento-checkbox-record-overall-progress`, "Overall Progress", 'record-name', "Overall Progress", 'bento-record-checkbox'));
        legacyStats.records.forEach(record => {
            recordsContent.appendChild(createCheckbox(`bento-checkbox-record-${record.name.replace(/\s+/g, '-')}`, record.name, 'record-name', record.name, 'bento-record-checkbox'));
        });
    }

    if (trophiesContent && legacyStats?.trophies) {
        trophiesContent.innerHTML = '';
        legacyStats.trophies.filter(t => t.achieved).forEach(trophy => {
            trophiesContent.appendChild(createCheckbox(`bento-checkbox-trophy-${trophy.id}`, trophy.title, 'trophy-id', trophy.id, 'bento-trophy-checkbox'));
        });
    }

    if (milestonesContent && legacyStats?.milestones) {
        milestonesContent.innerHTML = '';
        legacyStats.milestones.forEach((milestone, index) => {
            const labelText = `${milestone.milestone}${getOrdinalSuffix(milestone.milestone)} ${formatMilestoneType(milestone.type)}`;
            milestonesContent.appendChild(createCheckbox(`bento-checkbox-milestone-${index}`, labelText, 'milestone-index', index.toString(), 'bento-milestone-checkbox'));
        });
    }

    if (skillsContent && skillMatrixData?.topics) {
        skillsContent.innerHTML = '';
        skillMatrixData.topics.forEach(topic => {
            skillsContent.appendChild(createCheckbox(`bento-checkbox-skill-${topic}`, formatTopicName(topic), 'skill-name', topic, 'bento-skill-checkbox'));
        });
    }

    if (activityContent) {
        activityContent.innerHTML = '';
        const ACTIVITY_CHARTS = ["Submission Signature", "Language Stats", "Progress Tracker", "Coding Clock"];
        ACTIVITY_CHARTS.forEach(name => {
            activityContent.appendChild(createCheckbox(`bento-checkbox-activity-${name.replace(/\s+/g, '-')}`, name, 'activity-name', name, 'bento-activity-checkbox'));
        });
    }
}

function createCheckbox(id: string, text: string, dataAttribute: string, dataValue: string, customClass: string): HTMLLabelElement {
    const label = document.createElement('label');
    label.className = 'flex items-center space-x-3 p-2 rounded-md hover:bg-white/10 cursor-pointer';
    label.innerHTML = `<input type="checkbox" id="${id}" data-${dataAttribute}="${dataValue}" class="${customClass} form-checkbox h-4 w-4 rounded bg-transparent border-gray-500 text-blue-500 focus:ring-blue-500"><span class="text-sm text-gray-300">${text}</span>`;
    label.querySelector('input')?.addEventListener('change', renderBentoPreview);
    return label;
}