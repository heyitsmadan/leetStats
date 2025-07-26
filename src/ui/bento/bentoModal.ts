/**
 * Returns the complete HTML and CSS for the bento generator modal.
 */
/**
 * Returns the complete HTML and CSS for the bento generator modal.
 */
/**
 * Returns the complete HTML and CSS for the bento generator modal.
 */
export function createBentoModalHTML(): string {
  return `
    <div id="bento-modal" style="display: none; background-color: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px);" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="bg-dark-layer-1 rounded-xl w-full max-w-2xl h-full max-h-[90vh] shadow-2xl flex flex-row p-1.5 gap-1.5">

            <div class="w-1/3 max-w-xs bg-dark-layer-0 rounded-lg p-4 overflow-y-auto">
                <h2 class="text-xl font-bold text-white mb-4">Customize Card</h2>
                <div class="space-y-2">
                    <div class="bg-dark-layer-1 rounded-lg">
                        <div class="bento-accordion-header flex justify-between items-center p-3 cursor-pointer">
                            <h3 class="font-semibold text-white">History</h3>
                            <svg class="w-4 h-4 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                        <div id="bento-history-accordion-content" class="p-3 border-t border-dark-divider-3" style="display: none;">
                            <p class="text-xs text-gray-500">History options coming soon.</p>
                        </div>
                    </div>
                    <div class="bg-dark-layer-1 rounded-lg">
                        <div class="bento-accordion-header flex justify-between items-center p-3 cursor-pointer"><h3 class="font-semibold text-white">Milestones</h3><svg class="w-4 h-4 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>
                        <div id="bento-milestones-accordion-content" class="p-3 border-t border-dark-divider-3" style="display: none;"><p class="text-xs text-gray-500">Milestone options coming soon.</p></div>
                    </div>
                    <div class="bg-dark-layer-1 rounded-lg">
                        <div class="bento-accordion-header flex justify-between items-center p-3 cursor-pointer"><h3 class="font-semibold text-white">Trophies</h3><svg class="w-4 h-4 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>
                        <div id="bento-trophies-accordion-content" class="p-3 border-t border-dark-divider-3" style="display: none;"><p class="text-xs text-gray-500">Trophy options coming soon.</p></div>
                    </div>
                    <div class="bg-dark-layer-1 rounded-lg">
                        <div class="bento-accordion-header flex justify-between items-center p-3 cursor-pointer"><h3 class="font-semibold text-white">Records</h3><svg class="w-4 h-4 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>
                        <div id="bento-records-accordion-content" class="p-3 border-t border-dark-divider-3" style="display: none;"></div>
                    </div>
                    <div class="bg-dark-layer-1 rounded-lg">
                        <div class="bento-accordion-header flex justify-between items-center p-3 cursor-pointer"><h3 class="font-semibold text-white">Activity</h3><svg class="w-4 h-4 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>
                        <div id="bento-activity-accordion-content" class="p-3 border-t border-dark-divider-3" style="display: none;"><p class="text-xs text-gray-500">Activity options coming soon.</p></div>
                    </div>
                    <div class="bg-dark-layer-1 rounded-lg">
                        <div class="bento-accordion-header flex justify-between items-center p-3 cursor-pointer"><h3 class="font-semibold text-white">Skills</h3><svg class="w-4 h-4 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>
                        <div id="bento-skills-accordion-content" class="p-3 border-t border-dark-divider-3" style="display: none;"><p class="text-xs text-gray-500">Skill options coming soon.</p></div>
                    </div>
                </div>
            </div>

            <div class="flex-1 flex flex-col min-w-0 bg-dark-layer-0 rounded-lg">
                <div class="flex-shrink-0 flex justify-end p-2">
                    <button id="bento-modal-close-btn" class="text-gray-400 hover:text-white z-20 p-1 rounded-full hover:bg-white/10">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div class="flex-grow flex items-center justify-center min-h-0 p-4">
                    <div id="bento-preview-wrapper" class="w-full h-full flex items-center justify-center">
                        <div id="bento-preview-loader" style="display: none;">
                            <p class="text-white animate-pulse">Generating Preview...</p>
                        </div>
                        <canvas id="bento-preview-canvas" class="rounded-xl shadow-inner-heavy" style="display: none;"></canvas>
                    </div>
                </div>

                <div class="flex-shrink-0 flex justify-end p-4">
                    <button id="share-bento-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg transition-colors duration-200 disabled:bg-gray-500">
                        Share
                    </button>
                </div>
            </div>
        </div>
    </div>

    <style>
        #bento-preview-canvas {
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
            object-fit: contain;
        }

        /* Styles for consistent rendering, using PX units */
        .render-safe {
            color: #EFEFEF;
        }
        .render-safe #bento-header {
            padding: 24px;
            font-size: 20px;
            font-weight: 700;
        }
        .render-safe #bento-grid {
             display: grid;
             grid-template-columns: repeat(6, 1fr);
             grid-template-rows: repeat(6, 1fr);
             padding: 24px;
             padding-top: 0;
             gap: 16px;
             height: 100%;
             place-items: center;
        }
        .render-safe #bento-footer {
            padding: 24px;
            padding-top: 0;
            text-align: right;
            font-size: 10px;
            color: #666;
            font-family: monospace;
        }
        .render-safe .bento-card {
            max-width: 100%;
            background-color: rgba(30, 30, 30, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 16px;
            display: flex;
            flex-direction: column;
        }
        .render-safe .bento-card-title {
            font-size: 18px;
            font-weight: 600;
            color: #a0a0a0;
            margin-bottom: 12px;
        }
        .render-safe .bento-card-content {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .render-safe .record-item {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            font-size: 14px;
            border-bottom: 1px solid #333;
            padding-bottom: 8px;
            gap: 24px;
        }
        .render-safe .record-item:last-child {
            border-bottom: none;
        }
        .render-safe .record-label {
            color: #b0b0b0;
            white-space: nowrap;
        }
        .render-safe .record-value {
            text-align: right;
            font-weight: 600;
            color: #FFFFFF;
        }
        .render-safe .record-context {
            display: block;
            font-size: 11px;
            font-weight: 400;
            color: #888;
        }
    </style>
  `;
}