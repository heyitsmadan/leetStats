import type { ProcessedData, LegacyStats, CumulativeView, TimeRange, MilestoneData, InteractiveChartFilters, SkillMatrixData } from '../../types';
import { getLegacyStats } from '../../analysis/stats/getLegacyStats';
import { getSubmissionSignatureStats } from '../../analysis/stats/getSubmissionSignatureStats';
import { getLanguageStats } from '../../analysis/stats/getLanguageStats';
import { getCumulativeStats } from '../../analysis/stats/getCumulativeStats';
import { getCodingClockStats } from '../../analysis/stats/getCodingClockStats';
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
let latestGenerationToken = 0; // Used to track the latest render request
let usernameCache = '';
let avatarUrlCache = '';

// --- Configuration ---
const RENDER_WIDTH = 900;

// --- Helper functions ---

/**
 * Increments the generation token and calls the main render function.
 * This ensures that only the latest request will result in a UI update,
 * effectively cancelling any previously running generation tasks.
 */
function triggerRender() {
    latestGenerationToken++;
    renderBentoPreview(latestGenerationToken);
}

function getMilestoneColor(type: string): string {
    const colorMap: { [key: string]: string } = {
        'easy': colors.problems.easy,
        'medium': colors.problems.medium,
        'hard': colors.problems.hard,
        'problems_solved': colors.status.accepted,
        'submissions': '#64b5f6'
    };
    return colorMap[type] || colors.text.primary;
}

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

function getOrdinalSuffix(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = num % 100;
    return suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
}

