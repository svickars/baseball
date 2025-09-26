'use client';

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Game } from '@/types';
import { formatDate, formatTime, getStatusColor, getGameStatusFromMLB } from '@/lib/utils';
import { Clock, MapPin, Trophy } from 'lucide-react';
import Link from 'next/link';
import * as TeamLogos from './team-logos';
import LoadingSpinner from './LoadingSpinner';
// import { useProgressiveGameData } from '@/hooks/useProgressiveGameData';
// import ProgressiveLoadingIndicator, { InningDataSkeleton, TeamStatsSkeleton } from './ProgressiveLoadingIndicator';

interface GamesListProps {
	games: Game[];
	selectedDate: string;
	onGameSelect: (gameId: string) => void;
}

interface GameWithDetails extends Game {
	detailedData?: {
		innings: Array<{ inning: number; away_runs: number; home_runs: number }>;
		away_hits: number;
		home_hits: number;
		away_errors: number;
		home_errors: number;
	};
}

// Helper function to get team logo component
const getTeamLogo = (teamCode: string) => {
	const LogoComponent = (TeamLogos as any)[teamCode];
	return LogoComponent ? <LogoComponent size={32} /> : null;
};

// Helper function to get team name without city
const getTeamName = (fullTeamName: string) => {
	// Remove city names and return just the team name
	const teamNameMap: { [key: string]: string } = {
		'Arizona Diamondbacks': 'Diamondbacks',
		'Atlanta Braves': 'Braves',
		'Baltimore Orioles': 'Orioles',
		'Boston Red Sox': 'Red Sox',
		'Chicago Cubs': 'Cubs',
		'Chicago White Sox': 'White Sox',
		'Cincinnati Reds': 'Reds',
		'Cleveland Guardians': 'Guardians',
		'Colorado Rockies': 'Rockies',
		'Detroit Tigers': 'Tigers',
		'Houston Astros': 'Astros',
		'Kansas City Royals': 'Royals',
		'Los Angeles Angels': 'Angels',
		'Los Angeles Dodgers': 'Dodgers',
		'Miami Marlins': 'Marlins',
		'Milwaukee Brewers': 'Brewers',
		'Minnesota Twins': 'Twins',
		'New York Mets': 'Mets',
		'New York Yankees': 'Yankees',
		'Oakland Athletics': 'Athletics',
		Athletics: 'Athletics',
		'Philadelphia Phillies': 'Phillies',
		'Pittsburgh Pirates': 'Pirates',
		'San Diego Padres': 'Padres',
		'San Francisco Giants': 'Giants',
		'Seattle Mariners': 'Mariners',
		'St. Louis Cardinals': 'Cardinals',
		'Tampa Bay Rays': 'Rays',
		'Texas Rangers': 'Rangers',
		'Toronto Blue Jays': 'Blue Jays',
		'Washington Nationals': 'Nationals',
	};

	return teamNameMap[fullTeamName] || fullTeamName;
};

// Helper function to format game time
const formatGameTime = (startTime: string) => {
	try {
		// If startTime is already a formatted time string (like "4:07 PM"), return it as-is
		if (startTime.includes('AM') || startTime.includes('PM') || startTime.includes(':')) {
			return startTime;
		}

		// If it's an ISO date string, parse and format it
		const date = new Date(startTime);
		return date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true,
		});
	} catch (error) {
		return startTime;
	}
};

