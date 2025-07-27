import { colors } from '../theme/colors';

/**
 * Returns the complete HTML and CSS for the bento generator modal.
 */
export function createBentoModalHTML(): string {
  // Using colors from the theme file for inline styles
  const modalStyles = `
    #bento-modal {
      display: none;
      background-color: rgba(26, 26, 26, 0.7); /* page background with alpha */
      backdrop-filter: blur(8px);
    }

    /* --- Preview Area Styling --- */
    #bento-preview-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto; /* Center the wrapper horizontally */
    }
    #bento-preview-canvas {
        width: 100%;
        height: 100%;
        object-fit: contain;
        border-radius: 12px;
        /* Provide a sensible max size for the preview in the UI */
        max-width: 450px; /* RENDER_WIDTH / 2 */
        max-height: 85vh;
    }

    /* --- Styles for html2canvas Rendering --- */
    .render-safe {
        color: ${colors.text.primary};
        font-family: 'Inter', sans-serif;
    }
    #bento-render-node {
        width: 900px;
        height: auto; /* KEY CHANGE: Height is now dynamic */
        background: radial-gradient(circle, #282828 0%, #1a1a1a 100%); 
        display: flex; 
        flex-direction: column;
    }
    .render-safe #bento-header {
        padding: 40px;
        font-size: 48px;
        font-weight: 700;
        flex-shrink: 0;
        text-align: left;
    }
    .render-safe #bento-grid-wrapper {
        flex-grow: 1;
        padding: 0 40px;
        width: 100%;
    }
    .render-safe #bento-grid {
         display: grid;
         grid-template-columns: repeat(4, 1fr);
         align-items: stretch; /* KEY CHANGE: Make cards in the same row equal height */
         gap: 20px;
         width: 100%;
    }
    .render-safe #bento-footer {
        padding: 40px;
        padding-top: 20px;
        text-align: right;
        font-size: 16px;
        color: ${colors.text.subtle};
        font-family: monospace;
        flex-shrink: 0;
    }
    .render-safe .bento-card {
        background-color: rgba(40, 40, 40, 0.8);
        border: 1px solid ${colors.background.secondarySection};
        border-radius: 24px;
        padding: 24px;
        display: flex; /* Use flex to make card content area grow */
        flex-direction: column;
        overflow: hidden;
    }
    .render-safe .bento-card-title {
        font-size: 22px;
        font-weight: 600;
        color: ${colors.text.subtle};
        margin-bottom: 16px;
        flex-shrink: 0;
    }
    .render-safe .bento-card-content {
        flex-grow: 1; /* Allow content to fill available vertical space */
        display: flex;
        flex-direction: column;
        min-height: 0;
        /* Center content within cards */
        align-items: center;
        justify-content: center;
    }
    
    /* KEY CHANGE:
       Skills table should always be full width. Other lists will shrink to fit their content.
       This allows them to be properly centered inside a full-width card, instead of stretching. */
    .render-safe .skills-table {
        width: 100%;
    }

    /* Record Item Styles */
    .render-safe .record-list { display: flex; flex-direction: column; gap: 16px; }
    .render-safe .record-item { display: flex; justify-content: space-between; align-items: baseline; font-size: 20px; border-bottom: 1px solid ${colors.background.secondarySection}; padding-bottom: 16px; gap: 32px; width: 100%; }
    .render-safe .record-item:last-child { border-bottom: none; }
    .render-safe .record-label { color: ${colors.text.subtle}; white-space: nowrap; }
    .render-safe .record-value { text-align: right; font-weight: 600; font-size: 22px; color: ${colors.text.primary}; }
    .render-safe .record-context { display: block; font-size: 16px; font-weight: 400; color: ${colors.text.subtle}; }
    
    /* Trophy Item Styles */
    .render-safe .trophy-list { display: flex; flex-direction: column; gap: 16px; }
    .render-safe .trophy-item { display: flex; align-items: center; gap: 20px; padding-bottom: 16px; border-bottom: 1px solid ${colors.background.secondarySection}; width: 100%; }
    .render-safe .trophy-item:last-child { border-bottom: none; }
    .render-safe .trophy-icon { width: 48px; height: 48px; flex-shrink: 0; }
    .render-safe .trophy-details { display: flex; flex-direction: column; gap: 4px; }
    .render-safe .trophy-title { font-size: 20px; font-weight: 600; color: ${colors.text.primary}; }
    .render-safe .trophy-problem { font-size: 16px; color: #38bdf8; text-decoration: none; }
    .render-safe .trophy-subtitle { font-size: 16px; color: ${colors.text.subtle}; }

    /* Milestone Styles */
    .render-safe .milestone-timeline { position: relative; }
    .render-safe .timeline-line { position: absolute; left: 8px; top: 8px; bottom: 8px; width: 2px; background-color: ${colors.background.secondarySection}; }
    .render-safe .milestone-list { display: flex; flex-direction: column; gap: 24px; }
    .render-safe .milestone-item { position: relative; padding-left: 32px; }
    .render-safe .milestone-dot { position: absolute; left: 0; top: 8px; width: 18px; height: 18px; border-radius: 50%; border: 3px solid ${colors.background.section}; }
    .render-safe .milestone-event { font-size: 20px; font-weight: 600; }
    .render-safe .milestone-date { font-size: 16px; color: ${colors.text.subtle}; }
    .render-safe .milestone-problem { font-size: 16px; color: #888; text-decoration: none; }

    /* Skills Table Styles */
    .render-safe .skills-table { display: flex; flex-direction: column; width: 100%; }
    .render-safe .skills-header, .render-safe .skill-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 16px; padding: 8px 0; border-bottom: 1px solid ${colors.background.secondarySection}; align-items: center; }
    .render-safe .skills-header { font-size: 16px; color: ${colors.text.subtle}; font-weight: 600; }
    .render-safe .skill-row:last-child { border-bottom: none; }
    .render-safe .skill-cell { text-align: center; font-size: 18px; }
    .render-safe .skill-cell:first-child { text-align: left; font-weight: 600; }

    /* Progress Ring Styles */
    .render-safe .progress-ring-container { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; min-height: 250px; }
    .render-safe .progress-ring-solved { font-size: 48px; font-weight: 700; fill: ${colors.text.primary}; }
    .render-safe .progress-ring-label { font-size: 20px; fill: ${colors.text.subtle}; }
    .render-safe .progress-ring-submissions { font-size: 22px; font-weight: 500; fill: ${colors.text.primary}; }

    /* Chart Styles */
    .render-safe .chart-container { position: relative; width: 100%; height: 100%; min-height: 250px; }
  `;

  return `
    <div id="bento-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="bg-dark-layer-1 rounded-xl w-full max-w-3xl h-full max-h-[95vh] shadow-2xl flex flex-row p-1.5 gap-1.5">

            <!-- Left Panel: Customization -->
            <div class="w-1/3 max-w-xs bg-dark-layer-0 rounded-lg p-4 overflow-y-auto">
                <h2 class="text-xl font-bold text-white mb-4">Customize Card</h2>
                <div class="space-y-2">
                    <!-- History Section -->
                     <div class="bg-dark-layer-1 rounded-lg">
                        <div class="bento-accordion-header flex justify-between items-center p-3 cursor-pointer"><h3 class="font-semibold text-white">History</h3><svg class="w-4 h-4 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>
                        <div id="bento-history-accordion-content" class="p-3 border-t border-dark-divider-3" style="display: none;">
                            <label class="flex items-center space-x-3 p-2 rounded-md hover:bg-white/10 cursor-pointer">
                                <input type="checkbox" id="bento-checkbox-history" class="form-checkbox h-4 w-4 rounded bg-transparent border-gray-500 text-blue-500 focus:ring-blue-500">
                                <span class="text-sm text-gray-300">Show History Chart</span>
                            </label>
                            <div id="history-date-pickers" class="space-y-2 mt-2 pl-8" style="display: none;">
                                 <label for="bento-history-start-date" class="text-xs text-gray-400">Start Date</label>
                                 <input type="date" id="bento-history-start-date" class="w-full bg-dark-layer-0 rounded p-1 text-sm text-gray-300 border border-dark-divider-3">
                                 <label for="bento-history-end-date" class="text-xs text-gray-400">End Date</label>
                                 <input type="date" id="bento-history-end-date" class="w-full bg-dark-layer-0 rounded p-1 text-sm text-gray-300 border border-dark-divider-3">
                            </div>
                        </div>
                    </div>
                    <!-- Milestones Section -->
                    <div class="bg-dark-layer-1 rounded-lg">
                        <div class="bento-accordion-header flex justify-between items-center p-3 cursor-pointer"><h3 class="font-semibold text-white">Milestones</h3><svg class="w-4 h-4 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>
                        <div id="bento-milestones-accordion-content" class="p-3 border-t border-dark-divider-3" style="display: none;"></div>
                    </div>
                    <!-- Trophies Section -->
                    <div class="bg-dark-layer-1 rounded-lg">
                        <div class="bento-accordion-header flex justify-between items-center p-3 cursor-pointer"><h3 class="font-semibold text-white">Trophies</h3><svg class="w-4 h-4 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>
                        <div id="bento-trophies-accordion-content" class="p-3 border-t border-dark-divider-3" style="display: none;"></div>
                    </div>
                    <!-- Records Section -->
                    <div class="bg-dark-layer-1 rounded-lg">
                        <div class="bento-accordion-header flex justify-between items-center p-3 cursor-pointer"><h3 class="font-semibold text-white">Records</h3><svg class="w-4 h-4 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>
                        <div id="bento-records-accordion-content" class="p-3 border-t border-dark-divider-3" style="display: none;"></div>
                    </div>
                    <!-- Activity Section -->
                    <div class="bg-dark-layer-1 rounded-lg">
                        <div class="bento-accordion-header flex justify-between items-center p-3 cursor-pointer"><h3 class="font-semibold text-white">Activity</h3><svg class="w-4 h-4 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>
                        <div id="bento-activity-accordion-content" class="p-3 border-t border-dark-divider-3" style="display: none;"></div>
                    </div>
                    <!-- Skills Section -->
                    <div class="bg-dark-layer-1 rounded-lg">
                        <div class="bento-accordion-header flex justify-between items-center p-3 cursor-pointer"><h3 class="font-semibold text-white">Skills</h3><svg class="w-4 h-4 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>
                        <div id="bento-skills-accordion-content" class="p-3 border-t border-dark-divider-3" style="display: none;"></div>
                    </div>
                </div>
            </div>

            <!-- Right Panel: Preview -->
            <div class="flex-1 flex flex-col min-w-0 bg-dark-layer-0 rounded-lg">
                <div class="flex-shrink-0 flex justify-end p-2">
                    <button id="bento-modal-close-btn" type="button" class="ring-offset-sd-background focus:ring-sd-ring data-[state=open]:bg-sd-accent data-[state=open]:text-sd-muted-foreground rounded-sm absolute right-4 top-[22px] opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none">
    <div class="relative text-[20px] leading-[normal] before:block before:h-5 before:w-4 w-4">
        <svg aria-hidden="true" focusable="false" data-prefix="far" data-icon="xmark" class="svg-inline--fa fa-xmark absolute left-1/2 top-1/2 h-[1em] -translate-x-1/2 -translate-y-1/2 align-[-0.125em]" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
            <path fill="currentColor" d="M345 137c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-119 119L73 103c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l119 119L39 375c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l119-119L311 409c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-119-119L345 137z"></path>
        </svg>
    </div>
    <span class="sr-only">Close</span>
</button>
                </div>

                <div class="flex-grow flex items-center justify-center min-h-0 p-4">
                    <div id="bento-preview-wrapper">
                        <div id="bento-preview-loader" style="display: none;">
                            <p class="text-white animate-pulse">Generating Preview...</p>
                        </div>
                        <canvas id="bento-preview-canvas" style="display: none;"></canvas>
                    </div>
                </div>

                <div class="flex-shrink-0 flex justify-end p-4">
                    <button id="share-bento-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg transition-colors duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed">
                        Share
                    </button>
                </div>
            </div>
        </div>
    </div>
    <style>${modalStyles}</style>
  `;
}