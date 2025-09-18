'use client';

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { GameData } from '@/types';
import LoadingSpinner from './LoadingSpinner';
import * as TeamLogos from './team-logos';
import { getGameDetails } from '@/lib/baseball-service';

interface TraditionalScorecardProps {
	gameData: GameData;
	gameId: string;
}

// Helper function to get team logo component
const getTeamLogo = (teamCode: string) => {
	const LogoComponent = (TeamLogos as any)[teamCode];
	return LogoComponent ? <LogoComponent size={40} /> : null;
};

// Global footnote counter and storage
let globalFootnoteCounter = 1;
const globalFootnotes: { [key: string]: number } = {};
const allSubstitutions: Array<{ footnote: string; order: number }> = [];

// Helper function to generate descriptive footnotes
const generateFootnote = (
	sub: any,
	starter: any,
	substitutionType: string,
	displayPosition: string,
	inning: number,
	halfInning: string,
	isAway: boolean,
	previousSub: any = null
): string => {
	// Use the substitution_type from API data if available, otherwise fall back to the parameter
	const actualSubstitutionType = sub.substitution_type || substitutionType;

	const subName = sub.person?.fullName || sub.name || 'Unknown Player';
	const starterName = starter.person?.fullName || starter.name || 'Unknown Player';
	const inningText =
		inning === 1
			? 'first'
			: inning === 2
			? 'second'
			: inning === 3
			? 'third'
			: inning === 4
			? 'fourth'
			: inning === 5
			? 'fifth'
			: inning === 6
			? 'sixth'
			: inning === 7
			? 'seventh'
			: inning === 8
			? 'eighth'
			: inning === 9
			? 'ninth'
			: inning === 10
			? 'tenth'
			: inning === 11
			? 'eleventh'
			: inning === 12
			? 'twelfth'
			: inning === 13
			? 'thirteenth'
			: inning === 14
			? 'fourteenth'
			: inning === 15
			? 'fifteenth'
			: `${inning}th`;

	// Use the half-inning passed from the calling function
	const halfInningText = halfInning === 'top' ? 'top' : 'bottom';

	// Determine who they're replacing (previous sub or original starter)
	const replacedPlayer = previousSub
		? previousSub.person?.fullName || previousSub.name || 'Unknown Player'
		: starterName;

	let footnote = '';

	if (actualSubstitutionType === 'PH') {
		if (displayPosition && displayPosition !== 'PH' && displayPosition !== 'PR' && displayPosition !== 'DH') {
			// They took a defensive position and remained in the game
			footnote = `${subName} pinch hit for ${replacedPlayer} in the ${halfInningText} of the ${inningText} and remained in the game as ${displayPosition}, batting ${
				sub.batting_order?.substring(0, 1) || '?'
			}th.`;
		} else {
			// They only pinch hit
			footnote = `${subName} pinch hit for ${replacedPlayer} in the ${halfInningText} of the ${inningText}, batting ${
				sub.batting_order?.substring(0, 1) || '?'
			}th.`;
		}
	} else if (actualSubstitutionType === 'PR') {
		if (
			displayPosition &&
			displayPosition !== 'PR' &&
			displayPosition !== (starter.position?.abbreviation || starter.position)
		) {
			// They took a defensive position
			footnote = `${subName} pinch ran for ${replacedPlayer} in the ${halfInningText} of the ${inningText} and remained in the game at ${displayPosition}, batting ${
				sub.batting_order?.substring(0, 1) || '?'
			}th.`;
		} else {
			// They only pinch ran
			footnote = `${subName} pinch ran for ${replacedPlayer} in the ${halfInningText} of the ${inningText}, batting ${
				sub.batting_order?.substring(0, 1) || '?'
			}th.`;
		}
	} else if (actualSubstitutionType === 'DEF') {
		footnote = `${subName} replaced ${replacedPlayer} in the ${halfInningText} of the ${inningText}, playing ${displayPosition} and batting ${
			sub.batting_order?.substring(0, 1) || '?'
		}th.`;
	}

	// Special case: pitcher batting due to DH loss
	if (displayPosition === '1') {
		footnote = `${subName} replaced ${replacedPlayer} in the ${halfInningText} of the ${inningText} and remained in the game as P, batting ${
			sub.batting_order?.substring(0, 1) || '?'
		}th.`;
	}

	// Add to global substitutions list for sequential numbering
	allSubstitutions.push({ footnote, order: allSubstitutions.length + 1 });

	// Create a unique key for this substitution
	const footnoteKey = `${subName}-${starterName}-${substitutionType}-${inning}-${halfInning}`;

	// Assign footnote number based on order in the game
	const footnoteNumber = allSubstitutions.length;
	globalFootnotes[footnoteKey] = footnoteNumber;

	return footnote;
};

// Helper function to reset footnote counter for new game data
const resetFootnoteCounter = () => {
	globalFootnoteCounter = 1;
	Object.keys(globalFootnotes).forEach((key) => delete globalFootnotes[key]);
	allSubstitutions.length = 0;
};

