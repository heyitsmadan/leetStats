import type { ProcessedData, LegacyStats, TrophyData, MilestoneData, RecordData, Difficulty, TimeRange } from '../../types';

export function getLegacyStats(
  processedData: ProcessedData,
  filters: { timeRange: TimeRange; difficulty: Difficulty }
): LegacyStats | null {
  if (!processedData.submissions.length) return null;

  // Filter submissions based on time range
  const filteredSubmissions = filterSubmissionsByTimeRange(processedData.submissions, filters.timeRange);
  if (!filteredSubmissions.length) return null;

  const trophies = calculateTrophies(processedData, filteredSubmissions);
  const milestones = calculateMilestones(filteredSubmissions);
  const records = calculateRecords(processedData, filteredSubmissions);

  return { trophies, milestones, records };
}

function filterSubmissionsByTimeRange(submissions: any[], timeRange: TimeRange) {
  if (timeRange === 'All Time') return submissions;
  
  const now = new Date();
  const cutoffDate = new Date();
  
  if (timeRange === 'Last 30 Days') {
    cutoffDate.setDate(now.getDate() - 30);
  } else if (timeRange === 'Last Year') {
    cutoffDate.setFullYear(now.getFullYear() - 1);
  }
  
  return submissions.filter(sub => sub.date >= cutoffDate);
}

