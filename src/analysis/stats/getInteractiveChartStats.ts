import { colors } from '../../ui/theme/colors';
import type {
  ProcessedData,
  InteractiveChartData,
  BrushChartData,
  InteractiveChartFilters,
  TooltipData
} from '../../types';

// === HELPER FUNCTIONS (some are new/modified) ===

// FIX: New helper function to create timezone-safe date keys.
// This avoids UTC conversion issues and ensures submissions are grouped into the correct local day.
function getDateKey(date: Date, level: 'Daily' | 'Monthly' | 'Yearly'): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // JS months are 0-indexed
    const day = date.getDate();

    if (level === 'Daily') {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    if (level === 'Monthly') {
        return `${year}-${String(month).padStart(2, '0')}`;
    }
    // Yearly
    return String(year);
}


// Generates a complete sequence of dates/weeks/months between a start and end
function generateAllIntervals(
  startDate: Date,
  endDate: Date,
  aggregationLevel: 'Daily' | 'Monthly' | 'Yearly'
): string[] {
  const intervals: string[] = [];
  // Start at midnight to avoid DST issues
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

  if (aggregationLevel === 'Daily') {
    while (current <= endDate) {
      // FIX: Use the new timezone-safe helper to generate keys
      intervals.push(getDateKey(current, 'Daily'));
      current.setDate(current.getDate() + 1);
    }
  } else if (aggregationLevel === 'Monthly') {
    current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (current <= endMonth) {
      // FIX: Use the new timezone-safe helper to generate keys
      intervals.push(getDateKey(current, 'Monthly'));
      current.setMonth(current.getMonth() + 1);
    }
  } else { // Yearly
    current = new Date(startDate.getFullYear(), 0, 1);
    const endYear = new Date(endDate.getFullYear(), 0, 1);
    while (current <= endYear) {
      // FIX: Use the new timezone-safe helper to generate keys
      intervals.push(getDateKey(current, 'Yearly'));
      current.setFullYear(current.getFullYear() + 1);
    }
  }
  return intervals;
}


