// Helper functions to generate complete time intervals
function generateAllIntervals(
  startDate: Date, 
  endDate: Date, 
  aggregationLevel: 'Daily' | 'Monthly' | 'Yearly'
): string[] {
  const intervals: string[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    let key: string;
    
    if (aggregationLevel === 'Daily') {
      key = current.toISOString().split('T')[0];
      current.setDate(current.getDate() + 1);
    } else if (aggregationLevel === 'Monthly') {
      key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      current.setMonth(current.getMonth() + 1);
    } else {
      key = current.getFullYear().toString();
      current.setFullYear(current.getFullYear() + 1);
    }
    
    intervals.push(key);
  }
  
  return intervals;
}

function fillMissingIntervals(
  dataMap: { [key: string]: number },
  allIntervals: string[]
): number[] {
  return allIntervals.map(interval => dataMap[interval] || 0);
}

import type { 
  ProcessedData, 
  InteractiveChartData, 
  BrushChartData, 
  InteractiveChartFilters,
  TooltipData 
} from '../../types';

const DIFFICULTY_COLORS = {
  'Easy': '#58b8b9',
  'Medium': '#f4ba40',
  'Hard': '#e24a41'
};

const STATUS_COLORS = {
  'Accepted': '#5db666',
  'Failed': '#9ca3af'
};

const LANGUAGE_COLORS = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b',
  '#eb4d4b', '#6c5ce7', '#a29bfe', '#fd79a8', '#e84393'
];

export function getInteractiveChartStats(
  processedData: ProcessedData,
  filters: InteractiveChartFilters
): InteractiveChartData | null {
  
  const { submissions } = processedData;
  if (!submissions.length) return null;

  // Filter submissions by time range and difficulty
  let filteredSubmissions = submissions;
  
  if (filters.brushWindow) {
    const [start, end] = filters.brushWindow;
    filteredSubmissions = submissions.filter(sub => 
      sub.date >= start && sub.date <= end
    );
  } else if (filters.timeRange !== 'All Time') {
    const cutoffDate = getTimeRangeCutoff(filters.timeRange);
    filteredSubmissions = submissions.filter(sub => sub.date >= cutoffDate);
  }

  if (filters.difficulty !== 'All') {
    filteredSubmissions = filteredSubmissions.filter(sub => 
      sub.metadata?.difficulty === filters.difficulty
    );
  }

  // Determine aggregation level based on time range
  const aggregationLevel = getAggregationLevel(filteredSubmissions);
  
  // Group submissions by time period
  const timeGroups = groupByTimePeriod(filteredSubmissions, aggregationLevel);
  
  // Create chart data based on secondary view
  const chartData = createChartData(timeGroups, filters, aggregationLevel);
  
  return chartData;
}

export function getBrushChartData(processedData: ProcessedData): BrushChartData | null {
  const { submissions } = processedData;
  if (!submissions.length) return null;

  // Get the full date range
  const allDates = submissions.map(s => s.date);
  const startDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const endDate = new Date(Math.max(...allDates.map(d => d.getTime())));

  // Generate daily intervals for the entire range
  const allIntervals = generateAllIntervals(startDate, endDate, 'Daily');
  
  // Group submissions by day
  const dailyGroups: { [key: string]: any[] } = {};
  submissions.forEach(sub => {
    const key = sub.date.toISOString().split('T')[0];
    if (!dailyGroups[key]) dailyGroups[key] = [];
    dailyGroups[key].push(sub);
  });

  // Fill missing days with zero
  const data = fillMissingIntervals(
    Object.fromEntries(
      Object.entries(dailyGroups).map(([date, subs]) => [date, subs.length])
    ),
    allIntervals
  );

  return {
    labels: allIntervals,
    data,
    fullTimeRange: {
      start: startDate,
      end: endDate
    }
  };
}


