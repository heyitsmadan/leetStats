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

  // Always show daily data for brush chart
  const dailyGroups = groupByTimePeriod(submissions, 'Daily');
  const labels = Object.keys(dailyGroups).sort();
  const data = labels.map(date => dailyGroups[date].length);

  return {
    labels,
    data,
    fullTimeRange: {
      start: new Date(Math.min(...submissions.map(s => s.date.getTime()))),
      end: new Date(Math.max(...submissions.map(s => s.date.getTime())))
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
      breakdown[difficulty] = periodSubmissions
        .filter(sub => sub.metadata?.difficulty === difficulty)
        .length;
    });
  } else if (filters.secondaryView === 'Status') {
    breakdown['Accepted'] = periodSubmissions.filter(sub => sub.status === 10).length;
    breakdown['Failed'] = periodSubmissions.filter(sub => sub.status !== 10).length;
  } else if (filters.secondaryView === 'Language') {
    const langCount: { [key: string]: number } = {};
    periodSubmissions.forEach(sub => {
      langCount[sub.lang] = (langCount[sub.lang] || 0) + 1;
    });
    Object.assign(breakdown, langCount);
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
  
  const labels = Object.keys(timeGroups).sort();
  const datasets: any[] = [];
  
  if (filters.secondaryView === 'Difficulty') {
    ['Easy', 'Medium', 'Hard'].forEach(difficulty => {
      const data = labels.map(date => {
        const submissions = timeGroups[date] || [];
        return submissions.filter(sub => sub.metadata?.difficulty === difficulty).length;
      });
      
      datasets.push({
        label: difficulty,
        data,
        backgroundColor: DIFFICULTY_COLORS[difficulty as keyof typeof DIFFICULTY_COLORS],
        borderColor: DIFFICULTY_COLORS[difficulty as keyof typeof DIFFICULTY_COLORS],
        stack: 'main'
      });
    });
  } else if (filters.secondaryView === 'Status') {
    const acceptedData = labels.map(date => {
      const submissions = timeGroups[date] || [];
      return submissions.filter(sub => sub.status === 10).length;
    });
    
    const failedData = labels.map(date => {
      const submissions = timeGroups[date] || [];
      return submissions.filter(sub => sub.status !== 10).length;
    });
    
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
        backgroundColor: STATUS_COLORS.Failed,
        borderColor: STATUS_COLORS.Failed,
        stack: 'main'
      }
    );
  } else if (filters.secondaryView === 'Language') {
    const languageStats: { [key: string]: number[] } = {};
    
    // Collect all languages
    const allLanguages = new Set<string>();
    Object.values(timeGroups).forEach(submissions => {
      submissions.forEach(sub => allLanguages.add(sub.lang));
    });
    
    // Create data for each language
    Array.from(allLanguages).forEach((lang, index) => {
      const data = labels.map(date => {
        const submissions = timeGroups[date] || [];
        return submissions.filter(sub => sub.lang === lang).length;
      });
      
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
    labels: labels.map(formatDateLabel),
    datasets,
    aggregationLevel,
    timeRange: {
      start: new Date(labels[0]),
      end: new Date(labels[labels.length - 1])
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
