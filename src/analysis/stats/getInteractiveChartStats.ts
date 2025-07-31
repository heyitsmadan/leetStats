import { colors } from '../../ui/theme/colors';
import type {
  ProcessedData,
  InteractiveChartData,
  BrushChartData,
  InteractiveChartFilters,
  TooltipData
} from '../../types';

// === HELPER FUNCTIONS ===

/**
 * Creates a timezone-safe date key (e.g., '2023-07-31') to avoid UTC conversion issues.
 * This ensures submissions are grouped into the correct local day.
 * @param date The date to convert.
 * @param level The aggregation level.
 * @returns A string key for the date.
 */
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

/**
 * Generates a complete sequence of date strings for all intervals between a start and end date.
 * @param startDate The start of the range.
 * @param endDate The end of the range.
 * @param aggregationLevel The level of interval ('Daily', 'Monthly', 'Yearly').
 * @returns An array of date strings.
 */
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
      intervals.push(getDateKey(current, 'Daily'));
      current.setDate(current.getDate() + 1);
    }
  } else if (aggregationLevel === 'Monthly') {
    current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (current <= endMonth) {
      intervals.push(getDateKey(current, 'Monthly'));
      current.setMonth(current.getMonth() + 1);
    }
  } else { // Yearly
    current = new Date(startDate.getFullYear(), 0, 1);
    const endYear = new Date(endDate.getFullYear(), 0, 1);
    while (current <= endYear) {
      intervals.push(getDateKey(current, 'Yearly'));
      current.setFullYear(current.getFullYear() + 1);
    }
  }
  return intervals;
}

/**
 * Creates the main chart data structure based on grouped data and filters.
 * @param timeGroups Grouped submission data.
 * @param filters User-selected filters.
 * @param aggregationLevel The current aggregation level.
 * @param effectiveDateRange The date range from the brush or time filter.
 * @param boundaryDates The absolute min/max dates of the entire dataset.
 * @returns Formatted data for the chart.
 */
