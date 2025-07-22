import type { ProcessedData, Difficulty, TimeRange } from '../../types';
import { colors } from '../../ui/theme/colors';

const STATUS_ACCEPTED = 10;
const GLOW_THRESHOLD = 10; // Min submissions for a language to be considered for the "best" glow

const formatDate = (date: Date) => date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export function getLanguageStats(
  processedData: ProcessedData,
  filters: { timeRange: TimeRange; difficulty: Difficulty }
) {
  const { submissions } = processedData;
  const { timeRange, difficulty } = filters;

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

  // The map now tracks sets of unique solved problem names.
  const langMap = new Map<string, {
    accepted: number;
    failed: number;
    firstUsed: Date;
    lastUsed: Date;
    solvedEasy: Set<string>;
    solvedMedium: Set<string>;
    solvedHard: Set<string>;
  }>();

  for (const sub of filteredSubmissions) {
    if (!langMap.has(sub.lang)) {
      langMap.set(sub.lang, {
        accepted: 0,
        failed: 0,
        firstUsed: sub.date,
        lastUsed: sub.date,
        solvedEasy: new Set(),
        solvedMedium: new Set(),
        solvedHard: new Set(),
      });
    }
    const bucket = langMap.get(sub.lang)!;
    
    if (sub.status === STATUS_ACCEPTED) {
        bucket.accepted++;
        // Assumes a unique problem identifier exists at sub.metadata.name
        // If your identifier is different (e.g., sub.problemId), change it here.
        if (sub.metadata?.slug) {
            if (sub.metadata?.difficulty === 'Easy') bucket.solvedEasy.add(sub.metadata.slug);
            else if (sub.metadata?.difficulty === 'Medium') bucket.solvedMedium.add(sub.metadata.slug);
            else if (sub.metadata?.difficulty === 'Hard') bucket.solvedHard.add(sub.metadata.slug);
        }
    } else {
        bucket.failed++;
    }
    
    if (sub.date < bucket.firstUsed) bucket.firstUsed = sub.date;
    if (sub.date > bucket.lastUsed) bucket.lastUsed = sub.date;
  }
  
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

  const sortedLangs = Array.from(langMap.entries()).sort((a, b) => (b[1].accepted + b[1].failed) - (a[1].accepted + a[1].failed));

  return {
    labels: sortedLangs.map(entry => entry[0]),
    datasets: [
      {
        label: 'Accepted',
        data: sortedLangs.map(entry => entry[1].accepted),
        backgroundColor: colors.status.accepted,
        maxBarThickness: 30,
      },
      {
        label: 'Failed',
        data: sortedLangs.map(entry => entry[1].failed),
        backgroundColor: colors.background.empty,
        maxBarThickness: 30,
      }
    ],
    tooltipsData: sortedLangs.map(entry => ({
        label: entry[0],
        totalSubmissions: entry[1].accepted + entry[1].failed,
        acceptanceRate: entry[1].accepted + entry[1].failed > 0 ? ((entry[1].accepted / (entry[1].accepted + entry[1].failed)) * 100).toFixed(1) + '%' : 'N/A',
        // Use the size of the sets for the unique solved counts
        solvedBreakdown: { 
            E: entry[1].solvedEasy.size, 
            M: entry[1].solvedMedium.size, 
            H: entry[1].solvedHard.size 
        },
        firstUsed: formatDate(entry[1].firstUsed),
        lastUsed: formatDate(entry[1].lastUsed)
    })),
    bestLang,
  };
}