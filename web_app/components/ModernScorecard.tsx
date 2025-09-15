'use client';

import React, { useState, useEffect } from 'react';
import { GameData } from '@/types';
import TraditionalScorecard from './TraditionalScorecard';

interface ModernScorecardProps {
	gameData: GameData;
	gameId: string;
}

interface InningData {
	inning: number;
	away: number;
	home: number;
	events?: GameEvent[];
}

interface GameEvent {
	id: string;
	type: 'pitch' | 'hit' | 'out' | 'run' | 'substitution' | 'other';
	description: string;
	player: string;
	position?: string;
	svg?: string;
	timestamp?: string;
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

export default function ModernScorecard({ gameData, gameId }: ModernScorecardProps) {
	const [detailedData, setDetailedData] = useState<any>(null);
	const [loading, setLoading] = useState(false);
	const [activeTab, setActiveTab] = useState<'scorecard' | 'traditional' | 'stats' | 'events'>('scorecard');
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
			<div className="bg-white rounded-lg shadow-lg p-6">
				<div className="grid grid-cols-11 gap-2 mb-4">
					{/* Header */}
					<div className="col-span-1 font-bold text-center">Inning</div>
					{Array.from({ length: 9 }, (_, i) => (
						<div key={i} className="font-bold text-center">
							{i + 1}
						</div>
					))}
					<div className="font-bold text-center">R</div>

					{/* Away Team */}
					<div className="col-span-1 font-bold text-right pr-2">{gameData.game_data.away_team.abbreviation}</div>
					{Array.from({ length: 9 }, (_, i) => {
						const inning = innings.find((inn: InningData) => inn.inning === i + 1);
						const runs = inning ? inning.away_runs || inning.away || 0 : 0;
						return (
							<div
								key={i}
								className={`text-center p-2 rounded cursor-pointer transition-colors ${
									selectedInning === i + 1 ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50 hover:bg-gray-100'
								}`}
								onClick={() => setSelectedInning(i + 1)}>
								{runs}
							</div>
						);
					})}
					<div className="font-bold text-center bg-blue-100 p-2 rounded">{awayTotal}</div>

					{/* Home Team */}
					<div className="col-span-1 font-bold text-right pr-2">{gameData.game_data.home_team.abbreviation}</div>
					{Array.from({ length: 9 }, (_, i) => {
						const inning = innings.find((inn: InningData) => inn.inning === i + 1);
						const runs = inning ? inning.home_runs || inning.home || 0 : 0;
						return (
							<div
								key={i}
								className={`text-center p-2 rounded cursor-pointer transition-colors ${
									selectedInning === i + 1 ? 'bg-red-100 border-2 border-red-500' : 'bg-gray-50 hover:bg-gray-100'
								}`}
								onClick={() => setSelectedInning(i + 1)}>
								{runs}
							</div>
						);
					})}
					<div className="font-bold text-center bg-red-100 p-2 rounded">{homeTotal}</div>
				</div>

				{/* Inning Details */}
				{selectedInning && detailedData && (
					<div className="mt-6 p-4 bg-gray-50 rounded-lg">
						<h3 className="font-bold text-lg mb-3">Inning {selectedInning} Details</h3>
						<div className="space-y-2">
							{(() => {
								const inning = detailedData.innings?.find((inn: InningData) => inn.inning === selectedInning);
								if (!inning) return <div className="text-gray-500">No data available for this inning</div>;

								const allEvents = [
									...(inning.top_events || []).map((event: GameEvent) => ({ ...event, half: 'top' })),
									...(inning.bottom_events || []).map((event: GameEvent) => ({ ...event, half: 'bottom' })),
								];

								return allEvents.map((event, index) => {
									const getEventIcon = (summary: string) => {
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

									const getEventColor = (summary: string) => {
										if (summary.includes('Strikeout') || summary.includes('out')) return 'bg-red-500';
										if (
											summary.includes('Single') ||
											summary.includes('Double') ||
											summary.includes('Triple') ||
											summary.includes('Home Run')
										)
											return 'bg-green-500';
										if (summary.includes('Walk') || summary.includes('Hit By Pitch')) return 'bg-blue-500';
										if (summary.includes('Field Error')) return 'bg-yellow-500';
										return 'bg-gray-500';
									};

									return (
										<div key={index} className="flex items-center space-x-4 p-2 bg-white rounded">
											<div
												className={`w-8 h-8 ${getEventColor(
													event.summary
												)} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
												{getEventIcon(event.summary)}
											</div>
											<div className="flex-1">
												<span className="font-medium">{event.summary}</span>
												<span className="text-gray-600 ml-2">- {event.batter}</span>
												<span className="text-gray-500 ml-2">({event.half === 'top' ? 'Top' : 'Bottom'})</span>
											</div>
											<div className="text-sm text-gray-500">
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
			<div className="bg-white rounded-lg shadow-lg p-6">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{/* Away Team Stats */}
					<div>
						<h3 className="font-bold text-lg mb-4 text-blue-600">{gameData.game_data.away_team.name} - Batting</h3>
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b">
										<th className="text-left p-2">Player</th>
										<th className="text-center p-2">AB</th>
										<th className="text-center p-2">H</th>
										<th className="text-center p-2">R</th>
										<th className="text-center p-2">RBI</th>
										<th className="text-center p-2">AVG</th>
									</tr>
								</thead>
								<tbody>
									{awayBatters.length > 0 ? (
										awayBatters.map((batter, index) => (
											<tr key={index} className="border-b">
												<td className="p-2">{batter.name}</td>
												<td className="text-center p-2">{batter.at_bats || 0}</td>
												<td className="text-center p-2">{batter.hits || 0}</td>
												<td className="text-center p-2">{batter.runs || 0}</td>
												<td className="text-center p-2">{batter.rbis || 0}</td>
												<td className="text-center p-2">{batter.average || '.000'}</td>
											</tr>
										))
									) : (
										<tr className="border-b">
											<td className="p-2 text-gray-500" colSpan={6}>
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
						<h3 className="font-bold text-lg mb-4 text-red-600">{gameData.game_data.home_team.name} - Batting</h3>
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b">
										<th className="text-left p-2">Player</th>
										<th className="text-center p-2">AB</th>
										<th className="text-center p-2">H</th>
										<th className="text-center p-2">R</th>
										<th className="text-center p-2">RBI</th>
										<th className="text-center p-2">AVG</th>
									</tr>
								</thead>
								<tbody>
									{homeBatters.length > 0 ? (
										homeBatters.map((batter, index) => (
											<tr key={index} className="border-b">
												<td className="p-2">{batter.name}</td>
												<td className="text-center p-2">{batter.at_bats || 0}</td>
												<td className="text-center p-2">{batter.hits || 0}</td>
												<td className="text-center p-2">{batter.runs || 0}</td>
												<td className="text-center p-2">{batter.rbis || 0}</td>
												<td className="text-center p-2">{batter.average || '.000'}</td>
											</tr>
										))
									) : (
										<tr className="border-b">
											<td className="p-2 text-gray-500" colSpan={6}>
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
					<h3 className="font-bold text-lg mb-4">Pitching</h3>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div>
							<h4 className="font-semibold mb-2 text-blue-600">{gameData.game_data.away_team.name} Pitchers</h4>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b">
											<th className="text-left p-2">Pitcher</th>
											<th className="text-center p-2">IP</th>
											<th className="text-center p-2">H</th>
											<th className="text-center p-2">R</th>
											<th className="text-center p-2">ER</th>
											<th className="text-center p-2">BB</th>
											<th className="text-center p-2">K</th>
										</tr>
									</thead>
									<tbody>
										{awayPitchers.length > 0 ? (
											awayPitchers.map((pitcher, index) => (
												<tr key={index} className="border-b">
													<td className="p-2">{pitcher.name}</td>
													<td className="text-center p-2">{pitcher.innings_pitched || '0.0'}</td>
													<td className="text-center p-2">{pitcher.hits || 0}</td>
													<td className="text-center p-2">{pitcher.runs || 0}</td>
													<td className="text-center p-2">{pitcher.earned_runs || 0}</td>
													<td className="text-center p-2">{pitcher.walks || 0}</td>
													<td className="text-center p-2">{pitcher.strikeouts || 0}</td>
												</tr>
											))
										) : (
											<tr className="border-b">
												<td className="p-2 text-gray-500" colSpan={7}>
													No pitching data available
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
						</div>

						<div>
							<h4 className="font-semibold mb-2 text-red-600">{gameData.game_data.home_team.name} Pitchers</h4>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b">
											<th className="text-left p-2">Pitcher</th>
											<th className="text-center p-2">IP</th>
											<th className="text-center p-2">H</th>
											<th className="text-center p-2">R</th>
											<th className="text-center p-2">ER</th>
											<th className="text-center p-2">BB</th>
											<th className="text-center p-2">K</th>
										</tr>
									</thead>
									<tbody>
										{homePitchers.length > 0 ? (
											homePitchers.map((pitcher, index) => (
												<tr key={index} className="border-b">
													<td className="p-2">{pitcher.name}</td>
													<td className="text-center p-2">{pitcher.innings_pitched || '0.0'}</td>
													<td className="text-center p-2">{pitcher.hits || 0}</td>
													<td className="text-center p-2">{pitcher.runs || 0}</td>
													<td className="text-center p-2">{pitcher.earned_runs || 0}</td>
													<td className="text-center p-2">{pitcher.walks || 0}</td>
													<td className="text-center p-2">{pitcher.strikeouts || 0}</td>
												</tr>
											))
										) : (
											<tr className="border-b">
												<td className="p-2 text-gray-500" colSpan={7}>
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
				<div className="bg-white rounded-lg shadow-lg p-6">
					<h3 className="font-bold text-lg mb-4">Game Events</h3>
					<div className="text-gray-500">No event data available</div>
				</div>
			);
		}

		// Flatten all events from all innings
		const allEvents = [];
		detailedData.innings.forEach((inning) => {
			if (inning.top_events) {
				inning.top_events.forEach((event) => {
					allEvents.push({
						...event,
						inning: inning.inning,
						half: 'top',
					});
				});
			}
			if (inning.bottom_events) {
				inning.bottom_events.forEach((event) => {
					allEvents.push({
						...event,
						inning: inning.inning,
						half: 'bottom',
					});
				});
			}
		});

		return (
			<div className="bg-white rounded-lg shadow-lg p-6">
				<h3 className="font-bold text-lg mb-4">Game Events</h3>
				<div className="space-y-3 max-h-96 overflow-y-auto">
					{allEvents.map((event, index) => {
						const getEventColor = (summary: string) => {
							if (summary.includes('Strikeout') || summary.includes('out')) return 'bg-red-500';
							if (
								summary.includes('Single') ||
								summary.includes('Double') ||
								summary.includes('Triple') ||
								summary.includes('Home Run')
							)
								return 'bg-green-500';
							if (summary.includes('Walk') || summary.includes('Hit By Pitch')) return 'bg-blue-500';
							if (summary.includes('Field Error')) return 'bg-yellow-500';
							return 'bg-gray-500';
						};

						return (
							<div key={index} className="p-4 bg-gray-50 rounded-lg border">
								<div className="flex items-center space-x-4 mb-2">
									<div
										className={`w-10 h-10 ${getEventColor(
											event.summary
										)} rounded-full flex items-center justify-center text-white font-bold`}>
										{index + 1}
									</div>
									<div className="flex-1">
										<div className="font-medium">
											{event.half === 'top' ? 'Top' : 'Bottom'} {event.inning}
											{event.inning === 1 ? 'st' : event.inning === 2 ? 'nd' : event.inning === 3 ? 'rd' : 'th'}
										</div>
										<div className="text-sm text-gray-600">
											{event.batter} vs {event.pitcher}
										</div>
									</div>
									<div className="text-sm text-gray-500">
										{event.outs} out{event.outs !== 1 ? 's' : ''}
									</div>
								</div>

								<div className="ml-14">
									<div className="text-sm font-medium mb-1">
										{event.summary} - {event.description}
									</div>

									{event.events && event.events.length > 0 && (
										<div className="mt-2">
											<div className="text-xs text-gray-500 mb-1">Pitch Sequence:</div>
											<div className="flex flex-wrap gap-1">
												{event.events.map((pitch, pitchIndex) => (
													<span
														key={pitchIndex}
														className="px-2 py-1 bg-white rounded text-xs border"
														title={`${pitch.type}: ${pitch.description}${pitch.speed ? ` (${pitch.speed} mph)` : ''}`}>
														{pitch.type}
													</span>
												))}
											</div>
										</div>
									)}

									{(event.runs_scored > 0 || event.rbis > 0) && (
										<div className="mt-1 text-xs text-green-600">
											{event.runs_scored > 0 && `Runs: ${event.runs_scored} `}
											{event.rbis > 0 && `RBIs: ${event.rbis}`}
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
		<div className="max-w-7xl mx-auto p-6">
			{/* Header */}
			<div className="mb-6">
				<h1 className="text-3xl font-bold text-gray-900 mb-2">
					{gameData.game_data.away_team.name} vs {gameData.game_data.home_team.name}
				</h1>
				<div className="flex items-center space-x-4 text-gray-600">
					<span>{gameData.game_data.game_date_str}</span>
					<span>•</span>
					<span>{gameData.game_data.location}</span>
					<span>•</span>
					<span className="font-semibold">
						Final: {gameData.game_data.away_team.abbreviation}{' '}
						{detailedData?.total_away_runs ||
							gameData.game_data.inning_list.reduce((sum, inning) => sum + inning.away, 0)}{' '}
						- {gameData.game_data.home_team.abbreviation}{' '}
						{detailedData?.total_home_runs ||
							gameData.game_data.inning_list.reduce((sum, inning) => sum + inning.home, 0)}
					</span>
				</div>
			</div>

			{/* Tabs */}
			<div className="mb-6">
				<div className="border-b border-gray-200">
					<nav className="-mb-px flex space-x-8">
						{[
							{ id: 'scorecard', label: 'Modern Scorecard' },
							{ id: 'traditional', label: 'Traditional Scorecard' },
							{ id: 'stats', label: 'Statistics' },
							{ id: 'events', label: 'Events' },
						].map((tab) => (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id as any)}
								className={`py-2 px-1 border-b-2 font-medium text-sm ${
									activeTab === tab.id
										? 'border-blue-500 text-blue-600'
										: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
								}`}>
								{tab.label}
							</button>
						))}
					</nav>
				</div>
			</div>

			{/* Content */}
			{loading && (
				<div className="flex justify-center items-center py-12">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
				</div>
			)}

			{!loading && (
				<>
					{activeTab === 'scorecard' && renderInningScorecard()}
					{activeTab === 'traditional' && <TraditionalScorecard gameData={gameData} gameId={gameId} />}
					{activeTab === 'stats' && renderStats()}
					{activeTab === 'events' && renderEvents()}
				</>
			)}

			{/* Integration Note */}
			<div className="mt-8 p-4 bg-blue-50 rounded-lg">
				<h3 className="font-semibold text-blue-900 mb-2">Integration Status</h3>
				<p className="text-blue-800 text-sm">
					This is a modern componentized scorecard interface. The next step is to integrate with your existing Baseball
					library to populate the detailed game data, events, and statistics. The structure is ready to receive and
					display:
				</p>
				<ul className="text-blue-800 text-sm mt-2 list-disc list-inside">
					<li>Detailed inning-by-inning events</li>
					<li>Individual player statistics</li>
					<li>Pitching and batting lineups</li>
					<li>Game events with inline SVG representations</li>
				</ul>
			</div>
		</div>
	);
}
