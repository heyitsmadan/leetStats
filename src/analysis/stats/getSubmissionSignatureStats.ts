import type { ProcessedData, Difficulty, TimeRange } from '../../types';
import { colors } from '../../ui/theme/colors'; // Import the centralized colors

// Map status codes to their labels and a key for the color object
const STATUS_MAP: { [key: number]: { label: string; colorKey: keyof typeof colors.status } } = {
  10: { label: 'Accepted', colorKey: 'accepted' },
  11: { label: 'Wrong Answer', colorKey: 'wrongAnswer' },
  12: { label: 'Memory Limit Exceeded', colorKey: 'memoryLimitExceeded' },
  14: { label: 'Time Limit Exceeded', colorKey: 'timeLimitExceeded' },
  20: { label: 'Compile Error', colorKey: 'compileError' },
};

// Default for any other status code (13, 15, etc.)
const RUNTIME_ERROR_DEFAULT = { label: 'Runtime Error', colorKey: 'runtimeError' as keyof typeof colors.status };


/**
 * Calculates all necessary data for the Submission Signature doughnut chart.
 * @param processedData The main processed data object.
 * @param filters An object containing the current filter settings.
 * @returns Data formatted for the Chart.js component, or null if no data.
 */
export function getSubmissionSignatureStats(
  processedData: ProcessedData,
  filters: { timeRange: TimeRange; difficulty: Difficulty }
) {
  const { submissions } = processedData;
  const { timeRange, difficulty } = filters;

  // --- 1. Filter submissions based on dropdowns ---
  const now = new Date();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  
  const filteredSubmissions = submissions.filter(sub => {
  const submissionTime = sub.date.getTime();
  const nowTime = now.getTime();

  if (timeRange !== 'All Time') {
    let maxAgeInDays = 0;
    if (timeRange === 'Last 30 Days') {
      maxAgeInDays = 30;
    } else if (timeRange === 'Last 90 Days') {
      maxAgeInDays = 90;
    } else if (timeRange === 'Last 365 Days') {
      maxAgeInDays = 365;
    }
    if (nowTime - submissionTime > maxAgeInDays * ONE_DAY_MS) {
      return false;
    }
  }

  if (difficulty !== 'All' && sub.metadata?.difficulty !== difficulty) {
    return false;
  }

  return true;
});
  
  const totalSubmissions = filteredSubmissions.length;
  if (totalSubmissions === 0) {
      return null; // Return null if there's nothing to display
  }

  // --- 2. Aggregate data by submission status ---
  const signatureMap = new Map<string, { count: number; easy: number; medium: number; hard: number; colorKey: keyof typeof colors.status }>();

  for (const sub of filteredSubmissions) {
    const statusInfo = STATUS_MAP[sub.status] || RUNTIME_ERROR_DEFAULT;
    const key = statusInfo.label;

    if (!signatureMap.has(key)) {
      signatureMap.set(key, { count: 0, easy: 0, medium: 0, hard: 0, colorKey: statusInfo.colorKey });
    }
    const bucket = signatureMap.get(key)!;
    bucket.count++;

    // Increment difficulty counts
    if (sub.metadata?.difficulty === 'Easy') bucket.easy++;
    else if (sub.metadata?.difficulty === 'Medium') bucket.medium++;
    else if (sub.metadata?.difficulty === 'Hard') bucket.hard++;
  }

  // --- 3. Format data for Chart.js ---
  const labels: string[] = [];
  const data: number[] = [];
  const backgroundColors: string[] = [];
  const tooltipsData: any[] = [];
  
  const sortedSignature = Array.from(signatureMap.entries()).sort((a, b) => b[1].count - a[1].count);

  for (const [label, values] of sortedSignature) {
    labels.push(label);
    data.push(values.count);
    // Use the colorKey to look up the color from the central theme file
    backgroundColors.push(colors.status[values.colorKey]);
    tooltipsData.push({
      count: values.count,
      percent: ((values.count / totalSubmissions) * 100).toFixed(1) + '%',
      breakdown: { E: values.easy, M: values.medium, H: values.hard }
    });
  }
  
  return {
    labels,
    datasets: [{
      data: data,
      backgroundColor: backgroundColors,
      borderColor: colors.background.secondarySection, // Using color from theme
      borderWidth: 2,
    }],
    tooltipsData,
  };
}
