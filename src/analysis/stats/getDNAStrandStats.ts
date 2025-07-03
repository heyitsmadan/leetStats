import type { ProcessedData, Difficulty, TimeRange } from '../../types';
import type { DNAStrandData } from '../../ui/components/DNAStrandChart';

export function getDNAStrandStats(
  processedData: ProcessedData,
  filters: {
    timeRange: TimeRange;
    difficulty: Difficulty;
  },
  options: {
    viewMode: 'problems' | 'submissions';
    timeRange: 'daily' | 'weekly' | 'monthly';
  }
): DNAStrandData | null {
  
  if (!processedData.submissions.length) return null;
  
  // Filter submissions by time range and difficulty
  const filteredSubmissions = processedData.submissions.filter(sub => {
    if (!passesTimeRangeFilter(sub.date, filters.timeRange)) return false;
    if (filters.difficulty !== 'All' && sub.metadata?.difficulty !== filters.difficulty) return false;
    return true;
  });
  
  if (!filteredSubmissions.length) return null;
  
  // Group submissions by time blocks
  const timeBlocks = createTimeBlocks(filteredSubmissions, options.timeRange);
  
  // Calculate overview data
  const allValues = timeBlocks.map(block => {
    if (options.viewMode === 'problems') {
      return block.problems.easy + block.problems.medium + block.problems.hard;
    } else {
      return block.submissions.accepted + block.submissions.failed;
    }
  });
  
  const overview = {
    startDate: timeBlocks[0]?.date || new Date(),
    endDate: timeBlocks[timeBlocks.length - 1]?.date || new Date(),
    maxValue: Math.max(...allValues, 1)
  };
  
  return { timeBlocks, overview };
}

function createTimeBlocks(submissions: any[], timeRange: string) {
  const blocks = new Map();
  
  submissions.forEach(sub => {
    const blockKey = getTimeBlockKey(sub.date, timeRange);
    
    if (!blocks.has(blockKey)) {
      blocks.set(blockKey, {
        date: getBlockDate(sub.date, timeRange),
        dateLabel: formatBlockLabel(sub.date, timeRange),
        problems: { easy: 0, medium: 0, hard: 0 },
        submissions: { accepted: 0, failed: 0 },
        languages: {},
        solvedProblems: new Set()
      });
    }
    
    const block = blocks.get(blockKey);
    
    // Count submissions
    if (sub.status === 10) { // Accepted
      block.submissions.accepted++;
    } else {
      block.submissions.failed++;
    }
    
    // Count languages
    block.languages[sub.lang] = (block.languages[sub.lang] || 0) + 1;
    
    // Count problems solved (only first AC)
    if (sub.status === 10 && !block.solvedProblems.has(sub.titleSlug)) {
      block.solvedProblems.add(sub.titleSlug);
      if (sub.metadata?.difficulty === 'Easy') block.problems.easy++;
      else if (sub.metadata?.difficulty === 'Medium') block.problems.medium++;
      else if (sub.metadata?.difficulty === 'Hard') block.problems.hard++;
    }
  });
  
  // Convert to array and sort
  return Array.from(blocks.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function getTimeBlockKey(date: Date, timeRange: string): string {
  switch (timeRange) {
    case 'daily':
      return date.toISOString().split('T')[0];
    case 'weekly':
      return `${date.getFullYear()}-W${getWeekNumber(date)}`;
    case 'monthly':
      return `${date.getFullYear()}-${date.getMonth()}`;
    default:
      return date.toISOString().split('T')[0];
  }
}

function getBlockDate(date: Date, timeRange: string): Date {
  switch (timeRange) {
    case 'daily':
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    case 'weekly':
      return getWeekStartDate(date);
    case 'monthly':
      return new Date(date.getFullYear(), date.getMonth(), 1);
    default:
      return date;
  }
}

function formatBlockLabel(date: Date, timeRange: string): string {
  switch (timeRange) {
    case 'daily':
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    case 'weekly':
      return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    case 'monthly':
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    default:
      return date.toLocaleDateString();
  }
}

function passesTimeRangeFilter(date: Date, timeRange: TimeRange): boolean {
  const now = new Date();
  const msInDay = 24 * 60 * 60 * 1000;
  
  switch (timeRange) {
    case 'All Time':
        return true;
    case 'Last 30 Days':
        return (now.getTime() - date.getTime()) <= (30 * msInDay);
    case 'Last 90 Days':
        return (now.getTime() - date.getTime()) <= (90 * msInDay);
    case 'Last 365 Days':
        return (now.getTime() - date.getTime()) <= (365 * msInDay);
    default:
        return true;
}

}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}
