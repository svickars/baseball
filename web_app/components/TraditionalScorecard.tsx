'use client';

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { GameData } from '@/types';
import LoadingSpinner from './LoadingSpinner';
import * as TeamLogos from './team-logos';
import { baseballApi } from '@/lib/api';
import { ArrowRight, X, Wifi, WifiOff } from 'lucide-react';
import {
	getAllPitchSequences,
	getPitchSequenceForAtBat,
	getPitchSequenceDisplay,
	AtBatPitchSequence,
} from '@/utils/pitchSequenceUtils';

// Movement color variables for accessibility in both light and dark modes
const MOVEMENT_COLORS = {
	initial: 'text-white dark:text-gray-100', // White for initial at-bat (first play)
	advance: 'text-blue-400 dark:text-blue-300', // Light blue for advances
	out: 'text-orange-500 dark:text-orange-400', // Orange for outs
	score: 'text-green-500 dark:text-green-400', // Green for scoring
	pinchRunner: 'text-purple-300 dark:text-purple-400', // Purple for pinch runner asterisk
};

// Base path colors for diamond grid visualization
const BASE_PATH_COLORS = {
	// Initial at-bat (player's own at-bat) - solid fill, no border
	initial: 'bg-primary-900 dark:bg-primary-100',

	// Subsequent advances (caused by other players)
	advance: 'bg-blue-400 dark:bg-blue-300',

	// Final destination (scoring or out)
	score: 'bg-green-500 dark:bg-green-400',
	out: 'bg-orange-500 dark:bg-orange-400',

	// Pinch runner movements
	pinchRunner: 'bg-purple-400 dark:bg-purple-300',
};

// Helper function to get movement color based on movement type
const getMovementColor = (movement: any): string => {
	if (movement.isOut) {
		return MOVEMENT_COLORS.out;
	} else if (movement.isInitialAtBat) {
		return MOVEMENT_COLORS.initial;
	} else if (movement.to === 'score' || movement.to === 'Home') {
		return MOVEMENT_COLORS.score;
	} else {
		return MOVEMENT_COLORS.advance;
	}
};

// Function to determine base path visualization
const getBasePathVisualization = (baseRunningTrip: BaseRunningTrip): BasePathVisualization | null => {
	if (!baseRunningTrip || baseRunningTrip.basePath.length === 0) {
		return null;
	}

	// Determine the final movement and path taken
	const finalMovement = baseRunningTrip.basePath[baseRunningTrip.basePath.length - 1];
	const initialMovement = baseRunningTrip.basePath[0];

	// Create base path visualization
	return {
		path: baseRunningTrip.basePath,
		finalBase: finalMovement.to,
		finalEvent: finalMovement.event,
		isOut: finalMovement.isOut,
		isScored: finalMovement.to === 'score' || finalMovement.to === 'Home',
		initialEvent: initialMovement.event,
		hasPinchRunner: baseRunningTrip.pinchRunners.length > 0,
	};
};

// Function to parse defensive positions from play descriptions
const parseDefensiveNotation = (description: string): string => {
	if (!description) return '';

	const descLower = description.toLowerCase();

	// Position mapping
	const positionMap: { [key: string]: string } = {
		pitcher: '1',
		catcher: '2',
		'first baseman': '3',
		'second baseman': '4',
		'third baseman': '5',
		shortstop: '6',
		'left fielder': '7',
		'center fielder': '8',
		'right fielder': '9',
		// Handle variations
		'first base': '3',
		'second base': '4',
		'third base': '5',
		short: '6',
		'left field': '7',
		'center field': '8',
		'right field': '9',
	};

	// Play type mapping
	let playType = '';
	if (descLower.includes('grounds out') || descLower.includes('ground out')) {
		playType = 'G';
	} else if (descLower.includes('flies out') || descLower.includes('fly out')) {
		playType = 'F';
	} else if (descLower.includes('lines out') || descLower.includes('line out')) {
		playType = 'L';
	} else if (descLower.includes('pops out') || descLower.includes('pop out')) {
		playType = 'P';
	} else if (
		descLower.includes('forceout') ||
		descLower.includes('force out') ||
		descLower.includes('fielder') ||
		descLower.includes('fielders choice')
	) {
		playType = 'G'; // Forceouts/FC use same defensive notation as groundouts (G63, etc.)
	}

	if (!playType) return '';

	// Extract positions in the order they appear in the description
	const positions: string[] = [];

	// Find all position mentions with their index positions
	const positionMentions: { index: number; position: string }[] = [];
	for (const [posName, posNum] of Object.entries(positionMap)) {
		const index = descLower.indexOf(posName);
		if (index !== -1) {
			positionMentions.push({ index, position: posNum });
		}
	}

	// Sort by index (order of appearance) and extract positions
	positionMentions.sort((a, b) => a.index - b.index);
	positionMentions.forEach((mention) => {
		if (!positions.includes(mention.position)) {
			positions.push(mention.position);
		}
	});

	// For defensive plays, show positions in the order they appear
	if (positions.length >= 2) {
		// Always show both positions for groundouts, forceouts, and fielder's choice
		if (playType === 'G') {
			return `${playType}${positions[0]}${positions[1]}`;
		} else {
			// For flyouts, lineouts, popouts - usually just need the fielding position
			return `${playType}${positions[0]}`;
		}
	} else if (positions.length === 1) {
		return `${playType}${positions[0]}`;
	}

	return '';
};

// Helper function to get movement shorthand codes
const getMovementShorthand = (event: string, isOut: boolean = false, description?: string): string => {
	const eventLower = event.toLowerCase();

	// Hit types
	if (eventLower.includes('single')) return '1B';
	if (eventLower.includes('double')) return '2B';
	if (eventLower.includes('triple')) return '3B';
	if (eventLower.includes('home run') || eventLower.includes('hr')) return 'HR';

	// Walk
	if (eventLower.includes('walk') || eventLower.includes('bb')) return 'BB';

	// Hit by pitch
	if (eventLower.includes('hit by pitch') || eventLower.includes('hbp')) return 'HBP';

	// Errors
	if (eventLower.includes('error')) {
		const errorMatch = event.match(/E(\d+)/);
		return errorMatch ? `E${errorMatch[1]}` : 'E';
	}

	// Forceouts and Fielder's choice - try to parse defensive positions
	if (
		eventLower.includes('forceout') ||
		eventLower.includes('force out') ||
		eventLower.includes('fielder') ||
		eventLower.includes('fielders choice')
	) {
		if (description) {
			// Try to extract defensive positions from description for FC notation
			const defensiveNotation = parseDefensiveNotation(description);
			if (defensiveNotation && defensiveNotation.startsWith('G')) {
				// Convert G63 to FC63 (forceout/fielder's choice)
				return defensiveNotation.replace('G', 'FC');
			}
		}
		// Fallback to generic FC if no positions found
		return 'FC';
	}

	// Stolen bases
	if (eventLower.includes('stolen') || eventLower.includes('steals')) return 'SB';

	// Sacrifice plays - all should be "SAC" for quadrant labels
	if (eventLower.includes('sacrifice') || eventLower.includes('sac')) {
		return 'SAC';
	}

	// Double plays - show "DP" for quadrant labels
	if (eventLower.includes('double play') || eventLower.includes('grounded into dp')) {
		return 'DP';
	}

	// Try to parse defensive notation from description first
	if (description) {
		const defensiveNotation = parseDefensiveNotation(description);
		if (defensiveNotation) {
			return defensiveNotation;
		}
	}

	// Specific defensive plays - look for the actual notation first
	const defensivePlayMatch = event.match(/([GFLP]\d+)/);
	if (defensivePlayMatch) {
		return defensivePlayMatch[1]; // Return G63, F8, L7, P4, etc.
	}

	// Fielder's choice with position
	const fcPositionMatch = event.match(/FC(\d+)/);
	if (fcPositionMatch) {
		return `FC${fcPositionMatch[1]}`; // Return FC3, FC6, etc.
	}

	// Generic defensive plays (fallback)
	if (eventLower.includes('groundout') || eventLower.includes('ground out')) return 'GO';
	if (eventLower.includes('flyout') || eventLower.includes('fly out')) return 'FO';
	if (eventLower.includes('popout') || eventLower.includes('pop out')) return 'PO';
	if (eventLower.includes('lineout') || eventLower.includes('line out')) return 'LO';

	// Strikeout
	if (eventLower.includes('strikeout') || eventLower.includes('k')) return 'K';

	// Default fallback
	return event.substring(0, 3).toUpperCase();
};

// Function to get base square color for diamond grid
const getBaseSquareColor = (basePathViz: BasePathVisualization, basePosition: string): string => {
	// FIRST: Check if player was out at this specific base - this takes priority
	const wasOutAtThisBase = basePathViz.path.some((movement) => movement.isOut && movement.outBase === basePosition);
	if (wasOutAtThisBase) {
		return BASE_PATH_COLORS.out; // Orange for outs
	}

	// Define base order for calculations
	const baseOrder = ['Home', '1B', '2B', '3B', 'Home'];
	const baseIndex = basePosition === 'Home' ? 4 : baseOrder.indexOf(basePosition);

	// Check if this base was reached at all
	const wasReached = basePathViz.path.some((movement) => {
		let movementToIndex = baseOrder.indexOf(movement.to);
		if (movement.to === 'score') {
			movementToIndex = 4; // Map 'score' to the second Home (scoring Home)
		}
		const movementFromIndex = baseOrder.indexOf(movement.from);

		// Direct movement to this base
		if (movementToIndex === baseIndex) {
			return true;
		}

		// Intermediate base in a multi-base movement
		if (movementFromIndex !== -1 && movementToIndex !== -1 && baseIndex !== -1) {
			const minIndex = Math.min(movementFromIndex, movementToIndex);
			const maxIndex = Math.max(movementFromIndex, movementToIndex);
			return baseIndex >= minIndex && baseIndex <= maxIndex;
		}

		return false;
	});

	if (!wasReached) {
		return 'bg-primary-200 dark:bg-primary-700'; // Not reached
	}

	// NEW LOGIC: Follow the user's approach
	const initialMovement = basePathViz.path[0];

	// Check if this base was reached in the initial at-bat
	const reachedInInitialAtBat = basePathViz.path.some((movement) => {
		if (movement.atBatIndex !== initialMovement.atBatIndex) return false;

		let movementToIndex = baseOrder.indexOf(movement.to);
		if (movement.to === 'score') {
			movementToIndex = 4;
		}
		const movementFromIndex = baseOrder.indexOf(movement.from);

		// Direct movement to this base
		if (movementToIndex === baseIndex) {
			return true;
		}

		// Intermediate base in a multi-base movement
		if (movementFromIndex !== -1 && movementToIndex !== -1 && baseIndex !== -1) {
			const minIndex = Math.min(movementFromIndex, movementToIndex);
			const maxIndex = Math.max(movementFromIndex, movementToIndex);
			return baseIndex >= minIndex && baseIndex <= maxIndex;
		}

		return false;
	});

	// If reached in initial at-bat
	if (reachedInInitialAtBat) {
		// Check if they scored on their own at-bat (home run)
		const scoredOnOwnAtBat = basePathViz.path.some(
			(movement) =>
				movement.atBatIndex === initialMovement.atBatIndex && (movement.to === 'score' || movement.to === 'Home')
		);

		if (scoredOnOwnAtBat) {
			return BASE_PATH_COLORS.score; // Green for home runs
		} else {
			return BASE_PATH_COLORS.initial; // Dark for other initial at-bat bases
		}
	}

	// If reached on subsequent plays, check if they scored on that play
	const scoringMovement = basePathViz.path.find((movement) => movement.to === 'score' || movement.to === 'Home');

	if (scoringMovement) {
		// Check if this base was part of the scoring play
		const wasPartOfScoringPlay = basePathViz.path.some((movement) => {
			if (movement.atBatIndex !== scoringMovement.atBatIndex) return false;

			let movementToIndex = baseOrder.indexOf(movement.to);
			if (movement.to === 'score') {
				movementToIndex = 4;
			}
			const movementFromIndex = baseOrder.indexOf(movement.from);

			// Direct movement to this base
			if (movementToIndex === baseIndex) {
				return true;
			}

			// Intermediate base in a multi-base movement
			if (movementFromIndex !== -1 && movementToIndex !== -1 && baseIndex !== -1) {
				const minIndex = Math.min(movementFromIndex, movementToIndex);
				const maxIndex = Math.max(movementFromIndex, movementToIndex);
				return baseIndex >= minIndex && baseIndex <= maxIndex;
			}

			return false;
		});

		if (wasPartOfScoringPlay) {
			return BASE_PATH_COLORS.score; // Green for bases involved in scoring
		}
	}

	// Default to advance color for subsequent movements
	return BASE_PATH_COLORS.advance;
};

// Function to render movement labels for base running visualization
const renderMovementLabels = (basePathViz: BasePathVisualization) => {
	// Base positions and alignment after rotation
	// Top Left = 2B, Top Right = 1B, Bottom Left = 3B, Bottom Right = Home
	const getBasePositionAndAlignment = (base: string) => {
		if (base === '1B') {
			return {
				position: 'bottom-right', // 1st base (bottom-right in rotated grid)
				alignment: 'text-center', // center-aligned
				// className: '-bottom-1 -right-1', // Fine-tuned positioning
				className: 'top-1/2 left-full -translate-y-1/2 -rotate-90',
			};
		} else if (base === '2B') {
			return {
				position: 'top-right', // 2nd base (top-right in rotated grid)
				alignment: 'text-center', // center-aligned
				// className: '-top-1 -right-1', // Fine-tuned positioning
				className: 'bottom-full left-1/2 -translate-x-1/2',
			};
		} else if (base === '3B') {
			return {
				position: 'top-left', // 3rd base (top-left in rotated grid)
				alignment: 'text-center', // center-aligned
				// className: '-top-1 -left-1', // Fine-tuned positioning
				className: 'right-full top-1/2 -translate-y-1/2 -rotate-90',
			};
		} else if (base === 'Home' || base === 'score') {
			return {
				position: 'bottom-left', // Home plate (bottom-left in rotated grid)
				alignment: 'text-center', // center-aligned
				// className: '-bottom-1 -left-1', // Fine-tuned positioning
				className: 'top-full left-1/2 -translate-x-1/2',
			};
		}
		return null;
	};

	// Consolidate consecutive movements from the same at-bat (same play)
	const consolidatedMovements: BaseRunningMovement[] = [];

	for (let i = 0; i < basePathViz.path.length; i++) {
		const currentMovement = basePathViz.path[i];

		// Look ahead to see if there are consecutive movements from the same at-bat
		let finalMovement = currentMovement;
		let j = i + 1;

		while (j < basePathViz.path.length) {
			const nextMovement = basePathViz.path[j];

			// If it's the same at-bat and same player, consolidate
			// BUT don't consolidate stolen bases - they should be treated as separate plays
			if (
				nextMovement.atBatIndex === currentMovement.atBatIndex &&
				nextMovement.playerId === currentMovement.playerId &&
				!currentMovement.event.toLowerCase().includes('stolen') &&
				!nextMovement.event.toLowerCase().includes('stolen')
			) {
				finalMovement = nextMovement;
				j++;
				i = j - 1; // Skip the consolidated movements
			} else {
				break;
			}
		}

		consolidatedMovements.push(finalMovement);
	}

	// Render labels for consolidated movements (one per play)
	return (
		<>
			{consolidatedMovements.map((movement, index) => {
				// Generate shorthand for quadrant labels using the original event and description
				const shorthand = getMovementShorthand(movement.event, movement.isOut, movement.description);

				// For out movements, use outBase if to is null
				const targetBase = movement.isOut && movement.outBase ? movement.outBase : movement.to;
				const positionInfo = getBasePositionAndAlignment(targetBase);

				if (!positionInfo) return null;

				// Use orange text for out movements, default color for advances
				const textColorClass = movement.isOut
					? 'text-orange-600 dark:text-orange-400'
					: 'text-primary-900 dark:text-primary-100';

				// Use regular weight for out movements and subsequent advances (not initial at-bat)
				const fontWeightClass = movement.isInitialAtBat ? 'font-bold' : 'font-normal';

				return (
					<div
						key={`movement-${index}`}
						className={`absolute font-mono ${fontWeightClass} ${textColorClass} ${positionInfo.alignment} ${positionInfo.className}`}
						style={{ fontSize: '7px', lineHeight: '7px' }}>
						{shorthand}
					</div>
				);
			})}
		</>
	);
};

// Function to render standard corner labels (for backward compatibility)
const renderStandardLabels = (cornerLabels: { first: string; second: string; third: string; home: string }) => {
	return (
		<>
			{/* Top Right = First Base Label */}
			{cornerLabels.first && (
				<div
					className="absolute -bottom-0.5 -right-0.5 font-mono font-bold text-primary-900 dark:text-primary-100 text-center -rotate-45"
					style={{ fontSize: '7px', lineHeight: '7px' }}>
					{cornerLabels.first}
				</div>
			)}

			{/* Top Left = Second Base Label */}
			{cornerLabels.second && (
				<div
					className="absolute -top-0.5 -right-0.5 font-mono font-bold text-primary-900 dark:text-primary-100 text-center rotate-45"
					style={{ fontSize: '7px', lineHeight: '7px' }}>
					{cornerLabels.second}
				</div>
			)}

			{/* Bottom Left = Third Base Label */}
			{cornerLabels.third && (
				<div
					className="absolute -top-0.5 -left-0.5 font-mono font-bold text-primary-900 dark:text-primary-100 text-center -rotate-45"
					style={{ fontSize: '7px', lineHeight: '7px' }}>
					{cornerLabels.third}
				</div>
			)}

			{/* Bottom Right = Home Plate Label */}
			{cornerLabels.home && (
				<div
					className="absolute -bottom-0.5 -left-0.5 font-mono font-bold text-primary-900 dark:text-primary-100 text-center rotate-45"
					style={{ fontSize: '7px', lineHeight: '7px' }}>
					{cornerLabels.home}
				</div>
			)}
		</>
	);
};

