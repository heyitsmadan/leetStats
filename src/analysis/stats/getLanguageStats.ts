import type { ProcessedData, Difficulty, TimeRange } from '../../types';

const STATUS_ACCEPTED = 10;
const GLOW_THRESHOLD = 10; // Min submissions for a language to be considered for the "best" glow

// Helper function to format dates nicely
const formatDate = (date: Date) => date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

/**
 * Calculates all necessary data for the Language Stats horizontal bar chart.
 * @param processedData The main processed data object.
 * @param filters An object containing the current filter settings.
 * @returns Data formatted for the Chart.js component, or null if no data.
 */
export function getLanguageStats(
  processedData: ProcessedData,
  filters: { timeRange: TimeRange; difficulty: Difficulty }
) {
  const { submissions } = processedData;
  const { timeRange, difficulty } = filters;

  // --- 1. Filter submissions based on dropdowns ---
  const now = new Date();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const filteredSubmissions = submissions.filter(sub => {
    const ageMs = now.getTime() - sub.date.getTime();

    if (timeRange === 'Last 30 Days' && ageMs > 30 * ONE_DAY_MS) return false;
    if (timeRange === 'Last 90 Days' && ageMs > 90 * ONE_DAY_MS) return false;
    if (timeRange === 'Last 365 Days' && ageMs > 365 * ONE_DAY_MS) return false;

    if (difficulty !== 'All' && sub.metadata?.difficulty !== difficulty) {
        return false;
    }

    return true;
});


  if (filteredSubmissions.length === 0) {
      return null;
  }

  // --- 2. Aggregate data by language ---
  const langMap = new Map<string, {
    accepted: number;
    failed: number;
    firstUsed: Date;
    lastUsed: Date;
    solvedEasy: number;
    solvedMedium: number;
    solvedHard: number;
  }>();

  for (const sub of filteredSubmissions) {
    if (!langMap.has(sub.lang)) {
      langMap.set(sub.lang, {
        accepted: 0,
        failed: 0,
        firstUsed: sub.date,
        lastUsed: sub.date,
        solvedEasy: 0,
        solvedMedium: 0,
        solvedHard: 0,
      });
    }
    const bucket = langMap.get(sub.lang)!;
    
    // Update counts
    if (sub.status === STATUS_ACCEPTED) {
        bucket.accepted++;
        // Update solved difficulty counts ONLY for accepted submissions
        if (sub.metadata?.difficulty === 'Easy') bucket.solvedEasy++;
        else if (sub.metadata?.difficulty === 'Medium') bucket.solvedMedium++;
        else if (sub.metadata?.difficulty === 'Hard') bucket.solvedHard++;
    } else {
        bucket.failed++;
    }
    
    // Update first/last used dates
    if (sub.date < bucket.firstUsed) bucket.firstUsed = sub.date;
    if (sub.date > bucket.lastUsed) bucket.lastUsed = sub.date;
  }
  
  // --- 3. Find the "best" language for the glow effect ---
  let bestLang = '';
  let maxRate = -1;

  langMap.forEach((stats, lang) => {
    const total = stats.accepted + stats.failed;
    if (total >= GLOW_THRESHOLD) {
      const rate = stats.accepted / total;
      if (rate > maxRate) {
        maxRate = rate;
        bestLang = lang;
      }
    }
  });

  // --- 4. Format data for Chart.js ---
  const sortedLangs = Array.from(langMap.entries()).sort((a, b) => (b[1].accepted + b[1].failed) - (a[1].accepted + a[1].failed));

  return {
    labels: sortedLangs.map(entry => entry[0]),
    datasets: [
      {
        label: 'Accepted',
        data: sortedLangs.map(entry => entry[1].accepted),
        backgroundColor: 'rgba(75, 192, 192, 0.7)',
      },
      {
        label: 'Failed',
        data: sortedLangs.map(entry => entry[1].failed),
        backgroundColor: 'rgba(156, 163, 175, 0.5)',
      }
    ],
    tooltipsData: sortedLangs.map(entry => ({
        total: entry[1].accepted + entry[1].failed,
        rate: entry[1].accepted + entry[1].failed > 0 ? ((entry[1].accepted / (entry[1].accepted + entry[1].failed)) * 100).toFixed(1) + '%' : 'N/A',
        solvedBreakdown: { E: entry[1].solvedEasy, M: entry[1].solvedMedium, H: entry[1].solvedHard },
        firstUsed: formatDate(entry[1].firstUsed),
        lastUsed: formatDate(entry[1].lastUsed)
    })),
    bestLang,
  };
}
