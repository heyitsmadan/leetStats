import { colors } from '../../ui/theme/colors';

// Updated createChartData function with performance and logic fixes
function createChartData(
  timeGroups: { [key: string]: any[] },
  filters: InteractiveChartFilters,
  aggregationLevel: 'Daily' | 'Monthly' | 'Yearly',
  effectiveDateRange?: { start: Date; end: Date } | null
): InteractiveChartData {
  
  // Use effective date range if available, otherwise fall back to timeGroups dates
  let startDate: Date, endDate: Date;
  
  if (effectiveDateRange) {
    startDate = effectiveDateRange.start;
    endDate = effectiveDateRange.end;
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

  // Adjust dates based on aggregation level for proper boundaries
  if (aggregationLevel === 'Monthly') {
    startDate.setDate(1); // Start of month
    endDate.setMonth(endDate.getMonth() + 1, 0); // End of month
  } else if (aggregationLevel === 'Yearly') {
    startDate.setMonth(0, 1); // Start of year
    endDate.setMonth(11, 31); // End of year
  }

  // Generate complete intervals for the determined date range
  const allIntervals = generateAllIntervals(startDate, endDate, aggregationLevel);
  
  const datasets: any[] = [];
  
  if (filters.secondaryView === 'Difficulty') {
    const difficulties = ['Easy', 'Medium', 'Hard'];
    const dataMaps: { [difficulty: string]: { [key: string]: number } } = {};
    difficulties.forEach(d => dataMaps[d] = {});

    // Initialize all intervals with 0 for each difficulty
    allIntervals.forEach(interval => {
        difficulties.forEach(difficulty => {
            dataMaps[difficulty][interval] = 0;
        });
    });

    // Single loop through timeGroups to populate dataMaps efficiently
    Object.entries(timeGroups).forEach(([date, submissions]) => {
        if (filters.primaryView === 'Submissions') {
            const counts: { [key: string]: number } = { 'Easy': 0, 'Medium': 0, 'Hard': 0 };
            submissions.forEach(sub => {
                const difficulty = sub.metadata?.difficulty;
                if (difficulty && counts.hasOwnProperty(difficulty)) {
                    counts[difficulty]++;
                }
            });
            difficulties.forEach(difficulty => {
                if (dataMaps[difficulty]) dataMaps[difficulty][date] = counts[difficulty];
            });
        } else { // Problems Solved
            const solvedProblems: { [difficulty: string]: Set<string> } = {
                'Easy': new Set(),
                'Medium': new Set(),
                'Hard': new Set()
            };
            submissions.forEach(sub => {
                if (sub.status === 10) {
                    const difficulty = sub.metadata?.difficulty;
                    if (difficulty && solvedProblems.hasOwnProperty(difficulty)) {
                        solvedProblems[difficulty].add(sub.titleSlug);
                    }
                }
            });
            difficulties.forEach(difficulty => {
                if (dataMaps[difficulty]) dataMaps[difficulty][date] = solvedProblems[difficulty].size;
            });
        }
    });

    // Create datasets from the populated maps
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

    // Initialize all intervals with 0
    allIntervals.forEach(interval => {
        acceptedDataMap[interval] = 0;
        if (filters.primaryView === 'Submissions') {
            failedDataMap[interval] = 0;
        }
    });

    // Single loop through timeGroups to populate maps
    Object.entries(timeGroups).forEach(([date, submissions]) => {
        if (filters.primaryView === 'Submissions') {
            let acceptedCount = 0;
            let failedCount = 0;
            submissions.forEach(sub => {
                if (sub.status === 10) acceptedCount++;
                else failedCount++;
            });
            acceptedDataMap[date] = acceptedCount;
            failedDataMap[date] = failedCount;
        } else { // Problems Solved
            const solvedProblems = new Set<string>();
            submissions.forEach(sub => {
                if (sub.status === 10) {
                    solvedProblems.add(sub.titleSlug);
                }
            });
            acceptedDataMap[date] = solvedProblems.size;
        }
    });

    // Create 'Accepted' dataset
    const acceptedData = allIntervals.map(interval => acceptedDataMap[interval] || 0);
    datasets.push({
        label: 'Accepted',
        data: acceptedData,
        backgroundColor: colors.status.accepted,
        borderColor: colors.status.accepted,
        stack: 'main',
        maxBarThickness: 30,
    });

    // FIX: Only add 'Failed' data for 'Submissions' view, not for 'Problems Solved'
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
    // Collect all unique languages from the data
    const allLanguages = new Set<string>();
    Object.values(timeGroups).forEach(submissions => {
      submissions.forEach(sub => allLanguages.add(sub.lang));
    });
    const languages = Array.from(allLanguages);
    const dataMaps: { [lang: string]: { [key: string]: number } } = {};
    languages.forEach(lang => dataMaps[lang] = {});

    // Initialize all intervals with 0 for each language
    allIntervals.forEach(interval => {
        languages.forEach(lang => {
            dataMaps[lang][interval] = 0;
        });
    });

    // Single loop through timeGroups to populate maps efficiently
    Object.entries(timeGroups).forEach(([date, submissions]) => {
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
            if (filters.primaryView === 'Submissions') {
                dataMaps[lang][date] = langData[lang] as number;
            } else {
                dataMaps[lang][date] = (langData[lang] as Set<string>).size;
            }
        });
    });
    
    // Create datasets from the populated maps
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
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  } else {
    // Daily format: DD-MM-YYYY
    const date = new Date(dateStr);
    return `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
  }
}

function getTimeRangeCutoff(timeRange: string): Date {
  const now = new Date();
  switch (timeRange) {
    case 'Last 30 Days':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'Last 90 Days':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'Last 365 Days':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(0);
  }
}

function getDateRangeFromLabel(label: string, level: 'Daily' | 'Monthly' | 'Yearly'): { start: Date; end: Date } {
  if (level === 'Daily') {
    // Handles "DD-MM-YYYY" format from formatDateLabel
    const [day, month, year] = label.split('-').map(Number);
    const start = new Date(year, month - 1, day);
    const end = new Date(year, month - 1, day, 23, 59, 59, 999); // Full day
    return { start, end };
  } else if (level === 'Monthly') {
    // Handles "Mon YYYY" format from formatDateLabel (e.g., "Jul 2025")
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [monthStr, yearStr] = label.split(' ');
    const month = monthNames.indexOf(monthStr);
    const year = parseInt(yearStr);
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999); // Last moment of the month
    return { start, end };
  } else { // Yearly
    // Handles "YYYY" format
    const year = parseInt(label);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999); // Last moment of the year
    return { start, end };
  }
}

import type {
  ProcessedData,
  InteractiveChartData,
  BrushChartData,
  InteractiveChartFilters,
  TooltipData
} from '../../types';

// === HELPER FUNCTIONS (some are new/modified) ===

// Helper to get an ISO week key (e.g., "2023-W34") from a date
function getWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Helper to get the first date of an ISO week
function getDateOfISOWeek(weekKey: string): Date {
    const [yearStr, weekStr] = weekKey.split('-W');
    const year = parseInt(yearStr);
    const week = parseInt(weekStr);
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const isoWeekStart = simple;
    if (dow <= 4)
        isoWeekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        isoWeekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return isoWeekStart;
}


// Generates a complete sequence of dates/weeks/months between a start and end
function generateAllIntervals(
  startDate: Date,
  endDate: Date,
  aggregationLevel: 'Daily' | 'Monthly' | 'Yearly'
): string[] {
  const intervals: string[] = [];
  let current = new Date(startDate);

  if (aggregationLevel === 'Daily') {
    while (current <= endDate) {
      intervals.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
  } else if (aggregationLevel === 'Monthly') {
    current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (current <= endDate) {
      intervals.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
      current.setMonth(current.getMonth() + 1);
    }
  } else { // Yearly
    current = new Date(startDate.getFullYear(), 0, 1);
    while (current <= endDate) {
      intervals.push(current.getFullYear().toString());
      current.setFullYear(current.getFullYear() + 1);
    }
  }
  return intervals;
}


function fillMissingIntervals(
  dataMap: { [key: string]: number },
  allIntervals: string[]
): number[] {
  return allIntervals.map(interval => dataMap[interval] || 0);
}


// === MAIN EXPORTED FUNCTIONS ===

const LANGUAGE_COLORS = [
  '#C5A3DC', // soft lavender
  '#A7C7E7', // baby blue
  '#E09CA4', // rose pink
  '#FFB997', // peach
  '#B4D9A6', // mint green
  '#9ED9CC', // aqua
  '#F2A6A0', // coral pink
  '#F6D6AD', // pastel apricot
  '#AFCBFF', // sky blue
  '#DDBDD5', // dusty mauve
  '#FCD5CE', // pastel salmon
  '#C9E4DE', // pale seafoam
  '#EFD3D7', // light blush
  '#B5EAD7', // mint cream
  '#FFDAC1', // soft peach
  '#C7CEEA', // periwinkle
  '#FFB5E8', // candy pink
  '#FFABAB', // cherry blossom
  '#D5AAFF', // pastel purple
  '#A0E7E5', // cyan mint
  '#B2F7EF', // pale teal
  '#E3C6FF', // light lilac
  '#F7C5CC', // soft rose
  '#F1F7B5', // mellow yellow
  '#C2F784'  // fresh green
];


// Updated main function
export function getInteractiveChartStats(
  processedData: ProcessedData,
  filters: InteractiveChartFilters
): InteractiveChartData | null {
  const { submissions } = processedData;
  if (!submissions.length) return null;

  // Filter submissions by brush window or time range
  let filteredSubmissions = submissions;
  let effectiveDateRange: { start: Date; end: Date } | null = null;
  
  if (filters.brushWindow) {
    const [start, end] = filters.brushWindow;
    filteredSubmissions = submissions.filter(sub => 
      sub.date >= start && sub.date <= end
    );
    // Use the BRUSH WINDOW dates for aggregation level, not filtered submissions
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
    filteredSubmissions = filteredSubmissions.filter(sub =>
      sub.metadata?.difficulty === filters.difficulty
    );
  }

  // ✅ FIX: Determine aggregation level based on the effective date range, not filtered submissions
  const aggregationLevel = effectiveDateRange 
    ? getAggregationLevelFromDateRange(effectiveDateRange.start, effectiveDateRange.end)
    : getAggregationLevel(filteredSubmissions);
  
  // Group submissions by time period
  const timeGroups = groupByTimePeriod(filteredSubmissions, aggregationLevel);
  
  // Create chart data with complete date range
  const chartData = createChartData(timeGroups, filters, aggregationLevel, effectiveDateRange);
  
  return chartData;
}

// Updated navigator function
export function getBrushChartData(processedData: ProcessedData): BrushChartData | null {
  const { submissions } = processedData;
  if (!submissions.length) return null;
  
  // Always use full range from first submission to today for navigator
  const dateRange = getExtendedDateRange(submissions, true);
  
  // Determine aggregation level for navigator
  const aggregationLevel = getAggregationLevel(submissions, true);
  
  // Generate complete intervals
  const allIntervals = generateAllIntervals(dateRange.start, dateRange.end, aggregationLevel);
  
  // Group submissions
  const groupedData: { [key: string]: any[] } = {};
  
  // Initialize all intervals with empty arrays
  allIntervals.forEach(interval => {
    groupedData[interval] = [];
  });
  
  // Populate with actual submissions
  submissions.forEach(sub => {
    let key: string;
    if (aggregationLevel === 'Daily') {
      key = sub.date.toISOString().split('T')[0];
    } else if (aggregationLevel === 'Monthly') {
      key = `${sub.date.getFullYear()}-${String(sub.date.getMonth() + 1).padStart(2, '0')}`;
    } else {
      key = sub.date.getFullYear().toString();
    }
    
    if (groupedData[key]) {
      groupedData[key].push(sub);
    }
  });
  
  // Create data array with counts
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
  aggregationLevel: 'Daily' | 'Monthly' | 'Yearly' // accepting the level as an argument
): TooltipData | null {
  const { submissions } = processedData;

  const dateRange = getDateRangeFromLabel(date, aggregationLevel);

  const periodSubmissions = submissions.filter(sub =>
    sub.date >= dateRange.start && sub.date <= dateRange.end
  );

  // This check is now removed, allowing tooltips for empty bars:
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
      } else { // Problems Solved
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
      } else { // Problems Solved
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

  return {
    date,
    totalSubmissions: totalSubmissionsInPeriod,
    problemsSolved: uniqueProblemsSolved.size,
    breakdown,
    acceptanceRate
  };
}

// These functions remain the same
// Better aggregation logic - considers optimal bar count
function getAggregationLevel(submissions: any[], isNavigator: boolean = false): 'Daily' | 'Monthly' | 'Yearly' {
  if (!submissions.length) return 'Daily';
  
  const start = new Date(Math.min(...submissions.map(s => s.date.getTime())));
  const end = isNavigator ? new Date() : new Date(Math.max(...submissions.map(s => s.date.getTime())));
  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  
  // Optimal bar counts: 15-60 bars for good visualization
  if (daysDiff <= 60) return 'Daily';        // Up to 90 bars
  if (daysDiff <= 1095) return 'Monthly';    // Up to 36 bars (3 years)
  return 'Yearly';                           // For longer periods
}

function groupByTimePeriod(submissions: any[], level: 'Daily' | 'Monthly' | 'Yearly') {
  const groups: { [key: string]: any[] } = {};
  submissions.forEach(sub => {
    let key: string;
    if (level === 'Daily') key = sub.date.toISOString().split('T')[0];
    else if (level === 'Monthly') key = `${sub.date.getFullYear()}-${String(sub.date.getMonth() + 1).padStart(2, '0')}`;
    else key = sub.date.getFullYear().toString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(sub);
  });
  return groups;
}

// Enhanced date range extension to today
function getExtendedDateRange(submissions: any[], isNavigator: boolean = false): { start: Date; end: Date } {
  if (!submissions.length) {
    const today = new Date();
    return { start: today, end: today };
  }
  
  const start = new Date(Math.min(...submissions.map(s => s.date.getTime())));
  const end = isNavigator ? new Date() : new Date(); // Always extend to today
  
  return { start, end };
}

// ✅ NEW: Calculate aggregation level based on specific date range
function getAggregationLevelFromDateRange(startDate: Date, endDate: Date): 'Daily' | 'Monthly' | 'Yearly' {
  const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  
  // Use the same thresholds as your existing logic
  if (daysDiff <= 60) return 'Daily';        // Up to 90 days
  if (daysDiff <= 1095) return 'Monthly';    // Up to 3 years  
  return 'Yearly';                           // For longer periods
}