interface TraditionalScorecardProps {
	gameData: GameData;
	gameId: string;
	gamePk?: string;
	isLiveGame?: boolean;
	enableLiveUpdates?: boolean;
	liveUpdateDelay?: number; // Delay in seconds for live updates
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

// Helper function to convert position number to abbreviation
const getPositionAbbreviation = (positionNumber: string): string => {
	const positionMap: { [key: string]: string } = {
		'1': 'P',
		'2': 'C',
		'3': '1B',
		'4': '2B',
		'5': '3B',
		'6': 'SS',
		'7': 'LF',
		'8': 'CF',
		'9': 'RF',
		'10': 'DH',
	};
	return positionMap[positionNumber] || positionNumber;
};

// Helper function to convert MLB API position codes to abbreviations
const mapPositionCodeToAbbreviation = (positionCode: string): string => {
	const positionCodeMap: { [key: string]: string } = {
		'1': 'P',
		'2': 'C',
		'3': '1B',
		'4': '2B',
		'5': '3B',
		'6': 'SS',
		'7': 'LF',
		'8': 'CF',
		'9': 'RF',
		'10': 'DH',
		'11': 'PH', // Pinch Hitter
		'12': 'PR', // Pinch Runner
	};
	return positionCodeMap[positionCode] || positionCode;
};

// Helper function to format slash line without leading zeros
const formatSlashLine = (average: string, onBasePercentage: string, sluggingPercentage: string): string => {
	const formatNumber = (num: string): string => {
		const parsed = parseFloat(num);
		if (isNaN(parsed)) return num;
		return parsed.toFixed(3).replace(/^0+/, '') || '0.000';
	};

	return `${formatNumber(average)}/${formatNumber(onBasePercentage)}/${formatNumber(sluggingPercentage)}`;
};

// Tooltip component for at-bat cells
const AtBatTooltip = ({
	description,
	atBatResult,
	batterName,
	inningNumber,
	columnIndex,
	detailedData,
}: {
	description?: string;
	atBatResult: { atBatResult: string; endedInning: boolean; rbis: number; description?: string };
	batterName: string;
	inningNumber: number;
	columnIndex: number;
	detailedData?: any;
}) => {
	if (!description || description.trim() === '') {
		return null;
	}

	// Get enhanced at-bat result for display
	const enhancedAtBatResult = getEnhancedCenterText(atBatResult.atBatResult, description);

	// Extract the actual player name from the description
	const actualPlayerName = extractPlayerNameFromDescription(description) || batterName;

	// Get base running data for this at-bat
	let baseRunningTrip: BaseRunningTrip | null = null;

	// Try multiple possible paths for the game feed data
	let allPlays = null;

	// Path 1: detailedData.liveData.plays.allPlays
	if (detailedData?.liveData?.plays?.allPlays) {
		allPlays = detailedData.liveData.plays.allPlays;
	}
	// Path 2: detailedData.game_data.liveData.plays.allPlays
	else if (detailedData?.game_data?.liveData?.plays?.allPlays) {
		allPlays = detailedData.game_data.liveData.plays.allPlays;
	}
	// Path 3: Check if it's stored elsewhere in game_data
	else if (detailedData?.game_data?.allPlays) {
		allPlays = detailedData.game_data.allPlays;
	}

	if (allPlays) {
		// Debug: Let's see what player names are actually in the game feed data
		const allPlayerNames = allPlays
			.filter((play: any) => play.result.type === 'atBat' && play.about.inning === inningNumber)
			.map((play: any) => play.matchup.batter.fullName);

		// Find by player name and inning - we need to determine if this is top or bottom of inning
		// Try exact match first
		let playerPlays = allPlays.filter(
			(play: any) =>
				play.result.type === 'atBat' &&
				play.matchup.batter.fullName === actualPlayerName &&
				play.about.inning === inningNumber
		);

		// If no exact match found, try a more flexible matching approach
		if (playerPlays.length === 0) {
			// Create a normalized version of the name (remove periods, extra spaces, etc.)
			const normalizedActualName = actualPlayerName.replace(/[.\s]+/g, ' ').trim();

			playerPlays = allPlays.filter((play: any) => {
				if (play.result.type !== 'atBat' || play.about.inning !== inningNumber) {
					return false;
				}

				const normalizedPlayName = play.matchup.batter.fullName.replace(/[.\s]+/g, ' ').trim();

				return normalizedPlayName === normalizedActualName;
			});
		}

		// Sort plays by atBatIndex to ensure correct order
		playerPlays.sort((a: any, b: any) => a.about.atBatIndex - b.about.atBatIndex);

		// Match the specific at-bat based on column index (0 = first at-bat, 1 = second at-bat, etc.)
		const playerPlay = playerPlays[columnIndex];

		if (playerPlay) {
			const playerId = playerPlay.matchup.batter.id;
			baseRunningTrip = getBaseRunningTripForAtBat(allPlays, playerId, playerPlay.about.atBatIndex);
		} else {
		}
	} else {
	}

	return (
		<div className="absolute -bottom-2 left-1/2 z-[60] px-3 py-2 w-80 text-sm text-white whitespace-normal bg-gray-900 rounded-lg border border-gray-700 shadow-lg opacity-0 transition-opacity duration-200 transform -translate-x-1/2 translate-y-full pointer-events-none dark:bg-gray-900 dark:text-white dark:border-gray-700 group-hover:opacity-100">
			<div className="mb-1 font-semibold">
				{actualPlayerName} - {enhancedAtBatResult}
			</div>
			<div className="mb-2 text-xs leading-relaxed">{description}</div>

			{/* Base running movements */}
			{baseRunningTrip && baseRunningTrip.basePath.length > 0 && (
				<div className="pt-2 border-t border-gray-600 dark:border-gray-600">
					{(() => {
						// Consolidate consecutive movements from the same at-bat
						const consolidatedMovements: BaseRunningMovement[] = [];

						for (let i = 0; i < baseRunningTrip.basePath.length; i++) {
							const currentMovement = baseRunningTrip.basePath[i];

							// Check if this movement was made by a pinch runner
							const isPinchRunnerMovement = baseRunningTrip.pinchRunners.some(
								(pr) => pr.atBatIndex === currentMovement.atBatIndex && pr.playerId === currentMovement.playerId
							);

							// The first movement is the initial at-bat movement
							const isInitialAtBat = i === 0;

							// Look ahead to see if there are consecutive movements from the same at-bat
							let finalMovement = currentMovement;
							let j = i + 1;

							while (j < baseRunningTrip.basePath.length) {
								const nextMovement = baseRunningTrip.basePath[j];

								// If it's the same at-bat and same player, consolidate
								// BUT don't consolidate stolen bases - they should be treated as separate plays
								if (
									nextMovement.atBatIndex === currentMovement.atBatIndex &&
									nextMovement.playerId === currentMovement.playerId &&
									!currentMovement.event.toLowerCase().includes('stolen') &&
									!nextMovement.event.toLowerCase().includes('stolen')
								) {
									finalMovement = nextMovement;
									j++;
									i = j - 1; // Skip the consolidated movements
								} else {
									break;
								}
							}

							consolidatedMovements.push({
								...finalMovement,
								isPinchRunnerMovement,
								isInitialAtBat,
							});
						}

						return consolidatedMovements.map((movement, index) => (
							<div key={index} className="text-xs leading-relaxed">
								<span className={getMovementColor(movement)}>
									{movement.isOut ? <X className="inline w-3 h-3" /> : <ArrowRight className="inline w-3 h-3" />}{' '}
									{formatMovementDisplay(
										movement.event,
										movement.to,
										movement.isInitialAtBat,
										movement.batterName,
										movement.isOut,
										movement.outBase
									)}
									{movement.isPinchRunnerMovement && <span className={`ml-1 ${MOVEMENT_COLORS.pinchRunner}`}>*</span>}
								</span>
								{movement.isPinchRunnerMovement && (
									<span className={`${MOVEMENT_COLORS.pinchRunner} ml-1 text-[10px]`}>(PR: {movement.playerName})</span>
								)}
							</div>
						));
					})()}
				</div>
			)}

			{/* Arrow pointing up to the cell - positioned to be half-hidden behind the tooltip */}
			<div className="absolute -top-1 left-1/2 w-2 h-2 bg-gray-900 border-t border-l border-gray-700 transform rotate-45 -translate-x-1/2 dark:bg-gray-900 dark:border-gray-700"></div>
		</div>
	);
};

// Helper function to determine which innings need extra columns for multiple at-bats
const getInningColumnStructure = (
	batters: BatterData[],
	displayInnings: number,
	detailedData: DetailedGameData | null
): { inningColumns: number[]; totalColumns: number } => {
	const inningColumns: number[] = [];

	// Check each inning for multiple at-bats
	for (let inning = 1; inning <= displayInnings; inning++) {
		let hasMultipleAtBats = false;

		// Check all batters in this inning
		for (const batter of batters) {
			const atBatResults = getAtBatResultsForInning(batter, inning, detailedData);
			if (atBatResults.length > 1) {
				hasMultipleAtBats = true;
				break;
			}
		}

		// If this inning has multiple at-bats, we need 2 columns (X and Xb)
		inningColumns.push(hasMultipleAtBats ? 2 : 1);
	}

	const totalColumns = inningColumns.reduce((sum, cols) => sum + cols, 0);

	return { inningColumns, totalColumns };
};

// Interface for game state tracking
interface GameState {
	currentInning: number;
	currentHalfInning: 'top' | 'bottom';
	outs: number;
	baseRunners: {
		first: string | null;
		second: string | null;
		third: string | null;
	};
	lob: number; // Left on base for current half-inning
}

// Interface for at-bat results with base advancement tracking
interface AtBatResult {
	batterName: string;
	result: string;
	label: string; // "1B", "HR", "G63", etc.
	baseAdvancement: {
		first: boolean;
		second: boolean;
		third: boolean;
		home: boolean;
	};
	rbis: number;
	outs: number;
	description: string;
	inning: number;
	halfInning: 'top' | 'bottom';
	chronologicalOrder: number;
}

// Interface for substitution events
interface SubstitutionEvent {
	type: 'PH' | 'PR' | 'DEF';
	substitutingPlayer: string;
	replacedPlayer: string;
	position?: string;
	battingOrder?: number;
	description: string;
	inning: number;
	halfInning: 'top' | 'bottom';
	chronologicalOrder: number;
}

// Interface for base advancement events (when runners advance on subsequent plays)
interface BaseAdvancementEvent {
	playerName: string;
	fromBase: 1 | 2 | 3;
	toBase: 2 | 3 | 4; // 4 = home
	advancementPlay: string; // The play that caused the advancement
	inning: number;
	halfInning: 'top' | 'bottom';
	chronologicalOrder: number;
}

// Helper function to process play-by-play descriptions sequentially and track game state
const processSequentialGameState = (
	detailedData: GameData | null
): {
	atBatResults: AtBatResult[];
	substitutionEvents: SubstitutionEvent[];
	baseAdvancementEvents: BaseAdvancementEvent[];
	lobTotals: Map<string, number>; // inning-halfInning -> LOB count
} => {
	if (!detailedData?.game_data?.play_by_play) {
		return { atBatResults: [], substitutionEvents: [], baseAdvancementEvents: [], lobTotals: new Map() };
	}

	const atBatResults: AtBatResult[] = [];
	const substitutionEvents: SubstitutionEvent[] = [];
	const baseAdvancementEvents: BaseAdvancementEvent[] = [];
	const lobTotals = new Map<string, number>();

	// Initialize game state
	let gameState: GameState = {
		currentInning: 1,
		currentHalfInning: 'top',
		outs: 0,
		baseRunners: { first: null, second: null, third: null },
		lob: 0,
	};

	let chronologicalOrder = 0;

	// Get all play-by-play descriptions in chronological order
	const allPlays: Array<{ description: string; inning: number; halfInning: 'top' | 'bottom' }> = [];

	// Process all at-bats and extract descriptions - we'll determine inning/half-inning by tracking outs
	const atBatsData = detailedData.game_data.play_by_play.atBats || {};

	// Extract all descriptions and sort them chronologically
	const allDescriptions: Array<{ description: string; originalKey: string }> = [];

	for (const [key, atBats] of Object.entries(atBatsData)) {
		if (Array.isArray(atBats)) {
			for (const atBat of atBats) {
				if (atBat.description) {
					allDescriptions.push({
						description: atBat.description,
						originalKey: key,
					});
				}
			}
		}
	}

	// Sort descriptions chronologically by extracting inning from the key
	const sortedDescriptions = allDescriptions.sort((a, b) => {
		// Extract inning from key format: "PlayerName-Inning-HalfInning"
		const partsA = a.originalKey.split('-');
		const partsB = b.originalKey.split('-');

		// Get the second-to-last part (inning) and last part (halfInning)
		const inningA = parseInt(partsA[partsA.length - 2]);
		const inningB = parseInt(partsB[partsB.length - 2]);
		const halfA = partsA[partsA.length - 1];
		const halfB = partsB[partsB.length - 1];

		if (inningA !== inningB) {
			return inningA - inningB;
		}

		// If same inning, top comes before bottom
		return halfA === 'top' ? -1 : 1;
	});

	// Check for other potential data sources
	if (detailedData.game_data?.play_by_play) {
		Object.keys(detailedData.game_data.play_by_play).forEach((key) => {
			const data = (detailedData.game_data.play_by_play as any)[key];
		});
	}

	// NEW: Check for game feed substitution data
	if (detailedData.game_data?.game_feed_substitutions && detailedData.game_data.game_feed_substitutions.length > 0) {
		detailedData.game_data.game_feed_substitutions.forEach((sub: any, index: number) => {});
		// Override the play_by_play substitutions with game feed data
		if (!detailedData.game_data.play_by_play) {
			detailedData.game_data.play_by_play = {
				atBats: {},
				substitutions: {},
				inningResults: {},
				errors: {},
			};
		}
		// Convert game_feed_substitutions array to the expected substitutions object format
		// Group substitutions by inning-halfInning key
		const substitutionsByInning: { [key: string]: any[] } = {};
		detailedData.game_data.game_feed_substitutions.forEach((sub: any) => {
			const key = `${sub.inning}-${sub.halfInning}`;
			if (!substitutionsByInning[key]) {
				substitutionsByInning[key] = [];
			}
			substitutionsByInning[key].push(sub);
		});
		detailedData.game_data.play_by_play.substitutions = substitutionsByInning;
	} else {
	}

	// Check if there are other data sources in the API response
	if (detailedData.game_data) {
		if ((detailedData.game_data as any).liveData) {
			if ((detailedData.game_data as any).liveData.plays) {
				// Examine allPlays structure more closely
				if ((detailedData.game_data as any).liveData.plays.allPlays) {
					// Look for substitution-related events in allPlays
					const substitutionEvents = (detailedData.game_data as any).liveData.plays.allPlays.filter(
						(play: any) =>
							play.details &&
							play.details.event &&
							(play.details.event.toLowerCase().includes('substitution') ||
								play.details.event.toLowerCase().includes('pinch') ||
								play.details.event.toLowerCase().includes('replaces'))
					);
				}
			}
		}
	}

	// Process each play sequentially and track outs to determine inning/half-inning
	for (const desc of sortedDescriptions) {
		chronologicalOrder++;

		// Parse the at-bat result from the description
		const atBatResult = parseAtBatFromDescription(desc.description, gameState, chronologicalOrder);

		// Update game state based on the at-bat result
		if (atBatResult) {
			updateGameStateFromAtBat(gameState, atBatResult);
		}

		// Check if we've completed a half-inning (3 outs)
		if (gameState.outs >= 3) {
			// Count LOB before resetting
			let lobCount = 0;
			if (gameState.baseRunners.first) lobCount++;
			if (gameState.baseRunners.second) lobCount++;
			if (gameState.baseRunners.third) lobCount++;

			// Save LOB total for completed half-inning
			if (lobCount > 0) {
				const prevKey = `${gameState.currentInning}-${gameState.currentHalfInning}`;
				lobTotals.set(prevKey, lobCount);
			}

			// Move to next half-inning
			if (gameState.currentHalfInning === 'top') {
				gameState.currentHalfInning = 'bottom';
			} else {
				gameState.currentInning++;
				gameState.currentHalfInning = 'top';
			}

			// Reset for new half-inning
			gameState.outs = 0;
			gameState.baseRunners = { first: null, second: null, third: null };
			gameState.lob = 0;
		}

		// Check if this is a substitution event
		const substitutionInfo = parseSubstitutionFromDescription(desc.description);

		if (substitutionInfo.isSubstitution) {
		} else if (
			desc.description.toLowerCase().includes('substitution') ||
			desc.description.toLowerCase().includes('pinch') ||
			desc.description.toLowerCase().includes('replaces')
		) {
		}

		if (substitutionInfo.isSubstitution && substitutionInfo.substitutingPlayer && substitutionInfo.replacedPlayer) {
			// Process substitution event
			const substitutionEvent: SubstitutionEvent = {
				type: substitutionInfo.substitutionType || 'DEF',
				substitutingPlayer: substitutionInfo.substitutingPlayer,
				replacedPlayer: substitutionInfo.replacedPlayer,
				position: substitutionInfo.position,
				description: desc.description,
				inning: gameState.currentInning,
				halfInning: gameState.currentHalfInning,
				chronologicalOrder,
			};

			substitutionEvents.push(substitutionEvent);
		}

		// Process at-bat result (for all plays, not just substitutions)
		if (atBatResult) {
			atBatResults.push(atBatResult);

			// Check for base advancement events in the description
			const advancementEvents = parseBaseAdvancementFromDescription(desc.description, gameState, chronologicalOrder);
			baseAdvancementEvents.push(...advancementEvents);
		}
	}

	// Save final LOB total
	if (gameState.lob > 0) {
		const finalKey = `${gameState.currentInning}-${gameState.currentHalfInning}`;
		lobTotals.set(finalKey, gameState.lob);
	}

	return { atBatResults, substitutionEvents, baseAdvancementEvents, lobTotals };
};

// Helper function to rebuild substitution data from the chronological game log (legacy - not used)
const rebuildSubstitutionDataFromGameLog = (gameEvents: any[], batters: any[]): Map<string, any> => {
	const substitutionMap = new Map<string, any>();
	return substitutionMap;
};

// Helper function to convert number to ordinal suffix
const getOrdinalSuffix = (num: number): string => {
	const lastDigit = num % 10;
	const lastTwoDigits = num % 100;

	if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
		return num + 'th';
	}

	switch (lastDigit) {
		case 1:
			return num + 'st';
		case 2:
			return num + 'nd';
		case 3:
			return num + 'rd';
		default:
			return num + 'th';
	}
};

// Helper function to generate descriptive footnotes using ONLY game feed data
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
	// ALWAYS use the game feed substitution description if available
	if (sub.substitution_description) {
		// Add to global substitutions list for sequential numbering
		allSubstitutions.push({ footnote: sub.substitution_description, order: allSubstitutions.length + 1 });

		// Create a unique key for this substitution
		const subName = sub.person?.fullName || sub.name || 'Unknown Player';
		const starterName = starter.person?.fullName || starter.name || 'Unknown Starter';
		const actualSubstitutionType = sub.substitution_type || substitutionType;
		const footnoteKey = `${subName}-${starterName}-${actualSubstitutionType}-${inning}-${halfInning}`;

		// Assign footnote number based on order in the game
		const footnoteNumber = allSubstitutions.length;
		globalFootnotes[footnoteKey] = footnoteNumber;

		return sub.substitution_description;
	}

	return 'Substitution details not available';
};

// Helper function to reset footnote counter for new game data
const resetFootnoteCounter = () => {
	globalFootnoteCounter = 1;
	Object.keys(globalFootnotes).forEach((key) => delete globalFootnotes[key]);
	allSubstitutions.length = 0;
};

// Helper function to enhance substitution data with play-by-play timing information
// Helper function to create clean, natural substitution footnotes
const createCleanSubstitutionFootnote = (
	description: string,
	inning: number,
	halfInning: string,
	detailedData?: any
): string => {
	// Convert inning number to word
	const inningWords = {
		1: 'first',
		2: 'second',
		3: 'third',
		4: 'fourth',
		5: 'fifth',
		6: 'sixth',
		7: 'seventh',
		8: 'eighth',
		9: 'ninth',
	};
	const inningText = inningWords[inning as keyof typeof inningWords] || inning.toString();

	// Parse the original description to extract key information
	const isDefensive = description.includes('Defensive Substitution');
	const isOffensive = description.includes('Offensive Substitution');

	// Extract substituting player name
	let substitutingPlayer = '';
	let replacedPlayer = '';
	let position = '';
	let battingOrder = '';

	if (isDefensive) {
		// "Defensive Substitution: Ty France replaces first baseman Vladimir Guerrero Jr., batting 3rd, playing first base."
		const match = description.match(
			/Defensive Substitution:\s*([^,]+)\s*replaces\s*(?:first baseman|second baseman|third baseman|shortstop|left fielder|center fielder|right fielder|catcher|pitcher|designated hitter)?\s*([^,]+)(?:,\s*batting\s*(\d+(?:st|nd|rd|th)))?(?:,\s*playing\s*([^.]*))?/i
		);
		if (match) {
			substitutingPlayer = match[1].trim();
			replacedPlayer = match[2].trim();
			// Don't add ordinal suffix here - the original text already has it (3rd, 6th, etc.)
			battingOrder = match[3] ? match[3] : '';
			position = match[4] ? match[4].trim() : '';
		}
	} else if (isOffensive) {
		// "Offensive Substitution: Pinch-hitter Randal Grichuk replaces Vinnie Pasquantino."
		const match = description.match(
			/Offensive Substitution:\s*Pinch-(?:hitter|runner)\s*([^,]+)\s*replaces\s*([^.]*)/i
		);
		if (match) {
			const pinchType = description.includes('Pinch-hitter') ? 'Pinch-hitter' : 'Pinch-runner';
			substitutingPlayer = `${pinchType} ${match[1].trim()}`;
			replacedPlayer = match[2].trim();
		}
	}

	// Create clean footnote
	if (isDefensive) {
		let cleanFootnote = `${substitutingPlayer} replaces ${replacedPlayer} in the ${halfInning} of the ${inningText}`;
		if (battingOrder) {
			cleanFootnote += `, batting ${battingOrder}`;
		}
		if (position) {
			cleanFootnote += `, playing ${position}`;
		}
		cleanFootnote += '.';
		return cleanFootnote;
	} else if (isOffensive) {
		let cleanFootnote = `${substitutingPlayer} replaces ${replacedPlayer} in the ${halfInning} of the ${inningText}.`;

		// Try to determine if the player remained in the game and what position they played
		// Instead of looking for subsequent defensive substitutions, get position from player data
		const playerName = substitutingPlayer.replace('Pinch-hitter ', '').replace('Pinch-runner ', '').trim();
		const positionPlayed = getPlayerPositionFromData(playerName, detailedData);
		if (positionPlayed) {
			cleanFootnote += ` He remained in the game, playing ${positionPlayed}.`;
		}

		return cleanFootnote;
	}

	// Fallback to original description if parsing fails
	return description;
};

// Helper function to convert position abbreviation to position number
const convertPositionAbbreviationToNumber = (positionAbbrev: string): string => {
	// Handle positions with slashes like "RF/CF" -> "9/8"
	const positionMap: { [key: string]: string } = {
		P: '1',
		C: '2',
		'1B': '3',
		'2B': '4',
		'3B': '5',
		SS: '6',
		LF: '7',
		CF: '8',
		RF: '9',
		DH: '10',
	};

	// Split by slash if multiple positions
	if (positionAbbrev.includes('/')) {
		const positions = positionAbbrev.split('/');
		return positions.map((pos) => positionMap[pos.trim()] || pos).join('/');
	}

	return positionMap[positionAbbrev] || positionAbbrev;
};

// Base running tracking system
interface BaseRunningMovement {
	from: string;
	to: string;
	atBatIndex: number;
	event: string;
	description?: string;
	isOut: boolean;
	outBase?: string;
	outNumber?: number;
	timestamp: string;
	playerId: number;
	playerName: string;
	batterName?: string;
	isInitialAtBat?: boolean;
	isPinchRunner?: boolean;
	isPinchRunnerMovement?: boolean;
}

interface BaseRunningTrip {
	tripId: string;
	atBatIndex: number;
	inning: number;
	halfInning: string;
	playerId: number;
	playerName: string;
	basePath: BaseRunningMovement[];
	ended: boolean;
	endReason: string | null;
	startTime: string;
	endTime: string | null;
	pinchRunners: Array<{
		playerId: number;
		playerName: string;
		atBatIndex: number;
		timestamp: string;
	}>;
}

interface BasePathVisualization {
	path: BaseRunningMovement[];
	finalBase: string;
	finalEvent: string;
	isOut: boolean;
	isScored: boolean;
	initialEvent: string;
	hasPinchRunner: boolean;
}

// Get all at-bats where players reached base
const getAtBatsWherePlayerReachedBase = (allPlays: any[]): any[] => {
	return allPlays.filter((play) => {
		// Must be an at-bat
		if (play.result.type !== 'atBat') return false;

		// Must not be out
		if (play.result.isOut === true) return false;

		// Must have reached a base - look for the batter reaching base safely
		return play.runners.some(
			(runner: any) =>
				runner.details.runner.id === play.matchup.batter.id && // This is the batter
				runner.movement.isOut === false && // Was not out
				(runner.movement.end !== null || runner.movement.end === 'score') // Reached a base or scored
		);
	});
};

