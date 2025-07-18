// src/core/main.ts
import type { RawSubmission, CachedMetadata, ProblemMetadata, ILoader } from '../types';
import {
  fetchTotalAcceptedSubmissions,
  fetchAllSubmissions,
  fetchProblemMetadata,
} from './api';
import {
  saveSubmissionsToStorage,
  loadSubmissionsFromStorage,
  loadProblemMetadataFromStorage,
  saveProblemMetadataToStorage,
} from './storage';
import { processData } from '../analysis/processor';
import { renderPageLayout } from '../ui/layout';

/**
 * The main orchestrator function for the extension.
 */
export async function initialize(loader: ILoader): Promise<void> {
  try {
    loader.show();

    // 1. Get username and total accepted submissions for the progress bar
    const usernameMatch = window.location.pathname.match(/\/u\/([a-zA-Z0-9_-]+)/);
    if (!usernameMatch) {
        throw new Error("Could not extract username from URL.");
    }
    const username = usernameMatch[1];
    const totalAccepted = await fetchTotalAcceptedSubmissions(username);
    
    // 2. Load cached data
    const cachedSubmissionsData = await loadSubmissionsFromStorage();
    const cachedMetadata = await loadProblemMetadataFromStorage();
    
    const acceptedInCache = cachedSubmissionsData.submissions.filter(s => s.status === 10).length;
    const totalInCache = cachedSubmissionsData.submissions.length;
    
    // Immediately update loader with count from cache
    loader.update(totalInCache, acceptedInCache, totalAccepted);

    // 3. Fetch new submissions with progress tracking
    const onProgress = (progress: { accepted: number; total: number }) => {
        // progress.accepted is the running total of *newly* fetched accepted subs.
        // progress.total is the running total of *all* newly fetched subs.
        loader.update(
            totalInCache + progress.total, 
            acceptedInCache + progress.accepted, 
            totalAccepted
        );
    };
    
    const newSubmissions = await fetchAllSubmissions(
      cachedSubmissionsData.latestFetchedSubmissionId,
      onProgress
    );

    const allSubmissions = [...cachedSubmissionsData.submissions, ...newSubmissions];

    // 4. Save updated submissions if there are any
    if (newSubmissions.length > 0) {
      await saveSubmissionsToStorage(allSubmissions);
    }

    // 5. Fetch missing problem metadata
    const metadataResult = await fetchAndSaveMissingMetadata(allSubmissions, cachedMetadata);

    // 6. Process the complete raw data into usable maps
    const processedData = processData(allSubmissions, metadataResult.updatedMetadata);

    // 7. Pass the processed data to the UI layer to render everything
    renderPageLayout(processedData);

    loader.complete(); // Complete without a final message

  } catch (err) {
    console.error("❌ Failed to initialize LeetCode stats:", err);
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    loader.error(`❌ Error: ${errorMessage}`);
    throw err;
  }
}

async function fetchAndSaveMissingMetadata(
  submissions: RawSubmission[], 
  cachedMetadata: CachedMetadata
): Promise<{ updatedMetadata: CachedMetadata }> {
  const uniqueSlugs = [...new Set(submissions.map(s => s.titleSlug))];
  const slugsToFetch = uniqueSlugs.filter(slug => !cachedMetadata[slug]);

  if (slugsToFetch.length > 0) {
    console.log(`Fetching metadata for ${slugsToFetch.length} new problems...`);
    const promises = slugsToFetch.map(slug => fetchProblemMetadata(slug));
    const newMetadataArray = await Promise.all(promises);

    for (const metadata of newMetadataArray) {
      if (metadata) {
        cachedMetadata[metadata.slug] = metadata;
      }
    }

    await saveProblemMetadataToStorage(cachedMetadata);
  }

  return { updatedMetadata: cachedMetadata };
}