// Updated createChartData function with performance and logic fixes
function createChartData(
  timeGroups: { [key: string]: any[] },
  filters: InteractiveChartFilters,
  aggregationLevel: 'Daily' | 'Monthly' | 'Yearly',
  effectiveDateRange?: { start: Date; end: Date } | null
): InteractiveChartData {
  
  let startDate: Date, endDate: Date;
  
  if (effectiveDateRange) {
    // FIX: Create copies to prevent mutating the original brushWindow dates
    startDate = new Date(effectiveDateRange.start);
    endDate = new Date(effectiveDateRange.end);
  } else {
    // Fallback to existing logic
    const allDates = Object.keys(timeGroups);
    if (allDates.length === 0) {
      return {
        labels: [],
        datasets: [],
        aggregationLevel,
        timeRange: { start: new Date(), end: new Date() }
      };
    }
    const sortedDates = allDates.sort();
    startDate = new Date(sortedDates[0]);
    endDate = new Date(sortedDates[sortedDates.length - 1]);
  }

  // FIX: This is the logic to remove partial bars from the main chart
  // Adjust dates to only include full intervals, discarding partial periods.
  if (aggregationLevel === 'Daily') {
    if (startDate.getHours() !== 0 || startDate.getMinutes() !== 0 || startDate.getSeconds() !== 0 || startDate.getMilliseconds() !== 0) {
      startDate.setDate(startDate.getDate() + 1);
      startDate.setHours(0, 0, 0, 0);
    }
    endDate.setDate(endDate.getDate() - 1);
    endDate.setHours(23, 59, 59, 999);
  } else if (aggregationLevel === 'Monthly') {
    if (startDate.getDate() !== 1) {
      startDate.setMonth(startDate.getMonth() + 1, 1);
    }
    startDate.setHours(0, 0, 0, 0);
    endDate.setDate(0);
    endDate.setHours(23, 59, 59, 999);
  } else if (aggregationLevel === 'Yearly') {
    if (startDate.getMonth() !== 0 || startDate.getDate() !== 1) {
      startDate.setFullYear(startDate.getFullYear() + 1, 0, 1);
    }
    startDate.setHours(0, 0, 0, 0);
    endDate.setFullYear(endDate.getFullYear(), 0, 0);
    endDate.setHours(23, 59, 59, 999);
  }

  if (startDate > endDate) {
    return {
      labels: [],
      datasets: [],
      aggregationLevel,
      timeRange: { start: effectiveDateRange?.start || new Date(), end: effectiveDateRange?.end || new Date() }
    };
  }

  // Generate complete intervals for the determined date range
  const allIntervals = generateAllIntervals(startDate, endDate, aggregationLevel);
  
  const datasets: any[] = [];
  
  if (filters.secondaryView === 'Difficulty') {
    const difficulties = ['Easy', 'Medium', 'Hard'];
    const dataMaps: { [difficulty: string]: { [key: string]: number } } = {};
    difficulties.forEach(d => dataMaps[d] = {});

    allIntervals.forEach(interval => {
        difficulties.forEach(difficulty => {
            dataMaps[difficulty][interval] = 0;
        });
    });

    Object.entries(timeGroups).forEach(([date, submissions]) => {
        if (!allIntervals.includes(date)) return;
        if (filters.primaryView === 'Submissions') {
            const counts: { [key: string]: number } = { 'Easy': 0, 'Medium': 0, 'Hard': 0 };
            submissions.forEach(sub => {
                const difficulty = sub.metadata?.difficulty;
                if (difficulty && counts.hasOwnProperty(difficulty)) {
                    counts[difficulty]++;
                }
            });
            difficulties.forEach(difficulty => {
                if (dataMaps[difficulty]) dataMaps[difficulty][date] = (dataMaps[difficulty][date] || 0) + counts[difficulty];
            });
        } else { // Problems Solved
            const solvedProblems: { [difficulty: string]: Set<string> } = { 'Easy': new Set(), 'Medium': new Set(), 'Hard': new Set() };
            submissions.forEach(sub => {
                if (sub.status === 10) {
                    const difficulty = sub.metadata?.difficulty;
                    if (difficulty && solvedProblems.hasOwnProperty(difficulty)) {
                        solvedProblems[difficulty].add(sub.titleSlug);
                    }
                }
            });
            difficulties.forEach(difficulty => {
                if (dataMaps[difficulty]) dataMaps[difficulty][date] = (dataMaps[difficulty][date] || 0) + solvedProblems[difficulty].size;
            });
        }
    });

    difficulties.forEach(difficulty => {
        const data = allIntervals.map(interval => dataMaps[difficulty][interval] || 0);
        datasets.push({
            label: difficulty,
            data,
            backgroundColor: colors.problems[difficulty.toLowerCase() as keyof typeof colors.problems],
            borderColor: colors.problems[difficulty.toLowerCase() as keyof typeof colors.problems],
            stack: 'main',
            maxBarThickness: 30,
        });
    });

  } else if (filters.secondaryView === 'Status') {
    const acceptedDataMap: { [key: string]: number } = {};
    const failedDataMap: { [key: string]: number } = {};

    allIntervals.forEach(interval => {
        acceptedDataMap[interval] = 0;
        if (filters.primaryView === 'Submissions') {
            failedDataMap[interval] = 0;
        }
    });

    Object.entries(timeGroups).forEach(([date, submissions]) => {
        if (!allIntervals.includes(date)) return;
        if (filters.primaryView === 'Submissions') {
            let acceptedCount = 0;
            let failedCount = 0;
            submissions.forEach(sub => {
                if (sub.status === 10) acceptedCount++;
                else failedCount++;
            });
            acceptedDataMap[date] = (acceptedDataMap[date] || 0) + acceptedCount;
            failedDataMap[date] = (failedDataMap[date] || 0) + failedCount;
        } else { // Problems Solved
            const solvedProblems = new Set<string>();
            submissions.forEach(sub => {
                if (sub.status === 10) {
                    solvedProblems.add(sub.titleSlug);
                }
            });
            acceptedDataMap[date] = (acceptedDataMap[date] || 0) + solvedProblems.size;
        }
    });

    const acceptedData = allIntervals.map(interval => acceptedDataMap[interval] || 0);
    datasets.push({
        label: 'Accepted',
        data: acceptedData,
        backgroundColor: colors.status.accepted,
        borderColor: colors.status.accepted,
        stack: 'main',
        maxBarThickness: 30,
    });

    if (filters.primaryView === 'Submissions') {
        const failedData = allIntervals.map(interval => failedDataMap[interval] || 0);
        datasets.push({
            label: 'Failed',
            data: failedData,
            backgroundColor: colors.background.empty,
            borderColor: colors.background.empty,
            stack: 'main',
            maxBarThickness: 30,
        });
    }
  } else if (filters.secondaryView === 'Language') {
    const allLanguages = new Set<string>();
    Object.values(timeGroups).flat().forEach(sub => allLanguages.add(sub.lang));
    const languages = Array.from(allLanguages);
    const dataMaps: { [lang: string]: { [key: string]: number } } = {};
    languages.forEach(lang => dataMaps[lang] = {});

    allIntervals.forEach(interval => {
        languages.forEach(lang => {
            dataMaps[lang][interval] = 0;
        });
    });

    Object.entries(timeGroups).forEach(([date, submissions]) => {
        if (!allIntervals.includes(date)) return;
        const langData: { [lang: string]: number | Set<string> } = {};
        languages.forEach(lang => {
            langData[lang] = filters.primaryView === 'Submissions' ? 0 : new Set<string>();
        });
        
        submissions.forEach(sub => {
            if (langData.hasOwnProperty(sub.lang)) {
                if (filters.primaryView === 'Submissions') {
                    (langData[sub.lang] as number)++;
                } else { // Problems Solved
                    if (sub.status === 10) {
                        (langData[sub.lang] as Set<string>).add(sub.titleSlug);
                    }
                }
            }
        });

        languages.forEach(lang => {
            const value = filters.primaryView === 'Submissions' ? langData[lang] as number : (langData[lang] as Set<string>).size;
            dataMaps[lang][date] = (dataMaps[lang][date] || 0) + value;
        });
    });
    
    const LANGUAGE_COLORS = ['#C5A3DC', '#A7C7E7', '#E09CA4', '#FFB997', '#B4D9A6', '#9ED9CC', '#F2A6A0', '#F6D6AD', '#AFCBFF', '#DDBDD5', '#FCD5CE', '#C9E4DE', '#EFD3D7', '#B5EAD7', '#FFDAC1', '#C7CEEA', '#FFB5E8', '#FFABAB', '#D5AAFF', '#A0E7E5', '#B2F7EF', '#E3C6FF', '#F7C5CC', '#F1F7B5', '#C2F784'];
    languages.forEach((lang, index) => {
        const data = allIntervals.map(interval => dataMaps[lang][interval] || 0);
        datasets.push({
            label: lang,
            data,
            backgroundColor: LANGUAGE_COLORS[index % LANGUAGE_COLORS.length],
            borderColor: LANGUAGE_COLORS[index % LANGUAGE_COLORS.length],
            stack: 'main',
            maxBarThickness: 30,
        });
    });
  }
  
  return {
    labels: allIntervals.map(interval => formatDateLabel(interval, aggregationLevel)),
    datasets,
    aggregationLevel,
    timeRange: { start: startDate, end: endDate }
  };
}