// Helper function to enhance stadium location with city
const formatStadiumLocation = (location: string) => {
	// Stadium to city mapping
	const stadiumCityMap: { [key: string]: string } = {
		'American Family Field': 'Milwaukee, WI',
		'Angel Stadium': 'Anaheim, CA',
		'Arizona Financial Theatre': 'Phoenix, AZ',
		'Busch Stadium': 'St. Louis, MO',
		'Camden Yards': 'Baltimore, MD',
		'Chase Field': 'Phoenix, AZ',
		'Citi Field': 'Flushing, NY',
		'Citizens Bank Park': 'Philadelphia, PA',
		'Comerica Park': 'Detroit, MI',
		'Coors Field': 'Denver, CO',
		'Dodger Stadium': 'Los Angeles, CA',
		'Fenway Park': 'Boston, MA',
		'Globe Life Field': 'Arlington, TX',
		'Great American Ball Park': 'Cincinnati, OH',
		'Guaranteed Rate Field': 'Chicago, IL',
		'Kauffman Stadium': 'Kansas City, MO',
		'LoanDepot Park': 'Miami, FL',
		'Minute Maid Park': 'Houston, TX',
		'Daikin Park': 'Houston, TX',
		'George M. Steinbrenner Field': 'Tampa, FL',
		'Rate Field': 'Chicago, IL',
		'Sutter Health Park': 'Sacramento, CA',
		'Nationals Park': 'Washington, DC',
		'Oakland Coliseum': 'Oakland, CA',
		'Oracle Park': 'San Francisco, CA',
		'Petco Park': 'San Diego, CA',
		'PNC Park': 'Pittsburgh, PA',
		'Progressive Field': 'Cleveland, OH',
		'Rogers Centre': 'Toronto, ON',
		'SafeCo Field': 'Seattle, WA',
		'T-Mobile Park': 'Seattle, WA',
		'Target Field': 'Minneapolis, MN',
		'Tropicana Field': 'St. Petersburg, FL',
		'Truist Park': 'Atlanta, GA',
		'Wrigley Field': 'Chicago, IL',
		'Yankee Stadium': 'Bronx, NY',
	};

	// Extract stadium name (remove trailing comma and space)
	const stadiumName = location.replace(/,\s*$/, '');

	// Get city info from mapping
	const cityInfo = stadiumCityMap[stadiumName];

	if (cityInfo) {
		return `${stadiumName}, ${cityInfo}`;
	}

	// Fallback to original location if no mapping found
	return location;
};

// Helper function to get detailed game data from the game object
const getDetailedGameData = (game: Game) => {
	// The game object should already have all the necessary data
	// For progressive loading, the data is directly on the game object
	return {
		innings: game.innings || [],
		away_hits: game.away_hits || 0,
		home_hits: game.home_hits || 0,
		away_errors: game.away_errors || 0,
		home_errors: game.home_errors || 0,
	};
};

// Helper function to render inning score with loading state
const renderInningScore = (inning: number, game: GameWithDetails, isAway: boolean, loadingState: string) => {
	const { score, className } = getInningScoreWithStyle(inning, game, isAway);

	if (loadingState === 'loading-details') {
		return <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />;
	}

	return (
		<div
			className={`bg-primary-50 font-mono dark:bg-primary-900 border-r border-primary-200 dark:border-primary-700 h-6 flex items-center justify-center ${getInningClass(
				inning,
				game
			)} ${className}`}>
			{score}
		</div>
	);
};

// Helper function to render team stats with loading state
const renderTeamStats = (game: GameWithDetails, isAway: boolean, loadingState: string) => {
	// Use the data directly from the game object (progressive loader updates this)
	const hits = isAway ? game.away_hits || 0 : game.home_hits || 0;
	const errors = isAway ? game.away_errors || 0 : game.home_errors || 0;

	if (loadingState === 'loading-details') {
		return (
			<>
				<div className="w-8 h-6 bg-gray-200 rounded animate-pulse" />
				<div className="w-8 h-6 bg-gray-200 rounded animate-pulse" />
			</>
		);
	}

	return (
		<>
			<div className="flex justify-center items-center h-6 font-mono border-r bg-primary-50 dark:bg-primary-900 border-primary-200 dark:border-primary-600">
				{hits}
			</div>
			<div className="flex justify-center items-center h-6 font-mono bg-primary-50 dark:bg-primary-900">{errors}</div>
		</>
	);
};

