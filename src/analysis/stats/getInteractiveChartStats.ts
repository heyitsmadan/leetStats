// Updated createChartData function
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
    ['Easy', 'Medium', 'Hard'].forEach(difficulty => {
      const dataMap: { [key: string]: number } = {};
      
      // Initialize all intervals with 0
      allIntervals.forEach(interval => {
        dataMap[interval] = 0;
      });
      
      // Populate with actual data
      Object.keys(timeGroups).forEach(date => {
        const submissions = timeGroups[date] || [];
        if (filters.primaryView === 'Submissions') {
          dataMap[date] = submissions.filter(sub => sub.metadata?.difficulty === difficulty).length;
        } else {
          const solvedProblems = new Set();
          submissions.forEach(sub => {
            if (sub.status === 10 && sub.metadata?.difficulty === difficulty) {
              solvedProblems.add(sub.titleSlug);
            }
          });
          dataMap[date] = solvedProblems.size;
        }
      });
      
      const data = allIntervals.map(interval => dataMap[interval] || 0);
      
      datasets.push({
        label: difficulty,
        data,
        backgroundColor: DIFFICULTY_COLORS[difficulty as keyof typeof DIFFICULTY_COLORS],
        borderColor: DIFFICULTY_COLORS[difficulty as keyof typeof DIFFICULTY_COLORS],
        stack: 'main'
      });
    });
  } else if (filters.secondaryView === 'Status') {
    // Accepted data
    const acceptedDataMap: { [key: string]: number } = {};
    Object.keys(timeGroups).forEach(date => {
      const submissions = timeGroups[date] || [];
      
      if (filters.primaryView === 'Submissions') {
        acceptedDataMap[date] = submissions.filter(sub => sub.status === 10).length;
      } else {
        const solvedProblems = new Set<string>();
        submissions.forEach(sub => {
          if (sub.status === 10) {
            solvedProblems.add(sub.titleSlug);
          }
        });
        acceptedDataMap[date] = solvedProblems.size;
      }
    });
    
    // Failed data
    const failedDataMap: { [key: string]: number } = {};
    Object.keys(timeGroups).forEach(date => {
      const submissions = timeGroups[date] || [];
      
      if (filters.primaryView === 'Submissions') {
        failedDataMap[date] = submissions.filter(sub => sub.status !== 10).length;
      } else {
        failedDataMap[date] = 0; // For problems solved mode, failed should be 0
      }
    });
    
    const acceptedData = fillMissingIntervals(acceptedDataMap, allIntervals);
    const failedData = fillMissingIntervals(failedDataMap, allIntervals);
    
    datasets.push(
      {
        label: 'Accepted',
        data: acceptedData,
        backgroundColor: STATUS_COLORS.Accepted,
        borderColor: STATUS_COLORS.Accepted,
        stack: 'main'
      },
      {
        label: 'Failed',
        data: failedData,
        backgroundColor: filters.primaryView === 'Problems Solved' ? '#d1e7dd' : STATUS_COLORS.Failed,
        borderColor: filters.primaryView === 'Problems Solved' ? '#d1e7dd' : STATUS_COLORS.Failed,
        stack: 'main'
      }
    );
  } else if (filters.secondaryView === 'Language') {
    // Collect all languages from all time groups
    const allLanguages = new Set<string>();
    Object.values(timeGroups).forEach(submissions => {
      submissions.forEach(sub => allLanguages.add(sub.lang));
    });
    
    // Create data for each language
    Array.from(allLanguages).forEach((lang, index) => {
      const dataMap: { [key: string]: number } = {};
      
      Object.keys(timeGroups).forEach(date => {
        const submissions = timeGroups[date] || [];
        
        if (filters.primaryView === 'Submissions') {
          dataMap[date] = submissions.filter(sub => sub.lang === lang).length;
        } else {
          const solvedProblems = new Set<string>();
          submissions.forEach(sub => {
            if (sub.status === 10 && sub.lang === lang) {
              solvedProblems.add(sub.titleSlug);
            }
          });
          dataMap[date] = solvedProblems.size;
        }
      });
      
      const data = fillMissingIntervals(dataMap, allIntervals);
      
      datasets.push({
        label: lang,
        data,
        backgroundColor: LANGUAGE_COLORS[index % LANGUAGE_COLORS.length],
        borderColor: LANGUAGE_COLORS[index % LANGUAGE_COLORS.length],
        stack: 'main'
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
    const start = new Date(label);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
  } else if (level === 'Monthly') {
    const [year, month] = label.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return { start, end };
  } else {
    const year = parseInt(label);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
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

const DIFFICULTY_COLORS = { 'Easy': '#58b8b9', 'Medium': '#f4ba40', 'Hard': '#e24a41' };
const STATUS_COLORS = { 'Accepted': '#5db666', 'Failed': '#393939' };
const LANGUAGE_COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7', '#a29bfe', '#fd79a8', '#e84393'];

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
  filters: InteractiveChartFilters
): TooltipData | null {
  // This function remains largely the same as your original
  // ... (code for getTooltipData)
    const { submissions, problemMap } = processedData;
  
  // Parse date based on aggregation level
  const aggregationLevel = getAggregationLevel(submissions);
  const dateRange = getDateRangeFromLabel(date, aggregationLevel);
  
  const periodSubmissions = submissions.filter(sub => 
    sub.date >= dateRange.start && sub.date <= dateRange.end
  );

  if (!periodSubmissions.length) return null;

  // Calculate problems solved in this period
  const uniqueProblems = new Set(
    periodSubmissions
      .filter(sub => sub.status === 10) // Accepted
      .map(sub => sub.titleSlug)
  );

  const breakdown: { [key: string]: number } = {};
  
  if (filters.secondaryView === 'Difficulty') {
    ['Easy', 'Medium', 'Hard'].forEach(difficulty => {
      if (filters.primaryView === 'Submissions') {
        breakdown[difficulty] = periodSubmissions
          .filter(sub => sub.metadata?.difficulty === difficulty)
          .length;
      } else {
        const solvedProblems = new Set<string>();
        periodSubmissions.forEach(sub => {
          if (sub.status === 10 && sub.metadata?.difficulty === difficulty) {
            solvedProblems.add(sub.titleSlug);
          }
        });
        breakdown[difficulty] = solvedProblems.size;
      }
    });
  } else if (filters.secondaryView === 'Status') {
    if (filters.primaryView === 'Submissions') {
      breakdown['Accepted'] = periodSubmissions.filter(sub => sub.status === 10).length;
      breakdown['Failed'] = periodSubmissions.filter(sub => sub.status !== 10).length;
    } else {
      breakdown['Accepted'] = uniqueProblems.size;
      breakdown['Failed'] = 0;
    }
  } else if (filters.secondaryView === 'Language') {
    const allLanguages = new Set(periodSubmissions.map(sub => sub.lang));
    allLanguages.forEach(lang => {
      if (filters.primaryView === 'Submissions') {
        breakdown[lang] = periodSubmissions.filter(sub => sub.lang === lang).length;
      } else {
        const solvedProblems = new Set<string>();
        periodSubmissions.forEach(sub => {
          if (sub.status === 10 && sub.lang === lang) {
            solvedProblems.add(sub.titleSlug);
          }
        });
        breakdown[lang] = solvedProblems.size;
      }
    });
  }

  return {
    date,
    totalSubmissions: periodSubmissions.length,
    problemsSolved: uniqueProblems.size,
    breakdown
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
