import { colors } from '../theme/colors';

/**
 * Returns the complete HTML and CSS for the bento generator modal.
 */
export function createBentoModalHTML(): string {
  // Using colors from the theme file for inline styles
  const modalStyles = `
    #bento-modal {
      --left-panel-width: 480px;
      display: none;
      /* Light mode backdrop with blur */
      background-color: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(8px);
      z-index: 10000;
    }

    .dark #bento-modal {
      /* Dark mode backdrop with blur */
      background-color: rgba(26, 26, 26, 0.7);
    }

    #bento-controls-panel.is-rendering {
      pointer-events: none;
      opacity: 0.6;
      transition: opacity 0.3s ease-in-out;
    }

    .bento-accordion-content {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease-out;
    }

    #bento-preview-wrapper {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
    }

    #bento-preview-canvas {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 12px;
      max-width: 450px;
      max-height: 85vh;
    }

    /* --- Styles for html2canvas Rendering --- */
    .render-safe {
      color: ${colors.text.primary};
      font-family: 'Inter', sans-serif;
    }

    #bento-render-node {
      width: 900px;
      height: auto;
      background: #1a1a1a;
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
      align-items: stretch;
      gap: 20px;
      width: 100%;
    }

    .render-safe #bento-footer {
      padding: 20px 40px 20px;
      text-align: right;
      font-size: 16px;
      color: ${colors.text.subtle};
      font-family: 'Inter', sans-serif;
      flex-shrink: 0;
    }

    .render-safe .bento-card {
      background-color: rgba(40, 40, 40, 0.8);
      border: 1px solid ${colors.background.secondarySection};
      border-radius: 24px;
      padding: 24px;
      display: flex;
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
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      align-items: center;
      justify-content: center;
    }

    .render-safe .skills-table {
      width: 100%;
    }

    /* Record Item Styles */
    .render-safe .record-list { display: flex; flex-direction: column; gap: 16px; width: 100%; }
    .render-safe .record-item { display: flex; justify-content: space-between; align-items: baseline; font-size: 20px; border-bottom: 1px solid ${colors.background.secondarySection}; padding-bottom: 16px; gap: 32px; width: 100%; }
    .render-safe .record-item:last-child { border-bottom: none; }
    .render-safe .record-label { color: ${colors.text.primary}; white-space: nowrap; }
    .render-safe .record-value { text-align: right; font-weight: 600; font-size: 22px; color: ${colors.text.primary}; }
    .render-safe .record-context { display: block; font-size: 16px; font-weight: 400; color: ${colors.text.subtle}; }

    /* Trophy Item Styles */
    .render-safe .trophy-list { display: flex; flex-direction: column; gap: 16px; width: 100%; }
    .render-safe .trophy-item { display: flex; align-items: center; gap: 20px; padding-bottom: 16px; border-bottom: 1px solid ${colors.background.secondarySection}; width: 100%; }
    .render-safe .trophy-item:last-child { border-bottom: none; }
    .render-safe .trophy-icon { width: 48px; height: 48px; flex-shrink: 0; }
    .render-safe .trophy-details { display: flex; flex-direction: column; gap: 4px; }
    .render-safe .trophy-title { font-size: 20px; font-weight: 600; color: ${colors.text.primary}; }
    .render-safe .trophy-problem { font-size: 16px; color: #64b5f6; text-decoration: none; }
    .render-safe .trophy-subtitle { font-size: 16px; color: ${colors.text.subtle}; }

    /* Milestone Styles */
    .render-safe .milestone-timeline { position: relative; width: 100%; }
    .render-safe .timeline-line { position: absolute; left: 8px; top: 8px; bottom: 8px; width: 2px; background-color: ${colors.background.secondarySection}; }
    .render-safe .milestone-list { display: flex; flex-direction: column; gap: 24px; }
    .render-safe .milestone-item { position: relative; padding-left: 32px; }
    .render-safe .milestone-dot { position: absolute; left: 0; top: 8px; width: 18px; height: 18px; border-radius: 50%; border: 3px solid ${colors.background.section}; }
    .render-safe .milestone-event { font-size: 20px; font-weight: 600; }
    .render-safe .milestone-date { font-size: 16px; color: ${colors.text.subtle}; }
    .render-safe .milestone-problem { font-size: 14px; color: #6b7280; text-decoration: none; }
    .render-safe .milestone-problem:hover { text-decoration: underline; }

    /* Skills Table Styles */
    .render-safe .skills-table { display: flex; flex-direction: column; width: 100%; }
    .render-safe .skills-header, .render-safe .skill-row { display: grid; grid-template-columns: auto 1fr 1fr 1fr; gap: 16px; padding: 8px 0; border-bottom: 1px solid ${colors.background.secondarySection}; align-items: center; }
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
    <div id="bento-modal" class="fixed inset-0 flex items-center justify-center p-4">
      <div class="bg-layer-1 dark:bg-dark-layer-1 rounded-xl h-full max-h-[95vh] shadow-2xl flex flex-row p-1.5 gap-1.5">

        <!-- Controls Panel -->
        <div id="bento-controls-panel" class="bg-layer-0 dark:bg-dark-layer-0 rounded-lg p-4 flex flex-col flex-shrink-0" style="width: var(--left-panel-width);">
          <h2 class="text-xl font-bold text-label-1 dark:text-dark-label-1 mb-4 flex-shrink-0">Customize</h2>
          <div class="space-y-2 overflow-y-auto overflow-x-hidden">
            
            <!-- About Accordion -->
            <div class="bg-layer-1 dark:bg-dark-layer-1 rounded-lg">
              <div class="bento-accordion-header p-3 cursor-pointer">
                <div class="flex justify-between items-center">
                  <h3 class="font-semibold text-label-1 dark:text-dark-label-1">About</h3>
                  <svg class="w-4 h-4 text-label-3 dark:text-dark-label-3 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
              <div class="bento-accordion-content">
                <div id="bento-about-accordion-content" class="p-3 border-t border-divider-3 dark:border-dark-divider-3"></div>
              </div>
            </div>

            <!-- History Accordion -->
            <div class="bg-layer-1 dark:bg-dark-layer-1 rounded-lg">
              <div class="bento-accordion-header p-3 cursor-pointer">
                <div class="flex justify-between items-center">
                  <h3 class="font-semibold text-label-1 dark:text-dark-label-1">History</h3>
                  <svg class="w-4 h-4 text-label-3 dark:text-dark-label-3 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
              <div class="bento-accordion-content">
                <div id="bento-history-accordion-content" class="p-3 border-t border-divider-3 dark:border-dark-divider-3"></div>
              </div>
            </div>

            <!-- Milestones Accordion -->
            <div class="bg-layer-1 dark:bg-dark-layer-1 rounded-lg">
              <div class="bento-accordion-header p-3 cursor-pointer">
                <div class="flex justify-between items-center">
                  <h3 class="font-semibold text-label-1 dark:text-dark-label-1">Milestones</h3>
                  <svg class="w-4 h-4 text-label-3 dark:text-dark-label-3 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
              <div class="bento-accordion-content">
                <div id="bento-milestones-accordion-content" class="p-3 border-t border-divider-3 dark:border-dark-divider-3"></div>
              </div>
            </div>

            <!-- Trophies Accordion -->
            <div class="bg-layer-1 dark:bg-dark-layer-1 rounded-lg">
              <div class="bento-accordion-header p-3 cursor-pointer">
                <div class="flex justify-between items-center">
                  <h3 class="font-semibold text-label-1 dark:text-dark-label-1">Trophies</h3>
                  <svg class="w-4 h-4 text-label-3 dark:text-dark-label-3 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
              <div class="bento-accordion-content">
                <div id="bento-trophies-accordion-content" class="p-3 border-t border-divider-3 dark:border-dark-divider-3"></div>
              </div>
            </div>

            <!-- Records Accordion -->
            <div class="bg-layer-1 dark:bg-dark-layer-1 rounded-lg">
              <div class="bento-accordion-header p-3 cursor-pointer">
                <div class="flex justify-between items-center">
                  <h3 class="font-semibold text-label-1 dark:text-dark-label-1">Records</h3>
                  <svg class="w-4 h-4 text-label-3 dark:text-dark-label-3 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
              <div class="bento-accordion-content">
                <div id="bento-records-accordion-content" class="p-3 border-t border-divider-3 dark:border-dark-divider-3"></div>
              </div>
            </div>

            <!-- Activity Accordion -->
            <div class="bg-layer-1 dark:bg-dark-layer-1 rounded-lg">
              <div class="bento-accordion-header p-3 cursor-pointer">
                <div class="flex justify-between items-center">
                  <h3 class="font-semibold text-label-1 dark:text-dark-label-1">Activity</h3>
                  <svg class="w-4 h-4 text-label-3 dark:text-dark-label-3 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
              <div class="bento-accordion-content">
                <div id="bento-activity-accordion-content" class="p-3 border-t border-divider-3 dark:border-dark-divider-3"></div>
              </div>
            </div>

            <!-- Skills Accordion -->
            <div class="bg-layer-1 dark:bg-dark-layer-1 rounded-lg">
              <div class="bento-accordion-header p-3 cursor-pointer">
                <div class="flex justify-between items-center">
                  <h3 class="font-semibold text-label-1 dark:text-dark-label-1">Skills</h3>
                  <svg class="w-4 h-4 text-label-3 dark:text-dark-label-3 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
              <div class="bento-accordion-content">
                <div id="bento-skills-accordion-content" class="p-3 border-t border-divider-3 dark:border-dark-divider-3"></div>
              </div>
            </div>

          </div>
        </div>

        <!-- Preview Panel -->
        <div class="w-[500px] flex-shrink-0 flex flex-col bg-layer-0 dark:bg-dark-layer-0 rounded-lg">
          <div class="flex-shrink-0 flex justify-end p-2">
            <button id="bento-modal-close-btn" type="button" class="text-label-2 dark:text-dark-label-2 ring-offset-sd-background focus:ring-sd-ring data-[state=open]:bg-sd-accent data-[state=open]:text-sd-muted-foreground rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none">
              <div class="relative text-[24px] leading-[normal] before:block before:h-5 before:w-4 w-4">
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
                <p class="text-label-1 dark:text-dark-label-1 animate-pulse">Generating Preview...</p>
              </div>
              <canvas id="bento-preview-canvas" style="display: none;"></canvas>
            </div>
          </div>

          <div class="flex-shrink-0 flex justify-center items-center p-4 gap-3">
            <button id="copy-bento-btn" class="bg-green-0 dark:bg-dark-green-0 text-green-s dark:text-dark-green-s hover:text-green-s dark:hover:text-dark-green-s flex items-center justify-center w-32 rounded-lg py-[7px] font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>Copy</span>
            </button>
            <button id="download-bento-btn" class="bg-layer-2 hover:bg-layer-3 dark:bg-dark-layer-1 dark:hover:bg-dark-layer-2 border border-divider-3 dark:border-dark-divider-3 text-label-2 dark:text-dark-label-2 flex items-center justify-center w-32 rounded-lg py-[7px] font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Download</span>
            </button>
          </div>
        </div>

      </div>
    </div>
    <style>${modalStyles}</style>
  `;
}