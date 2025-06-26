import type { ProcessedData } from '../processor';

/**
 * Calculates cumulative submissions over time.
 * @param {ProcessedData} processedData - The centrally processed data.
 * @returns An object with labels and data points for Chart.js.
 */
export function getCumulativeSubmissions(processedData: ProcessedData) {
  const { dailyMap } = processedData;

  // Sort the map keys (dates) to ensure chronological order
  const sortedDays = Array.from(dailyMap.keys()).sort();

  const labels: string[] = [];
  const data: number[] = [];
  let cumulativeTotal = 0;

  for (const day of sortedDays) {
    const submissionsOnDay = dailyMap.get(day)?.length || 0;
    cumulativeTotal += submissionsOnDay;

    labels.push(day);
    data.push(cumulativeTotal);
  }

  return {
    labels,
    data,
  };
}
