import type { ProcessedData, LegacyStats, TrophyData, MilestoneData, RecordData, Difficulty, TimeRange } from '../../types';

export function getLegacyStats(processedData: ProcessedData): LegacyStats | null {
  // Always use ALL submissions for legacy stats, ignore filters
  const allSubmissions = processedData.submissions;
  
  if (!allSubmissions.length) return null;

  const trophies = calculateTrophies(processedData, allSubmissions);
  const milestones = calculateMilestones(allSubmissions);
  const records = calculateRecords(processedData, allSubmissions);

  return { trophies, milestones, records };
}

// Remove the filterSubmissionsByTimeRange function completely
// Remove any references to filters in the helper functions


function calculateTrophies(processedData: ProcessedData, submissions: any[]): TrophyData[] {
  const trophies: TrophyData[] = [];
  
  // Helper: Get problem stats with proper chronological tracking
  const problemStats = new Map<string, {
    submissions: number;
    accepted: number;
    firstSubmission: Date;
    firstAccepted?: Date;
    difficulty?: string;
    allSubmissions: any[]; // Keep track of all submissions for this problem
  }>();

  // First pass: collect all submissions per problem
  for (const sub of submissions) {
    const slug = sub.titleSlug;
    if (!problemStats.has(slug)) {
      problemStats.set(slug, {
        submissions: 0,
        accepted: 0,
        firstSubmission: sub.date,
        difficulty: sub.metadata?.difficulty,
        allSubmissions: []
      });
    }
    const stats = problemStats.get(slug)!;
    stats.allSubmissions.push(sub);
  }

  // Second pass: process each problem's submissions chronologically
  for (const [slug, stats] of problemStats) {
    // Sort submissions for this problem chronologically
    stats.allSubmissions.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    stats.submissions = stats.allSubmissions.length;
    stats.firstSubmission = stats.allSubmissions[0].date;
    
    // Find first accepted submission
    const firstAcceptedSub = stats.allSubmissions.find(sub => sub.status === 10);
    if (firstAcceptedSub) {
      stats.accepted = stats.allSubmissions.filter(sub => sub.status === 10).length;
      stats.firstAccepted = firstAcceptedSub.date;
    }
  }

  // Rest of the trophy calculations remain the same until Phoenix...
  
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

  // 7. The Phoenix - FIXED: Biggest time gap between first submission and acceptance
  let maxTimeGap = 0;
  let phoenixProblem: any = null;
  
  for (const [slug, stats] of problemStats) {
    if (stats.accepted > 0 && stats.firstAccepted) {
      const timeGap = stats.firstAccepted.getTime() - stats.firstSubmission.getTime();
      // Only consider it if there was actually a gap (not solved on first try)
      if (timeGap > maxTimeGap && timeGap > 0) {
        maxTimeGap = timeGap;
        phoenixProblem = { slug, stats, timeGap };
      }
    }
  }
  
  if (phoenixProblem && maxTimeGap > 0) {
    const problemData = submissions.find(s => s.titleSlug === phoenixProblem.slug);
    const days = Math.floor(maxTimeGap / (1000 * 60 * 60 * 24));
    
    // Only show if it's at least 1 day gap
    if (days > 0) {
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
  }

  return trophies;
}


function calculateMilestones(submissions: any[]): MilestoneData[] {
  const milestones: MilestoneData[] = [];
  const milestoneNumbers = [1, 10, 50, 100, 500, 1000, 2000, 3000, 4000, 5000];
  
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
  
  // 1. Longest submission streak with ending date
  const streakData = calculateLongestStreak(submissions);
  records.push({
    name: 'Longest Submission Streak',
    value: `${streakData.length} days ending on ${formatDate(streakData.endDate)}`
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
    value: `${maxDaySubmissions} submissions on ${formatDate(new Date(busiestDay))}`
  });
  
  // 4. Longest break with start and end dates
  const breakData = calculateLongestBreak(submissions);
  records.push({
    name: 'Longest Break',
    value: `${formatDuration(breakData.days)} (${formatDate(breakData.startDate)} - ${formatDate(breakData.endDate)})`
  });
  
  // 5-7. Best periods - calculate unique problems solved (removed best week)
  const bestPeriods = calculateBestPeriods(submissions);
  
  records.push(
    { name: 'Best Day', value: `${bestPeriods.bestDay.count} problems solved on ${formatDate(bestPeriods.bestDay.date)}`, isHighlight: true },
    { name: 'Best Month', value: `${bestPeriods.bestMonth.count} problems solved in ${formatMonthYear(bestPeriods.bestMonth.date)}`, isHighlight: true },
    { name: 'Best Year', value: `${bestPeriods.bestYear.count} problems solved in ${bestPeriods.bestYear.date.getFullYear()}`, isHighlight: true }
  );
  
  return records;
}

// Helper function to format date as day/month/year
function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Helper function to format month/year
function formatMonthYear(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

// Helper function to calculate longest submission streak
function calculateLongestStreak(submissions: any[]): { length: number; endDate: Date } {
  const sortedSubmissions = [...submissions].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  let currentStreak = 0;
  let maxStreak = 0;
  let lastDate: Date | null = null;
  let maxStreakEndDate: Date = new Date();
  let currentStreakEndDate: Date = new Date();
  
  for (const sub of sortedSubmissions) {
    const currentDate = new Date(sub.date.getFullYear(), sub.date.getMonth(), sub.date.getDate());
    
    if (lastDate) {
      const dayDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (dayDiff === 1) {
        currentStreak++;
        currentStreakEndDate = currentDate;
      } else if (dayDiff > 1) {
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
          maxStreakEndDate = currentStreakEndDate;
        }
        currentStreak = 1;
        currentStreakEndDate = currentDate;
      }
    } else {
      currentStreak = 1;
      currentStreakEndDate = currentDate;
    }
    
    lastDate = currentDate;
  }
  
  if (currentStreak > maxStreak) {
    maxStreak = currentStreak;
    maxStreakEndDate = currentStreakEndDate;
  }
  
  return { length: maxStreak, endDate: maxStreakEndDate };
}

// Helper function to calculate longest break
function calculateLongestBreak(submissions: any[]): { days: number; startDate: Date; endDate: Date } {
  const sortedSubmissions = [...submissions].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  let maxBreak = 0;
  let maxBreakStart: Date = new Date();
  let maxBreakEnd: Date = new Date();
  
  for (let i = 1; i < sortedSubmissions.length; i++) {
    const gap = sortedSubmissions[i].date.getTime() - sortedSubmissions[i-1].date.getTime();
    if (gap > maxBreak) {
      maxBreak = gap;
      maxBreakStart = sortedSubmissions[i-1].date;
      maxBreakEnd = sortedSubmissions[i].date;
    }
  }
  
  const breakDays = Math.floor(maxBreak / (1000 * 60 * 60 * 24));
  return { days: breakDays, startDate: maxBreakStart, endDate: maxBreakEnd };
}

// Updated best periods calculation (removed week)
function calculateBestPeriods(sortedSubmissions: any[]) {
  const countProblemsInPeriod = (startDate: Date, endDate: Date): number => {
    const solvedProblems = new Set<string>();
    for (const sub of sortedSubmissions) {
      if (sub.date >= startDate && sub.date <= endDate && sub.status === 10) {
        solvedProblems.add(sub.titleSlug);
      }
    }
    return solvedProblems.size;
  };
  
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneMonth = 30 * oneDay;
  const oneYear = 365 * oneDay;
  
  // Calculate best day
  let bestDay = { count: 0, date: new Date() };
  for (let i = 0; i < 365; i++) {
    const day = new Date(now.getTime() - i * oneDay);
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
    const count = countProblemsInPeriod(dayStart, dayEnd);
    if (count > bestDay.count) {
      bestDay = { count, date: dayStart };
    }
  }
  
  // Calculate best month
  let bestMonth = { count: 0, date: new Date() };
  for (let i = 0; i < 365; i++) {
    const start = new Date(now.getTime() - i * oneDay);
    const end = new Date(start.getTime() + oneMonth - 1);
    const count = countProblemsInPeriod(start, end);
    if (count > bestMonth.count) {
      bestMonth = { count, date: start };
    }
  }
  
  // Calculate best year
  let bestYear = { count: 0, date: new Date() };
  for (let i = 0; i < 365; i++) {
    const start = new Date(now.getTime() - i * oneDay);
    const end = new Date(start.getTime() + oneYear - 1);
    const count = countProblemsInPeriod(start, end);
    if (count > bestYear.count) {
      bestYear = { count, date: start };
    }
  }
  
  return { bestDay, bestMonth, bestYear };
}




// Helper function to format duration
function formatDuration(days: number): string {
  if (days < 30) {
    return `${days} days`;
  }
  
  const years = Math.floor(days / 365);
  const remainingAfterYears = days % 365;
  const months = Math.floor(remainingAfterYears / 30);
  const remainingDays = remainingAfterYears % 30;
  
  let result = '';
  if (years > 0) {
    result += `${years} year${years > 1 ? 's' : ''}`;
  }
  if (months > 0) {
    if (result) result += ' ';
    result += `${months} month${months > 1 ? 's' : ''}`;
  }
  if (remainingDays > 0 && years === 0) {
    if (result) result += ' ';
    result += `${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
  }
  
  return result;
}