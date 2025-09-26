import { GameData } from '@/types';

// Interface for play-by-play data changes
interface PlayByPlayChanges {
	newPlays: any[];
	updatedPlays: any[];
	removedPlays: any[];
}

// Interface for player statistics changes
interface PlayerStatsChanges {
	updatedBatters: any[];
	updatedPitchers: any[];
	newSubstitutions: any[];
}

// Interface for game state changes
interface GameStateChanges {
	scoreChanged: boolean;
	inningChanged: boolean;
	statusChanged: boolean;
	baseRunnersChanged: boolean;
}

/**
 * Merge new play-by-play data with existing data
 */
export function mergePlayByPlayData(
	existingPlays: any[],
	newPlays: any[]
): { mergedPlays: any[]; changes: PlayByPlayChanges } {
	const existingPlayIds = new Set(existingPlays.map((play) => play.atBatIndex));
	const changes: PlayByPlayChanges = {
		newPlays: [],
		updatedPlays: [],
		removedPlays: [],
	};

	// Find new plays
	const newPlaysList = newPlays.filter((play) => !existingPlayIds.has(play.atBatIndex));
	changes.newPlays = newPlaysList;

	// Find updated plays (same atBatIndex but different content)
	const updatedPlaysList = newPlays.filter((play) => {
		if (existingPlayIds.has(play.atBatIndex)) {
			const existingPlay = existingPlays.find((p) => p.atBatIndex === play.atBatIndex);
			return existingPlay && JSON.stringify(existingPlay) !== JSON.stringify(play);
		}
		return false;
	});
	changes.updatedPlays = updatedPlaysList;

	// Merge all plays, keeping the most recent version
	const mergedPlays = [...existingPlays];

	// Update existing plays
	updatedPlaysList.forEach((updatedPlay) => {
		const index = mergedPlays.findIndex((play) => play.atBatIndex === updatedPlay.atBatIndex);
		if (index !== -1) {
			mergedPlays[index] = updatedPlay;
		}
	});

	// Add new plays
	mergedPlays.push(...newPlaysList);

	// Sort by atBatIndex to maintain chronological order
	mergedPlays.sort((a, b) => a.atBatIndex - b.atBatIndex);

	return { mergedPlays, changes };
}

/**
 * Update player statistics incrementally
 */
export function updatePlayerStatistics(
	existingStats: { away: { batters: any[]; pitchers: any[] }; home: { batters: any[]; pitchers: any[] } },
	newStats: { away: { batters: any[]; pitchers: any[] }; home: { batters: any[]; pitchers: any[] } }
): { updatedStats: any; changes: PlayerStatsChanges } {
	const changes: PlayerStatsChanges = {
		updatedBatters: [],
		updatedPitchers: [],
		newSubstitutions: [],
	};

	// Update away team batters
	const updatedAwayBatters = existingStats.away.batters.map((existingBatter) => {
		const newBatter = newStats.away.batters.find((b) => b.name === existingBatter.name);
		if (newBatter && JSON.stringify(existingBatter) !== JSON.stringify(newBatter)) {
			changes.updatedBatters.push(newBatter);
			return newBatter;
		}
		return existingBatter;
	});

	// Update home team batters
	const updatedHomeBatters = existingStats.home.batters.map((existingBatter) => {
		const newBatter = newStats.home.batters.find((b) => b.name === existingBatter.name);
		if (newBatter && JSON.stringify(existingBatter) !== JSON.stringify(newBatter)) {
			changes.updatedBatters.push(newBatter);
			return newBatter;
		}
		return existingBatter;
	});

	// Update away team pitchers
	const updatedAwayPitchers = existingStats.away.pitchers.map((existingPitcher) => {
		const newPitcher = newStats.away.pitchers.find((p) => p.name === existingPitcher.name);
		if (newPitcher && JSON.stringify(existingPitcher) !== JSON.stringify(newPitcher)) {
			changes.updatedPitchers.push(newPitcher);
			return newPitcher;
		}
		return existingPitcher;
	});

	// Update home team pitchers
	const updatedHomePitchers = existingStats.home.pitchers.map((existingPitcher) => {
		const newPitcher = newStats.home.pitchers.find((p) => p.name === existingPitcher.name);
		if (newPitcher && JSON.stringify(existingPitcher) !== JSON.stringify(newPitcher)) {
			changes.updatedPitchers.push(newPitcher);
			return newPitcher;
		}
		return existingPitcher;
	});

	return {
		updatedStats: {
			away: {
				batters: updatedAwayBatters,
				pitchers: updatedAwayPitchers,
			},
			home: {
				batters: updatedHomeBatters,
				pitchers: updatedHomePitchers,
			},
		},
		changes,
	};
}

