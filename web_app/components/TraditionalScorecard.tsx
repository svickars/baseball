'use client';

import React, { useState, useEffect } from 'react';
import { GameData } from '@/types';

interface TraditionalScorecardProps {
	gameData: GameData;
	gameId: string;
}

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
	scorecard_summary?: string;
	got_on_base: boolean;
	runs_scored: number;
	rbis: number;
	outs: number;
	half: string;
	hit_location?: string;
	error_str?: string;
	start_datetime?: string;
	end_datetime?: string;
	events: PitchEvent[];
	scoring_runners?: string[];
	runners_batted_in?: string[];
	out_runners?: any[];
}

interface PitchEvent {
	type: string;
	description: string;
	result: string;
	speed?: number;
	location?: number[];
	datetime?: string;
}

interface BatterData {
	name: string;
	at_bats: number;
	hits: number;
	runs: number;
	rbis: number;
	average: string;
	position: string;
	lineup_order: number;
}

interface PitcherData {
	name: string;
	innings_pitched: number;
	hits: number;
	runs: number;
	earned_runs: number;
	walks: number;
	strikeouts: number;
	era: string;
}

interface GameEvent {
	id: string;
	inning: number;
	half: string;
	description: string;
	player: string;
	type: string;
}

export default function TraditionalScorecard({ gameData, gameId }: TraditionalScorecardProps) {
	const [detailedData, setDetailedData] = useState<DetailedGameData | null>(null);
	const [loading, setLoading] = useState(false);
	const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

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

	const renderScorecardGrid = () => {
		if (!detailedData) return null;

		const maxInnings = Math.max(...detailedData.innings.map((i) => i.inning), 9);
		const allBatters = [...detailedData.batters.away, ...detailedData.batters.home];

		return (
			<div className="bg-white rounded-lg shadow-lg p-6 overflow-x-auto">
				{/* Header */}
				<div className="mb-4">
					<h2 className="text-2xl font-bold text-center mb-2">
						{detailedData.away_team.name} vs {detailedData.home_team.name}
					</h2>
					<div className="text-center text-gray-600">
						{detailedData.date} • {detailedData.venue}
					</div>
				</div>

				{/* Scorecard Grid */}
				<div className="border-2 border-gray-800">
					{/* Inning Headers */}
					<div className="grid grid-cols-12 gap-0 border-b-2 border-gray-800">
						<div className="col-span-2 p-2 bg-gray-100 font-bold text-center border-r border-gray-400">Player</div>
						{Array.from({ length: maxInnings }, (_, i) => (
							<div key={i} className="p-2 bg-gray-100 font-bold text-center border-r border-gray-400">
								{i + 1}
							</div>
						))}
						<div className="p-2 bg-gray-100 font-bold text-center">R</div>
						<div className="p-2 bg-gray-100 font-bold text-center">H</div>
						<div className="p-2 bg-gray-100 font-bold text-center">RBI</div>
					</div>

					{/* Away Team Batters */}
					<div className="border-b-2 border-gray-800">
						<div className="p-2 bg-blue-50 font-bold text-center border-b border-gray-400">
							{detailedData.away_team.name} ({detailedData.away_team.abbreviation})
						</div>
						{detailedData.batters.away.map((batter, index) => (
							<div key={index} className="grid grid-cols-12 gap-0 border-b border-gray-300">
								<div className="col-span-2 p-2 border-r border-gray-400">
									<div className="font-medium">{batter.name}</div>
									<div className="text-xs text-gray-600">{batter.position}</div>
								</div>
								{Array.from({ length: maxInnings }, (_, i) => (
									<div key={i} className="p-2 border-r border-gray-400 text-center">
										{renderAtBatResult(batter, i + 1)}
									</div>
								))}
								<div className="p-2 border-r border-gray-400 text-center font-bold">{batter.runs}</div>
								<div className="p-2 border-r border-gray-400 text-center font-bold">{batter.hits}</div>
								<div className="p-2 text-center font-bold">{batter.rbis}</div>
							</div>
						))}
					</div>

					{/* Home Team Batters */}
					<div>
						<div className="p-2 bg-red-50 font-bold text-center border-b border-gray-400">
							{detailedData.home_team.name} ({detailedData.home_team.abbreviation})
						</div>
						{detailedData.batters.home.map((batter, index) => (
							<div key={index} className="grid grid-cols-12 gap-0 border-b border-gray-300">
								<div className="col-span-2 p-2 border-r border-gray-400">
									<div className="font-medium">{batter.name}</div>
									<div className="text-xs text-gray-600">{batter.position}</div>
								</div>
								{Array.from({ length: maxInnings }, (_, i) => (
									<div key={i} className="p-2 border-r border-gray-400 text-center">
										{renderAtBatResult(batter, i + 1)}
									</div>
								))}
								<div className="p-2 border-r border-gray-400 text-center font-bold">{batter.runs}</div>
								<div className="p-2 border-r border-gray-400 text-center font-bold">{batter.hits}</div>
								<div className="p-2 text-center font-bold">{batter.rbis}</div>
							</div>
						))}
					</div>
				</div>

				{/* Inning Totals */}
				<div className="mt-4 grid grid-cols-12 gap-0 border-2 border-gray-800">
					<div className="col-span-2 p-2 bg-gray-100 font-bold text-center border-r border-gray-400">Runs</div>
					{Array.from({ length: maxInnings }, (_, i) => (
						<div key={i} className="p-2 bg-gray-100 font-bold text-center border-r border-gray-400">
							{detailedData.innings[i]?.away_runs || 0} - {detailedData.innings[i]?.home_runs || 0}
						</div>
					))}
					<div className="p-2 bg-gray-100 font-bold text-center">
						{detailedData.innings.reduce((sum, inning) => sum + inning.away_runs, 0)} -{' '}
						{detailedData.innings.reduce((sum, inning) => sum + inning.home_runs, 0)}
					</div>
				</div>
			</div>
		);
	};

	const renderAtBatResult = (batter: BatterData, inning: number) => {
		// Find the plate appearance for this batter in this inning
		const inningData = detailedData?.innings.find((i) => i.inning === inning);
		if (!inningData) return '';

		const plateAppearance = [...inningData.top_events, ...inningData.bottom_events].find(
			(pa) => pa.batter === batter.name
		);

		if (!plateAppearance) return '';

		// Render the result with appropriate styling
		const result = plateAppearance.summary || plateAppearance.description;

		return (
			<div
				className="cursor-pointer hover:bg-gray-100 p-1 rounded"
				onClick={() => setSelectedPlayer(`${batter.name}-${inning}`)}
				title={`Click for details: ${plateAppearance.description}`}>
				{result}
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
			<div className="mt-6 bg-gray-50 rounded-lg p-4">
				<h3 className="font-bold text-lg mb-3">
					{playerName} - Inning {inningNum} Details
				</h3>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<h4 className="font-semibold mb-2">At-Bat Summary</h4>
						<div className="bg-white p-3 rounded border">
							<div className="grid grid-cols-2 gap-2 text-sm">
								<div>
									<strong>Batter:</strong> {plateAppearance.batter}
									{plateAppearance.batter_number && (
										<span className="ml-1 text-gray-500">#{plateAppearance.batter_number}</span>
									)}
								</div>
								<div>
									<strong>Pitcher:</strong> {plateAppearance.pitcher}
									{plateAppearance.pitcher_number && (
										<span className="ml-1 text-gray-500">#{plateAppearance.pitcher_number}</span>
									)}
								</div>
								<div className="col-span-2">
									<strong>Result:</strong> {plateAppearance.description}
								</div>
								<div>
									<strong>Summary:</strong> {plateAppearance.summary}
								</div>
								<div>
									<strong>Scorecard:</strong> {plateAppearance.scorecard_summary || 'N/A'}
								</div>
								<div>
									<strong>Runs Scored:</strong> {plateAppearance.runs_scored}
								</div>
								<div>
									<strong>RBIs:</strong> {plateAppearance.rbis}
								</div>
								<div>
									<strong>Outs:</strong> {plateAppearance.outs}
								</div>
								<div>
									<strong>Got on Base:</strong> {plateAppearance.got_on_base ? 'Yes' : 'No'}
								</div>
								{plateAppearance.hit_location && (
									<div>
										<strong>Hit Location:</strong> {plateAppearance.hit_location}
									</div>
								)}
								{plateAppearance.error_str && (
									<div className="col-span-2">
										<strong>Error:</strong> {plateAppearance.error_str}
									</div>
								)}
							</div>
						</div>
					</div>

					<div>
						<h4 className="font-semibold mb-2">Pitch Sequence</h4>
						<div className="bg-white p-3 rounded border">
							{plateAppearance.events.length > 0 ? (
								<div className="space-y-2">
									{plateAppearance.events.map((pitch, index) => (
										<div key={index} className="p-3 bg-gray-50 rounded border">
											<div className="flex justify-between items-start mb-2">
												<div className="flex items-center space-x-3">
													<span className="font-bold text-lg bg-blue-100 px-2 py-1 rounded">{pitch.type}</span>
													<span className="text-sm text-gray-600">{pitch.description}</span>
												</div>
												<span className="text-sm font-bold text-green-600">{pitch.result}</span>
											</div>
											{pitch.speed && (
												<div className="text-xs text-gray-500">
													Speed: {pitch.speed} mph
													{pitch.location && (
														<span className="ml-2">
															Location: [{pitch.location[0]?.toFixed(1)}, {pitch.location[1]?.toFixed(1)}]
														</span>
													)}
												</div>
											)}
										</div>
									))}
								</div>
							) : (
								<div className="text-gray-500 text-sm">No pitch details available</div>
							)}
						</div>
					</div>
				</div>

				<button
					onClick={() => setSelectedPlayer(null)}
					className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
					Close Details
				</button>
			</div>
		);
	};

	if (loading) {
		return (
			<div className="flex justify-center items-center py-12">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
			</div>
		);
	}

	return (
		<div className="max-w-7xl mx-auto p-6">
			{/* Header */}
			<div className="mb-6">
				<h1 className="text-3xl font-bold text-gray-900 mb-2">Traditional Scorecard</h1>
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

			{/* Traditional Scorecard Grid */}
			{renderScorecardGrid()}

			{/* Pitch Details */}
			{renderPitchDetails()}

			{/* Integration Status */}
			<div className="mt-8 p-4 bg-blue-50 rounded-lg">
				<h3 className="font-semibold text-blue-900 mb-2">Traditional Scorecard Features</h3>
				<ul className="text-blue-800 text-sm list-disc list-inside">
					<li>Traditional hand-done scorecard layout with innings as columns and players as rows</li>
					<li>Click on any at-bat result to see detailed pitch sequence</li>
					<li>Real-time integration with Baseball library for detailed game data</li>
					<li>Pitch-by-pitch breakdown with locations, speeds, and results</li>
					<li>Complete batting and pitching statistics</li>
				</ul>
			</div>
		</div>
	);
}