// Get all at-bats for a specific player
const getPlayerAtBats = (allPlays: any[], playerId: number): any[] => {
	const playerAtBats = allPlays
		.filter((play) => play.result.type === 'atBat' && play.matchup.batter.id === playerId)
		.sort((a, b) => a.about.atBatIndex - b.about.atBatIndex);

	return playerAtBats;
};

// Track subsequent movements for a specific trip
const trackSubsequentMovements = (
	allPlays: any[],
	trip: BaseRunningTrip,
	playerId: number,
	startingAtBatIndex: number
): void => {
	// Get all plays AFTER the starting at-bat (not including it)
	// Also include plays with the same atBatIndex that occur after the initial at-bat (like stolen bases)
	const startingPlay = allPlays.find((play) => play.about.atBatIndex === startingAtBatIndex);
	const startingTimestamp = startingPlay ? startingPlay.about.startTime : '';

	const subsequentPlays = allPlays.filter(
		(play) =>
			play.about.atBatIndex > startingAtBatIndex ||
			(play.about.atBatIndex === startingAtBatIndex && play.about.startTime > startingTimestamp)
	);

	let currentBase = trip.basePath[trip.basePath.length - 1].to;
	let stillOnBase = true;
	let movementCount = 0;
	let currentPlayerId = playerId; // Track current player (may change with pinch runners)

	for (const play of subsequentPlays) {
		if (!stillOnBase) {
			break;
		}

		// Check if inning ended (new half-inning or different inning)
		if (play.about.inning !== trip.inning || play.about.halfInning !== trip.halfInning) {
			trip.ended = true;
			trip.endReason = 'inning ended';
			trip.endTime = play.about.startTime;
			stillOnBase = false;
			break;
		}

		// Check if this player is involved in this play - get ALL runner entries for this player
		const playerRunners = play.runners.filter((runner: any) => runner.details.runner.id === currentPlayerId);

		if (playerRunners.length > 0) {
			// Process each runner entry for this player
			for (const playerRunner of playerRunners) {
				// CRITICAL: Verify this movement is actually part of the current player's base running sequence
				// The player must be moving from their current base position
				const expectedStartBase = currentBase;
				const actualStartBase = playerRunner.movement.start;

				// Only count this movement if it's from the player's current base position
				// Special handling for scoring movements where startBase might be null
				const isValidMovement =
					actualStartBase === expectedStartBase ||
					(actualStartBase === null &&
						(playerRunner.movement.end === 'Home' || playerRunner.movement.end === 'score') &&
						(expectedStartBase === '2B' || expectedStartBase === '3B'));

				if (isValidMovement) {
					movementCount++;

					const movement = playerRunner.movement;

					// Check if this is a stolen base movement
					const isStolenBase =
						playerRunner.details.event.toLowerCase().includes('stolen') ||
						playerRunner.details.event.toLowerCase().includes('steals');

					// Track the movement - store both original event and shorthand
					// For stolen bases, use the runner event, otherwise use the play result event
					const eventToUse = isStolenBase ? playerRunner.details.event : play.result.event;
					const atBatResultShorthand = getMovementShorthand(eventToUse, false, play.result.description);

					trip.basePath.push({
						from: movement.start,
						to: movement.end,
						atBatIndex: play.about.atBatIndex,
						event: eventToUse, // Use runner event for stolen bases, play event for others
						description: play.result.description,
						isOut: movement.isOut,
						outBase: movement.outBase,
						outNumber: movement.outNumber,
						timestamp: play.about.startTime,
						playerId: playerRunner.details.runner.id,
						playerName: playerRunner.details.runner.fullName,
						batterName: play.matchup.batter.fullName,
					});

					// Check if this is a pinch runner (different player ID)
					if (playerRunner.details.runner.id !== playerId) {
						trip.pinchRunners.push({
							playerId: playerRunner.details.runner.id,
							playerName: playerRunner.details.runner.fullName,
							atBatIndex: play.about.atBatIndex,
							timestamp: play.about.startTime,
						});
						currentPlayerId = playerRunner.details.runner.id; // Update current player
					}

					// Check if trip ended
					if (movement.isOut) {
						trip.ended = true;
						trip.endReason = `out at ${movement.outBase}`;
						trip.endTime = play.about.endTime;
						stillOnBase = false;
					} else if (movement.end === 'score') {
						trip.ended = true;
						trip.endReason = 'scored';
						trip.endTime = play.about.endTime;
						stillOnBase = false;
					} else {
						currentBase = movement.end;
					}
				} else {
				}
			} // End of for loop processing each runner entry
		} else {
			// No movements found for current player - check for pinch runner substitution
			// Look for pinch runner: different player running from same base
			const potentialPinchRunner = play.runners.find(
				(runner: any) =>
					runner.details.runner.id !== currentPlayerId && // Different player ID
					runner.movement.start === currentBase && // Started from same base as current player
					runner.movement.start !== null // Not starting from Home
			);

			if (potentialPinchRunner) {
				// Add pinch runner info to trip
				trip.pinchRunners.push({
					playerId: potentialPinchRunner.details.runner.id,
					playerName: potentialPinchRunner.details.runner.fullName,
					atBatIndex: play.about.atBatIndex,
					timestamp: play.about.startTime,
				});

				// Switch to tracking the pinch runner
				currentPlayerId = potentialPinchRunner.details.runner.id;

				// Process the pinch runner's first movement
				const pinchRunnerMovement = {
					from: potentialPinchRunner.movement.start,
					to: potentialPinchRunner.movement.end,
					atBatIndex: play.about.atBatIndex,
					event: potentialPinchRunner.details.event,
					isOut: potentialPinchRunner.movement.isOut,
					outBase: potentialPinchRunner.movement.outBase,
					outNumber: potentialPinchRunner.movement.outNumber,
					timestamp: play.about.startTime,
					playerId: currentPlayerId,
					playerName: potentialPinchRunner.details.runner.fullName,
					batterName: play.matchup.batter.fullName,
					isOriginalPlayer: false,
					isPinchRunner: true,
				};

				trip.basePath.push(pinchRunnerMovement);

				// Update current base and check if trip ended
				if (potentialPinchRunner.movement.isOut) {
					trip.ended = true;
					trip.endReason = `out at ${potentialPinchRunner.movement.outBase} (pinch runner)`;
					trip.endTime = play.about.endTime;
					stillOnBase = false;
				} else if (potentialPinchRunner.movement.end === 'score') {
					trip.ended = true;
					trip.endReason = 'scored (pinch runner)';
					trip.endTime = play.about.endTime;
					stillOnBase = false;
				} else {
					currentBase = potentialPinchRunner.movement.end;
				}
			}
		}

		// Check if this is the player's next at-bat (trip should end if player is still on base)
		if (play.result.type === 'atBat' && play.matchup.batter.id === playerId && stillOnBase) {
			trip.ended = true;
			trip.endReason = 'player came up to bat again';
			trip.endTime = play.about.startTime;
			stillOnBase = false;
			break;
		}
	}
	if (trip.pinchRunners.length > 0) {
	}
};

// Track base running for a single at-bat
const trackSingleAtBatBaseRunning = (allPlays: any[], atBat: any): BaseRunningTrip => {
	const trip: BaseRunningTrip = {
		tripId: `${atBat.matchup.batter.id}_${atBat.about.atBatIndex}`,
		atBatIndex: atBat.about.atBatIndex,
		inning: atBat.about.inning,
		halfInning: atBat.about.halfInning,
		playerId: atBat.matchup.batter.id,
		playerName: atBat.matchup.batter.fullName,
		basePath: [],
		ended: false,
		endReason: null,
		startTime: atBat.about.startTime,
		endTime: null,
		pinchRunners: [],
	};

	// Check if player reached base in THIS at-bat
	// Look for any runner where the batter reached base safely
	const batterRunner = atBat.runners.find(
		(runner: any) =>
			runner.details.runner.id === atBat.matchup.batter.id && // This is the batter
			runner.movement.isOut === false && // Was not out
			(runner.movement.end !== null || runner.movement.end === 'score') // Reached a base or scored
	);

	if (batterRunner) {
		// For walks and HBP, show the proper movement notation
		let eventDisplay = atBat.result.event;
		if (atBat.result.event === 'Walk') {
			eventDisplay = 'BB';
		} else if (atBat.result.event === 'Hit By Pitch' || atBat.result.eventType === 'hit_by_pitch') {
			eventDisplay = 'Hit by pitch';
		}

		// Keep original event for tooltips, but generate shorthand for quadrant labels
		const atBatResultShorthand = getMovementShorthand(atBat.result.event, false, atBat.result.description);

		const initialMovement = {
			from: 'Home',
			to: batterRunner.movement.end,
			atBatIndex: atBat.about.atBatIndex,
			event: atBat.result.event, // Keep original event for tooltips
			description: atBat.result.description,
			isOut: false,
			timestamp: atBat.about.startTime,
			playerId: atBat.matchup.batter.id,
			playerName: atBat.matchup.batter.fullName,
			batterName: atBat.matchup.batter.fullName,
		};

		trip.basePath.push(initialMovement);

		// Track subsequent movements
		trackSubsequentMovements(allPlays, trip, atBat.matchup.batter.id, atBat.about.atBatIndex);
	} else {
		trip.ended = true;
		trip.endReason = 'out at bat';
		trip.endTime = atBat.about.endTime;
	}

	return trip;
};

// Track all base running for a specific player
const trackPlayerBaseRunning = (allPlays: any[], playerId: number): BaseRunningTrip[] => {
	const playerAtBats = getPlayerAtBats(allPlays, playerId);
	const baseRunningTrips: BaseRunningTrip[] = [];

	// Process each at-bat as a separate trip
	playerAtBats.forEach((atBat, index) => {
		const trip = trackSingleAtBatBaseRunning(allPlays, atBat);

		baseRunningTrips.push(trip);
	});

	return baseRunningTrips;
};

// Helper function to convert base names for display
const formatBaseName = (baseName: string, isStartBase: boolean = false): string => {
	const baseMap: { [key: string]: string } = {
		'1B': isStartBase ? 'First' : 'first',
		'2B': isStartBase ? 'Second' : 'second',
		'3B': isStartBase ? 'Third' : 'third',
		Home: 'Home',
		score: 'score',
	};
	return baseMap[baseName] || baseName;
};

// Helper function to format movement display text
const formatMovementDisplay = (
	event: string,
	to: string,
	isInitialAtBat: boolean = false,
	batterName?: string,
	isOut?: boolean,
	outBase?: string
): string => {
	// Handle initial at-bat movements (when player first reaches base)
	if (isInitialAtBat) {
		// Handle homeruns
		if (
			event.toLowerCase().includes('home run') ||
			event.toLowerCase().includes('homer') ||
			event.toLowerCase().includes('hr')
		) {
			return 'Scores on a homerun';
		}

		// Handle walks
		if (event.toLowerCase().includes('walk') || event.toLowerCase().includes('bb')) {
			return 'Walks';
		}

		// Handle hit by pitch
		if (event.toLowerCase().includes('hit by pitch') || event.toLowerCase().includes('hbp')) {
			return 'Hit by pitch';
		}

		// Handle all hits and other ways to reach any base
		const baseMap: { [key: string]: string } = {
			'1B': 'first',
			'2B': 'second',
			'3B': 'third',
			Home: 'home',
		};
		const baseName = baseMap[to] || to;
		const eventLower = event.toLowerCase();

		// Determine the article (a/an) based on the event
		const getArticle = (eventText: string): string => {
			const vowels = ['a', 'e', 'i', 'o', 'u'];
			const firstLetter = eventText.charAt(0).toLowerCase();
			return vowels.includes(firstLetter) ? 'an' : 'a';
		};

		// Handle specific event types with proper articles
		if (eventLower.includes('single')) {
			return `Reaches ${baseName} on a single`;
		} else if (eventLower.includes('double')) {
			return `Reaches ${baseName} on a double`;
		} else if (eventLower.includes('triple')) {
			return `Reaches ${baseName} on a triple`;
		} else if (eventLower.includes('error')) {
			return `Reaches ${baseName} on a fielding error`;
		} else if (eventLower.includes('fielders choice') || eventLower.includes("fielder's choice")) {
			return `Reaches ${baseName} on a fielder's choice`;
		} else {
			// For other events, use the event name with proper article
			const article = getArticle(event.toLowerCase());
			return `Reaches ${baseName} on ${article} ${event.toLowerCase()}`;
		}
	}

	// Handle scoring - use "Scores" with batter name
	if (to === 'score' || to === 'Home') {
		const batterText = batterName ? ` on ${batterName}'s ${event.toLowerCase()}` : ` on ${event.toLowerCase()}`;
		return `Scores${batterText}`;
	}

	// Handle when player is out - use "Out at [base]"
	if (isOut && outBase) {
		const baseMap: { [key: string]: string } = {
			'1B': 'first',
			'2B': 'second',
			'3B': 'third',
			Home: 'home',
		};
		const baseName = baseMap[outBase] || outBase;

		// Handle double play situations with "after" phrasing
		if (event.toLowerCase().includes('double play') || event.toLowerCase().includes('grounded into dp')) {
			const batterText = batterName
				? ` after ${batterName} grounds into a double play`
				: ` after grounds into a double play`;
			return `Out at ${baseName}${batterText}`;
		}

		// Standard out phrasing
		const batterText = batterName ? ` on ${batterName}'s ${event.toLowerCase()}` : ` on ${event.toLowerCase()}`;
		return `Out at ${baseName}${batterText}`;
	}

	// Handle stolen bases - don't add "Advances to"
	if (event.toLowerCase().includes('stolen base') || event.toLowerCase().includes('steals')) {
		const baseMap: { [key: string]: string } = {
			'1B': 'first',
			'2B': 'second',
			'3B': 'third',
			Home: 'home',
		};
		const targetBase = baseMap[to] || to;
		return `Steals ${targetBase} base`;
	}

	// Handle double play situations - use "after" phrasing
	if (event.toLowerCase().includes('double play') || event.toLowerCase().includes('grounded into dp')) {
		const baseName = formatBaseName(to, false);
		const batterText = batterName
			? ` after ${batterName} grounds into a double play`
			: ` after grounds into a double play`;
		return `Advances to ${baseName}${batterText}`;
	}

	// For all other movements, add "Advances to" with batter name
	const baseName = formatBaseName(to, false);
	const batterText = batterName ? ` on ${batterName}'s ${event.toLowerCase()}` : ` on ${event.toLowerCase()}`;
	return `Advances to ${baseName}${batterText}`;
};

// Helper function to format movement event text
const formatMovementEvent = (event: string, from: string, to: string): string => {
	// Handle stolen bases
	if (event.toLowerCase().includes('stolen base') || event.toLowerCase().includes('steals')) {
		const baseMap: { [key: string]: string } = {
			'1B': 'first',
			'2B': 'second',
			'3B': 'third',
			Home: 'home',
		};
		const targetBase = baseMap[to] || to;
		return `Steals ${targetBase} base`;
	}

	// Return original event for all other cases
	return event;
};

// Helper function to find player ID by name
const findPlayerIdByName = (allPlays: any[], playerName: string): number | null => {
	// Look in all plays for any reference to this player
	for (const play of allPlays) {
		// Check batter
		if (play.matchup?.batter?.fullName === playerName) {
			return play.matchup.batter.id;
		}

		// Check runners
		if (play.runners) {
			for (const runner of play.runners) {
				if (runner.details?.runner?.fullName === playerName) {
					return runner.details.runner.id;
				}
			}
		}

		// Check postOnFirst, postOnSecond, postOnThird
		if (play.matchup?.postOnFirst?.fullName === playerName) {
			return play.matchup.postOnFirst.id;
		}
		if (play.matchup?.postOnSecond?.fullName === playerName) {
			return play.matchup.postOnSecond.id;
		}
		if (play.matchup?.postOnThird?.fullName === playerName) {
			return play.matchup.postOnThird.id;
		}
	}
	return null;
};

// Enhance a base running trip with pinch runner movements
const enhanceTripWithPinchRunnerMovements = (allPlays: any[], trip: BaseRunningTrip, originalPlayerId: number) => {
	// Look for offensive substitution events that might indicate a pinch runner
	// Check both allPlays and the playEvents array for substitution events
	const substitutionPlays = allPlays.filter(
		(play: any) =>
			play.result.type === 'substitution' &&
			play.result.eventType === 'offensive_substitution' &&
			play.about.atBatIndex > trip.atBatIndex &&
			play.about.inning === trip.inning &&
			play.about.halfInning === trip.halfInning
	);

	// Also check the playEvents array for substitution events
	const playEventsSubstitutions = allPlays
		.filter(
			(play: any) =>
				play.about.atBatIndex > trip.atBatIndex &&
				play.about.inning === trip.inning &&
				play.about.halfInning === trip.halfInning
		)
		.flatMap((play: any) => play.playEvents || [])
		.filter((event: any) => event.eventType === 'offensive_substitution');

	const allSubstitutionPlays = [...substitutionPlays, ...playEventsSubstitutions];

	// Check each substitution to see if it's a pinch runner for this player
	allSubstitutionPlays.forEach((subPlay: any) => {
		const description = subPlay.result?.description || subPlay.description || '';

		// Look for pinch runner substitutions that replace the original player
		if (description.includes('Pinch-runner') && description.includes(`replaces`)) {
			// Extract the player names from the substitution description
			const match = description.match(/Pinch-runner\s+([^,]+)\s+replaces\s+([^.]*)/i);
			if (match) {
				const pinchRunnerName = match[1].trim();
				const replacedPlayerName = match[2].trim();

				// Check if this substitution is for our original player
				// We need to match the replaced player name with the original player
				const originalPlayerPlay = allPlays.find(
					(play: any) => play.about.atBatIndex === trip.atBatIndex && play.matchup.batter.id === originalPlayerId
				);

				if (originalPlayerPlay) {
					const originalPlayerName = originalPlayerPlay.matchup.batter.fullName;

					// Check if the names match (with flexible matching)
					const normalizedOriginal = originalPlayerName.replace(/[.\s]+/g, ' ').trim();
					const normalizedReplaced = replacedPlayerName.replace(/[.\s]+/g, ' ').trim();

					if (normalizedOriginal === normalizedReplaced) {
						// Find the pinch runner's player ID from the substitution event itself
						// Look for the pinch runner in the game data
						const pinchRunnerId = findPlayerIdByName(allPlays, pinchRunnerName);

						if (pinchRunnerId) {
							// Get the at-bat index where the substitution occurred
							// For playEvents substitutions, we need to find the parent play
							let substitutionAtBatIndex = subPlay.about?.atBatIndex;
							if (!substitutionAtBatIndex) {
								const parentPlay = allPlays.find((p) => p.playEvents?.some((e: any) => e === subPlay));
								substitutionAtBatIndex = parentPlay?.about.atBatIndex || trip.atBatIndex + 1;
							}

							// Track the pinch runner's movements and add them to this trip
							trackPinchRunnerMovements(allPlays, trip, pinchRunnerId, pinchRunnerName, substitutionAtBatIndex);
						}
					}
				}
			}
		}
	});
};

// Track pinch runner movements and add them to the original player's trip
const trackPinchRunnerMovements = (
	allPlays: any[],
	trip: BaseRunningTrip,
	pinchRunnerId: number,
	pinchRunnerName: string,
	substitutionAtBatIndex: number
) => {
	// Get all plays after the substitution
	const subsequentPlays = allPlays.filter(
		(play: any) =>
			play.about.atBatIndex > substitutionAtBatIndex &&
			play.about.inning === trip.inning &&
			play.about.halfInning === trip.halfInning
	);

	// Find the pinch runner's movements
	subsequentPlays.forEach((play: any) => {
		if (play.result.type === 'atBat' && play.matchup.batter.id === pinchRunnerId) {
			// This is the pinch runner's at-bat, the trip should end here
			trip.ended = true;
			trip.endReason = 'pinch runner came up to bat';
			return;
		}

		// Check for runner movements by the pinch runner - get ALL runner entries for this player
		if (play.result.type === 'atBat' && play.runners) {
			const pinchRunnerMovements = play.runners.filter((runner: any) => runner.details.runner.id === pinchRunnerId);

			if (pinchRunnerMovements.length > 0) {
				// Process each movement by the pinch runner
				for (const runner of pinchRunnerMovements) {
					const movement = {
						from: runner.movement.start,
						to: runner.movement.end,
						atBatIndex: play.about.atBatIndex,
						event: runner.details.event || 'Pinch Runner Movement',
						isOut: runner.details.isOut || false,
						timestamp: play.about.startTime,
						playerId: pinchRunnerId,
						playerName: pinchRunnerName,
					};

					trip.basePath.push(movement);

					// Add to pinch runners array if not already there
					const existingPinchRunner = trip.pinchRunners.find((pr) => pr.playerId === pinchRunnerId);
					if (!existingPinchRunner) {
						trip.pinchRunners.push({
							playerId: pinchRunnerId,
							playerName: pinchRunnerName,
							atBatIndex: substitutionAtBatIndex,
							timestamp: play.about.startTime,
						});
					}
				}
			}
		}
	});
};

// Get base running trip for a specific at-bat
const getBaseRunningTripForAtBat = (allPlays: any[], playerId: number, atBatIndex: number): BaseRunningTrip | null => {
	const playerTrips = trackPlayerBaseRunning(allPlays, playerId);
	const matchingTrip = playerTrips.find((trip) => trip.atBatIndex === atBatIndex);

	return matchingTrip || null;
};

