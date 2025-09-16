'use client';

import React, { useState, useEffect } from 'react';
import { GameData } from '@/types';
import LoadingSpinner from './LoadingSpinner';

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
			<div className="overflow-x-auto">
				{/* Scorecard Grid */}
				<div className="border-t border-b border-primary-300 dark:border-primary-800">
					{/* Inning Headers */}
					<div className="grid grid-cols-12 gap-0 border-b-2 border-primary-800 dark:border-primary-200">
						<div className="col-span-2 p-2 bg-primary-100 dark:bg-primary-700 font-bold text-center border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
							Player
						</div>
						{Array.from({ length: maxInnings }, (_, i) => (
							<div
								key={i}
								className="p-2 bg-primary-100 dark:bg-primary-700 font-bold text-center border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
								{i + 1}
							</div>
						))}
						<div className="p-2 bg-primary-100 dark:bg-primary-700 font-bold text-center text-primary-900 dark:text-primary-100">
							R
						</div>
						<div className="p-2 bg-primary-100 dark:bg-primary-700 font-bold text-center text-primary-900 dark:text-primary-100">
							H
						</div>
						<div className="p-2 bg-primary-100 dark:bg-primary-700 font-bold text-center text-primary-900 dark:text-primary-100">
							RBI
						</div>
					</div>

					{/* Away Team Batters */}
					<div className="border-b-2 border-primary-800 dark:border-primary-200">
						<div className="p-2 bg-accent-50 dark:bg-accent-900 font-bold text-center border-b border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
							{detailedData.away_team.name} ({detailedData.away_team.abbreviation})
						</div>
						{detailedData.batters.away.map((batter, index) => (
							<div key={index} className="grid grid-cols-12 gap-0 border-b border-primary-300 dark:border-primary-600">
								<div className="col-span-2 p-2 border-r border-primary-400 dark:border-primary-600">
									<div className="font-medium text-primary-900 dark:text-primary-100">{batter.name}</div>
									<div className="text-xs text-primary-600 dark:text-primary-400">{batter.position}</div>
								</div>
								{Array.from({ length: maxInnings }, (_, i) => (
									<div key={i} className="p-2 border-r border-primary-400 dark:border-primary-600 text-center">
										{renderAtBatResult(batter, i + 1)}
									</div>
								))}
								<div className="p-2 border-r border-primary-400 dark:border-primary-600 text-center font-bold text-primary-900 dark:text-primary-100">
									{batter.runs}
								</div>
								<div className="p-2 border-r border-primary-400 dark:border-primary-600 text-center font-bold text-primary-900 dark:text-primary-100">
									{batter.hits}
								</div>
								<div className="p-2 text-center font-bold text-primary-900 dark:text-primary-100">{batter.rbis}</div>
							</div>
						))}
					</div>

					{/* Home Team Batters */}
					<div>
						<div className="p-2 bg-warning-50 dark:bg-warning-900 font-bold text-center border-b border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
							{detailedData.home_team.name} ({detailedData.home_team.abbreviation})
						</div>
						{detailedData.batters.home.map((batter, index) => (
							<div key={index} className="grid grid-cols-12 gap-0 border-b border-primary-300 dark:border-primary-600">
								<div className="col-span-2 p-2 border-r border-primary-400 dark:border-primary-600">
									<div className="font-medium text-primary-900 dark:text-primary-100">{batter.name}</div>
									<div className="text-xs text-primary-600 dark:text-primary-400">{batter.position}</div>
								</div>
								{Array.from({ length: maxInnings }, (_, i) => (
									<div key={i} className="p-2 border-r border-primary-400 dark:border-primary-600 text-center">
										{renderAtBatResult(batter, i + 1)}
									</div>
								))}
								<div className="p-2 border-r border-primary-400 dark:border-primary-600 text-center font-bold text-primary-900 dark:text-primary-100">
									{batter.runs}
								</div>
								<div className="p-2 border-r border-primary-400 dark:border-primary-600 text-center font-bold text-primary-900 dark:text-primary-100">
									{batter.hits}
								</div>
								<div className="p-2 text-center font-bold text-primary-900 dark:text-primary-100">{batter.rbis}</div>
							</div>
						))}
					</div>
				</div>

				{/* Inning Totals */}
				<div className="mt-4 grid grid-cols-12 gap-0 border-2 border-primary-800 dark:border-primary-200">
					<div className="col-span-2 p-2 bg-primary-100 dark:bg-primary-700 font-bold text-center border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
						Runs
					</div>
					{Array.from({ length: maxInnings }, (_, i) => (
						<div
							key={i}
							className="p-2 bg-primary-100 dark:bg-primary-700 font-bold text-center border-r border-primary-400 dark:border-primary-600 text-primary-900 dark:text-primary-100">
							{detailedData.innings[i]?.away_runs || 0} - {detailedData.innings[i]?.home_runs || 0}
						</div>
					))}
					<div className="p-2 bg-primary-100 dark:bg-primary-700 font-bold text-center text-primary-900 dark:text-primary-100">
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
				className="cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-700 p-1 rounded text-primary-900 dark:text-primary-100"
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
			<div className="mt-6 bg-primary-50 dark:bg-primary-700 rounded-lg p-4">
				<h3 className="font-bold text-lg mb-3 text-primary-900 dark:text-primary-100">
					{playerName} - Inning {inningNum} Details
				</h3>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<h4 className="font-semibold mb-2 text-primary-900 dark:text-primary-100">At-Bat Summary</h4>
						<div className="bg-white dark:bg-primary-800 p-3 rounded border border-primary-200 dark:border-primary-600">
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
									<strong>Result:</strong> {plateAppearance.description}
								</div>
								<div className="text-primary-900 dark:text-primary-100">
									<strong>Summary:</strong> {plateAppearance.summary}
								</div>
								<div className="text-primary-900 dark:text-primary-100">
									<strong>Scorecard:</strong> {plateAppearance.scorecard_summary || 'N/A'}
								</div>
								<div className="text-primary-900 dark:text-primary-100">
									<strong>Runs Scored:</strong> {plateAppearance.runs_scored}
								</div>
								<div className="text-primary-900 dark:text-primary-100">
									<strong>RBIs:</strong> {plateAppearance.rbis}
								</div>
								<div className="text-primary-900 dark:text-primary-100">
									<strong>Outs:</strong> {plateAppearance.outs}
								</div>
								<div className="text-primary-900 dark:text-primary-100">
									<strong>Got on Base:</strong> {plateAppearance.got_on_base ? 'Yes' : 'No'}
								</div>
								{plateAppearance.hit_location && (
									<div className="text-primary-900 dark:text-primary-100">
										<strong>Hit Location:</strong> {plateAppearance.hit_location}
									</div>
								)}
								{plateAppearance.error_str && (
									<div className="col-span-2 text-primary-900 dark:text-primary-100">
										<strong>Error:</strong> {plateAppearance.error_str}
									</div>
								)}
							</div>
						</div>
					</div>

					<div>
						<h4 className="font-semibold mb-2 text-primary-900 dark:text-primary-100">Pitch Sequence</h4>
						<div className="bg-white dark:bg-primary-800 p-3 rounded border border-primary-200 dark:border-primary-600">
							{plateAppearance.events.length > 0 ? (
								<div className="space-y-2">
									{plateAppearance.events.map((pitch, index) => (
										<div
											key={index}
											className="p-3 bg-primary-50 dark:bg-primary-700 rounded border border-primary-200 dark:border-primary-600">
											<div className="flex justify-between items-start mb-2">
												<div className="flex items-center space-x-3">
													<span className="font-bold text-lg bg-accent-100 dark:bg-accent-800 px-2 py-1 rounded text-primary-900 dark:text-primary-100">
														{pitch.type}
													</span>
													<span className="text-sm text-primary-600 dark:text-primary-400">{pitch.description}</span>
												</div>
												<span className="text-sm font-bold text-success-600 dark:text-success-400">{pitch.result}</span>
											</div>
											{pitch.speed && (
												<div className="text-xs text-primary-500 dark:text-primary-400">
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
								<div className="text-primary-500 dark:text-primary-400 text-sm">No pitch details available</div>
							)}
						</div>
					</div>
				</div>

				<button
					onClick={() => setSelectedPlayer(null)}
					className="mt-4 px-4 py-2 bg-primary-600 dark:bg-primary-700 text-white rounded hover:bg-primary-700 dark:hover:bg-primary-800">
					Close Details
				</button>
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
}
