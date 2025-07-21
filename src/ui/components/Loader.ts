// src/ui/components/Loader.ts
import { colors } from '../theme/colors';

export class FetchLoader {
    private loaderElement: HTMLElement | null = null;
    private progressTextElement: HTMLElement | null = null;
    private progressBarFillElement: HTMLElement | null = null;
    private progressBarWrapper: HTMLElement | null = null;

    constructor() {
        this.create();
    }

    /**
     * Helper function for pluralization.
     */
    private pluralize(count: number, singular: string, plural?: string): string {
        const pluralForm = plural || singular + 's';
        return `${count} ${count === 1 ? singular : pluralForm}`;
    }

    /**
     * Creates the loader's DOM elements and applies LeetCode-like styles.
     */
    private create() {
        this.loaderElement = document.createElement('div');
        this.loaderElement.id = 'leetstats-loader';
        
        Object.assign(this.loaderElement.style, {
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            width: '280px',
            backgroundColor: colors.background.section,
            color: colors.text.primary,
            borderRadius: '8px',
            zIndex: '10000',
            padding: '12px 16px',
            fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'`,
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            transform: 'translateY(200%)', // Start off-screen
            transition: 'transform 0.4s ease-in-out',
            border: `1px solid ${colors.background.secondarySection}`,
        });

        this.progressTextElement = document.createElement('div');
        this.progressTextElement.id = 'leetstats-loader-text';
        this.progressTextElement.textContent = 'Fetching submissions...';
        Object.assign(this.progressTextElement.style, {
            marginBottom: '8px',
            color: colors.text.subtle,
        });

        this.progressBarWrapper = document.createElement('div');
        Object.assign(this.progressBarWrapper.style, {
            height: '6px',
            width: '100%',
            backgroundColor: colors.background.empty,
            borderRadius: '3px',
            overflow: 'hidden',
        });

        this.progressBarFillElement = document.createElement('div');
        this.progressBarFillElement.id = 'leetstats-loader-fill';
        Object.assign(this.progressBarFillElement.style, {
            height: '100%',
            width: '0%',
            backgroundColor: colors.status.accepted,
            borderRadius: '3px',
            transition: 'width 0.3s ease',
        });

        this.progressBarWrapper.appendChild(this.progressBarFillElement);
        this.loaderElement.appendChild(this.progressTextElement);
        this.loaderElement.appendChild(this.progressBarWrapper);
    }

    /**
     * Appends the loader to the DOM and animates it into view.
     */
    public show() {
        if (!this.loaderElement) return;

        // Ensure the progress bar is visible when the loader is shown.
        if (this.progressBarWrapper) {
            this.progressBarWrapper.style.display = 'block';
        }
        if (this.progressTextElement) {
            this.progressTextElement.style.marginBottom = '8px';
        }

        document.body.appendChild(this.loaderElement);
        requestAnimationFrame(() => {
            if (this.loaderElement) {
                this.loaderElement.style.transform = 'translateY(0)';
            }
        });
    }

    /**
     * Updates the progress text and bar width.
     * @param totalFetched The total number of all submissions fetched so far.
     * @param acceptedFetched The total number of accepted submissions fetched so far for the progress bar.
     * @param totalAccepted The grand total of accepted submissions for progress bar calculation.
     */
    public update(totalFetched: number, acceptedFetched: number, totalAccepted: number) {
        if (!this.progressTextElement || !this.progressBarFillElement) return;

        this.progressTextElement.textContent = `Fetched ${this.pluralize(totalFetched, 'submission')}...`;

        const progress = totalAccepted > 0 ? Math.min((acceptedFetched / totalAccepted) * 100, 99) : 0;
        this.progressBarFillElement.style.width = `${progress}%`;
    }

    /**
     * Sets the bar to 100% and then animates the loader out of view without a final message.
     */
    public complete() {
        if (!this.progressBarFillElement || !this.loaderElement) return;

        this.progressBarFillElement.style.width = '100%';

        setTimeout(() => {
            if (this.loaderElement) {
                this.loaderElement.style.transform = 'translateY(200%)';
                setTimeout(() => this.loaderElement?.remove(), 500);
            }
        }, 500);
    }

    /**
     * Displays an error message and then hides the loader, without the progress bar.
     * @param errorMessage The error message to show.
     */
    public error(errorMessage: string) {
        if (!this.progressTextElement || !this.progressBarWrapper || !this.loaderElement) return;
        
        this.progressTextElement.textContent = errorMessage;
        
        // Hide the progress bar wrapper entirely.
        this.progressBarWrapper.style.display = 'none';
        
        // Remove the bottom margin from the text to vertically center it.
        this.progressTextElement.style.marginBottom = '0';

        setTimeout(() => {
             if (this.loaderElement) {
                this.loaderElement.style.transform = 'translateY(200%)';
                setTimeout(() => this.loaderElement?.remove(), 500);
            }
        }, 3000); // Keep the message visible for 3 seconds.
    }
}