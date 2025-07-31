import type { ProcessedData, Difficulty, TimeRange, CumulativeView, CumulativeChartStats } from '../../types';
import { Chart, TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { colors } from '../../ui/theme/colors';

Chart.register(TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

// Helper to generate a complete date range based on the view (Daily, Monthly, Yearly)
const generateDateRange = (startDate: Date, endDate: Date, view: CumulativeView): Date[] => {
    const dates: Date[] = [];
    let current = new Date(startDate);

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

// Main function to process data for the cumulative chart
export function getCumulativeStats(
    processedData: ProcessedData,
    filters: { timeRange: TimeRange; difficulty: Difficulty; cumulativeView: CumulativeView }
): CumulativeChartStats | null {

    const { timeRange, difficulty, cumulativeView } = filters;
    let allSubmissions = processedData.submissions;

    if (allSubmissions.length === 0) {
        return { labels: [], datasets: [] };
    }

    // Ensure submissions are sorted by date
    allSubmissions.sort((a, b) => a.date.getTime() - b.date.getTime());

    // --- Determine Chart Start and End Dates ---
    const today = new Date();
    let chartStartDate: Date;
    const chartEndDate = today; // Chart always extends to today

    const getPastDate = (days: number) => {
        const date = new Date(today);
        date.setDate(today.getDate() - days);
        date.setHours(0, 0, 0, 0);
        return date;
    };

    switch (timeRange) {
        case 'Last 30 Days':
            chartStartDate = getPastDate(30);
            break;
        case 'Last 90 Days':
            chartStartDate = getPastDate(90);
            break;
        case 'Last 365 Days':
            chartStartDate = getPastDate(365);
            break;
        case 'All Time':
        default:
            chartStartDate = new Date(allSubmissions[0].date);
            chartStartDate.setHours(0, 0, 0, 0);
            break;
    }

    // Group submissions by the chosen time view
    const groupedData = new Map<string, {
        submissions: number;
        easySolved: Set<string>;
        mediumSolved: Set<string>;
        hardSolved: Set<string>;
    }>();

    for (const sub of allSubmissions) { // Group ALL submissions to correctly calculate initial state
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

        if (sub.status === 10 && sub.metadata) {
            switch (sub.metadata.difficulty) {
                case 'Easy':
                    group.easySolved.add(sub.titleSlug);
                    break;
                case 'Medium':
                    group.mediumSolved.add(sub.titleSlug);
                    break;
                case 'Hard':
                    group.hardSolved.add(sub.titleSlug);
                    break;
            }
        }
    }

    // Normalize the start date for the range generator
    let normalizedChartStartDate = new Date(chartStartDate);
    if (cumulativeView === 'Monthly') {
        normalizedChartStartDate.setDate(1);
    } else if (cumulativeView === 'Yearly') {
        normalizedChartStartDate.setDate(1);
        normalizedChartStartDate.setMonth(0);
    }

    const allDatesInRange = generateDateRange(normalizedChartStartDate, chartEndDate, cumulativeView);

    // Calculate cumulative values *before* the chart's start date to begin the lines correctly
    const submissionsBeforeStart = allSubmissions.filter(sub => sub.date < normalizedChartStartDate);
    let cumulativeSubmissions = submissionsBeforeStart.length;
    const solvedEasy = new Set<string>(submissionsBeforeStart.filter(s => s.status === 10 && s.metadata?.difficulty === 'Easy').map(s => s.titleSlug));
    const solvedMedium = new Set<string>(submissionsBeforeStart.filter(s => s.status === 10 && s.metadata?.difficulty === 'Medium').map(s => s.titleSlug));
    const solvedHard = new Set<string>(submissionsBeforeStart.filter(s => s.status === 10 && s.metadata?.difficulty === 'Hard').map(s => s.titleSlug));

    const labels: string[] = [];
    const totalSubmissionsData: number[] = [];
    const easyData: number[] = [];
    const mediumData: number[] = [];
    const hardData: number[] = [];

    for (const date of allDatesInRange) {
        const key = date.toISOString();
        const group = groupedData.get(key);

        if (group && date >= normalizedChartStartDate) {
            cumulativeSubmissions += group.submissions;
            group.easySolved.forEach(slug => solvedEasy.add(slug));
            group.mediumSolved.forEach(slug => solvedMedium.add(slug));
            group.hardSolved.forEach(slug => solvedHard.add(slug));
        }

        labels.push(date.toISOString());
        totalSubmissionsData.push(cumulativeSubmissions);
        easyData.push(solvedEasy.size);
        mediumData.push(solvedMedium.size);
        hardData.push(solvedHard.size);
    }

    const datasets = [{
        label: 'Total Submissions',
        data: totalSubmissionsData,
        borderColor: colors.background.empty,
        fill: false,
        tension: 0.4,
    }];

    if (difficulty === 'All' || difficulty === 'Easy') {
        datasets.push({ label: 'Easy Solved', data: easyData, borderColor: colors.problems.easy, fill: false, tension: 0.4 });
    }
    if (difficulty === 'All' || difficulty === 'Medium') {
        datasets.push({ label: 'Medium Solved', data: mediumData, borderColor: colors.problems.medium, fill: false, tension: 0.4 });
    }
    if (difficulty === 'All' || difficulty === 'Hard') {
        datasets.push({ label: 'Hard Solved', data: hardData, borderColor: colors.problems.hard, fill: false, tension: 0.4 });
    }

    return { labels, datasets };
}