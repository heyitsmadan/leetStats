// src/core/main.ts
import type { RawSubmission, CachedMetadata, ILoader } from '../types';
import {
  fetchUserStatus,
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
  // 1. Check if we are on a user profile page.
  const usernameMatch = window.location.pathname.match(/\/u\/([a-zA-Z0-9_-]+)/);
  if (!usernameMatch) {
    // Not a profile page, so we do nothing.
    return;
  }
  const profileUsername = usernameMatch[1];

  // 2. Fetch the current user's login status from LeetCode.
  const userStatus = await fetchUserStatus();

  // 3. Conditional Logic: Decide whether to run the extension.
  if (!userStatus.isSignedIn) {
    // User is not logged in. Show a message in the loader and stop.
    loader.show();
    loader.error("Please log in to see stats.");
    return;
  }

  if (userStatus.username !== profileUsername) {
    // User is logged in, but this is not their profile page. Do nothing.
    console.log("LeetStats: Viewing another user's profile. No stats will be shown.");
    return;
  }

  // If we reach here, the user is logged in and on their own profile page.
  const loggedInUsername = userStatus.username;

  try {
    loader.show();

    // 4. Get total accepted submissions for the progress bar.
    const totalAccepted = await fetchTotalAcceptedSubmissions(loggedInUsername);
    
    // 5. Load cached data for the logged-in user.
    const cachedSubmissionsData = await loadSubmissionsFromStorage(loggedInUsername);
    const cachedMetadata = await loadProblemMetadataFromStorage();
    
    const acceptedInCache = cachedSubmissionsData.submissions.filter(s => s.status === 10).length;
    const totalInCache = cachedSubmissionsData.submissions.length;
    
    // Immediately update loader with count from cache.
    loader.update(totalInCache, acceptedInCache, totalAccepted);

    // 6. Fetch new submissions with progress tracking.
    const onProgress = (progress: { accepted: number; total: number }) => {
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

    if (newSubmissions.length > 0) {
      const allSubmissions = [...cachedSubmissionsData.submissions, ...newSubmissions];
      // 7. Save updated submissions for the specific user.
      await saveSubmissionsToStorage(loggedInUsername, allSubmissions);

      // 8. Fetch and process data only if there are new submissions.
      const metadataResult = await fetchAndSaveMissingMetadata(allSubmissions, cachedMetadata);
      const processedData = processData(allSubmissions, metadataResult.updatedMetadata);
      renderPageLayout(processedData);
    } else if (cachedSubmissionsData.submissions.length > 0) {
      // If no new submissions, just render the data from the cache.
      const processedData = processData(cachedSubmissionsData.submissions, cachedMetadata);
      renderPageLayout(processedData);
    }


    loader.complete();

  } catch (err) {
    console.error("❌ Failed to initialize LeetCode stats:", err);
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    loader.error(`❌ Error: ${errorMessage}`);
    throw err;
  }
}

/**
 * Fetches and saves metadata for any problems that are not already in the cache.
 */
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