/**
 * Track new base running movements from live data
 */
export function trackBaseRunningMovements(
	existingMovements: any[],
	newPlays: any[]
): { updatedMovements: any[]; newMovements: any[] } {
	const newMovements: any[] = [];

	// Process new plays for base running movements
	newPlays.forEach((play) => {
		if (play.result && play.result.eventType) {
			// Check for base running events
			const eventType = play.result.eventType;
			const description = play.result.description || '';

			// Look for base running related events
			if (
				eventType === 'Single' ||
				eventType === 'Double' ||
				eventType === 'Triple' ||
				eventType === 'Home Run' ||
				eventType === 'Walk' ||
				eventType === 'Hit By Pitch' ||
				description.includes('stolen base') ||
				description.includes('caught stealing') ||
				description.includes('picked off')
			) {
				// Extract base running movement data
				const movement = {
					atBatIndex: play.about?.atBatIndex || 0,
					inning: play.about?.inning || 0,
					halfInning: play.about?.halfInning || 'top',
					eventType,
					description,
					timestamp: play.about?.atBatIndex || Date.now(),
					playerId: play.matchup?.batter?.id,
					playerName: play.matchup?.batter?.fullName || 'Unknown',
				};

				newMovements.push(movement);
			}
		}
	});

	// Combine existing movements with new ones
	const updatedMovements = [...existingMovements, ...newMovements];

	// Sort by timestamp to maintain chronological order
	updatedMovements.sort((a, b) => a.timestamp - b.timestamp);

	return { updatedMovements, newMovements };
}

/**
 * Detect inning changes in live data
 */
export function detectInningChanges(
	existingInnings: any[],
	newInnings: any[]
): { hasInningChanges: boolean; currentInning: number; inningState: string } {
	// Compare inning data
	const hasInningChanges = JSON.stringify(existingInnings) !== JSON.stringify(newInnings);

	// Get current inning information
	const currentInning = newInnings.length > 0 ? newInnings[newInnings.length - 1]?.inning || 0 : 0;
	const inningState = newInnings.length > 0 ? newInnings[newInnings.length - 1]?.halfInning || 'top' : 'top';

	return {
		hasInningChanges,
		currentInning,
		inningState,
	};
}

/**
 * Detect game state changes (score, inning, status, etc.)
 */
export function detectGameStateChanges(existingGameData: GameData, newGameData: GameData): GameStateChanges {
	const changes: GameStateChanges = {
		scoreChanged: false,
		inningChanged: false,
		statusChanged: false,
		baseRunnersChanged: false,
	};

	// Check for score changes
	if (
		existingGameData.game_data.away_score !== newGameData.game_data.away_score ||
		existingGameData.game_data.home_score !== newGameData.game_data.home_score
	) {
		changes.scoreChanged = true;
	}

	// Check for inning changes
	if (JSON.stringify(existingGameData.game_data.inning_list) !== JSON.stringify(newGameData.game_data.inning_list)) {
		changes.inningChanged = true;
	}

	// Check for status changes
	if (existingGameData.game_data.status !== newGameData.game_data.status) {
		changes.statusChanged = true;
	}

	// Check for base runner changes (this would need more sophisticated logic)
	// For now, we'll assume base runners changed if the game is live
	if (newGameData.game_data.status === 'In Progress' || newGameData.game_data.status === 'Live') {
		changes.baseRunnersChanged = true;
	}

	return changes;
}

