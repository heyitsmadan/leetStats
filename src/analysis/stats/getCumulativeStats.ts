// src/analysis/stats/getCumulativeStats.ts

import type { ProcessedData, Difficulty, TimeRange, CumulativeView, CumulativeChartStats } from '../../types';
import { Chart,
    TimeScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

// Helper to format date based on view
const formatDate = (date: Date, view: CumulativeView): string => {
    if (view === 'Daily') return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (view === 'Monthly') return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
    return date.toLocaleDateString(undefined, { year: 'numeric' });
};

export function getCumulativeStats(
    processedData: ProcessedData,
    filters: { timeRange: TimeRange; difficulty: Difficulty; cumulativeView: CumulativeView }
): CumulativeChartStats {

    const { timeRange, difficulty, cumulativeView } = filters;
    const { submissions } = processedData;

    // 1. Filter submissions based on TimeRange and Difficulty
    const now = new Date();
    const filteredSubmissions = submissions.filter(sub => {
    const submissionDate = sub.date;
    let inTimeRange = false;

    const getPastDate = (days: number) => {
        const date = new Date(now);
        date.setDate(now.getDate() - days);
        return date;
    };

    switch (timeRange) {
        case 'All Time':
            inTimeRange = true;
            break;
        case 'Last 30 Days':
            inTimeRange = submissionDate >= getPastDate(30);
            break;
        case 'Last 90 Days':
            inTimeRange = submissionDate >= getPastDate(90);
            break;
        case 'Last 365 Days':
            inTimeRange = submissionDate >= getPastDate(365);
            break;
    }

    const inDifficulty = difficulty === 'All' || sub.metadata?.difficulty === difficulty;

    return inTimeRange && inDifficulty;
});


    if (filteredSubmissions.length === 0) {
        return { labels: [], datasets: [] };
    }

    // 2. Group submissions by the selected view (Daily, Monthly, Yearly)
    const groupedData = new Map<string, {
        submissions: number;
        easySolved: Set<string>;
        mediumSolved: Set<string>;
        hardSolved: Set<string>;
    }>();

    for (const sub of filteredSubmissions) {
        let key: string;
        const date = sub.date;

        if (cumulativeView === 'Daily') {
            key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
        } else if (cumulativeView === 'Monthly') {
            key = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
        } else { // Yearly
            key = new Date(date.getFullYear(), 0, 1).toISOString();
        }

        if (!groupedData.has(key)) {
            groupedData.set(key, { submissions: 0, easySolved: new Set(), mediumSolved: new Set(), hardSolved: new Set() });
        }

        const group = groupedData.get(key)!;
        group.submissions += 1;

        if (sub.status == 10 && sub.metadata) {
            switch (sub.metadata.difficulty) {
                case 'Easy': group.easySolved.add(sub.titleSlug); break;
                case 'Medium': group.mediumSolved.add(sub.titleSlug); break;
                case 'Hard': group.hardSolved.add(sub.titleSlug); break;
            }
        }
    }

    // 3. Create cumulative data points from sorted groups
    const sortedKeys = Array.from(groupedData.keys()).sort();

    const labels: string[] = [];
    const totalSubmissionsData: number[] = [];
    const easyData: number[] = [];
    const mediumData: number[] = [];
    const hardData: number[] = [];

    let cumulativeSubmissions = 0;
    const solvedEasy = new Set<string>();
    const solvedMedium = new Set<string>();
    const solvedHard = new Set<string>();

    for (const key of sortedKeys) {
        const group = groupedData.get(key)!;
        const date = new Date(key);

        cumulativeSubmissions += group.submissions;

        group.easySolved.forEach(slug => solvedEasy.add(slug));
        group.mediumSolved.forEach(slug => solvedMedium.add(slug));
        group.hardSolved.forEach(slug => solvedHard.add(slug));

        labels.push(formatDate(date, cumulativeView));
        totalSubmissionsData.push(cumulativeSubmissions);
        easyData.push(solvedEasy.size);
        mediumData.push(solvedMedium.size);
        hardData.push(solvedHard.size);
    }

    // 4. Format for Chart.js
    return {
        labels,
        datasets: [
            {
                label: 'Total Submissions',
                data: totalSubmissionsData,
                borderColor: '#808080', // Grey
                fill: false,
                tension: 0.4,
            },
            {
                label: 'Easy Solved',
                data: easyData,
                borderColor: 'rgb(75, 192, 192)', // LC Green
                fill: false,
                tension: 0.4,
            },
            {
                label: 'Medium Solved',
                data: mediumData,
                borderColor: 'rgb(255, 159, 64)', // LC Yellow
                fill: false,
                tension: 0.4,
            },
            {
                label: 'Hard Solved',
                data: hardData,
                borderColor: 'rgb(255, 99, 132)', // LC Red
                fill: false,
                tension: 0.4,
            },
        ]
    };
}