// Helper function to process batter data and handle substitutions
const processBatterData = (
	batters: any[],
	pitchers: any[] = [],
	isAway: boolean = true,
	processedBatters?: any[]
): BatterData[] => {
	// Reset footnote counter for new data
	resetFootnoteCounter();

	// Create lookup map for substitution types from processed data
	const substitutionTypeMap = new Map<string, string>();
	if (processedBatters) {
		processedBatters.forEach((batter: any) => {
			if (batter.substitution_type) {
				// Use player name as key since person field is not available
				const key = batter.name;
				substitutionTypeMap.set(key, batter.substitution_type);
			}
		});
	}

	// First filter to ensure we only have actual batters (not pitchers)
	// Exception: Include pitchers who are batting due to DH being lost
	const actualBatters = batters.filter((batter: any) => {
		const position = batter.position || '';
		const positionType = batter.position?.type || '';
		const battingOrder = batter.batting_order || '';

		// Include pitchers who are batting (position "1" or batting order indicates they're batting)
		if (position === '1' || (position === 'P' && battingOrder && parseInt(battingOrder) >= 100)) {
			return true;
		}

		// Exclude other pitchers and any position that's not a fielding position
		return position !== 'P' && positionType !== 'Pitcher' && position !== '' && position !== '?';
	});

	// Check pitchers array for any pitchers who are batting due to DH loss
	const battingPitchers = pitchers.filter((pitcher: any) => {
		const position = pitcher.position?.abbreviation || pitcher.position || '';
		const battingOrder = pitcher.battingOrder || pitcher.batting_order || '';

		// Include pitchers who are batting (position "1" or batting order indicates they're batting)
		return position === '1' || (battingOrder && parseInt(battingOrder) >= 100);
	});

	// Add batting pitchers to the batters array
	const allPlayers = [...actualBatters, ...battingPitchers];

	// If no players found, return empty slots
	if (allPlayers.length === 0) {
		return Array.from({ length: 9 }, () => ({
			name: '',
			position: '',
			at_bats: 0,
			hits: 0,
			runs: 0,
			rbi: 0,
			walks: 0,
			strikeouts: 0,
			number: '',
			batting_order: '',
			is_substitute: false,
			substitutions: [],
		}));
	}

	// Group batters by batting order position
	const battingOrderMap = new Map<string, any[]>();

	allPlayers.forEach((player: any) => {
		const battingOrder = player.batting_order || player.battingOrder || '100';
		const baseOrder = battingOrder.substring(0, 1); // Get the first digit (1, 2, 3, etc.)

		if (!battingOrderMap.has(baseOrder)) {
			battingOrderMap.set(baseOrder, []);
		}
		battingOrderMap.get(baseOrder)!.push(player);
	});

	// Convert to array and sort by batting order
	const result: BatterData[] = [];

	for (let i = 1; i <= 9; i++) {
		const orderKey = i.toString();
		const players = battingOrderMap.get(orderKey) || [];

		if (players.length > 0) {
			// Sort by batting order (100, 101, 110, etc.)
			players.sort((a, b) => {
				const orderA = parseInt(a.batting_order || '100');
				const orderB = parseInt(b.batting_order || '100');
				return orderA - orderB;
			});

			// First player is the starter
			const starter = players[0];
			const substitutions: SubstitutionData[] = [];

			// Process substitutions
			let previousSub = null;
			for (let j = 1; j < players.length; j++) {
				const sub = players[j];

				// Try to get substitution type from processed data first
				const playerName = sub.name;
				const apiSubstitutionType = substitutionTypeMap.get(playerName);

				// Use API data if available, otherwise fall back to heuristics
				const substitutionType = apiSubstitutionType || determineSubstitutionType(sub, starter);

				// Determine the display position based on substitution type and scenario
				let displayPosition = sub.position?.abbreviation || sub.position || 'OF';
				let initialPosition = '';
				let finalPosition = '';

				// Handle different substitution scenarios
				if (substitutionType === 'PH') {
					// Pinch hitter - check if they took a defensive position
					if (displayPosition && displayPosition !== 'PH' && displayPosition !== 'PR' && displayPosition !== 'DH') {
						// They took a defensive position, show PH -> position change
						initialPosition = 'PH';
						finalPosition = displayPosition;
					} else {
						// They only pinch hit, show PH
						displayPosition = 'PH';
						initialPosition = 'PH';
						finalPosition = 'PH';
					}
				} else if (substitutionType === 'PR') {
					// Pinch runner - check if they took a defensive position
					if (displayPosition && displayPosition !== 'PR' && displayPosition !== 'PH' && displayPosition !== 'DH') {
						// They took a defensive position, show PR -> position change
						initialPosition = 'PR';
						finalPosition = displayPosition;
					} else {
						// They only pinch ran, show PR
						displayPosition = 'PR';
						initialPosition = 'PR';
						finalPosition = 'PR';
					}
				} else if (substitutionType === 'DEF') {
					// Defensive replacement - they only play the position they're assigned
					displayPosition = sub.position?.abbreviation || sub.position || 'OF';
					// Defensive replacements don't change positions - they only play their assigned position
					initialPosition = displayPosition;
					finalPosition = displayPosition;
				}

				// Use inning data from the API if available, otherwise fall back to default
				let actualInning = 9; // Default fallback
				let actualHalfInning = 'top'; // Default

				const actualSubstitutionType = sub.substitution_type || substitutionType;

				// Use inning data from play-by-play if available
				if (sub.substitution_inning) {
					actualInning = sub.substitution_inning;
				}
				if (sub.substitution_half_inning) {
					actualHalfInning = sub.substitution_half_inning;
				}

				// Determine half-inning based on substitution type and team
				// Use API data if available, otherwise fall back to determined type
				// Offensive substitutions (PH/PR): away = top, home = bottom
				// Defensive substitutions (DEF): away = bottom, home = top
				if (actualSubstitutionType === 'PH' || actualSubstitutionType === 'PR') {
					actualHalfInning = isAway ? 'top' : 'bottom';
				} else if (actualSubstitutionType === 'DEF') {
					actualHalfInning = isAway ? 'bottom' : 'top';
				}

				// Debug logging removed

				// Generate descriptive footnote
				const footnote = generateFootnote(
					sub,
					starter,
					actualSubstitutionType,
					displayPosition,
					actualInning,
					actualHalfInning,
					isAway,
					previousSub
				);

				substitutions.push({
					player_name: sub.person?.fullName || sub.name || 'Unknown Player',
					player_number: sub.jerseyNumber
						? String(sub.jerseyNumber)
						: sub.jersey_number
						? String(sub.jersey_number)
						: '0',
					position: displayPosition,
					substitution_type: actualSubstitutionType,
					inning: actualInning,
					half_inning: actualHalfInning as 'top' | 'bottom',
					replaced_player: starter.person?.fullName || starter.name,
					footnote: footnote,
					initial_position: initialPosition,
					final_position: finalPosition,
					position_changes: [],
					// Add stats for substitute players
					at_bats: sub.stats?.batting?.atBats || sub.at_bats || 0,
					hits: sub.stats?.batting?.hits || sub.hits || 0,
					runs: sub.stats?.batting?.runs || sub.runs || 0,
					rbi: sub.stats?.batting?.rbi || sub.rbis || 0,
					walks: sub.walks || 0,
					strikeouts: sub.strikeouts || 0,
					// Add slash line data for substitute players
					average: sub.average,
					onBasePercentage: sub.onBasePercentage,
					sluggingPercentage: sub.sluggingPercentage,
				});

				// Update previous sub for next iteration
				previousSub = sub;
			}

			// Determine starter's final position
			const starterInitialPosition = starter.position?.abbreviation || starter.position || 'OF';
			let starterFinalPosition = starterInitialPosition;

			// Check if the starter changed positions during the game
			// Look for evidence of position changes in the game data
			// For now, we'll use a simple heuristic: if there are multiple substitutions for this batting order,
			// it might indicate the starter moved positions
			if (substitutions.length >= 2) {
				// If there are multiple substitutions, the starter might have moved to a different position
				// Look for patterns that suggest position changes
				const firstSub = substitutions[0];
				const secondSub = substitutions[1];

				// If the first substitution is a defensive replacement and takes the starter's position,
				// the starter might have moved to a different position
				if (firstSub.substitution_type === 'DEF' && firstSub.position === starterInitialPosition) {
					// The starter likely moved to a different position
					// We'll need actual game data to determine this accurately
					// For now, we'll assume no position change unless we have clear evidence
				}
			}

			result.push({
				name: starter.person?.fullName || starter.name || 'Unknown Player',
				position: starterInitialPosition,
				at_bats: starter.stats?.batting?.atBats || starter.at_bats || 0,
				hits: starter.stats?.batting?.hits || starter.hits || 0,
				runs: starter.stats?.batting?.runs || starter.runs || 0,
				rbi: starter.stats?.batting?.rbi || starter.rbis || 0,
				walks: starter.walks || 0,
				strikeouts: starter.strikeouts || 0,
				number: starter.jerseyNumber
					? String(starter.jerseyNumber)
					: starter.jersey_number
					? String(starter.jersey_number)
					: '0',
				batting_order: starter.batting_order || starter.battingOrder,
				is_substitute: false,
				substitutions: substitutions,
				// Add starter position tracking
				starter_initial_position: starterInitialPosition,
				starter_final_position: starterFinalPosition,
				// Add team information
				isAway: isAway,
				// Add slash line data
				average: starter.average,
				onBasePercentage: starter.onBasePercentage,
				sluggingPercentage: starter.sluggingPercentage,
			});
		} else {
			// Empty slot
			result.push({
				name: '',
				position: '',
				at_bats: 0,
				hits: 0,
				runs: 0,
				rbi: 0,
				walks: 0,
				strikeouts: 0,
				number: '',
				batting_order: '',
				is_substitute: false,
				substitutions: [],
			});
		}
	}

	return result;
};

// Helper function to determine substitution type
const determineSubstitutionType = (sub: any, starter: any): 'PH' | 'PR' | 'DEF' => {
	// Use the substitution_type from the API data if available
	if (sub.substitution_type) {
		return sub.substitution_type as 'PH' | 'PR' | 'DEF';
	}

	// Fallback to heuristics if substitution_type is not available
	const subPosition = sub.position?.abbreviation || sub.position;
	if (subPosition === 'PH') {
		return 'PH';
	}
	if (subPosition === 'PR') {
		return 'PR';
	}

	// If the player has a regular defensive position (not PH/PR), it's likely a defensive sub
	if (
		subPosition &&
		subPosition !== 'PH' &&
		subPosition !== 'PR' &&
		subPosition !== (starter.position?.abbreviation || starter.position)
	) {
		return 'DEF';
	}

	// Use batting statistics as a fallback
	const atBats = sub.at_bats || 0;
	if (atBats > 0) {
		return 'PH';
	}

	// Default to defensive substitution
	return 'DEF';
};

