/**
 * Error handling utilities for the baseball web app
 * Helps prevent deployment issues by providing consistent error handling
 */

export interface ApiError {
	message: string;
	code?: string;
	details?: any;
	timestamp: string;
}

export class BaseballServiceError extends Error {
	public code: string;
	public details?: any;
	public timestamp: string;

	constructor(message: string, code: string = 'BASEBALL_SERVICE_ERROR', details?: any) {
		super(message);
		this.name = 'BaseballServiceError';
		this.code = code;
		this.details = details;
		this.timestamp = new Date().toISOString();
	}
}

export function handleApiError(error: unknown): ApiError {
	if (error instanceof BaseballServiceError) {
		return {
			message: error.message,
			code: error.code,
			details: error.details,
			timestamp: error.timestamp,
		};
	}

	if (error instanceof Error) {
		return {
			message: error.message,
			code: 'UNKNOWN_ERROR',
			details: { stack: error.stack },
			timestamp: new Date().toISOString(),
		};
	}

	return {
		message: 'An unknown error occurred',
		code: 'UNKNOWN_ERROR',
		details: String(error),
		timestamp: new Date().toISOString(),
	};
}

export function validateGameId(gameId: string): void {
	if (!gameId || typeof gameId !== 'string') {
		throw new BaseballServiceError('Game ID is required', 'INVALID_GAME_ID');
	}

	const parts = gameId.split('-');
	if (parts.length < 6) {
		throw new BaseballServiceError(
			'Invalid game ID format. Expected: YYYY-MM-DD-AWAY-HOME-GAME_NUMBER',
			'INVALID_GAME_ID_FORMAT',
			{ gameId, parts }
		);
	}

	// Validate date format
	const datePart = parts.slice(0, 3).join('-');
	const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
	if (!dateRegex.test(datePart)) {
		throw new BaseballServiceError('Invalid date format in game ID', 'INVALID_DATE_FORMAT', { datePart });
	}
}

export function validateTeamCode(teamCode: string, fieldName: string): void {
	if (!teamCode || typeof teamCode !== 'string') {
		throw new BaseballServiceError(`${fieldName} is required`, 'INVALID_TEAM_CODE');
	}

	if (teamCode.length < 2 || teamCode.length > 4) {
		throw new BaseballServiceError(`${fieldName} must be 2-4 characters long`, 'INVALID_TEAM_CODE_LENGTH', {
			teamCode,
		});
	}
}

export function validateDateString(dateString: string): void {
	if (!dateString || typeof dateString !== 'string') {
		throw new BaseballServiceError('Date string is required', 'INVALID_DATE_STRING');
	}

	const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
	if (!dateRegex.test(dateString)) {
		throw new BaseballServiceError('Invalid date format. Expected: YYYY-MM-DD', 'INVALID_DATE_FORMAT', { dateString });
	}

	// Check if it's a valid date
	const date = new Date(dateString);
	if (isNaN(date.getTime())) {
		throw new BaseballServiceError('Invalid date value', 'INVALID_DATE_VALUE', { dateString });
	}
}

export function safeJsonParse<T>(jsonString: string, fallback: T): T {
	try {
		return JSON.parse(jsonString);
	} catch (error) {
		console.warn('Failed to parse JSON, using fallback:', error);
		return fallback;
	}
}

export function createFallbackGameData(gameId: string): any {
	const parts = gameId.split('-');
	const dateStr = parts.slice(0, 3).join('-');
	const awayCode = parts[3] || 'AWY';
	const homeCode = parts[4] || 'HOM';

	return {
		away_team: {
			name: `${awayCode} Team`,
			abbreviation: awayCode,
		},
		home_team: {
			name: `${homeCode} Team`,
			abbreviation: homeCode,
		},
		game_date_str: dateStr,
		location: 'Stadium Name, City, State',
		inning_list: Array.from({ length: 9 }, (_, i) => ({
			inning: i + 1,
			away: 0,
			home: 0,
		})),
		is_postponed: false,
		is_suspended: false,
		away_score: 0,
		home_score: 0,
		total_away_runs: 0,
		total_home_runs: 0,
		status: 'Unknown',
	};
}
