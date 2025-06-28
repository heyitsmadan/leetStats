import type { RawSubmission, ProblemMetadata, ProcessedData, ProcessedSubmission } from '../types';

/**
 * Processes raw data into a more usable, enriched format. This is the foundation
 * for all other analysis functions.
 * @param rawSubmissions The complete list of user submissions.
 * @param metadata The map of problem metadata.
 * @returns {ProcessedData} An object containing enriched data structures.
 */
export function processData(
  rawSubmissions: RawSubmission[],
  metadata: { [slug: string]: ProblemMetadata }
): ProcessedData {
  
  // 1. Create a single, enriched list of submissions. This is our source of truth.
  const submissions: ProcessedSubmission[] = rawSubmissions.map(sub => ({
    ...sub,
    // **TIMEZONE FIX:** Create a Date object in the user's local timezone.
    // All subsequent .getHours(), .getDay(), etc., will be based on their locale.
    date: new Date(parseInt(sub.timestamp, 10) * 1000),
    metadata: metadata[sub.titleSlug],
  }));

  // 2. Create a map of submissions grouped by problem for easy lookups.
  const problemMap = new Map<string, ProcessedSubmission[]>();
  for (const submission of submissions) {
    if (!problemMap.has(submission.titleSlug)) {
      problemMap.set(submission.titleSlug, []);
    }
    problemMap.get(submission.titleSlug)!.push(submission);
  }
  
  // Sort submissions within each problem chronologically.
  for (const problemSubmissions of problemMap.values()) {
    problemSubmissions.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  return {
    submissions, // The full, enriched list
    problemMap,  // Submissions grouped by problem
  };
}