// Helper function to get footnote number
const getFootnoteNumber = (footnote: string): string => {
	// Find the footnote in our allSubstitutions list
	for (let i = 0; i < allSubstitutions.length; i++) {
		if (allSubstitutions[i].footnote === footnote) {
			return (i + 1).toString();
		}
	}
	// Fallback to simple hash if not found
	let hash = 0;
	for (let i = 0; i < footnote.length; i++) {
		const char = footnote.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return Math.abs((hash % 9) + 1).toString();
};

// Helper function to get at-bat results for a specific inning and batter
const getAtBatResultsForInning = (
	batter: BatterData,
	inningNumber: number,
	detailedData: DetailedGameData | null
): Array<{ atBatResult: string; endedInning: boolean }> => {
	if (!detailedData || !detailedData.play_by_play) {
		return [];
	}

	const playByPlay = detailedData.play_by_play;
	const atBatResults: Array<{ atBatResult: string; endedInning: boolean }> = [];

	// Get at-bats for this batter in this inning
	const batterName = batter.name;
	const halfInning = batter.isAway ? 'top' : 'bottom';
	const atBatKey = `${batterName}-${inningNumber}-${halfInning}`;

	if (playByPlay.atBats && playByPlay.atBats.has(atBatKey)) {
		const atBats = playByPlay.atBats.get(atBatKey) || [];
		atBats.forEach((atBat) => {
			atBatResults.push({
				atBatResult: atBat.atBatResult || '',
				endedInning: atBat.outs >= 3 || atBat.endedInning,
			});
		});
	}

	return atBatResults;
};

// Component for rendering batter rows with substitutions
const BatterRow = ({
	batter,
	index,
	displayInnings,
	isAway = true,
	isLastRow = false,
	detailedData,
}: {
	batter: BatterData;
	index: number;
	displayInnings: number;
	isAway?: boolean;
	isLastRow?: boolean;
	detailedData: DetailedGameData | null;
}) => {
	return (
		<div
			className={`grid gap-0 ${isLastRow ? '' : 'border-b border-primary-300 dark:border-primary-700'}`}
			style={{
				gridTemplateColumns: `40px 200px 30px ${Array(displayInnings)
					.fill('1fr')
					.join(' ')} 45px 45px 45px 45px 45px 45px`,
			}}>
			{/* Player Number */}
			<div className="flex flex-col border-r border-primary-200 dark:border-primary-700 h-18">
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.number || index + 1}
				</div>
				<div className="flex justify-center items-center h-6 font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.substitutions?.[0]?.player_number || ''}
				</div>
				<div className="flex justify-center items-center h-6 font-medium text-2xs text-primary-900 dark:text-primary-100">
					{batter.substitutions?.[1]?.player_number || ''}
				</div>
			</div>

			{/* Player Name */}
			<div className="flex flex-col border-r border-primary-200 dark:border-primary-800 h-18">
				<div className="flex flex-col px-2 h-6 border-b bg-primary-50 dark:bg-primary-800 border-primary-200 dark:border-primary-700">
					<span className="font-bold text-2xs text-primary-900 dark:text-primary-100">{batter.name}</span>
					{batter.average && batter.onBasePercentage && batter.sluggingPercentage && (
						<span className="text-[8px] text-primary-600 dark:text-primary-400">
							{batter.average}/{batter.onBasePercentage}/{batter.sluggingPercentage}
						</span>
					)}
				</div>
				<div className="flex flex-col px-2 h-6 border-b bg-primary-50 dark:bg-primary-800 border-primary-200 dark:border-primary-700">
					{batter.substitutions?.[0] && (
						<>
							<span className="font-bold text-2xs text-primary-900 dark:text-primary-100">
								{batter.substitutions[0].player_name}
								{batter.substitutions[0].footnote && (
									<sup className="text-[7px] text-primary-600 dark:text-primary-400">
										{getFootnoteNumber(batter.substitutions[0].footnote)}
									</sup>
								)}
							</span>
							{batter.substitutions[0].average &&
								batter.substitutions[0].onBasePercentage &&
								batter.substitutions[0].sluggingPercentage && (
									<span className="text-[8px] text-primary-600 dark:text-primary-400">
										{batter.substitutions[0].average}/{batter.substitutions[0].onBasePercentage}/
										{batter.substitutions[0].sluggingPercentage}
									</span>
								)}
						</>
					)}
				</div>
				<div className="flex flex-col px-2 h-6 bg-primary-50 dark:bg-primary-800">
					{batter.substitutions?.[1] && (
						<>
							<span className="font-bold text-2xs text-primary-900 dark:text-primary-100">
								{batter.substitutions[1].player_name}
								{batter.substitutions[1].footnote && (
									<sup className="text-[7px] text-primary-600 dark:text-primary-400">
										{getFootnoteNumber(batter.substitutions[1].footnote)}
									</sup>
								)}
							</span>
							{batter.substitutions[1].average &&
								batter.substitutions[1].onBasePercentage &&
								batter.substitutions[1].sluggingPercentage && (
									<span className="text-[8px] text-primary-600 dark:text-primary-400">
										{batter.substitutions[1].average}/{batter.substitutions[1].onBasePercentage}/
										{batter.substitutions[1].sluggingPercentage}
									</span>
								)}
						</>
					)}
				</div>
			</div>

			{/* Position */}
			<div className="flex flex-col border-r border-primary-300 dark:border-primary-700 h-18">
				{/* Starter position */}
				<div className="flex relative justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.starter_initial_position &&
					batter.starter_final_position &&
					batter.starter_initial_position !== batter.starter_final_position ? (
						<div className="relative w-full h-full">
							{/* Diagonal line */}
							<div className="absolute inset-0">
								<div className="absolute bottom-0 left-0 w-[37.64px] h-px transform origin-bottom-left -rotate-[39.611deg] bg-primary-200 dark:bg-primary-700"></div>
							</div>
							{/* Starting position (upper left) */}
							<div className="absolute top-0.5 left-0.5 text-[8px] font-mono text-primary-900 dark:text-primary-100">
								{batter.starter_initial_position}
							</div>
							{/* Ending position (bottom right) */}
							<div className="absolute bottom-0.5 right-0.5 text-[8px] font-mono text-primary-900 dark:text-primary-100">
								{batter.starter_final_position}
							</div>
						</div>
					) : (
						batter.position
					)}
				</div>

				{/* First substitution position */}
				<div className="flex relative justify-center items-center h-6 font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.substitutions?.[0] && (
						<>
							{/* Check if this substitution had a position change */}
							{batter.substitutions[0].initial_position &&
							batter.substitutions[0].final_position &&
							batter.substitutions[0].initial_position !== batter.substitutions[0].final_position ? (
								<div className="relative w-full h-full">
									{/* Diagonal line */}
									<div className="absolute inset-0">
										<div className="absolute bottom-0 left-0 w-[37.64px] h-px transform origin-bottom-left -rotate-[39.611deg] bg-primary-200 dark:bg-primary-700"></div>
									</div>
									{/* Starting position (upper left) */}
									<div className="absolute top-0.5 left-0.5 text-[8px] font-mono text-primary-900 dark:text-primary-100">
										{batter.substitutions[0].initial_position}
									</div>
									{/* Ending position (bottom right) */}
									<div className="absolute bottom-0.5 right-0.5 text-[8px] font-mono text-primary-900 dark:text-primary-100">
										{batter.substitutions[0].final_position}
									</div>
								</div>
							) : (
								batter.substitutions[0].position || ''
							)}
						</>
					)}
				</div>

				{/* Second substitution position */}
				<div className="flex relative justify-center items-center h-6 font-medium text-2xs text-primary-900 dark:text-primary-100">
					{batter.substitutions?.[1] && (
						<>
							{/* Check if this substitution had a position change */}
							{batter.substitutions[1].initial_position &&
							batter.substitutions[1].final_position &&
							batter.substitutions[1].initial_position !== batter.substitutions[1].final_position ? (
								<div className="relative w-full h-full">
									{/* Diagonal line */}
									<div className="absolute inset-0">
										<div className="absolute bottom-0 left-0 w-[37.64px] h-px transform origin-bottom-left -rotate-[39.611deg] bg-primary-200 dark:bg-primary-700"></div>
									</div>
									{/* Starting position (upper left) */}
									<div className="absolute top-0.5 left-0.5 text-[8px] font-mono text-primary-900 dark:text-primary-100">
										{batter.substitutions[1].initial_position}
									</div>
									{/* Ending position (bottom right) */}
									<div className="absolute bottom-0.5 right-0.5 text-[8px] font-mono text-primary-900 dark:text-primary-100">
										{batter.substitutions[1].final_position}
									</div>
								</div>
							) : (
								batter.substitutions[1].position || ''
							)}
						</>
					)}
				</div>
			</div>

			{/* Inning Columns */}
			{Array.from({ length: displayInnings }, (_, i) => {
				const inningNumber = i + 1;
				const substitutionInning = batter.substitutions?.[0]?.inning || 0;
				const substitutionType = batter.substitutions?.[0]?.substitution_type;
				const isLastInning = i === displayInnings - 1;

				// Get at-bat results for this inning
				const atBatResults = getAtBatResultsForInning(batter, inningNumber, detailedData);

				// Determine border styling based on substitution type
				let borderClass = isLastInning
					? 'border-primary-200 dark:border-primary-700'
					: 'border-r border-primary-200 dark:border-primary-700';
				if (inningNumber === substitutionInning) {
					if (substitutionType === 'PH' || substitutionType === 'DEF') {
						borderClass = isLastInning
							? 'border-l-2 border-l-primary-900 border-primary-200 dark:border-primary-700'
							: 'border-r border-l-2 border-l-primary-900 border-primary-200 dark:border-primary-700';
					} else if (substitutionType === 'PR') {
						borderClass = isLastInning
							? 'border-r-2 border-r-primary-900 border-primary-200 dark:border-primary-700'
							: 'border-r border-r-2 border-r-primary-900 border-primary-200 dark:border-primary-700';
					}
				}

				// Add bottom border if this was the last at-bat of the inning
				if (atBatResults.some((result) => result.endedInning)) {
					borderClass += ' border-b-2 border-b-primary-900';
				}

				return (
					<div key={i} className={`flex flex-col justify-center items-center h-fill w-fill ${borderClass}`}>
						{/* Display at-bat results */}
						{atBatResults.map((result, resultIndex) => (
							<div key={resultIndex} className="flex justify-center items-center w-full h-full">
								<span className="font-mono font-medium text-2xs text-primary-900 dark:text-primary-100">
									{result.atBatResult}
								</span>
							</div>
						))}
						{/* Show empty cell if no at-bats */}
						{atBatResults.length === 0 && (
							<div className="flex justify-center items-center w-full h-full">
								<span className="text-2xs text-primary-400 dark:text-primary-600"></span>
							</div>
						)}
					</div>
				);
			})}

			{/* Stats Columns */}
			<div className="flex flex-col border-r border-l border-l-primary-300 dark:border-l-primary-800 border-r-primary-200 dark:border-r-primary-700 h-18">
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.at_bats || 0}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.substitutions?.[0]?.at_bats || 0}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium text-2xs text-primary-900 dark:text-primary-100">
					{batter.substitutions?.[1]?.at_bats || 0}
				</div>
			</div>
			<div className="flex flex-col border-r border-primary-200 dark:border-primary-700 h-18">
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.hits || 0}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.substitutions?.[0]?.hits || 0}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium text-2xs text-primary-900 dark:text-primary-100">
					{batter.substitutions?.[1]?.hits || 0}
				</div>
			</div>
			<div className="flex flex-col border-r border-primary-200 dark:border-primary-700 h-18">
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.runs || 0}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.substitutions?.[0]?.runs || 0}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium text-2xs text-primary-900 dark:text-primary-100">
					{batter.substitutions?.[1]?.runs || 0}
				</div>
			</div>
			<div className="flex flex-col border-r border-primary-200 dark:border-primary-700 h-18">
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.rbi || 0}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.substitutions?.[0]?.rbi || 0}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium text-2xs text-primary-900 dark:text-primary-100">
					{batter.substitutions?.[1]?.rbi || 0}
				</div>
			</div>
			<div className="flex flex-col border-r border-primary-200 dark:border-primary-700 h-18">
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.walks || 0}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.substitutions?.[0]?.walks || 0}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium text-2xs text-primary-900 dark:text-primary-100">
					{batter.substitutions?.[1]?.walks || 0}
				</div>
			</div>
			<div className="flex flex-col h-18">
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.strikeouts || 0}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.substitutions?.[0]?.strikeouts || 0}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium text-2xs text-primary-900 dark:text-primary-100">
					{batter.substitutions?.[1]?.strikeouts || 0}
				</div>
			</div>
		</div>
	);
};

