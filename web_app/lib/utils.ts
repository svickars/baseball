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

export function isGameLive(game: {
	status: string;
	is_live?: boolean;
	start_time?: string;
	away_score?: number;
	home_score?: number;
}): boolean {
	const statusLower = game.status.toLowerCase();

	// Game is live if it's actively in progress
	return (
		statusLower.includes('in progress') ||
		statusLower.includes('live') ||
		(!!game.is_live && !isGameFinal(game) && !isGameUpcoming(game))
	);
}

export function isGameFinal(game: { status: string; away_score?: number; home_score?: number }): boolean {
	const statusLower = game.status.toLowerCase();

	// Game is final if it has a final status or has scores indicating completion
	return (
		statusLower.includes('final') ||
		statusLower.includes('completed') ||
		statusLower.includes('game over') ||
		(game.away_score !== undefined && game.home_score !== undefined && statusLower.includes('final'))
	);
}

export function isGameUpcoming(game: { status: string; start_time?: string }): boolean {
	const statusLower = game.status.toLowerCase();

	// Game is upcoming if it's scheduled but hasn't started
	return (
		statusLower.includes('scheduled') ||
		statusLower.includes('preview') ||
		statusLower.includes('upcoming') ||
		(statusLower.includes('pre') && !statusLower.includes('in progress'))
	);
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