function formatTopicName(slug: string): string {
    return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/**
 * Asynchronously renders the bento preview based on current selections.
 * It uses a token system and unique DOM element IDs to handle race conditions,
 * ensuring only the most recent render request updates the UI.
 * @param generationToken The token for this specific render request.
 */
async function renderBentoPreview(generationToken: number) {
    if (generationToken !== latestGenerationToken) {
        return;
    }

    if (!legacyStats || !processedDataCache || !skillMatrixData) {
        return;
    }

    const loader = document.getElementById('bento-preview-loader');
    const previewCanvas = document.getElementById('bento-preview-canvas') as HTMLCanvasElement;
    const copyBtn = document.getElementById('copy-bento-btn');
    const downloadBtn = document.getElementById('download-bento-btn');

    if (loader) loader.style.display = 'block';
    if (previewCanvas) previewCanvas.style.display = 'none';
    if (copyBtn) copyBtn.setAttribute('disabled', 'true');
    if (downloadBtn) downloadBtn.setAttribute('disabled', 'true');
    currentPreviewBlob = null;

    const offscreenContainer = document.createElement('div');

    try {
        const selections = {
            history: document.querySelector('#bento-checkbox-history[data-state="checked"]') !== null,
            records: Array.from(document.querySelectorAll('.bento-record-checkbox[data-state="checked"]')).map(cb => (cb as HTMLElement).dataset.recordName),
            trophies: Array.from(document.querySelectorAll('.bento-trophy-checkbox[data-state="checked"]')).map(cb => (cb as HTMLElement).dataset.trophyId),
            milestones: Array.from(document.querySelectorAll('.bento-milestone-checkbox[data-state="checked"]')).map(cb => parseInt((cb as HTMLElement).dataset.milestoneIndex || '-1')),
            skills: Array.from(document.querySelectorAll('.bento-skill-checkbox[data-state="checked"]')).map(cb => (cb as HTMLElement).dataset.skillName).filter((name): name is string => !!name),
            activities: Array.from(document.querySelectorAll('.bento-activity-checkbox[data-state="checked"]')).map(cb => (cb as HTMLElement).dataset.activityName),
        };

        const displayAvatarCheckbox = document.getElementById('bento-checkbox-display-avatar');
        const shouldDisplayAvatar = displayAvatarCheckbox ? displayAvatarCheckbox.dataset.state === 'checked' : false;

        const usernameInput = document.getElementById('bento-username-input') as HTMLInputElement;
        const currentUsername = usernameInput ? usernameInput.value : usernameCache;

        const componentDefinitions = {
            history: { condition: selections.history },
            progressTracker: { condition: selections.activities.includes('Progress Over Time') },
            codingClock: { condition: selections.activities.includes('Coding Frequency') },
            submissionSignature: { condition: selections.activities.includes('Submission Breakdown') },
            languageStats: { condition: selections.activities.includes('Language Stats') },
            trophies: { condition: selections.trophies.length > 0 },
            milestones: { condition: selections.milestones.length > 0 },
            records: { condition: selections.records.filter(r => r !== "Overall Progress").length > 0 },
            overallProgress: { condition: selections.records.includes("Overall Progress") },
            skills: { condition: selections.skills.length > 0 },
        };

        const selectedItems = Object.keys(componentDefinitions)
            .filter(key => componentDefinitions[key as keyof typeof componentDefinitions].condition);

        offscreenContainer.style.position = 'absolute';
        offscreenContainer.style.left = '-9999px';
        offscreenContainer.style.top = '0px';
        offscreenContainer.style.width = `${RENDER_WIDTH}px`;
        offscreenContainer.style.height = 'auto';

        offscreenContainer.innerHTML = `
            <div id="bento-render-node" class="render-safe">
                <div id="bento-header" style="display: flex; align-items: center; gap: 24px;"></div>
                <div id="bento-grid-wrapper"><div id="bento-grid"></div></div>
                <div id="bento-footer">made by leetStats</div>
            </div>`;

        const header = offscreenContainer.querySelector('#bento-header')!;
        if (avatarUrlCache && shouldDisplayAvatar) {
            const avatarImg = document.createElement('img');
            avatarImg.src = avatarUrlCache;
            avatarImg.alt = 'Avatar';
            avatarImg.style.cssText = 'width: 80px; height: 80px; border-radius: 16px; object-fit: cover;';
            avatarImg.setAttribute('crossorigin', 'anonymous');
            header.appendChild(avatarImg);
        }
        const titleSpan = document.createElement('span');
        titleSpan.textContent = `${currentUsername}'s leetStats`;
        header.appendChild(titleSpan);

        const grid = offscreenContainer.querySelector('#bento-grid') !;

        const promotionPriority = ['history', 'progressTracker', 'codingClock', 'overallProgress', 'submissionSignature', 'languageStats', 'trophies', 'milestones', 'records'];
        const special = ['history', 'progressTracker', 'codingClock', 'overallProgress'];
        const visualOrderPriority = ['history'];

        let componentsToLayout = [...selectedItems];
        const hasSkills = componentsToLayout.includes('skills');

        if (hasSkills) {
            componentsToLayout = componentsToLayout.filter(item => item !== 'skills');
        }

        const totalSelectedCount = selectedItems.length;
        const totalCount = componentsToLayout.length;
        const specialInLayout = componentsToLayout.filter(c => special.includes(c));
        let layoutHandled = false;

        if (!hasSkills && totalCount === 4 && specialInLayout.length >= 2) {
            const sortedSpecial = specialInLayout.sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
            const itemToPromoteTop = sortedSpecial[0];
            const itemToPromoteBottom = sortedSpecial[1];
            const middleComponents = componentsToLayout
                .filter(c => c !== itemToPromoteTop && c !== itemToPromoteBottom)
                .sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));

            grid.appendChild(createCardElement(itemToPromoteTop, 4));
            middleComponents.forEach(key => grid.appendChild(createCardElement(key, 2)));
            grid.appendChild(createCardElement(itemToPromoteBottom, 4));
            layoutHandled = true;
        } else if (!hasSkills && totalCount === 6 && specialInLayout.length >= 2) {
            const sortedSpecial = specialInLayout.sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
            const firstPromo = sortedSpecial[0];
            const secondPromo = sortedSpecial[1];

            const allPromoted = [firstPromo, secondPromo];
            const halfWidthItems = componentsToLayout.filter(c => !allPromoted.includes(c)).sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));

            grid.appendChild(createCardElement(allPromoted[0], 4));
            grid.appendChild(createCardElement(halfWidthItems[0], 2));
            grid.appendChild(createCardElement(halfWidthItems[1], 2));
            grid.appendChild(createCardElement(allPromoted[1], 4));
            grid.appendChild(createCardElement(halfWidthItems[2], 2));
            grid.appendChild(createCardElement(halfWidthItems[3], 2));
            layoutHandled = true;
        } else if (!hasSkills && totalCount === 7) {
            const firstPromo = promotionPriority.find(p => componentsToLayout.includes(p)) !;
            const remainingAfterFirstPromo = componentsToLayout.filter(c => c !== firstPromo);
            const specialInRemaining = remainingAfterFirstPromo.filter(c => special.includes(c));

            if (specialInRemaining.length >= 2) {
                const sortedSpecial = specialInRemaining.sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
                const secondPromo = sortedSpecial[0];
                const thirdPromo = sortedSpecial[1];

                const allPromoted = [firstPromo, secondPromo, thirdPromo].sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
                const halfWidthItems = componentsToLayout.filter(c => !allPromoted.includes(c)).sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));

                grid.appendChild(createCardElement(allPromoted[0], 4));
                grid.appendChild(createCardElement(halfWidthItems[0], 2));
                grid.appendChild(createCardElement(halfWidthItems[1], 2));
                grid.appendChild(createCardElement(allPromoted[1], 4));
                grid.appendChild(createCardElement(halfWidthItems[2], 2));
                grid.appendChild(createCardElement(halfWidthItems[3], 2));
                grid.appendChild(createCardElement(allPromoted[2], 4));
                layoutHandled = true;
            }
        } else if (!hasSkills && totalCount === 8 && specialInLayout.length >= 2) {
            const sortedSpecial = specialInLayout.sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
            const firstPromo = sortedSpecial[0];
            const secondPromo = sortedSpecial[1];

            const allPromoted = [firstPromo, secondPromo];
            const halfWidthItems = componentsToLayout.filter(c => !allPromoted.includes(c)).sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));

            grid.appendChild(createCardElement(allPromoted[0], 4));
            grid.appendChild(createCardElement(halfWidthItems[0], 2));
            grid.appendChild(createCardElement(halfWidthItems[1], 2));
            grid.appendChild(createCardElement(allPromoted[1], 4));
            grid.appendChild(createCardElement(halfWidthItems[2], 2));
            grid.appendChild(createCardElement(halfWidthItems[3], 2));
            grid.appendChild(createCardElement(halfWidthItems[4], 2));
            grid.appendChild(createCardElement(halfWidthItems[5], 2));
            layoutHandled = true;
        } else if (!hasSkills && totalCount === 9) {
            const firstPromo = promotionPriority.find(p => componentsToLayout.includes(p)) !;
            const remainingAfterFirstPromo = componentsToLayout.filter(c => c !== firstPromo);
            const specialInRemaining = remainingAfterFirstPromo.filter(c => special.includes(c));

            if (specialInRemaining.length >= 2) {
                const sortedSpecial = specialInRemaining.sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
                const secondPromo = sortedSpecial[0];
                const thirdPromo = sortedSpecial[1];

                const allPromoted = [firstPromo, secondPromo, thirdPromo].sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
                const halfWidthItems = componentsToLayout.filter(c => !allPromoted.includes(c)).sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));

                grid.appendChild(createCardElement(allPromoted[0], 4));
                grid.appendChild(createCardElement(halfWidthItems[0], 2));
                grid.appendChild(createCardElement(halfWidthItems[1], 2));
                grid.appendChild(createCardElement(allPromoted[1], 4));
                grid.appendChild(createCardElement(halfWidthItems[2], 2));
                grid.appendChild(createCardElement(halfWidthItems[3], 2));
                grid.appendChild(createCardElement(allPromoted[2], 4));
                grid.appendChild(createCardElement(halfWidthItems[4], 2));
                grid.appendChild(createCardElement(halfWidthItems[5], 2));
                layoutHandled = true;
            }
        } else if (hasSkills && totalSelectedCount === 5) {
            const halfWidthItems = componentsToLayout.sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
            grid.appendChild(createCardElement(halfWidthItems[0], 2));
            grid.appendChild(createCardElement(halfWidthItems[1], 2));
            layoutHandled = true;
        } else if (hasSkills && totalSelectedCount === 6) {
            const itemToPromote = promotionPriority.find(p => componentsToLayout.includes(p)) !;
            const halfWidthItems = componentsToLayout.filter(c => c !== itemToPromote).sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
            grid.appendChild(createCardElement(itemToPromote, 4));
            grid.appendChild(createCardElement(halfWidthItems[0], 2));
            grid.appendChild(createCardElement(halfWidthItems[1], 2));
            layoutHandled = true;
        } else if (hasSkills && totalSelectedCount === 7 && specialInLayout.length >= 2) {
            const sortedSpecial = specialInLayout.sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
            const firstPromo = sortedSpecial[0];
            const secondPromo = sortedSpecial[1];

            const allPromoted = [firstPromo, secondPromo];
            const halfWidthItems = componentsToLayout.filter(c => !allPromoted.includes(c)).sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));

            grid.appendChild(createCardElement(allPromoted[0], 4));
            grid.appendChild(createCardElement(halfWidthItems[0], 2));
            grid.appendChild(createCardElement(halfWidthItems[1], 2));
            grid.appendChild(createCardElement(allPromoted[1], 4));
            grid.appendChild(createCardElement(halfWidthItems[2], 2));
            grid.appendChild(createCardElement(halfWidthItems[3], 2));
            layoutHandled = true;
        } else if (hasSkills && totalSelectedCount === 8 && specialInLayout.length >= 1) {
            const sortedSpecial = specialInLayout.sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
            const firstPromo = sortedSpecial[0];

            const halfWidthItems = componentsToLayout.filter(c => c !== firstPromo).sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));

            grid.appendChild(createCardElement(halfWidthItems[0], 2));
            grid.appendChild(createCardElement(halfWidthItems[1], 2));
            grid.appendChild(createCardElement(firstPromo, 4));
            grid.appendChild(createCardElement(halfWidthItems[2], 2));
            grid.appendChild(createCardElement(halfWidthItems[3], 2));
            layoutHandled = true;
        } else if (hasSkills && totalSelectedCount === 9 && specialInLayout.length >= 2) {
            const sortedSpecial = specialInLayout.sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
            const firstPromo = sortedSpecial[0];
            const secondPromo = sortedSpecial[1];

            const allPromoted = [firstPromo, secondPromo];
            const halfWidthItems = componentsToLayout.filter(c => !allPromoted.includes(c)).sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));

            grid.appendChild(createCardElement(allPromoted[0], 4));
            grid.appendChild(createCardElement(halfWidthItems[0], 2));
            grid.appendChild(createCardElement(halfWidthItems[1], 2));
            grid.appendChild(createCardElement(allPromoted[1], 4));
            grid.appendChild(createCardElement(halfWidthItems[2], 2));
            grid.appendChild(createCardElement(halfWidthItems[3], 2));
            layoutHandled = true;
        } else if (hasSkills && totalSelectedCount === 10 && specialInLayout.length >= 3) {
            const sortedSpecial = specialInLayout.sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
            const firstPromo = sortedSpecial[0];
            const secondPromo = sortedSpecial[1];
            const thirdPromo = sortedSpecial[2];

            const allPromoted = [firstPromo, secondPromo, thirdPromo];
            const halfWidthItems = componentsToLayout.filter(c => !allPromoted.includes(c)).sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));

            grid.appendChild(createCardElement(allPromoted[0], 4));
            grid.appendChild(createCardElement(halfWidthItems[0], 2));
            grid.appendChild(createCardElement(halfWidthItems[1], 2));
            grid.appendChild(createCardElement(allPromoted[1], 4));
            grid.appendChild(createCardElement(halfWidthItems[2], 2));
            grid.appendChild(createCardElement(halfWidthItems[3], 2));
            grid.appendChild(createCardElement(allPromoted[2], 4));
            grid.appendChild(createCardElement(halfWidthItems[4], 2));
            grid.appendChild(createCardElement(halfWidthItems[5], 2));
            layoutHandled = true;
        }

        if (!layoutHandled) {
            const isOddCount = componentsToLayout.length % 2 === 1;
            let itemToPromote: string | null = null;
            if (isOddCount) {
                itemToPromote = promotionPriority.find(p => componentsToLayout.includes(p)) || null;
            }

            const orderedComponents: string[] = [];
            visualOrderPriority.forEach(key => {
                if (componentsToLayout.includes(key)) {
                    orderedComponents.push(key);
                }
            });

            const remainingComponents = componentsToLayout
                .filter(key => !visualOrderPriority.includes(key))
                .sort((a, b) => {
                    const indexA = promotionPriority.indexOf(a);
                    const indexB = promotionPriority.indexOf(b);
                    if (indexA === -1) return 1;
                    if (indexB === -1) return -1;
                    return indexA - indexB;
                });

            orderedComponents.push(...remainingComponents);

            orderedComponents.forEach(key => {
                const span = (key === itemToPromote) ? 4 : 2;
                grid.appendChild(createCardElement(key, span));
            });
        }

        if (hasSkills) {
            grid.appendChild(createCardElement('skills', 4));
        }

        if (layoutHandled && hasSkills) {
            if (totalSelectedCount === 5) {
                const halfWidthItems = componentsToLayout.sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
                grid.appendChild(createCardElement(halfWidthItems[2], 2));
                grid.appendChild(createCardElement(halfWidthItems[3], 2));
            } else if (totalSelectedCount === 6) {
                const itemToPromote = promotionPriority.find(p => componentsToLayout.includes(p)) !;
                const halfWidthItems = componentsToLayout.filter(c => c !== itemToPromote).sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
                grid.appendChild(createCardElement(halfWidthItems[2], 2));
                grid.appendChild(createCardElement(halfWidthItems[3], 2));
            } else if (totalSelectedCount === 8) {
                const specialInLayout = componentsToLayout.filter(c => special.includes(c));
                if (specialInLayout.length >= 1) {
                    const sortedSpecial = specialInLayout.sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
                    const firstPromo = sortedSpecial[0];
                    const halfWidthItems = componentsToLayout.filter(c => c !== firstPromo).sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
                    grid.appendChild(createCardElement(halfWidthItems[4], 2));
                    grid.appendChild(createCardElement(halfWidthItems[5], 2));
                }
            } else if (totalSelectedCount === 9) {
                const specialInLayout = componentsToLayout.filter(c => special.includes(c));
                if (specialInLayout.length >= 2) {
                    const sortedSpecial = specialInLayout.sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
                    const firstPromo = sortedSpecial[0];
                    const secondPromo = sortedSpecial[1];
                    const halfWidthItems = componentsToLayout.filter(c => c !== firstPromo && c !== secondPromo).sort((a, b) => promotionPriority.indexOf(a) - promotionPriority.indexOf(b));
                    grid.appendChild(createCardElement(halfWidthItems[4], 2));
                    grid.appendChild(createCardElement(halfWidthItems[5], 2));
                }
            }
        }

        document.body.appendChild(offscreenContainer);
        const renderNode = offscreenContainer.querySelector('#bento-render-node') as HTMLElement;

        await renderComponentContent(renderNode, selections, skillMatrixData!);

        await new Promise(resolve => setTimeout(resolve, 200));

        if (generationToken !== latestGenerationToken) {
            return;
        }

        const renderHeight = renderNode.scrollHeight;
        const blob = await toBlob(renderNode, {
            width: RENDER_WIDTH,
            height: renderHeight,
            skipFonts: true
        });

        if (generationToken !== latestGenerationToken) {
            return;
        }

        if (!blob) {
            throw new Error("Failed to generate image blob.");
        }

        currentPreviewBlob = blob;
        if (copyBtn) copyBtn.removeAttribute('disabled');
        if (downloadBtn) downloadBtn.removeAttribute('disabled');

        const ctx = previewCanvas.getContext('2d');
        if (ctx) {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            img.onload = () => {
                if (generationToken === latestGenerationToken) {
                    previewCanvas.width = img.width;
                    previewCanvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    if (loader) loader.style.display = 'none';
                    if (previewCanvas) previewCanvas.style.display = 'block';
                }
                URL.revokeObjectURL(url);
            };
            img.src = url;
        } else {
            if (loader) loader.style.display = 'none';
        }

    } catch (error) {
        if (loader) loader.style.display = 'none';
    } finally {
        if (offscreenContainer && document.body.contains(offscreenContainer)) {
            document.body.removeChild(offscreenContainer);
        }
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

    const isFullWidth = (card: Element | null) => card ? (card as HTMLElement).style.gridColumn.includes('4') : false;

    if (history && historyStartDate && historyEndDate) {
        const card = container.querySelector('#bento-card-history');
        if (card) {
            const maxTicks = isFullWidth(card) ? 6 : 3;
            const primaryView = (document.querySelector('#bento-history-primary-toggle button[data-state="active"]') as HTMLElement)?.dataset.view || 'Problems Solved';
            const secondaryView = (document.querySelector('#bento-history-secondary-toggle button[data-state="active"]') as HTMLElement)?.dataset.view || 'Difficulty';

            card.innerHTML = `<div class="bento-card-content"><div class="chart-container" style="height: 100%;"><canvas id="bento-history-chart-canvas"></canvas></div></div>`;
            const title = document.createElement('h3');
            title.className = 'bento-card-title';
            title.style.color = colors.text.primary;
            title.textContent = primaryView;
            card.prepend(title);
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
                            maxTicksLimit: maxTicks,
                            maxRotation: 0,
                            minRotation: 0,
                        }
                    }
                }
            } as any);
        }
    }

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

    const selectedRecords = legacyStats.records.filter(r => records.includes(r.name) && r.name !== "Overall Progress");
    if (selectedRecords.length > 0) {
        const card = container.querySelector('#bento-card-records');
        if (card) {
            card.innerHTML = `<h3 class="bento-card-title" style="color: rgb(255, 255, 255);">Records</h3><div class="bento-card-content"><div class="record-list"></div></div>`;
            const listContainer = card.querySelector('.record-list')!;
            selectedRecords.forEach(r => {
                const item = document.createElement('div');
                item.className = 'record-item';

                const label = document.createElement('span');
                label.className = 'record-label';
                label.textContent = r.name;

                const valueContainer = document.createElement('div');
                valueContainer.className = 'record-value';

                const mainStat = document.createElement('span');
                mainStat.textContent = String(r.mainStat || r.value || '');

                const context = document.createElement('span');
                context.className = 'record-context';
                context.textContent = r.dateStat || '';

                valueContainer.append(mainStat, context);
                item.append(label, valueContainer);
                listContainer.appendChild(item);
            });
        }
    }

    const selectedTrophies = legacyStats.trophies.filter(t => t.achieved && trophies.includes(t.id));
    if (selectedTrophies.length > 0) {
        const card = container.querySelector('#bento-card-trophies');
        if (card) {
            card.innerHTML = `<h3 class="bento-card-title" style="color: rgb(255, 255, 255); '' ">Trophies</h3><div class="bento-card-content" style="display: grid; place-items: center; height: 100%;"><div class="trophy-list"></div></div>`;
            const listContainer = card.querySelector('.trophy-list')!;
            selectedTrophies.forEach(t => {
                const item = document.createElement('div');
                item.className = 'trophy-item';

                const icon = document.createElement('img');
                icon.src = chrome.runtime.getURL(t.icon);
                icon.alt = t.title;
                icon.className = 'trophy-icon';

                const details = document.createElement('div');
                details.className = 'trophy-details';

                const title = document.createElement('div');
                title.className = 'trophy-title';
                title.textContent = t.title;

                const subtitle = document.createElement('div');
                subtitle.className = 'trophy-subtitle';
                subtitle.textContent = t.subtitle;

                details.append(title, subtitle);

                if (t.problemSlug !== 'placeholder') {
                    const link = document.createElement('a');
                    link.href = `https://leetcode.com/problems/${t.problemSlug}/`;
                    link.target = '_blank';
                    link.className = 'trophy-problem';
                    link.textContent = t.problemTitle;
                    details.appendChild(link);
                }
                item.append(icon, details);
                listContainer.appendChild(item);
            });
        }
    }

    const selectedMilestones = legacyStats.milestones.filter((m, index) => milestones.includes(index));
    if (selectedMilestones.length > 0) {
        const card = container.querySelector('#bento-card-milestones');
        if (card) {
            const titleAlign = isFullWidth(card) ? '' : '';
            const title = document.createElement('h3');
            title.className = 'bento-card-title';
            title.style.color = colors.text.primary;
            title.textContent = 'Milestones';

            const cardContent = document.createElement('div');
            cardContent.className = 'bento-card-content';
            cardContent.style.cssText = 'display: grid; place-items: center; height: 100%;';

            const timeline = document.createElement('div');
            timeline.className = 'milestone-timeline';

            const line = document.createElement('div');
            line.className = 'timeline-line';

            const list = document.createElement('div');
            list.className = 'milestone-list';

            selectedMilestones.forEach(m => {
                const item = document.createElement('div');
                item.className = 'milestone-item';

                const color = getMilestoneColor(m.type);

                const dot = document.createElement('div');
                dot.className = 'milestone-dot';
                dot.style.backgroundColor = color;

                const event = document.createElement('div');
                event.className = 'milestone-event';
                event.style.color = color;
                event.textContent = `${m.milestone}${getOrdinalSuffix(m.milestone)} ${formatMilestoneType(m.type)}`;

                const date = document.createElement('div');
                date.className = 'milestone-date';
                date.textContent = m.date.toLocaleDateString('en-GB');

                item.append(dot, event, date);

                if (m.problemTitle) {
                    const link = document.createElement('a');
                    link.href = `https://leetcode.com/problems/${m.problemSlug}/`;
                    link.target = '_blank';
                    link.className = `${styles.milestoneProblem} milestone-problem`;
                    link.textContent = m.problemTitle;
                    item.appendChild(link);
                }

                list.appendChild(item);
            });

            timeline.append(line, list);
            cardContent.appendChild(timeline);
            card.append(title, cardContent);

        }
    }

    if (skills.length > 0) {
        const card = container.querySelector('#bento-card-skills');
        if (card) {
            const gridStyle = `display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 24px; align-items: center; width: 100%;`;

            card.innerHTML = `<h3 class="bento-card-title" style="color: rgb(255, 255, 255);">Skills</h3><div class="bento-card-content" style="width: 100%;"><div class="skills-table" style="width: 100%;"></div></div>`;
            const table = card.querySelector('.skills-table')!;
            
            const headerStyle = `display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 24px; align-items: center; width: 100%; padding: 8px 0; border-bottom: 1px solid ${colors.background.secondarySection}; font-size: 16px; color: ${colors.text.subtle}; font-weight: 600;`;
            const header = document.createElement('div');
            header.className = 'skills-header';
            header.style.cssText = headerStyle;
            header.innerHTML = `
                <div class="skill-cell" style="text-align: left;"></div>
                <div class="skill-cell" style="text-align: center;">Problems<br>Solved</div>
                <div class="skill-cell" style="text-align: center;">Average<br>Attempts</div>
                <div class="skill-cell" style="text-align: center;">First Ace<br>Rate</div>
            `;
            table.appendChild(header);

            const rowStyle = `display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 24px; align-items: center; width: 100%; padding: 8px 0; border-bottom: 1px solid ${colors.background.secondarySection}; font-size: 18px;`;
            const lastRowStyle = `display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 24px; align-items: center; width: 100%; padding: 8px 0; border-bottom: none; font-size: 18px;`;

            skills.forEach((skill: string, index: number) => {
                const metrics = skillData.metrics;
                const row = document.createElement('div');
                row.className = 'skill-row';
                row.style.cssText = index === skills.length - 1 ? lastRowStyle : rowStyle;
                
                const nameCell = document.createElement('div');
                nameCell.className = 'skill-cell';
                nameCell.style.cssText = 'text-align: left; font-weight: 600;';
                nameCell.textContent = formatTopicName(skill);
                
                const solvedCell = document.createElement('div');
                solvedCell.className = 'skill-cell';
                solvedCell.style.textAlign = 'center';
                solvedCell.textContent = (metrics.problemsSolved[skill] || 0).toString();

                const avgTriesCell = document.createElement('div');
                avgTriesCell.className = 'skill-cell';
                avgTriesCell.style.textAlign = 'center';
                avgTriesCell.textContent = metrics.avgTries[skill] === Infinity ? '∞' : metrics.avgTries[skill].toFixed(1);

                const firstAceCell = document.createElement('div');
                firstAceCell.className = 'skill-cell';
                firstAceCell.style.textAlign = 'center';
                firstAceCell.textContent = `${(metrics.firstAceRate[skill] || 0).toFixed(0)}%`;

                row.append(nameCell, solvedCell, avgTriesCell, firstAceCell);
                table.appendChild(row);
            });
        }
    }

    if (activities.includes("Progress Over Time")) {
        const card = container.querySelector('#bento-card-progressTracker');
        if (card) {
            card.innerHTML = `<h3 class="bento-card-title" style="color: rgb(255, 255, 255);">Progress Over Time</h3><div class="bento-card-content"><div class="chart-container"><canvas id="bento-progress-tracker-canvas"></canvas></div></div>`;
            const chartContainer = card.querySelector('.chart-container');
            if (chartContainer) {
                const maxTicks = isFullWidth(card) ? 6 : 3;
                const cumulativeView = getSmartCumulativeView('All Time', processedDataCache);
                const stats = getCumulativeStats(processedDataCache, { timeRange: 'All Time', difficulty: 'All', cumulativeView });
                if (stats) renderOrUpdateCumulativeLineChart(chartContainer as HTMLElement, stats, { timeRange: 'All Time', difficulty: 'All', cumulativeView }, undefined, { isInteractive: false, hidePoints: true, tickFontSize: 16, maxTicksLimit: maxTicks });
            }
        }
    }
    if (activities.includes("Coding Frequency")) {
        const card = container.querySelector('#bento-card-codingClock');
        if (card) {
            const clockView = (document.querySelector('#bento-coding-clock-toggle button[data-state="active"]') as HTMLElement)?.dataset.view || 'HourOfDay';
            const title = 'Coding Frequency'

            card.innerHTML = `<h3 class="bento-card-title" style="color: rgb(255, 255, 255);">Coding Frequency</h3><div class="bento-card-content"><div class="chart-container"><canvas id="bento-coding-clock-canvas"></canvas></div></div>`;
            const chartContainer = card.querySelector('.chart-container');

            if (chartContainer) {
                const stats = getCodingClockStats(processedDataCache, { timeRange: 'All Time', difficulty: 'All', clockView: clockView as 'HourOfDay' | 'DayOfWeek' });

                stats.datasets.forEach(dataset => {
                    (dataset as any).maxBarThickness = 40;
                });

                const bentoOptions = {
                    maxTicksLimit: clockView === 'HourOfDay' ? 5 : 7
                };

                renderOrUpdateStackedBarChart(chartContainer as HTMLElement, stats, undefined, {
                    isInteractive: false,
                    bentoOptions: bentoOptions
                });
            }
        }
    }
    if (activities.includes("Submission Breakdown")) {
        const card = container.querySelector('#bento-card-submissionSignature');
        if (card) {
            const titleAlign = isFullWidth(card) ? '' : '';
            card.innerHTML = `<h3 class="bento-card-title" style="color: rgb(255, 255, 255); ">Submission Breakdown</h3><div class="bento-card-content"><div class="chart-container"><canvas id="bento-submission-signature-canvas"></canvas></div></div>`;
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
            card.innerHTML = `<h3 class="bento-card-title" style="color: rgb(255, 255, 255);">Language Stats</h3><div class="bento-card-content"><div class="chart-container"><canvas id="bento-language-stats-canvas"></canvas></div></div>`;
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
    avatarUrlCache = scrapeAvatarUrl();

    const generateCardBtn = document.getElementById('generate-card-btn');
    const modal = document.getElementById('bento-modal');
    const closeModalBtn = document.getElementById('bento-modal-close-btn');
    const copyBtn = document.getElementById('copy-bento-btn') as HTMLButtonElement;
    const downloadBtn = document.getElementById('download-bento-btn') as HTMLButtonElement;

    if (!generateCardBtn || !modal || !closeModalBtn || !copyBtn || !downloadBtn) return;

    generateCardBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        if (!document.getElementById('bento-records-accordion-content')?.hasChildNodes()) {
            populateAccordion();
        }
        triggerRender();
    });

    const closeModal = () => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    };

    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') closeModal();
    });

    if (!navigator.clipboard || !window.ClipboardItem) {
        copyBtn.style.display = 'none';
    }

    copyBtn.addEventListener('click', async () => {
    if (!currentPreviewBlob) return;

    // Store the original child nodes to safely restore them later.
    const originalChildNodes = Array.from(copyBtn.childNodes);

    try {
        const clipboardItem = new ClipboardItem({ 'image/png': currentPreviewBlob });
        await navigator.clipboard.write([clipboardItem]);

        // Safely clear the button and add a success icon.
        copyBtn.innerHTML = ''; // Clear existing content.

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.setAttribute('width', '20');
        svg.setAttribute('height', '20');
        svg.setAttribute('viewBox', '0 0 20 20');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('class', 'text-green-s dark:text-dark-green-s');
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', '20 6 9 17 4 12');
        svg.appendChild(polyline);
        copyBtn.appendChild(svg);

        setTimeout(() => {
            // Safely restore the original button content.
            copyBtn.innerHTML = '';
            originalChildNodes.forEach(node => copyBtn.appendChild(node.cloneNode(true)));
        }, 1500);

    } catch (err) {
        // Safely update button text on failure.
        copyBtn.textContent = 'Failed!';
        
        setTimeout(() => {
            // Safely restore the original button content.
            copyBtn.innerHTML = '';
            originalChildNodes.forEach(node => copyBtn.appendChild(node.cloneNode(true)));
        }, 2500);
    }
});

    downloadBtn.addEventListener('click', () => {
        if (!currentPreviewBlob) return;
        try {
            const link = document.createElement('a');
            link.download = `leetstats_${usernameCache}.png`;
            link.href = URL.createObjectURL(currentPreviewBlob);
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (err) {
            // Error handling can be improved here
        }
    });

    document.querySelectorAll('.bento-accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling as HTMLElement;
            const icon = header.querySelector('svg');
            if (content && icon) {
                const innerContent = content.firstElementChild as HTMLElement;
                const isOpen = content.style.maxHeight && content.style.maxHeight !== '0px';

                const height = innerContent.scrollHeight;
                const dynamicDuration = Math.max(300, Math.min(800, height * 1.2));
                content.style.transition = `max-height ${dynamicDuration}ms ease-in-out`;

                if (isOpen) {
                    content.style.maxHeight = '0px';
                    icon.style.transform = 'rotate(0deg)';
                } else {
                    content.style.maxHeight = height + 'px';
                    icon.style.transform = 'rotate(180deg)';
                }
            }
        });
    });
}


