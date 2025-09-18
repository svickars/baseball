'use client';

import { Game, GameData, DetailedGameData } from '@/types';

// Normalized data structures for efficient processing
export interface NormalizedGame {
	id: string;
	date: string;
	awayTeam: {
		id: string;
		name: string;
		abbreviation: string;
		score: number;
		hits: number;
		errors: number;
	};
	homeTeam: {
		id: string;
		name: string;
		abbreviation: string;
		score: number;
		hits: number;
		errors: number;
	};
	status: string;
	venue: string;
	innings: NormalizedInning[];
	batters: {
		away: NormalizedBatter[];
		home: NormalizedBatter[];
	};
	pitchers: {
		away: NormalizedPitcher[];
		home: NormalizedPitcher[];
	};
	metadata: {
		lastUpdated: number;
		isLive: boolean;
		gameType: 'regular' | 'playoff' | 'world-series';
	};
}

export interface NormalizedInning {
	number: number;
	awayRuns: number;
	homeRuns: number;
	topEvents: NormalizedEvent[];
	bottomEvents: NormalizedEvent[];
}

export interface NormalizedEvent {
	id: string;
	type: 'pitch' | 'hit' | 'out' | 'run' | 'substitution' | 'other';
	description: string;
	batter: string;
	pitcher: string;
	inning: number;
	half: 'top' | 'bottom';
	timestamp: number;
	summary?: string;
	runsScored?: number;
	rbis?: number;
	outs?: number;
}

export interface NormalizedBatter {
	id: string;
	name: string;
	position: string;
	atBats: number;
	hits: number;
	runs: number;
	rbis: number;
	average: number;
	obp: number;
	slg: number;
	ops: number;
}

export interface NormalizedPitcher {
	id: string;
	name: string;
	position: string;
	inningsPitched: number;
	hits: number;
	runs: number;
	earnedRuns: number;
	walks: number;
	strikeouts: number;
	era: number;
	whip: number;
	battingAverageAgainst: number;
}

// Data normalizer class
class DataNormalizer {
	private cache = new Map<string, NormalizedGame>();
	private lastNormalized = new Map<string, number>();

	// Normalize a game from API response
	normalizeGame(gameData: GameData): NormalizedGame {
		const cacheKey = gameData.game_id;
		const now = Date.now();

		// Check if we have a recent normalized version
		if (this.cache.has(cacheKey) && this.lastNormalized.has(cacheKey)) {
			const lastNormalizedTime = this.lastNormalized.get(cacheKey)!;
			const timeSinceLastNormalized = now - lastNormalizedTime;

			// Use cached version if less than 5 minutes old
			if (timeSinceLastNormalized < 5 * 60 * 1000) {
				return this.cache.get(cacheKey)!;
			}
		}

		const normalized: NormalizedGame = {
			id: gameData.game_id,
			date: gameData.game_data.game_date_str,
			awayTeam: {
				id: this.generateTeamId(gameData.game_data.away_team.name),
				name: gameData.game_data.away_team.name,
				abbreviation: gameData.game_data.away_team.abbreviation,
				score: gameData.game_data.away_score || 0,
				hits: this.calculateTeamHits(gameData.game_data.player_stats?.away?.batters || []),
				errors: 0, // Would need to calculate from events
			},
			homeTeam: {
				id: this.generateTeamId(gameData.game_data.home_team.name),
				name: gameData.game_data.home_team.name,
				abbreviation: gameData.game_data.home_team.abbreviation,
				score: gameData.game_data.home_score || 0,
				hits: this.calculateTeamHits(gameData.game_data.player_stats?.home?.batters || []),
				errors: 0, // Would need to calculate from events
			},
			status: gameData.game_data.status || 'Unknown',
			venue: gameData.game_data.location || 'Unknown',
			innings: this.normalizeInnings(gameData.game_data.inning_list || []),
			batters: {
				away: this.normalizeBatters(gameData.game_data.player_stats?.away?.batters || []),
				home: this.normalizeBatters(gameData.game_data.player_stats?.home?.batters || []),
			},
			pitchers: {
				away: this.normalizePitchers(gameData.game_data.player_stats?.away?.pitchers || []),
				home: this.normalizePitchers(gameData.game_data.player_stats?.home?.pitchers || []),
			},
			metadata: {
				lastUpdated: now,
				isLive: this.isGameLive(gameData.game_data.status || ''),
				gameType: this.determineGameType(gameData.game_data.game_date_str),
			},
		};

		// Cache the normalized data
		this.cache.set(cacheKey, normalized);
		this.lastNormalized.set(cacheKey, now);

		return normalized;
	}

	// Normalize innings data
	private normalizeInnings(innings: any[]): NormalizedInning[] {
		return innings.map((inning) => ({
			number: inning.inning || 0,
			awayRuns: inning.away || 0,
			homeRuns: inning.home || 0,
			topEvents: [], // Would be populated from detailed event data
			bottomEvents: [], // Would be populated from detailed event data
		}));
	}