function calculateTrophies(processedData: ProcessedData, submissions: any[]): TrophyData[] {
  const trophies: TrophyData[] = [];
  
  // Helper: Get problem stats
  const problemStats = new Map<string, {
    submissions: number;
    accepted: number;
    firstSubmission: Date;
    firstAccepted?: Date;
    difficulty?: string;
  }>();

  for (const sub of submissions) {
    const slug = sub.titleSlug;
    if (!problemStats.has(slug)) {
      problemStats.set(slug, {
        submissions: 0,
        accepted: 0,
        firstSubmission: sub.date,
        difficulty: sub.metadata?.difficulty
      });
    }
    
    const stats = problemStats.get(slug)!;
    stats.submissions++;
    if (sub.status === 10) { // Accepted
      stats.accepted++;
      if (!stats.firstAccepted) {
        stats.firstAccepted = sub.date;
      }
    }
  }

  // 1. Nemesis - Eventually solved with most submissions
  let maxSubmissionsForSolved = 0;
  let nemesisProblem: any = null;
  
  for (const [slug, stats] of problemStats) {
    if (stats.accepted > 0 && stats.submissions > maxSubmissionsForSolved) {
      maxSubmissionsForSolved = stats.submissions;
      nemesisProblem = { slug, stats };
    }
  }
  
  if (nemesisProblem) {
    const problemData = submissions.find(s => s.titleSlug === nemesisProblem.slug);
    trophies.push({
      id: 'nemesis',
      title: 'Nemesis',
      subtitle: `Conquered after ${nemesisProblem.stats.submissions} attempts`,
      problemTitle: problemData?.title || nemesisProblem.slug,
      problemSlug: nemesisProblem.slug,
      icon: '⚔️',
      stat: nemesisProblem.stats.submissions,
      personalNote: `...but you never gave up!`
    });
  }

  // 2. White Whale - Most submissions, never solved
  let maxSubmissionsUnsolved = 0;
  let whaleSlug = '';
  
  for (const [slug, stats] of problemStats) {
    if (stats.accepted === 0 && stats.submissions > maxSubmissionsUnsolved) {
      maxSubmissionsUnsolved = stats.submissions;
      whaleSlug = slug;
    }
  }
  
  if (whaleSlug && maxSubmissionsUnsolved > 0) {
    const problemData = submissions.find(s => s.titleSlug === whaleSlug);
    trophies.push({
      id: 'white_whale',
      title: 'White Whale',
      subtitle: `${maxSubmissionsUnsolved} attempts and counting`,
      problemTitle: problemData?.title || whaleSlug,
      problemSlug: whaleSlug,
      icon: '🐋',
      stat: maxSubmissionsUnsolved,
      personalNote: `...one day, Captain Ahab`
    });
  }

  // 3. Giant Slayer - Hard solved with fewest attempts
  let minAttemptsHard = Infinity;
  let giantSlayerProblem: any = null;
  
  for (const [slug, stats] of problemStats) {
    if (stats.accepted > 0 && stats.difficulty === 'Hard' && stats.submissions < minAttemptsHard) {
      minAttemptsHard = stats.submissions;
      giantSlayerProblem = { slug, stats };
    }
  }
  
  if (giantSlayerProblem) {
    const problemData = submissions.find(s => s.titleSlug === giantSlayerProblem.slug);
    trophies.push({
      id: 'giant_slayer',
      title: 'Giant Slayer',
      subtitle: `Hard problem solved in ${giantSlayerProblem.stats.submissions} attempt${giantSlayerProblem.stats.submissions === 1 ? '' : 's'}`,
      problemTitle: problemData?.title || giantSlayerProblem.slug,
      problemSlug: giantSlayerProblem.slug,
      icon: '🗡️',
      stat: giantSlayerProblem.stats.submissions
    });
  }

  // 4. Easy Trap - Easy with most failed attempts
  let maxFailedEasy = 0;
  let trapProblem: any = null;
  
  for (const [slug, stats] of problemStats) {
    const failed = stats.submissions - stats.accepted;
    if (stats.difficulty === 'Easy' && failed > maxFailedEasy) {
      maxFailedEasy = failed;
      trapProblem = { slug, stats };
    }
  }
  
  if (trapProblem && maxFailedEasy > 0) {
    const problemData = submissions.find(s => s.titleSlug === trapProblem.slug);
    trophies.push({
      id: 'easy_trap',
      title: 'Easy Trap',
      subtitle: `${maxFailedEasy} failed attempts on an "Easy" problem`,
      problemTitle: problemData?.title || trapProblem.slug,
      problemSlug: trapProblem.slug,
      icon: '🪤',
      stat: maxFailedEasy,
      personalNote: `...we won't tell anybody`
    });
  }

  // 5. Everest - Hard with most attempts
  let maxAttemptsHard = 0;
  let everestProblem: any = null;
  
  for (const [slug, stats] of problemStats) {
    if (stats.difficulty === 'Hard' && stats.submissions > maxAttemptsHard) {
      maxAttemptsHard = stats.submissions;
      everestProblem = { slug, stats };
    }
  }
  
  if (everestProblem) {
    const problemData = submissions.find(s => s.titleSlug === everestProblem.slug);
    trophies.push({
      id: 'everest',
      title: 'Everest',
      subtitle: `${everestProblem.stats.submissions} attempts on a Hard problem`,
      problemTitle: problemData?.title || everestProblem.slug,
      problemSlug: everestProblem.slug,
      icon: '🏔️',
      stat: everestProblem.stats.submissions
    });
  }

  // 6. First Blood - First problem solved
  const sortedSubmissions = [...submissions].sort((a, b) => a.date.getTime() - b.date.getTime());
  const firstAccepted = sortedSubmissions.find(s => s.status === 10);
  
  if (firstAccepted) {
    trophies.push({
      id: 'first_blood',
      title: 'First Blood',
      subtitle: `Your coding journey began here`,
      problemTitle: firstAccepted.title,
      problemSlug: firstAccepted.titleSlug,
      icon: '🩸',
      stat: 1
    });
  }

  // 7. The Phoenix - Biggest time gap between first submission and acceptance
  let maxTimeGap = 0;
  let phoenixProblem: any = null;
  
  for (const [slug, stats] of problemStats) {
    if (stats.accepted > 0 && stats.firstAccepted) {
      const timeGap = stats.firstAccepted.getTime() - stats.firstSubmission.getTime();
      if (timeGap > maxTimeGap) {
        maxTimeGap = timeGap;
        phoenixProblem = { slug, stats, timeGap };
      }
    }
  }
  
  if (phoenixProblem && maxTimeGap > 0) {
    const problemData = submissions.find(s => s.titleSlug === phoenixProblem.slug);
    const days = Math.floor(maxTimeGap / (1000 * 60 * 60 * 24));
    trophies.push({
      id: 'phoenix',
      title: 'The Phoenix',
      subtitle: `Rose from the ashes after ${days} days`,
      problemTitle: problemData?.title || phoenixProblem.slug,
      problemSlug: phoenixProblem.slug,
      icon: '🔥',
      stat: days,
      personalNote: `...patience paid off`
    });
  }

  return trophies;
}

