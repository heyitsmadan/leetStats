// =================================================================
// RAW API & CACHE TYPES
// =================================================================

/** The shape of a single submission object from the LeetCode API. */
export interface RawSubmission {
  id: string;
  title: string;
  titleSlug: string;
  status: number;
  lang: string;
  timestamp: string;
}

/** The shape of the API response for the submission list. */
export interface SubmissionListResponse {
  data: {
    submissionList: {
      hasNext: boolean;
      submissions: RawSubmission[];
    };
  };
}

/** The shape of the problem metadata object from the API and for caching. */
export interface ProblemMetadata {
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topics: string[];
}

/** The shape of the cached submissions object. */
export interface CachedSubmissions {
  submissions: RawSubmission[];
  latestFetchedSubmissionId: string;
}

/** The shape of the cached metadata object. */
export interface CachedMetadata {
  [slug: string]: ProblemMetadata;
}

/** The shape of the API response for the user submission stats. */
export interface UserSubmissionsGraphQLResponse {
  data: {
    matchedUser: {
      submitStatsGlobal: {
        acSubmissionNum: {
          difficulty: 'All' | 'Easy' | 'Medium' | 'Hard';
          submissions: number;
        }[];
      };
    };
  };
}

// =================================================================
// FILTER & VIEW TYPES
// =================================================================

export type Difficulty = 'All' | 'Easy' | 'Medium' | 'Hard';
export type TimeRange = 'All Time' | 'Last 30 Days' | 'Last 90 Days' | 'Last 365 Days';
export type ClockView = 'HourOfDay' | 'DayOfWeek';
export type CumulativeView = 'Daily' | 'Monthly' | 'Yearly';
export type AggregationLevel = 'Daily' | 'Monthly' | 'Yearly';

// =================================================================
// PROCESSED DATA & SHARED TYPES
// =================================================================

/** A submission object after being processed (e.g., date string converted to Date object). */
export interface ProcessedSubmission extends RawSubmission {
  date: Date;
  metadata?: ProblemMetadata;
}

/** The main processed data object used throughout the application. */
export interface ProcessedData {
  submissions: ProcessedSubmission[];
  problemMap: Map<string, ProcessedSubmission[]>;
}

/** Represents a single point in a time series chart. */
export interface TimeSeriesPoint {
  date: string;
  value: number;
  easy?: number;
  medium?: number;
  hard?: number;
}

/** A type for the loader controls to pass around. */
export interface ILoader {
  show: () => void;
  update: (totalFetched: number, acceptedFetched: number, totalAccepted: number) => void;
  complete: (finalMessage?: string) => void;
  error: (errorMessage: string) => void;
}

// =================================================================
// CUMULATIVE CHART TYPES
// =================================================================

export interface CumulativeChartStats {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor: string;
    fill: boolean;
    tension: number;
  }[];
}

// =================================================================
// LEGACY STATS (TROPHIES, MILESTONES, RECORDS)
// =================================================================

export interface TrophyData {
  id: string;
  title: string;
  subtitle: string;
  problemTitle: string;
  problemSlug: string;
  icon: string;
  stat: number;
  personalNote?: string;
  achieved: boolean;
}

export interface MilestoneData {
  type: 'problems_solved' | 'submissions' | 'easy' | 'medium' | 'hard';
  milestone: number;
  date: Date;
  problemTitle?: string;
  problemSlug?: string;
  submissionId?: string;
}

export interface RecordData {
  name: string;
  value?: string | number;
  subStats?: { easy: number; medium: number; hard: number };
  isHighlight?: boolean;
  chartId?: string;
  mainStat?: string;
  dateStat?: string;
}

export interface LegacyStats {
  trophies: TrophyData[];
  milestones: MilestoneData[];
  records: RecordData[];
}

// =================================================================
// INTERACTIVE CHART (MAIN BAR CHART + BRUSH)
// =================================================================

export interface InteractiveChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string;
    borderColor: string;
    stack?: string;
  }[];
  aggregationLevel: AggregationLevel;
  timeRange: { start: Date; end: Date };
}

export interface BrushChartData {
  labels: string[];
  data: number[];
  fullTimeRange: { start: Date; end: Date };
}

export interface InteractiveChartFilters {
  primaryView: 'Submissions' | 'Problems Solved';
  secondaryView: 'Difficulty' | 'Language' | 'Status';
  timeRange: TimeRange;
  difficulty: Difficulty;
  brushWindow?: [Date, Date];
}

export interface TooltipData {
  date: string;
  totalSubmissions: number;
  problemsSolved: number;
  breakdown: { [key: string]: number };
  acceptanceRate?: number;
}

// =================================================================
// SKILL MATRIX
// =================================================================

export interface SkillMatrixData {
  topics: string[];
  metrics: {
    problemsSolved: { [topic: string]: number };
    avgTries: { [topic: string]: number };
    firstAceRate: { [topic: string]: number };
  };
  timeSeriesData: {
    [topic: string]: {
      problemsSolved: TimeSeriesPoint[];
      avgTries: TimeSeriesPoint[];
      firstAceRate: TimeSeriesPoint[];
    };
  };
  timeRangeStart: string;
}

export interface SkillMatrixOptions {
  timeRange: 'Last 30 Days' | 'Last 90 Days' | 'Last 365 Days' | 'All Time';
  chartView: 'Daily' | 'Monthly' | 'Yearly';
  showDifficultySplit: boolean;
  selectedMetric: 'problemsSolved' | 'avgTries' | 'firstAceRate';
}