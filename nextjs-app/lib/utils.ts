import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
	try {
		const date = parseISO(dateString);
		return format(date, 'EEEE, MMMM d, yyyy');
	} catch (error) {
		return dateString;
	}
}

export function formatTime(dateString: string): string {
	try {
		const date = parseISO(dateString);
		return format(date, 'h:mm a z');
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

export function isGameLive(game: { status: string; is_live?: boolean }): boolean {
	return game.is_live || game.status.toLowerCase().includes('in progress');
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
