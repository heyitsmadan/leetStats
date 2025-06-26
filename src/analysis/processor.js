/**
 * Data processing pipeline - transforms raw submissions into reusable data structures
 */

export const STATUS_CODES = {
  ACCEPTED: 10,
  WRONG_ANSWER: 11,
  RUNTIME_ERROR: 14,
  TIME_LIMIT_EXCEEDED: 15,
};

export function processData(rawSubmissions) {
  const problemMap = new Map();
  const dailyMap = new Map();
  const langMap = new Map();
  
  // Sort submissions by timestamp once
  const sortedSubmissions = rawSubmissions.sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));

  for (const submission of sortedSubmissions) {
    const { title, titleSlug, status, lang, timestamp } = submission;
    const timestampInt = parseInt(timestamp, 10);
    const date = new Date(timestampInt * 1000);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Build problemMap (grouped by problem)
    if (!problemMap.has(titleSlug)) {
      problemMap.set(titleSlug, { title, submissions: [] });
    }
    problemMap.get(titleSlug).submissions.push({
      status: parseInt(status),
      lang,
      timestamp: timestampInt,
    });

    // Build dailyMap (grouped by date)
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, []);
    }
    dailyMap.get(dateKey).push({
      title, titleSlug, status: parseInt(status), lang, timestamp: timestampInt
    });

    // Build langMap (grouped by language)
    if (!langMap.has(lang)) {
      langMap.set(lang, []);
    }
    langMap.get(lang).push({
      title, titleSlug, status: parseInt(status), timestamp: timestampInt
    });
  }

  // Sort submissions within each problem by timestamp
  for (const problem of problemMap.values()) {
    problem.submissions.sort((a, b) => a.timestamp - b.timestamp);
  }

  return {
    problemMap,
    dailyMap,
    langMap,
    sortedSubmissions,
  };
}