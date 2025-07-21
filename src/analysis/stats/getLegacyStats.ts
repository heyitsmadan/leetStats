import type { ProcessedData, LegacyStats, TrophyData, MilestoneData, RecordData, ProcessedSubmission, Difficulty, TimeRange } from '../../types';

/**
 * Main function to calculate all legacy stats.
 * REFACTOR: Sorts all submissions by date once at the top level to avoid 
 * repetitive sorting in the various helper functions.
 */
export function getLegacyStats(processedData: ProcessedData): LegacyStats | null {
  // Always use ALL submissions for legacy stats, ignore filters
  const allSubmissions = processedData.submissions;
  
  if (!allSubmissions.length) return null;

  // Sort all submissions by date once to be passed to helper functions.
  const sortedSubmissions = [...allSubmissions].sort((a, b) => a.date.getTime() - b.date.getTime());

  const trophies = calculateTrophies(processedData, sortedSubmissions);
  const milestones = calculateMilestones(sortedSubmissions);
  const records = calculateRecords(processedData, sortedSubmissions);

  return { trophies, milestones, records };
}

// Helper function for pluralization (unchanged).
function pluralize(count: number, singular: string, plural?: string): string {
  const pluralForm = plural || singular + 's';
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Calculates user trophies.
 * REFACTOR: Uses the pre-grouped `problemMap` from `processedData` to derive problem statistics,
 * avoiding a redundant iteration and grouping of all submissions. It also uses the pre-sorted
 * list of submissions for the 'First Blood' trophy.
 */
function calculateTrophies(processedData: ProcessedData, sortedSubmissions: ProcessedSubmission[]): TrophyData[] {
  const trophies: TrophyData[] = [];
  
  // Use the pre-grouped `problemMap` to build problem-specific stats.
  const problemStats = new Map<string, {
    submissions: number;
    accepted: number;
    firstSubmission: Date;
    firstAccepted?: Date;
    difficulty?: string;
    allSubmissions: ProcessedSubmission[];
  }>();

  for (const [slug, subs] of processedData.problemMap) {
    // It's assumed subs in problemMap are already sorted chronologically.
    const firstAcceptedSub = subs.find(sub => sub.status === 10);
    const acceptedCount = firstAcceptedSub ? subs.filter(sub => sub.status === 10).length : 0;

    problemStats.set(slug, {
      allSubmissions: subs,
      submissions: subs.length,
      accepted: acceptedCount,
      firstSubmission: subs[0].date,
      firstAccepted: firstAcceptedSub?.date,
      difficulty: subs[0].metadata?.difficulty,
    });
  }

  // 1. First Blood - First problem solved (uses pre-sorted list).
  const firstAccepted = sortedSubmissions.find(s => s.status === 10);
  
  if (firstAccepted) {
    trophies.push({
      id: 'first_blood',
      title: 'First Blood',
      subtitle: 'Your very first solved problem',
      problemTitle: firstAccepted.title,
      problemSlug: firstAccepted.titleSlug,
      icon: '🩸',
      stat: 1,
      personalNote: `...oh, my sweet summer child`
    });
  }

  // 2. Easy Trap - Easy with most failed attempts.
  let maxFailedEasy = 0;
  let trapProblem: any = null;
  
  for (const [slug, stats] of problemStats) {
    const failed = stats.submissions - stats.accepted;
    if (stats.difficulty === 'Easy' && failed > maxFailedEasy) {
      maxFailedEasy = failed;
      trapProblem = { slug, title: stats.allSubmissions[0].title };
    }
  }
  
  if (trapProblem && maxFailedEasy > 0) {
    trophies.push({
      id: 'easy_trap',
      title: 'Easy Trap',
      subtitle: `${pluralize(maxFailedEasy, 'failed attempt')} on an "Easy" problem`,
      problemTitle: trapProblem.title || trapProblem.slug,
      problemSlug: trapProblem.slug,
      icon: '🪤',
      stat: maxFailedEasy,
      personalNote: `...we won't tell anybody`
    });
  }

  // 3. White Whale - Most submissions, never solved.
  let maxSubmissionsUnsolved = 0;
  let whaleProblem: any = null;
  
  for (const [slug, stats] of problemStats) {
    if (stats.accepted === 0 && stats.submissions > maxSubmissionsUnsolved) {
      maxSubmissionsUnsolved = stats.submissions;
      whaleProblem = { slug, title: stats.allSubmissions[0].title };
    }
  }
  
  if (whaleProblem && maxSubmissionsUnsolved > 0) {
    trophies.push({
      id: 'white_whale',
      title: 'White Whale',
      subtitle: `${pluralize(maxSubmissionsUnsolved, 'attempt')} and counting`,
      problemTitle: whaleProblem.title || whaleProblem.slug,
      problemSlug: whaleProblem.slug,
      icon: '🐋',
      stat: maxSubmissionsUnsolved,
      personalNote: `...one day, Captain Ahab`
    });
  }

  // 4. Nemesis - Eventually solved with most failed submissions.
  let maxFailedSubmissions = 0;
  let nemesisProblem: any = null;

  for (const [slug, stats] of problemStats) {
    const failedSubmissions = stats.submissions - stats.accepted;
    if (stats.accepted > 0 && failedSubmissions > maxFailedSubmissions) {
      maxFailedSubmissions = failedSubmissions;
      nemesisProblem = { slug, failedSubmissions, title: stats.allSubmissions[0].title };
    }
  }

  if (nemesisProblem) {
    trophies.push({
      id: 'nemesis',
      title: 'Nemesis',
      subtitle: `Conquered after ${pluralize(nemesisProblem.failedSubmissions, 'failed attempt')}`,
      problemTitle: nemesisProblem.title || nemesisProblem.slug,
      problemSlug: nemesisProblem.slug,
      icon: '⚔️',
      stat: nemesisProblem.failedSubmissions,
      personalNote: `...there were tears`
    });
  }

  // 5. The Phoenix - Biggest time gap between first submission and acceptance.
  let maxTimeGap = 0;
  let phoenixProblem: any = null;
  
  for (const [slug, stats] of problemStats) {
    if (stats.accepted > 0 && stats.firstAccepted) {
      const timeGap = stats.firstAccepted.getTime() - stats.firstSubmission.getTime();
      if (timeGap > maxTimeGap && timeGap > 0) {
        maxTimeGap = timeGap;
        phoenixProblem = { slug, title: stats.allSubmissions[0].title };
      }
    }
  }
  
  if (phoenixProblem && maxTimeGap > 0) {
    const days = Math.floor(maxTimeGap / (1000 * 60 * 60 * 24));
    
    if (days > 0) {
      trophies.push({
        id: 'phoenix',
        title: 'The Phoenix',
        subtitle: `Rose from the ashes after ${pluralize(days, 'day')}`,
        problemTitle: phoenixProblem.title || phoenixProblem.slug,
        problemSlug: phoenixProblem.slug,
        icon: '🔥',
        stat: days,
        personalNote: `...we are so back`
      });
    }
  }

  return trophies;
}


/**
 * Calculates user milestones.
 * REFACTOR: Uses the pre-sorted submissions array and removes the redundant final sort,
 * as milestones are generated in chronological order.
 */
function calculateMilestones(sortedSubmissions: ProcessedSubmission[]): MilestoneData[] {
  const milestones: MilestoneData[] = [];
  const milestoneNumbers = [1, 10, 50, 100, 500, 1000, 2000, 3000, 4000, 5000];
  
  let totalSubmissions = 0;
  let problemsSolved = new Set<string>();
  let easyCount = 0;
  let mediumCount = 0;
  let hardCount = 0;
  
  for (const sub of sortedSubmissions) {
    totalSubmissions++;
    
    if (milestoneNumbers.includes(totalSubmissions)) {
      milestones.push({
        type: 'submissions',
        milestone: totalSubmissions,
        date: sub.date,
        problemTitle: sub.title,
        problemSlug: sub.titleSlug,
        submissionId: sub.id
      });
    }
    
    if (sub.status === 10 && !problemsSolved.has(sub.titleSlug)) {
      problemsSolved.add(sub.titleSlug);
      const solvedCount = problemsSolved.size;
      
      if (milestoneNumbers.includes(solvedCount)) {
        milestones.push({
          type: 'problems_solved',
          milestone: solvedCount,
          date: sub.date,
          problemTitle: sub.title,
          problemSlug: sub.titleSlug,
          submissionId: sub.id
        });
      }
      
      if (sub.metadata?.difficulty === 'Easy') {
        easyCount++;
        if (milestoneNumbers.includes(easyCount)) {
          milestones.push({ type: 'easy', milestone: easyCount, date: sub.date, problemTitle: sub.title, problemSlug: sub.titleSlug, submissionId: sub.id });
        }
      } else if (sub.metadata?.difficulty === 'Medium') {
        mediumCount++;
        if (milestoneNumbers.includes(mediumCount)) {
          milestones.push({ type: 'medium', milestone: mediumCount, date: sub.date, problemTitle: sub.title, problemSlug: sub.titleSlug, submissionId: sub.id });
        }
      } else if (sub.metadata?.difficulty === 'Hard') {
        hardCount++;
        if (milestoneNumbers.includes(hardCount)) {
          milestones.push({ type: 'hard', milestone: hardCount, date: sub.date, problemTitle: sub.title, problemSlug: sub.titleSlug, submissionId: sub.id });
        }
      }
    }
  }
  
  return milestones;
}

/**
 * Calculates user records.
 * REFACTOR: Passes the pre-sorted submissions array to its helper functions.
 */
function calculateRecords(processedData: ProcessedData, sortedSubmissions: any[]): RecordData[] {
  const records: RecordData[] = [];
  
  // 1. Problems solved on first try (logic is correct and uses problemMap).
  let firstTryEasy = 0;
  let firstTryMedium = 0;
  let firstTryHard = 0;
  
  for (const [slug, subs] of processedData.problemMap) {
    if (subs[0].status === 10) {
      const difficulty = subs[0].metadata?.difficulty;
      if (difficulty === 'Easy') firstTryEasy++;
      else if (difficulty === 'Medium') firstTryMedium++;
      else if (difficulty === 'Hard') firstTryHard++;
    }
  }
  
  records.push({
    name: 'One Shot Solves',
    value: firstTryEasy + firstTryMedium + firstTryHard,
    subStats: { easy: firstTryEasy, medium: firstTryMedium, hard: firstTryHard }
  });
  
  // 2. Longest submission streak (uses pre-sorted submissions).
  const streakData = calculateLongestStreak(sortedSubmissions);
  records.push({
    name: 'Longest Streak',
    mainStat: pluralize(streakData.length, 'day'),
    dateStat: `ending on ${formatDate(streakData.endDate)}`
  });
  
  // 3. Longest break (uses pre-sorted submissions).
  const breakData = calculateLongestBreak(sortedSubmissions);
  records.push({
    name: 'Longest Break',
    mainStat: `${formatDuration(breakData.days)}`,
    dateStat: `${formatDate(breakData.startDate)} - ${formatDate(breakData.endDate)}`
  });
  
  // 4. Busiest day.
  const dayMap = new Map<string, number>();
  for (const sub of sortedSubmissions) {
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
    mainStat: pluralize(maxDaySubmissions, 'submission'),
    dateStat: `on ${formatDate(new Date(busiestDay))}`
  });
  
  // 5-7. Best periods.
  const bestPeriods = calculateBestPeriods(sortedSubmissions);
  
  records.push(
    { name: 'Best Day', mainStat: `${pluralize(bestPeriods.bestDay.count, 'problem')} solved`, dateStat: `on ${formatDate(bestPeriods.bestDay.date)}`},
    { name: 'Best Month', mainStat: `${pluralize(bestPeriods.bestMonth.count, 'problem')} solved`, dateStat: `in ${formatMonthYear(bestPeriods.bestMonth.date)}`},
    { name: 'Best Year', mainStat: `${pluralize(bestPeriods.bestYear.count, 'problem')} solved`, dateStat: `in ${bestPeriods.bestYear.date.getFullYear()}`}
  );
  
  return records;
}


