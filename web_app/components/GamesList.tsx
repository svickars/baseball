'use client';

import React, { useState, useEffect } from 'react';
import { Game } from '@/types';
import { formatDate, formatTime, getStatusColor, isGameLive, isGameFinal, isGameUpcoming } from '@/lib/utils';
import { Clock, MapPin, Trophy } from 'lucide-react';
import Link from 'next/link';
import * as TeamLogos from './team-logos';
import { getGameDetails } from '@/lib/baseball-service';
import LoadingSpinner from './LoadingSpinner';

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

// Helper function to fetch detailed game data
const fetchDetailedGameData = async (gameId: string) => {
	try {
		const response = await fetch(`/api/game/${gameId}`);
		if (response.ok) {
			const data = await response.json();
			if (data.success && data.game_data) {
				// Extract inning data from the detailed game data
				const innings = data.game_data.detailed_data?.innings || [];

				// Extract hits and errors from the detailed game events
				let away_hits = 0;
				let home_hits = 0;
				let away_errors = 0;
				let home_errors = 0;

				if (innings && innings.length > 0) {
					innings.forEach((inning: any) => {
						// Count hits for away team (top events)
						inning.top_events?.forEach((event: any) => {
							if (
								event.got_on_base &&
								event.summary &&
								!event.summary.includes('Walk') &&
								!event.summary.includes('Hit By Pitch') &&
								!event.summary.includes('Error')
							) {
								away_hits++;
							}
							// Count errors for home team (away team benefits from home team errors)
							if (event.error_str) {
								home_errors++;
							}
						});

						// Count hits for home team (bottom events)
						inning.bottom_events?.forEach((event: any) => {
							if (
								event.got_on_base &&
								event.summary &&
								!event.summary.includes('Walk') &&
								!event.summary.includes('Hit By Pitch') &&
								!event.summary.includes('Error')
							) {
								home_hits++;
							}
							// Count errors for away team (home team benefits from away team errors)
							if (event.error_str) {
								away_errors++;
							}
						});
					});
				}

				return {
					innings,
					away_hits,
					home_hits,
					away_errors,
					home_errors,
				};
			}
		}
	} catch (error) {
		console.error(`Error fetching detailed data for game ${gameId}:`, error);
	}
	return null;
};

// Helper function to get inning score display
const getInningScore = (inning: number, game: GameWithDetails, isAway: boolean) => {
	// Use detailed data if available, otherwise fall back to basic game data
	const innings = game.detailedData?.innings || game.innings || [];

	if (innings && innings.length > 0) {
		// For final games, check special cases first before returning inning data
		if (game.status === 'Final') {
			const lastInning = Math.max(...innings.map((i) => i.inning));

			// Show 'X' for unplayed innings after the last played inning
			if (inning > lastInning) {
				return 'X';
			}

			// Special case: bottom of 9th when home team is winning (game ended in top of 9th)
			if (inning === 9 && !isAway && game.home_score && game.away_score && game.home_score > game.away_score) {
				// Check if the 9th inning data exists but only has away team data (top of inning)
				const ninthInningData = innings.find((i) => i.inning === 9);
				if (ninthInningData && ninthInningData.away_runs !== undefined && ninthInningData.home_runs === undefined) {
					return 'X';
				}

				// Alternative check: if home team was already winning after 8 innings,
				// the bottom of 9th wasn't played (game ended in top of 9th)
				if (ninthInningData && lastInning === 9) {
					// Calculate total runs through 8 innings to see if home team was already winning
					let homeRunsThrough8 = 0;
					let awayRunsThrough8 = 0;

					for (let i = 1; i <= 8; i++) {
						const inningData = innings.find((inn) => inn.inning === i);
						if (inningData) {
							homeRunsThrough8 += inningData.home_runs || 0;
							awayRunsThrough8 += inningData.away_runs || 0;
						}
					}

					// If home team was already winning after 8 innings, bottom of 9th wasn't played
					if (homeRunsThrough8 > awayRunsThrough8) {
						return 'X';
					}
				}
			}
		}

		// Use real inning data (after checking special cases)
		const inningData = innings.find((i) => i.inning === inning);
		if (inningData) {
			return isAway ? inningData.away_runs : inningData.home_runs;
		}
	}

	// For live games without full inning data, show current inning
	if (game.status === 'Live' || game.is_live) {
		const currentInning = parseInt(game.inning || '1');
		if (inning === currentInning) {
			return '0'; // Current inning score
		} else if (inning < currentInning) {
			// Try to get from inning data, fallback to 0
			const inningData = innings?.find((i) => i.inning === inning);
			return inningData ? (isAway ? inningData.away_runs : inningData.home_runs) : '0';
		} else {
			return '-'; // Future innings
		}
	}

	return '-'; // Default for upcoming games or no data
};