	// Normalize batters data
	private normalizeBatters(batters: any[]): NormalizedBatter[] {
		return batters.map((batter) => ({
			id: this.generatePlayerId(batter.name),
			name: batter.name || 'Unknown',
			position: batter.position || 'Unknown',
			atBats: batter.at_bats || 0,
			hits: batter.hits || 0,
			runs: batter.runs || 0,
			rbis: batter.rbis || 0,
			average: this.calculateAverage(batter.at_bats, batter.hits),
			obp: this.calculateOBP(batter),
			slg: this.calculateSLG(batter),
			ops: 0, // Would be calculated from OBP + SLG
		}));
	}

	// Normalize pitchers data
	private normalizePitchers(pitchers: any[]): NormalizedPitcher[] {
		return pitchers.map((pitcher) => ({
			id: this.generatePlayerId(pitcher.name),
			name: pitcher.name || 'Unknown',
			position: 'P',
			inningsPitched: pitcher.innings_pitched || 0,
			hits: pitcher.hits || 0,
			runs: pitcher.runs || 0,
			earnedRuns: pitcher.earned_runs || 0,
			walks: pitcher.walks || 0,
			strikeouts: pitcher.strikeouts || 0,
			era: this.calculateERA(pitcher),
			whip: this.calculateWHIP(pitcher),
			battingAverageAgainst: this.calculateBAA(pitcher),
		}));
	}

	// Calculate team hits
	private calculateTeamHits(batters: any[]): number {
		return batters.reduce((total, batter) => total + (batter.hits || 0), 0);
	}

	// Calculate batting average
	private calculateAverage(atBats: number, hits: number): number {
		return atBats > 0 ? hits / atBats : 0;
	}

	// Calculate OBP (On-Base Percentage)
	private calculateOBP(batter: any): number {
		const atBats = batter.at_bats || 0;
		const hits = batter.hits || 0;
		const walks = batter.walks || 0;
		const hitByPitch = batter.hit_by_pitch || 0;
		const sacFlies = batter.sac_fly || 0;

		const plateAppearances = atBats + walks + hitByPitch + sacFlies;
		const onBase = hits + walks + hitByPitch;

		return plateAppearances > 0 ? onBase / plateAppearances : 0;
	}

	// Calculate SLG (Slugging Percentage)
	private calculateSLG(batter: any): number {
		const atBats = batter.at_bats || 0;
		const singles = batter.singles || 0;
		const doubles = batter.doubles || 0;
		const triples = batter.triples || 0;
		const homeRuns = batter.home_runs || 0;

		const totalBases = singles + doubles * 2 + triples * 3 + homeRuns * 4;

		return atBats > 0 ? totalBases / atBats : 0;
	}

	// Calculate ERA (Earned Run Average)
	private calculateERA(pitcher: any): number {
		const inningsPitched = pitcher.innings_pitched || 0;
		const earnedRuns = pitcher.earned_runs || 0;

		return inningsPitched > 0 ? (earnedRuns * 9) / inningsPitched : 0;
	}

	// Calculate WHIP (Walks + Hits per Inning Pitched)
	private calculateWHIP(pitcher: any): number {
		const inningsPitched = pitcher.innings_pitched || 0;
		const hits = pitcher.hits || 0;
		const walks = pitcher.walks || 0;

		return inningsPitched > 0 ? (hits + walks) / inningsPitched : 0;
	}

	// Calculate BAA (Batting Average Against)
	private calculateBAA(pitcher: any): number {
		const inningsPitched = pitcher.innings_pitched || 0;
		const hits = pitcher.hits || 0;
		const battersFaced = pitcher.batters_faced || inningsPitched * 3; // Estimate

		return battersFaced > 0 ? hits / battersFaced : 0;
	}

	// Generate team ID
	private generateTeamId(teamName: string): string {
		return teamName.toLowerCase().replace(/\s+/g, '-');
	}

	// Generate player ID
	private generatePlayerId(playerName: string): string {
		return playerName.toLowerCase().replace(/\s+/g, '-');
	}

	// Check if game is live
	private isGameLive(status: string): boolean {
		const liveStatuses = ['Live', 'In Progress', 'Delayed', 'Suspended'];
		return liveStatuses.some((liveStatus) => status.toLowerCase().includes(liveStatus.toLowerCase()));
	}

	// Determine game type
	private determineGameType(date: string): 'regular' | 'playoff' | 'world-series' {
		// Simple heuristic - would need more sophisticated logic
		const month = parseInt(date.split('-')[1]);
		if (month >= 10) return 'playoff';
		return 'regular';
	}

	// Get cached normalized game
	getCachedGame(gameId: string): NormalizedGame | null {
		return this.cache.get(gameId) || null;
	}

	// Clear cache
	clearCache(): void {
		this.cache.clear();
		this.lastNormalized.clear();
	}

	// Get cache statistics
	getCacheStats(): {
		cached: number;
		oldestEntry: number;
		newestEntry: number;
	} {
		const entries = Array.from(this.lastNormalized.values());
		return {
			cached: this.cache.size,
			oldestEntry: entries.length > 0 ? Math.min(...entries) : 0,
			newestEntry: entries.length > 0 ? Math.max(...entries) : 0,
		};
	}
}

// Singleton instance
export const dataNormalizer = new DataNormalizer();

// Hook for using the normalizer
export function useDataNormalizer() {
	return dataNormalizer;
}