// Helper function to get player position from their position field in the data
const getPlayerPositionFromData = (playerName: string, detailedData: any): string | null => {
	// Look through both home and away batters to find the player
	const homeBatters = detailedData?.game_data?.player_stats?.home?.batters || [];
	const awayBatters = detailedData?.game_data?.player_stats?.away?.batters || [];
	const allBatters = [...homeBatters, ...awayBatters];

	for (const batter of allBatters) {
		if (batter.name === playerName || batter.person?.fullName === playerName) {
			// Extract position number from position field (can be string like "PH/2", number like 2, or string number like "4")
			let positionNumber: number | null = null;

			if (typeof batter.position === 'number') {
				// Position is already a number
				positionNumber = batter.position;
			} else if (typeof batter.position === 'string') {
				// Position could be:
				// 1. String like "PH/2" or "PR/4" (need regex extraction)
				// 2. String number like "4", "9", "6", "2" (direct parse)
				const positionMatch = batter.position.match(/\/(\d+)$/);
				if (positionMatch) {
					positionNumber = parseInt(positionMatch[1]);
				} else {
					// Try to parse the string directly as a number
					const parsedNumber = parseInt(batter.position);
					if (!isNaN(parsedNumber)) {
						positionNumber = parsedNumber;
					}
				}
			}

			if (positionNumber !== null) {
				// Convert position number to abbreviation
				const positionMap: { [key: number]: string } = {
					1: 'P',
					2: 'C',
					3: '1B',
					4: '2B',
					5: '3B',
					6: 'SS',
					7: 'LF',
					8: 'CF',
					9: 'RF',
					10: 'DH',
				};
				const positionAbbrev = positionMap[positionNumber];
				return positionAbbrev;
			} else {
			}
		}
	}

	return null;
};

// Helper function to find what position a player played after an offensive substitution
const findPlayerPositionAfterSubstitution = (
	playerName: string,
	substitutionInning: number,
	substitutionHalfInning: string,
	detailedData: any
): string | null => {
	// Look through subsequent substitution events to see if this player got a defensive position
	if (detailedData?.game_data?.game_feed_substitutions) {
		for (const event of detailedData.game_data.game_feed_substitutions) {
			// Skip events before this substitution (same inning and half)
			if (
				event.inning < substitutionInning ||
				(event.inning === substitutionInning && event.halfInning === substitutionHalfInning)
			) {
				continue;
			}

			// Look for defensive substitutions where this player is mentioned in the description
			if (
				event.type === 'DEF' &&
				event.description &&
				event.description.toLowerCase().includes(playerName.toLowerCase())
			) {
				// Extract position from the description - look for "playing [position]"
				const positionMatch = event.description.match(/playing\s+([^.,]*)/i);
				if (positionMatch) {
					const position = positionMatch[1].trim();
					// Convert position to abbreviation if needed
					const positionAbbreviations: { [key: string]: string } = {
						'first base': '1B',
						'second base': '2B',
						'third base': '3B',
						shortstop: 'SS',
						'left field': 'LF',
						'center field': 'CF',
						'right field': 'RF',
						catcher: 'C',
						pitcher: 'P',
						'designated hitter': 'DH',
					};
					const abbreviation = positionAbbreviations[position.toLowerCase()] || position;
					return abbreviation;
				}
			}
		}
	}

	return null;
};

const enhanceSubstitutionDataWithPlayByPlay = (batters: any[], detailedData: any): any[] => {
	if (!detailedData?.game_data?.play_by_play) {
		return batters;
	}

	// Process play-by-play descriptions sequentially to track game state
	const { atBatResults, substitutionEvents, baseAdvancementEvents, lobTotals } =
		processSequentialGameState(detailedData);

	// Create substitution map from the game feed substitution data
	const substitutionMap = new Map<string, any>();

	// Use game feed substitution data if available, otherwise fall back to sequential events
	const substitutionData = detailedData.game_data?.game_feed_substitutions || substitutionEvents;

	// Map substitution events to batters
	substitutionData.forEach((event: any, index: number) => {
		// Skip pitching changes for batting lineup purposes - we only want offensive/defensive substitutions
		if (event.type === 'P') {
			return;
		}

		// For game feed data, we have both substitutingPlayer and replacedPlayer
		let replacedPlayerName = event.replacedPlayer;
		let substitutingPlayerName = event.substitutingPlayer;

		if (detailedData.game_data?.game_feed_substitutions && event.description) {
			// Extract replaced player name from description like "Ty France replaces first baseman Vladimir Guerrero Jr."
			const match = event.description.match(
				/replaces\s+(?:first baseman|second baseman|third baseman|shortstop|left fielder|center fielder|right fielder|catcher|pitcher|designated hitter|pinch-hitter|pinch-runner)?\s*([^,]+)/i
			);
			if (match) {
				replacedPlayerName = match[1].trim();
			}

			// Extract substituting player name from description like "Defensive Substitution: Ty France replaces..."
			const subMatch = event.description.match(/Defensive Substitution:\s*([^,]+)\s*replaces/i);
			if (subMatch) {
				substitutingPlayerName = subMatch[1].trim();
			}

			// Extract substituting player name from offensive substitutions like "Offensive Substitution: Pinch-hitter Randal Grichuk replaces..."
			const offSubMatch = event.description.match(
				/Offensive Substitution:\s*Pinch-(?:hitter|runner)\s*([^,]+)\s*replaces/i
			);
			if (offSubMatch) {
				substitutingPlayerName = offSubMatch[1].trim();
			}
		}

		// Find both the batter being substituted for AND the substituting player
		const replacedBatter = batters.find(
			(batter) => batter.name === replacedPlayerName || batter.person?.fullName === replacedPlayerName
		);

		const substitutingBatter = batters.find(
			(batter) => batter.name === substitutingPlayerName || batter.person?.fullName === substitutingPlayerName
		);

		// Debug: Log name matching for home team
		if (batters.length <= 15) {
			// Home team typically has fewer batters
		}

		const substitutionInfo = {
			type: event.type,
			inning: event.inning,
			halfInning: event.halfInning,
			description: event.description,
			replacedPlayer: replacedPlayerName,
			substitutingPlayer: substitutingPlayerName,
			position: event.position,
			chronologicalOrder: event.chronologicalOrder || index,
		};

		// Add substitution data to the replaced player
		if (replacedBatter) {
			substitutionMap.set(replacedBatter.name, substitutionInfo);
		}

		// Add substitution data to the substituting player (this is the key fix!)
		if (substitutingBatter) {
			substitutionMap.set(substitutingBatter.name, substitutionInfo);
		}
	});

	// Enhance each batter with correct substitution data
	return batters.map((batter) => {
		const substitutionData = substitutionMap.get(batter.name);
		if (substitutionData) {
			return {
				...batter,
				substitution_type: substitutionData.type,
				substitution_inning: substitutionData.inning,
				substitution_half_inning: substitutionData.halfInning,
				substitution_description: substitutionData.description,
				replaced_player: substitutionData.replacedPlayer,
				substitution_position: substitutionData.position,
				substitution_order: substitutionData.chronologicalOrder,
			};
		}
		return batter;
	});
};

