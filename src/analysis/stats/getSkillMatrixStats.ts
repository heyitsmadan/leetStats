import type { ProcessedData, SkillMatrixData, TimeSeriesPoint, TimeRange, ProcessedSubmission, Difficulty } from '../../types';

// Helper to check if a submission passes the time range filter.
function passesTimeRangeFilter(date: Date, timeRange: TimeRange): boolean {
  const now = new Date();
  const diffInDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  
  switch (timeRange) {
    case 'Last 30 Days': return diffInDays <= 30;
    case 'Last 90 Days': return diffInDays <= 90;
    case 'Last 365 Days': return diffInDays <= 365;
    case 'All Time': return true;
    default: return true;
  }
}

// Helper to calculate metrics from pre-grouped submissions.
function calculateMetricsFromGroups(problemGroups: Map<string, ProcessedSubmission[]>) {
    if (problemGroups.size === 0) {
        return { acceptanceRate: 0, avgTries: Infinity, firstAceRate: 0 };
    }

    // Get all submissions across all problems in this topic
    const allSubmissions = Array.from(problemGroups.values()).flat();
    const totalSubmissions = allSubmissions.length;
    
    if (totalSubmissions === 0) {
        return { acceptanceRate: 0, avgTries: Infinity, firstAceRate: 0 };
    }

    // Count accepted submissions (status === 10)
    const acceptedSubmissions = allSubmissions.filter(sub => sub.status === 10);
    const acceptedCount = acceptedSubmissions.length;

    // Calculate submission-based acceptance rate
    const acceptanceRate = (acceptedCount / totalSubmissions) * 100;

    // ✅ FIXED: Calculate submission-based average attempts
    // Formula: total submissions / accepted submissions
    const avgTries = acceptedCount > 0 ? totalSubmissions / acceptedCount : Infinity;

    // Calculate first try rate (problems solved on first attempt / total attempted problems)
    const solvedProblems = Array.from(problemGroups.values()).filter(subs => 
        subs.some(s => s.status === 10)
    );
    const firstAces = solvedProblems.filter(subs => subs.length > 0 && subs[0].status === 10).length;
    const firstAceRate = problemGroups.size > 0 ? (firstAces / problemGroups.size) * 100 : 0;

    return {
        acceptanceRate,
        avgTries,
        firstAceRate,
    };
}

// Generates cumulative time series data efficiently in a single pass.
function generateTimeSeriesForTopic(submissions: ProcessedSubmission[]) {
    if (submissions.length === 0) {
        return { acceptanceRate: [], avgTries: [], firstAceRate: [] };
    }

    const sortedSubs = submissions.sort((a, b) => a.date.getTime() - b.date.getTime());
    const metricsOverTime: { [key in 'acceptanceRate' | 'avgTries' | 'firstAceRate']: TimeSeriesPoint[] } = {
        acceptanceRate: [],
        avgTries: [],
        firstAceRate: [],
    };

    // Track cumulative data
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

        // Update cumulative counters
        cumulativeSubmissions++;
        if (sub.status === 10) cumulativeAccepted++;

        // Update problem groups
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
            // Only include data points when there's meaningful data
            if (cumulativeSubmissions >= 3) { // Minimum threshold
                const overallAcceptanceRate = (cumulativeAccepted / cumulativeSubmissions) * 100;
                
                // ✅ FIXED: Use submission-based average attempts for time series
                const overallAvgTries = cumulativeAccepted > 0 ? cumulativeSubmissions / cumulativeAccepted : Infinity;

                metricsOverTime.acceptanceRate.push({ 
                    date: currentDate, 
                    value: overallAcceptanceRate,
                    easy: getValidMetricValue(problemGroups.easy, 'acceptanceRate'),
                    medium: getValidMetricValue(problemGroups.medium, 'acceptanceRate'),
                    hard: getValidMetricValue(problemGroups.hard, 'acceptanceRate')
                });
                
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
    }

    return metricsOverTime;
}

// ✅ UPDATED: Helper function to return valid metric values or undefined
function getValidMetricValue(
    problemGroups: Map<string, ProcessedSubmission[]>, 
    metric: 'acceptanceRate' | 'avgTries' | 'firstAceRate'
): number | undefined {
    if (problemGroups.size === 0) {
        return undefined; // Don't include this difficulty in the chart yet
    }
    
    // Calculate total submissions for this difficulty
    const totalSubmissions = Array.from(problemGroups.values()).flat().length;
    
    // Require minimum data points before showing
    if (totalSubmissions < 2) {
        return undefined;
    }
    
    const metrics = calculateMetricsFromGroups(problemGroups);
    
    // ✅ FIXED: Handle infinity case for chart display
    if (metric === 'avgTries' && metrics[metric] === Infinity) {
        return undefined; // Don't show infinite values in charts
    }
    
    return metrics[metric];
}

