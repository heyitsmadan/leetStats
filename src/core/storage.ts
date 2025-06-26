import type { RawSubmission, CachedSubmissions, ProblemMetadata, CachedMetadata } from '../types';

/**
 * Saves the complete list of submissions and the latest timestamp to storage.
 */
export async function saveSubmissionsToStorage(submissions: RawSubmission[]): Promise<void> {
  if (submissions.length === 0) return;
  
  const latestTimestamp = Math.max(...submissions.map(s => parseInt(s.timestamp, 10)));
  const dataToSave: CachedSubmissions = {
    submissions,
    latestFetchedTimestamp: latestTimestamp,
  };
  await chrome.storage.local.set(dataToSave);
}

/**
 * Loads submissions and the last fetched timestamp from storage.
 */
export async function loadSubmissionsFromStorage(): Promise<CachedSubmissions> {
  const data = await chrome.storage.local.get(['submissions', 'latestFetchedTimestamp']);
  return {
    submissions: data.submissions || [],
    latestFetchedTimestamp: data.latestFetchedTimestamp || 0,
  };
}

/**
 * Loads the entire problem metadata cache from storage.
 */
export async function loadProblemMetadataFromStorage(): Promise<CachedMetadata> {
  const data = await chrome.storage.local.get(['problemMetadata']);
  return data.problemMetadata || {};
}

/**
 * Saves the entire problem metadata cache back to storage.
 * This is more efficient than reading and writing for every single problem.
 */
export async function saveProblemMetadataToStorage(metadata: CachedMetadata): Promise<void> {
  await chrome.storage.local.set({ problemMetadata: metadata });
}

/**
 * Clears all data from local storage for debugging purposes.
 */
export async function clearStorage(): Promise<void> {
  await chrome.storage.local.clear();
}