function calculateMilestones(submissions: any[]): MilestoneData[] {
  const milestones: MilestoneData[] = [];
  const milestoneNumbers = [1, 10, 50, 100, 250, 500, 1000, 2000, 3000, 4000, 5000];
  
  // Sort submissions chronologically
  const sortedSubmissions = [...submissions].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Track counts
  let totalSubmissions = 0;
  let problemsSolved = new Set<string>();
  let easyCount = 0;
  let mediumCount = 0;
  let hardCount = 0;
  
  for (const sub of sortedSubmissions) {
    totalSubmissions++;
    
    // Check submission milestones
    if (milestoneNumbers.includes(totalSubmissions)) {
      milestones.push({
        type: 'submissions',
        milestone: totalSubmissions,
        date: sub.date,
        problemTitle: sub.title,
        problemSlug: sub.titleSlug
      });
    }
    
    // If accepted, track problems solved and difficulty
    if (sub.status === 10 && !problemsSolved.has(sub.titleSlug)) {
      problemsSolved.add(sub.titleSlug);
      const solvedCount = problemsSolved.size;
      
      if (milestoneNumbers.includes(solvedCount)) {
        milestones.push({
          type: 'problems_solved',
          milestone: solvedCount,
          date: sub.date,
          problemTitle: sub.title,
          problemSlug: sub.titleSlug
        });
      }
      
      // Track difficulty counts
      if (sub.metadata?.difficulty === 'Easy') {
        easyCount++;
        if (milestoneNumbers.includes(easyCount)) {
          milestones.push({
            type: 'easy',
            milestone: easyCount,
            date: sub.date,
            problemTitle: sub.title,
            problemSlug: sub.titleSlug
          });
        }
      } else if (sub.metadata?.difficulty === 'Medium') {
        mediumCount++;
        if (milestoneNumbers.includes(mediumCount)) {
          milestones.push({
            type: 'medium',
            milestone: mediumCount,
            date: sub.date,
            problemTitle: sub.title,
            problemSlug: sub.titleSlug
          });
        }
      } else if (sub.metadata?.difficulty === 'Hard') {
        hardCount++;
        if (milestoneNumbers.includes(hardCount)) {
          milestones.push({
            type: 'hard',
            milestone: hardCount,
            date: sub.date,
            problemTitle: sub.title,
            problemSlug: sub.titleSlug
          });
        }
      }
    }
  }
  
  return milestones.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function calculateRecords(processedData: ProcessedData, submissions: any[]): RecordData[] {
  const records: RecordData[] = [];
  
  // 1. Longest submission streak
  let currentStreak = 0;
  let maxStreak = 0;
  let lastDate: Date | null = null;
  
  const sortedSubmissions = [...submissions].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  for (const sub of sortedSubmissions) {
    const currentDate = new Date(sub.date.getFullYear(), sub.date.getMonth(), sub.date.getDate());
    
    if (lastDate) {
      const dayDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (dayDiff === 1) {
        currentStreak++;
      } else if (dayDiff > 1) {
        maxStreak = Math.max(maxStreak, currentStreak);
        currentStreak = 1;
      }
    } else {
      currentStreak = 1;
    }
    
    lastDate = currentDate;
  }
  maxStreak = Math.max(maxStreak, currentStreak);
  
  records.push({
    name: 'Longest Submission Streak',
    value: `${maxStreak} days`
  });
  
  // 2. Problems solved on first try
  let firstTryEasy = 0;
  let firstTryMedium = 0;
  let firstTryHard = 0;
  
  for (const [slug, subs] of processedData.problemMap) {
    if (subs.length === 1 && subs[0].status === 10) {
      const difficulty = subs[0].metadata?.difficulty;
      if (difficulty === 'Easy') firstTryEasy++;
      else if (difficulty === 'Medium') firstTryMedium++;
      else if (difficulty === 'Hard') firstTryHard++;
    }
  }
  
  records.push({
    name: 'Problems Solved First Try',
    value: firstTryEasy + firstTryMedium + firstTryHard,
    subStats: { easy: firstTryEasy, medium: firstTryMedium, hard: firstTryHard }
  });
  
  // 3. Busiest day
  const dayMap = new Map<string, number>();
  for (const sub of submissions) {
    const dateKey = sub.date.toDateString();
    dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + 1);
  }
  
  let busiestDay = '';
  let maxDaySubmissions = 0;
  for (const [date, count] of dayMap) {
    if (count > maxDaySubmissions) {
      maxDaySubmissions = count;
      busiestDay = date;
    }
  }
  
  records.push({
    name: 'Busiest Day',
    value: `${maxDaySubmissions} submissions on ${new Date(busiestDay).toLocaleDateString()}`
  });
  
  // 4. Longest break
  let maxBreak = 0;
  for (let i = 1; i < sortedSubmissions.length; i++) {
    const gap = sortedSubmissions[i].date.getTime() - sortedSubmissions[i-1].date.getTime();
    maxBreak = Math.max(maxBreak, gap);
  }
  
  const breakDays = Math.floor(maxBreak / (1000 * 60 * 60 * 24));
  records.push({
    name: 'Longest Break',
    value: `${breakDays} days`
  });
  
  // 5-8. Best periods (simplified)
  records.push(
    { name: 'Best Day', value: `${maxDaySubmissions} submissions`, isHighlight: true },
    { name: 'Best Week', value: 'Coming soon...', isHighlight: true },
    { name: 'Best Month', value: 'Coming soon...', isHighlight: true },
    { name: 'Best Year', value: 'Coming soon...', isHighlight: true }
  );
  
  return records;
}