// Enhanced date formatting
function formatDateLabel(dateStr: string, aggregationLevel: 'Daily' | 'Monthly' | 'Yearly'): string {
  if (aggregationLevel === 'Yearly') {
    return dateStr; // Just the year
  } else if (aggregationLevel === 'Monthly') {
    const [year, month] = dateStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  } else {
    // FIX: Safely parse 'YYYY-MM-DD' to avoid timezone issues and output 'DD-MM-YYYY'
    const [year, month, day] = dateStr.split('-').map(Number);
    return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
  }
}

function getTimeRangeCutoff(timeRange: string): Date {
  const now = new Date();
  switch (timeRange) {
    case 'Last 30 Days': return new Date(now.setDate(now.getDate() - 30));
    case 'Last 90 Days': return new Date(now.setDate(now.getDate() - 90));
    case 'Last 365 Days': return new Date(now.setDate(now.getDate() - 365));
    default: return new Date(0);
  }
}

function getDateRangeFromLabel(label: string, level: 'Daily' | 'Monthly' | 'Yearly'): { start: Date; end: Date } {
  if (level === 'Daily') {
    const [day, month, year] = label.split('-').map(Number);
    const start = new Date(year, month - 1, day);
    const end = new Date(year, month - 1, day, 23, 59, 59, 999);
    return { start, end };
  } else if (level === 'Monthly') {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [monthStr, yearStr] = label.split(' ');
    const month = monthNames.indexOf(monthStr);
    const year = parseInt(yearStr);
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { start, end };
  } else { // Yearly
    const year = parseInt(label);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    return { start, end };
  }
}

