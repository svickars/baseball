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
					{gameData.game_data.inning_list.map((inning, index) => (
						<div
							key={index}
							className={`text-center p-2 rounded cursor-pointer transition-colors ${
								selectedInning === inning.inning
									? 'bg-blue-100 border-2 border-blue-500'
									: 'bg-gray-50 hover:bg-gray-100'
							}`}
							onClick={() => setSelectedInning(inning.inning)}>
							{inning.away}
						</div>
					))}
					<div className="font-bold text-center bg-blue-100 p-2 rounded">
						{gameData.game_data.inning_list.reduce((sum, inning) => sum + inning.away, 0)}
					</div>

					{/* Home Team */}
					<div className="col-span-1 font-bold text-right pr-2">{gameData.game_data.home_team.abbreviation}</div>
					{gameData.game_data.inning_list.map((inning, index) => (
						<div
							key={index}
							className={`text-center p-2 rounded cursor-pointer transition-colors ${
								selectedInning === inning.inning ? 'bg-red-100 border-2 border-red-500' : 'bg-gray-50 hover:bg-gray-100'
							}`}
							onClick={() => setSelectedInning(inning.inning)}>
							{inning.home}
						</div>
					))}
					<div className="font-bold text-center bg-red-100 p-2 rounded">
						{gameData.game_data.inning_list.reduce((sum, inning) => sum + inning.home, 0)}
					</div>
				</div>

				{/* Inning Details */}
				{selectedInning && (
					<div className="mt-6 p-4 bg-gray-50 rounded-lg">
						<h3 className="font-bold text-lg mb-3">Inning {selectedInning} Details</h3>
						<div className="space-y-2">
							{/* This would be populated with actual event data */}
							<div className="flex items-center space-x-4 p-2 bg-white rounded">
								<div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
									K
								</div>
								<div className="flex-1">
									<span className="font-medium">Strikeout</span>
									<span className="text-gray-600 ml-2">- Player Name</span>
								</div>
								<div className="text-sm text-gray-500">1 out</div>
							</div>

							<div className="flex items-center space-x-4 p-2 bg-white rounded">
								<div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
									1B
								</div>
								<div className="flex-1">
									<span className="font-medium">Single</span>
									<span className="text-gray-600 ml-2">- Player Name</span>
								</div>
								<div className="text-sm text-gray-500">Runner on 1st</div>
							</div>
						</div>
					</div>
				)}
			</div>
		);
	};

	const renderStats = () => {
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
									{/* This would be populated with actual batter data */}
									<tr className="border-b">
										<td className="p-2">Player Name</td>
										<td className="text-center p-2">4</td>
										<td className="text-center p-2">2</td>
										<td className="text-center p-2">1</td>
										<td className="text-center p-2">2</td>
										<td className="text-center p-2">.500</td>
									</tr>
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
									{/* This would be populated with actual batter data */}
									<tr className="border-b">
										<td className="p-2">Player Name</td>
										<td className="text-center p-2">4</td>
										<td className="text-center p-2">1</td>
										<td className="text-center p-2">0</td>
										<td className="text-center p-2">0</td>
										<td className="text-center p-2">.250</td>
									</tr>
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
										{/* This would be populated with actual pitcher data */}
										<tr className="border-b">
											<td className="p-2">Pitcher Name</td>
											<td className="text-center p-2">6.0</td>
											<td className="text-center p-2">5</td>
											<td className="text-center p-2">3</td>
											<td className="text-center p-2">3</td>
											<td className="text-center p-2">2</td>
											<td className="text-center p-2">7</td>
										</tr>
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
										{/* This would be populated with actual pitcher data */}
										<tr className="border-b">
											<td className="p-2">Pitcher Name</td>
											<td className="text-center p-2">7.0</td>
											<td className="text-center p-2">4</td>
											<td className="text-center p-2">2</td>
											<td className="text-center p-2">2</td>
											<td className="text-center p-2">1</td>
											<td className="text-center p-2">8</td>
										</tr>
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
		return (
			<div className="bg-white rounded-lg shadow-lg p-6">
				<h3 className="font-bold text-lg mb-4">Game Events</h3>
				<div className="space-y-3">
					{/* This would be populated with actual event data */}
					<div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
						<div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
							1
						</div>
						<div className="flex-1">
							<div className="font-medium">Top 1st</div>
							<div className="text-sm text-gray-600">Strikeout - Player Name</div>
						</div>
						<div className="text-sm text-gray-500">1 out</div>
					</div>

					<div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
						<div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
							2
						</div>
						<div className="flex-1">
							<div className="font-medium">Top 1st</div>
							<div className="text-sm text-gray-600">Single - Player Name</div>
						</div>
						<div className="text-sm text-gray-500">Runner on 1st</div>
					</div>
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
						{gameData.game_data.inning_list.reduce((sum, inning) => sum + inning.away, 0)} -{' '}
						{gameData.game_data.home_team.abbreviation}{' '}
						{gameData.game_data.inning_list.reduce((sum, inning) => sum + inning.home, 0)}
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
