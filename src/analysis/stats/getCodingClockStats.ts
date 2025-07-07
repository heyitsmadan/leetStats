import type { ProcessedData, Difficulty, TimeRange, ClockView, ProcessedSubmission } from '../../types';

// Constants for time calculations
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_ACCEPTED = 10;
const GLOW_THRESHOLD = 5; // Min submissions for a bar to be considered for the "best" glow

// **UPDATED:** New hour labels with AM/PM format
const HOUR_LABELS = [
  '12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM', '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM',
  '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM'
];

// **UPDATED:** Day labels starting with Monday
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Calculates all necessary data for the Coding Clock chart based on filters.
 */
export function getCodingClockStats(
  processedData: ProcessedData,
  filters: { timeRange: TimeRange; difficulty: Difficulty; clockView: ClockView }
) {
  const { submissions } = processedData;
  const { timeRange, difficulty, clockView } = filters;

  const now = new Date();
  const filteredSubmissions = submissions.filter(sub => {
    if (timeRange === 'Last 30 Days') {
      if (now.getTime() - sub.date.getTime() > 30 * ONE_DAY_MS) return false;
    } else if (timeRange === 'Last 90 Days') {
      if (now.getTime() - sub.date.getTime() > 90 * ONE_DAY_MS) return false;
    } else if (timeRange === 'Last 365 Days') {
      if (now.getTime() - sub.date.getTime() > 365 * ONE_DAY_MS) return false;
    }

    if (difficulty !== 'All' && sub.metadata?.difficulty !== difficulty) {
      return false;
    }

    return true;
  });

  const isHourView = clockView === 'HourOfDay';
  const numBuckets = isHourView ? 24 : 7;
  const buckets = Array.from({ length: numBuckets }, () => ({ accepted: 0, failed: 0 }));

  for (const sub of filteredSubmissions) {
    // **UPDATED:** For day view, map Sunday (0) to index 6, Monday (1) to index 0, etc.
    const index = isHourView ? sub.date.getHours() : (sub.date.getDay() + 6) % 7;
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
        // **UPDATED:** New accepted color
        backgroundColor: '#5db666',
      },
      {
        label: 'Failed',
        data: buckets.map(b => b.failed),
        // **UPDATED:** New failed color
        backgroundColor: '#353535',
      }
    ],
    tooltipsData: buckets.map((b, index) => ({
      label: isHourView ? HOUR_LABELS[index] : DAY_LABELS[index],
      total: b.accepted + b.failed,
      accepted: b.accepted,
      rate: b.accepted + b.failed > 0 ? ((b.accepted / (b.accepted + b.failed)) * 100).toFixed(1) + '%' : 'N/A'
    })),
    bestIndex: bestIndex,
  };
}
