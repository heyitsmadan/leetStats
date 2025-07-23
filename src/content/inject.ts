import { initialize } from '../core/main';
import { FetchLoader } from '../ui/components/Loader';

console.log("🚀 LeetCode Stats Extension Injected!");

// We only want to run the main logic on the user's profile page.
if (window.location.pathname.startsWith('/u/')) {
    runAnalysis();
}

function runAnalysis() {
    // 1. Create an instance of our new loader component.
    const loader = new FetchLoader();

    // 2. Kick off the main process and pass the loader instance to it.
    // The initialize function will now manage the loader's state (show, update, complete).
    initialize(loader).catch(error => {
        console.error("Injection script caught an error:", error);
        // The error is already handled and displayed by the loader in main.ts,
        // so no need for extra UI handling here.
    });
}