export function getTooltipData(
  processedData: ProcessedData,
  date: string,
  filters: InteractiveChartFilters
): TooltipData | null {
  
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
        // Count unique problems solved with this difficulty
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
      // For problems solved, only show accepted (fully green)
      breakdown['Accepted'] = uniqueProblems.size;
      breakdown['Failed'] = 0;
    }
  } else if (filters.secondaryView === 'Language') {
    const allLanguages = new Set(periodSubmissions.map(sub => sub.lang));
    allLanguages.forEach(lang => {
      if (filters.primaryView === 'Submissions') {
        breakdown[lang] = periodSubmissions.filter(sub => sub.lang === lang).length;
      } else {
        // Count unique problems solved in this language
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


function getAggregationLevel(submissions: any[]): 'Daily' | 'Monthly' | 'Yearly' {
  if (!submissions.length) return 'Daily';
  
  const start = new Date(Math.min(...submissions.map(s => s.date.getTime())));
  const end = new Date(Math.max(...submissions.map(s => s.date.getTime())));
  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysDiff < 90) return 'Daily';
  if (daysDiff < 730) return 'Monthly'; // ~2 years
  return 'Yearly';
}

function groupByTimePeriod(submissions: any[], level: 'Daily' | 'Monthly' | 'Yearly') {
  const groups: { [key: string]: any[] } = {};
  
  submissions.forEach(sub => {
    let key: string;
    
    if (level === 'Daily') {
      key = sub.date.toISOString().split('T')[0];
    } else if (level === 'Monthly') {
      key = `${sub.date.getFullYear()}-${String(sub.date.getMonth() + 1).padStart(2, '0')}`;
    } else {
      key = sub.date.getFullYear().toString();
    }
    
    if (!groups[key]) groups[key] = [];
    groups[key].push(sub);
  });
  
  return groups;
}

function createChartData(
  timeGroups: { [key: string]: any[] },
  filters: InteractiveChartFilters,
  aggregationLevel: 'Daily' | 'Monthly' | 'Yearly'
): InteractiveChartData {
  
  // Determine the full time range from submissions
  const allDates = Object.keys(timeGroups);
  if (allDates.length === 0) {
    return {
      labels: [],
      datasets: [],
      aggregationLevel,
      timeRange: { start: new Date(), end: new Date() }
    };
  }
  
  // Get start and end dates
  const sortedDates = allDates.sort();
  const startDate = new Date(sortedDates[0]);
  const endDate = new Date(sortedDates[sortedDates.length - 1]);
  
  // Adjust dates based on aggregation level for proper boundaries
  if (aggregationLevel === 'Monthly') {
    startDate.setDate(1); // Start of month
    endDate.setMonth(endDate.getMonth() + 1, 0); // End of month
  } else if (aggregationLevel === 'Yearly') {
    startDate.setMonth(0, 1); // Start of year
    endDate.setMonth(11, 31); // End of year
  }
  
  // Generate all intervals in the range
  const allIntervals = generateAllIntervals(startDate, endDate, aggregationLevel);
  const datasets: any[] = [];
  
  if (filters.secondaryView === 'Difficulty') {
    ['Easy', 'Medium', 'Hard'].forEach(difficulty => {
      const dataMap: { [key: string]: number } = {};
      
      // Populate data map with actual values
      Object.keys(timeGroups).forEach(date => {
        const submissions = timeGroups[date] || [];
        
        if (filters.primaryView === 'Submissions') {
          dataMap[date] = submissions.filter(sub => sub.metadata?.difficulty === difficulty).length;
        } else {
          const solvedProblems = new Set<string>();
          submissions.forEach(sub => {
            if (sub.status === 10 && sub.metadata?.difficulty === difficulty) {
              solvedProblems.add(sub.titleSlug);
            }
          });
          dataMap[date] = solvedProblems.size;
        }
      });
      
      // Fill missing intervals with zeros
      const data = fillMissingIntervals(dataMap, allIntervals);
      
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
    labels: allIntervals.map(formatDateLabel),
    datasets,
    aggregationLevel,
    timeRange: {
      start: startDate,
      end: endDate
    }
  };
}



function formatDateLabel(dateStr: string): string {
  if (dateStr.length === 4) {
    return dateStr; // Year
  } else if (dateStr.length === 7) {
    const [year, month] = dateStr.split('-');
    return `${year}-${month}`;
  } else {
    return dateStr; // Daily format
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
