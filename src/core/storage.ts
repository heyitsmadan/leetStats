import type { RawSubmission, CachedSubmissions, CachedMetadata } from '../types';

// A key to store all user-specific data under one object in chrome.storage.local
const USER_DATA_KEY = 'leetStatsUserData';

// Defines the structure for storing data for multiple users.
interface UserStorage {
    [username: string]: CachedSubmissions;
}

/**
 * Saves the complete list of submissions for a specific user.
 * @param username The user for whom to save the data.
 * @param submissions The list of submissions to save.
 */
export async function saveSubmissionsToStorage(username: string, submissions: RawSubmission[]): Promise<void> {
    if (!username || submissions.length === 0) {
        return;
    }

    // Find the highest submission ID (assuming IDs are numeric and can be large)
    const latestSubmissionId = Math.max(...submissions.map(s => parseInt(s.id, 10))).toString();

    const dataToSave: CachedSubmissions = {
        submissions,
        latestFetchedSubmissionId: latestSubmissionId,
    };

    // Retrieve the existing data object, update it, and save it back.
    const data = await chrome.storage.local.get(USER_DATA_KEY);
    const allUserData: UserStorage = data[USER_DATA_KEY] || {};
    allUserData[username] = dataToSave;

    await chrome.storage.local.set({ [USER_DATA_KEY]: allUserData });
}

/**
 * Loads submissions for a specific user from storage.
 * @param username The user for whom to load data.
 */
export async function loadSubmissionsFromStorage(username: string): Promise<CachedSubmissions> {
    if (!username) {
        return { submissions: [], latestFetchedSubmissionId: '0' };
    }

    const data = await chrome.storage.local.get(USER_DATA_KEY);
    const allUserData: UserStorage = data[USER_DATA_KEY] || {};

    // Return the specific user's data, or a default empty object if not found.
    return allUserData[username] || {
        submissions: [],
        latestFetchedSubmissionId: '0',
    };
}

/**
 * Loads the entire problem metadata cache from storage.
 * Metadata is global and not user-specific.
 */
export async function loadProblemMetadataFromStorage(): Promise<CachedMetadata> {
    const data = await chrome.storage.local.get(['problemMetadata']);
    return data.problemMetadata || {};
}

/**
 * Saves the entire problem metadata cache back to storage.
 */
export async function saveProblemMetadataToStorage(metadata: CachedMetadata): Promise<void> {
    await chrome.storage.local.set({ problemMetadata: metadata });
}