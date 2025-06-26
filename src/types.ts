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
