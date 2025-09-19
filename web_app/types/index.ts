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
	};
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