function populateAccordion() {
    let maxContentWidth = 0;

    const measureAndTrackWidth = (element: HTMLElement) => {
        const width = measureElementWidth(element);
        if (width > maxContentWidth) {
            maxContentWidth = width;
        }
    };

    const aboutContent = document.getElementById('bento-about-accordion-content');
    const historyContent = document.getElementById('bento-history-accordion-content');
    const recordsContent = document.getElementById('bento-records-accordion-content');
    const trophiesContent = document.getElementById('bento-trophies-accordion-content');
    const milestonesContent = document.getElementById('bento-milestones-accordion-content');
    const skillsContent = document.getElementById('bento-skills-accordion-content');
    const activityContent = document.getElementById('bento-activity-accordion-content');

    const overrideCheckboxStyle = (checkboxRow: HTMLElement) => {
        const leftSide = checkboxRow.firstElementChild as HTMLElement;
        if (leftSide) {
            leftSide.className = 'text-md flex items-center space-x-2';
            const textContainer = leftSide.querySelector('.truncate');
            if (textContainer) {
                textContainer.className = '';
                const textSpan = textContainer.querySelector('span');
                if (textSpan) textSpan.className = 'whitespace-nowrap';
            }
        }
    };

    if (aboutContent) {
        aboutContent.innerHTML = '';
        const aboutContainer = document.createElement('div');
        aboutContainer.className = 'space-y-3';

        const usernameRow = document.createElement('div');
        usernameRow.className = 'flex w-full items-center justify-between rounded-lg px-2 py-[5px] text-label-1 dark:text-dark-label-1';
        const nameLabel = document.createElement('label');
        nameLabel.htmlFor = 'bento-username-input';
        nameLabel.className = 'text-md';
        nameLabel.textContent = 'Name';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = 'bento-username-input';
        nameInput.value = usernameCache;
        nameInput.className = 'bg-layer-0 dark:bg-dark-layer-0 rounded p-1 text-sm text-label-1 dark:text-dark-label-1 border border-divider-3 dark:border-dark-divider-3 w-48 text-left focus:outline-none focus:ring-1 focus:ring-brand-orange';
        
        usernameRow.append(nameLabel, nameInput);
        aboutContainer.appendChild(usernameRow);

        const isDefaultAvatar = avatarUrlCache.includes('default_avatar.jpg');
        const shouldBeCheckedByDefault = !!avatarUrlCache && !isDefaultAvatar;

        const avatarCheckbox = createCheckbox(
            'bento-checkbox-display-avatar',
            'Avatar',
            'displayAvatar',
            'true',
            'bento-about-checkbox',
            undefined,
            shouldBeCheckedByDefault
        );

        overrideCheckboxStyle(avatarCheckbox);
        aboutContainer.appendChild(avatarCheckbox);

        aboutContent.appendChild(aboutContainer);

        const usernameInput = document.getElementById('bento-username-input');
        usernameInput?.addEventListener('input', triggerRender);
    }

    if (historyContent) {
        historyContent.innerHTML = '';
        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'history-controls-container';
        controlsContainer.className = 'space-y-2 mt-2 pl-8';

        const togglesWrapper = document.createElement('div');
        togglesWrapper.className = 'flex gap-2 items-center';
        const primaryToggleContainer = document.createElement('div');
        primaryToggleContainer.id = 'bento-history-primary-toggle';
        primaryToggleContainer.className = 'text-sd-muted-foreground inline-flex items-center justify-center bg-sd-muted rounded-full p-[1px]';
        primaryToggleContainer.innerHTML = `
            <button data-view="Problems Solved" data-state="active" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">Problems Solved</button>
            <button data-view="Submissions" data-state="inactive" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">Submissions</button>
        `;
        togglesWrapper.appendChild(primaryToggleContainer);
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
        const datePickers = document.createElement('div');
        datePickers.id = 'history-date-pickers';
        datePickers.className = 'flex gap-2 items-center justify-center mt-2';
        datePickers.innerHTML = `
            <input type="date" id="bento-history-start-date" class="bg-layer-0 dark:bg-dark-layer-0 rounded p-1 text-sm text-label-1 dark:text-dark-label-1 border border-divider-3 dark:border-dark-divider-3">
            <span class="text-label-3 dark:text-dark-label-3">-</span>
            <input type="date" id="bento-history-end-date" class="bg-layer-0 dark:bg-dark-layer-0 rounded p-1 text-sm text-label-1 dark:text-dark-label-1 border border-divider-3 dark:border-dark-divider-3">
        `;
        controlsContainer.appendChild(datePickers);

        const historyCheckboxCallback = (isChecked: boolean) => {
            controlsContainer.style.display = isChecked ? 'block' : 'none';
        };
        const checkboxContainer = createCheckbox('bento-checkbox-history', 'History Chart', 'historyToggle', 'true', 'bento-history-checkbox', historyCheckboxCallback, true);
        overrideCheckboxStyle(checkboxContainer);
        measureAndTrackWidth(checkboxContainer);
        measureAndTrackWidth(controlsContainer);

        historyContent.appendChild(checkboxContainer);
        historyContent.appendChild(controlsContainer);

        document.querySelectorAll('#bento-history-primary-toggle button').forEach(btn => btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            document.querySelectorAll('#bento-history-primary-toggle button').forEach(b => b.setAttribute('data-state', 'inactive'));
            target.setAttribute('data-state', 'active');
            triggerRender();
        }));
        document.querySelectorAll('#bento-history-secondary-toggle button').forEach(btn => btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            document.querySelectorAll('#bento-history-secondary-toggle button').forEach(b => b.setAttribute('data-state', 'inactive'));
            target.setAttribute('data-state', 'active');
            triggerRender();
        }));

        const startDateInput = datePickers.querySelector('#bento-history-start-date') as HTMLInputElement;
        const endDateInput = datePickers.querySelector('#bento-history-end-date') as HTMLInputElement;

        const today = new Date();
        const todayString = today.toISOString().split('T')[0];

        endDateInput.max = todayString;
        startDateInput.max = todayString;

        if (processedDataCache && processedDataCache.submissions && processedDataCache.submissions.length > 0) {
            const firstSubmission = processedDataCache.submissions[0];
            if (firstSubmission && typeof firstSubmission.timestamp === 'number') {
                const firstSubDate = new Date(firstSubmission.timestamp * 1000);
                const firstSubmissionDateString = firstSubDate.toISOString().split('T')[0];
                startDateInput.min = firstSubmissionDateString;
                endDateInput.min = firstSubmissionDateString;
            }
        }

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        endDateInput.value = todayString;

        if (startDateInput.min && oneYearAgo < new Date(startDateInput.min)) {
            startDateInput.value = startDateInput.min;
        } else {
            startDateInput.value = oneYearAgo.toISOString().split('T')[0];
        }

        startDateInput.addEventListener('change', () => {
            endDateInput.min = startDateInput.value;
            triggerRender();
        });

        endDateInput.addEventListener('change', () => {
            startDateInput.max = endDateInput.value;
            triggerRender();
        });

        endDateInput.min = startDateInput.value;
    }

    if (recordsContent && legacyStats?.records && processedDataCache) {
        recordsContent.innerHTML = '';
        const solvedStats = getSolvedStats(processedDataCache);
        const overallProgressCheckbox = createCheckbox(`bento-checkbox-record-overall-progress`, "Overall Progress", 'recordName', "Overall Progress", 'bento-record-checkbox', undefined, true);
        overrideCheckboxStyle(overallProgressCheckbox);
        const overallProgressStat = document.createElement('div');
        overallProgressStat.className = 'text-sm text-label-3 dark:text-dark-label-3 pl-4';
        overallProgressStat.textContent = `${solvedStats.totalSolved} problems solved`;
        overallProgressStat.style.pointerEvents = 'none';
        overallProgressCheckbox.appendChild(overallProgressStat);
        measureAndTrackWidth(overallProgressCheckbox);
        recordsContent.appendChild(overallProgressCheckbox);

        legacyStats.records.forEach((record: any) => {
            if (record?.name) {
                const checkboxRow = createCheckbox(`bento-checkbox-record-${record.name.replace(/\s+/g, '-')}`, record.name, 'recordName', record.name, 'bento-record-checkbox');
                overrideCheckboxStyle(checkboxRow);
                const statValue = record.mainStat || record.value?.toString() || '';
                if (statValue) {
                    const statContainer = document.createElement('div');
                    statContainer.className = 'text-sm text-label-3 dark:text-dark-label-3 pl-4 whitespace-nowrap';
                    statContainer.textContent = statValue;
                    statContainer.style.pointerEvents = 'none';
                    checkboxRow.appendChild(statContainer);
                }
                measureAndTrackWidth(checkboxRow);
                recordsContent.appendChild(checkboxRow);
            }
        });
    }

    if (trophiesContent && legacyStats?.trophies) {
        trophiesContent.innerHTML = '';
        legacyStats.trophies.filter((t: any) => t.achieved).forEach((trophy: any) => {
            if (trophy?.id && trophy.title) {
                const checkboxRow = createCheckbox(`bento-checkbox-trophy-${trophy.id}`, trophy.title, 'trophyId', trophy.id, 'bento-trophy-checkbox');
                overrideCheckboxStyle(checkboxRow);
                const subtitleContainer = document.createElement('div');
                subtitleContainer.className = 'text-sm text-label-3 dark:text-dark-label-3 pl-4 truncate';
                subtitleContainer.textContent = trophy.subtitle;
                subtitleContainer.style.pointerEvents = 'none';
                checkboxRow.appendChild(subtitleContainer);
                measureAndTrackWidth(checkboxRow);
                trophiesContent.appendChild(checkboxRow);
            }
        });
    }

    if (milestonesContent && legacyStats?.milestones) {
        milestonesContent.innerHTML = '';
        legacyStats.milestones.forEach((milestone: any, index: number) => {
            if (milestone) {
                const labelText = `${milestone.milestone}${getOrdinalSuffix(milestone.milestone)} ${formatMilestoneType(milestone.type)}`;
                const checkboxRow = createCheckbox(`bento-checkbox-milestone-${index}`, labelText, 'milestoneIndex', index.toString(), 'bento-milestone-checkbox');
                overrideCheckboxStyle(checkboxRow);
                const dateContainer = document.createElement('div');
                dateContainer.className = 'text-sm text-label-3 dark:text-dark-label-3 pl-4 whitespace-nowrap';
                dateContainer.textContent = milestone.date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                dateContainer.style.pointerEvents = 'none';
                checkboxRow.appendChild(dateContainer);
                measureAndTrackWidth(checkboxRow);
                milestonesContent.appendChild(checkboxRow);
            }
        });
    }

    if (skillsContent && skillMatrixData?.topics) {
        skillsContent.innerHTML = '';
        const header = document.createElement('div');
        header.className = 'flex w-full items-center justify-between rounded-lg px-2 py-[5px] text-xs text-label-3 dark:text-dark-label-3';
        header.innerHTML = `
            <div class="flex-grow pl-8 font-medium"></div>
            <div class="flex flex-shrink-0 justify-end text-center font-medium" style="width: 200px;">
                <span class="w-1/3" title="Problems Solved">Problems Solved</span>
                <span class="w-1/3" title="Average Attempts">Average Attempts</span>
                <span class="w-1/3" title="First Ace Rate">First Ace Rate</span>
            </div>
        `;
        skillsContent.appendChild(header);

        const metrics = skillMatrixData.metrics;
        skillMatrixData.topics.forEach(topic => {
            if (topic) {
                const checkboxRow = createCheckbox(`bento-checkbox-skill-${topic}`, formatTopicName(topic), 'skillName', topic, 'bento-skill-checkbox');
                const leftSide = checkboxRow.firstElementChild as HTMLElement;
                if (leftSide) {
                    leftSide.className = 'text-md flex items-center space-x-2 flex-grow';
                    const textContainer = leftSide.querySelector('.truncate');
                    if (textContainer) {
                        textContainer.className = '';
                        const textSpan = textContainer.querySelector('span');
                        if (textSpan) textSpan.className = 'whitespace-nowrap';
                    }
                }
                const { problemsSolved, avgTries, firstAceRate } = metrics;
                const metricsContainer = document.createElement('div');
                metricsContainer.className = 'flex flex-shrink-0 justify-end text-center text-sm items-center text-label-2 dark:text-dark-label-2';
                metricsContainer.style.width = '200px';
                metricsContainer.style.pointerEvents = 'none';
                const solvedSpan = document.createElement('span');
                solvedSpan.className = 'w-1/3';
                solvedSpan.textContent = (problemsSolved[topic] || 0).toString();

                const avgTriesSpan = document.createElement('span');
                avgTriesSpan.className = 'w-1/3';
                avgTriesSpan.textContent = avgTries[topic] === Infinity ? '∞' : avgTries[topic]?.toFixed(1) || '0.0';

                const firstAceRateSpan = document.createElement('span');
                firstAceRateSpan.className = 'w-1/3';
                firstAceRateSpan.textContent = `${firstAceRate[topic]?.toFixed(0) || '0'}%`;

                metricsContainer.append(solvedSpan, avgTriesSpan, firstAceRateSpan);

                checkboxRow.appendChild(metricsContainer);
                measureAndTrackWidth(checkboxRow);
                skillsContent.appendChild(checkboxRow);
            }
        });
    }

    if (activityContent) {
        activityContent.innerHTML = '';
        const ACTIVITY_CHARTS = ["Submission Breakdown", "Language Stats", "Progress Over Time", "Coding Frequency"];
        const DEFAULT_ACTIVITY_CHARTS = ["Language Stats", "Progress Over Time", "Coding Frequency"];
        ACTIVITY_CHARTS.forEach(name => {
            const isDefaultChecked = DEFAULT_ACTIVITY_CHARTS.includes(name);
            if (name === "Coding Frequency") {
                const controlsContainer = document.createElement('div');
                controlsContainer.id = 'coding-clock-controls-container';
                controlsContainer.className = 'space-y-2 mt-1 pl-8';
                controlsContainer.style.display = 'none';
                const toggleContainer = document.createElement('div');
                toggleContainer.id = 'bento-coding-clock-toggle';
                toggleContainer.className = 'text-sd-muted-foreground inline-flex items-center justify-center bg-sd-muted rounded-full p-[1px]';
                toggleContainer.innerHTML = `
                    <button data-view="HourOfDay" data-state="active" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">Hourly</button>
                    <button data-view="DayOfWeek" data-state="inactive" class="whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 ring-offset-sd-background focus-visible:ring-sd-ring data-[state=active]:text-sd-foreground inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow dark:data-[state=active]:bg-sd-accent data-[state=active]:bg-sd-popover rounded-full px-2 py-[5px] text-xs">Daily</button>
                `;
                controlsContainer.appendChild(toggleContainer);
                const checkboxCallback = (isChecked: boolean) => {
                    controlsContainer.style.display = isChecked ? 'block' : 'none';
                };
                const checkboxContainer = createCheckbox(`bento-checkbox-activity-${name.replace(/\s+/g, '-')}`, name, 'activityName', name, 'bento-activity-checkbox', checkboxCallback, isDefaultChecked);
                overrideCheckboxStyle(checkboxContainer);
                measureAndTrackWidth(checkboxContainer);
                activityContent.appendChild(checkboxContainer);
                activityContent.appendChild(controlsContainer);
                document.querySelectorAll('#bento-coding-clock-toggle button').forEach(btn => btn.addEventListener('click', (e) => {
                    const target = e.currentTarget as HTMLElement;
                    document.querySelectorAll('#bento-coding-clock-toggle button').forEach(b => b.setAttribute('data-state', 'inactive'));
                    target.setAttribute('data-state', 'active');
                    triggerRender();
                }));
            } else {
                const checkbox = createCheckbox(`bento-checkbox-activity-${name.replace(/\s+/g, '-')}`, name, 'activityName', name, 'bento-activity-checkbox', undefined, isDefaultChecked);
                overrideCheckboxStyle(checkbox);
                measureAndTrackWidth(checkbox);
                activityContent.appendChild(checkbox);
            }
        });
    }

    const PADDING_AND_SCROLLBAR_BUFFER = 70;
    const MIN_WIDTH = 380;
    const finalPanelWidth = maxContentWidth + PADDING_AND_SCROLLBAR_BUFFER;

    const modal = document.getElementById('bento-modal');
    if (modal) {
        modal.style.setProperty('--left-panel-width', `${Math.max(finalPanelWidth, MIN_WIDTH)}px`);
    }

    const offscreenContainer = document.getElementById('bento-offscreen-container');
    if (offscreenContainer) {
        document.body.removeChild(offscreenContainer);
    }
}