// Helper function to get inning score display
const getInningScore = (inning: number, game: GameWithDetails, isAway: boolean) => {
	// Use the innings data directly from the game object
	const innings = game.innings || [];

	// Get game status using MLB API status system
	const gameStatus = game.mlbStatus ? getGameStatusFromMLB(game.mlbStatus) : null;
	const isUpcoming = gameStatus?.status === 'upcoming' || game.status === 'Scheduled' || game.status === 'Pre-Game';
	const isLive =
		gameStatus?.status === 'live' || game.status === 'In Progress' || game.status === 'Live' || game.is_live;
	const isFinal = gameStatus?.status === 'final' || game.status === 'Final';

	// Handle upcoming games - show nothing for any inning
	if (isUpcoming) {
		return '';
	}

	// Handle live games - only show data for completed half-innings
	if (isLive) {
		if (innings && innings.length > 0) {
			const inningData = innings.find((i) => i.inning === inning);

			if (!inningData) {
				// No data for this inning - it hasn't been played yet
				return '';
			}

			// For live games, we need to check if the half-inning has actually been completed
			// We can't rely on the API data alone since it shows 0 for unplayed half-innings
			// We need to check the current inning and half-inning status
			const currentInning = parseInt(game.inning || '1');
			const isTopHalf = game.inning_state === 'Top' || game.inning_state === 'top';

			// If we're looking at a future inning, show nothing
			if (inning > currentInning) {
				return '';
			}

			// If we're looking at the current inning, only show data for completed half-innings
			if (inning === currentInning) {
				// For the current inning, only show away team data if we're past the top half
				// Only show home team data if we're past the bottom half
				if (isAway && !isTopHalf) {
					// We're past the top half of current inning, away team data is available
					const score = inningData.away_runs;
					return score !== undefined ? score : '';
				} else if (!isAway && !isTopHalf) {
					// We're past the bottom half of current inning, home team data is available
					const score = inningData.home_runs;
					return score !== undefined ? score : '';
				} else {
					// Half-inning hasn't been completed yet
					return '';
				}
			}

			// For completed innings, show the actual score
			const score = isAway ? inningData.away_runs : inningData.home_runs;
			return score !== undefined ? score : '';
		}
		return '';
	}

	// Handle final games
	if (isFinal) {
		if (innings && innings.length > 0) {
			const inningData = innings.find((i) => i.inning === inning);

			if (!inningData) {
				// No data for this inning - check if it's bottom of 9th and home team was winning
				if (inning === 9 && !isAway) {
					// Check if home team was already winning after 8 innings
					let homeRunsThrough8 = 0;
					let awayRunsThrough8 = 0;

					for (let i = 1; i <= 8; i++) {
						const prevInningData = innings.find((inn) => inn.inning === i);
						if (prevInningData) {
							homeRunsThrough8 += prevInningData.home_runs || 0;
							awayRunsThrough8 += prevInningData.away_runs || 0;
						}
					}

					// If home team was winning after 8 innings, show 'X' for bottom of 9th
					if (homeRunsThrough8 > awayRunsThrough8) {
						return 'X';
					}
				}
				return ''; // Show nothing for unplayed innings in final games
			}

			// Get the appropriate score based on team (away = top half, home = bottom half)
			const score = isAway ? inningData.away_runs : inningData.home_runs;
			return score !== undefined ? score : '';
		}
		return '';
	}

	// Default case - show nothing
	return '';
};

// Helper function to get current inning class for live games
const getInningClass = (inning: number, game: Game) => {
	// Get game status using MLB API status system
	const gameStatus = game.mlbStatus ? getGameStatusFromMLB(game.mlbStatus) : null;
	const isLive = gameStatus?.status === 'live' || game.status === 'Live' || game.is_live;

	if (isLive) {
		const currentInning = parseInt(game.inning || '1');
		if (inning === currentInning) {
			return 'bg-primary-400 dark:bg-primary-700 animate-pulse-slow';
		}
	}
	return '';
};

// Helper function to get inning score with appropriate text styling
const getInningScoreWithStyle = (inning: number, game: GameWithDetails, isAway: boolean) => {
	const score = getInningScore(inning, game, isAway);

	// Get game status using MLB API status system
	const gameStatus = game.mlbStatus ? getGameStatusFromMLB(game.mlbStatus) : null;
	const isLive = gameStatus?.status === 'live' || game.status === 'Live' || game.is_live;

	// For live games, don't apply special styling to current inning
	if (isLive) {
		const currentInning = parseInt(game.inning || '1');
		if (inning === currentInning) {
			return { score, className: '' };
		}
	}

	// Apply lighter text color for 0 scores (except live innings)
	if (String(score) === '0') {
		return { score, className: 'text-primary-500' };
	}

	return { score, className: '' };
};

// Helper function to get the innings to display
const getInningsToDisplay = (game: GameWithDetails) => {
	const baseInnings = 9;

	// Use detailed data if available, otherwise fall back to basic game data
	const innings = game.detailedData?.innings || game.innings || [];

	if (innings && innings.length > 0) {
		// Always show at least 9 innings, but add more if the game went to extras
		const maxInning = Math.max(...innings.map((i) => i.inning));
		return Math.max(baseInnings, maxInning);
	}

	// For live games, show at least the current inning
	if (game.status === 'Live' || game.is_live) {
		const currentInning = parseInt(game.inning || '1');
		return Math.max(baseInnings, currentInning);
	}

	return baseInnings;
};

