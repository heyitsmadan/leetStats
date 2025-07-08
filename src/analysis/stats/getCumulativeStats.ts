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

// Helper to generate complete date range
const generateDateRange = (startDate: Date, endDate: Date, view: CumulativeView): Date[] => {
    const dates: Date[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
        dates.push(new Date(current));
        
        if (view === 'Daily') {
            current.setDate(current.getDate() + 1);
        } else if (view === 'Monthly') {
            current.setMonth(current.getMonth() + 1);
        } else { // Yearly
            current.setFullYear(current.getFullYear() + 1);
        }
    }
    
    return dates;
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

    // 2. Determine date range for complete timeline
    const submissionDates = filteredSubmissions.map(sub => sub.date);
    const minDate = new Date(Math.min(...submissionDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...submissionDates.map(d => d.getTime())));

    // Normalize dates based on view
    let startDate: Date, endDate: Date;
    if (cumulativeView === 'Daily') {
        startDate = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
        endDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
    } else if (cumulativeView === 'Monthly') {
        startDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        endDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    } else { // Yearly
        startDate = new Date(minDate.getFullYear(), 0, 1);
        endDate = new Date(maxDate.getFullYear(), 0, 1);
    }

    // 3. Group submissions by the selected view
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

    // 4. Generate complete date range and fill missing data points
    const allDates = generateDateRange(startDate, endDate, cumulativeView);
    
    const labels: string[] = [];
    const totalSubmissionsData: number[] = [];
    const easyData: number[] = [];
    const mediumData: number[] = [];
    const hardData: number[] = [];

    let cumulativeSubmissions = 0;
    const solvedEasy = new Set<string>();
    const solvedMedium = new Set<string>();
    const solvedHard = new Set<string>();

    for (const date of allDates) {
        const key = date.toISOString();
        const group = groupedData.get(key);

        if (group) {
            // Data exists for this date
            cumulativeSubmissions += group.submissions;
            group.easySolved.forEach(slug => solvedEasy.add(slug));
            group.mediumSolved.forEach(slug => solvedMedium.add(slug));
            group.hardSolved.forEach(slug => solvedHard.add(slug));
        }
        // If no data exists, cumulative values remain the same

        labels.push(formatDate(date, cumulativeView));
        totalSubmissionsData.push(cumulativeSubmissions);
        easyData.push(solvedEasy.size);
        mediumData.push(solvedMedium.size);
        hardData.push(solvedHard.size);
    }

    // 5. Format for Chart.js with updated colors and conditional datasets
const datasets = [
    {
        label: 'Total Submissions',
        data: totalSubmissionsData,
        borderColor: '#393939',
        fill: false,
        tension: 0.4,
    }
];

// Only add difficulty-specific datasets if difficulty is 'All' or matches the specific difficulty
if (difficulty === 'All') {
    datasets.push(
        {
            label: 'Easy Solved',
            data: easyData,
            borderColor: '#58b8b9',
            fill: false,
            tension: 0.4,
        },
        {
            label: 'Medium Solved',
            data: mediumData,
            borderColor: '#f4ba40',
            fill: false,
            tension: 0.4,
        },
        {
            label: 'Hard Solved',
            data: hardData,
            borderColor: '#e24a41',
            fill: false,
            tension: 0.4,
        }
    );
} else if (difficulty === 'Easy') {
    datasets.push({
        label: 'Easy Solved',
        data: easyData,
        borderColor: '#58b8b9',
        fill: false,
        tension: 0.4,
    });
} else if (difficulty === 'Medium') {
    datasets.push({
        label: 'Medium Solved',
        data: mediumData,
        borderColor: '#f4ba40',
        fill: false,
        tension: 0.4,
    });
} else if (difficulty === 'Hard') {
    datasets.push({
        label: 'Hard Solved',
        data: hardData,
        borderColor: '#e24a41',
        fill: false,
        tension: 0.4,
    });
}

return {
    labels,
    datasets
};

}