// Helper function to process batter data and handle substitutions
const processBatterData = (
	batters: any[],
	pitchers: any[] = [],
	isAway: boolean = true,
	processedBatters?: any[],
	detailedData?: any
): BatterData[] => {
	// Don't reset footnote counter here - it should be reset once at the component level

	// Enhance substitution data with play-by-play timing information
	const enhancedBatters = enhanceSubstitutionDataWithPlayByPlay(batters, detailedData || null);

	// Debug: Check if home team batters are getting enhanced
	if (!isAway) {
		// Also log which home team batters have substitution data
		const homeSubstitutes = enhancedBatters.filter((b) => b.substitution_description);
	}

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
	const actualBatters = enhancedBatters.filter((batter: any) => {
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

			// Process substitutions using enhanced game feed data
			let previousSub = null;
			for (let j = 1; j < players.length; j++) {
				const sub = players[j];

				// Debug: Log home team substitution processing
				if (!isAway) {
				}

				// Use enhanced substitution data from game feed if available
				const actualSubstitutionType = sub.substitution_type || 'DEF'; // Default to DEF if not specified
				const actualInning = sub.substitution_inning || 9;
				const actualHalfInning = sub.substitution_half_inning || (isAway ? 'bottom' : 'top');

				// Determine display position based on substitution type
				let displayPosition = sub.position?.abbreviation || sub.position || 'OF';
				let initialPosition = '';
				let finalPosition = '';

				// Handle different substitution scenarios
				if (actualSubstitutionType === 'PH') {
					if (displayPosition && displayPosition !== 'PH' && displayPosition !== 'PR' && displayPosition !== 'DH') {
						initialPosition = 'PH';
						finalPosition = displayPosition;
					} else {
						displayPosition = 'PH';
						initialPosition = 'PH';
						finalPosition = 'PH';
					}
				} else if (actualSubstitutionType === 'PR') {
					if (displayPosition && displayPosition !== 'PR' && displayPosition !== 'PH' && displayPosition !== 'DH') {
						initialPosition = 'PR';
						finalPosition = displayPosition;
					} else {
						displayPosition = 'PR';
						initialPosition = 'PR';
						finalPosition = 'PR';
					}
				} else if (actualSubstitutionType === 'DEF') {
					displayPosition = sub.position?.abbreviation || sub.position || 'OF';
					initialPosition = displayPosition;
					finalPosition = displayPosition;
				}

				// Use game feed substitution description directly
				let footnote = 'Substitution details not available';
				if (sub.substitution_description) {
					// Create clean, natural footnote
					const cleanFootnote = createCleanSubstitutionFootnote(
						sub.substitution_description,
						actualInning,
						actualHalfInning,
						detailedData
					);

					// Add to global substitutions list for sequential numbering using chronological order
					const chronologicalOrder = sub.substitution_order || allSubstitutions.length + 1;
					allSubstitutions.push({ footnote: cleanFootnote, order: chronologicalOrder });
					footnote = cleanFootnote;
				} else {
				}

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
					// Include enhanced fields from play-by-play data
					substitution_inning: sub.substitution_inning,
					substitution_half_inning: sub.substitution_half_inning,
					substitution_description: sub.substitution_description,
					substitution_order: sub.substitution_order,
					replaced_player: sub.replaced_player || starter.person?.fullName || starter.name,
					substitution_position: sub.substitution_position,
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

			// Determine starter's initial and final positions
			let starterInitialPosition = starter.position?.abbreviation || starter.position || 'OF';
			let starterFinalPosition = starterInitialPosition;

			// Check if the starter changed positions during the game
			// Use the all_positions data to detect position changes
			if (starter.all_positions && starter.all_positions.length > 1) {
				// Starter has multiple positions - they changed positions during the game
				const firstPosition = starter.all_positions[0];
				const lastPosition = starter.all_positions[starter.all_positions.length - 1];

				// Convert position codes to abbreviations
				starterInitialPosition = mapPositionCodeToAbbreviation(firstPosition.code);
				starterFinalPosition = mapPositionCodeToAbbreviation(lastPosition.code);
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
const getFootnoteNumber = (footnote: string, substitutionOrder?: number): string => {
	// If we have the chronological order from enhanced data, use it
	if (substitutionOrder !== undefined) {
		return substitutionOrder.toString();
	}

	// Fallback to finding the footnote in our allSubstitutions list
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

// Helper function to determine base advancement from at-bat result
const getBaseAdvancement = (
	atBatResult: string
): { first: boolean; second: boolean; third: boolean; home: boolean } => {
	const result = atBatResult.toUpperCase();

	// Default: no advancement
	let first = false;
	let second = false;
	let third = false;
	let home = false;

	// Hits that reach first base
	if (result.includes('1B') || result.includes('SINGLE')) {
		first = true;
	}
	// Hits that reach second base
	else if (result.includes('2B') || result.includes('DOUBLE') || result.includes('GROUND-RULE')) {
		first = true;
		second = true;
	}
	// Hits that reach third base
	else if (result.includes('3B') || result.includes('TRIPLE')) {
		first = true;
		second = true;
		third = true;
	}
	// Hits that reach home (home runs)
	else if (result.includes('HR') || result.includes('HOME RUN')) {
		first = true;
		second = true;
		third = true;
		home = true;
	}
	// Walks and other ways to reach first base
	else if (
		result.includes('BB') ||
		result.includes('WALK') ||
		result.includes('HBP') ||
		result.includes('HIT BY PITCH') ||
		result.includes('ERROR') ||
		result.includes('E') ||
		result.includes("FIELDER'S CHOICE") ||
		result.includes('FC') ||
		result.includes('FOR') ||
		result.includes('FORCE OUT') ||
		result.includes('INTERFERENCE') ||
		result.includes('DROPPED THIRD STRIKE') ||
		result.includes("CATCHER'S INTERFERENCE")
	) {
		first = true;
	}

	return { first, second, third, home };
};

// Helper function to parse defensive sequence from play-by-play description
const parseDefensiveSequence = (description: string): string => {
	if (!description) return '';

	// Position name to number mapping
	const positionMap: { [key: string]: string } = {
		pitcher: '1',
		catcher: '2',
		'first baseman': '3',
		'second baseman': '4',
		'third baseman': '5',
		shortstop: '6',
		'left fielder': '7',
		'center fielder': '8',
		'right fielder': '9',
		// Handle variations
		'first base': '3',
		'second base': '4',
		'third base': '5',
		short: '6',
		'left field': '7',
		'center field': '8',
		'right field': '9',
	};

	const defensivePositions: string[] = [];

	// Look for patterns like "grounds out, shortstop Bobby Witt Jr. to first baseman Vinnie Pasquantino"
	// or "grounds out, pitcher Michael Lorenzen to first baseman Jac Caglianone"
	// or "grounds into a force out, shortstop Andrés Giménez to second baseman Ernie Clement"
	// Capture everything between the comma and the final period (handles periods in player names)
	const outPattern =
		/(?:grounds? (?:out|into(?:\s+a)?\s+(?:force\s+)?out)|flies? out|lines? out|pops? out).*?,\s*(.+?)\.$/i;
	const outMatch = description.match(outPattern);

	if (outMatch) {
		const defensiveSequence = outMatch[1];

		// Find positions in the order they appear in the description
		const defensiveSequenceText = defensiveSequence.toLowerCase();

		// Create a list of all position patterns to search for, ordered by specificity (longer matches first)
		const positionPatterns = [
			{ name: 'first baseman', number: '3' },
			{ name: 'second baseman', number: '4' },
			{ name: 'third baseman', number: '5' },
			{ name: 'left fielder', number: '7' },
			{ name: 'center fielder', number: '8' },
			{ name: 'right fielder', number: '9' },
			{ name: 'first base', number: '3' },
			{ name: 'second base', number: '4' },
			{ name: 'third base', number: '5' },
			{ name: 'left field', number: '7' },
			{ name: 'center field', number: '8' },
			{ name: 'right field', number: '9' },
			{ name: 'shortstop', number: '6' },
			{ name: 'short', number: '6' },
			{ name: 'pitcher', number: '1' },
			{ name: 'catcher', number: '2' },
		];

		// Find all positions and their indices, then sort by position in text
		const foundPositions: { index: number; number: string; name: string }[] = [];

		for (const pattern of positionPatterns) {
			let searchIndex = 0;
			while (searchIndex < defensiveSequenceText.length) {
				const index = defensiveSequenceText.indexOf(pattern.name, searchIndex);
				if (index !== -1) {
					foundPositions.push({ index, number: pattern.number, name: pattern.name });
					searchIndex = index + 1; // Continue searching after this match
				} else {
					break; // No more matches for this pattern
				}
			}
		}

		// Sort by index to maintain order and remove duplicates
		foundPositions.sort((a, b) => a.index - b.index);

		// Add positions to result in order
		foundPositions.forEach((pos) => {
			if (defensivePositions.length === 0 || defensivePositions[defensivePositions.length - 1] !== pos.number) {
				defensivePositions.push(pos.number);
			}
		});
	}

	// Also handle cases where the description might be simpler
	if (defensivePositions.length === 0) {
		// Look for direct position mentions in the description
		Object.keys(positionMap).forEach((positionName) => {
			const regex = new RegExp(`\\b${positionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
			if (regex.test(description)) {
				defensivePositions.push(positionMap[positionName]);
			}
		});
	}

	return defensivePositions.join('');
};

// Helper function to get out numbers for a specific at-bat within an inning
const getOutNumbersForAtBat = (
	batter: BatterData,
	inningNumber: number,
	columnIndex: number,
	detailedData: DetailedGameData | null
): number[] => {
	if (!detailedData?.play_by_play) {
		return [];
	}

	// Get ALL at-bats in this inning from ALL batters to calculate sequential out numbers
	const playByPlay = detailedData.play_by_play;
	const halfInning = batter.isAway ? 'top' : 'bottom';
	const allAtBatsInInning: Array<{
		atBatResult: string;
		description: string;
		endedInning: boolean;
		rbis: number;
		batterName: string;
		columnIndex: number;
	}> = [];

	// Get all batters (away or home)
	const allBatters = batter.isAway ? detailedData.batters?.away || [] : detailedData.batters?.home || [];

	// Collect all at-bats from all batters in this inning
	allBatters.forEach((batterData) => {
		// Get all players in this batting order position (including substitutes)
		const allPlayersInPosition: string[] = [batterData.name];

		// Add substitute players from the substitutions array
		if (batterData.substitutions && batterData.substitutions.length > 0) {
			batterData.substitutions.forEach((sub) => {
				if (sub.player_name && !allPlayersInPosition.includes(sub.player_name)) {
					allPlayersInPosition.push(sub.player_name);
				}
			});
		}

		// Look for at-bats from any player in this batting order position
		allPlayersInPosition.forEach((playerName) => {
			const atBatKey = `${playerName}-${inningNumber}-${halfInning}`;

			if (playByPlay.atBats && playByPlay.atBats[atBatKey]) {
				const atBats = playByPlay.atBats[atBatKey] || [];
				atBats.forEach((atBat: any, index: number) => {
					allAtBatsInInning.push({
						atBatResult: atBat.atBatResult || '',
						description: atBat.description || atBat.playDescription || '',
						endedInning: atBat.outs >= 3 || atBat.endedInning,
						rbis: atBat.rbi || 0,
						batterName: batterData.name,
						columnIndex: index,
					});
				});
			}
		});
	});

	// The raw play-by-play keys are already in chronological order!
	// Let's use the order of the keys to determine the chronological sequence
	const chronologicalKeys = Object.keys(playByPlay.atBats || {}).filter((key) =>
		key.includes(`-${inningNumber}-${halfInning}`)
	);

	// Sort the at-bats by their order in the chronological keys
	allAtBatsInInning.sort((a, b) => {
		const aKey = `${a.batterName}-${inningNumber}-${halfInning}`;
		const bKey = `${b.batterName}-${inningNumber}-${halfInning}`;

		const aIndex = chronologicalKeys.indexOf(aKey);
		const bIndex = chronologicalKeys.indexOf(bKey);

		// If both keys are found, sort by their position in the chronological keys
		if (aIndex !== -1 && bIndex !== -1) {
			if (aIndex !== bIndex) {
				return aIndex - bIndex;
			}
			// If same key (same batter), sort by column index
			return a.columnIndex - b.columnIndex;
		}

		// Fallback to original order if keys not found
		return 0;
	});

	// Find the current at-bat by matching batter and column index
	const currentAtBat = allAtBatsInInning.find(
		(atBat) => atBat.batterName === batter.name && atBat.columnIndex === columnIndex
	);

	if (!currentAtBat) {
		return [];
	}

	// Count outs before this at-bat (from all batters in the inning)
	let outsBeforeThisAtBat = 0;
	const currentAtBatIndex = allAtBatsInInning.findIndex(
		(atBat) => atBat.batterName === batter.name && atBat.columnIndex === columnIndex
	);

	for (let i = 0; i < currentAtBatIndex; i++) {
		const prevAtBat = allAtBatsInInning[i];
		if (prevAtBat && prevAtBat.atBatResult) {
			const outs = parseOutsFromDescription(prevAtBat.atBatResult, prevAtBat.description || '');
			outsBeforeThisAtBat += outs.length;
		}
	}

	// Get outs for current at-bat
	const currentOuts = parseOutsFromDescription(currentAtBat.atBatResult, currentAtBat.description || '');

	// Convert to actual out numbers (1, 2, 3)
	const outNumbers = currentOuts.map((_, index) => outsBeforeThisAtBat + index + 1);

	// Ensure we don't exceed 3 outs per inning
	return outNumbers.filter((num) => num <= 3);
};

// Helper function to parse outs from play-by-play description
const parseOutsFromDescription = (atBatResult: string, description: string = ''): number[] => {
	if (!atBatResult && !description) return [];

	const outs: number[] = [];
	const result = atBatResult.toLowerCase();
	const desc = description.toLowerCase();

	// Look for patterns indicating outs
	// Single out: "out at 1st", "out at 2nd", "out at 3rd", "out at home"
	// Multiple outs: "double play", "triple play"
	// Also check for general out patterns: "grounds out", "flies out", etc.

	// Check for double play
	if (desc.includes('double play') || result.includes('double play')) {
		outs.push(1, 2);
	}
	// Check for triple play
	else if (desc.includes('triple play') || result.includes('triple play')) {
		outs.push(1, 2, 3);
	}
	// Check for single out patterns - be more comprehensive
	else {
		// First check if the atBatResult itself indicates an out
		const isOut =
			!!result.match(/^g\d+$/i) || // Groundout: G63, G6, etc.
			!!result.match(/^f\d+$/i) || // Flyout: F7, F8, etc.
			!!result.match(/^l\d+$/i) || // Lineout: L4, L6, etc.
			!!result.match(/^p\d+$/i) || // Popout: P2, P5, etc.
			result.includes('k') || // Strikeout: K
			result.includes('strikeout') ||
			result.includes('out') ||
			result.includes('groundout') ||
			result.includes('flyout') ||
			result.includes('lineout') ||
			result.includes('popout') ||
			result.includes('sac') || // Sacrifice: SAC
			result.includes('sacrifice');

		if (isOut) {
			outs.push(1); // Single out
		} else {
			// Look for any out pattern in the description
			const outPatterns = [
				/out at (?:1st|2nd|3rd|home)/gi,
				/grounds?\s+out/gi,
				/flies?\s+out/gi,
				/lines?\s+out/gi,
				/pops?\s+out/gi,
				/force\s+out/gi,
				/strikeout/gi,
				/strikes?\s+out/gi,
			];

			for (const pattern of outPatterns) {
				if (pattern.test(desc) || pattern.test(result)) {
					outs.push(1); // Single out
					break;
				}
			}
		}
	}

	return outs;
};

// Helper function to get corner label text based on at-bat result
const getCornerLabels = (
	atBatResult: string,
	description?: string
): { first: string; second: string; third: string; home: string } => {
	const result = atBatResult.toUpperCase();

	// Default: no labels
	let first = '';
	let second = '';
	let third = '';
	let home = '';

	// Hits that reach first base
	if (result.includes('1B') || result.includes('SINGLE')) {
		first = '1B';
	}
	// Hits that reach second base - only label second base
	else if (result.includes('2B') || result.includes('DOUBLE') || result.includes('GROUND-RULE')) {
		second = '2B';
	}
	// Hits that reach third base - only label third base
	else if (result.includes('3B') || result.includes('TRIPLE')) {
		third = '3B';
	}
	// Walks and other ways to reach first base
	else if (result.includes('BB') || result.includes('WALK')) {
		first = 'BB';
	} else if (result.includes('HBP') || result.includes('HIT BY PITCH')) {
		first = 'HBP';
	} else if (result.includes('ERROR') || result.includes('E')) {
		first = 'E';
	} else if (result.includes("FIELDER'S CHOICE") || result.includes('FC')) {
		first = 'FC';
	} else if (result.includes('INTERFERENCE') || result.includes("CATCHER'S INTERFERENCE")) {
		first = 'CI';
	} else if (result.includes('DROPPED THIRD STRIKE')) {
		first = 'K+';
	}
	// Handle outs - parse defensive sequence from description
	else if (
		result.includes('OUT') ||
		result.includes('GROUNDOUT') ||
		result.includes('FLYOUT') ||
		result.includes('LINEOUT') ||
		result.includes('POPOUT')
	) {
		// For outs, we need to determine which base the player reached (if any) and show the defensive sequence
		const advancement = getBaseAdvancement(atBatResult);
		let defensiveSequence = '';

		if (description) {
			defensiveSequence = parseDefensiveSequence(description);
		}

		// If we have a defensive sequence, show it at the furthest base reached
		if (defensiveSequence) {
			if (advancement.home) {
				home = defensiveSequence;
			} else if (advancement.third) {
				third = defensiveSequence;
			} else if (advancement.second) {
				second = defensiveSequence;
			} else if (advancement.first) {
				first = defensiveSequence;
			}
		}
	}

	return { first, second, third, home };
};

// Helper function to determine if we should use center text instead of corner labels
const shouldUseCenterText = (atBatResult: string, description?: string): boolean => {
	const result = atBatResult.toUpperCase();

	// Always use center text for home runs and strikeouts
	if (result.includes('HR') || result.includes('HOME RUN') || result.includes('K') || result.includes('STRIKEOUT')) {
		return true;
	}

	// For outs, check if we have defensive sequences to show in corner labels
	const isOut =
		// Shorthand notation for outs (letter followed by number)
		!!result.match(/^G\d+$/) || // Groundouts: G1, G3, G43, etc.
		!!result.match(/^F\d+$/) || // Flyouts: F1, F7, F9, etc.
		!!result.match(/^L\d+$/) || // Lineouts: L2, L7, L1, etc.
		!!result.match(/^P\d+$/) || // Popouts: P5, P1, P2, etc.
		result.includes('OUT') ||
		result.includes('GROUNDOUT') ||
		result.includes('FLYOUT') ||
		result.includes('LINEOUT') ||
		result.includes('POPOUT') ||
		result.includes('POP OUT') ||
		result.includes('GROUND OUT') ||
		result.includes('FLY OUT') ||
		result.includes('LINE OUT') ||
		result.includes('GO') ||
		result.includes('FO') ||
		result.includes('LO') ||
		result.includes('PO') ||
		result.includes('DP') ||
		result.includes('TP') ||
		result.includes('SF') ||
		result.includes('SH') ||
		result.includes('SAC') ||
		result.includes('SAC FLY') ||
		result.includes('SACRIFICE FLY') ||
		result.includes('SACRIFICE HIT') ||
		result.includes('SACRIFICE') ||
		result.includes('DOUBLE PLAY') ||
		result.includes('TRIPLE PLAY') ||
		result.includes("FIELDER'S CHOICE OUT") ||
		result.includes('FC OUT') ||
		result.includes('UNASSISTED') ||
		result.includes('FORCE OUT') ||
		result.includes('FIELD OUT');

	// For force outs/fielder's choice, use top-left positioning (like center text)
	if (
		result.includes('FOR') ||
		result.includes('FORCE OUT') ||
		result.includes("FIELDER'S CHOICE") ||
		result.includes('FC')
	) {
		return true;
	}

	// For outs, always use center text (but we'll enhance it with defensive sequences)
	if (isOut) {
		return true;
	}

	// For hits (singles, doubles, triples), walks, HBP, and errors, use center text display
	if (result.includes('1B') || result.includes('SINGLE')) {
		return true;
	} else if (result.includes('2B') || result.includes('DOUBLE') || result.includes('GROUND-RULE')) {
		return true;
	} else if (result.includes('3B') || result.includes('TRIPLE')) {
		return true;
	} else if (result.includes('BB') || result.includes('WALK')) {
		return true;
	} else if (result.includes('HBP') || result.includes('HIT BY PITCH')) {
		return true;
	} else if (result.includes('ERROR') || result.includes('E')) {
		return true;
	}

	// For all other plays, use corner labels only
	return false;
};

// Helper function to get enhanced center text for outs with defensive sequences
const getEnhancedCenterText = (atBatResult: string, description?: string): string => {
	const result = atBatResult.toUpperCase();

	// For force outs/fielder's choice, enhance with defensive sequences (they now use top-left positioning)
	if (
		result.includes('FOR') ||
		result.includes('FORCE OUT') ||
		result.includes("FIELDER'S CHOICE") ||
		result.includes('FC')
	) {
		if (description) {
			const defensiveSequence = parseDefensiveSequence(description);
			if (defensiveSequence && defensiveSequence.length > 0) {
				// Create FC notation with defensive sequence
				return `FC${defensiveSequence}`;
			}
		}
		return 'FC';
	}

	// For outs, try to enhance with defensive sequences
	const isOut =
		!!result.match(/^G\d+$/) ||
		!!result.match(/^F\d+$/) ||
		!!result.match(/^L\d+$/) ||
		!!result.match(/^P\d+$/) ||
		result.includes('OUT') ||
		result.includes('GROUNDOUT') ||
		result.includes('FLYOUT') ||
		result.includes('LINEOUT') ||
		result.includes('POPOUT');

	if (isOut && description) {
		const defensiveSequence = parseDefensiveSequence(description);
		if (defensiveSequence && defensiveSequence.length > 0) {
			// Replace the simple notation with the enhanced defensive sequence
			// e.g., "G1" becomes "G63" if defensive sequence is "63"
			if (result.startsWith('G')) {
				return `G${defensiveSequence}`;
			} else if (result.startsWith('F')) {
				return `F${defensiveSequence}`;
			} else if (result.startsWith('L')) {
				return `L${defensiveSequence}`;
			} else if (result.startsWith('P')) {
				return `P${defensiveSequence}`;
			}
		}
	}

	// For strikeouts, distinguish between called and swinging
	if (result.includes('K') || result.includes('STRIKEOUT') || result.includes('STRIKES OUT')) {
		if (description) {
			const desc = description.toLowerCase();
			// Called strikeout (backwards K) - "called out on strikes" or "strikes out looking"
			if (desc.includes('called out on strikes') || desc.includes('strikes out looking')) {
				return 'K'; // We'll use CSS to mirror this
			}
			// Swinging strikeout (regular K) - "strikes out swinging"
			else if (desc.includes('strikes out swinging')) {
				return 'K';
			}
		}
		return 'K'; // Default to regular K if description doesn't match
	}

	// For hits and walks, return the appropriate label
	if (result.includes('1B') || result.includes('SINGLE')) {
		return '1B';
	} else if (result.includes('2B') || result.includes('DOUBLE') || result.includes('GROUND-RULE')) {
		return '2B';
	} else if (result.includes('3B') || result.includes('TRIPLE')) {
		return '3B';
	} else if (result.includes('BB') || result.includes('WALK')) {
		return 'BB';
	} else if (result.includes('HBP') || result.includes('HIT BY PITCH')) {
		return 'HBP';
	} else if (result.includes('ERROR') || result.includes('E')) {
		// For errors, try to extract defensive position numbers
		if (description) {
			const defensiveSequence = parseDefensiveSequence(description);
			if (defensiveSequence && defensiveSequence.length > 0) {
				return `E${defensiveSequence}`;
			}
		}
		return 'E';
	}

	// For all other cases, return the original atBatResult
	return atBatResult;
};

// Helper function to extract the actual player name from play-by-play description
const extractPlayerNameFromDescription = (description: string): string => {
	if (!description) return '';

	// Most play-by-play descriptions start with the player name
	// Examples:
	// "Vladimir Guerrero Jr. grounds out, shortstop Bobby Witt Jr. to first baseman Vinnie Pasquantino."
	// "George Springer homers (30) on a fly ball to left center field."
	// "Maikel Garcia walks."

	// Handle challenged play descriptions first
	if (description.includes('challenged') && description.includes('overturned:')) {
		// Extract player name after "overturned:"
		const afterOverturned = description.split('overturned:')[1];
		if (afterOverturned) {
			// Simple approach: extract everything before the first action verb
			const actionVerbs = [
				'grounds',
				'flies',
				'lines',
				'pops',
				'homers',
				'singles',
				'doubles',
				'triples',
				'walks',
				'strikes',
				'hits',
				'reaches',
				'advances',
				'steals',
				'caught',
				'thrown',
				'out',
				'safe',
				'scores',
				'drives',
				'swings',
				'called',
				'bunts',
				'sacrifices',
				'pinch',
				'replaces',
				'substitution',
				'hit by pitch',
			];

			let extractedName = afterOverturned.trim();
			for (const verb of actionVerbs) {
				const verbIndex = extractedName.toLowerCase().indexOf(' ' + verb);
				if (verbIndex !== -1) {
					extractedName = extractedName.substring(0, verbIndex);
					break;
				}
			}

			if (extractedName) {
				return extractedName.trim();
			}
		}
	}

	// Extract the first part before the first period, comma, or action verb
	const match = description.match(
		/^([^.,]+?)(?:\s+(?:grounds|flies|lines|pops|homers|singles|doubles|triples|walks|strikes|hits|reaches|advances|steals|caught|thrown|out|safe|scores|drives|swings|called|bunts|sacrifices|pinch|replaces|substitution|hit by pitch))/i
	);

	if (match && match[1]) {
		return match[1].trim();
	}

	// Fallback: take everything before the first period
	const beforePeriod = description.split('.')[0];
	if (beforePeriod) {
		return beforePeriod.trim();
	}

	return '';
};

// Helper function to parse substitution information from play-by-play descriptions
const parseSubstitutionFromDescription = (
	description: string
): {
	isSubstitution: boolean;
	substitutionType?: 'PH' | 'PR' | 'DEF';
	substitutingPlayer?: string;
	replacedPlayer?: string;
	position?: string;
	originalText?: string;
} => {
	if (!description) return { isSubstitution: false };

	const desc = description.toLowerCase();

	// Check for various substitution patterns

	// Pattern 1: "Offensive substitution: Player X pinch-hits for Player Y"
	const offensivePhMatch = desc.match(/offensive substitution[:\s]+([^,]+?)\s+pinch-hits?\s+for\s+([^,]+?)\.?/i);
	if (offensivePhMatch) {
		return {
			isSubstitution: true,
			substitutionType: 'PH',
			substitutingPlayer: offensivePhMatch[1].trim(),
			replacedPlayer: offensivePhMatch[2].trim(),
			originalText: description,
		};
	}

	// Pattern 2: "Offensive substitution: Player X pinch-runs for Player Y"
	const offensivePrMatch = desc.match(/offensive substitution[:\s]+([^,]+?)\s+pinch-runs?\s+for\s+([^,]+?)\.?/i);
	if (offensivePrMatch) {
		return {
			isSubstitution: true,
			substitutionType: 'PR',
			substitutingPlayer: offensivePrMatch[1].trim(),
			replacedPlayer: offensivePrMatch[2].trim(),
			originalText: description,
		};
	}

	// Pattern 3: "Defensive substitution: Player X replaces Player Y"
	const defensiveMatch = desc.match(/defensive substitution[:\s]+([^,]+?)\s+replaces?\s+([^,]+?)\.?/i);
	if (defensiveMatch) {
		return {
			isSubstitution: true,
			substitutionType: 'DEF',
			substitutingPlayer: defensiveMatch[1].trim(),
			replacedPlayer: defensiveMatch[2].trim(),
			originalText: description,
		};
	}

	// Pattern 4: "Player X pinch-hits for Player Y"
	const directPhMatch = desc.match(/([^,]+?)\s+pinch-hits?\s+for\s+([^,]+?)\.?/i);
	if (directPhMatch) {
		return {
			isSubstitution: true,
			substitutionType: 'PH',
			substitutingPlayer: directPhMatch[1].trim(),
			replacedPlayer: directPhMatch[2].trim(),
			originalText: description,
		};
	}

	// Pattern 5: "Player X pinch-runs for Player Y"
	const directPrMatch = desc.match(/([^,]+?)\s+pinch-runs?\s+for\s+([^,]+?)\.?/i);
	if (directPrMatch) {
		return {
			isSubstitution: true,
			substitutionType: 'PR',
			substitutingPlayer: directPrMatch[1].trim(),
			replacedPlayer: directPrMatch[2].trim(),
			originalText: description,
		};
	}

	// Pattern 6: "Player X replaces Player Y" (defensive substitution)
	const directDefMatch = desc.match(/([^,]+?)\s+replaces?\s+([^,]+?)\s+(?:at\s+([^,]+?)|playing\s+([^,]+?))\.?/i);
	if (directDefMatch) {
		return {
			isSubstitution: true,
			substitutionType: 'DEF',
			substitutingPlayer: directDefMatch[1].trim(),
			replacedPlayer: directDefMatch[2].trim(),
			position: directDefMatch[3]?.trim() || directDefMatch[4]?.trim(),
			originalText: description,
		};
	}

	// Pattern 7: "Pitching change: Player X replaces Player Y"
	const pitchingChangeMatch = desc.match(/pitching change[:\s]+([^,]+?)\s+replaces?\s+([^,]+?)\.?/i);
	if (pitchingChangeMatch) {
		return {
			isSubstitution: true,
			substitutionType: 'DEF',
			substitutingPlayer: pitchingChangeMatch[1].trim(),
			replacedPlayer: pitchingChangeMatch[2].trim(),
			position: 'P',
			originalText: description,
		};
	}

	return { isSubstitution: false };
};

// Helper function to parse at-bat result from play-by-play description
const parseAtBatFromDescription = (
	description: string,
	gameState: GameState,
	chronologicalOrder: number
): AtBatResult | null => {
	if (!description) return null;

	const desc = description.toLowerCase();

	// Extract batter name (everything before the first action verb)
	const batterMatch = description.match(
		/^([^.]+?)\s+(singles|doubles|triples|homers?|walks?|strikes?\s+out|grounds?\s+out|flies?\s+out|lines?\s+out|pops?\s+out)/i
	);
	if (!batterMatch) return null;

	const batterName = batterMatch[1].trim();

	// Parse different types of at-bats
	let result = '';
	let label = '';
	let baseAdvancement = { first: false, second: false, third: false, home: false };
	let rbis = 0;
	let outs = 0;

	if (desc.includes('singles')) {
		result = 'single';
		label = '1B';
		baseAdvancement.first = true;
	} else if (desc.includes('doubles')) {
		result = 'double';
		label = '2B';
		baseAdvancement.first = true;
		baseAdvancement.second = true;
	} else if (desc.includes('triples')) {
		result = 'triple';
		label = '3B';
		baseAdvancement.first = true;
		baseAdvancement.second = true;
		baseAdvancement.third = true;
	} else if (desc.includes('homers')) {
		result = 'home_run';
		label = 'HR';
		baseAdvancement = { first: true, second: true, third: true, home: true };
		// Count RBIs from "scores" mentions in description
		rbis = (description.match(/scores/g) || []).length + 1; // +1 for the batter themselves
	} else if (desc.includes('walks')) {
		result = 'walk';
		label = 'BB';
		baseAdvancement.first = true;
	} else if (desc.includes('strikes out') || desc.includes('struck out')) {
		result = 'strikeout';
		label = 'K';
		outs = 1;
	} else if (desc.includes('grounds out') || desc.includes('grounded out')) {
		result = 'field_out';
		label = parseDefensiveSequence(description) || 'G';
		outs = 1;
	} else if (desc.includes('flies out') || desc.includes('flied out')) {
		result = 'field_out';
		label = parseDefensiveSequence(description) || 'F';
		outs = 1;
	} else if (desc.includes('lines out') || desc.includes('lined out')) {
		result = 'field_out';
		label = parseDefensiveSequence(description) || 'L';
		outs = 1;
	} else if (desc.includes('pops out') || desc.includes('popped out')) {
		result = 'field_out';
		label = parseDefensiveSequence(description) || 'P';
		outs = 1;
	} else {
		// Unknown at-bat type
		return null;
	}

	return {
		batterName,
		result,
		label,
		baseAdvancement,
		rbis,
		outs,
		description,
		inning: gameState.currentInning,
		halfInning: gameState.currentHalfInning,
		chronologicalOrder,
	};
};

// Helper function to update game state based on at-bat result
const updateGameStateFromAtBat = (gameState: GameState, atBatResult: AtBatResult): void => {
	// Update outs
	gameState.outs += atBatResult.outs;

	// Update base runners based on at-bat result
	// This is simplified - real implementation would handle force outs, etc.
	if (atBatResult.baseAdvancement.first) {
		gameState.baseRunners.first = atBatResult.batterName;
	}
	if (atBatResult.baseAdvancement.second) {
		gameState.baseRunners.second = atBatResult.batterName;
	}
	if (atBatResult.baseAdvancement.third) {
		gameState.baseRunners.third = atBatResult.batterName;
	}
	if (atBatResult.baseAdvancement.home) {
		// Player scored - remove from bases
		if (gameState.baseRunners.first === atBatResult.batterName) gameState.baseRunners.first = null;
		if (gameState.baseRunners.second === atBatResult.batterName) gameState.baseRunners.second = null;
		if (gameState.baseRunners.third === atBatResult.batterName) gameState.baseRunners.third = null;
	}
};

// Helper function to parse base advancement events from play-by-play description
const parseBaseAdvancementFromDescription = (
	description: string,
	gameState: GameState,
	chronologicalOrder: number
): BaseAdvancementEvent[] => {
	const advancementEvents: BaseAdvancementEvent[] = [];

	// Look for patterns like "Player X to 2nd", "Player X scores", etc.
	const advancementPatterns = [
		// "Player X to 2nd"
		/([^,]+?)\s+to\s+(?:second|2nd)/gi,
		// "Player X to 3rd"
		/([^,]+?)\s+to\s+(?:third|3rd)/gi,
		// "Player X scores"
		/([^,]+?)\s+scores/gi,
	];

	for (const pattern of advancementPatterns) {
		let match;
		const regex = new RegExp(pattern.source, pattern.flags);
		while ((match = regex.exec(description)) !== null) {
			const playerName = match[1].trim();
			let toBase: 2 | 3 | 4;

			if (match[0].toLowerCase().includes('2nd') || match[0].toLowerCase().includes('second')) {
				toBase = 2;
			} else if (match[0].toLowerCase().includes('3rd') || match[0].toLowerCase().includes('third')) {
				toBase = 3;
			} else if (match[0].toLowerCase().includes('scores')) {
				toBase = 4;
			} else {
				continue;
			}

			// Determine which base the player was on before (simplified logic)
			let fromBase: 1 | 2 | 3;
			if (gameState.baseRunners.first === playerName) {
				fromBase = 1;
			} else if (gameState.baseRunners.second === playerName) {
				fromBase = 2;
			} else if (gameState.baseRunners.third === playerName) {
				fromBase = 3;
			} else {
				continue; // Player not found on bases
			}

			// Only add if it's actually an advancement
			if (toBase > fromBase) {
				advancementEvents.push({
					playerName,
					fromBase,
					toBase,
					advancementPlay: description,
					inning: gameState.currentInning,
					halfInning: gameState.currentHalfInning,
					chronologicalOrder,
				});
			}
		}
	}

	return advancementEvents;
};

// Helper function to extract all substitution events from play-by-play data with correct timing
const extractSubstitutionsFromPlayByPlay = (
	detailedData: DetailedGameData | null
): Array<{
	playerName: string;
	substitutionType: 'PH' | 'PR' | 'DEF';
	replacedPlayer?: string;
	position?: string;
	inning: number;
	halfInning: 'top' | 'bottom';
	description: string;
	chronologicalOrder: number;
}> => {
	if (!detailedData?.play_by_play) return [];

	const substitutions: Array<{
		playerName: string;
		substitutionType: 'PH' | 'PR' | 'DEF';
		replacedPlayer?: string;
		position?: string;
		inning: number;
		halfInning: 'top' | 'bottom';
		description: string;
		chronologicalOrder: number;
	}> = [];

	let chronologicalOrder = 1;

	// Process all innings and half-innings
	for (let inning = 1; inning <= 9; inning++) {
		for (const halfInning of ['top', 'bottom'] as const) {
			const inningKeys = Object.keys(detailedData.play_by_play.atBats || {}).filter((key) =>
				key.includes(`-${inning}-${halfInning}`)
			);

			for (const key of inningKeys) {
				const atBats = detailedData.play_by_play.atBats?.[key] || [];
				for (const atBat of atBats) {
					if (atBat.description) {
						const substitutionInfo = parseSubstitutionFromDescription(atBat.description);
						if (substitutionInfo.isSubstitution && substitutionInfo.substitutingPlayer) {
							substitutions.push({
								playerName: substitutionInfo.substitutingPlayer,
								substitutionType: substitutionInfo.substitutionType!,
								replacedPlayer: substitutionInfo.replacedPlayer,
								position: substitutionInfo.position,
								inning,
								halfInning,
								description: substitutionInfo.originalText || atBat.description,
								chronologicalOrder: chronologicalOrder++,
							});
						}
					}
				}
			}
		}
	}

	return substitutions;
};

// Helper function to determine if a strikeout is called (backwards K) or swinging (regular K)
const isCalledStrikeout = (atBatResult: string, description?: string): boolean => {
	const result = atBatResult.toUpperCase();
	if (!result.includes('K') && !result.includes('STRIKEOUT') && !result.includes('STRIKES OUT')) {
		return false;
	}

	if (description) {
		const desc = description.toLowerCase();
		return desc.includes('called out on strikes') || desc.includes('strikes out looking');
	}

	return false;
};

// Helper function to determine if an at-bat result is a hit or walk (for bold styling)
const isHit = (atBatResult: string): boolean => {
	const result = atBatResult.toUpperCase();
	return (
		result.includes('1B') ||
		result.includes('SINGLE') ||
		result.includes('2B') ||
		result.includes('DOUBLE') ||
		result.includes('GROUND-RULE') ||
		result.includes('3B') ||
		result.includes('TRIPLE') ||
		result.includes('HR') ||
		result.includes('HOME RUN') ||
		result.includes('BB') ||
		result.includes('WALK') ||
		result.includes('HBP') ||
		result.includes('HIT BY PITCH')
	);
};

// Enhanced helper function to render diamond grid with base advancement coloring, corner labels, and base running visualization
const renderDiamondGrid = (atBatResult?: string, description?: string, baseRunningTrip?: BaseRunningTrip) => {
	const advancement = atBatResult
		? getBaseAdvancement(atBatResult)
		: { first: false, second: false, third: false, home: false };

	const cornerLabels = atBatResult
		? getCornerLabels(atBatResult, description)
		: { first: '', second: '', third: '', home: '' };

	// Get base path visualization if available
	let basePathViz = baseRunningTrip ? getBasePathVisualization(baseRunningTrip) : null;

	// If no baseRunningTrip but we have corner labels (like HBP, BB, etc.), create a synthetic basePathViz
	// ONLY create synthetic if there's no real base running data available
	if (!basePathViz && atBatResult && Object.values(cornerLabels).some((label) => label)) {
		const result = atBatResult.toUpperCase();

		// Create synthetic movement for simple base-reaching events
		let syntheticMovement = null;

		if (result.includes('HBP') || result.includes('HIT BY PITCH')) {
			// Only create synthetic if we don't have real base running data
			syntheticMovement = {
				from: 'Home',
				to: '1B',
				atBatIndex: 0,
				event: 'Hit by pitch',
				description: description || '',
				isOut: false,
				timestamp: new Date().toISOString(),
				playerId: 0,
				playerName: '',
				isInitialAtBat: true,
			};
		} else if (result.includes('BB') || result.includes('WALK')) {
			syntheticMovement = {
				from: 'Home',
				to: '1B',
				atBatIndex: 0,
				event: 'Walk',
				description: description || '',
				isOut: false,
				timestamp: new Date().toISOString(),
				playerId: 0,
				playerName: '',
				isInitialAtBat: true,
			};
		}

		if (syntheticMovement) {
			basePathViz = {
				path: [syntheticMovement],
				finalBase: syntheticMovement.to,
				finalEvent: syntheticMovement.event,
				isOut: false,
				isScored: false,
				initialEvent: syntheticMovement.event,
				hasPinchRunner: false,
			};
		}
	}

	const useCenterText = atBatResult ? shouldUseCenterText(atBatResult, description) : false;

	// Base positions in the diamond (rotated 45 degrees):
	// Top Left = Second Base, Top Right = First Base, Bottom Left = Third Base, Bottom Right = Home Plate
	return (
		<div className="flex absolute inset-0 z-50 justify-center items-center">
			{/* COME BACK HERE */}
			<div className="relative w-6 h-6 rotate-45">
				{/* Enhanced Diamond grid with base path visualization */}
				<div className="grid grid-cols-2 gap-px w-6 h-6">
					{/* Top Left = Second Base (2B) */}
					<div
						className={`w-2.5 h-2.5 ${
							basePathViz
								? getBaseSquareColor(basePathViz, '2B')
								: advancement.second
								? 'bg-primary-600 dark:bg-primary-500'
								: 'bg-primary-200 dark:bg-primary-700'
						}`}></div>

					{/* Top Right = First Base (1B) */}
					<div
						className={`w-2.5 h-2.5 ${
							basePathViz
								? getBaseSquareColor(basePathViz, '1B')
								: advancement.first
								? 'bg-primary-900 dark:bg-primary-100'
								: 'bg-primary-200 dark:bg-primary-700'
						}`}></div>

					{/* Bottom Left = Third Base (3B) */}
					<div
						className={`w-2.5 h-2.5 ${
							basePathViz
								? getBaseSquareColor(basePathViz, '3B')
								: advancement.third
								? 'bg-primary-600 dark:bg-primary-500'
								: 'bg-primary-200 dark:bg-primary-700'
						}`}></div>

					{/* Bottom Right = Home Plate (Home) */}
					<div
						className={`w-2.5 h-2.5 ${
							basePathViz
								? getBaseSquareColor(basePathViz, 'Home')
								: advancement.home
								? 'bg-primary-600 dark:bg-primary-500'
								: 'bg-primary-200 dark:bg-primary-700'
						}`}></div>
				</div>

				{/* CORRECTED: Always show corner labels when there's movement data, regardless of useCenterText */}
				{(basePathViz || (!useCenterText && Object.values(cornerLabels).some((label) => label))) && (
					<>{basePathViz ? renderMovementLabels(basePathViz) : renderStandardLabels(cornerLabels)}</>
				)}
			</div>
		</div>
	);
};

// Helper function to extract inning statistics from MLB API data
const extractInningStats = (gameData: DetailedGameData | null) => {
	if (!gameData?.liveData?.linescore?.innings) {
		return null;
	}

	const innings = gameData.liveData.linescore.innings;
	const teamTotals = gameData.liveData.linescore.teams;

	return {
		innings: innings.map((inning: any) => ({
			inningNumber: inning.num,
			ordinalNumber: inning.ordinalNum,
			home: {
				runs: inning.home?.runs || 0,
				hits: inning.home?.hits || 0,
				errors: inning.home?.errors || 0,
				leftOnBase: inning.home?.leftOnBase || 0,
			},
			away: {
				runs: inning.away?.runs || 0,
				hits: inning.away?.hits || 0,
				errors: inning.away?.errors || 0,
				leftOnBase: inning.away?.leftOnBase || 0,
			},
		})),
		totals: {
			home: {
				runs: teamTotals?.home?.runs || 0,
				hits: teamTotals?.home?.hits || 0,
				errors: teamTotals?.home?.errors || 0,
				leftOnBase: teamTotals?.home?.leftOnBase || 0,
			},
			away: {
				runs: teamTotals?.away?.runs || 0,
				hits: teamTotals?.away?.hits || 0,
				errors: teamTotals?.away?.errors || 0,
				leftOnBase: teamTotals?.away?.leftOnBase || 0,
			},
		},
	};
};

// Helper function to get specific inning data
const getInningData = (gameData: DetailedGameData | null, inningNumber: number, isAway: boolean) => {
	const inningStats = extractInningStats(gameData);
	if (!inningStats) {
		return { runs: 0, hits: 0, errors: 0, leftOnBase: 0 };
	}

	const inning = inningStats.innings.find((inning: any) => inning.inningNumber === inningNumber);
	if (!inning) {
		return { runs: 0, hits: 0, errors: 0, leftOnBase: 0 };
	}

	return isAway ? inning.away : inning.home;
};

// Helper function to get errors for a specific inning
function getErrorsForInning(
	inningNumber: number,
	halfInning: 'top' | 'bottom',
	detailedData: DetailedGameData | null
): number {
	// First try to get errors from play-by-play data
	if (detailedData && detailedData.play_by_play && detailedData.play_by_play.errors) {
		const errorKey = `${inningNumber}-${halfInning}`;
		const inningErrors = detailedData.play_by_play.errors[errorKey] || [];
		if (inningErrors.length > 0) {
			return inningErrors.length;
		}
	}

	// Fallback: try to get errors from linescore data if available
	if (detailedData && detailedData.linescore && detailedData.linescore.innings) {
		const inning = detailedData.linescore.innings.find((inning: any) => inning.num === inningNumber);
		if (inning) {
			if (halfInning === 'top') {
				return inning.away?.errors || 0;
			} else {
				return inning.home?.errors || 0;
			}
		}
	}

	return 0;
}

// Helper function to get at-bat results for a specific inning and batter
const getAtBatResultsForInning = (
	batter: BatterData,
	inningNumber: number,
	detailedData: DetailedGameData | null
): Array<{ atBatResult: string; endedInning: boolean; rbis: number; description?: string }> => {
	if (!detailedData || !detailedData.play_by_play) {
		return [];
	}

	const playByPlay = detailedData.play_by_play;
	const atBatResults: Array<{ atBatResult: string; endedInning: boolean; rbis: number; description?: string }> = [];
	const halfInning = batter.isAway ? 'top' : 'bottom';

	// Get all players in this batting order position (including substitutes)
	const allPlayersInPosition: string[] = [batter.name];

	// Add substitute players from the substitutions array
	if (batter.substitutions && batter.substitutions.length > 0) {
		batter.substitutions.forEach((sub) => {
			if (sub.player_name && !allPlayersInPosition.includes(sub.player_name)) {
				allPlayersInPosition.push(sub.player_name);
			}
		});
	}

	// Look for at-bats from any player in this batting order position
	allPlayersInPosition.forEach((playerName) => {
		const atBatKey = `${playerName}-${inningNumber}-${halfInning}`;

		if (playByPlay.atBats && playByPlay.atBats[atBatKey]) {
			const atBats = playByPlay.atBats[atBatKey] || [];
			atBats.forEach((atBat: any) => {
				atBatResults.push({
					atBatResult: atBat.atBatResult || '',
					endedInning: atBat.outs >= 3 || atBat.endedInning,
					rbis: atBat.rbi || 0,
					description: atBat.description || atBat.playDescription || '',
				});
			});
		}
	});

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
	inningColumns,
	pitchSequences,
}: {
	batter: BatterData;
	index: number;
	displayInnings: number;
	isAway?: boolean;
	isLastRow?: boolean;
	detailedData: DetailedGameData | null;
	inningColumns: number[];
	pitchSequences: Map<string, AtBatPitchSequence>;
}) => {
	// Create dynamic column template based on inning structure
	const inningColumnTemplate = inningColumns.map((cols) => Array(cols).fill('1fr').join(' ')).join(' ');

	return (
		<div
			className={`grid gap-0 ${isLastRow ? '' : 'border-b border-primary-300 dark:border-primary-700'}`}
			style={{
				gridTemplateColumns: `40px 200px 30px ${inningColumnTemplate} 45px 45px 45px 45px 45px 45px`,
			}}>
			{/* Player Number */}
			<div className="flex flex-col border-r border-primary-400 dark:border-primary-600 h-18">
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.number || index + 1}
				</div>
				<div className="flex justify-center items-center h-6 font-medium border-b bg-primary-100 dark:bg-primary-800 text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.substitutions?.[0]?.player_number || ''}
				</div>
				<div className="flex justify-center items-center h-6 font-medium bg-primary-100 dark:bg-primary-800 text-2xs text-primary-900 dark:text-primary-100">
					{batter.substitutions?.[1]?.player_number || ''}
				</div>
			</div>

			{/* Player Name */}
			<div className="flex flex-col border-r border-primary-200 dark:border-primary-800 h-18">
				<div className="flex justify-between items-center px-2 h-6 border-b bg-primary-50 dark:bg-primary-900 border-primary-200 dark:border-primary-700">
					<span className="flex-1 min-w-0 font-bold truncate text-2xs text-primary-900 dark:text-primary-100">
						{batter.name}
					</span>
					{batter.average && batter.onBasePercentage && batter.sluggingPercentage && (
						<span className="flex-shrink-0 ml-2 font-normal text-[8px] text-primary-600 dark:text-primary-400">
							{formatSlashLine(batter.average, batter.onBasePercentage, batter.sluggingPercentage)}
						</span>
					)}
				</div>
				<div className="flex justify-between items-center px-2 h-6 border-b bg-primary-100 dark:bg-primary-800 border-primary-200 dark:border-primary-700">
					{batter.substitutions?.[0] && (
						<>
							<span className="flex-1 min-w-0 font-bold truncate text-2xs text-primary-900 dark:text-primary-100">
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
									<span className="flex-shrink-0 ml-2 font-normal text-[8px] text-primary-600 dark:text-primary-400">
										{formatSlashLine(
											batter.substitutions[0].average,
											batter.substitutions[0].onBasePercentage,
											batter.substitutions[0].sluggingPercentage
										)}
									</span>
								)}
						</>
					)}
				</div>
				<div className="flex justify-between items-center px-2 h-6 bg-primary-100 dark:bg-primary-800">
					{batter.substitutions?.[1] && (
						<>
							<span className="flex-1 min-w-0 font-bold truncate text-2xs text-primary-900 dark:text-primary-100">
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
									<span className="flex-shrink-0 ml-2 font-normal text-[8px] text-primary-600 dark:text-primary-400">
										{formatSlashLine(
											batter.substitutions[1].average,
											batter.substitutions[1].onBasePercentage,
											batter.substitutions[1].sluggingPercentage
										)}
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
								{convertPositionAbbreviationToNumber(batter.starter_initial_position || '')}
							</div>
							{/* Ending position (bottom right) */}
							<div className="absolute bottom-0.5 right-0.5 text-[8px] font-mono text-primary-900 dark:text-primary-100">
								{convertPositionAbbreviationToNumber(batter.starter_final_position || '')}
							</div>
						</div>
					) : (
						convertPositionAbbreviationToNumber(batter.position || '')
					)}
				</div>

				{/* First substitution position */}
				<div className="flex relative justify-center items-center h-6 font-medium border-b bg-primary-100 dark:bg-primary-800 text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
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
										{convertPositionAbbreviationToNumber(batter.substitutions[0].initial_position || '')}
									</div>
									{/* Ending position (bottom right) */}
									<div className="absolute bottom-0.5 right-0.5 text-[8px] font-mono text-primary-900 dark:text-primary-100">
										{convertPositionAbbreviationToNumber(batter.substitutions[0].final_position || '')}
									</div>
								</div>
							) : (
								convertPositionAbbreviationToNumber(batter.substitutions[0].position || '')
							)}
						</>
					)}
				</div>

				{/* Second substitution position */}
				<div className="flex relative justify-center items-center h-6 font-medium bg-primary-100 dark:bg-primary-800 text-2xs text-primary-900 dark:text-primary-100">
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
										{convertPositionAbbreviationToNumber(batter.substitutions[1].initial_position || '')}
									</div>
									{/* Ending position (bottom right) */}
									<div className="absolute bottom-0.5 right-0.5 text-[8px] font-mono text-primary-900 dark:text-primary-100">
										{convertPositionAbbreviationToNumber(batter.substitutions[1].final_position || '')}
									</div>
								</div>
							) : (
								convertPositionAbbreviationToNumber(batter.substitutions[1].position || '')
							)}
						</>
					)}
				</div>
			</div>

			{/* Inning Columns */}
			{inningColumns
				.map((columnCount, inningIndex) => {
					const inningNumber = inningIndex + 1;
					const isLastInning = inningIndex === inningColumns.length - 1;

					// Get at-bat results for this inning
					const atBatResults = getAtBatResultsForInning(batter, inningNumber, detailedData);

					// Get all substitutions that occurred in this inning (using enhanced data)
					const substitutionsInThisInning =
						batter.substitutions?.filter(
							(sub) => sub.substitution_inning === inningNumber || sub.inning === inningNumber
						) || [];

					if (substitutionsInThisInning.length > 0) {
					}

					// Render columns for this inning (1 or 2 columns)
					return Array.from({ length: columnCount }, (_, columnIndex) => {
						const isSecondColumn = columnIndex === 1;
						const atBatResult = atBatResults[columnIndex] || null;
						const isLastColumnOfInning = columnIndex === columnCount - 1;

						// Determine border styling based on substitution type and column position
						let borderClass = 'border-primary-400 dark:border-primary-700';

						// Add right border unless it's the last column of the last inning
						if (!(isLastColumnOfInning && isLastInning)) {
							borderClass += ' border-r';
						}

						// Apply substitution borders - each player gets only ONE border where they enter
						if (substitutionsInThisInning.length > 0) {
							// Get the substitution for this specific column
							const substitutionForThisColumn = substitutionsInThisInning[columnIndex];

							if (substitutionForThisColumn) {
								const substitutionType = substitutionForThisColumn.substitution_type;

								// Check if this is the same player as the previous substitution
								const isSamePlayerAsPrevious =
									columnIndex > 0 &&
									substitutionsInThisInning[columnIndex - 1]?.player_name === substitutionForThisColumn.player_name;

								// Only apply border if this is NOT the same player as the previous column
								if (!isSamePlayerAsPrevious) {
									if (substitutionType === 'PH') {
										// Pinch hitter comes in BEFORE their at-bat - left border
										borderClass =
											isLastColumnOfInning && isLastInning
												? 'border-l-2 border-l-primary-900 border-primary-200 dark:border-primary-700'
												: 'border-r border-l-2 border-l-primary-900 border-primary-200 dark:border-primary-700';
									} else if (substitutionType === 'DEF') {
										// Defensive substitution - right border
										borderClass =
											isLastColumnOfInning && isLastInning
												? 'border-r-2 border-r-primary-900 border-primary-200 dark:border-primary-700'
												: 'border-r border-r-2 border-r-primary-900 border-primary-200 dark:border-primary-700';
									} else if (substitutionType === 'PR') {
										// Pinch runner comes in AFTER the at-bat - right border
										borderClass =
											isLastColumnOfInning && isLastInning
												? 'border-r-2 border-r-primary-900 border-primary-200 dark:border-primary-700'
												: 'border-r border-r-2 border-r-primary-900 border-primary-200 dark:border-primary-700';
									}
								}
								// If it's the same player, no border (they're continuing in the game)
							}
						}

						// Add bottom border if this was the last at-bat of the inning
						if (atBatResult && atBatResult.endedInning) {
							borderClass += ' border-b-2 border-b-primary-900';
						}

						return (
							<div
								key={`${inningNumber}-${columnIndex}`}
								className={`flex relative justify-center items-center group h-fill w-fill cursor-crosshair hover:bg-primary-100 dark:hover:bg-primary-700 ${borderClass}`}
								onMouseEnter={() => {}}
								onMouseLeave={() => {}}>
								{/* Diamond grid background - only show when there's at-bat data */}
								{atBatResult &&
									(() => {
										// Get base running trip data for this at-bat
										let baseRunningTrip: BaseRunningTrip | null = null;

										// Try to get allPlays data from various possible paths
										const allPlays =
											detailedData?.liveData?.plays?.allPlays ||
											(detailedData as any)?.game_data?.play_by_play?.allPlays ||
											(detailedData as any)?.play_by_play?.allPlays;

										if (allPlays && atBatResult.description) {
											// Extract the actual player name from the description
											const actualPlayerName = extractPlayerNameFromDescription(atBatResult.description) || batter.name;

											// Normalize names for comparison (remove periods, extra spaces)
											const normalizedActualName = actualPlayerName.replace(/[.\s]+/g, ' ').trim();

											// Find all plays for this player in this inning
											const playerPlays = allPlays.filter((play: any) => {
												const normalizedPlayName = play.matchup.batter.fullName.replace(/[.\s]+/g, ' ').trim();
												return (
													play.result.type === 'atBat' &&
													normalizedPlayName === normalizedActualName &&
													play.about.inning === inningNumber
												);
											});

											// Sort plays by atBatIndex to ensure correct order
											playerPlays.sort((a: any, b: any) => a.about.atBatIndex - b.about.atBatIndex);

											// Match the specific at-bat based on column index
											const playerPlay = playerPlays[columnIndex];

											if (playerPlay) {
												const playerId = playerPlay.matchup.batter.id;
												baseRunningTrip = getBaseRunningTripForAtBat(allPlays, playerId, playerPlay.about.atBatIndex);
											}
										}

										return renderDiamondGrid(
											atBatResult.atBatResult,
											atBatResult.description,
											baseRunningTrip || undefined
										);
									})()}

								{/* Tooltip */}
								{atBatResult && (
									<AtBatTooltip
										description={atBatResult.description}
										atBatResult={atBatResult}
										batterName={batter.name}
										inningNumber={inningNumber}
										columnIndex={columnIndex}
										detailedData={detailedData}
									/>
								)}

								{atBatResult ? (
									<div className="relative z-10 w-full h-full">
										{/* Center text - positioned in top-left corner, left-aligned */}
										<span
											className={`absolute top-0 left-0 font-mono min-w-4 text-xs text-primary-900 dark:text-primary-100 px-0.5 pt-[1px] h-4 border-b border-r border-primary-400 dark:border-primary-600 ${
												shouldUseCenterText(atBatResult.atBatResult, atBatResult.description)
													? '[text-shadow:1px_1px_0_white,-1px_-1px_0_white,1px_-1px_0_white,-1px_1px_0_white] dark:[text-shadow:1px_1px_0_rgb(30_41_59),-1px_-1px_0_rgb(30_41_59),1px_-1px_0_rgb(30_41_59),-1px_1px_0_rgb(30_41_59)]'
													: ''
											} ${isHit(atBatResult.atBatResult) ? 'font-bold' : 'font-normal'} ${
												isCalledStrikeout(atBatResult.atBatResult, atBatResult.description) ? 'scale-x-[-1]' : ''
											}`}>
											{shouldUseCenterText(atBatResult.atBatResult, atBatResult.description)
												? getEnhancedCenterText(atBatResult.atBatResult, atBatResult.description)
												: ''}
										</span>
										{/* RBI indicators */}
										{atBatResult.rbis > 0 && (
											<div className="flex absolute bottom-1 left-1">
												{Array.from({ length: atBatResult.rbis }, (_, i) => (
													<div key={i} className="w-1 h-1 bg-primary-900 dark:bg-primary-100 rounded-full mr-0.5" />
												))}
											</div>
										)}

										{/* Ball and Strike indicators */}
										{(() => {
											// Get pitch sequence for this at-bat
											const halfInning = batter.isAway ? 'top' : 'bottom';
											const pitchSequence = getPitchSequenceForAtBat(
												pitchSequences,
												batter.name,
												inningNumber,
												halfInning
											);
											const pitchDisplay = getPitchSequenceDisplay(pitchSequence);

											return (
												<div className="flex absolute top-0 right-0 h-full -z-10">
													{/* Ball indicator */}
													<div className="w-2 h-[50%] border-l border-l-primary-200 dark:border-l-primary-600 bg-primary-100 dark:bg-primary-800 flex flex-col items-center">
														{pitchDisplay.balls.map((pitchNum, index) => (
															<div key={index} className="h-2 text-[6px] tracking-tighter text-center font-mono">
																{pitchNum}
															</div>
														))}
													</div>
													{/* Strike indicator column 1 */}
													<div className="flex flex-col items-center w-2 h-full border-l border-l-primary-200 dark:border-l-primary-600 bg-primary-100 dark:bg-primary-800">
														{pitchDisplay.strikeEvents.slice(0, 6).map((event, index) => (
															<div
																key={index}
																className={`h-2 flex items-center justify-center w-full tracking-tighter text-center text-[6px] font-mono ${
																	event.isFoul ? 'border border-primary-600 dark:border-primary-400' : ''
																}`}>
																{event.pitchNumber}
															</div>
														))}
														{pitchDisplay.inPlay && <X className="w-2 h-2 text-primary-900 dark:text-primary-100" />}
													</div>
													{/* Strike indicator column 2 */}
													<div className="flex flex-col items-center w-2 h-full border-l border-l-primary-200 dark:border-l-primary-600 bg-primary-100 dark:bg-primary-800">
														{pitchDisplay.strikeEvents.slice(6).map((event, index) => (
															<div
																key={index}
																className={`h-2 flex items-center justify-center w-full tracking-tighter text-center text-[6px] font-mono ${
																	event.isFoul ? 'border border-primary-600 dark:border-primary-400' : ''
																}`}>
																{event.pitchNumber}
															</div>
														))}
													</div>
												</div>
											);
										})()}

										{/* Out indicators */}
										{(() => {
											if (atBatResult?.description) {
												const outs = getOutNumbersForAtBat(batter, inningNumber, columnIndex, detailedData);
												return (
													outs.length > 0 && (
														<div className="flex absolute bottom-0.5 right-0.5 gap-0.5 z-20">
															{outs.map((outNumber, i) => (
																<div
																	key={i}
																	className="flex justify-center items-center w-3 h-3 rounded-full border pt-[2px] border-red-600 dark:border-red-300 bg-primary-100 dark:bg-primary-700">
																	<span className="leading-none text-red-600 text-[8px] dark:text-red-300">
																		{outNumber}
																	</span>
																</div>
															))}
														</div>
													)
												);
											}
											return null;
										})()}
									</div>
								) : (
									<div className="relative z-10 w-full h-full">
										<span className="text-2xs text-primary-400 dark:text-primary-600"></span>
									</div>
								)}
							</div>
						);
					});
				})
				.flat()}

			{/* Stats Columns */}
			<div className="flex flex-col border-r border-l border-l-primary-400 dark:border-l-primary-600 border-r-primary-400 dark:border-r-primary-600 h-18">
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.name ? batter.at_bats ?? 0 : ''}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.substitutions?.[0]?.player_name ? batter.substitutions[0].at_bats ?? 0 : ''}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium text-2xs text-primary-900 dark:text-primary-100">
					{batter.substitutions?.[1]?.player_name ? batter.substitutions[1].at_bats ?? 0 : ''}
				</div>
			</div>
			<div className="flex flex-col border-r border-primary-400 dark:border-primary-600 h-18">
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.name ? batter.hits ?? 0 : ''}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.substitutions?.[0]?.player_name ? batter.substitutions[0].hits ?? 0 : ''}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium text-2xs text-primary-900 dark:text-primary-100">
					{batter.substitutions?.[1]?.player_name ? batter.substitutions[1].hits ?? 0 : ''}
				</div>
			</div>
			<div className="flex flex-col border-r border-primary-400 dark:border-primary-600 h-18">
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.name ? batter.runs ?? 0 : ''}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.substitutions?.[0]?.player_name ? batter.substitutions[0].runs ?? 0 : ''}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium text-2xs text-primary-900 dark:text-primary-100">
					{batter.substitutions?.[1]?.player_name ? batter.substitutions[1].runs ?? 0 : ''}
				</div>
			</div>
			<div className="flex flex-col border-r border-primary-400 dark:border-primary-600 h-18">
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.name ? batter.rbi ?? 0 : ''}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.substitutions?.[0]?.player_name ? batter.substitutions[0].rbi ?? 0 : ''}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium text-2xs text-primary-900 dark:text-primary-100">
					{batter.substitutions?.[1]?.player_name ? batter.substitutions[1].rbi ?? 0 : ''}
				</div>
			</div>
			<div className="flex flex-col border-r border-primary-400 dark:border-primary-600 h-18">
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.name ? batter.walks ?? 0 : ''}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.substitutions?.[0]?.player_name ? batter.substitutions[0].walks ?? 0 : ''}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium text-2xs text-primary-900 dark:text-primary-100">
					{batter.substitutions?.[1]?.player_name ? batter.substitutions[1].walks ?? 0 : ''}
				</div>
			</div>
			<div className="flex flex-col h-18">
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.name ? batter.strikeouts ?? 0 : ''}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
					{batter.substitutions?.[0]?.player_name ? batter.substitutions[0].strikeouts ?? 0 : ''}
				</div>
				<div className="flex justify-center items-center h-6 font-mono font-medium text-2xs text-primary-900 dark:text-primary-100">
					{batter.substitutions?.[1]?.player_name ? batter.substitutions[1].strikeouts ?? 0 : ''}
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
		atBats: { [key: string]: any[] };
		substitutions: { [key: string]: any[] };
		inningResults: { [key: string]: any[] };
		errors: { [key: string]: any[] };
	};
	// Game feed substitution data
	game_feed_substitutions?: any[];
	// Reference to original game data for compatibility
	game_data?: any;
	// Game feed data for base running tracking
	liveData?: {
		plays?: {
			allPlays?: any[];
			currentPlay?: any;
			scoringPlays?: any[];
			playsByInning?: any;
		};
		linescore?: any;
		boxscore?: any;
		decisions?: any;
		leaders?: any;
	};
	linescore?: {
		innings: Array<{
			num: number;
			away?: { runs: number; hits: number; errors: number; leftOnBase: number };
			home?: { runs: number; hits: number; errors: number; leftOnBase: number };
		}>;
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
	rbis: number;
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
	// Enhanced fields from play-by-play data
	substitution_inning?: number; // Actual inning from play-by-play
	substitution_half_inning?: 'top' | 'bottom'; // Actual half-inning from play-by-play
	substitution_description?: string; // Actual play-by-play description
	substitution_order?: number; // Chronological order in the game
	substitution_position?: string; // Position information from play-by-play
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
	// Substitution data for chronological ordering
	substitution_inning?: number;
	substitution_half_inning?: string;
	substitution_type?: string;
}

interface GameEvent {
	inning: number;
	half_inning: 'top' | 'bottom';
	event_type: string;
	description: string;
	batter: string;
	pitcher: string;
}

const TraditionalScorecard = memo(function TraditionalScorecard({
	gameData,
	gameId,
	gamePk,
	isLiveGame = false,
	enableLiveUpdates = true,
	liveUpdateDelay = 0,
}: TraditionalScorecardProps) {
	// Console log gamePk on component load
	useEffect(() => {
		console.log('TraditionalScorecard loaded with gamePk:', gamePk);
	}, [gamePk]);

	const [detailedData, setDetailedData] = useState<DetailedGameData | null>(null);
	const [loading, setLoading] = useState(false);
	const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
	const [liveUpdateSummary, setLiveUpdateSummary] = useState<any>(null);

	// Pitch sequence data
	const [pitchSequences, setPitchSequences] = useState<Map<string, AtBatPitchSequence>>(new Map());

	// Live update state - use data from parent component instead of separate hook
	const [isLive, setIsLive] = useState(false);
	const [isLiveLoading, setIsLiveLoading] = useState(false);
	const [liveError, setLiveError] = useState<string | null>(null);

	// Update detailed data when gameData changes (from parent live updates)
	useEffect(() => {
		if (gameData && gameData.game_data) {
			// Use incremental updates instead of complete replacement
			setDetailedData((prevData) => {
				// If this is the first load or we don't have play-by-play data, do a complete update
				if (!prevData || !gameData.game_data?.play_by_play) {
					const transformedData: DetailedGameData = {
						game_id: gameData.game_id,
						date: gameData.game_data.game_date_str,
						away_team: gameData.game_data.away_team,
						home_team: gameData.game_data.home_team,
						venue: gameData.game_data.location,
						status: gameData.game_data.status || 'Unknown',
						innings: gameData.game_data.inning_list || [],
						batters: {
							away: gameData.game_data.player_stats?.away?.batters || [],
							home: gameData.game_data.player_stats?.home?.batters || [],
						},
						pitchers: {
							away: (gameData.game_data.player_stats?.away?.pitchers || []).map((pitcher: any) => ({
								...pitcher,
								position: pitcher.position || 'P',
							})),
							home: (gameData.game_data.player_stats?.home?.pitchers || []).map((pitcher: any) => ({
								...pitcher,
								position: pitcher.position || 'P',
							})),
						},
						events: [],
						total_away_runs: gameData.game_data.total_away_runs,
						total_home_runs: gameData.game_data.total_home_runs,
						umpires: gameData.game_data.umpires,
						managers: gameData.game_data.managers,
						start_time: gameData.game_data.start_time || undefined,
						end_time: gameData.game_data.end_time || undefined,
						weather: gameData.game_data.weather || undefined,
						wind: gameData.game_data.wind || undefined,
						uniforms: gameData.game_data.uniforms
							? {
									away: gameData.game_data.uniforms.away || '',
									home: gameData.game_data.uniforms.home || '',
							  }
							: undefined,
						liveData: gameData.liveData,
						play_by_play: gameData.game_data.play_by_play,
						game_feed_substitutions: gameData.game_data.game_feed_substitutions,
						game_data: gameData.game_data, // Keep reference to original data for compatibility
					};
					return transformedData;
				}

				// For live updates, only update specific fields that should change
				// Preserve team information - use actual team data or keep existing
				const awayTeam = gameData.game_data.away_team || prevData.away_team;
				const homeTeam = gameData.game_data.home_team || prevData.home_team;

				// CRITICAL: Preserve play_by_play data - never let it be undefined during live updates
				const preservedPlayByPlay = gameData.game_data.play_by_play || prevData.play_by_play;

				// CRITICAL: Preserve game_feed_substitutions data for live updates
				// Only use new substitution data if it has content and descriptions
				const newSubstitutions = gameData.game_data.game_feed_substitutions;
				const prevSubstitutions = prevData.game_feed_substitutions;

				// Check if new substitutions have actual descriptions (not just empty objects)
				const newHasDescriptions =
					newSubstitutions &&
					newSubstitutions.length > 0 &&
					newSubstitutions.some((sub: any) => sub.description || sub.substitution_description);
				const prevHasDescriptions =
					prevSubstitutions &&
					prevSubstitutions.length > 0 &&
					prevSubstitutions.some((sub: any) => sub.description || sub.substitution_description);

				// Always prefer data with descriptions, otherwise keep previous data
				const preservedSubstitutions = newHasDescriptions
					? newSubstitutions
					: prevHasDescriptions
					? prevSubstitutions
					: newSubstitutions;

				return {
					...prevData, // Keep all existing data
					// Preserve team information
					away_team: awayTeam,
					home_team: homeTeam,
					// Only update live-changing parts
					status: gameData.game_data.status || prevData.status,
					total_away_runs: gameData.game_data.total_away_runs ?? prevData.total_away_runs,
					total_home_runs: gameData.game_data.total_home_runs ?? prevData.total_home_runs,
					innings: gameData.game_data.inning_list || prevData.innings,
					liveData: gameData.liveData || prevData.liveData,
					// Update player stats if available, but preserve substitution data
					batters: gameData.game_data?.player_stats
						? {
								away: gameData.game_data.player_stats.away?.batters
									? (() => {
											// Only reprocess if we don't have substitution data to preserve
											const prevAwayBatters = prevData.batters.away;
											const hasSubstitutionData =
												prevAwayBatters &&
												prevAwayBatters.some(
													(b: any) => b.substitution_description || (b.substitutions && b.substitutions.length > 0)
												);

											if (hasSubstitutionData) {
												// Preserve existing batter data with substitution info, just update stats
												return prevAwayBatters.map((prevBatter: any) => {
													const newBatter = gameData.game_data.player_stats?.away?.batters?.find(
														(b: any) => b.name === prevBatter.name || b.person?.fullName === prevBatter.name
													);
													return newBatter ? { ...prevBatter, ...newBatter, isAway: true } : prevBatter;
												});
											} else {
												// No substitution data to preserve, process normally
												return processBatterData(
													gameData.game_data.player_stats.away.batters,
													gameData.game_data.player_stats.away?.pitchers || [],
													true,
													gameData.game_data.player_stats.away.batters,
													gameData.game_data
												);
											}
									  })()
									: prevData.batters.away,
								home: gameData.game_data.player_stats.home?.batters
									? (() => {
											// Only reprocess if we don't have substitution data to preserve
											const prevHomeBatters = prevData.batters.home;
											const hasSubstitutionData =
												prevHomeBatters &&
												prevHomeBatters.some(
													(b: any) => b.substitution_description || (b.substitutions && b.substitutions.length > 0)
												);

											if (hasSubstitutionData) {
												// Preserve existing batter data with substitution info, just update stats
												return prevHomeBatters.map((prevBatter: any) => {
													const newBatter = gameData.game_data.player_stats?.home?.batters?.find(
														(b: any) => b.name === prevBatter.name || b.person?.fullName === prevBatter.name
													);
													return newBatter ? { ...prevBatter, ...newBatter, isAway: false } : prevBatter;
												});
											} else {
												// No substitution data to preserve, process normally
												return processBatterData(
													gameData.game_data.player_stats.home.batters,
													gameData.game_data.player_stats.home?.pitchers || [],
													false,
													gameData.game_data.player_stats.home.batters,
													gameData.game_data
												);
											}
									  })()
									: prevData.batters.home,
						  }
						: prevData.batters,
					pitchers: gameData.game_data?.player_stats
						? {
								away: (gameData.game_data.player_stats.away?.pitchers || prevData.pitchers.away).map(
									(pitcher: any) => ({
										...pitcher,
										position: pitcher.position || 'P',
									})
								),
								home: (gameData.game_data.player_stats.home?.pitchers || prevData.pitchers.home).map(
									(pitcher: any) => ({
										...pitcher,
										position: pitcher.position || 'P',
									})
								),
						  }
						: prevData.pitchers,
					// CRITICAL: Always preserve play_by_play data
					play_by_play: preservedPlayByPlay,
					// CRITICAL: Always preserve game_feed_substitutions data
					game_feed_substitutions: preservedSubstitutions,
					// Update game_data reference with new substitution data
					game_data: {
						...prevData.game_data,
						play_by_play: preservedPlayByPlay,
						game_feed_substitutions: preservedSubstitutions,
					},
				};
			});
		}
	}, [gameData]);

	// Update live status based on game data
	useEffect(() => {
		if (gameData && gameData.game_data) {
			const gameStatus = gameData.game_data.status;
			const isGameLive = gameStatus === 'In Progress' || gameStatus === 'Live';
			setIsLive(isGameLive && isLiveGame && enableLiveUpdates);
		}
	}, [gameData, isLiveGame, enableLiveUpdates]);

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

	// Process pitch sequences when game data changes
	useEffect(() => {
		if (gameData) {
			const sequences = getAllPitchSequences(gameData);
			setPitchSequences(sequences);
		}
	}, [gameData]);

	const fetchDetailedData = useCallback(async () => {
		setLoading(true);
		try {
			// Fetch detailed game data from the API route (avoids CORS issues)
			const response = await baseballApi.getGameDetails(gameId);

			// Check if the API call was successful
			if (!(response as any).success) {
				throw new Error((response as any).error || 'Failed to load game data');
			}

			const detailedGameData = response;

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
				batters: (() => {
					// Reset footnote counter once for the entire data processing
					resetFootnoteCounter();

					return {
						away: processBatterData(
							detailedGameData.game_data.player_stats?.away?.batters || [],
							detailedGameData.game_data.player_stats?.away?.pitchers || [],
							true,
							detailedGameData.game_data.player_stats?.away?.batters || [],
							detailedGameData
						),
						home: (() => {
							const homeBatters = detailedGameData.game_data.player_stats?.home?.batters || [];

							return processBatterData(
								homeBatters,
								detailedGameData.game_data.player_stats?.home?.pitchers || [],
								false,
								detailedGameData.game_data.player_stats?.home?.batters || [],
								detailedGameData
							);
						})(),
					};
				})(),
				pitchers: (() => {
					// Debug: Log the actual pitcher data we're receiving
					if (detailedGameData.game_data.player_stats?.away?.pitchers) {
						// Log the first pitcher object in detail
						if (detailedGameData.game_data.player_stats.away.pitchers.length > 0) {
						}
					}

					if (detailedGameData.game_data.player_stats?.home?.pitchers) {
						// Log the first pitcher object in detail
						if (detailedGameData.game_data.player_stats.home.pitchers.length > 0) {
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
										number: pitcher.number ? String(pitcher.number) : '0',
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
										number: pitcher.number ? String(pitcher.number) : '0',
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
				end_time: gameData.game_data.end_time || undefined,
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
				play_by_play: detailedGameData.game_data.play_by_play || undefined,
				// Include the liveData from the game feed for base running tracking
				liveData: (detailedGameData as any).liveData,
			};

			setDetailedData(transformedData);
		} catch (error) {
			console.error('Error loading detailed game data:', error);
			// You might want to set an error state here or show a user-friendly message
		} finally {
			setLoading(false);
		}
	}, [gameData]);

	// Helper function to sort pitchers by their chronological appearance order
	const sortPitchersByAppearance = useCallback(
		(pitchers: PitcherData[], detailedData: DetailedGameData | null, isAway: boolean): PitcherData[] => {
			if (!detailedData) {
				return pitchers; // Return unsorted if no detailed data
			}

			// API already provides pitchers in correct chronological order
			return [...pitchers];
		},
		[detailedData]
	);

	const renderPitcherTable = useCallback(
		(pitchers: PitcherData[], teamName: string) => {
			// Sort pitchers by appearance order
			const sortedPitchers = sortPitchersByAppearance(
				pitchers,
				detailedData,
				teamName === detailedData?.away_team?.name
			);

			// Always show minimum 4 rows, but show as many as needed for actual pitchers
			const minRows = 4;
			const displayPitchers = [...sortedPitchers];
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
							<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
								#
							</div>
							<div className="flex justify-center items-center h-8 text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
								PITCHERS
							</div>
							<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-300 dark:border-primary-800 text-primary-900 dark:text-primary-100">
								R/L
							</div>
							<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
								IP
							</div>
							<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
								P(S)
							</div>
							<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
								BF
							</div>
							<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
								H
							</div>
							<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
								R
							</div>
							<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
								ER
							</div>
							<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
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
								<div className="flex justify-between items-center px-2 h-8 border-r border-primary-400 dark:border-primary-600 bg-primary-50 dark:bg-primary-800">
									<span className="flex-1 min-w-0 font-medium truncate text-2xs text-primary-900 dark:text-primary-100">
										{pitcher.name || ''}
									</span>
									{pitcher.name && (
										<span className="flex-shrink-0 ml-2 font-normal text-[8px] text-primary-600 dark:text-primary-400">
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
								{(() => {
									// Convert baseball decimal format to actual fractions for accurate summing
									let totalThirds = 0;

									displayPitchers.forEach((pitcher) => {
										const innings = pitcher.innings_pitched || 0;
										const wholeInnings = Math.floor(innings);
										const decimalPart = innings - wholeInnings;

										// Convert to thirds of an inning
										totalThirds += wholeInnings * 3; // Convert whole innings to thirds

										if (Math.abs(decimalPart - 0.1) < 0.001) {
											totalThirds += 1; // .1 = 1/3 = 1 third
										} else if (Math.abs(decimalPart - 0.2) < 0.001) {
											totalThirds += 2; // .2 = 2/3 = 2 thirds
										} else if (decimalPart > 0) {
											// Handle any other decimal values by converting to thirds
											totalThirds += Math.round(decimalPart * 3);
										}
									});

									// Convert back to baseball decimal format
									const wholeInnings = Math.floor(totalThirds / 3);
									const remainingThirds = totalThirds % 3;

									let baseballDecimal = 0;
									if (remainingThirds === 1) {
										baseballDecimal = 0.1; // 1 third = .1
									} else if (remainingThirds === 2) {
										baseballDecimal = 0.2; // 2 thirds = .2
									}

									return (wholeInnings + baseballDecimal).toFixed(1);
								})()}
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
		},
		[detailedData, sortPitchersByAppearance]
	);

	const renderScorecardGrid = useCallback(() => {
		if (!detailedData) {
			return null;
		}

		// Only show extra innings if there's actual data for them
		const inningsWithData = detailedData.innings.map((i) => i.inning);
		const maxInnings = inningsWithData.length > 0 ? Math.max(...inningsWithData) : 9;
		const displayInnings = Math.max(9, maxInnings); // Always show at least 9 innings

		return (
			<div className="overflow-x-auto min-w-[1400px]">
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
						<div className="flex relative row-span-2 justify-center items-center border-r border-primary-400 dark:border-primary-600">
							<div className="flex justify-center items-center w-16 h-16">
								{getTeamLogo(detailedData?.away_team?.abbreviation || '')}
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									LOGO
								</span>
							</div>
						</div>

						{/* Top Row Fields */}
						<div className="relative col-span-2 border-r border-primary-400 dark:border-primary-600">
							<div className="flex items-center px-2 h-8 border-b border-primary-200 dark:border-primary-700">
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									AWAY TEAM
								</span>
								<span className="font-medium text-primary-900 dark:text-primary-100">
									{detailedData.away_team.name}
								</span>
							</div>
						</div>
						<div className="relative border-r border-primary-400 dark:border-primary-600">
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
						<div className="relative border-r border-primary-400 dark:border-primary-600">
							<div className="flex items-center px-2 h-8">
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									MANAGER
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">
									{detailedData?.managers?.away || 'TBD'}
								</span>
							</div>
						</div>
						<div className="relative border-r border-primary-400 dark:border-primary-600">
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
						<div className="relative border-r border-primary-400 dark:border-primary-600">
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
					{(() => {
						const { inningColumns } = getInningColumnStructure(detailedData.batters.away, displayInnings, detailedData);
						const inningColumnTemplate = inningColumns.map((cols) => Array(cols).fill('1fr').join(' ')).join(' ');

						return (
							<div
								className="grid gap-0 border-b border-primary-300 dark:border-primary-800"
								style={{
									gridTemplateColumns: `40px 200px 30px ${inningColumnTemplate} 45px 45px 45px 45px 45px 45px`,
								}}>
								<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
									#
								</div>
								<div className="flex justify-center items-center h-8 text-xs font-bold border-r border-primary-200 dark:border-primary-800 text-primary-900 dark:text-primary-100">
									BATTERS
								</div>
								<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-300 dark:border-primary-700 text-primary-900 dark:text-primary-100">
									POS
								</div>
								{inningColumns
									.map((columnCount, inningIndex) => {
										const inningNumber = inningIndex + 1;
										const isLastInning = inningIndex === inningColumns.length - 1;

										return Array.from({ length: columnCount }, (_, columnIndex) => {
											const isSecondColumn = columnIndex === 1;
											const isLastColumnOfInning = columnIndex === columnCount - 1;

											return (
												<div
													key={`${inningNumber}-${columnIndex}`}
													className={`flex justify-center items-center h-8 text-xs font-bold text-primary-900 dark:text-primary-100 ${
														isLastColumnOfInning && isLastInning
															? 'border-primary-200 dark:border-primary-700'
															: 'border-r border-primary-400 dark:border-primary-600'
													}`}>
													{isSecondColumn ? `${inningNumber}b` : inningNumber}
												</div>
											);
										});
									})
									.flat()}
								<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-l border-l-primary-400 dark:border-l-primary-600 border-r-primary-400 dark:border-r-primary-600 text-primary-900 dark:text-primary-100">
									AB
								</div>
								<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
									H
								</div>
								<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
									R
								</div>
								<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
									RBI
								</div>
								<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
									BB
								</div>
								<div className="flex justify-center items-center h-8 font-mono text-xs font-bold text-primary-900 dark:text-primary-100">
									SO
								</div>
							</div>
						);
					})()}

					{/* Away Team Batters */}
					{(() => {
						const { inningColumns } = getInningColumnStructure(detailedData.batters.away, displayInnings, detailedData);
						return detailedData.batters.away.map((batter, index) => (
							<BatterRow
								key={index}
								batter={batter}
								index={index}
								displayInnings={displayInnings}
								isAway={true}
								isLastRow={index === detailedData.batters.away.length - 1}
								detailedData={detailedData}
								inningColumns={inningColumns}
								pitchSequences={pitchSequences}
							/>
						));
					})()}

					{/* Away Team Batters Summary Row */}
					{(() => {
						const { inningColumns } = getInningColumnStructure(detailedData.batters.away, displayInnings, detailedData);
						const inningColumnTemplate = inningColumns.map((cols) => Array(cols).fill('1fr').join(' ')).join(' ');

						return (
							<div
								className="grid gap-0 border-t border-primary-300 dark:border-primary-800"
								style={{
									gridTemplateColumns: `40px 200px 30px ${inningColumnTemplate} 45px 45px 45px 45px 45px 45px`,
								}}>
								{/* Combined first three columns */}
								<div className="flex col-span-3 justify-end items-center h-10 font-normal border-r text-primary-900 dark:text-primary-100 border-primary-300 dark:border-primary-800 bg-primary-50 dark:bg-primary-800">
									<div className="grid grid-cols-2 col-span-3 grid-rows-2 w-24 h-full">
										<div className="flex justify-center items-center border-r border-b text-2xs border-primary-200">
											R
										</div>
										<div className="flex justify-center items-center border-b text-2xs border-primary-200">H</div>
										<div className="flex justify-center items-center border-r text-2xs border-primary-200">LOB</div>
										<div className="flex justify-center items-center text-2xs">E</div>
									</div>
								</div>

								{/* Inning columns with R/H/LOB/E totals */}
								{inningColumns
									.map((columnCount, inningIndex) => {
										const inningNumber = inningIndex + 1;
										const isLastInning = inningIndex === inningColumns.length - 1;

										// Only show stats in the first column of each inning (not in Xb columns)
										return Array.from({ length: columnCount }, (_, columnIndex) => {
											const isFirstColumn = columnIndex === 0;
											const isLastColumnOfInning = columnIndex === columnCount - 1;

											// Get real inning data from MLB API
											const inningData = getInningData(detailedData, inningNumber, true); // true for away team

											const inningRuns = inningData.runs;
											const inningHits = inningData.hits;
											const inningLOB = inningData.leftOnBase;
											const inningErrors = inningData.errors;

											return (
												<div
													key={`${inningNumber}-${columnIndex}`}
													className={`h-10 font-mono font-normal text-2xs text-primary-900 dark:text-primary-100 ${
														isLastColumnOfInning && isLastInning
															? 'border-primary-200 dark:border-primary-700'
															: 'border-r border-primary-400 dark:border-primary-600'
													} ${isFirstColumn ? 'grid grid-cols-2 grid-rows-2 ' : ''}`}>
													{isFirstColumn ? (
														<>
															<div className="flex justify-center items-center border-r border-b text-2xs border-primary-200">
																{inningRuns === 0 ? '-' : inningRuns}
															</div>
															<div className="flex justify-center items-center border-b text-2xs border-primary-200">
																{inningHits === 0 ? '-' : inningHits}
															</div>
															<div className="flex justify-center items-center border-r text-2xs border-primary-200">
																{inningLOB === 0 ? '-' : inningLOB}
															</div>
															<div className="flex justify-center items-center text-2xs">
																{inningErrors === 0 ? '-' : inningErrors}
															</div>
														</>
													) : (
														''
													)}
												</div>
											);
										});
									})
									.flat()}
								{/* AB Total */}
								<div className="flex justify-center items-center h-10 font-mono font-bold border-r border-l text-2xs text-primary-900 dark:text-primary-100 border-l-primary-400 dark:border-l-primary-600 border-r-primary-400 dark:border-r-primary-600">
									{detailedData.batters.away.reduce((sum, batter) => sum + (batter.at_bats || 0), 0)}
								</div>

								{/* H Total */}
								<div className="flex justify-center items-center h-10 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-400 dark:border-primary-600">
									{(() => {
										const inningStats = extractInningStats(detailedData);
										return inningStats
											? inningStats.totals.away.hits
											: detailedData.batters.away.reduce((sum, batter) => sum + (batter.hits || 0), 0);
									})()}
								</div>

								{/* R Total */}
								<div className="flex justify-center items-center h-10 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-400 dark:border-primary-600">
									{(() => {
										const inningStats = extractInningStats(detailedData);
										return inningStats
											? inningStats.totals.away.runs
											: detailedData.batters.away.reduce((sum, batter) => sum + (batter.runs || 0), 0);
									})()}
								</div>

								{/* RBI Total */}
								<div className="flex justify-center items-center h-10 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-400 dark:border-primary-600">
									{detailedData.batters.away.reduce((sum, batter) => sum + (batter.rbi || 0), 0)}
								</div>

								{/* BB Total */}
								<div className="flex justify-center items-center h-10 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-400 dark:border-primary-600">
									{detailedData.batters.away.reduce((sum, batter) => sum + (batter.walks || 0), 0)}
								</div>

								{/* SO Total */}
								<div className="flex justify-center items-center h-10 font-mono font-bold text-2xs text-primary-900 dark:text-primary-100">
									{detailedData.batters.away.reduce((sum, batter) => sum + (batter.strikeouts || 0), 0)}
								</div>
							</div>
						);
					})()}
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
						<div className="flex relative row-span-2 justify-center items-center border-r border-primary-400 dark:border-primary-600">
							<div className="flex justify-center items-center w-16 h-16">
								{getTeamLogo(detailedData?.home_team?.abbreviation || '')}
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									LOGO
								</span>
							</div>
						</div>

						{/* Top Row Fields */}
						<div className="relative col-span-2 border-r border-primary-400 dark:border-primary-600">
							<div className="flex items-center px-2 h-8 border-b border-primary-200 dark:border-primary-700">
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									HOME TEAM
								</span>
								<span className="font-medium text-primary-900 dark:text-primary-100">
									{detailedData.home_team.name}
								</span>
							</div>
						</div>
						<div className="relative border-r border-primary-400 dark:border-primary-600">
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
						<div className="relative border-r border-primary-400 dark:border-primary-600">
							<div className="flex items-center px-2 h-8">
								<span className="absolute top-1 right-1 uppercase text-2xs text-primary-500 dark:text-primary-400">
									MANAGER
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">
									{detailedData?.managers?.home || 'TBD'}
								</span>
							</div>
						</div>
						<div className="relative border-r border-primary-400 dark:border-primary-600">
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
						<div className="relative border-r border-primary-400 dark:border-primary-600">
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
					{(() => {
						const { inningColumns } = getInningColumnStructure(detailedData.batters.home, displayInnings, detailedData);
						const inningColumnTemplate = inningColumns.map((cols) => Array(cols).fill('1fr').join(' ')).join(' ');

						return (
							<div
								className="grid gap-0 border-b border-primary-300 dark:border-primary-800"
								style={{
									gridTemplateColumns: `40px 200px 30px ${inningColumnTemplate} 45px 45px 45px 45px 45px 45px`,
								}}>
								<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
									#
								</div>
								<div className="flex justify-center items-center h-8 text-xs font-bold border-r border-primary-200 dark:border-primary-800 text-primary-900 dark:text-primary-100">
									BATTERS
								</div>
								<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-300 dark:border-primary-700 text-primary-900 dark:text-primary-100">
									POS
								</div>
								{inningColumns
									.map((columnCount, inningIndex) => {
										const inningNumber = inningIndex + 1;
										const isLastInning = inningIndex === inningColumns.length - 1;

										return Array.from({ length: columnCount }, (_, columnIndex) => {
											const isSecondColumn = columnIndex === 1;
											const isLastColumnOfInning = columnIndex === columnCount - 1;

											return (
												<div
													key={`${inningNumber}-${columnIndex}`}
													className={`flex justify-center items-center h-8 text-xs font-bold text-primary-900 dark:text-primary-100 ${
														isLastColumnOfInning && isLastInning
															? 'border-primary-200 dark:border-primary-700'
															: 'border-r border-primary-400 dark:border-primary-600'
													}`}>
													{isSecondColumn ? `${inningNumber}b` : inningNumber}
												</div>
											);
										});
									})
									.flat()}
								<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-l border-l-primary-400 dark:border-l-primary-600 border-r-primary-400 dark:border-r-primary-600 text-primary-900 dark:text-primary-100">
									AB
								</div>
								<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
									H
								</div>
								<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
									R
								</div>
								<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
									RBI
								</div>
								<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
									BB
								</div>
								<div className="flex justify-center items-center h-8 font-mono text-xs font-bold text-primary-900 dark:text-primary-100">
									SO
								</div>
							</div>
						);
					})()}

					{/* Home Team Batters */}
					{(() => {
						const { inningColumns } = getInningColumnStructure(detailedData.batters.home, displayInnings, detailedData);
						return detailedData.batters.home.map((batter, index) => (
							<BatterRow
								key={index}
								batter={batter}
								index={index}
								displayInnings={displayInnings}
								isAway={false}
								isLastRow={index === detailedData.batters.home.length - 1}
								detailedData={detailedData}
								inningColumns={inningColumns}
								pitchSequences={pitchSequences}
							/>
						));
					})()}

					{/* Home Team Batters Summary Row */}
					{(() => {
						const { inningColumns } = getInningColumnStructure(detailedData.batters.home, displayInnings, detailedData);
						const inningColumnTemplate = inningColumns.map((cols) => Array(cols).fill('1fr').join(' ')).join(' ');

						return (
							<div
								className="grid gap-0 border-t border-primary-300 dark:border-primary-800"
								style={{
									gridTemplateColumns: `40px 200px 30px ${inningColumnTemplate} 45px 45px 45px 45px 45px 45px`,
								}}>
								{/* Combined first three columns */}
								<div className="grid grid-cols-2 col-span-3 grid-rows-2 h-10 font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-300 dark:border-primary-800 bg-primary-50 dark:bg-primary-800">
									<div className="flex justify-center items-center text-xs border-r border-b border-primary-200">R</div>
									<div className="flex justify-center items-center text-xs border-b border-primary-200">H</div>
									<div className="flex justify-center items-center text-xs border-r border-primary-200">LOB</div>
									<div className="flex justify-center items-center text-xs">E</div>
								</div>

								{/* Inning columns with R/H/LOB/E totals */}
								{inningColumns
									.map((columnCount, inningIndex) => {
										const inningNumber = inningIndex + 1;
										const isLastInning = inningIndex === inningColumns.length - 1;

										// Only show stats in the first column of each inning (not in Xb columns)
										return Array.from({ length: columnCount }, (_, columnIndex) => {
											const isFirstColumn = columnIndex === 0;
											const isLastColumnOfInning = columnIndex === columnCount - 1;

											// Get real inning data from MLB API
											const inningData = getInningData(detailedData, inningNumber, false); // false for home team

											const inningRuns = inningData.runs;
											const inningHits = inningData.hits;
											const inningLOB = inningData.leftOnBase;
											const inningErrors = inningData.errors;

											return (
												<div
													key={`${inningNumber}-${columnIndex}`}
													className={`h-10 font-mono font-bold text-2xs text-primary-900 dark:text-primary-100 ${
														isLastColumnOfInning && isLastInning
															? 'border-primary-200 dark:border-primary-700'
															: 'border-r border-primary-400 dark:border-primary-600'
													} ${isFirstColumn ? 'grid grid-cols-2 grid-rows-2 ' : ''}`}>
													{isFirstColumn ? (
														<>
															<div className="flex justify-center items-center text-xs border-r border-b border-primary-200">
																{inningRuns}
															</div>
															<div className="flex justify-center items-center text-xs border-b border-primary-200">
																{inningHits}
															</div>
															<div className="flex justify-center items-center text-xs border-r border-primary-200">
																{inningLOB}
															</div>
															<div className="flex justify-center items-center text-xs">{inningErrors}</div>
														</>
													) : (
														''
													)}
												</div>
											);
										});
									})
									.flat()}
								{/* AB Total */}
								<div className="flex justify-center items-center h-10 font-mono font-bold border-r border-l text-2xs text-primary-900 dark:text-primary-100 border-l-primary-300 dark:border-l-primary-800 border-r-primary-400 dark:border-r-primary-700">
									{detailedData.batters.home.reduce((sum, batter) => sum + (batter.at_bats || 0), 0)}
								</div>

								{/* H Total */}
								<div className="flex justify-center items-center h-10 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-400 dark:border-primary-600">
									{(() => {
										const inningStats = extractInningStats(detailedData);
										return inningStats
											? inningStats.totals.home.hits
											: detailedData.batters.home.reduce((sum, batter) => sum + (batter.hits || 0), 0);
									})()}
								</div>

								{/* R Total */}
								<div className="flex justify-center items-center h-10 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-400 dark:border-primary-600">
									{(() => {
										const inningStats = extractInningStats(detailedData);
										return inningStats
											? inningStats.totals.home.runs
											: detailedData.batters.home.reduce((sum, batter) => sum + (batter.runs || 0), 0);
									})()}
								</div>

								{/* RBI Total */}
								<div className="flex justify-center items-center h-10 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-400 dark:border-primary-600">
									{detailedData.batters.home.reduce((sum, batter) => sum + (batter.rbi || 0), 0)}
								</div>

								{/* BB Total */}
								<div className="flex justify-center items-center h-10 font-mono font-bold border-r text-2xs text-primary-900 dark:text-primary-100 border-primary-400 dark:border-primary-600">
									{detailedData.batters.home.reduce((sum, batter) => sum + (batter.walks || 0), 0)}
								</div>

								{/* SO Total */}
								<div className="flex justify-center items-center h-10 font-mono font-bold text-2xs text-primary-900 dark:text-primary-100">
									{detailedData.batters.home.reduce((sum, batter) => sum + (batter.strikeouts || 0), 0)}
								</div>
							</div>
						);
					})()}
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
		if (!detailedData) {
			return null;
		}

		// Collect footnotes from away team with chronological order
		const awayFootnotes: Array<{ footnote: string; order: number }> = [];

		detailedData.batters.away.forEach((batter) => {
			batter.substitutions?.forEach((sub) => {
				if (sub.footnote) {
					// Check if this footnote is already collected (avoid duplicates)
					const existingIndex = awayFootnotes.findIndex((f) => f.footnote === sub.footnote);
					if (existingIndex === -1) {
						// Calculate chronological order based on inning and half-inning
						const inning = sub.substitution_inning || sub.inning || 9;
						const halfInningOrder = sub.substitution_half_inning === 'top' ? 0 : 1;
						const chronologicalOrder = inning * 2 + halfInningOrder;

						awayFootnotes.push({
							footnote: sub.footnote,
							order: chronologicalOrder,
						});
					}
				}
			});
		});

		// Sort by chronological order
		awayFootnotes.sort((a, b) => a.order - b.order);

		if (awayFootnotes.length === 0) return null;

		return (
			<div className="mt-2 mb-6 w-full">
				<h3 className="px-2 mb-2 uppercase border-b border-primary-200 dark:border-primary-700 text-2xs text-primary-500 dark:text-primary-400">
					AWAY TEAM NOTES
				</h3>
				<div className="min-h-[60px] text-xs text-primary-700 dark:text-primary-300 leading-relaxed">
					{awayFootnotes.map((footnoteData, index) => (
						<div key={index} className="px-2 pb-1 mb-1 border-b border-primary-200 dark:border-primary-700">
							<span className="font-mono text-primary-600 dark:text-primary-400">{index + 1}.</span>
							{footnoteData.footnote}
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

		// Collect footnotes from home team with chronological order
		const homeFootnotes: Array<{ footnote: string; order: number }> = [];

		detailedData.batters.home.forEach((batter) => {
			batter.substitutions?.forEach((sub) => {
				if (sub.footnote) {
					// Check if this footnote is already collected (avoid duplicates)
					const existingIndex = homeFootnotes.findIndex((f) => f.footnote === sub.footnote);
					if (existingIndex === -1) {
						// Calculate chronological order based on inning and half-inning
						const inning = sub.substitution_inning || sub.inning || 9;
						const halfInningOrder = sub.substitution_half_inning === 'top' ? 0 : 1;
						const chronologicalOrder = inning * 2 + halfInningOrder;

						homeFootnotes.push({
							footnote: sub.footnote,
							order: chronologicalOrder,
						});
					}
				}
			});
		});

		// Sort by chronological order
		homeFootnotes.sort((a, b) => a.order - b.order);

		if (homeFootnotes.length === 0) return null;

		return (
			<div className="mt-4 w-full">
				<h3 className="px-2 mb-2 uppercase border-b border-primary-200 dark:border-primary-700 text-2xs text-primary-500 dark:text-primary-400">
					HOME TEAM NOTES
				</h3>
				<div className="min-h-[60px] text-xs text-primary-700 dark:text-primary-300 leading-relaxed">
					{homeFootnotes.map((footnoteData, index) => (
						<div key={index} className="px-2 pb-1 mb-1 border-b border-primary-200 dark:border-primary-700">
							<span className="font-mono text-primary-600 dark:text-primary-400">{index + 1}.</span>
							{footnoteData.footnote}
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