/**
 * Merge incremental game data with existing data
 */
export function mergeIncrementalGameData(existingData: GameData, newData: GameData): GameData {
	// Detect what has changed
	const gameStateChanges = detectGameStateChanges(existingData, newData);

	// Merge play-by-play data
	const playByPlayResult = mergePlayByPlayData(
		existingData.game_data.play_by_play?.atBats ? Object.values(existingData.game_data.play_by_play.atBats).flat() : [],
		newData.game_data.play_by_play?.atBats ? Object.values(newData.game_data.play_by_play.atBats).flat() : []
	);

	// Update player statistics
	const playerStatsResult = updatePlayerStatistics(
		existingData.game_data.player_stats || { away: { batters: [], pitchers: [] }, home: { batters: [], pitchers: [] } },
		newData.game_data.player_stats || { away: { batters: [], pitchers: [] }, home: { batters: [], pitchers: [] } }
	);

	// Track base running movements
	const baseRunningResult = trackBaseRunningMovements(
		[], // This would need to be passed from existing data
		playByPlayResult.mergedPlays
	);

	// Create merged game data
	const mergedData: GameData = {
		...newData,
		game_data: {
			...newData.game_data,
			// Use updated player stats if there were changes
			player_stats: gameStateChanges.scoreChanged ? playerStatsResult.updatedStats : newData.game_data.player_stats,
			// Merge play-by-play data
			play_by_play: {
				atBats: playByPlayResult.mergedPlays.reduce((acc, play) => {
					const key = `${play.batter}-${play.inning}-${play.halfInning}`;
					if (!acc[key]) acc[key] = [];
					acc[key].push(play);
					return acc;
				}, {} as any),
				substitutions: newData.game_data.play_by_play?.substitutions || {},
				inningResults: newData.game_data.play_by_play?.inningResults || {},
				errors: newData.game_data.play_by_play?.errors || {},
			},
		},
	};

	return mergedData;
}

/**
 * Get live update summary for UI indicators
 */
export function getLiveUpdateSummary(changes: {
	playByPlayChanges: PlayByPlayChanges;
	playerStatsChanges: PlayerStatsChanges;
	gameStateChanges: GameStateChanges;
}): {
	hasUpdates: boolean;
	updateCount: number;
	updateTypes: string[];
} {
	const updateTypes: string[] = [];
	let updateCount = 0;

	// Count play-by-play changes
	if (changes.playByPlayChanges.newPlays.length > 0) {
		updateTypes.push('New Plays');
		updateCount += changes.playByPlayChanges.newPlays.length;
	}
	if (changes.playByPlayChanges.updatedPlays.length > 0) {
		updateTypes.push('Updated Plays');
		updateCount += changes.playByPlayChanges.updatedPlays.length;
	}

	// Count player statistics changes
	if (changes.playerStatsChanges.updatedBatters.length > 0) {
		updateTypes.push('Batter Updates');
		updateCount += changes.playerStatsChanges.updatedBatters.length;
	}
	if (changes.playerStatsChanges.updatedPitchers.length > 0) {
		updateTypes.push('Pitcher Updates');
		updateCount += changes.playerStatsChanges.updatedPitchers.length;
	}

	// Count game state changes
	if (changes.gameStateChanges.scoreChanged) {
		updateTypes.push('Score Change');
		updateCount++;
	}
	if (changes.gameStateChanges.inningChanged) {
		updateTypes.push('Inning Change');
		updateCount++;
	}
	if (changes.gameStateChanges.statusChanged) {
		updateTypes.push('Status Change');
		updateCount++;
	}
	if (changes.gameStateChanges.baseRunnersChanged) {
		updateTypes.push('Base Runners');
		updateCount++;
	}

	return {
		hasUpdates: updateCount > 0,
		updateCount,
		updateTypes,
	};
}
