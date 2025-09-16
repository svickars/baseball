'use client';

import React, { useState, useEffect } from 'react';
import { GameData, Game } from '@/types';
import TraditionalScorecard from './TraditionalScorecard';
import GamePreview from './GamePreview';
import LoadingSpinner from './LoadingSpinner';
import * as TeamLogos from './team-logos';
import { formatDate, formatTime, getStatusColor, getGameStatusFromMLB } from '@/lib/utils';

interface GamePageProps {
	gameData: GameData;
	gameId: string;
	originalGame?: Game | null;
}

interface InningData {
	inning: number;
	away: number;
	home: number;
	events?: GameEvent[];
	top_events?: GameEvent[];
	bottom_events?: GameEvent[];
}

interface GameEvent {
	id: string;
	type: 'pitch' | 'hit' | 'out' | 'run' | 'substitution' | 'other';
	description: string;
	player: string;
	position?: string;
	svg?: string;
	timestamp?: string;
	summary?: string;
	batter?: string;
	pitcher?: string;
	outs?: number;
	inning?: number;
	half?: string;
	events?: any[];
	runs_scored?: number;
	rbis?: number;
}

interface BatterData {
	name: string;
	position: string;
	atBats: number;
	hits: number;
	runs: number;
	rbis: number;
	avg: string;
}

interface PitcherData {
	name: string;
	innings: string;
	hits: number;
	runs: number;
	earnedRuns: number;
	walks: number;
	strikeouts: number;
	era: string;
}

