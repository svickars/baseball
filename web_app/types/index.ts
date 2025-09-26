export interface Game {
	id: string;
	away_team: string;
	home_team: string;
	away_code: string;
	home_code: string;
	game_number: number;
	start_time: string;
	location: string;
	status: string;
	game_pk: number;
	is_live: boolean;
	inning?: string;
	inning_state?: string;
	away_score?: number;
	home_score?: number;
	innings?: Array<{
		inning: number;
		away_runs: number;
		home_runs: number;
	}>;
	away_hits?: number;
	home_hits?: number;
	away_errors?: number;
	home_errors?: number;
	// MLB API status data for more reliable status determination
	mlbStatus?: {
		detailedState?: string;
		codedGameState?: string;
	};
}

export interface GameData {
	game_id: string;
	game?: Game;
	game_data: {
		away_team: {
			name: string;
			abbreviation: string;
		};
		home_team: {
			name: string;
			abbreviation: string;
		};
		game_date_str: string;
		location: string;
		inning_list: any[];
		is_postponed: boolean;
		is_suspended: boolean;
		away_score?: number;
		home_score?: number;
		total_away_runs?: number;
		total_home_runs?: number;
		status?: string;
		// Supplementary data from MLB API
		umpires?: Array<{
			name: string;
			position: string;
		}>;
		managers?: {
			away: string | null;
			home: string | null;
		};
		start_time?: string | null;
		end_time?: string | null;
		weather?: string | null | { condition: string };
		wind?: string | null;
		uniforms?: {
			away: string | null;
			home: string | null;
		};
		play_by_play?: {
			atBats: { [key: string]: any[] };
			substitutions: { [key: string]: any[] };
			inningResults: { [key: string]: any[] };
			errors: { [key: string]: any[] };
		};
		game_feed_substitutions?: Array<{
			substitutingPlayer: string;
			replacedPlayer: string;
			type: string;
			position: string;
			battingOrder?: number;
			inning: number;
			halfInning: string;
			description: string;
			eventType: string;
			chronologicalOrder: number;
		}>;
		player_stats?: {
			away: {
				batters: Array<{
					name: string;
					at_bats: number;
					hits: number;
					runs: number;
					rbis: number;
					average: string;
					position: string;
					lineup_order: number;
				}>;
				pitchers: Array<{
					name: string;
					innings_pitched: number;
					hits: number;
					runs: number;
					earned_runs: number;
					walks: number;
					strikeouts: number;
					era: string;
				}>;
			};
			home: {
				batters: Array<{
					name: string;
					at_bats: number;
					hits: number;
					runs: number;
					rbis: number;
					average: string;
					position: string;
					lineup_order: number;
				}>;
				pitchers: Array<{
					name: string;
					innings_pitched: number;
					hits: number;
					runs: number;
					earned_runs: number;
					walks: number;
					strikeouts: number;
					era: string;
				}>;
			};
		};
		liveData?: any;
	};
	liveData?: any;
	svg_content: string;
	success: boolean;
}

export interface DetailedGameData {
	game_id: string;
	date: string;
	away_team: {
		name: string;
		abbreviation: string;
	};
	home_team: {
		name: string;
		abbreviation: string;
	};
	venue: string;
	status: string;
	innings: any[];
	batters: {
		away: any[];
		home: any[];
	};
	pitchers: {
		away: any[];
		home: any[];
	};
	events: any[];
	integration_status?: string;
	note?: string;
	total_away_runs?: number;
	total_home_runs?: number;
	// MLB API supplementary data
	umpires?: Array<{
		name: string;
		position: string;
		id?: string | null;
	}>;
	managers?: {
		away: string | null;
		home: string | null;
	};
	start_time?: string | null;
	end_time?: string | null;
	weather?: string | null;
	wind?: string | null;
	uniforms?: {
		away: string | null;
		home: string | null;
	};
	liveData?: any;
}

export interface GamesResponse {
	date: string;
	games: Game[];
	success: boolean;
}

export interface Team {
	code: string;
	name: string;
}

export interface TeamsResponse {
	teams: Team[];
	success: boolean;
}

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
}

export interface GameControls {
	detailLevel: 'basic' | 'standard' | 'detailed' | 'full';
	timeDelay: number;
	viewMode: 'scorecard' | 'stats' | 'pitch';
	showPitchData: boolean;
	showPlayerStats: boolean;
}

export interface LiveDataBuffer {
	data: GameData;
	timestamp: number;
}

// Live update related interfaces
export interface LiveUpdateState {
	gameData: GameData | null;
	isLive: boolean;
	isLoading: boolean;
	error: string | null;
	lastUpdate: string | null;
	hasChanges: boolean;
}

export interface LiveUpdateOptions {
	gameId: string;
	gamePk?: string;
	isLiveGame: boolean;
	pollInterval?: number;
	onDataUpdate?: (data: GameData) => void;
	onError?: (error: string) => void;
}

export interface PlayByPlayChanges {
	newPlays: any[];
	updatedPlays: any[];
	removedPlays: any[];
}

export interface PlayerStatsChanges {
	updatedBatters: any[];
	updatedPitchers: any[];
	newSubstitutions: any[];
}

export interface GameStateChanges {
	scoreChanged: boolean;
	inningChanged: boolean;
	statusChanged: boolean;
	baseRunnersChanged: boolean;
}

export interface LiveUpdateSummary {
	hasUpdates: boolean;
	updateCount: number;
	updateTypes: string[];
}

// Enhanced GameData interface for live updates
export interface LiveGameData extends GameData {
	isLiveUpdate?: boolean;
	timestamp?: string;
	hasChanges?: boolean;
	liveUpdateSummary?: LiveUpdateSummary;
}

// Live update API response
export interface LiveUpdateResponse {
	game_id: string;
	game: any;
	game_data: any;
	liveData: any;
	svg_content: string;
	success: boolean;
	isLiveUpdate: boolean;
	timestamp: string;
	hasChanges: boolean;
}