// Helper function to get current inning class for live games
const getInningClass = (inning: number, game: Game) => {
	if (game.status === 'Live' || game.is_live) {
		const currentInning = parseInt(game.inning || '1');
		if (inning === currentInning) {
			return 'bg-primary-200 dark:bg-primary-700 animate-pulse-slow';
		}
	}
	return '';
};

// Helper function to get inning score with appropriate text styling
const getInningScoreWithStyle = (inning: number, game: GameWithDetails, isAway: boolean) => {
	const score = getInningScore(inning, game, isAway);

	// For live games, don't apply special styling to current inning
	if (game.status === 'Live' || game.is_live) {
		const currentInning = parseInt(game.inning || '1');
		if (inning === currentInning) {
			return { score, className: '' };
		}
	}

	// Apply lighter text color for 0 scores (except live innings)
	if (score === 0 || score === '0') {
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

export default function GamesList({ games, selectedDate, onGameSelect }: GamesListProps) {
	const [gamesWithDetails, setGamesWithDetails] = useState<GameWithDetails[]>([]);
	const [loadingDetails, setLoadingDetails] = useState<boolean>(true);

	useEffect(() => {
		const fetchAllDetailedData = async () => {
			setLoadingDetails(true);
			const gamesWithDetailsData = await Promise.all(
				games.map(async (game) => {
					const detailedData = await fetchDetailedGameData(game.id);
					return {
						...game,
						detailedData,
					} as GameWithDetails;
				})
			);
			setGamesWithDetails(gamesWithDetailsData);
			setLoadingDetails(false);
		};

		if (games && games.length > 0) {
			fetchAllDetailedData();
		}
	}, [games]);

	if (loadingDetails) {
		return (
			<section className="my-8">
				<LoadingSpinner message="Loading games..." />
			</section>
		);
	}

	if (games.length === 0) {
		return (
			<section className="my-8">
				<h2 className="text-xl font-semibold text-accent-900 dark:text-accent-100 mb-6">
					Games for {formatDate(selectedDate)}
				</h2>
				<div className="bg-primary-50 dark:bg-primary-800 rounded-xl shadow-sm border border-primary-200 dark:border-primary-700 p-12 text-center">
					<h3 className="text-lg font-semibold text-accent-900 dark:text-accent-100 mb-2">No games found</h3>
					<p className="text-primary-600 dark:text-primary-400">
						No games were scheduled for {formatDate(selectedDate)}.
					</p>
				</div>
			</section>
		);
	}

	return (
		<section className="flex-1 flex flex-col">
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 flex-1">
				{gamesWithDetails.map((game: GameWithDetails) => {
					const isLive = isGameLive(game);
					const isFinal = isGameFinal(game);
					const isUpcoming = isGameUpcoming(game);
					const statusClass = game.status.toLowerCase().replace(/\s+/g, '-');

					// Determine status display
					let statusDisplay = '';
					let statusClassModifier = '';
					if (isLive) {
						statusDisplay = 'LIVE';
						statusClassModifier = 'live';
					} else if (isFinal) {
						statusDisplay = 'FINAL';
						statusClassModifier = 'final';
					} else if (isUpcoming) {
						statusDisplay = 'UPCOMING';
						statusClassModifier = 'upcoming';
					}

					return (
						<Link
							key={game.id}
							href={`/game/${game.id}`}
							className={`game-card ${statusClassModifier ? statusClassModifier : ''} block`}>
							<div className="flex justify-between items-start mb-3">
								<h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100 flex items-center w-full">
									{/* Away Team */}
									<div className="flex items-center gap-2 justify-start flex-1">
										{getTeamLogo(game.away_code)}
										<span className="translate-y-0.5">{getTeamName(game.away_team)}</span>
									</div>
									{/* @ Symbol */}
									<div className="flex justify-center px-4 flex-shrink">
										<span className="translate-y-0.5">@</span>
									</div>
									{/* Home Team */}
									<div className="flex items-center gap-2 justify-end flex-1">
										<span className="translate-y-0.5">{getTeamName(game.home_team)}</span>
										{getTeamLogo(game.home_code)}
									</div>
								</h3>
							</div>

							{isLive && game.inning && (
								<div className="text-center text-success-600 dark:text-success-400 font-medium mb-3 font-mono">
									{game.inning}
									{game.inning_state ? ` ${game.inning_state}` : ''}
								</div>
							)}

							{/* Game Info Row */}
							<div className="-mx-6">
								<div className="flex text-xs">
									{/* Game Time */}
									<div className="border-r border-primary-200 dark:border-primary-700 h-6 flex items-center gap-1 px-2 flex-shrink-0">
										{/* <Clock className="w-3 h-3" /> */}
										<span className="translate-y-0.5">{game.start_time}</span>
									</div>
									{/* Stadium */}
									<div className="h-6 flex items-center px-2 flex-grow">
										<span className="text-xs truncate">{formatStadiumLocation(game.location)}</span>
									</div>
									{/* Game Status */}
									<div className="h-6 flex items-center justify-center px-0 flex-shrink-0">
										{statusDisplay && (
											<span className={`status-indicator h-full ${statusClassModifier}`}>{statusDisplay}</span>
										)}
									</div>
								</div>
							</div>

							{/* Inning Score Grid */}
							<div className="border-t border-primary-200 dark:border-primary-700 -mx-6 -mb-6">
								{(() => {
									const inningsToShow = getInningsToDisplay(game);
									const totalColumns = inningsToShow + 4; // innings + team + R + H + E

									return (
										<div
											className={`grid ${getGridColsClass(
												totalColumns
											)} text-xs border-b border-t border-primary-300 dark:border-primary-700`}>
											{/* Header Row */}
											<div className="bg-primary-50 dark:bg-primary-800 border-r border-primary-300 dark:border-primary-700 h-6"></div>
											{Array.from({ length: inningsToShow }, (_, i) => i + 1).map((inning) => (
												<div
													key={inning}
													className="bg-primary-50 dark:bg-primary-900 border-r border-primary-200 dark:border-primary-700 h-6 flex items-center justify-center font-medium">
													{inning}
												</div>
											))}
											<div className="bg-primary-50 dark:bg-primary-900 border-r border-r-primary-200 border-l border-l-primary-300 dark:border-primary-600 h-6 flex items-center justify-center font-medium">
												R
											</div>
											<div className="bg-primary-50 dark:bg-primary-900 border-r border-primary-200 dark:border-primary-600 h-6 flex items-center justify-center font-medium">
												H
											</div>
											<div className="bg-primary-50 dark:bg-primary-900 h-6 flex items-center justify-center font-medium">
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
											className={`grid ${getGridColsClass(
												totalColumns
											)} text-xs border-b border-primary-200	dark:border-primary-700`}>
											<div className="bg-primary-50 dark:bg-primary-900 border-r border-primary-300 dark:border-primary-700 h-6 flex items-center justify-end px-1 font-semibold text-primary-900 dark:text-primary-100">
												{game.away_code}
											</div>
											{Array.from({ length: inningsToShow }, (_, i) => i + 1).map((inning) => {
												const { score, className } = getInningScoreWithStyle(inning, game, true);
												return (
													<div
														key={inning}
														className={`bg-primary-50 font-mono dark:bg-primary-900 border-r border-primary-200 dark:border-primary-700 h-6 flex items-center justify-center ${getInningClass(
															inning,
															game
														)} ${className}`}>
														{score}
													</div>
												);
											})}
											<div className="bg-primary-50 dark:bg-primary-900 font-mono border-r border-r-primary-200 border-l border-l-primary-300 dark:border-primary-600 h-6 flex items-center justify-center font-bold">
												{game.away_score || 0}
											</div>
											<div className="bg-primary-50 dark:bg-primary-900 font-mono border-r border-primary-200 dark:border-primary-600 h-6 flex items-center justify-center">
												{game.detailedData?.away_hits || game.away_hits || '-'}
											</div>
											<div className="bg-primary-50 dark:bg-primary-900 font-mono h-6 flex items-center justify-center">
												{game.detailedData?.away_errors || game.away_errors || '-'}
											</div>
										</div>
									);
								})()}

								{/* Home Team Row */}
								{(() => {
									const inningsToShow = getInningsToDisplay(game);
									const totalColumns = inningsToShow + 4;

									return (
										<div
											className={`grid ${getGridColsClass(
												totalColumns
											)} text-xs border-b border-primary-200	dark:border-primary-700`}>
											<div className="bg-primary-50 dark:bg-primary-900 border-r border-primary-300 dark:border-primary-700 h-6 flex items-center justify-end px-1 font-semibold text-primary-900 dark:text-primary-100">
												{game.home_code}
											</div>
											{Array.from({ length: inningsToShow }, (_, i) => i + 1).map((inning) => {
												const { score, className } = getInningScoreWithStyle(inning, game, false);
												return (
													<div
														key={inning}
														className={`bg-primary-50 font-mono dark:bg-primary-900 border-r border-primary-200 dark:border-primary-700 h-6 flex items-center justify-center ${getInningClass(
															inning,
															game
														)} ${className}`}>
														{score}
													</div>
												);
											})}
											<div className="bg-primary-50 dark:bg-primary-900 font-mono border-r border-r-primary-200 border-l border-l-primary-300 dark:border-primary-600 h-6 flex items-center justify-center font-bold">
												{game.home_score || 0}
											</div>
											<div className="bg-primary-50 dark:bg-primary-900 font-mono border-r border-primary-200 dark:border-primary-600 h-6 flex items-center justify-center">
												{game.detailedData?.home_hits || game.home_hits || '-'}
											</div>
											<div className="bg-primary-50 dark:bg-primary-900 font-mono h-6 flex items-center justify-center">
												{game.detailedData?.home_errors || game.home_errors || '-'}
											</div>
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
}
