import type { ProcessedData, Difficulty, TimeRange, ClockView, ProcessedSubmission } from '../../types';

// Constants for time calculations
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_ACCEPTED = 10;
const GLOW_THRESHOLD = 5; // Min submissions for a bar to be considered for the "best" glow

// Labels for the chart
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i}:00`);
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Calculates all necessary data for the Coding Clock chart based on filters.
 * @param processedData The main processed data object.
 * @param filters An object containing the current filter settings.
 * @returns Data formatted for the Chart.js component.
 */
export function getCodingClockStats(
  processedData: ProcessedData,
  filters: { timeRange: TimeRange; difficulty: Difficulty; view: ClockView }
) {
  const { submissions } = processedData;
  const { timeRange, difficulty, view } = filters;

  const now = new Date();
  const filteredSubmissions = submissions.filter(sub => {
    if (timeRange === 'Last 30 Days') {
      if (now.getTime() - sub.date.getTime() > 30 * ONE_DAY_MS) return false;
    } else if (timeRange === 'Last Year') {
      if (now.getTime() - sub.date.getTime() > 365 * ONE_DAY_MS) return false;
    }
    
    if (difficulty !== 'All' && sub.metadata?.difficulty !== difficulty) {
      return false;
    }
    return true;
  });

  const isHourView = view === 'HourOfDay';
  const numBuckets = isHourView ? 24 : 7;
  const buckets = Array.from({ length: numBuckets }, () => ({ accepted: 0, failed: 0 }));

  for (const sub of filteredSubmissions) {
    const index = isHourView ? sub.date.getHours() : sub.date.getDay();
    if (sub.status === STATUS_ACCEPTED) {
      buckets[index].accepted++;
    } else {
      buckets[index].failed++;
    }
  }

  let bestIndex = -1;
  let maxRate = -1;

  buckets.forEach((bucket, index) => {
    const total = bucket.accepted + bucket.failed;
    if (total >= GLOW_THRESHOLD) {
      const rate = bucket.accepted / total;
      if (rate > maxRate) {
        maxRate = rate;
        bestIndex = index;
      }
    }
  });

  return {
    labels: isHourView ? HOUR_LABELS : DAY_LABELS,
    datasets: [
      {
        label: 'Accepted',
        data: buckets.map(b => b.accepted),
        backgroundColor: 'rgba(75, 192, 192, 0.7)',
      },
      {
        label: 'Failed',
        data: buckets.map(b => b.failed),
        // **FIX:** Changed color to a neutral gray
        backgroundColor: 'rgba(156, 163, 175, 0.5)',
      }
    ],
    tooltipsData: buckets.map(b => ({
        total: b.accepted + b.failed,
        accepted: b.accepted,
        rate: b.accepted + b.failed > 0 ? ((b.accepted / (b.accepted + b.failed)) * 100).toFixed(1) + '%' : 'N/A'
    })),
    bestIndex: bestIndex,
  };
}
