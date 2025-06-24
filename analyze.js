const STATUS_CODES = {
  ACCEPTED: 10,
  WRONG_ANSWER: 11,
  RUNTIME_ERROR: 14,
  TIME_LIMIT_EXCEEDED: 15,
};

class LeetCodeAnalyzer {
  constructor(rawSubmissions) {
    this.processedData = this.processSubmissions(rawSubmissions);
  }

  processSubmissions(rawSubmissions) {
    const problemMap = new Map();
    for (const submission of rawSubmissions) {
      const { title, titleSlug, status, lang, timestamp } = submission;
      if (!problemMap.has(titleSlug)) {
        problemMap.set(titleSlug, { title, submissions: [] });
      }
      problemMap.get(titleSlug).submissions.push({
        status,
        lang,
        timestamp: parseInt(timestamp, 10),
      });
    }
    for (const problem of problemMap.values()) {
      problem.submissions.sort((a, b) => a.timestamp - b.timestamp);
    }
    return problemMap;
  }

  getSolvedOnFirstTry() {
    const firstTryProblems = [];
    for (const [slug, data] of this.processedData.entries()) {
      const { title, submissions } = data;
      if (submissions.length === 1 && submissions[0].status === STATUS_CODES.ACCEPTED) {
        const firstSubmission = submissions[0];
        firstTryProblems.push({
          title, titleSlug: slug, lang: firstSubmission.lang,
          solvedAt: new Date(firstSubmission.timestamp * 1000),
        });
      }
    }
    return { count: firstTryProblems.length, problems: firstTryProblems };
  }

  // In your LeetCodeAnalyzer class...

  getCodingClockStats() {
    const buckets = {
      "Early Bird (4AM–9AM)": 0,
      "9-to-5 Coder (9AM–5PM)": 0,
      "Evening Coder (5PM–10PM)": 0,
      "Night Owl (10PM–4AM)": 0,
    };
    for (const { submissions } of this.processedData.values()) {
      for (const { timestamp } of submissions) {
        // This correctly uses the user's local browser timezone
        const date = new Date(timestamp * 1000); 
        const hour = date.getHours(); // Use getHours() for local time

        if (hour >= 4 && hour < 9) buckets["Early Bird (4AM–9AM)"]++;
        else if (hour >= 9 && hour < 17) buckets["9-to-5 Coder (9AM–5PM)"]++;
        else if (hour >= 17 && hour < 22) buckets["Evening Coder (5PM–10PM)"]++;
        else buckets["Night Owl (10PM–4AM)"]++;
      }
    }
    // Note: The console.log calls are removed from here so the UI script can control the output
    return buckets;
  }

  getRageQuitProblem() {
    let rageProblem = null, maxFails = 0;
    for (const [slug, data] of this.processedData.entries()) {
      const { title, submissions } = data;
      if (submissions.some(sub => sub.status === STATUS_CODES.ACCEPTED)) continue;
      const failCount = submissions.length;
      if (failCount > maxFails) {
        maxFails = failCount;
        rageProblem = { title, failCount };
      }
    }
    if (rageProblem) {
      console.log(`💥 Rage Quit Detected! You tried '${rageProblem.title}' ${rageProblem.failCount} times... and never solved it.\n`);
    } else {
      console.log("🎉 No Rage Quits found — you've always eventually succeeded!");
    }
    return rageProblem;
  }

  getNemesisProblem() {
    let nemesis = null, maxAttempts = 0;
    for (const [slug, data] of this.processedData.entries()) {
      const { title, submissions } = data;
      if (!submissions.some(sub => sub.status === STATUS_CODES.ACCEPTED)) continue;
      const attemptCount = submissions.length;
      if (attemptCount > maxAttempts) {
        maxAttempts = attemptCount;
        nemesis = { title, attemptCount };
      }
    }
    if (nemesis) {
      console.log(`😤 Nemesis Conquered: '${nemesis.title}' took ${nemesis.attemptCount} attempts to solve\n`);
    } else {
      console.log("🔎 No Nemesis found — maybe you haven’t struggled long enough? 😅");
    }
    return nemesis;
  }
}

// Make available globally
window.LeetCodeAnalyzer = LeetCodeAnalyzer;
