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
        return { acceptanceRate: 0, avgTries: 0, firstAceRate: 0 };
    }

    const solvedProblems = Array.from(problemGroups.values()).filter(subs => 
        subs.some(s => s.status === 10)
    );
    
    const totalTriesForSolved = solvedProblems.reduce((sum, subs) => sum + subs.length, 0);

    const firstAces = solvedProblems.filter(subs => subs.length > 0 && subs[0].status === 10).length;

    return {
        acceptanceRate: problemGroups.size > 0 ? (solvedProblems.length / problemGroups.size) * 100 : 0,
        avgTries: solvedProblems.length > 0 ? totalTriesForSolved / solvedProblems.length : 0,
        firstAceRate: solvedProblems.length > 0 ? (firstAces / solvedProblems.length) * 100 : 0,
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
            const overallMetrics = calculateMetricsFromGroups(problemGroups.overall);
            const easyMetrics = calculateMetricsFromGroups(problemGroups.easy);
            const mediumMetrics = calculateMetricsFromGroups(problemGroups.medium);
            const hardMetrics = calculateMetricsFromGroups(problemGroups.hard);

            metricsOverTime.acceptanceRate.push({ date: currentDate, value: overallMetrics.acceptanceRate, easy: easyMetrics.acceptanceRate, medium: mediumMetrics.acceptanceRate, hard: hardMetrics.acceptanceRate });
            metricsOverTime.avgTries.push({ date: currentDate, value: overallMetrics.avgTries, easy: easyMetrics.avgTries, medium: mediumMetrics.avgTries, hard: hardMetrics.avgTries });
            metricsOverTime.firstAceRate.push({ date: currentDate, value: overallMetrics.firstAceRate, easy: easyMetrics.firstAceRate, medium: mediumMetrics.firstAceRate, hard: hardMetrics.firstAceRate });
        }
    }

    return metricsOverTime;
}


export function getSkillMatrixStats(
    data: ProcessedData,
    filters: { timeRange: TimeRange; difficulty: Difficulty }
): SkillMatrixData | null {
    console.log('[SkillMatrix] Starting stat calculation...');
    const startTime = performance.now();

    if (!data.submissions.length) {
        console.log('[SkillMatrix] No submissions found. Aborting.');
        return null;
    }

    // Filter submissions based on the global filters for the main table.
    const filteredSubmissions = data.submissions.filter(sub => {
        const passesTime = passesTimeRangeFilter(sub.date, filters.timeRange);
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
    
    // ====================================================================================
    // OPTIMIZATION: Pre-group all submissions by topic ONCE.
    // This avoids repeatedly filtering the entire submission list inside the loop below.
    // ====================================================================================
    console.log('[SkillMatrix] Pre-grouping all submissions by topic for time series generation...');
    const submissionsByTopic = new Map<string, ProcessedSubmission[]>();
    for (const sub of data.submissions) {
        if (sub.metadata?.topics) {
            for (const topic of sub.metadata.topics) {
                if (!submissionsByTopic.has(topic)) {
                    submissionsByTopic.set(topic, []);
                }
                submissionsByTopic.get(topic)!.push(sub);
            }
        }
    }
    console.log('[SkillMatrix] Finished pre-grouping.');


    const metrics: SkillMatrixData['metrics'] = {
        acceptanceRate: {},
        avgTries: {},
        firstAceRate: {}
    };
    const timeSeriesData: SkillMatrixData['timeSeriesData'] = {};

    console.log('[SkillMatrix] Calculating metrics for each topic...');
    topics.forEach((topic, index) => {
        const topicStartTime = performance.now();

        // --- 1. Calculate metrics for the main table (using pre-filtered submissions) ---
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

        // --- 2. Generate time series for the chart (using all submissions for the topic) ---
        // This is now much faster as we just retrieve the pre-grouped array.
        const allTopicSubmissions = submissionsByTopic.get(topic) || [];
        timeSeriesData[topic] = generateTimeSeriesForTopic(allTopicSubmissions);
        
        const topicEndTime = performance.now();
        if (topics.length > 10) { // Only log per-topic time if there are many, to avoid spamming the console
             if (index % Math.floor(topics.length / 5) === 0) { // Log progress periodically
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
