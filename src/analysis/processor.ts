import type { RawSubmission, ProblemMetadata } from '../types';

// Define the shape of our processed data object
export interface ProcessedData {
  dailyMap: Map<string, RawSubmission[]>;
  // We will add more processed maps here later (problemMap, etc.)
}

/**
 * Takes the raw submission and metadata and creates primary, reusable data structures.
 * This heavy lifting is done only once.
 * @param {RawSubmission[]} rawSubmissions - The complete list of user submissions.
 * @param {Object} metadata - The map of problem metadata.
 * @returns {ProcessedData} An object containing all processed data maps.
 */
export function processData(
  rawSubmissions: RawSubmission[],
  metadata: { [slug: string]: ProblemMetadata }
): ProcessedData {
  
  // Create a map to group submissions by date (YYYY-MM-DD)
  const dailyMap = new Map<string, RawSubmission[]>();

  for (const submission of rawSubmissions) {
    const date = new Date(parseInt(submission.timestamp, 10) * 1000);
    const dayKey = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD

    if (!dailyMap.has(dayKey)) {
      dailyMap.set(dayKey, []);
    }
    dailyMap.get(dayKey)!.push(submission);
  }

  // NOTE: In the future, you'll add logic here to create problemMap, langMap, etc.

  return {
    dailyMap,
  };
}