export function getSkillMatrixStats(
    data: ProcessedData,
    filters: { timeRange: TimeRange; difficulty: Difficulty }, 
    skillMatrixTimeRange?: 'Last 30 Days' | 'Last 90 Days' | 'Last 365 Days' | 'All Time'
): SkillMatrixData | null {
    console.log('[SkillMatrix] Starting stat calculation...');
    const startTime = performance.now();

    if (!data.submissions.length) {
        console.log('[SkillMatrix] No submissions found. Aborting.');
        return null;
    }

    const effectiveTimeRange = skillMatrixTimeRange || filters.timeRange;

    // Filter submissions based on the global filters for the main table.
    const filteredSubmissions = data.submissions.filter(sub => {
        const passesTime = passesTimeRangeFilter(sub.date, effectiveTimeRange);
        const passesDiff = filters.difficulty === 'All' || sub.metadata?.difficulty === filters.difficulty;
        return passesTime && passesDiff && sub.metadata?.topics?.length;
    });
    console.log(`[SkillMatrix] Filtered down to ${filteredSubmissions.length} submissions for the table view.`);

    // Determine topics to display based on filtered results.
    const topicsSet = new Set<string>();
    filteredSubmissions.forEach(sub => sub.metadata?.topics?.forEach(topic => topicsSet.add(topic)));
    const topics = Array.from(topicsSet).sort();
    console.log(`[SkillMatrix] Found ${topics.length} topics to display.`);

    if (topics.length === 0) {
        console.log('[SkillMatrix] No topics match filters. Aborting.');
        const endTime = performance.now();
        console.log(`[SkillMatrix] Total calculation finished in ${(endTime - startTime).toFixed(2)}ms.`);
        return { topics: [], metrics: { acceptanceRate: {}, avgTries: {}, firstAceRate: {} }, timeSeriesData: {} };
    }
    
    // Pre-group FILTERED submissions by topic for time series generation
    console.log('[SkillMatrix] Pre-grouping filtered submissions by topic for time series generation...');
    const submissionsByTopic = new Map<string, ProcessedSubmission[]>();

    // Apply the same filters used for metrics to the time series data
    const filteredSubmissionsForCharts = data.submissions.filter(sub => {
        const passesTime = passesTimeRangeFilter(sub.date, effectiveTimeRange);
        const passesDiff = filters.difficulty === 'All' || sub.metadata?.difficulty === filters.difficulty;
        return passesTime && passesDiff && sub.metadata?.topics?.length;
    });

    for (const sub of filteredSubmissionsForCharts) {
        if (sub.metadata?.topics) {
            for (const topic of sub.metadata.topics) {
                if (!submissionsByTopic.has(topic)) {
                    submissionsByTopic.set(topic, []);
                }
                submissionsByTopic.get(topic)!.push(sub);
            }
        }
    }
    console.log('[SkillMatrix] Finished pre-grouping filtered submissions.');

    const metrics: SkillMatrixData['metrics'] = {
        acceptanceRate: {},
        avgTries: {},
        firstAceRate: {}
    };
    const timeSeriesData: SkillMatrixData['timeSeriesData'] = {};

    console.log('[SkillMatrix] Calculating metrics for each topic...');
    topics.forEach((topic, index) => {
        const topicStartTime = performance.now();

        // Calculate metrics for the main table
        const topicSubmissionsForTable = filteredSubmissions.filter(sub => sub.metadata?.topics?.includes(topic));
        
        const problemGroupsForTable = new Map<string, ProcessedSubmission[]>();
        topicSubmissionsForTable.forEach(sub => {
            if (!problemGroupsForTable.has(sub.titleSlug)) {
                problemGroupsForTable.set(sub.titleSlug, []);
            }
            problemGroupsForTable.get(sub.titleSlug)!.push(sub);
        });

        for (const subs of problemGroupsForTable.values()) {
            subs.sort((a, b) => a.date.getTime() - b.date.getTime());
        }

        const overallMetrics = calculateMetricsFromGroups(problemGroupsForTable);
        metrics.acceptanceRate[topic] = overallMetrics.acceptanceRate;
        metrics.avgTries[topic] = overallMetrics.avgTries;
        metrics.firstAceRate[topic] = overallMetrics.firstAceRate;

        // Generate time series for the chart
        const allTopicSubmissions = submissionsByTopic.get(topic) || [];
        timeSeriesData[topic] = generateTimeSeriesForTopic(allTopicSubmissions);
        
        const topicEndTime = performance.now();
        if (topics.length > 10) {
             if (index % Math.floor(topics.length / 5) === 0) {
                console.log(`[SkillMatrix] Processed topic ${index + 1}/${topics.length}: "${topic}"...`);
             }
        } else {
            console.log(`[SkillMatrix] Processed topic "${topic}" in ${(topicEndTime - topicStartTime).toFixed(2)}ms`);
        }
    });

    const endTime = performance.now();
    console.log(`[SkillMatrix] Total calculation finished in ${(endTime - startTime).toFixed(2)}ms.`);

    return { topics, metrics, timeSeriesData };
}