interface DetailedGameData {
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
	innings: InningData[];
	batters: {
		away: BatterData[];
		home: BatterData[];
	};
	pitchers: {
		away: PitcherData[];
		home: PitcherData[];
	};
	events: GameEvent[];
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
	start_time?: string;
	end_time?: string;
	weather?: string | { condition: string };
	wind?: string;
	uniforms?: {
		away: string;
		home: string;
	};
	total_away_runs?: number;
	total_home_runs?: number;
	// Play-by-play data
	play_by_play?: {
		atBats: Map<string, any[]>;
		substitutions: Map<string, any[]>;
		inningResults: Map<string, any[]>;
	};
}

interface InningData {
	inning: number;
	away_runs: number;
	home_runs: number;
	top_events: PlateAppearance[];
	bottom_events: PlateAppearance[];
}

interface PlateAppearance {
	batter: string;
	batter_number?: string | number;
	pitcher: string;
	pitcher_number?: string | number;
	description: string;
	summary: string;
	got_on_base: boolean;
	at_bat_result: string;
	pitches: PitchData[];
}

interface PitchData {
	pitch_type: string;
	velocity?: number;
	result: string;
	description: string;
}

interface BatterData {
	name: string;
	position: string;
	number?: string | number;
	at_bats?: number;
	hits?: number;
	runs?: number;
	rbi?: number;
	walks?: number;
	strikeouts?: number;
	// Substitution data
	batting_order?: string;
	is_substitute?: boolean;
	substitutions?: SubstitutionData[];
	// Starter position tracking
	starter_initial_position?: string;
	starter_final_position?: string;
	// Team information
	isAway?: boolean;
	// Slash line data
	average?: string;
	onBasePercentage?: string;
	sluggingPercentage?: string;
}

interface SubstitutionData {
	player_name: string;
	player_number: string;
	position: string;
	substitution_type: 'PH' | 'PR' | 'DEF'; // Pinch Hit, Pinch Run, Defensive Sub
	inning: number;
	half_inning: 'top' | 'bottom';
	replaced_player?: string;
	footnote?: string;
	// Additional fields for position tracking
	initial_position?: string; // The position they first entered at
	final_position?: string; // The position they ended the game at
	position_changes?: Array<{
		inning: number;
		half_inning: 'top' | 'bottom';
		from_position: string;
		to_position: string;
	}>;
	// Stats for substitute players
	at_bats?: number;
	hits?: number;
	runs?: number;
	rbi?: number;
	walks?: number;
	strikeouts?: number;
	// Slash line data for substitute players
	average?: string;
	onBasePercentage?: string;
	sluggingPercentage?: string;
}

interface PitcherData {
	name: string;
	position: string;
	number?: string | number;
	innings_pitched?: number;
	pitches?: number;
	batters_faced?: number;
	hits?: number;
	runs?: number;
	earned_runs?: number;
	walks?: number;
	strikeouts?: number;
	handedness?: 'L' | 'R' | 'S';
	wls?: 'W' | 'L' | 'S' | '';
	intentional_walks?: number;
	hit_by_pitch?: number;
	balks?: number;
	wild_pitches?: number;
	homeruns?: number;
	total_pitches?: number;
	strikes?: number;
	era?: number;
	whip?: number;
}

interface GameEvent {
	inning: number;
	half_inning: 'top' | 'bottom';
	event_type: string;
	description: string;
	batter: string;
	pitcher: string;
}

