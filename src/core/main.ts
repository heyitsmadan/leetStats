import type { RawSubmission, CachedMetadata } from '../types';
import { fetchAllSubmissions, fetchProblemMetadata } from './api';
import {
  saveSubmissionsToStorage,
  loadSubmissionsFromStorage,
  loadProblemMetadataFromStorage,
  saveProblemMetadataToStorage,
} from './storage';
// import { processData } from '../analysis/processor';
// import { renderPageLayout } from '../ui/layout';

/**
 * The main orchestrator function for the extension.
 */
export async function initialize(updateUICallback: (message: string) => void): Promise<void> {
  try {
    // 1. Load cached data
    const cachedSubmissionsData = await loadSubmissionsFromStorage();
    const cachedMetadata = await loadProblemMetadataFromStorage();

    // 2. Fetch new submissions
    updateUICallback('📡 Fetching new submissions...');
    const newSubmissions = await fetchAllSubmissions(updateUICallback, cachedSubmissionsData.latestFetchedTimestamp);
    
    const allSubmissions = [...cachedSubmissionsData.submissions, ...newSubmissions];
    
    // 3. Save updated submissions if there are any
    if (newSubmissions.length > 0) {
      await saveSubmissionsToStorage(allSubmissions);
    }
    
    // 4. Fetch missing problem metadata efficiently
    updateUICallback('🧠 Fetching problem metadata...');
    const metadataNeedsUpdate = await fetchAndSaveMissingMetadata(allSubmissions, cachedMetadata);

    console.log("✅ All data fetched and cached successfully!");
    console.log("Submissions:", allSubmissions);
    console.log("Metadata:", metadataNeedsUpdate.updatedMetadata);
    
    // NEXT STEPS (Currently commented out)
    // const processedData = processData(allSubmissions, metadataNeedsUpdate.updatedMetadata);
    // renderPageLayout(processedData);
    updateUICallback('✅ Analysis Complete! (Check console for data)');


  } catch (err) {
    console.error("❌ Failed to initialize LeetCode stats:", err);
    updateUICallback('❌ An error occurred. Check the console for details.');
    throw err;
  }
}

/**
 * Helper function to find missing metadata, fetch it, and save it back to storage.
 */
async function fetchAndSaveMissingMetadata(submissions: RawSubmission[], cachedMetadata: CachedMetadata) {
  const uniqueSlugs = [...new Set(submissions.map(s => s.titleSlug))];
  const slugsToFetch = uniqueSlugs.filter(slug => !cachedMetadata[slug]);
  let didUpdate = false;
  
  if (slugsToFetch.length > 0) {
    console.log(`Fetching metadata for ${slugsToFetch.length} new problems...`);
    didUpdate = true;
    const promises = slugsToFetch.map(slug => fetchProblemMetadata(slug));
    const newMetadataArray = await Promise.all(promises);

    for (const metadata of newMetadataArray) {
      if (metadata) {
        cachedMetadata[metadata.slug] = metadata;
      }
    }
    await saveProblemMetadataToStorage(cachedMetadata);
  }

  return { updatedMetadata: cachedMetadata, didUpdate };
}