// Helper function to get grid column class
const getGridColsClass = (totalColumns: number) => {
	const gridClasses: { [key: number]: string } = {
		13: 'grid-cols-13',
		14: 'grid-cols-14',
		15: 'grid-cols-15',
		16: 'grid-cols-16',
		17: 'grid-cols-17',
		18: 'grid-cols-18',
		19: 'grid-cols-19',
		20: 'grid-cols-20',
	};
	return gridClasses[totalColumns] || 'grid-cols-13';
};

const GamesList = memo(function GamesList({ games, selectedDate, onGameSelect }: GamesListProps) {
	// For now, use the games directly since baseball-service already loads real data
	// TODO: Re-enable progressive loading if we need additional detailed data later

	// Memoize the processed games data to prevent unnecessary recalculations
	const processedGames = useMemo(() => {
		return games.map((game) => {
			const detailedData = getDetailedGameData(game);
			return {
				...game,
				detailedData,
			} as GameWithDetails;
		});
	}, [games]);

	if (games.length === 0) {
		return (
			<section className="my-8">
				<div className="p-12 text-center rounded-xl border shadow-sm bg-primary-50 dark:bg-primary-800 border-primary-200 dark:border-primary-700">
					<h3 className="mb-2 text-lg font-semibold text-accent-900 dark:text-accent-100">No games found</h3>
					<p className="text-primary-600 dark:text-primary-400">
						No games were scheduled for {formatDate(selectedDate)}.
					</p>
				</div>
			</section>
		);
	}

	return (
		<section className="flex flex-col flex-1">
			<div className="grid flex-1 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
				{processedGames.map((game: GameWithDetails) => {
					// Use MLB API status data for more reliable status determination
					// Use MLB API status as the primary and only source of truth
					const gameStatus = game.mlbStatus
						? getGameStatusFromMLB(game.mlbStatus)
						: {
								status: 'unknown',
								displayText: 'UNKNOWN',
						  };

					const isLive = gameStatus.status === 'live';
					const isFinal = gameStatus.status === 'final';
					const isUpcoming = gameStatus.status === 'upcoming';
					const statusClass = gameStatus.status;

					// Determine status display using MLB API data
					let statusDisplay = gameStatus.displayText;
					const statusClassModifier = gameStatus.status;

					// For live games, show inning information with chevron icons
					if (isLive && game.inning && game.inning_state) {
						const inningNum = parseInt(game.inning);
						const inningState = game.inning_state.toLowerCase();

						// Convert inning number to ordinal
						const getOrdinal = (num: number) => {
							const j = num % 10;
							const k = num % 100;
							if (j === 1 && k !== 11) return num + 'ST';
							if (j === 2 && k !== 12) return num + 'ND';
							if (j === 3 && k !== 13) return num + 'RD';
							return num + 'TH';
						};

						const ordinalInning = getOrdinal(inningNum);

						if (inningState === 'top') {
							statusDisplay = `↑ ${ordinalInning}`;
						} else if (inningState === 'bottom') {
							statusDisplay = `↓ ${ordinalInning}`;
						} else if (inningState === 'middle') {
							statusDisplay = `→ ${ordinalInning}`;
						} else if (inningState === 'end') {
							statusDisplay = `END ${ordinalInning}`;
						}
					}

					return (
						<Link
							key={game.id}
							href={`/game/${game.id}`}
							className={`game-card ${statusClassModifier ? statusClassModifier : 'block'}`}>
							<div className="flex justify-between items-start -mx-3 mb-3">
								<h3 className="flex items-center w-full text-lg font-semibold text-secondary-900 dark:text-secondary-100">
									{/* Away Team */}
									<div className="flex flex-1 gap-1 justify-start items-center">
										{getTeamLogo(game.away_code)}
										<span className="translate-y-0.5">{getTeamName(game.away_team)}</span>
									</div>
									{/* @ Symbol */}
									<div className="flex flex-shrink justify-center px-1">
										<span className="translate-y-0.5">@</span>
									</div>
									{/* Home Team */}
									<div className="flex flex-1 gap-1 justify-end items-center">
										<span className="translate-y-0.5 text-right">{getTeamName(game.home_team)}</span>
										{getTeamLogo(game.home_code)}
									</div>
								</h3>
							</div>

							{/* Game Info Row */}
							<div className="-mx-6">
								<div className="flex w-full text-xs">
									{/* Game Time */}
									<div className="flex flex-shrink-0 gap-1 items-center px-2 h-6 border-r border-primary-200 dark:border-primary-700">
										{/* <Clock className="w-3 h-3" /> */}
										<span className="translate-y-0.5">{game.start_time}</span>
									</div>
									{/* Stadium */}
									<div className="flex flex-grow items-center px-2 h-6 truncate">
										<span className="text-xs truncate">{formatStadiumLocation(game.location)}</span>
									</div>
									{/* Game Status */}
									<div className="flex flex-shrink-0 justify-center items-center px-0 h-6 truncate">
										{statusDisplay && (
											<span className={`h-full status-indicator ${statusClassModifier}`}>{statusDisplay}</span>
										)}
									</div>
								</div>
							</div>

							{/* Inning Score Grid */}
							<div className="-mx-6 -mb-6 border-t border-primary-200 dark:border-primary-700">
								{(() => {
									const inningsToShow = getInningsToDisplay(game);
									const totalColumns = inningsToShow + 4; // innings + team + R + H + E

									return (
										<div
											className={`grid text-xs border-t border-b ${getGridColsClass(
												totalColumns
											)} border-primary-300 dark:border-primary-700`}>
											{/* Header Row */}
											<div className="w-12 h-6 border-r bg-primary-50 dark:bg-primary-800 border-primary-300 dark:border-primary-700"></div>
											{Array.from({ length: inningsToShow }, (_, i) => i + 1).map((inning) => (
												<div
													key={inning}
													className="flex justify-center items-center h-6 font-medium border-r bg-primary-50 dark:bg-primary-900 border-primary-200 dark:border-primary-700">
													{inning}
												</div>
											))}
											<div className="flex justify-center items-center h-6 font-medium border-r border-l bg-primary-50 dark:bg-primary-900 border-r-primary-200 border-l-primary-300 dark:border-primary-600">
												R
											</div>
											<div className="flex justify-center items-center h-6 font-medium border-r bg-primary-50 dark:bg-primary-900 border-primary-200 dark:border-primary-600">
												H
											</div>
											<div className="flex justify-center items-center h-6 font-medium bg-primary-50 dark:bg-primary-900">
												E
											</div>
										</div>
									);
								})()}

								{/* Away Team Row */}
								{(() => {
									const inningsToShow = getInningsToDisplay(game);
									const totalColumns = inningsToShow + 4;

									return (
										<div
											className={`grid text-xs border-b ${getGridColsClass(
												totalColumns
											)} border-primary-200 dark:border-primary-700`}>
											<div className="flex justify-end items-center px-1 w-12 h-6 font-semibold border-r bg-primary-50 dark:bg-primary-900 border-primary-300 dark:border-primary-700 text-primary-900 dark:text-primary-100">
												{game.away_code}
											</div>
											{Array.from({ length: inningsToShow }, (_, i) => i + 1).map((inning) => {
												return <div key={inning}>{renderInningScore(inning, game, true, 'detailed')}</div>;
											})}
											<div className="flex justify-center items-center h-6 font-mono font-bold border-r border-l bg-primary-50 dark:bg-primary-900 border-r-primary-200 border-l-primary-300 dark:border-primary-600">
												{game.away_score || 0}
											</div>
											{renderTeamStats(game, true, 'detailed')}
										</div>
									);
								})()}

								{/* Home Team Row */}
								{(() => {
									const inningsToShow = getInningsToDisplay(game);
									const totalColumns = inningsToShow + 4;

									return (
										<div
											className={`grid text-xs border-b ${getGridColsClass(
												totalColumns
											)} border-primary-200 dark:border-primary-700`}>
											<div className="flex justify-end items-center px-1 w-12 h-6 font-semibold border-r bg-primary-50 dark:bg-primary-900 border-primary-300 dark:border-primary-700 text-primary-900 dark:text-primary-100">
												{game.home_code}
											</div>
											{Array.from({ length: inningsToShow }, (_, i) => i + 1).map((inning) => {
												return <div key={inning}>{renderInningScore(inning, game, false, 'detailed')}</div>;
											})}
											<div className="flex justify-center items-center h-6 font-mono font-bold border-r border-l bg-primary-50 dark:bg-primary-900 border-r-primary-200 border-l-primary-300 dark:border-primary-600">
												{game.home_score || 0}
											</div>
											{renderTeamStats(game, false, 'detailed')}
										</div>
									);
								})()}
							</div>
						</Link>
					);
				})}
			</div>
		</section>
	);
});

export default GamesList;
