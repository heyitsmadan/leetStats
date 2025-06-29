// src/types.ts

// The shape of a single submission object from the LeetCode API
export interface RawSubmission {
  id: string;
  title: string;
  titleSlug: string;
  status: number; // You could use a string literal type here too: 'AC', 'WA', etc.
  lang: string;
  timestamp: string;
}

// The shape of the API response for the submission list
export interface SubmissionListResponse {
  data: {
    submissionList: {
      hasNext: boolean;
      submissions: RawSubmission[];
    };
  };
}

// The shape of the problem metadata object from the API and for caching
export interface ProblemMetadata {
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topics: string[];
}

// The shape of the cached data in chrome.storage.local
export interface CachedSubmissions {
  submissions: RawSubmission[];
  latestFetchedTimestamp: number;
}

export interface CachedMetadata {
  [slug: string]: ProblemMetadata;
}

// --- Filter Types ---
export type Difficulty = 'All' | 'Easy' | 'Medium' | 'Hard';
export type TimeRange = 'All Time' | 'Last 30 Days' | 'Last Year';
export type ClockView = 'HourOfDay' | 'DayOfWeek';
export type CumulativeView = 'Daily' | 'Monthly' | 'Yearly'; // <-- ADD THIS

// --- Processed Data Shapes ---
export interface ProcessedSubmission extends RawSubmission {
  date: Date;
  metadata?: ProblemMetadata;
}

export interface ProcessedData {
  submissions: ProcessedSubmission[];
  problemMap: Map<string, ProcessedSubmission[]>;
}

// For the new Cumulative Chart // <-- ADD THIS SECTION
export interface CumulativeChartStats {
    labels: string[];
    datasets: {
        label: string; // e.g., 'Total Submissions', 'Easy Solved'
        data: number[];
        borderColor: string;
        fill: boolean;
        tension: number; // For bezier curves
    }[];
}

// Add these interfaces to your existing types.ts

export interface TrophyData {
  id: string;
  title: string;
  subtitle: string;
  problemTitle: string;
  problemSlug: string;
  icon: string;
  stat: number;
  personalNote?: string;
}

export interface MilestoneData {
  type: 'problems_solved' | 'submissions' | 'easy' | 'medium' | 'hard';
  milestone: number;
  date: Date;
  problemTitle?: string;
  problemSlug?: string;
}

export interface RecordData {
  name: string;
  value: string | number;
  subStats?: { easy: number; medium: number; hard: number };
  isHighlight?: boolean;
  chartId?: string; // Add this line
}


export interface LegacyStats {
  trophies: TrophyData[];
  milestones: MilestoneData[];
  records: RecordData[];
}