// Helper function to format date as day/month/year (unchanged).
function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Helper function to format month/year (unchanged).
function formatMonthYear(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Helper to calculate longest submission streak.
 * REFACTOR: Uses the pre-sorted submissions array.
 */
function calculateLongestStreak(sortedSubmissions: any[]): { length: number; endDate: Date } {
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

/**
 * Helper to calculate longest break.
 * REFACTOR: Uses the pre-sorted submissions array.
 */
function calculateLongestBreak(sortedSubmissions: any[]): { days: number; startDate: Date; endDate: Date } {
  if (sortedSubmissions.length < 2) {
    return { days: 0, startDate: new Date(), endDate: new Date() };
  }

  let maxBreak = 0;
  let maxBreakStart: Date = sortedSubmissions[0].date;
  let maxBreakEnd: Date = sortedSubmissions[0].date;
  
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

// Helper to calculate best periods (unchanged).
function calculateBestPeriods(submissions: any[]) {
  const acceptedSubs = submissions.filter(sub => sub.status === 10);
  
  const dayMap = new Map<string, Set<string>>();
  const monthMap = new Map<string, Set<string>>();
  const yearMap = new Map<string, Set<string>>();

  acceptedSubs.forEach(sub => {
    const date = sub.date;
    const dayKey = date.toISOString().split('T')[0];
    const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
    const yearKey = `${date.getFullYear()}`;

    if (!dayMap.has(dayKey)) dayMap.set(dayKey, new Set());
    dayMap.get(dayKey)!.add(sub.titleSlug);

    if (!monthMap.has(monthKey)) monthMap.set(monthKey, new Set());
    monthMap.get(monthKey)!.add(sub.titleSlug);

    if (!yearMap.has(yearKey)) yearMap.set(yearKey, new Set());
    yearMap.get(yearKey)!.add(sub.titleSlug);
  });

  let bestDay = { count: 0, date: new Date() };
  dayMap.forEach((set, dayKey) => {
    if (set.size > bestDay.count) {
      bestDay = { count: set.size, date: new Date(dayKey) };
    }
  });

  let bestMonth = { count: 0, date: new Date() };
  monthMap.forEach((set, monthKey) => {
    if (set.size > bestMonth.count) {
      const [year, month] = monthKey.split('-').map(Number);
      bestMonth = { count: set.size, date: new Date(year, month - 1, 1) };
    }
  });

  let bestYear = { count: 0, date: new Date() };
  yearMap.forEach((set, yearKey) => {
    if (set.size > bestYear.count) {
      bestYear = { count: set.size, date: new Date(parseInt(yearKey), 0, 1) };
    }
  });

  return { bestDay, bestMonth, bestYear };
}

// Helper function to format duration (unchanged).
function formatDuration(days: number): string {
  if (days < 30) {
    return pluralize(days, 'day');
  }
  
  const years = Math.floor(days / 365);
  const remainingAfterYears = days % 365;
  const months = Math.floor(remainingAfterYears / 30);
  const remainingDays = remainingAfterYears % 30;
  
  let result = '';
  if (years > 0) {
    result += pluralize(years, 'year');
  }
  if (months > 0) {
    if (result) result += ' ';
    result += pluralize(months, 'month');
  }
  if (remainingDays > 0 && years === 0) {
    if (result) result += ' ';
    result += pluralize(remainingDays, 'day');
  }
  
  return result;
}