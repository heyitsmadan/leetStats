import { initialize } from '../core/main';

console.log("🚀 LeetCode Stats Extension Injected!");

// We only want to run the main logic on the user's profile page.
if (window.location.pathname.startsWith('/u/')) {
    runAnalysis();
}

function runAnalysis() {
    // Create a simple UI element to show progress
    // const statusDiv = document.createElement('div');
    // statusDiv.style.position = 'fixed';
    // statusDiv.style.bottom = '20px';
    // statusDiv.style.left = '20px';
    // statusDiv.style.padding = '10px 20px';
    // statusDiv.style.backgroundColor = '#282828';
    // statusDiv.style.color = '#fff';
    // statusDiv.style.borderRadius = '8px';
    // statusDiv.style.zIndex = '9999';
    // statusDiv.style.fontFamily = 'monospace';
    // statusDiv.textContent = 'LC Stats: Initializing...';
    // document.body.appendChild(statusDiv);

    const updateUICallback = (message: string) => {
        console.log(message);
        // statusDiv.textContent = `LC Statgs: ${message}`;
    };

    // Kick off the main process
    initialize(updateUICallback).catch(error => {
        console.error("Injection script caught an error:", error);
    });
}