function createCheckbox(id: string, text: string, dataAttribute: string, dataValue: string, customClass: string, onClickCallback ? : (isChecked: boolean) => void, defaultChecked = false): HTMLElement {
    const container = document.createElement('div');
    container.className = 'flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-[5px] text-label-1 dark:text-dark-label-1 hover:bg-fill-3 dark:hover:bg-dark-fill-3';

    const leftSide = document.createElement('div');
    leftSide.className = 'text-md flex w-full max-w-[192px] flex-1 items-center space-x-2 truncate';

    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = `${customClass} border-sd-primary focus-visible:ring-sd-ring data-[state=checked]:bg-sd-primary data-[state=checked]:text-sd-primary-foreground rounded-sm peer h-4 w-4 shrink-0 border focus-visible:outline-none focus-visible:ring-1`;
    button.setAttribute('role', 'checkbox');
    button.dataset[dataAttribute] = dataValue;

    const createCheckmark = () => {
    const span = document.createElement('span');
    span.dataset.state = 'checked';
    span.className = 'flex items-center justify-center text-current';
    span.style.pointerEvents = 'none';

    const div = document.createElement('div');
    div.className = 'relative before:block before:h-3 before:w-3 h-2 w-2 text-[8px]';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('data-prefix', 'far');
    svg.setAttribute('data-icon', 'check');
    svg.setAttribute('class', 'svg-inline--fa fa-check absolute left-1/2 top-1/2 h-[1em] -translate-x-1/2 -translate-y-1/2 align-[-0.125em]');
    svg.setAttribute('role', 'img');
    svg.setAttribute('viewBox', '0 0 448 512');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', 'M441 103c9.4 9.4 9.4 24.6 0 33.9L177 401c-9.4 9.4-24.6 9.4-33.9 0L7 265c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l119 119L407 103c9.4-9.4 24.6-9.4 33.9 0z');

    svg.appendChild(path);
    div.appendChild(svg);
    span.appendChild(div);

    return span;
};


    if (defaultChecked) {
        button.setAttribute('aria-checked', 'true');
        button.dataset.state = 'checked';
        button.appendChild(createCheckmark());
    } else {
        button.setAttribute('aria-checked', 'false');
        button.dataset.state = 'unchecked';
    }

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
            button.appendChild(createCheckmark());
        } else {
            button.setAttribute('aria-checked', 'false');
            button.dataset.state = 'unchecked';
            button.innerHTML = '';
        }

        if (onClickCallback) {
            onClickCallback(newStateIsChecked);
            const parentAccordionContent = container.closest('.bento-accordion-content') as HTMLElement;
            if (parentAccordionContent) {
                setTimeout(() => {
                    updateAccordionHeight(parentAccordionContent);
                }, 50);
            }
        }

        triggerRender();
    };

    container.addEventListener('click', toggleCheckbox);

    if (defaultChecked && onClickCallback) {
        onClickCallback(true);
    }

    return container;
}

