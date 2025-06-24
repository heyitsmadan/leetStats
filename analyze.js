/**
 * analyze.js
 * A script to process and analyze LeetCode submission history.
 */

// LeetCode status codes. 10 is 'Accepted'. Others are various errors.
const STATUS_CODES = {
  ACCEPTED: 10,
  WRONG_ANSWER: 11,
  RUNTIME_ERROR: 14,
  TIME_LIMIT_EXCEEDED: 15,
  // Add other codes as you discover them
};

class LeetCodeAnalyzer {
  /**
   * Initializes the analyzer with raw submission data.
   * @param {Array<Object>} rawSubmissions - The array of submissions from submissions.json.
   */
  constructor(rawSubmissions) {
    this.processedData = this.processSubmissions(rawSubmissions);
  }

  /**
   * Transforms the flat list of submissions into a Map grouped by problem slug.
   * Submissions for each problem are sorted chronologically.
   * @param {Array<Object>} rawSubmissions - The array of submissions.
   * @returns {Map<string, {title: string, submissions: Array<Object>}>}
   */
  processSubmissions(rawSubmissions) {
    const problemMap = new Map();

    for (const submission of rawSubmissions) {
      const { title, titleSlug, status, lang, timestamp } = submission;

      // If this is the first time we see this problem, initialize its entry.
      if (!problemMap.has(titleSlug)) {
        problemMap.set(titleSlug, {
          title: title,
          submissions: [],
        });
      }

      // Add the current submission's details to the problem's submission list.
      problemMap.get(titleSlug).submissions.push({
        status: status,
        lang: lang,
        // Convert timestamp to a number for easy sorting and date operations
        timestamp: parseInt(timestamp, 10), 
      });
    }
    
    // Now, sort the submissions for each problem by timestamp (oldest first).
    for (const problem of problemMap.values()) {
        problem.submissions.sort((a, b) => a.timestamp - b.timestamp);
    }

    return problemMap;
  }

  /**
   * Analyzes the processed data to find problems solved on the first try.
   * @returns {{count: number, problems: Array<{title: string, lang: string, solvedAt: Date}>}}
   */
  getSolvedOnFirstTry() {
    const firstTryProblems = [];

    for (const [slug, data] of this.processedData.entries()) {
      const { title, submissions } = data;

      // A problem is a "first try success" if it has exactly one submission,
      // and that submission's status is 'Accepted'.
      if (submissions.length === 1 && submissions[0].status === STATUS_CODES.ACCEPTED) {
        const firstSubmission = submissions[0];
        firstTryProblems.push({
          title: title,
          titleSlug: slug,
          lang: firstSubmission.lang,
          // Convert timestamp back to a readable Date object
          solvedAt: new Date(firstSubmission.timestamp * 1000),
        });
      }
    }

    return {
      count: firstTryProblems.length,
      problems: firstTryProblems,
    };
  }
  
  // You can add more analysis functions here later!
  // e.g., getNemesisProblem(), getErrorSignature(), etc.
}

// --- USAGE EXAMPLE ---

// To use this, you would first load your JSON file.
// In a browser extension, you'd get this from the API call.
// For a local test, you might use Node.js's fs module.
const fs = require("fs");
// Assume `submissionsData` is the loaded JSON array from your file.
const submissionsData = require('./submissions.json'); // Example for Node.js
const analyzer = new LeetCodeAnalyzer(submissionsData);

//Now you can call the analysis functions.
const firstTryStats = analyzer.getSolvedOnFirstTry();

console.log(`You have solved ${firstTryStats.count} problems on the first try!`);
console.log("Here they are:");
firstTryStats.problems.forEach(p => {
  console.log(`- ${p.title} (in ${p.lang} on ${p.solvedAt.toLocaleDateString()})`);
});