function createChartData(
  timeGroups: { [key: string]: any[] },
  filters: InteractiveChartFilters,
  aggregationLevel: 'Daily' | 'Monthly' | 'Yearly',
  effectiveDateRange?: { start: Date; end: Date } | null,
  boundaryDates?: { min: Date; max: Date }
): InteractiveChartData {

  let startDate: Date, endDate: Date;

  if (effectiveDateRange) {
    // Create copies to prevent mutating the original brushWindow dates
    startDate = new Date(effectiveDateRange.start);
    endDate = new Date(effectiveDateRange.end);
  } else {
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

  const today = new Date();
  const minDataDate = boundaryDates?.min;

  let isSelectionAtTheVeryBeginning = false;
  if (minDataDate && startDate) {
    if (
      startDate.getFullYear() === minDataDate.getFullYear() &&
      startDate.getMonth() === minDataDate.getMonth() &&
      startDate.getDate() === minDataDate.getDate()
    ) {
      isSelectionAtTheVeryBeginning = true;
    }
  }

  let isSelectionAtTheVeryEnd = false;
  if (endDate) {
    // Check if the brush selection's end date matches today's date.
    if (
      endDate.getFullYear() === today.getFullYear() &&
      endDate.getMonth() === today.getMonth() &&
      endDate.getDate() === today.getDate()
    ) {
      isSelectionAtTheVeryEnd = true;
    }
  }

  // Adjust date range to include only full periods
  if (!isSelectionAtTheVeryBeginning) {
    if (aggregationLevel === 'Monthly' && startDate.getDate() !== 1) {
      startDate.setMonth(startDate.getMonth() + 1, 1);
    } else if (aggregationLevel === 'Yearly' && (startDate.getMonth() !== 0 || startDate.getDate() !== 1)) {
      startDate.setFullYear(startDate.getFullYear() + 1, 0, 1);
    }
  }
  startDate.setHours(0, 0, 0, 0);

  if (!isSelectionAtTheVeryEnd) {
    if (aggregationLevel === 'Monthly') {
      const lastDayOfMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
      if (endDate.getDate() < lastDayOfMonth.getDate()) {
        endDate.setDate(0);
      }
    } else if (aggregationLevel === 'Yearly') {
      if (endDate.getMonth() !== 11 || endDate.getDate() !== 31) {
        endDate.setFullYear(endDate.getFullYear(), 0, 0);
      }
    } else if (aggregationLevel === 'Daily') {
      endDate.setDate(endDate.getDate() - 1);
    }
  }
  endDate.setHours(23, 59, 59, 999);

  if (startDate > endDate) {
    return {
      labels: [],
      datasets: [],
      aggregationLevel,
      timeRange: { start: effectiveDateRange?.start || new Date(), end: effectiveDateRange?.end || new Date() }
    };
  }

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

    datasets.push({
      label: 'Accepted',
      data: allIntervals.map(interval => acceptedDataMap[interval] || 0),
      backgroundColor: colors.status.accepted,
      borderColor: colors.status.accepted,
      stack: 'main',
      maxBarThickness: 30,
    });

    if (filters.primaryView === 'Submissions') {
      datasets.push({
        label: 'Failed',
        data: allIntervals.map(interval => failedDataMap[interval] || 0),
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
      datasets.push({
        label: lang,
        data: allIntervals.map(interval => dataMaps[lang][interval] || 0),
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

/**
 * Formats a date string for display on the chart axis.
 * @param dateStr The date string from the data (e.g., '2023-07-31').
 * @param aggregationLevel The level of aggregation.
 * @returns A formatted date string for the UI.
 */
function formatDateLabel(dateStr: string, aggregationLevel: 'Daily' | 'Monthly' | 'Yearly'): string {
  if (aggregationLevel === 'Yearly') {
    return dateStr;
  }
  if (aggregationLevel === 'Monthly') {
    const [year, month] = dateStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }
  // Daily
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
}

/**
 * Calculates the cutoff date based on a time range filter string.
 * @param timeRange The selected time range filter.
 * @returns The calculated cutoff date.
 */
function getTimeRangeCutoff(timeRange: string): Date {
  const now = new Date();
  switch (timeRange) {
    case 'Last 30 Days':
      return new Date(now.setDate(now.getDate() - 30));
    case 'Last 90 Days':
      return new Date(now.setDate(now.getDate() - 90));
    case 'Last 365 Days':
      return new Date(now.setDate(now.getDate() - 365));
    default:
      return new Date(0); // All Time
  }
}

/**
 * Determines the start and end dates for a given chart label.
 * @param label The chart label (e.g., '31/07/23' or 'Jul 2023').
 * @param level The aggregation level of the chart.
 * @returns An object with the start and end dates for that label.
 */
function getDateRangeFromLabel(label: string, level: 'Daily' | 'Monthly' | 'Yearly'): { start: Date; end: Date } {
  if (level === 'Daily') {
    const [day, month, shortYear] = label.split('/').map(Number);
    const year = shortYear + 2000;
    const start = new Date(year, month - 1, day);
    const end = new Date(year, month - 1, day, 23, 59, 59, 999);
    return { start, end };
  }
  if (level === 'Monthly') {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [monthStr, yearStr] = label.split(' ');
    const month = monthNames.indexOf(monthStr);
    const year = parseInt(yearStr);
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }
  // Yearly
  const year = parseInt(label);
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return { start, end };
}

// === MAIN EXPORTED FUNCTIONS ===

/**
 * Main function to process data and generate stats for the interactive bar chart.
 * @param processedData The main processed data object.
 * @param filters The current filter settings.
 * @returns Data formatted for the Chart.js component or null if no data.
 */
export function getInteractiveChartStats(
  processedData: ProcessedData,
  filters: InteractiveChartFilters
): InteractiveChartData | null {
  const { submissions } = processedData;
  if (!submissions.length) {
    return null;
  }

  const minDataDate = new Date(Math.min(...submissions.map(s => s.date.getTime())));

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

  const aggregationLevel = effectiveDateRange ?
    getAggregationLevelFromDateRange(effectiveDateRange.start, effectiveDateRange.end) :
    getAggregationLevel(filteredSubmissions);

  const timeGroups = groupByTimePeriod(filteredSubmissions, aggregationLevel);

  const chartData = createChartData(timeGroups, filters, aggregationLevel, effectiveDateRange, { min: minDataDate, max: new Date() });

  return chartData;
}

/**
 * Generates the data needed for the brush/navigator chart.
 * @param processedData The main processed data object.
 * @returns Data for the brush chart or null if no data.
 */
export function getBrushChartData(processedData: ProcessedData): BrushChartData | null {
  const { submissions } = processedData;
  if (!submissions.length) {
    return null;
  }

  const dateRange = getExtendedDateRange(submissions, true);
  const aggregationLevel = getAggregationLevel(submissions, true);
  const allIntervals = generateAllIntervals(dateRange.start, dateRange.end, aggregationLevel);

  const groupedData: { [key: string]: any[] } = {};
  allIntervals.forEach(interval => { groupedData[interval] = []; });

  submissions.forEach(sub => {
    const key = getDateKey(sub.date, aggregationLevel);
    if (groupedData.hasOwnProperty(key)) {
      groupedData[key].push(sub);
    }
  });

  const data = allIntervals.map(interval => groupedData[interval]?.length || 0);

  return {
    labels: allIntervals,
    data,
    fullTimeRange: dateRange
  };
}

/**
 * Gathers detailed data for a specific time period to display in a tooltip.
 * @param processedData The main processed data object.
 * @param date The date label from the chart.
 * @param filters The current chart filters.
 * @param aggregationLevel The current aggregation level.
 * @returns Detailed data for the tooltip or null.
 */
export function getTooltipData(
  processedData: ProcessedData,
  date: string,
  filters: InteractiveChartFilters,
  aggregationLevel: 'Daily' | 'Monthly' | 'Yearly'
): TooltipData | null {
  const { submissions } = processedData;
  const dateRange = getDateRangeFromLabel(date, aggregationLevel);
  const periodSubmissions = submissions.filter(sub => sub.date >= dateRange.start && sub.date <= dateRange.end);

  if (!periodSubmissions.length) {
    return null;
  }

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
  } else if (filters.secondaryView === 'Status' && filters.primaryView === 'Submissions') {
    const acceptedCount = acceptedSubmissions.length;
    breakdown['Accepted'] = acceptedCount;
    if (totalSubmissionsInPeriod > 0) {
      acceptanceRate = (acceptedCount / totalSubmissionsInPeriod) * 100;
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

/**
 * Determines the optimal aggregation level based on the time span of submissions.
 * @param submissions An array of submission objects.
 * @param isNavigator Flag to indicate if this is for the main chart or the brush navigator.
 * @returns The calculated aggregation level.
 */
function getAggregationLevel(submissions: any[], isNavigator: boolean = false): 'Daily' | 'Monthly' | 'Yearly' {
  if (!submissions.length) {
    return 'Daily';
  }

  const { start, end } = getExtendedDateRange(submissions, isNavigator);
  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

  if (daysDiff <= 90) return 'Daily';
  if (daysDiff <= 1825) return 'Monthly';
  return 'Yearly';
}

/**
 * Groups submissions by a specified time period.
 * @param submissions An array of submission objects.
 * @param level The aggregation level to group by.
 * @returns An object with keys as date strings and values as arrays of submissions.
 */
function groupByTimePeriod(submissions: any[], level: 'Daily' | 'Monthly' | 'Yearly') {
  const groups: { [key: string]: any[] } = {};
  submissions.forEach(sub => {
    const key = getDateKey(sub.date, level);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(sub);
  });
  return groups;
}

/**
 * Calculates the full date range of submissions, extending to the end of the current day for the navigator.
 * @param submissions An array of submission objects.
 * @param isNavigator Flag to indicate if this is for the brush navigator.
 * @returns An object with the start and end dates.
 */
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

/**
 * Determines the aggregation level based on a given date range.
 * @param startDate The start of the range.
 * @param endDate The end of the range.
 * @returns The calculated aggregation level.
 */
function getAggregationLevelFromDateRange(startDate: Date, endDate: Date): 'Daily' | 'Monthly' | 'Yearly' {
  const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysDiff <= 90) return 'Daily';
  if (daysDiff <= 1095) return 'Monthly';
  return 'Yearly';
}