function measureElementWidth(element: HTMLElement): number {
    let offscreenContainer = document.getElementById('bento-offscreen-container');
    if (!offscreenContainer) {
        offscreenContainer = document.createElement('div');
        offscreenContainer.id = 'bento-offscreen-container';
        offscreenContainer.style.position = 'absolute';
        offscreenContainer.style.left = '-9999px';
        offscreenContainer.style.top = '0';
        offscreenContainer.style.width = 'max-content';
        document.body.appendChild(offscreenContainer);
    }

    const clone = element.cloneNode(true) as HTMLElement;
    offscreenContainer.appendChild(clone);
    const width = clone.scrollWidth;
    offscreenContainer.removeChild(clone);

    return width;
}

/**
 * Recalculates and sets the max-height for an open accordion section.
 * This is used when content is dynamically added to an already open accordion.
 * @param content The accordion content wrapper element (the one with the transition).
 */
function updateAccordionHeight(content: HTMLElement) {
    if (content.style.maxHeight && content.style.maxHeight !== '0px') {
        const innerContent = content.firstElementChild as HTMLElement;
        if (innerContent) {
            content.style.maxHeight = innerContent.scrollHeight + 'px';
        }
    }
}

function scrapeAvatarUrl(): string {
    const avatarImg = document.querySelector('.relative.flex.h-20.w-20.shrink-0 img') as HTMLImageElement;
    if (avatarImg && avatarImg.src) {
        return avatarImg.src;
    }
    return '';
}