// === MAIN EXPORTED FUNCTIONS ===

export function getInteractiveChartStats(
  processedData: ProcessedData,
  filters: InteractiveChartFilters
): InteractiveChartData | null {
  const { submissions } = processedData;
  if (!submissions.length) return null;

  let filteredSubmissions = submissions;
  let effectiveDateRange: { start: Date; end: Date } | null = null;
  
  if (filters.brushWindow) {
    const [start, end] = filters.brushWindow;
    filteredSubmissions = submissions.filter(sub => sub.date >= start && sub.date <= end);
    effectiveDateRange = { start, end };
  } else if (filters.timeRange !== 'All Time') {
    const cutoffDate = getTimeRangeCutoff(filters.timeRange);
    filteredSubmissions = submissions.filter(sub => sub.date >= cutoffDate);
    effectiveDateRange = { 
      start: cutoffDate, 
      end: new Date(Math.max(...submissions.map(s => s.date.getTime())))
    };
  }

  if (filters.difficulty !== 'All') {
    filteredSubmissions = filteredSubmissions.filter(sub => sub.metadata?.difficulty === filters.difficulty);
  }

  const aggregationLevel = effectiveDateRange 
    ? getAggregationLevelFromDateRange(effectiveDateRange.start, effectiveDateRange.end)
    : getAggregationLevel(filteredSubmissions);
  
  const timeGroups = groupByTimePeriod(filteredSubmissions, aggregationLevel);
  
  const chartData = createChartData(timeGroups, filters, aggregationLevel, effectiveDateRange);
  
  return chartData;
}

export function getBrushChartData(processedData: ProcessedData): BrushChartData | null {
  const { submissions } = processedData;
  if (!submissions.length) return null;
  
  const dateRange = getExtendedDateRange(submissions, true);
  const aggregationLevel = getAggregationLevel(submissions, true);
  const allIntervals = generateAllIntervals(dateRange.start, dateRange.end, aggregationLevel);
  
  const groupedData: { [key: string]: any[] } = {};
  allIntervals.forEach(interval => { groupedData[interval] = []; });
  
  submissions.forEach(sub => {
    // FIX: Use the new timezone-safe helper for grouping
    const key = getDateKey(sub.date, aggregationLevel);
    if (groupedData.hasOwnProperty(key)) {
      groupedData[key].push(sub);
    }
  });
  
  const data = allIntervals.map(interval => groupedData[interval]?.length || 0);
  
  return {
    labels: allIntervals.map(interval => formatDateLabel(interval, aggregationLevel)),
    data,
    fullTimeRange: dateRange
  };
}


