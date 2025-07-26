import type { ProcessedData } from '../../types';

/**
 * Defines the structure of the stats for the progress ring component.
 */
export interface SolvedStats {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  totalSubmissions: number;
}

/**
 * Calculates the total number of solved problems, the breakdown by difficulty,
 * and the total number of submissions.
 * @param processedData The main processed data object.
 * @returns An object containing the calculated stats.
 */
export function getSolvedStats(processedData: ProcessedData): SolvedStats {
  const { submissions, problemMap } = processedData;

  let easySolved = 0;
  let mediumSolved = 0;
  let hardSolved = 0;

  // Iterate over the map of unique problems to count solved stats.
  for (const subs of problemMap.values()) {
    const wasSolved = subs.some(s => s.status === 10);
    if (wasSolved) {
      // All submissions for a problem have the same difficulty.
      const difficulty = subs[0].metadata?.difficulty;
      if (difficulty === 'Easy') easySolved++;
      else if (difficulty === 'Medium') mediumSolved++;
      else if (difficulty === 'Hard') hardSolved++;
    }
  }

  const totalSolved = easySolved + mediumSolved + hardSolved;
  const totalSubmissions = submissions.length;

  return {
    totalSolved,
    easySolved,
    mediumSolved,
    hardSolved,
    totalSubmissions,
  };
}