const TraditionalScorecard = memo(function TraditionalScorecard({ gameData, gameId }: TraditionalScorecardProps) {
	const [detailedData, setDetailedData] = useState<DetailedGameData | null>(null);
	const [loading, setLoading] = useState(false);
	const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

	// Memoize the team logo components to prevent unnecessary re-renders
	const awayTeamLogo = useMemo(() => {
		return getTeamLogo(gameData.game_data.away_team.abbreviation);
	}, [gameData.game_data.away_team.abbreviation]);

	const homeTeamLogo = useMemo(() => {
		return getTeamLogo(gameData.game_data.home_team.abbreviation);
	}, [gameData.game_data.home_team.abbreviation]);

	// Memoize the inning data processing
	const processedInnings = useMemo(() => {
		return gameData.game_data.inning_list || [];
	}, [gameData.game_data.inning_list]);

	useEffect(() => {
		// Component initialized
	}, [gameData, gameId]);

	useEffect(() => {
		fetchDetailedData();
	}, [gameId]);

	useEffect(() => {
		if (detailedData) {
			// Detailed data updated
		}
	}, [detailedData]);

	const fetchDetailedData = useCallback(async () => {
		setLoading(true);
		try {
			// Fetch detailed game data from the MLB API
			const detailedGameData = await getGameDetails(gameId);

			// Transform the detailed GameData to DetailedGameData format
			const transformedData: DetailedGameData = {
				game_id: detailedGameData.game_id,
				date: detailedGameData.game_data.game_date_str,
				away_team: detailedGameData.game_data.away_team,
				home_team: detailedGameData.game_data.home_team,
				venue: detailedGameData.game_data.location,
				status: detailedGameData.game_data.status || 'Unknown',
				innings: detailedGameData.game_data.inning_list.map((inning: any) => ({
					inning: inning.inning,
					away_runs: inning.away || 0,
					home_runs: inning.home || 0,
					events: [],
					top_events: [],
					bottom_events: [],
				})),
				batters: {
					away: processBatterData(
						detailedGameData.game_data.player_stats?.away?.batters || [],
						detailedGameData.game_data.player_stats?.away?.pitchers || [],
						true,
						detailedGameData.game_data.player_stats?.away?.batters || []
					),
					home: processBatterData(
						detailedGameData.game_data.player_stats?.home?.batters || [],
						detailedGameData.game_data.player_stats?.home?.pitchers || [],
						false,
						detailedGameData.game_data.player_stats?.home?.batters || []
					),
				},
				pitchers: (() => {
					console.log('Processing pitcher data:', {
						hasAwayPitchers: !!detailedGameData.game_data.player_stats?.away?.pitchers,
						awayPitchersCount: detailedGameData.game_data.player_stats?.away?.pitchers?.length || 0,
						hasHomePitchers: !!detailedGameData.game_data.player_stats?.home?.pitchers,
						homePitchersCount: detailedGameData.game_data.player_stats?.home?.pitchers?.length || 0,
						playerStats: detailedGameData.game_data.player_stats,
					});

					// Debug: Log the actual pitcher data we're receiving
					if (detailedGameData.game_data.player_stats?.away?.pitchers) {
						console.log(
							'Away pitchers raw data (full objects):',
							detailedGameData.game_data.player_stats.away.pitchers
						);
						console.log(
							'Away pitchers summary:',
							detailedGameData.game_data.player_stats.away.pitchers.map((p) => ({
								name: p.name,
								innings_pitched: p.innings_pitched,
								era: p.era,
								number: (p as any).jersey_number || (p as any).number || '0',
								allKeys: Object.keys(p),
							}))
						);

						// Log the first pitcher object in detail
						if (detailedGameData.game_data.player_stats.away.pitchers.length > 0) {
							console.log('First away pitcher object:', detailedGameData.game_data.player_stats.away.pitchers[0]);
						}
					}

					if (detailedGameData.game_data.player_stats?.home?.pitchers) {
						console.log(
							'Home pitchers raw data (full objects):',
							detailedGameData.game_data.player_stats.home.pitchers
						);
						console.log(
							'Home pitchers summary:',
							detailedGameData.game_data.player_stats.home.pitchers.map((p) => ({
								name: p.name,
								innings_pitched: p.innings_pitched,
								era: p.era,
								number: (p as any).jersey_number || (p as any).number || '0',
								allKeys: Object.keys(p),
							}))
						);

						// Log the first pitcher object in detail
						if (detailedGameData.game_data.player_stats.home.pitchers.length > 0) {
							console.log('First home pitcher object:', detailedGameData.game_data.player_stats.home.pitchers[0]);
						}
					}

					// Debug: Check if we have valid pitcher data
					const hasValidAwayPitchers =
						detailedGameData.game_data.player_stats?.away?.pitchers &&
						detailedGameData.game_data.player_stats.away.pitchers.length > 0 &&
						detailedGameData.game_data.player_stats.away.pitchers.some((p) => p.name && p.name !== 'Unknown Pitcher');

					const hasValidHomePitchers =
						detailedGameData.game_data.player_stats?.home?.pitchers &&
						detailedGameData.game_data.player_stats.home.pitchers.length > 0 &&
						detailedGameData.game_data.player_stats.home.pitchers.some((p) => p.name && p.name !== 'Unknown Pitcher');

					console.log('Pitcher validation:', {
						hasAwayPitchers: !!detailedGameData.game_data.player_stats?.away?.pitchers,
						awayPitchersLength: detailedGameData.game_data.player_stats?.away?.pitchers?.length,
						hasValidAwayPitchers,
						hasHomePitchers: !!detailedGameData.game_data.player_stats?.home?.pitchers,
						homePitchersLength: detailedGameData.game_data.player_stats?.home?.pitchers?.length,
						hasValidHomePitchers,
					});

					return hasValidAwayPitchers && hasValidHomePitchers
						? {
								away: (detailedGameData.game_data.player_stats?.away?.pitchers || []).map((pitcher: any) => {
									const innings = pitcher.innings_pitched || 0;
									const earnedRuns = pitcher.earned_runs || 0;
									const hits = pitcher.hits || 0;
									const walks = pitcher.walks || 0;

									// Calculate ERA (earned runs per 9 innings)
									const era = innings > 0 ? (earnedRuns * 9) / innings : 0;

									// Calculate WHIP (walks + hits per inning pitched)
									const whip = innings > 0 ? (walks + hits) / innings : 0;

									return {
										name: pitcher.name || 'Unknown Pitcher',
										position: 'P',
										innings_pitched: innings,
										hits: hits,
										runs: pitcher.runs || 0,
										earned_runs: earnedRuns,
										walks: walks,
										strikeouts: pitcher.strikeouts || 0,
										number: pitcher.jersey_number ? String(pitcher.jersey_number) : '0',
										handedness: pitcher.handedness || 'R',
										wls: pitcher.wls || '',
										batters_faced: pitcher.batters_faced || 0,
										intentional_walks: pitcher.intentional_walks || 0,
										hit_by_pitch: pitcher.hit_by_pitch || 0,
										balks: pitcher.balks || 0,
										wild_pitches: pitcher.wild_pitches || 0,
										homeruns: pitcher.homeruns || 0,
										total_pitches: pitcher.total_pitches || 0,
										strikes: pitcher.strikes || 0,
										era: Math.round(era * 100) / 100, // Round to 2 decimal places
										whip: Math.round(whip * 100) / 100, // Round to 2 decimal places
									};
								}),
								home: (detailedGameData.game_data.player_stats?.home?.pitchers || []).map((pitcher: any) => {
									const innings = pitcher.innings_pitched || 0;
									const earnedRuns = pitcher.earned_runs || 0;
									const hits = pitcher.hits || 0;
									const walks = pitcher.walks || 0;

									// Calculate ERA (earned runs per 9 innings)
									const era = innings > 0 ? (earnedRuns * 9) / innings : 0;

									// Calculate WHIP (walks + hits per inning pitched)
									const whip = innings > 0 ? (walks + hits) / innings : 0;

									return {
										name: pitcher.name || 'Unknown Pitcher',
										position: 'P',
										innings_pitched: innings,
										hits: hits,
										runs: pitcher.runs || 0,
										earned_runs: earnedRuns,
										walks: walks,
										strikeouts: pitcher.strikeouts || 0,
										number: pitcher.jersey_number ? String(pitcher.jersey_number) : '0',
										handedness: pitcher.handedness || 'R',
										wls: pitcher.wls || '',
										batters_faced: pitcher.batters_faced || 0,
										intentional_walks: pitcher.intentional_walks || 0,
										hit_by_pitch: pitcher.hit_by_pitch || 0,
										balks: pitcher.balks || 0,
										wild_pitches: pitcher.wild_pitches || 0,
										homeruns: pitcher.homeruns || 0,
										total_pitches: pitcher.total_pitches || 0,
										strikes: pitcher.strikes || 0,
										era: Math.round(era * 100) / 100, // Round to 2 decimal places
										whip: Math.round(whip * 100) / 100, // Round to 2 decimal places
									};
								}),
						  }
						: { away: [], home: [] };
				})(),
				events: [],
				umpires: gameData.game_data.umpires || [],
				managers: gameData.game_data.managers || { away: 'Manager A', home: 'Manager B' },
				start_time: gameData.game_data.start_time || '7:05 PM',
				end_time: gameData.game_data.end_time || 'Duration: 3:15',
				weather: gameData.game_data.weather || 'Clear, 72°F',
				wind: gameData.game_data.wind || '5 mph, Out to LF',
				uniforms: gameData.game_data.uniforms
					? {
							away: gameData.game_data.uniforms.away || '',
							home: gameData.game_data.uniforms.home || '',
					  }
					: { away: '', home: '' },
				total_away_runs: gameData.game_data.total_away_runs,
				total_home_runs: gameData.game_data.total_home_runs,
			};

			setDetailedData(transformedData);
		} catch (error) {
			console.error('Error fetching detailed data:', error);
		} finally {
			setLoading(false);
		}
	}, [gameData]);

	const renderPitcherTable = useCallback((pitchers: PitcherData[], teamName: string) => {
		console.log(`Rendering pitcher table for ${teamName}:`, pitchers);

		// Always show minimum 4 rows, but show as many as needed for actual pitchers
		const minRows = 4;
		const displayPitchers = [...pitchers];
		while (displayPitchers.length < minRows) {
			displayPitchers.push({
				name: '',
				position: 'P',
				number: '',
				innings_pitched: 0,
				hits: 0,
				runs: 0,
				earned_runs: 0,
				walks: 0,
				strikeouts: 0,
				handedness: 'R',
				wls: '',
				batters_faced: 0,
				intentional_walks: 0,
				hit_by_pitch: 0,
				balks: 0,
				wild_pitches: 0,
				homeruns: 0,
				total_pitches: 0,
				strikes: 0,
				era: 0,
				whip: 0,
			});
		}

		return (
			<div className="w-1/2 border-r border-b border-primary-400 dark:border-primary-800">
				<div className="overflow-x-auto">
					{/* Column Headers */}
					<div
						className="grid gap-0 border-b border-primary-300 dark:border-primary-800"
						style={{
							gridTemplateColumns: '40px 200px 30px 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr',
						}}>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							#
						</div>
						<div className="flex justify-center items-center h-8 text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							PITCHERS
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-300 dark:border-primary-800 text-primary-900 dark:text-primary-100">
							R/L
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							IP
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							P(S)
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							BF
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							H
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							R
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							ER
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							BB
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-300 dark:border-primary-800 text-primary-900 dark:text-primary-100">
							K
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold text-primary-900 dark:text-primary-100">
							WSL
						</div>
					</div>

					{/* Pitcher Rows */}
					{displayPitchers.map((pitcher, index) => (
						<div
							key={index}
							className={`grid gap-0 ${
								index === displayPitchers.length - 1 ? '' : 'border-b border-primary-200 dark:border-primary-700'
							}`}
							style={{
								gridTemplateColumns: '40px 200px 30px 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr',
							}}>
							{/* Pitcher Number */}
							<div className="flex justify-center items-center h-8 font-mono font-medium border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
								{pitcher.name ? pitcher.number || index + 1 : ''}
							</div>

							{/* Pitcher Name */}
							<div className="flex justify-between items-center px-2 h-8 border-r border-primary-200 dark:border-primary-700 bg-primary-50 dark:bg-primary-800">
								<span className="flex-1 min-w-0 font-medium truncate text-2xs text-primary-900 dark:text-primary-100">
									{pitcher.name || ''}
								</span>
								{pitcher.name && (
									<span className="flex-shrink-0 ml-2 font-normal text-2xs text-primary-600 dark:text-primary-400">
										{pitcher.era?.toFixed(2) || '0.00'}
									</span>
								)}
							</div>

							{/* Handedness */}
							<div className="flex justify-center items-center h-8 font-mono font-medium border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-300 dark:border-primary-800">
								{pitcher.name ? pitcher.handedness || 'R' : ''}
							</div>

							{/* Innings Pitched */}
							<div className="flex justify-center items-center h-8 font-mono font-medium border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
								{pitcher.name ? pitcher.innings_pitched?.toFixed(1) || '0.0' : ''}
							</div>

							{/* Total Pitches (Strikes) */}
							<div className="flex justify-center items-center h-8 font-mono font-medium border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
								{pitcher.name
									? pitcher.total_pitches
										? `${pitcher.total_pitches}(${pitcher.strikes || 0})`
										: '0(0)'
									: ''}
							</div>

							{/* Batters Faced */}
							<div className="flex justify-center items-center h-8 font-mono font-medium border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
								{pitcher.name ? pitcher.batters_faced || 0 : ''}
							</div>

							{/* Hits */}
							<div className="flex justify-center items-center h-8 font-mono font-medium border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
								{pitcher.name ? pitcher.hits || 0 : ''}
							</div>

							{/* Runs */}
							<div className="flex justify-center items-center h-8 font-mono font-medium border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
								{pitcher.name ? pitcher.runs || 0 : ''}
							</div>

							{/* Earned Runs */}
							<div className="flex justify-center items-center h-8 font-mono font-medium border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
								{pitcher.name ? pitcher.earned_runs || 0 : ''}
							</div>

							{/* Walks */}
							<div className="flex justify-center items-center h-8 font-mono font-medium border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
								{pitcher.name ? pitcher.walks || 0 : ''}
							</div>

							{/* Strikeouts */}
							<div className="flex justify-center items-center h-8 font-mono font-medium border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-300 dark:border-primary-800">
								{pitcher.name ? pitcher.strikeouts || 0 : ''}
							</div>

							{/* WLS */}
							<div className="flex justify-center items-center h-8 font-mono font-bold text-2xs text-primary-900 dark:text-primary-100">
								{pitcher.name ? pitcher.wls || '' : ''}
							</div>
						</div>
					))}

					{/* Pitcher Summary Row */}
					<div
						className="grid gap-0 border-t border-primary-300 dark:border-primary-800"
						style={{
							gridTemplateColumns: '40px 200px 30px 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr',
						}}>
						{/* Combined first three columns */}
						<div className="flex col-span-3 justify-end items-center px-2 h-8 font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-300 dark:border-primary-800 bg-primary-50 dark:bg-primary-800">
							TOTALS
						</div>

						{/* IP Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
							{displayPitchers.reduce((sum, pitcher) => sum + (pitcher.innings_pitched || 0), 0).toFixed(1)}
						</div>

						{/* P(S) Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
							{(() => {
								const totalPitches = displayPitchers.reduce((sum, pitcher) => sum + (pitcher.total_pitches || 0), 0);
								const totalStrikes = displayPitchers.reduce((sum, pitcher) => sum + (pitcher.strikes || 0), 0);
								return `${totalPitches}(${totalStrikes})`;
							})()}
						</div>

						{/* BF Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
							{displayPitchers.reduce((sum, pitcher) => sum + (pitcher.batters_faced || 0), 0)}
						</div>

						{/* H Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
							{displayPitchers.reduce((sum, pitcher) => sum + (pitcher.hits || 0), 0)}
						</div>

						{/* R Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
							{displayPitchers.reduce((sum, pitcher) => sum + (pitcher.runs || 0), 0)}
						</div>

						{/* ER Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
							{displayPitchers.reduce((sum, pitcher) => sum + (pitcher.earned_runs || 0), 0)}
						</div>

						{/* BB Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
							{displayPitchers.reduce((sum, pitcher) => sum + (pitcher.walks || 0), 0)}
						</div>

						{/* K Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-300 dark:border-primary-800">
							{displayPitchers.reduce((sum, pitcher) => sum + (pitcher.strikeouts || 0), 0)}
						</div>

						{/* WSL Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold text-2xs text-primary-900 dark:text-primary-100">
							{/* WLS doesn't have a meaningful total, so leave empty */}
						</div>
					</div>
				</div>
			</div>
		);
	}, []);

	const renderScorecardGrid = useCallback(() => {
		if (!detailedData) return null;

		// Only show extra innings if there's actual data for them
		const inningsWithData = detailedData.innings.map((i) => i.inning);
		const maxInnings = inningsWithData.length > 0 ? Math.max(...inningsWithData) : 9;
		const displayInnings = Math.max(9, maxInnings); // Always show at least 9 innings

		return (
			<div className="overflow-x-auto min-w-[1300px]">
				{/* TOP Scorecard (Away Team) */}
				<div className="border-b border-primary-400 dark:border-primary-800">
					{/* TOP Header Fields */}
					<div
						className="grid grid-rows-2 gap-0 border-b border-primary-300 dark:border-primary-800"
						style={{ gridTemplateColumns: '120px 64px 1fr 1fr 1fr 1fr' }}>
						{/* TOP Label - spans both rows */}
						<div className="relative row-span-2 border-r border-primary-300 dark:border-primary-800">
							<div className="flex justify-start items-center px-2 h-16">
								<span className="text-2xl font-bold text-primary-900 dark:text-primary-100 font-display">TOP</span>
							</div>
						</div>

						{/* Logo Field - spans both rows */}
						<div className="flex relative row-span-2 justify-center items-center border-r border-primary-200 dark:border-primary-700">
							<div className="flex justify-center items-center w-16 h-16">
								{getTeamLogo(detailedData?.away_team?.abbreviation || '')}
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									LOGO
								</span>
							</div>
						</div>

						{/* Top Row Fields */}
						<div className="relative col-span-2 border-r border-primary-200 dark:border-primary-700">
							<div className="flex items-center px-2 h-8 border-b border-primary-200 dark:border-primary-700">
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									AWAY TEAM
								</span>
								<span className="font-medium text-primary-900 dark:text-primary-100">
									{detailedData.away_team.name}
								</span>
							</div>
						</div>
						<div className="relative border-r border-primary-200 dark:border-primary-700">
							<div className="flex items-center px-2 h-8 border-b border-primary-200 dark:border-primary-700">
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									START TIME
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">
									{detailedData?.start_time || 'TBD'}
								</span>
							</div>
						</div>
						<div className="relative">
							<div className="flex items-center px-2 h-8 border-b border-primary-200 dark:border-primary-700">
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									WEATHER
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">
									{typeof detailedData?.weather === 'object'
										? detailedData.weather.condition
										: detailedData?.weather || 'TBD'}
								</span>
							</div>
						</div>

						{/* Bottom Row Fields */}
						<div className="relative border-r border-primary-200 dark:border-primary-700">
							<div className="flex items-center px-2 h-8">
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									MANAGER
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">
									{detailedData?.managers?.away || 'TBD'}
								</span>
							</div>
						</div>
						<div className="relative border-r border-primary-200 dark:border-primary-700">
							<div className="flex items-center px-2 h-8">
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									UNIFORM
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">
									{detailedData?.uniforms?.away
										? detailedData.uniforms.away
												.replace(/\([^)]*\)/g, '') // Remove parentheses and content
												.replace(/"[^"]*"/g, '') // Remove quotes and content
												.replace(/\b(Blue Jays|Rays|Jersey|Jerseys?)\b/gi, '') // Remove team names and "Jersey"
												.replace(/\s+/g, ' ') // Clean up extra spaces
												.trim()
										: 'TBD'}
								</span>
							</div>
						</div>
						<div className="relative border-r border-primary-200 dark:border-primary-700">
							<div className="flex items-center px-2 h-8">
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									END TIME
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">
									{detailedData?.end_time || 'TBD'}
								</span>
							</div>
						</div>
						<div className="relative">
							<div className="flex items-center px-2 h-8">
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									WIND
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">{detailedData?.wind || 'TBD'}</span>
							</div>
						</div>
					</div>

					{/* Column Headers */}
					<div
						className="grid gap-0 border-b border-primary-300 dark:border-primary-800"
						style={{
							gridTemplateColumns: `40px 200px 30px ${Array(displayInnings)
								.fill('1fr')
								.join(' ')} 45px 45px 45px 45px 45px 45px`,
						}}>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							#
						</div>
						<div className="flex justify-center items-center h-8 text-xs font-bold border-r border-primary-200 dark:border-primary-800 text-primary-900 dark:text-primary-100">
							BATTERS
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-300 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							POS
						</div>
						{Array.from({ length: displayInnings }, (_, i) => {
							const isLastInning = i === displayInnings - 1;
							return (
								<div
									key={i}
									className={`flex justify-center items-center h-8 text-xs font-bold text-primary-900 dark:text-primary-100 ${
										isLastInning
											? 'border-primary-200 dark:border-primary-700'
											: 'border-r border-primary-200 dark:border-primary-700'
									}`}>
									{i + 1}
								</div>
							);
						})}
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-l border-l-primary-300 dark:border-l-primary-800 border-r-primary-200 dark:border-r-primary-700 text-primary-900 dark:text-primary-100">
							AB
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							H
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							R
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							RBI
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							BB
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold text-primary-900 dark:text-primary-100">
							SO
						</div>
					</div>

					{/* Away Team Batters */}
					{detailedData.batters.away.map((batter, index) => (
						<BatterRow
							key={index}
							batter={batter}
							index={index}
							displayInnings={displayInnings}
							isAway={true}
							isLastRow={index === detailedData.batters.away.length - 1}
							detailedData={detailedData}
						/>
					))}

					{/* Away Team Batters Summary Row */}
					<div
						className="grid gap-0 border-t border-primary-300 dark:border-primary-800"
						style={{
							gridTemplateColumns: `40px 200px 30px ${Array(displayInnings)
								.fill('1fr')
								.join(' ')} 45px 45px 45px 45px 45px 45px`,
						}}>
						{/* Combined first three columns */}
						<div className="flex col-span-3 justify-end items-center px-2 h-8 font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-300 dark:border-primary-800 bg-primary-50 dark:bg-primary-800">
							R/H/LOB/E
						</div>

						{/* Inning columns with R/H/LOB/E totals */}
						{Array.from({ length: displayInnings }, (_, i) => {
							const inningRuns = detailedData.batters.away.reduce((sum, batter) => sum + (batter.runs || 0), 0);
							const inningHits = detailedData.batters.away.reduce((sum, batter) => sum + (batter.hits || 0), 0);
							const inningLOB = 0; // Would need to calculate from game data
							const inningErrors = 0; // Would need to calculate from game data
							const isLastInning = i === displayInnings - 1;
							return (
								<div
									key={i}
									className={`flex justify-center items-center h-8 font-mono font-bold text-2xs text-primary-900 dark:text-primary-100 ${
										isLastInning
											? 'border-primary-200 dark:border-primary-700'
											: 'border-r border-primary-200 dark:border-primary-700'
									}`}>
									{`${inningRuns}/${inningHits}/${inningLOB}/${inningErrors}`}
								</div>
							);
						})}

						{/* AB Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold border-r border-l text-2xs text-primary-900 dark:text-primary-100 border-l-primary-300 dark:border-l-primary-800 border-r-primary-200 dark:border-r-primary-700">
							{detailedData.batters.away.reduce((sum, batter) => sum + (batter.at_bats || 0), 0)}
						</div>

						{/* H Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
							{detailedData.batters.away.reduce((sum, batter) => sum + (batter.hits || 0), 0)}
						</div>

						{/* R Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
							{detailedData.batters.away.reduce((sum, batter) => sum + (batter.runs || 0), 0)}
						</div>

						{/* RBI Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
							{detailedData.batters.away.reduce((sum, batter) => sum + (batter.rbi || 0), 0)}
						</div>

						{/* BB Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
							{detailedData.batters.away.reduce((sum, batter) => sum + (batter.walks || 0), 0)}
						</div>

						{/* SO Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold text-2xs text-primary-900 dark:text-primary-100">
							{detailedData.batters.away.reduce((sum, batter) => sum + (batter.strikeouts || 0), 0)}
						</div>
					</div>
				</div>

				{/* Away Team Pitcher Table */}
				<div className="mb-4">{renderPitcherTable(detailedData.pitchers.away, detailedData.away_team.name)}</div>

				{/* Away Team Footnotes */}
				{renderAwayFootnotes()}

				{/* BOTTOM Scorecard (Home Team) */}
				<div className="border-b border-primary-400 dark:border-primary-800">
					{/* BOTTOM Header Fields */}
					<div
						className="grid grid-rows-2 gap-0 border-b border-primary-300 dark:border-primary-800"
						style={{ gridTemplateColumns: '120px 64px 1fr 1fr 1fr 1fr' }}>
						{/* BOTTOM Label - spans both rows */}
						<div className="relative row-span-2 border-r border-primary-300 dark:border-primary-800">
							<div className="flex justify-start items-center px-2 h-16">
								<span className="text-2xl font-bold text-primary-900 dark:text-primary-100 font-display">BOTTOM</span>
							</div>
						</div>

						{/* Logo Field - spans both rows */}
						<div className="flex relative row-span-2 justify-center items-center border-r border-primary-200 dark:border-primary-700">
							<div className="flex justify-center items-center w-16 h-16">
								{getTeamLogo(detailedData?.home_team?.abbreviation || '')}
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									LOGO
								</span>
							</div>
						</div>

						{/* Top Row Fields */}
						<div className="relative col-span-2 border-r border-primary-200 dark:border-primary-700">
							<div className="flex items-center px-2 h-8 border-b border-primary-200 dark:border-primary-700">
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									HOME TEAM
								</span>
								<span className="font-medium text-primary-900 dark:text-primary-100">
									{detailedData.home_team.name}
								</span>
							</div>
						</div>
						<div className="relative border-r border-primary-200 dark:border-primary-700">
							<div className="flex items-center px-2 h-8 border-b border-primary-200 dark:border-primary-700">
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									HP UMPIRE
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">
									{detailedData?.umpires?.find((u) => u.position === 'HP')?.name || 'TBD'}
								</span>
							</div>
						</div>
						<div className="relative">
							<div className="flex items-center px-2 h-8 border-b border-primary-200 dark:border-primary-700">
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									1B UMPIRE
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">
									{detailedData?.umpires?.find((u) => u.position === '1B')?.name || 'TBD'}
								</span>
							</div>
						</div>

						{/* Bottom Row Fields */}
						<div className="relative border-r border-primary-200 dark:border-primary-700">
							<div className="flex items-center px-2 h-8">
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									MANAGER
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">
									{detailedData?.managers?.home || 'TBD'}
								</span>
							</div>
						</div>
						<div className="relative border-r border-primary-200 dark:border-primary-700">
							<div className="flex items-center px-2 h-8">
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									UNIFORM
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">
									{detailedData?.uniforms?.home
										? detailedData.uniforms.home
												.replace(/\([^)]*\)/g, '') // Remove parentheses and content
												.replace(/"[^"]*"/g, '') // Remove quotes and content
												.replace(/\b(Blue Jays|Rays|Jersey|Jerseys?)\b/gi, '') // Remove team names and "Jersey"
												.replace(/\s+/g, ' ') // Clean up extra spaces
												.trim()
										: 'TBD'}
								</span>
							</div>
						</div>
						<div className="relative border-r border-primary-200 dark:border-primary-700">
							<div className="flex items-center px-2 h-8">
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									2B UMPIRE
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">
									{detailedData?.umpires?.find((u) => u.position === '2B')?.name || 'TBD'}
								</span>
							</div>
						</div>
						<div className="relative">
							<div className="flex items-center px-2 h-8">
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									3B UMPIRE
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">
									{detailedData?.umpires?.find((u) => u.position === '3B')?.name || 'TBD'}
								</span>
							</div>
						</div>
					</div>

					{/* Column Headers */}
					<div
						className="grid gap-0 border-b border-primary-300 dark:border-primary-800"
						style={{
							gridTemplateColumns: `40px 200px 30px ${Array(displayInnings)
								.fill('1fr')
								.join(' ')} 45px 45px 45px 45px 45px 45px`,
						}}>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							#
						</div>
						<div className="flex justify-center items-center h-8 text-xs font-bold border-r border-primary-200 dark:border-primary-800 text-primary-900 dark:text-primary-100">
							BATTERS
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-300 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							POS
						</div>
						{Array.from({ length: displayInnings }, (_, i) => {
							const isLastInning = i === displayInnings - 1;
							return (
								<div
									key={i}
									className={`flex justify-center items-center h-8 text-xs font-bold text-primary-900 dark:text-primary-100 ${
										isLastInning
											? 'border-primary-200 dark:border-primary-700'
											: 'border-r border-primary-200 dark:border-primary-700'
									}`}>
									{i + 1}
								</div>
							);
						})}
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-l border-l-primary-300 dark:border-l-primary-800 border-r-primary-200 dark:border-r-primary-700 text-primary-900 dark:text-primary-100">
							AB
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							H
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							R
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							RBI
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							BB
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold text-primary-900 dark:text-primary-100">
							SO
						</div>
					</div>

					{/* Home Team Batters */}
					{detailedData.batters.home.map((batter, index) => (
						<BatterRow
							key={index}
							batter={batter}
							index={index}
							displayInnings={displayInnings}
							isAway={false}
							isLastRow={index === detailedData.batters.home.length - 1}
							detailedData={detailedData}
						/>
					))}

					{/* Home Team Batters Summary Row */}
					<div
						className="grid gap-0 border-t border-primary-300 dark:border-primary-800"
						style={{
							gridTemplateColumns: `40px 200px 30px ${Array(displayInnings)
								.fill('1fr')
								.join(' ')} 45px 45px 45px 45px 45px 45px`,
						}}>
						{/* Combined first three columns */}
						<div className="flex col-span-3 justify-end items-center px-2 h-8 font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-300 dark:border-primary-800 bg-primary-50 dark:bg-primary-800">
							R/H/LOB/E
						</div>

						{/* Inning columns with R/H/LOB/E totals */}
						{Array.from({ length: displayInnings }, (_, i) => {
							const inningRuns = detailedData.batters.home.reduce((sum, batter) => sum + (batter.runs || 0), 0);
							const inningHits = detailedData.batters.home.reduce((sum, batter) => sum + (batter.hits || 0), 0);
							const inningLOB = 0; // Would need to calculate from game data
							const inningErrors = 0; // Would need to calculate from game data
							const isLastInning = i === displayInnings - 1;
							return (
								<div
									key={i}
									className={`flex justify-center items-center h-8 font-mono font-bold text-2xs text-primary-900 dark:text-primary-100 ${
										isLastInning
											? 'border-primary-200 dark:border-primary-700'
											: 'border-r border-primary-200 dark:border-primary-700'
									}`}>
									{`${inningRuns}/${inningHits}/${inningLOB}/${inningErrors}`}
								</div>
							);
						})}

						{/* AB Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold border-r border-l text-2xs text-primary-900 dark:text-primary-100 border-l-primary-300 dark:border-l-primary-800 border-r-primary-200 dark:border-r-primary-700">
							{detailedData.batters.home.reduce((sum, batter) => sum + (batter.at_bats || 0), 0)}
						</div>

						{/* H Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
							{detailedData.batters.home.reduce((sum, batter) => sum + (batter.hits || 0), 0)}
						</div>

						{/* R Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
							{detailedData.batters.home.reduce((sum, batter) => sum + (batter.runs || 0), 0)}
						</div>

						{/* RBI Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
							{detailedData.batters.home.reduce((sum, batter) => sum + (batter.rbi || 0), 0)}
						</div>

						{/* BB Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
							{detailedData.batters.home.reduce((sum, batter) => sum + (batter.walks || 0), 0)}
						</div>

						{/* SO Total */}
						<div className="flex justify-center items-center h-8 font-mono font-bold text-2xs text-primary-900 dark:text-primary-100">
							{detailedData.batters.home.reduce((sum, batter) => sum + (batter.strikeouts || 0), 0)}
						</div>
					</div>
				</div>

				{/* Home Team Pitcher Table */}
				<div>{renderPitcherTable(detailedData.pitchers.home, detailedData.home_team.name)}</div>

				{/* Home Team Footnotes */}
				{renderHomeFootnotes()}
			</div>
		);
	}, [detailedData, awayTeamLogo, homeTeamLogo]);

	// Helper function to render away team footnotes
	const renderAwayFootnotes = () => {
		if (!detailedData) return null;

		// Collect footnotes from away team only
		const awayFootnotes: string[] = [];

		detailedData.batters.away.forEach((batter) => {
			batter.substitutions?.forEach((sub) => {
				if (sub.footnote && !awayFootnotes.includes(sub.footnote)) {
					awayFootnotes.push(sub.footnote);
				}
			});
		});

		if (awayFootnotes.length === 0) return null;

		return (
			<div className="mt-2 mb-6 w-full">
				<h3 className="px-2 mb-2 uppercase border-b border-primary-200 dark:border-primary-700 text-2xs text-primary-500 dark:text-primary-400">
					AWAY TEAM NOTES
				</h3>
				<div className="min-h-[60px] text-xs text-primary-700 dark:text-primary-300 leading-relaxed">
					{awayFootnotes.map((footnote, index) => (
						<div key={index} className="px-2 pb-1 mb-1 border-b border-primary-200 dark:border-primary-700">
							<span className="font-mono text-primary-600 dark:text-primary-400">{getFootnoteNumber(footnote)}.</span>
							{footnote}
						</div>
					))}
					{/* Add empty lines to ensure minimum 3 lines */}
					{Array.from({ length: Math.max(0, 3 - awayFootnotes.length) }, (_, index) => (
						<div key={`empty-${index}`} className="mb-1 border-b px-2pb-1 border-primary-200 dark:border-primary-700">
							&nbsp;
						</div>
					))}
				</div>
			</div>
		);
	};

	// Helper function to render home team footnotes
	const renderHomeFootnotes = () => {
		if (!detailedData) return null;

		// Collect footnotes from home team only
		const homeFootnotes: string[] = [];

		detailedData.batters.home.forEach((batter) => {
			batter.substitutions?.forEach((sub) => {
				if (sub.footnote && !homeFootnotes.includes(sub.footnote)) {
					homeFootnotes.push(sub.footnote);
				}
			});
		});

		if (homeFootnotes.length === 0) return null;

		return (
			<div className="mt-4 w-full">
				<h3 className="px-2 mb-2 uppercase border-b border-primary-200 dark:border-primary-700 text-2xs text-primary-500 dark:text-primary-400">
					HOME TEAM NOTES
				</h3>
				<div className="min-h-[60px] text-xs text-primary-700 dark:text-primary-300 leading-relaxed">
					{homeFootnotes.map((footnote, index) => (
						<div key={index} className="px-2 pb-1 mb-1 border-b border-primary-200 dark:border-primary-700">
							<span className="font-mono text-primary-600 dark:text-primary-400">{getFootnoteNumber(footnote)}.</span>
							{footnote}
						</div>
					))}
					{/* Add empty lines to ensure minimum 3 lines */}
					{Array.from({ length: Math.max(0, 3 - homeFootnotes.length) }, (_, index) => (
						<div key={`empty-${index}`} className="px-2 pb-1 mb-1 border-b border-primary-200 dark:border-primary-700">
							&nbsp;
						</div>
					))}
				</div>
			</div>
		);
	};

	const renderPitchDetails = () => {
		if (!selectedPlayer || !detailedData) return null;

		const [playerName, inning] = selectedPlayer.split('-');
		const inningNum = parseInt(inning);
		const inningData = detailedData.innings.find((i) => i.inning === inningNum);

		if (!inningData) return null;

		const plateAppearance = [...inningData.top_events, ...inningData.bottom_events].find(
			(pa) => pa.batter === playerName
		);

		if (!plateAppearance) return null;

		return (
			<div className="p-4 mt-6 rounded-lg bg-primary-50 dark:bg-primary-700">
				<h3 className="mb-3 text-lg font-bold text-primary-900 dark:text-primary-100">
					{playerName} - Inning {inningNum} Details
				</h3>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<h4 className="mb-2 font-semibold text-primary-900 dark:text-primary-100">At-Bat Summary</h4>
						<div className="p-3 bg-white rounded border dark:bg-primary-800 border-primary-200 dark:border-primary-600">
							<div className="grid grid-cols-2 gap-2 text-sm">
								<div className="text-primary-900 dark:text-primary-100">
									<strong>Batter:</strong> {plateAppearance.batter}
									{plateAppearance.batter_number && (
										<span className="ml-1 text-primary-500 dark:text-primary-400">
											#{plateAppearance.batter_number}
										</span>
									)}
								</div>
								<div className="text-primary-900 dark:text-primary-100">
									<strong>Pitcher:</strong> {plateAppearance.pitcher}
									{plateAppearance.pitcher_number && (
										<span className="ml-1 text-primary-500 dark:text-primary-400">
											#{plateAppearance.pitcher_number}
										</span>
									)}
								</div>
								<div className="col-span-2 text-primary-900 dark:text-primary-100">
									<strong>Result:</strong> {plateAppearance.at_bat_result}
								</div>
								<div className="col-span-2 text-primary-900 dark:text-primary-100">
									<strong>Description:</strong> {plateAppearance.description}
								</div>
							</div>
						</div>
					</div>

					<div>
						<h4 className="mb-2 font-semibold text-primary-900 dark:text-primary-100">Pitch Sequence</h4>
						<div className="p-3 bg-white rounded border dark:bg-primary-800 border-primary-200 dark:border-primary-600">
							{plateAppearance.pitches && plateAppearance.pitches.length > 0 ? (
								<div className="space-y-2">
									{plateAppearance.pitches.map((pitch, index) => (
										<div key={index} className="flex justify-between items-center text-sm">
											<span className="text-primary-900 dark:text-primary-100">
												Pitch {index + 1}: {pitch.pitch_type}
											</span>
											<span className="text-primary-600 dark:text-primary-400">{pitch.result}</span>
										</div>
									))}
								</div>
							) : (
								<div className="text-sm text-primary-600 dark:text-primary-400">No pitch data available</div>
							)}
						</div>
					</div>
				</div>
			</div>
		);
	};

	if (loading) {
		return (
			<div className="flex justify-center items-center py-12">
				<LoadingSpinner message="Loading game data..." />
			</div>
		);
	}

	return (
		<div>
			{/* Traditional Scorecard Grid */}
			{renderScorecardGrid()}

			{/* Pitch Details */}
			{renderPitchDetails()}
		</div>
	);
});

export default TraditionalScorecard;