// Helper function to get team logo component
const getTeamLogo = (teamCode: string) => {
	const LogoComponent = (TeamLogos as any)[teamCode];
	return LogoComponent ? <LogoComponent size={64} /> : null;
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

// Helper function to get inning score display (from GamesList)
const getInningScore = (inning: number, game: any, isAway: boolean) => {
	// Use detailed data if available, otherwise fall back to basic game data
	const innings = game.detailedData?.innings || game.innings || [];

	if (innings && innings.length > 0) {
		// For final games, check special cases first before returning inning data
		if (game.status === 'Final') {
			const lastInning = Math.max(...innings.map((i: any) => i.inning));

			// Show 'X' for unplayed innings after the last played inning
			if (inning > lastInning) {
				return 'X';
			}

			// Special case: bottom of 9th when home team is winning (game ended in top of 9th)
			if (inning === 9 && !isAway && game.home_score && game.away_score && game.home_score > game.away_score) {
				// Check if the 9th inning data exists but only has away team data (top of inning)
				const ninthInningData = innings.find((i: any) => i.inning === 9);
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
						const inningData = innings.find((inn: any) => inn.inning === i);
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
		const inningData = innings.find((i: any) => i.inning === inning);
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
			const inningData = innings?.find((i: any) => i.inning === inning);
			return inningData ? (isAway ? inningData.away_runs : inningData.home_runs) : '0';
		} else {
			return '-'; // Future innings
		}
	}

	return '-'; // Default for upcoming games or no data
};

// Helper function to get current inning class for live games
const getInningClass = (inning: number, game: any) => {
	if (game.status === 'Live' || game.is_live) {
		const currentInning = parseInt(game.inning || '1');
		if (inning === currentInning) {
			return 'bg-primary-200 dark:bg-primary-700 animate-pulse-slow';
		}
	}
	return '';
};

// Helper function to get inning score with appropriate text styling
const getInningScoreWithStyle = (inning: number, game: any, isAway: boolean) => {
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
const getInningsToDisplay = (game: any) => {
	const baseInnings = 9;

	// Use detailed data if available, otherwise fall back to basic game data
	const innings = game.detailedData?.innings || game.innings || [];

	if (innings && innings.length > 0) {
		// Always show at least 9 innings, but add more if the game went to extras
		const maxInning = Math.max(...innings.map((i: any) => i.inning));
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

export default function GamePage({ gameData, gameId, originalGame }: GamePageProps) {
	const [detailedData, setDetailedData] = useState<any>(null);
	const [loading, setLoading] = useState(false);
	const [activeTab, setActiveTab] = useState<'preview' | 'traditional' | 'stats' | 'events'>('preview');
	const [selectedInning, setSelectedInning] = useState<number | null>(null);

	useEffect(() => {
		fetchDetailedData();
	}, [gameId]);

	const fetchDetailedData = async () => {
		setLoading(true);
		try {
			const response = await fetch(`/api/game/${gameId}/detailed`);
			const data = await response.json();
			setDetailedData(data);
		} catch (error) {
			console.error('Error fetching detailed data:', error);
		} finally {
			setLoading(false);
		}
	};

	const renderInningScorecard = () => {
		// Use detailed data if available, otherwise fall back to gameData
		const innings = detailedData?.innings || gameData.game_data.inning_list;
		const awayTotal =
			detailedData?.total_away_runs || gameData.game_data.inning_list.reduce((sum, inning) => sum + inning.away, 0);
		const homeTotal =
			detailedData?.total_home_runs || gameData.game_data.inning_list.reduce((sum, inning) => sum + inning.home, 0);

		return (
			<div className="p-6 bg-white rounded-lg shadow-lg dark:bg-primary-800">
				<div className="grid grid-cols-11 gap-2 mb-4">
					{/* Header */}
					<div className="col-span-1 font-bold text-center text-primary-900 dark:text-primary-100">Inning</div>
					{Array.from({ length: 9 }, (_, i) => (
						<div key={i} className="font-bold text-center text-primary-900 dark:text-primary-100">
							{i + 1}
						</div>
					))}
					<div className="font-bold text-center text-primary-900 dark:text-primary-100">R</div>

					{/* Away Team */}
					<div className="col-span-1 pr-2 font-bold text-right text-primary-900 dark:text-primary-100">
						{gameData.game_data.away_team.abbreviation}
					</div>
					{Array.from({ length: 9 }, (_, i) => {
						const inning = innings.find((inn: InningData) => inn.inning === i + 1);
						const runs = inning ? inning.away_runs || inning.away || 0 : 0;
						return (
							<div
								key={i}
								className={`text-center p-2 rounded cursor-pointer transition-colors text-primary-900 dark:text-primary-100 ${
									selectedInning === i + 1
										? 'bg-accent-100 dark:bg-accent-800 border-2 border-accent-500 dark:border-accent-400'
										: 'bg-primary-50 dark:bg-primary-700 hover:bg-primary-100 dark:hover:bg-primary-600'
								}`}
								onClick={() => setSelectedInning(i + 1)}>
								{runs}
							</div>
						);
					})}
					<div className="p-2 font-bold text-center rounded bg-accent-100 dark:bg-accent-800 text-primary-900 dark:text-primary-100">
						{awayTotal}
					</div>

					{/* Home Team */}
					<div className="col-span-1 pr-2 font-bold text-right text-primary-900 dark:text-primary-100">
						{gameData.game_data.home_team.abbreviation}
					</div>
					{Array.from({ length: 9 }, (_, i) => {
						const inning = innings.find((inn: InningData) => inn.inning === i + 1);
						const runs = inning ? inning.home_runs || inning.home || 0 : 0;
						return (
							<div
								key={i}
								className={`text-center p-2 rounded cursor-pointer transition-colors text-primary-900 dark:text-primary-100 ${
									selectedInning === i + 1
										? 'bg-warning-100 dark:bg-warning-800 border-2 border-warning-500 dark:border-warning-400'
										: 'bg-primary-50 dark:bg-primary-700 hover:bg-primary-100 dark:hover:bg-primary-600'
								}`}
								onClick={() => setSelectedInning(i + 1)}>
								{runs}
							</div>
						);
					})}
					<div className="p-2 font-bold text-center rounded bg-warning-100 dark:bg-warning-800 text-primary-900 dark:text-primary-100">
						{homeTotal}
					</div>
				</div>

				{/* Inning Details */}
				{selectedInning && detailedData && (
					<div className="p-4 mt-6 rounded-lg bg-primary-50 dark:bg-primary-700">
						<h3 className="mb-3 text-lg font-bold text-primary-900 dark:text-primary-100">
							Inning {selectedInning} Details
						</h3>
						<div className="space-y-2">
							{(() => {
								const inning = detailedData.innings?.find((inn: InningData) => inn.inning === selectedInning);
								if (!inning)
									return (
										<div className="text-primary-500 dark:text-primary-400">No data available for this inning</div>
									);

								const allEvents = [
									...(inning.top_events || []).map((event: GameEvent) => ({ ...event, half: 'top' })),
									...(inning.bottom_events || []).map((event: GameEvent) => ({ ...event, half: 'bottom' })),
								];

								return allEvents.map((event: GameEvent & { half: string }, index) => {
									const getEventIcon = (summary?: string) => {
										if (!summary) return '•';
										if (summary.includes('Strikeout')) return 'K';
										if (summary.includes('Single')) return '1B';
										if (summary.includes('Double')) return '2B';
										if (summary.includes('Triple')) return '3B';
										if (summary.includes('Home Run')) return 'HR';
										if (summary.includes('Walk')) return 'BB';
										if (summary.includes('Groundout')) return 'GO';
										if (summary.includes('Flyout')) return 'FO';
										if (summary.includes('Lineout')) return 'LO';
										if (summary.includes('Pop Out')) return 'PO';
										if (summary.includes('Hit By Pitch')) return 'HBP';
										if (summary.includes('Field Error')) return 'E';
										return '?';
									};

									const getEventColor = (summary?: string) => {
										if (!summary) return 'bg-primary-500 dark:bg-primary-400';
										if (summary.includes('Strikeout') || summary.includes('out'))
											return 'bg-error-500 dark:bg-error-600';
										if (
											summary.includes('Single') ||
											summary.includes('Double') ||
											summary.includes('Triple') ||
											summary.includes('Home Run')
										)
											return 'bg-success-500 dark:bg-success-600';
										if (summary.includes('Walk') || summary.includes('Hit By Pitch'))
											return 'bg-accent-500 dark:bg-accent-600';
										if (summary.includes('Field Error')) return 'bg-warning-500 dark:bg-warning-600';
										return 'bg-primary-500 dark:bg-primary-400';
									};

									return (
										<div key={index} className="flex items-center p-2 space-x-4 bg-white rounded dark:bg-primary-800">
											<div
												className={`w-8 h-8 ${getEventColor(
													event.summary
												)} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
												{getEventIcon(event.summary)}
											</div>
											<div className="flex-1">
												<span className="font-medium text-primary-900 dark:text-primary-100">{event.summary}</span>
												<span className="ml-2 text-primary-600 dark:text-primary-400">- {event.batter}</span>
												<span className="ml-2 text-primary-500 dark:text-primary-400">
													({event.half === 'top' ? 'Top' : 'Bottom'})
												</span>
											</div>
											<div className="text-sm text-primary-500 dark:text-primary-400">
												{event.outs} out{event.outs !== 1 ? 's' : ''}
											</div>
										</div>
									);
								});
							})()}
						</div>
					</div>
				)}
			</div>
		);
	};

	const renderStats = () => {
		const awayBatters = detailedData?.batters?.away || [];
		const homeBatters = detailedData?.batters?.home || [];
		const awayPitchers = detailedData?.pitchers?.away || [];
		const homePitchers = detailedData?.pitchers?.home || [];

		return (
			<div className="p-6 bg-white rounded-lg shadow-lg dark:bg-primary-800">
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					{/* Away Team Stats */}
					<div>
						<h3 className="mb-4 text-lg font-bold text-accent-600 dark:text-accent-400">
							{gameData.game_data.away_team.name} - Batting
						</h3>
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-primary-200 dark:border-primary-600">
										<th className="p-2 text-left text-primary-900 dark:text-primary-100">Player</th>
										<th className="p-2 text-center text-primary-900 dark:text-primary-100">AB</th>
										<th className="p-2 text-center text-primary-900 dark:text-primary-100">H</th>
										<th className="p-2 text-center text-primary-900 dark:text-primary-100">R</th>
										<th className="p-2 text-center text-primary-900 dark:text-primary-100">RBI</th>
										<th className="p-2 text-center text-primary-900 dark:text-primary-100">AVG</th>
									</tr>
								</thead>
								<tbody>
									{awayBatters.length > 0 ? (
										awayBatters.map((batter: BatterData, index: number) => (
											<tr key={index} className="border-b border-primary-200 dark:border-primary-600">
												<td className="p-2 text-primary-900 dark:text-primary-100">{batter.name}</td>
												<td className="p-2 text-center text-primary-900 dark:text-primary-100">{batter.atBats || 0}</td>
												<td className="p-2 text-center text-primary-900 dark:text-primary-100">{batter.hits || 0}</td>
												<td className="p-2 text-center text-primary-900 dark:text-primary-100">{batter.runs || 0}</td>
												<td className="p-2 text-center text-primary-900 dark:text-primary-100">{batter.rbis || 0}</td>
												<td className="p-2 text-center text-primary-900 dark:text-primary-100">
													{batter.avg || '.000'}
												</td>
											</tr>
										))
									) : (
										<tr className="border-b border-primary-200 dark:border-primary-600">
											<td className="p-2 text-primary-500 dark:text-primary-400" colSpan={6}>
												No batting data available
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</div>

					{/* Home Team Stats */}
					<div>
						<h3 className="mb-4 text-lg font-bold text-warning-600 dark:text-warning-400">
							{gameData.game_data.home_team.name} - Batting
						</h3>
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-primary-200 dark:border-primary-600">
										<th className="p-2 text-left text-primary-900 dark:text-primary-100">Player</th>
										<th className="p-2 text-center text-primary-900 dark:text-primary-100">AB</th>
										<th className="p-2 text-center text-primary-900 dark:text-primary-100">H</th>
										<th className="p-2 text-center text-primary-900 dark:text-primary-100">R</th>
										<th className="p-2 text-center text-primary-900 dark:text-primary-100">RBI</th>
										<th className="p-2 text-center text-primary-900 dark:text-primary-100">AVG</th>
									</tr>
								</thead>
								<tbody>
									{homeBatters.length > 0 ? (
										homeBatters.map((batter: BatterData, index: number) => (
											<tr key={index} className="border-b border-primary-200 dark:border-primary-600">
												<td className="p-2 text-primary-900 dark:text-primary-100">{batter.name}</td>
												<td className="p-2 text-center text-primary-900 dark:text-primary-100">{batter.atBats || 0}</td>
												<td className="p-2 text-center text-primary-900 dark:text-primary-100">{batter.hits || 0}</td>
												<td className="p-2 text-center text-primary-900 dark:text-primary-100">{batter.runs || 0}</td>
												<td className="p-2 text-center text-primary-900 dark:text-primary-100">{batter.rbis || 0}</td>
												<td className="p-2 text-center text-primary-900 dark:text-primary-100">
													{batter.avg || '.000'}
												</td>
											</tr>
										))
									) : (
										<tr className="border-b border-primary-200 dark:border-primary-600">
											<td className="p-2 text-primary-500 dark:text-primary-400" colSpan={6}>
												No batting data available
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>

				{/* Pitching Stats */}
				<div className="mt-6">
					<h3 className="mb-4 text-lg font-bold text-primary-900 dark:text-primary-100">Pitching</h3>
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div>
							<h4 className="mb-2 font-semibold text-accent-600 dark:text-accent-400">
								{gameData.game_data.away_team.name} Pitchers
							</h4>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-primary-200 dark:border-primary-600">
											<th className="p-2 text-left text-primary-900 dark:text-primary-100">Pitcher</th>
											<th className="p-2 text-center text-primary-900 dark:text-primary-100">IP</th>
											<th className="p-2 text-center text-primary-900 dark:text-primary-100">H</th>
											<th className="p-2 text-center text-primary-900 dark:text-primary-100">R</th>
											<th className="p-2 text-center text-primary-900 dark:text-primary-100">ER</th>
											<th className="p-2 text-center text-primary-900 dark:text-primary-100">BB</th>
											<th className="p-2 text-center text-primary-900 dark:text-primary-100">K</th>
										</tr>
									</thead>
									<tbody>
										{awayPitchers.length > 0 ? (
											awayPitchers.map((pitcher: PitcherData, index: number) => (
												<tr key={index} className="border-b border-primary-200 dark:border-primary-600">
													<td className="p-2 text-primary-900 dark:text-primary-100">{pitcher.name}</td>
													<td className="p-2 text-center text-primary-900 dark:text-primary-100">
														{pitcher.innings || '0.0'}
													</td>
													<td className="p-2 text-center text-primary-900 dark:text-primary-100">
														{pitcher.hits || 0}
													</td>
													<td className="p-2 text-center text-primary-900 dark:text-primary-100">
														{pitcher.runs || 0}
													</td>
													<td className="p-2 text-center text-primary-900 dark:text-primary-100">
														{pitcher.earnedRuns || 0}
													</td>
													<td className="p-2 text-center text-primary-900 dark:text-primary-100">
														{pitcher.walks || 0}
													</td>
													<td className="p-2 text-center text-primary-900 dark:text-primary-100">
														{pitcher.strikeouts || 0}
													</td>
												</tr>
											))
										) : (
											<tr className="border-b border-primary-200 dark:border-primary-600">
												<td className="p-2 text-primary-500 dark:text-primary-400" colSpan={7}>
													No pitching data available
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
						</div>

						<div>
							<h4 className="mb-2 font-semibold text-warning-600 dark:text-warning-400">
								{gameData.game_data.home_team.name} Pitchers
							</h4>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-primary-200 dark:border-primary-600">
											<th className="p-2 text-left text-primary-900 dark:text-primary-100">Pitcher</th>
											<th className="p-2 text-center text-primary-900 dark:text-primary-100">IP</th>
											<th className="p-2 text-center text-primary-900 dark:text-primary-100">H</th>
											<th className="p-2 text-center text-primary-900 dark:text-primary-100">R</th>
											<th className="p-2 text-center text-primary-900 dark:text-primary-100">ER</th>
											<th className="p-2 text-center text-primary-900 dark:text-primary-100">BB</th>
											<th className="p-2 text-center text-primary-900 dark:text-primary-100">K</th>
										</tr>
									</thead>
									<tbody>
										{homePitchers.length > 0 ? (
											homePitchers.map((pitcher: PitcherData, index: number) => (
												<tr key={index} className="border-b border-primary-200 dark:border-primary-600">
													<td className="p-2 text-primary-900 dark:text-primary-100">{pitcher.name}</td>
													<td className="p-2 text-center text-primary-900 dark:text-primary-100">
														{pitcher.innings || '0.0'}
													</td>
													<td className="p-2 text-center text-primary-900 dark:text-primary-100">
														{pitcher.hits || 0}
													</td>
													<td className="p-2 text-center text-primary-900 dark:text-primary-100">
														{pitcher.runs || 0}
													</td>
													<td className="p-2 text-center text-primary-900 dark:text-primary-100">
														{pitcher.earnedRuns || 0}
													</td>
													<td className="p-2 text-center text-primary-900 dark:text-primary-100">
														{pitcher.walks || 0}
													</td>
													<td className="p-2 text-center text-primary-900 dark:text-primary-100">
														{pitcher.strikeouts || 0}
													</td>
												</tr>
											))
										) : (
											<tr className="border-b border-primary-200 dark:border-primary-600">
												<td className="p-2 text-primary-500 dark:text-primary-400" colSpan={7}>
													No pitching data available
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	};

	const renderEvents = () => {
		if (!detailedData?.innings) {
			return (
				<div className="p-6 bg-white rounded-lg shadow-lg dark:bg-primary-800">
					<h3 className="mb-4 text-lg font-bold text-primary-900 dark:text-primary-100">Game Events</h3>
					<div className="text-primary-500 dark:text-primary-400">No event data available</div>
				</div>
			);
		}

		// Flatten all events from all innings
		const allEvents: any[] = [];
		detailedData.innings.forEach((inning: InningData) => {
			if (inning.top_events) {
				inning.top_events.forEach((event: GameEvent) => {
					allEvents.push({
						...event,
						inning: inning.inning,
						half: 'top',
					});
				});
			}
			if (inning.bottom_events) {
				inning.bottom_events.forEach((event: GameEvent) => {
					allEvents.push({
						...event,
						inning: inning.inning,
						half: 'bottom',
					});
				});
			}
		});

		return (
			<div className="p-6 bg-white rounded-lg shadow-lg dark:bg-primary-800">
				<h3 className="mb-4 text-lg font-bold text-primary-900 dark:text-primary-100">Game Events</h3>
				<div className="overflow-y-auto space-y-3 max-h-96">
					{allEvents.map((event: GameEvent, index) => {
						const getEventColor = (summary?: string) => {
							if (!summary) return 'bg-primary-500 dark:bg-primary-400';
							if (summary.includes('Strikeout') || summary.includes('out')) return 'bg-error-500 dark:bg-error-600';
							if (
								summary.includes('Single') ||
								summary.includes('Double') ||
								summary.includes('Triple') ||
								summary.includes('Home Run')
							)
								return 'bg-success-500 dark:bg-success-600';
							if (summary.includes('Walk') || summary.includes('Hit By Pitch'))
								return 'bg-accent-500 dark:bg-accent-600';
							if (summary.includes('Field Error')) return 'bg-warning-500 dark:bg-warning-600';
							return 'bg-primary-500 dark:bg-primary-400';
						};

						return (
							<div
								key={index}
								className="p-4 rounded-lg border bg-primary-50 dark:bg-primary-700 border-primary-200 dark:border-primary-600">
								<div className="flex items-center mb-2 space-x-4">
									<div
										className={`w-10 h-10 ${getEventColor(
											event.summary
										)} rounded-full flex items-center justify-center text-white font-bold`}>
										{index + 1}
									</div>
									<div className="flex-1">
										<div className="font-medium text-primary-900 dark:text-primary-100">
											{event.half === 'top' ? 'Top' : 'Bottom'} {event.inning}
											{event.inning === 1 ? 'st' : event.inning === 2 ? 'nd' : event.inning === 3 ? 'rd' : 'th'}
										</div>
										<div className="text-sm text-primary-600 dark:text-primary-400">
											{event.batter} vs {event.pitcher}
										</div>
									</div>
									<div className="text-sm text-primary-500 dark:text-primary-400">
										{event.outs} out{event.outs !== 1 ? 's' : ''}
									</div>
								</div>

								<div className="ml-14">
									<div className="mb-1 text-sm font-medium text-primary-900 dark:text-primary-100">
										{event.summary} - {event.description}
									</div>

									{event.events && event.events.length > 0 && (
										<div className="mt-2">
											<div className="mb-1 text-xs text-primary-500 dark:text-primary-400">Pitch Sequence:</div>
											<div className="flex flex-wrap gap-1">
												{event.events?.map((pitch: any, pitchIndex: number) => (
													<span
														key={pitchIndex}
														className="px-2 py-1 text-xs bg-white rounded border dark:bg-primary-800 border-primary-200 dark:border-primary-600 text-primary-900 dark:text-primary-100"
														title={`${pitch.type}: ${pitch.description}${pitch.speed ? ` (${pitch.speed} mph)` : ''}`}>
														{pitch.type}
													</span>
												))}
											</div>
										</div>
									)}

									{((event.runs_scored || 0) > 0 || (event.rbis || 0) > 0) && (
										<div className="mt-1 text-xs text-success-600 dark:text-success-400">
											{(event.runs_scored || 0) > 0 && `Runs: ${event.runs_scored} `}
											{(event.rbis || 0) > 0 && `RBIs: ${event.rbis}`}
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		);
	};

	return (
		<div className="mx-auto max-w-7xl min-h-screen border-r border-l border-primary-300 dark:border-primary-700">
			{/* Header */}
			<div className="border-b border-primary-100 dark:border-primary-700">
				<div className="flex justify-between items-center px-6 border-b border-primary-200 dark:border-primary-600">
					{/* Away Team */}
					<div className="flex flex-1 gap-3 justify-start items-center">
						<div className="flex justify-center items-center py-4 pr-6 border-r border-primary-200 dark:border-primary-600">
							{getTeamLogo(gameData.game_data.away_team.abbreviation)}
						</div>
						<span className="hidden text-2xl font-semibold tracking-wider uppercase font-display text-primary-900 dark:text-primary-100 sm:block">
							{gameData.game_data.away_team.name}
						</span>
						<span className="text-2xl font-semibold tracking-wider uppercase font-display text-primary-900 dark:text-primary-100 sm:hidden">
							{gameData.game_data.away_team.abbreviation}
						</span>
					</div>

					{/* @ Symbol */}
					<div className="flex flex-shrink-0 justify-center px-4">
						<span className="text-lg font-semibold font-display text-primary-600 dark:text-primary-400">@</span>
					</div>

					{/* Home Team */}
					<div className="flex flex-1 gap-3 justify-end items-center">
						<span className="hidden text-2xl font-semibold tracking-wider uppercase font-display text-primary-900 dark:text-primary-100 sm:block">
							{gameData.game_data.home_team.name}
						</span>
						<span className="text-2xl font-semibold tracking-wider uppercase font-display text-primary-900 dark:text-primary-100 sm:hidden">
							{gameData.game_data.home_team.abbreviation}
						</span>
						<div className="flex justify-center items-center py-4 pl-6 border-l border-primary-200 dark:border-primary-600">
							{getTeamLogo(gameData.game_data.home_team.abbreviation)}
						</div>
					</div>
				</div>

				{/* Game Info */}
				<div>
					<div className="flex flex-col flex-wrap items-start w-full text-sm border-b md:flex-row text-primary-600 dark:text-primary-400 border-primary-300 dark:border-primary-700">
						<div className="flex">
							{/* Time */}
							<div className="flex items-center justify-center px-3 py-3 border-r border-primary-200 dark:border-primary-600 w-[113px]">
								<span className="font-medium">{originalGame?.start_time || 'TBD'}</span>
							</div>

							{/* Date */}
							<div className="flex items-center px-4 py-3 border-r border-primary-200 dark:border-primary-600">
								<span className="font-medium">
									{detailedData?.date ? formatDate(detailedData.date) : formatDate(gameData.game_data.game_date_str)}
								</span>
							</div>
						</div>
						<div className="flex flex-1 w-full border-t border-t-primary-200 md:border-t-0 dark:border-primary-700">
							{/* Stadium */}
							<div className="flex flex-1 items-center px-4 py-3 border-r border-primary-200 dark:border-primary-600">
								<span className="font-medium">
									{originalGame?.location
										? formatStadiumLocation(originalGame.location)
										: detailedData?.venue
										? formatStadiumLocation(detailedData.venue)
										: gameData.game_data.location}
								</span>
							</div>

							{/* Game Status */}
							<div className="h-full w-[112px]">
								{(() => {
									// Use MLB API status data for more reliable status determination
									// Use MLB API status as the primary and only source of truth
									const gameStatus = originalGame?.mlbStatus
										? getGameStatusFromMLB(originalGame.mlbStatus)
										: {
												status: 'unknown',
												displayText: 'UNKNOWN',
										  };

									const isLive = gameStatus.status === 'live';
									const isFinal = gameStatus.status === 'final';
									const isUpcoming = gameStatus.status === 'upcoming';

									// Determine status display and class modifier using MLB API data
									const statusDisplay = gameStatus.displayText;
									const statusClassModifier = gameStatus.status;

									return statusDisplay ? (
										<div
											className={`flex justify-center items-center px-4 py-0 w-full text-base status-indicator h-[44px] ${statusClassModifier}`}>
											{statusDisplay}
										</div>
									) : null;
								})()}
							</div>
						</div>
					</div>
				</div>

				{/* Inning Score Grid */}
				{originalGame && (
					<div className="border-t border-b border-t-primary-200 border-b-primary-300 dark:border-t-primary-700 dark:border-b-primary-800">
						{(() => {
							// Create a game object that matches the GamesList format
							const game = {
								...originalGame,
								detailedData: detailedData
									? {
											innings: detailedData.innings,
											away_hits:
												detailedData.batters?.away?.reduce((sum: number, batter: any) => sum + (batter.hits || 0), 0) ||
												0,
											home_hits:
												detailedData.batters?.home?.reduce((sum: number, batter: any) => sum + (batter.hits || 0), 0) ||
												0,
											away_errors: 0, // Would need to calculate from events
											home_errors: 0, // Would need to calculate from events
									  }
									: null,
							};

							const inningsToShow = getInningsToDisplay(game);
							const totalColumns = inningsToShow + 4; // innings + team + R + H + E

							return (
								<div
									className="text-xs border-b md:text-lg border-primary-300 dark:border-primary-700"
									style={{ display: 'grid', gridTemplateColumns: `113px repeat(${totalColumns - 1}, 1fr)` }}>
									{/* Header Row */}
									<div className="h-6 border-r bg-primary-50 dark:bg-primary-800 border-primary-300 dark:border-primary-700 md:h-10"></div>
									{Array.from({ length: inningsToShow }, (_, i) => i + 1).map((inning) => (
										<div
											key={inning}
											className="flex justify-center items-center h-6 font-medium border-r bg-primary-50 dark:bg-primary-900 border-primary-200 dark:border-primary-700 md:h-10">
											{inning}
										</div>
									))}
									<div className="flex justify-center items-center h-6 font-medium border-r border-l bg-primary-50 dark:bg-primary-900 border-r-primary-200 border-l-primary-300 dark:border-primary-600 md:h-10">
										R
									</div>
									<div className="flex justify-center items-center h-6 font-medium border-r bg-primary-50 dark:bg-primary-900 border-primary-200 dark:border-primary-600 md:h-10">
										H
									</div>
									<div className="flex justify-center items-center h-6 font-medium bg-primary-50 dark:bg-primary-900 md:h-10">
										E
									</div>
								</div>
							);
						})()}

						{/* Away Team Row */}
						{(() => {
							const game = {
								...originalGame,
								detailedData: detailedData
									? {
											innings: detailedData.innings,
											away_hits:
												detailedData.batters?.away?.reduce((sum: number, batter: any) => sum + (batter.hits || 0), 0) ||
												0,
											home_hits:
												detailedData.batters?.home?.reduce((sum: number, batter: any) => sum + (batter.hits || 0), 0) ||
												0,
											away_errors: 0,
											home_errors: 0,
									  }
									: null,
							};

							const inningsToShow = getInningsToDisplay(game);
							const totalColumns = inningsToShow + 4;

							return (
								<div
									className="text-xs border-b md:text-lg border-primary-200 dark:border-primary-700"
									style={{ display: 'grid', gridTemplateColumns: `113px repeat(${totalColumns - 1}, 1fr)` }}>
									<div className="flex justify-end items-center px-2 h-6 font-semibold border-r bg-primary-50 dark:bg-primary-900 border-primary-300 dark:border-primary-700 md:h-10 text-primary-900 dark:text-primary-100">
										{originalGame.away_code}
									</div>
									{Array.from({ length: inningsToShow }, (_, i) => i + 1).map((inning) => {
										const { score, className } = getInningScoreWithStyle(inning, game, true);
										return (
											<div
												key={inning}
												className={`bg-primary-50 font-mono dark:bg-primary-900 border-r border-primary-200 dark:border-primary-700 h-6 md:h-10 flex items-center justify-center ${getInningClass(
													inning,
													game
												)} ${className}`}>
												{score}
											</div>
										);
									})}
									<div className="flex justify-center items-center h-6 font-mono font-bold border-r border-l bg-primary-50 dark:bg-primary-900 border-r-primary-200 border-l-primary-300 dark:border-primary-600 md:h-10">
										{originalGame.away_score || 0}
									</div>
									<div className="flex justify-center items-center h-6 font-mono border-r bg-primary-50 dark:bg-primary-900 border-primary-200 dark:border-primary-600 md:h-10">
										{game.detailedData?.away_hits || originalGame.away_hits || '-'}
									</div>
									<div className="flex justify-center items-center h-6 font-mono bg-primary-50 dark:bg-primary-900 md:h-10">
										{game.detailedData?.away_errors || originalGame.away_errors || '-'}
									</div>
								</div>
							);
						})()}

						{/* Home Team Row */}
						{(() => {
							const game = {
								...originalGame,
								detailedData: detailedData
									? {
											innings: detailedData.innings,
											away_hits:
												detailedData.batters?.away?.reduce((sum: number, batter: any) => sum + (batter.hits || 0), 0) ||
												0,
											home_hits:
												detailedData.batters?.home?.reduce((sum: number, batter: any) => sum + (batter.hits || 0), 0) ||
												0,
											away_errors: 0,
											home_errors: 0,
									  }
									: null,
							};

							const inningsToShow = getInningsToDisplay(game);
							const totalColumns = inningsToShow + 4;

							return (
								<div
									className="text-xs border-b md:text-lg border-primary-200 dark:border-primary-700"
									style={{ display: 'grid', gridTemplateColumns: `113px repeat(${totalColumns - 1}, 1fr)` }}>
									<div className="flex justify-end items-center px-2 h-6 font-semibold border-r bg-primary-50 dark:bg-primary-900 border-primary-300 dark:border-primary-700 md:h-10 text-primary-900 dark:text-primary-100">
										{originalGame.home_code}
									</div>
									{Array.from({ length: inningsToShow }, (_, i) => i + 1).map((inning) => {
										const { score, className } = getInningScoreWithStyle(inning, game, false);
										return (
											<div
												key={inning}
												className={`bg-primary-50 font-mono dark:bg-primary-900 border-r border-primary-200 dark:border-primary-700 h-6 md:h-10 flex items-center justify-center ${getInningClass(
													inning,
													game
												)} ${className}`}>
												{score}
											</div>
										);
									})}
									<div className="flex justify-center items-center h-6 font-mono font-bold border-r border-l bg-primary-50 dark:bg-primary-900 border-r-primary-200 border-l-primary-300 dark:border-primary-600 md:h-10">
										{originalGame.home_score || 0}
									</div>
									<div className="flex justify-center items-center h-6 font-mono border-r bg-primary-50 dark:bg-primary-900 border-primary-200 dark:border-primary-600 md:h-10">
										{game.detailedData?.home_hits || originalGame.home_hits || '-'}
									</div>
									<div className="flex justify-center items-center h-6 font-mono bg-primary-50 dark:bg-primary-900 md:h-10">
										{game.detailedData?.home_errors || originalGame.home_errors || '-'}
									</div>
								</div>
							);
						})()}
					</div>
				)}
			</div>

			{/* Tabs */}
			<div className="my-4">
				<div className="border-b border-primary-200 dark:border-primary-600">
					<nav className="flex justify-center -mb-px">
						{[
							{ id: 'preview', label: 'Game Preview' },
							{ id: 'traditional', label: 'Traditional Scorecard' },
							{ id: 'stats', label: 'Statistics' },
							{ id: 'events', label: 'Events' },
						].map((tab: { id: string; label: string }, index) => (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id as any)}
								className={`py-2 px-4 border-b-2 font-medium text-sm ${
									activeTab === tab.id
										? 'border-accent-500 text-accent-600 dark:text-accent-400'
										: 'border-transparent text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:border-primary-300 dark:hover:border-primary-500'
								}`}>
								{tab.label}
							</button>
						))}
					</nav>
				</div>
			</div>

			{/* Content */}
			<div className="overflow-x-scroll">
				{loading && (
					<div className="flex justify-center items-center py-12">
						<LoadingSpinner message="Loading game data..." />
					</div>
				)}

				{!loading && (
					<>
						{activeTab === 'preview' && (
							<GamePreview gameData={gameData} originalGame={originalGame} detailedData={detailedData} />
						)}
						{activeTab === 'traditional' && <TraditionalScorecard gameData={gameData} gameId={gameId} />}
						{activeTab === 'stats' && renderStats()}
						{activeTab === 'events' && renderEvents()}
					</>
				)}
			</div>
		</div>
	);
}
