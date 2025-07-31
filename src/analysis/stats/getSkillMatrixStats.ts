import type { ProcessedData, SkillMatrixData, TimeSeriesPoint, TimeRange, ProcessedSubmission, Difficulty } from '../../types';

/**
 * Calculates metrics from pre-grouped submissions for a specific topic.
 * @param problemGroups A map where keys are problem slugs and values are arrays of submissions for that problem.
 * @returns An object containing the calculated metrics.
 */
function calculateMetricsFromGroups(problemGroups: Map<string, ProcessedSubmission[]>) {
  if (problemGroups.size === 0) {
    return { problemsSolved: 0, avgTries: Infinity, firstAceRate: 0 };
  }

  const allSubmissions = Array.from(problemGroups.values()).flat();
  const totalSubmissions = allSubmissions.length;

  if (totalSubmissions === 0) {
    return { problemsSolved: 0, avgTries: Infinity, firstAceRate: 0 };
  }

  const acceptedSubmissions = allSubmissions.filter(sub => sub.status === 10);
  const acceptedCount = acceptedSubmissions.length;

  const problemsSolved = Array.from(problemGroups.values()).filter(subs => subs.some(s => s.status === 10)).length;

  const avgTries = acceptedCount > 0 ? totalSubmissions / acceptedCount : Infinity;

  const solvedProblems = Array.from(problemGroups.values()).filter(subs =>
    subs.some(s => s.status === 10)
  );
  const firstAces = solvedProblems.filter(subs => subs.length > 0 && subs[0].status === 10).length;
  const firstAceRate = problemGroups.size > 0 ? (firstAces / problemGroups.size) * 100 : 0;

  return {
    problemsSolved,
    avgTries,
    firstAceRate,
  };
}

/**
 * Generates time series data for a specific topic's metrics over time.
 * @param submissions An array of all submissions for a specific topic.
 * @returns An object containing arrays of time series points for each metric.
 */
function generateTimeSeriesForTopic(submissions: ProcessedSubmission[]) {
  if (submissions.length === 0) {
    return { problemsSolved: [], avgTries: [], firstAceRate: [] };
  }

  const sortedSubs = submissions.sort((a, b) => a.date.getTime() - b.date.getTime());
  const metricsOverTime: { [key in 'problemsSolved' | 'avgTries' | 'firstAceRate']: TimeSeriesPoint[] } = {
    problemsSolved: [],
    avgTries: [],
    firstAceRate: [],
  };

  let cumulativeSubmissions = 0;
  let cumulativeAccepted = 0;
  const problemGroups = {
    overall: new Map<string, ProcessedSubmission[]>(),
    easy: new Map<string, ProcessedSubmission[]>(),
    medium: new Map<string, ProcessedSubmission[]>(),
    hard: new Map<string, ProcessedSubmission[]>(),
  };

  for (let i = 0; i < sortedSubs.length; i++) {
    const sub = sortedSubs[i];
    const slug = sub.titleSlug;
    const difficulty = sub.metadata?.difficulty;

    cumulativeSubmissions++;
    if (sub.status === 10) {
      cumulativeAccepted++;
    }

    if (!problemGroups.overall.has(slug)) problemGroups.overall.set(slug, []);
    problemGroups.overall.get(slug)!.push(sub);

    if (difficulty === 'Easy') {
      if (!problemGroups.easy.has(slug)) problemGroups.easy.set(slug, []);
      problemGroups.easy.get(slug)!.push(sub);
    } else if (difficulty === 'Medium') {
      if (!problemGroups.medium.has(slug)) problemGroups.medium.set(slug, []);
      problemGroups.medium.get(slug)!.push(sub);
    } else if (difficulty === 'Hard') {
      if (!problemGroups.hard.has(slug)) problemGroups.hard.set(slug, []);
      problemGroups.hard.get(slug)!.push(sub);
    }

    const currentDate = sub.date.toISOString().split('T')[0];
    const nextDate = (i + 1 < sortedSubs.length) ? sortedSubs[i + 1].date.toISOString().split('T')[0] : null;

    if (currentDate !== nextDate) {
      const overallProblemsSolved = Array.from(problemGroups.overall.values())
        .filter(subs => subs.some(s => s.status === 10)).length;

      metricsOverTime.problemsSolved.push({
        date: currentDate,
        value: overallProblemsSolved,
        easy: getValidMetricValue(problemGroups.easy, 'problemsSolved'),
        medium: getValidMetricValue(problemGroups.medium, 'problemsSolved'),
        hard: getValidMetricValue(problemGroups.hard, 'problemsSolved')
      });

      const overallAvgTries = cumulativeAccepted > 0 ? cumulativeSubmissions / cumulativeAccepted : Infinity;
      metricsOverTime.avgTries.push({
        date: currentDate,
        value: overallAvgTries,
        easy: getValidMetricValue(problemGroups.easy, 'avgTries'),
        medium: getValidMetricValue(problemGroups.medium, 'avgTries'),
        hard: getValidMetricValue(problemGroups.hard, 'avgTries')
      });

      const overallMetrics = calculateMetricsFromGroups(problemGroups.overall);
      metricsOverTime.firstAceRate.push({
        date: currentDate,
        value: overallMetrics.firstAceRate,
        easy: getValidMetricValue(problemGroups.easy, 'firstAceRate'),
        medium: getValidMetricValue(problemGroups.medium, 'firstAceRate'),
        hard: getValidMetricValue(problemGroups.hard, 'firstAceRate')
      });
    }
  }

  return metricsOverTime;
}

