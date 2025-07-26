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
import { colors } from '../theme/colors';
import html2canvas from 'html2canvas';

// --- Module-level state ---
let legacyStats: LegacyStats | null = null;
let skillMatrixData: SkillMatrixData | null = null;
let processedDataCache: ProcessedData | null = null;
let currentPreviewBlob: Blob | null = null;
let isRendering = false;
let usernameCache = '';

// Define the available activity charts
const ACTIVITY_CHARTS = [
    "Submission Signature",
    "Language Stats",
    "Progress Tracker",
    "Coding Clock",
];

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

function getSmartCumulativeView(timeRange: TimeRange, processedData: ProcessedData): CumulativeView {
    if (timeRange === 'Last 30 Days' || timeRange === 'Last 90 Days') return 'Daily';
    if (timeRange === 'Last 365 Days') return 'Monthly';
    if (processedData.submissions.length > 1) {
        const firstSub = processedData.submissions.reduce((a, b) => a.date < b.date ? a : b);
        const lastSub = processedData.submissions.reduce((a, b) => a.date > b.date ? a : b);
        const dayDifference = (lastSub.date.getTime() - firstSub.date.getTime()) / (1000 * 3600 * 24);
        if (dayDifference > 365 * 4) return 'Yearly';
        if (dayDifference > 90) return 'Monthly';
    }
    return 'Daily';
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
        // --- 1. GATHER SELECTIONS ---
        const historyCheckbox = document.getElementById('bento-checkbox-history') as HTMLInputElement;
        const showHistory = historyCheckbox?.checked;
        const startDateInput = document.getElementById('bento-history-start-date') as HTMLInputElement;
        const endDateInput = document.getElementById('bento-history-end-date') as HTMLInputElement;
        const historyStartDate = startDateInput?.valueAsDate;
        const historyEndDate = endDateInput?.valueAsDate;

        const selectedRecordNames = Array.from(document.querySelectorAll('.bento-record-checkbox:checked')).map(cb => (cb as HTMLElement).dataset.recordName);
        const showOverallProgress = selectedRecordNames.includes("Overall Progress");
        const selectedRecords = legacyStats.records.filter(r => selectedRecordNames.includes(r.name) && r.name !== "Overall Progress");

        const selectedTrophyIds = Array.from(document.querySelectorAll('.bento-trophy-checkbox:checked')).map(cb => (cb as HTMLElement).dataset.trophyId);
        const selectedTrophies = legacyStats.trophies.filter(t => t.achieved && selectedTrophyIds.includes(t.id));

        const selectedMilestoneIndices = Array.from(document.querySelectorAll('.bento-milestone-checkbox:checked')).map(cb => parseInt((cb as HTMLElement).dataset.milestoneIndex || '-1'));
        const selectedMilestones = legacyStats.milestones.filter((m, index) => selectedMilestoneIndices.includes(index));

        const selectedSkillNames = Array.from(document.querySelectorAll('.bento-skill-checkbox:checked'))
            .map(cb => (cb as HTMLElement).dataset.skillName)
            .filter((name): name is string => !!name);
        
        const selectedActivityNames = Array.from(document.querySelectorAll('.bento-activity-checkbox:checked')).map(cb => (cb as HTMLElement).dataset.activityName);

        // --- 2. CREATE HTML STRUCTURE OFF-SCREEN ---
        const offscreenContainer = document.createElement('div');
        offscreenContainer.style.position = 'absolute';
        offscreenContainer.style.left = '-9999px';
        offscreenContainer.style.top = '0px';
        offscreenContainer.style.width = `${RENDER_WIDTH}px`;
        offscreenContainer.style.height = `${RENDER_HEIGHT}px`;

        offscreenContainer.innerHTML = `
            <div id="bento-render-node" class="render-safe" style="width: 100%; height: 100%; background: radial-gradient(circle, #282828 0%, #1a1a1a 100%); display: flex; flex-direction: column;">
                <div id="bento-header">${usernameCache}'s LeetStats</div>
                <div id="bento-grid-wrapper"><div id="bento-grid"></div></div>
                <div id="bento-footer">Generated by LeetStats Extension</div>
            </div>`;
        
        const grid = offscreenContainer.querySelector('#bento-grid')!;
        
        // --- ADD CARDS TO GRID ---
        if (showHistory && historyStartDate && historyEndDate) {
            const card = document.createElement('div');
            card.className = 'bento-card';
            card.style.gridColumn = 'span 6';
            card.style.gridRow = 'span 5';
            card.innerHTML = `<h3 class="bento-card-title">History</h3><div class="bento-card-content"><div class="chart-container" style="height: 100%;"><canvas id="bento-history-chart-canvas"></canvas></div></div>`;
            grid.appendChild(card);
        }
        if (showOverallProgress) {
            const card = document.createElement('div');
            card.className = 'bento-card';
            card.style.gridColumn = 'span 3';
            card.style.gridRow = 'span 4';
            card.innerHTML = `<div class="bento-card-content progress-ring-container" id="bento-progress-ring-container"></div>`;
            grid.appendChild(card);
        }
        if (selectedRecords.length > 0) {
            const card = document.createElement('div');
            card.className = 'bento-card';
            card.style.gridColumn = 'span 6';
            card.style.width = 'fit-content';
            card.style.justifySelf = 'center';
            let html = `<h3 class="bento-card-title">Records</h3><div class="bento-card-content">`;
            selectedRecords.forEach(r => { html += `<div class="record-item"><span class="record-label">${r.name}</span><div class="record-value"><span>${r.mainStat || r.value}</span><span class="record-context">${r.dateStat || ''}</span></div></div>`; });
            html += `</div>`;
            card.innerHTML = html;
            grid.appendChild(card);
        }
        if (selectedTrophies.length > 0) {
            const card = document.createElement('div');
            card.className = 'bento-card';
            card.style.gridColumn = 'span 6';
            card.style.width = 'fit-content';
            card.style.justifySelf = 'center';
            let html = `<h3 class="bento-card-title">Trophies</h3><div class="bento-card-content">`;
            selectedTrophies.forEach(t => { html += `<div class="trophy-item"><img src="${chrome.runtime.getURL(t.icon)}" alt="${t.title}" class="trophy-icon" /><div class="trophy-details"><div class="trophy-title">${t.title}</div><div class="trophy-subtitle">${t.subtitle}</div>${t.problemSlug !== 'placeholder' ? `<a href="https://leetcode.com/problems/${t.problemSlug}/" class="trophy-problem">${t.problemTitle}</a>` : ''}${t.personalNote ? `<div class="trophy-note">${t.personalNote}</div>` : ''}</div></div>`; });
            html += `</div>`;
            card.innerHTML = html;
            grid.appendChild(card);
        }
        if (selectedMilestones.length > 0) {
            const card = document.createElement('div');
            card.className = 'bento-card';
            card.style.gridColumn = 'span 6';
            card.style.width = 'fit-content';
            card.style.justifySelf = 'center';
            let html = `<h3 class="bento-card-title">Milestones</h3><div class="bento-card-content"><div class="milestone-timeline"><div class="timeline-line"></div><div class="milestone-list">`;
            selectedMilestones.forEach(m => {
                const color = getMilestoneColor(m.type);
                html += `<div class="milestone-item"><div class="milestone-dot" style="background-color: ${color};"></div><div class="milestone-event" style="color: ${color};">${m.milestone}${getOrdinalSuffix(m.milestone)} ${formatMilestoneType(m.type)}</div><div class="milestone-date">${m.date.toLocaleDateString('en-GB')}</div>${m.problemTitle ? `<a href="https://leetcode.com/problems/${m.problemSlug}/" class="milestone-problem">${m.problemTitle}</a>` : ''}</div>`;
            });
            html += `</div></div></div>`;
            card.innerHTML = html;
            grid.appendChild(card);
        }
        if (selectedSkillNames.length > 0) {
            const card = document.createElement('div');
            card.className = 'bento-card';
            card.style.gridColumn = 'span 6';
            let html = `<h3 class="bento-card-title">Skills</h3><div class="bento-card-content"><div class="skills-table"><div class="skills-header"><div class="skill-cell" style="text-align: left;">Topic</div><div class="skill-cell">Solved</div><div class="skill-cell">Avg. Attempts</div><div class="skill-cell">First Ace</div></div>`;
            selectedSkillNames.forEach(skill => {
                const metrics = currentSkillMatrixData.metrics;
                const solved = metrics.problemsSolved[skill] || 0;
                const avgTries = metrics.avgTries[skill];
                const firstAce = metrics.firstAceRate[skill] || 0;
                html += `<div class="skill-row"><div class="skill-cell" style="text-align: left;">${formatTopicName(skill)}</div><div class="skill-cell">${solved}</div><div class="skill-cell">${avgTries === Infinity ? '∞' : avgTries.toFixed(1)}</div><div class="skill-cell">${firstAce.toFixed(0)}%</div></div>`;
            });
            html += `</div></div>`;
            card.innerHTML = html;
            grid.appendChild(card);
        }
        if (selectedActivityNames.includes("Progress Tracker")) {
            const card = document.createElement('div');
            card.className = 'bento-card';
            card.style.gridColumn = 'span 6';
            card.style.gridRow = 'span 4';
            card.innerHTML = `<h3 class="bento-card-title">Progress Tracker</h3><div class="bento-card-content"><div class="chart-container"><canvas id="bento-progress-tracker-canvas"></canvas></div></div>`;
            grid.appendChild(card);
        }
        if (selectedActivityNames.includes("Coding Clock")) {
            const card = document.createElement('div');
            card.className = 'bento-card';
            card.style.gridColumn = 'span 6';
            card.style.gridRow = 'span 4';
            card.innerHTML = `<h3 class="bento-card-title">Coding Clock</h3><div class="bento-card-content"><div class="chart-container"><canvas id="bento-coding-clock-canvas"></canvas></div></div>`;
            grid.appendChild(card);
        }
        if (selectedActivityNames.includes("Submission Signature")) {
            const card = document.createElement('div');
            card.className = 'bento-card';
            card.style.gridColumn = 'span 3';
            card.style.gridRow = 'span 4';
            card.innerHTML = `<h3 class="bento-card-title">Submission Signature</h3><div class="bento-card-content"><div class="chart-container"><canvas id="bento-submission-signature-canvas"></canvas></div></div>`;
            grid.appendChild(card);
        }
        if (selectedActivityNames.includes("Language Stats")) {
            const card = document.createElement('div');
            card.className = 'bento-card';
            card.style.gridColumn = 'span 3';
            card.style.gridRow = 'span 4';
            card.innerHTML = `<h3 class="bento-card-title">Language Stats</h3><div class="bento-card-content"><div class="chart-container"><canvas id="bento-language-stats-canvas"></canvas></div></div>`;
            grid.appendChild(card);
        }

        document.body.appendChild(offscreenContainer);
        const renderNode = document.getElementById('bento-render-node') as HTMLElement;

        // --- 3. RENDER CHARTS & COMPONENTS ---
        if (showHistory && historyStartDate && historyEndDate) {
            const chartContainer = offscreenContainer.querySelector('#bento-history-chart-canvas')?.parentElement;
            if (chartContainer) {
                const bentoInteractiveFilters: InteractiveChartFilters = { primaryView: 'Problems Solved', secondaryView: 'Difficulty', timeRange: 'All Time', difficulty: 'All', brushWindow: [historyStartDate, historyEndDate] };
                renderOrUpdateInteractiveChart(chartContainer as HTMLElement, processedDataCache, bentoInteractiveFilters, undefined, { isBentoMode: true });
            }
        }
        if (showOverallProgress) {
            const ringContainer = offscreenContainer.querySelector('#bento-progress-ring-container');
            if (ringContainer) {
                const stats = getSolvedStats(processedDataCache);
                renderProgressRing(ringContainer as HTMLElement, stats);
            }
        }
        if (selectedActivityNames.includes("Progress Tracker")) {
            const chartContainer = offscreenContainer.querySelector('#bento-progress-tracker-canvas')?.parentElement;
            if (chartContainer) {
                const cumulativeView = getSmartCumulativeView('All Time', processedDataCache);
                const stats = getCumulativeStats(processedDataCache, { timeRange: 'All Time', difficulty: 'All', cumulativeView });
                if (stats) renderOrUpdateCumulativeLineChart(chartContainer as HTMLElement, stats, { timeRange: 'All Time', difficulty: 'All', cumulativeView }, undefined, { isInteractive: false });
            }
        }
        if (selectedActivityNames.includes("Coding Clock")) {
            const chartContainer = offscreenContainer.querySelector('#bento-coding-clock-canvas')?.parentElement;
            if (chartContainer) {
                const stats = getCodingClockStats(processedDataCache, { timeRange: 'All Time', difficulty: 'All', clockView: 'HourOfDay' });
                renderOrUpdateStackedBarChart(chartContainer as HTMLElement, stats, undefined, { isInteractive: false });
            }
        }
        if (selectedActivityNames.includes("Submission Signature")) {
            const chartContainer = offscreenContainer.querySelector('#bento-submission-signature-canvas')?.parentElement;
            if (chartContainer) {
                const stats = getSubmissionSignatureStats(processedDataCache, { timeRange: 'All Time', difficulty: 'All' });
                renderOrUpdateDoughnutChart(chartContainer as HTMLElement, stats, { difficulty: 'All' }, undefined, { isInteractive: false });
            }
        }
        if (selectedActivityNames.includes("Language Stats")) {
            const chartContainer = offscreenContainer.querySelector('#bento-language-stats-canvas')?.parentElement;
            if (chartContainer) {
                const stats = getLanguageStats(processedDataCache, { timeRange: 'All Time', difficulty: 'All' });
                renderOrUpdateHorizontalBarChart(chartContainer as HTMLElement, stats, { difficulty: 'All' }, undefined, { isInteractive: false });
            }
        }
        
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