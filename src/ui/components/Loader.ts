// src/ui/components/Loader.ts
import { colors } from '../theme/colors';

export class FetchLoader {
    private loaderElement: HTMLElement | null = null;
    private progressTextElement: HTMLElement | null = null;
    private progressBarFillElement: HTMLElement | null = null;
    private progressBarWrapper: HTMLElement | null = null;
    private firstTimeMessageElement: HTMLElement | null = null;

    constructor() {
        this.injectStyles();
        this.create();
    }

    /**
     * Injects a stylesheet into the document head to handle dynamic theme switching
     * for the loader component. This is done only once.
     */
    private injectStyles(): void {
        if (document.getElementById('leetstats-loader-styles')) {
            return;
        }

        const styleSheet = document.createElement('style');
        styleSheet.id = 'leetstats-loader-styles';
        // Define CSS variables for light and dark themes.
        // The .dark class on a parent element (e.g., <html>) will trigger the dark theme styles.
        styleSheet.textContent = `
            :root {
                --loader-bg: #FFFFFF;
                --loader-text-primary: rgb(26, 26, 26);
                --loader-text-subtle: rgb(118, 118, 118);
                --loader-border: rgb(229, 229, 229);
                --loader-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
                --loader-progress-bg: rgb(235, 235, 235);
                --loader-progress-fill: ${colors.status.accepted};
            }

            .dark {
                --loader-bg: #282828;
                --loader-text-primary: rgb(239, 239, 239);
                --loader-text-subtle: rgb(169, 169, 169);
                --loader-border: rgb(80, 80, 80);
                --loader-shadow: 0 5px 15px rgba(0, 0, 0, 0.4);
                --loader-progress-bg: rgb(60, 60, 60);
            }

            #leetstats-loader {
                background-color: var(--loader-bg);
                color: var(--loader-text-primary);
                border: 1px solid var(--loader-border);
                box-shadow: var(--loader-shadow);
                transition: transform 0.4s ease-in-out, background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
            }
            
            #leetstats-loader-text,
            #leetstats-loader-first-time-message {
                color: var(--loader-text-subtle);
                transition: color 0.3s ease;
            }

            #leetstats-loader-progress-wrapper {
                background-color: var(--loader-progress-bg);
                transition: background-color 0.3s ease;
            }

            #leetstats-loader-fill {
                background-color: var(--loader-progress-fill);
            }
        `;
        document.head.appendChild(styleSheet);
    }

    /**
     * Helper function for pluralization.
     */
    private pluralize(count: number, singular: string, plural?: string): string {
        const pluralForm = plural || `${singular}s`;
        return `${count} ${count === 1 ? singular : pluralForm}`;
    }

    /**
     * Creates the loader's DOM elements.
     */
    private create(): void {
        this.loaderElement = document.createElement('div');
        this.loaderElement.id = 'leetstats-loader';
        
        Object.assign(this.loaderElement.style, {
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            width: '300px',
            borderRadius: '12px',
            zIndex: '10000',
            padding: '16px',
            fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'`,
            fontSize: '14px',
            transform: 'translateY(200%)',
        });

        this.progressTextElement = document.createElement('div');
        this.progressTextElement.id = 'leetstats-loader-text';
        this.progressTextElement.textContent = 'Fetching submissions...';
        this.progressTextElement.style.marginBottom = '10px';

        this.progressBarWrapper = document.createElement('div');
        this.progressBarWrapper.id = 'leetstats-loader-progress-wrapper';
        Object.assign(this.progressBarWrapper.style, {
            height: '8px',
            width: '100%',
            borderRadius: '4px',
            overflow: 'hidden',
        });

        this.progressBarFillElement = document.createElement('div');
        this.progressBarFillElement.id = 'leetstats-loader-fill';
        Object.assign(this.progressBarFillElement.style, {
            height: '100%',
            width: '0%',
            borderRadius: '4px',
            transition: 'width 0.3s ease',
        });

        this.firstTimeMessageElement = document.createElement('div');
        this.firstTimeMessageElement.id = 'leetstats-loader-first-time-message';
        this.firstTimeMessageElement.textContent = "initial load is slow; future ones are much faster";
        Object.assign(this.firstTimeMessageElement.style, {
            textAlign: 'right',
            marginTop: '8px',
            fontSize: '11px',
            fontStyle: 'italic',
            display: 'none',
        });

        this.progressBarWrapper.appendChild(this.progressBarFillElement);
        this.loaderElement.appendChild(this.progressTextElement);
        this.loaderElement.appendChild(this.progressBarWrapper);
        this.loaderElement.appendChild(this.firstTimeMessageElement);
    }

    /**
     * Appends the loader to the DOM and animates it into view.
     */
    public show(): void {
        if (!this.loaderElement) return;

        if (this.progressBarWrapper) {
            this.progressBarWrapper.style.display = 'block';
        }
        if (this.progressTextElement) {
            this.progressTextElement.style.marginBottom = '10px';
        }
        if (this.firstTimeMessageElement) {
            this.firstTimeMessageElement.style.display = 'block';
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
     * @param acceptedFetched The total number of accepted submissions fetched so far.
     * @param totalAccepted The grand total of accepted submissions for progress calculation.
     */
    public update(totalFetched: number, acceptedFetched: number, totalAccepted: number): void {
        if (!this.progressTextElement || !this.progressBarFillElement) return;

        this.progressTextElement.textContent = `Fetched ${this.pluralize(totalFetched, 'submission')}...`;

        const progress = totalAccepted > 0 ? Math.min((acceptedFetched / totalAccepted) * 100, 99) : 0;
        this.progressBarFillElement.style.width = `${progress}%`;
    }

    /**
     * Sets the bar to 100% and then animates the loader out of view.
     */
    public complete(): void {
        if (!this.progressBarFillElement || !this.loaderElement) return;

        // Animate out after 1 second to let user see completion.
        setTimeout(() => {
            if (this.loaderElement) {
                if (this.firstTimeMessageElement) {
                    this.firstTimeMessageElement.style.display = 'none';
                }
                this.loaderElement.style.transform = 'translateY(200%)';
                setTimeout(() => this.loaderElement?.remove(), 500);
            }
        }, 1000);

        this.progressBarFillElement.style.width = '100%';

        // Animate out after 0.5 seconds (this will run before the 1s timeout).
        setTimeout(() => {
            if (this.loaderElement) {
                this.loaderElement.style.transform = 'translateY(200%)';
                setTimeout(() => this.loaderElement?.remove(), 500);
            }
        }, 500);
    }

    /**
     * Displays an error message and then hides the loader.
     * @param errorMessage The error message to show.
     */
    public error(errorMessage: string): void {
        if (!this.progressTextElement || !this.progressBarWrapper || !this.loaderElement) return;
        
        if (this.firstTimeMessageElement) {
            this.firstTimeMessageElement.style.display = 'none';
        }

        this.progressTextElement.textContent = errorMessage;
        this.progressBarWrapper.style.display = 'none';
        this.progressTextElement.style.marginBottom = '0';

        setTimeout(() => {
             if (this.loaderElement) {
                this.loaderElement.style.transform = 'translateY(200%)';
                setTimeout(() => this.loaderElement?.remove(), 500);
            }
        }, 3000);
    }
}