/**
 * Gets a valid metric value, returning undefined if the metric is not applicable (e.g., size is 0 or avgTries is Infinity).
 * @param problemGroups A map of problems to their submissions.
 * @param metric The name of the metric to calculate.
 * @returns The calculated metric value or undefined.
 */
function getValidMetricValue(
  problemGroups: Map<string, ProcessedSubmission[]>,
  metric: 'problemsSolved' | 'avgTries' | 'firstAceRate'
): number | undefined {
  if (problemGroups.size === 0) {
    return undefined;
  }

  const metrics = calculateMetricsFromGroups(problemGroups);

  if (metric === 'avgTries' && metrics[metric] === Infinity) {
    return undefined;
  }

  return metrics[metric];
}

/**
 * Calculates all statistics for the skill matrix view.
 * @param data The main processed data object.
 * @param filters An object containing the current filter settings.
 * @param skillMatrixTimeRange Optional override for the time range filter.
 * @returns A SkillMatrixData object or null if no data is available.
 */
export function getSkillMatrixStats(
  data: ProcessedData,
  filters: { timeRange: TimeRange; difficulty: Difficulty },
  skillMatrixTimeRange?: 'Last 30 Days' | 'Last 90 Days' | 'Last 365 Days' | 'All Time'
): SkillMatrixData | null {
  if (!data.submissions.length) {
    return null;
  }

  const effectiveTimeRange = skillMatrixTimeRange || filters.timeRange;
  const timeRangeStart = getTimeRangeStart(effectiveTimeRange);

  // Filter submissions for the main table metrics based on the selected time range and difficulty
  const tableSubmissions = data.submissions.filter(sub => {
    const passesTime = sub.date >= timeRangeStart;
    const passesDiff = filters.difficulty === 'All' || sub.metadata?.difficulty === filters.difficulty;
    return passesTime && passesDiff && sub.metadata?.topics?.length;
  });

  // Filter submissions for the time series charts (all time, filtered by difficulty)
  const chartSubmissions = data.submissions.filter(sub => {
    const passesDiff = filters.difficulty === 'All' || sub.metadata?.difficulty === filters.difficulty;
    return passesDiff && sub.metadata?.topics?.length;
  });

  // Determine the set of unique topics from the filtered table submissions
  const topicsSet = new Set<string>();
  tableSubmissions.forEach(sub =>
    sub.metadata?.topics?.forEach(topic => topicsSet.add(topic))
  );
  const unsortedTopics = Array.from(topicsSet);

  // Pre-group all chart submissions by topic for efficient time series generation
  const submissionsByTopic = new Map<string, ProcessedSubmission[]>();
  for (const sub of chartSubmissions) {
    if (sub.metadata?.topics) {
      for (const topic of sub.metadata.topics) {
        if (!submissionsByTopic.has(topic)) {
          submissionsByTopic.set(topic, []);
        }
        submissionsByTopic.get(topic)!.push(sub);
      }
    }
  }

  const metrics: SkillMatrixData['metrics'] = {
    problemsSolved: {},
    avgTries: {},
    firstAceRate: {}
  };

  const timeSeriesData: SkillMatrixData['timeSeriesData'] = {};

  // Calculate table metrics for each topic within the selected time range
  unsortedTopics.forEach((topic) => {
    const topicSubmissions = tableSubmissions.filter(
      sub => sub.metadata?.topics?.includes(topic)
    );

    const problemGroups = new Map<string, ProcessedSubmission[]>();
    topicSubmissions.forEach(sub => {
      if (!problemGroups.has(sub.titleSlug)) {
        problemGroups.set(sub.titleSlug, []);
      }
      problemGroups.get(sub.titleSlug)!.push(sub);
    });

    for (const subs of problemGroups.values()) {
      subs.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    const solvedProblems = Array.from(problemGroups.values()).filter(
      subs => subs.some(s => s.status === 10)
    );

    metrics.problemsSolved[topic] = solvedProblems.length;

    const totalSubmissions = topicSubmissions.length;
    const acceptedSubmissions = topicSubmissions.filter(s => s.status === 10).length;
    metrics.avgTries[topic] = acceptedSubmissions > 0 ? totalSubmissions / acceptedSubmissions : Infinity;

    const firstAces = solvedProblems.filter(subs =>
      subs.length > 0 && subs[0].status === 10
    ).length;
    metrics.firstAceRate[topic] = solvedProblems.length > 0 ? (firstAces / solvedProblems.length) * 100 : 0;
  });

  // Generate time series chart data for each topic (cumulative over all time)
  unsortedTopics.forEach(topic => {
    const allTopicSubmissions = submissionsByTopic.get(topic) || [];
    timeSeriesData[topic] = generateTimeSeriesForTopic(allTopicSubmissions);
  });

  // Sort topics by the number of problems solved in descending order
  const topics = unsortedTopics.sort((a, b) =>
    (metrics.problemsSolved[b] || 0) - (metrics.problemsSolved[a] || 0)
  );

  return {
    topics,
    metrics,
    timeSeriesData,
    timeRangeStart: timeRangeStart.toISOString()
  };
}

/**
 * Calculates the start date for a given time range filter.
 * @param timeRange The time range string.
 * @returns The calculated start date.
 */
function getTimeRangeStart(timeRange: TimeRange): Date {
  const now = new Date();
  switch (timeRange) {
    case 'Last 30 Days':
      return new Date(now.setDate(now.getDate() - 30));
    case 'Last 90 Days':
      return new Date(now.setDate(now.getDate() - 90));
    case 'Last 365 Days':
      return new Date(now.setDate(now.getDate() - 365));
    default: // All Time
      return new Date(0);
  }
}