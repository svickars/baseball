import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Get today's date in user's local timezone (YYYY-MM-DD format)
export function getTodayLocalDate(): string {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, '0');
	const day = String(today.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

// Format date using native JavaScript (much faster than date-fns-tz)
export function formatDate(dateString: string): string {
	try {
		// Parse the date string as local date (YYYY-MM-DD format)
		const [year, month, day] = dateString.split('-').map(Number);
		const date = new Date(year, month - 1, day); // month is 0-indexed

		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	} catch (error) {
		return dateString;
	}
}

// Format time using native JavaScript (much faster than date-fns-tz)
export function formatTime(dateString: string): string {
	try {
		const date = new Date(dateString);
		return date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true,
		});
	} catch (error) {
		return dateString;
	}
}

// Format date in user's timezone with custom format using native JavaScript
export function formatDateInTimezone(dateString: string, formatString: string): string {
	try {
		// Parse the date string as local date (YYYY-MM-DD format)
		const [year, month, day] = dateString.split('-').map(Number);
		const date = new Date(year, month - 1, day); // month is 0-indexed

		// Handle common format patterns
		if (formatString === 'EEEE, MMM d') {
			return date.toLocaleDateString('en-US', {
				weekday: 'long',
				month: 'short',
				day: 'numeric',
			});
		}

		if (formatString === "EEE, MMM d, 'yy") {
			return date.toLocaleDateString('en-US', {
				weekday: 'short',
				month: 'short',
				day: 'numeric',
				year: '2-digit',
			});
		}

		// Fallback to basic formatting
		return date.toLocaleDateString('en-US');
	} catch (error) {
		return dateString;
	}
}

export function getStatusColor(status: string): string {
	const statusLower = status.toLowerCase();

	if (statusLower.includes('final') || statusLower.includes('completed')) {
		return 'bg-success-100 text-success-800';
	}

	if (statusLower.includes('live') || statusLower.includes('in progress')) {
		return 'bg-warning-100 text-warning-800';
	}

	if (statusLower.includes('scheduled') || statusLower.includes('preview')) {
		return 'bg-primary-100 text-primary-800';
	}

	return 'bg-secondary-100 text-secondary-800';
}

// New utility functions that use MLB API status data more reliably
export function getGameStatusFromMLB(mlbStatus: { detailedState?: string; codedGameState?: string }): {
	status: 'live' | 'final' | 'upcoming' | 'postponed' | 'suspended' | 'unknown';
	displayText: string;
} {
	const detailedState = mlbStatus.detailedState?.toLowerCase() || '';
	const codedState = mlbStatus.codedGameState || '';

	// Use codedGameState as primary source for more reliable status
	// But also consider detailedState for disambiguation
	switch (codedState) {
		case 'I': // In Progress
			return { status: 'live', displayText: 'LIVE' };
		case 'F': // Final
			return { status: 'final', displayText: 'FINAL' };
		case 'S': // Scheduled
			return { status: 'upcoming', displayText: 'UPCOMING' };
		case 'D': // Delayed
			return { status: 'upcoming', displayText: 'DELAYED' };
		case 'P': // P can be Pre-Game or Postponed - use detailedState to disambiguate
			if (detailedState.includes('pre-game') || detailedState.includes('pre game')) {
				return { status: 'upcoming', displayText: 'UPCOMING' };
			} else if (detailedState.includes('postponed')) {
				return { status: 'postponed', displayText: 'POSTPONED' };
			} else {
				// Default to upcoming for P status
				return { status: 'upcoming', displayText: 'UPCOMING' };
			}
		case 'U': // Suspended
			return { status: 'suspended', displayText: 'SUSPENDED' };
		case 'C': // Cancelled
			return { status: 'postponed', displayText: 'CANCELLED' };
		case 'O': // Other
			return { status: 'unknown', displayText: 'OTHER' };
		case 'W': // Warmup
			return { status: 'upcoming', displayText: 'WARMUP' };
		case 'G': // Game Over
			return { status: 'final', displayText: 'FINAL' };
		default:
			// Fallback to detailedState if codedGameState is not available
			if (
				detailedState.includes('in progress') ||
				detailedState.includes('live') ||
				detailedState.includes('in_progress')
			) {
				return { status: 'live', displayText: 'LIVE' };
			}
			if (
				detailedState.includes('final') ||
				detailedState.includes('completed') ||
				detailedState.includes('game over') ||
				detailedState.includes('ended')
			) {
				return { status: 'final', displayText: 'FINAL' };
			}
			if (
				detailedState.includes('scheduled') ||
				detailedState.includes('preview') ||
				detailedState.includes('pre-game') ||
				detailedState.includes('pre game')
			) {
				return { status: 'upcoming', displayText: 'UPCOMING' };
			}
			if (
				detailedState.includes('postponed') ||
				detailedState.includes('cancelled') ||
				detailedState.includes('canceled')
			) {
				return { status: 'postponed', displayText: 'POSTPONED' };
			}
			if (detailedState.includes('suspended')) {
				return { status: 'suspended', displayText: 'SUSPENDED' };
			}
			// If we still don't have a match, log the unknown status for debugging
			console.warn('Unknown game status:', { codedState, detailedState });
			return { status: 'unknown', displayText: 'UNKNOWN' };
	}
}

export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout;
	return (...args: Parameters<T>) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
}

export function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void {
	let inThrottle: boolean;
	return (...args: Parameters<T>) => {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), limit);
		}
	};
}