export function getTooltipData(
  processedData: ProcessedData,
  date: string,
  filters: InteractiveChartFilters,
  aggregationLevel: 'Daily' | 'Monthly' | 'Yearly'
): TooltipData | null {
  const { submissions } = processedData;
  const dateRange = getDateRangeFromLabel(date, aggregationLevel);
  const periodSubmissions = submissions.filter(sub => sub.date >= dateRange.start && sub.date <= dateRange.end);

  if (!periodSubmissions.length) return null;

  const totalSubmissionsInPeriod = periodSubmissions.length;
  const acceptedSubmissions = periodSubmissions.filter(sub => sub.status === 10);
  const uniqueProblemsSolved = new Set(acceptedSubmissions.map(sub => sub.titleSlug));
  const breakdown: { [key: string]: number } = {};
  let acceptanceRate: number | undefined = undefined;

  if (filters.secondaryView === 'Difficulty') {
    ['Easy', 'Medium', 'Hard'].forEach(difficulty => {
      let count = 0;
      if (filters.primaryView === 'Submissions') {
        count = periodSubmissions.filter(sub => sub.metadata?.difficulty === difficulty).length;
      } else {
        const solvedInDifficulty = new Set<string>();
        acceptedSubmissions.forEach(sub => {
          if (sub.metadata?.difficulty === difficulty) {
            solvedInDifficulty.add(sub.titleSlug);
          }
        });
        count = solvedInDifficulty.size;
      }
      if (count > 0) breakdown[difficulty] = count;
    });
  } else if (filters.secondaryView === 'Language') {
    const allLanguagesInPeriod = new Set(periodSubmissions.map(sub => sub.lang));
    allLanguagesInPeriod.forEach(lang => {
      let count = 0;
      if (filters.primaryView === 'Submissions') {
        count = periodSubmissions.filter(sub => sub.lang === lang).length;
      } else {
        const solvedInLang = new Set<string>();
        acceptedSubmissions.forEach(sub => {
          if (sub.lang === lang) {
            solvedInLang.add(sub.titleSlug);
          }
        });
        count = solvedInLang.size;
      }
      if (count > 0) breakdown[lang] = count;
    });
  } else if (filters.secondaryView === 'Status') {
    if (filters.primaryView === 'Submissions') {
      const acceptedCount = acceptedSubmissions.length;
      breakdown['Accepted'] = acceptedCount;
      if (totalSubmissionsInPeriod > 0) {
        acceptanceRate = (acceptedCount / totalSubmissionsInPeriod) * 100;
      }
    }
  }

  return { date, totalSubmissions: totalSubmissionsInPeriod, problemsSolved: uniqueProblemsSolved.size, breakdown, acceptanceRate };
}

function getAggregationLevel(submissions: any[], isNavigator: boolean = false): 'Daily' | 'Monthly' | 'Yearly' {
  if (!submissions.length) return 'Daily';
  
  const { start, end } = getExtendedDateRange(submissions, isNavigator);
  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysDiff <= 90) return 'Daily';
  if (daysDiff <= 1095) return 'Monthly';
  return 'Yearly';
}

function groupByTimePeriod(submissions: any[], level: 'Daily' | 'Monthly' | 'Yearly') {
  const groups: { [key: string]: any[] } = {};
  submissions.forEach(sub => {
    // FIX: Use the new timezone-safe helper for grouping
    const key = getDateKey(sub.date, level);
    if (!groups[key]) groups[key] = [];
    groups[key].push(sub);
  });
  return groups;
}

// FIX: Correctly calculate the end date for the navigator to include the full current day.
function getExtendedDateRange(submissions: any[], isNavigator: boolean = false): { start: Date; end: Date } {
  if (!submissions.length) {
    const today = new Date();
    return { start: today, end: today };
  }
  
  const start = new Date(Math.min(...submissions.map(s => s.date.getTime())));
  let end: Date;

  if (isNavigator) {
    end = new Date(); // Get current date and time
    end.setHours(23, 59, 59, 999); // Set to the very end of the current day
  } else {
    end = new Date(Math.max(...submissions.map(s => s.date.getTime())));
  }
  
  return { start, end };
}

function getAggregationLevelFromDateRange(startDate: Date, endDate: Date): 'Daily' | 'Monthly' | 'Yearly' {
  const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysDiff <= 90) return 'Daily';
  if (daysDiff <= 1095) return 'Monthly';  
  return 'Yearly';
}