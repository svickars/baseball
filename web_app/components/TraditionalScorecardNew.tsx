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
}

interface GameEvent {
	inning: number;
	half_inning: 'top' | 'bottom';
	event_type: string;
	description: string;
	batter: string;
	pitcher: string;
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
			if (response.ok) {
				const data = await response.json();
				setDetailedData(data);
			}
		} catch (error) {
			console.error('Error fetching detailed data:', error);
		} finally {
			setLoading(false);
		}
	};

	const renderScorecardGrid = () => {
		if (!detailedData) return null;

		const maxInnings = Math.max(...detailedData.innings.map((i) => i.inning), 9);

		return (
			<div className="overflow-x-auto min-w-[1152px]">
				{/* TOP Scorecard (Away Team) */}
				<div className="border-b border-primary-300 dark:border-primary-800 mb-4">
					{/* TOP Header Fields */}
					<div className="grid grid-cols-8 gap-0 border-b border-primary-300 dark:border-primary-800">
						{/* Logo Field */}
						<div className="col-span-1 border-r border-primary-300 dark:border-primary-800 relative">
							<div className="h-16 flex items-center justify-center">
								<span className="text-xs uppercase text-primary-500 dark:text-primary-400 absolute top-1 right-1">
									LOGO
								</span>
							</div>
						</div>

						{/* Top Row Fields */}
						<div className="col-span-2 border-r border-primary-300 dark:border-primary-800 relative">
							<div className="h-8 flex items-center px-2">
								<span className="text-xs uppercase text-primary-500 dark:text-primary-400 absolute top-1 right-1">
									AWAY TEAM
								</span>
								<span className="font-medium text-primary-900 dark:text-primary-100">
									{detailedData.away_team.name}
								</span>
							</div>
						</div>
						<div className="col-span-1 border-r border-primary-300 dark:border-primary-800 relative">
							<div className="h-8 flex items-center px-2">
								<span className="text-xs uppercase text-primary-500 dark:text-primary-400 absolute top-1 right-1">
									HP UMP
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">TBD</span>
							</div>
						</div>
						<div className="col-span-1 border-r border-primary-300 dark:border-primary-800 relative">
							<div className="h-8 flex items-center px-2">
								<span className="text-xs uppercase text-primary-500 dark:text-primary-400 absolute top-1 right-1">
									1B UMP
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">TBD</span>
							</div>
						</div>
						<div className="col-span-1 border-r border-primary-300 dark:border-primary-800 relative">
							<div className="h-8 flex items-center px-2">
								<span className="text-xs uppercase text-primary-500 dark:text-primary-400 absolute top-1 right-1">
									2B UMP
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">TBD</span>
							</div>
						</div>
						<div className="col-span-1 border-r border-primary-300 dark:border-primary-800 relative">
							<div className="h-8 flex items-center px-2">
								<span className="text-xs uppercase text-primary-500 dark:text-primary-400 absolute top-1 right-1">
									3B UMP
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">TBD</span>
							</div>
						</div>
						<div className="col-span-1 relative">
							<div className="h-8 flex items-center px-2">
								<span className="text-xs uppercase text-primary-500 dark:text-primary-400 absolute top-1 right-1">
									MANAGER
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">TBD</span>
							</div>
						</div>
					</div>

					{/* Second Row Fields */}
					<div className="grid grid-cols-8 gap-0 border-b border-primary-300 dark:border-primary-800">
						<div className="col-span-1 border-r border-primary-300 dark:border-primary-800"></div>
						<div className="col-span-1 border-r border-primary-300 dark:border-primary-800 relative">
							<div className="h-8 flex items-center px-2">
								<span className="text-xs uppercase text-primary-500 dark:text-primary-400 absolute top-1 right-1">
									UNIFORMS
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">TBD</span>
							</div>
						</div>
						<div className="col-span-6"></div>
					</div>

					{/* TOP Label */}
					<div className="flex items-center border-b border-primary-300 dark:border-primary-800">
						<div className="w-16 h-12 flex items-center justify-center border-r border-primary-300 dark:border-primary-800">
							<span className="text-2xl font-bold text-primary-900 dark:text-primary-100">TOP</span>
						</div>
						<div className="flex-1"></div>
					</div>

					{/* Column Headers */}
					<div
						className="grid gap-0 border-b border-primary-300 dark:border-primary-800"
						style={{
							gridTemplateColumns:
								'60px 1fr 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px',
						}}>
						<div className="border-r border-primary-200 dark:border-primary-700 h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
							#
						</div>
						<div className="border-r border-primary-300 dark:border-primary-800 h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
							PLAYER
						</div>
						<div className="border-r border-primary-200 dark:border-primary-700 h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
							POS
						</div>
						{Array.from({ length: maxInnings }, (_, i) => (
							<div
								key={i}
								className="border-r border-primary-200 dark:border-primary-700 h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
								{i + 1}
							</div>
						))}
						<div className="border-l border-primary-300 dark:border-primary-800 border-r border-primary-200 dark:border-primary-700 h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
							AB
						</div>
						<div className="border-r border-primary-200 dark:border-primary-700 h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
							H
						</div>
						<div className="border-r border-primary-200 dark:border-primary-700 h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
							R
						</div>
						<div className="border-r border-primary-200 dark:border-primary-700 h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
							RBI
						</div>
						<div className="border-r border-primary-200 dark:border-primary-700 h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
							BB
						</div>
						<div className="h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
							SO
						</div>
					</div>

					{/* Away Team Batters */}
					{detailedData.batters.away.map((batter, index) => (
						<div
							key={index}
							className="grid gap-0 border-b border-primary-200 dark:border-primary-700"
							style={{
								gridTemplateColumns:
									'60px 1fr 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px',
							}}>
							{/* Player Number */}
							<div className="border-r border-primary-200 dark:border-primary-700 h-12 flex items-center justify-center text-sm font-medium text-primary-900 dark:text-primary-100">
								{batter.number || index + 1}
							</div>

							{/* Player Name */}
							<div className="border-r border-primary-300 dark:border-primary-800 h-12 flex items-center px-2">
								<div className="bg-primary-50 dark:bg-primary-800 w-full h-full flex items-center px-2">
									<span className="text-sm font-medium text-primary-900 dark:text-primary-100">{batter.name}</span>
								</div>
							</div>

							{/* Position */}
							<div className="border-r border-primary-200 dark:border-primary-700 h-12 flex items-center justify-center text-sm font-medium text-primary-900 dark:text-primary-100">
								{batter.position}
							</div>

							{/* Inning Columns */}
							{Array.from({ length: maxInnings }, (_, i) => (
								<div
									key={i}
									className="border-r border-primary-200 dark:border-primary-700 h-12 w-10 flex items-center justify-center">
									{/* Square cell for at-bat results */}
								</div>
							))}

							{/* Stats Columns */}
							<div className="border-l border-primary-300 dark:border-primary-800 border-r border-primary-200 dark:border-primary-700 h-12 flex items-center justify-center text-sm font-medium text-primary-900 dark:text-primary-100">
								{batter.at_bats || 0}
							</div>
							<div className="border-r border-primary-200 dark:border-primary-700 h-12 flex items-center justify-center text-sm font-medium text-primary-900 dark:text-primary-100">
								{batter.hits || 0}
							</div>
							<div className="border-r border-primary-200 dark:border-primary-700 h-12 flex items-center justify-center text-sm font-medium text-primary-900 dark:text-primary-100">
								{batter.runs || 0}
							</div>
							<div className="border-r border-primary-200 dark:border-primary-700 h-12 flex items-center justify-center text-sm font-medium text-primary-900 dark:text-primary-100">
								{batter.rbi || 0}
							</div>
							<div className="border-r border-primary-200 dark:border-primary-700 h-12 flex items-center justify-center text-sm font-medium text-primary-900 dark:text-primary-100">
								{batter.walks || 0}
							</div>
							<div className="h-12 flex items-center justify-center text-sm font-medium text-primary-900 dark:text-primary-100">
								{batter.strikeouts || 0}
							</div>
						</div>
					))}
				</div>

				{/* BOTTOM Scorecard (Home Team) */}
				<div className="border-t border-b border-primary-300 dark:border-primary-800">
					{/* BOTTOM Header Fields */}
					<div className="grid grid-cols-8 gap-0 border-b border-primary-300 dark:border-primary-800">
						{/* Logo Field */}
						<div className="col-span-1 border-r border-primary-300 dark:border-primary-800 relative">
							<div className="h-16 flex items-center justify-center">
								<span className="text-xs uppercase text-primary-500 dark:text-primary-400 absolute top-1 right-1">
									LOGO
								</span>
							</div>
						</div>

						{/* Top Row Fields */}
						<div className="col-span-2 border-r border-primary-300 dark:border-primary-800 relative">
							<div className="h-8 flex items-center px-2">
								<span className="text-xs uppercase text-primary-500 dark:text-primary-400 absolute top-1 right-1">
									HOME TEAM
								</span>
								<span className="font-medium text-primary-900 dark:text-primary-100">
									{detailedData.home_team.name}
								</span>
							</div>
						</div>
						<div className="col-span-2 border-r border-primary-300 dark:border-primary-800 relative">
							<div className="h-8 flex items-center px-2">
								<span className="text-xs uppercase text-primary-500 dark:text-primary-400 absolute top-1 right-1">
									BALLPARK
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">{detailedData.venue}</span>
							</div>
						</div>
						<div className="col-span-1 border-r border-primary-300 dark:border-primary-800 relative">
							<div className="h-8 flex items-center px-2">
								<span className="text-xs uppercase text-primary-500 dark:text-primary-400 absolute top-1 right-1">
									DATE
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">{detailedData.date}</span>
							</div>
						</div>
						<div className="col-span-2 relative">
							<div className="h-8 flex items-center px-2">
								<span className="text-xs uppercase text-primary-500 dark:text-primary-400 absolute top-1 right-1">
									MANAGER
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">TBD</span>
							</div>
						</div>
					</div>

					{/* Second Row Fields */}
					<div className="grid grid-cols-8 gap-0 border-b border-primary-300 dark:border-primary-800">
						<div className="col-span-1 border-r border-primary-300 dark:border-primary-800"></div>
						<div className="col-span-1 border-r border-primary-300 dark:border-primary-800 relative">
							<div className="h-8 flex items-center px-2">
								<span className="text-xs uppercase text-primary-500 dark:text-primary-400 absolute top-1 right-1">
									UNIFORMS
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">TBD</span>
							</div>
						</div>
						<div className="col-span-1 border-r border-primary-300 dark:border-primary-800 relative">
							<div className="h-8 flex items-center px-2">
								<span className="text-xs uppercase text-primary-500 dark:text-primary-400 absolute top-1 right-1">
									WEATHER
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">TBD</span>
							</div>
						</div>
						<div className="col-span-1 border-r border-primary-300 dark:border-primary-800 relative">
							<div className="h-8 flex items-center px-2">
								<span className="text-xs uppercase text-primary-500 dark:text-primary-400 absolute top-1 right-1">
									WIND
								</span>
								<span className="text-sm text-primary-900 dark:text-primary-100">TBD</span>
							</div>
						</div>
						<div className="col-span-4"></div>
					</div>

					{/* BOTTOM Label */}
					<div className="flex items-center border-b border-primary-300 dark:border-primary-800">
						<div className="w-16 h-12 flex items-center justify-center border-r border-primary-300 dark:border-primary-800">
							<span className="text-2xl font-bold text-primary-900 dark:text-primary-100">BOTTOM</span>
						</div>
						<div className="flex-1"></div>
					</div>

					{/* Column Headers */}
					<div
						className="grid gap-0 border-b border-primary-300 dark:border-primary-800"
						style={{
							gridTemplateColumns:
								'60px 1fr 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px',
						}}>
						<div className="border-r border-primary-200 dark:border-primary-700 h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
							#
						</div>
						<div className="border-r border-primary-300 dark:border-primary-800 h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
							PLAYER
						</div>
						<div className="border-r border-primary-200 dark:border-primary-700 h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
							POS
						</div>
						{Array.from({ length: maxInnings }, (_, i) => (
							<div
								key={i}
								className="border-r border-primary-200 dark:border-primary-700 h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
								{i + 1}
							</div>
						))}
						<div className="border-l border-primary-300 dark:border-primary-800 border-r border-primary-200 dark:border-primary-700 h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
							AB
						</div>
						<div className="border-r border-primary-200 dark:border-primary-700 h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
							H
						</div>
						<div className="border-r border-primary-200 dark:border-primary-700 h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
							R
						</div>
						<div className="border-r border-primary-200 dark:border-primary-700 h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
							RBI
						</div>
						<div className="border-r border-primary-200 dark:border-primary-700 h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
							BB
						</div>
						<div className="h-8 flex items-center justify-center text-xs font-bold text-primary-900 dark:text-primary-100">
							SO
						</div>
					</div>

					{/* Home Team Batters */}
					{detailedData.batters.home.map((batter, index) => (
						<div
							key={index}
							className="grid gap-0 border-b border-primary-200 dark:border-primary-700"
							style={{
								gridTemplateColumns:
									'60px 1fr 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px 40px',
							}}>
							{/* Player Number */}
							<div className="border-r border-primary-200 dark:border-primary-700 h-12 flex items-center justify-center text-sm font-medium text-primary-900 dark:text-primary-100">
								{batter.number || index + 1}
							</div>

							{/* Player Name */}
							<div className="border-r border-primary-300 dark:border-primary-800 h-12 flex items-center px-2">
								<div className="bg-primary-50 dark:bg-primary-800 w-full h-full flex items-center px-2">
									<span className="text-sm font-medium text-primary-900 dark:text-primary-100">{batter.name}</span>
								</div>
							</div>

							{/* Position */}
							<div className="border-r border-primary-200 dark:border-primary-700 h-12 flex items-center justify-center text-sm font-medium text-primary-900 dark:text-primary-100">
								{batter.position}
							</div>

							{/* Inning Columns */}
							{Array.from({ length: maxInnings }, (_, i) => (
								<div
									key={i}
									className="border-r border-primary-200 dark:border-primary-700 h-12 w-10 flex items-center justify-center">
									{/* Square cell for at-bat results */}
								</div>
							))}

							{/* Stats Columns */}
							<div className="border-l border-primary-300 dark:border-primary-800 border-r border-primary-200 dark:border-primary-700 h-12 flex items-center justify-center text-sm font-medium text-primary-900 dark:text-primary-100">
								{batter.at_bats || 0}
							</div>
							<div className="border-r border-primary-200 dark:border-primary-700 h-12 flex items-center justify-center text-sm font-medium text-primary-900 dark:text-primary-100">
								{batter.hits || 0}
							</div>
							<div className="border-r border-primary-200 dark:border-primary-700 h-12 flex items-center justify-center text-sm font-medium text-primary-900 dark:text-primary-100">
								{batter.runs || 0}
							</div>
							<div className="border-r border-primary-200 dark:border-primary-700 h-12 flex items-center justify-center text-sm font-medium text-primary-900 dark:text-primary-100">
								{batter.rbi || 0}
							</div>
							<div className="border-r border-primary-200 dark:border-primary-700 h-12 flex items-center justify-center text-sm font-medium text-primary-900 dark:text-primary-100">
								{batter.walks || 0}
							</div>
							<div className="h-12 flex items-center justify-center text-sm font-medium text-primary-900 dark:text-primary-100">
								{batter.strikeouts || 0}
							</div>
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
									<strong>Result:</strong> {plateAppearance.at_bat_result}
								</div>
								<div className="col-span-2 text-primary-900 dark:text-primary-100">
									<strong>Description:</strong> {plateAppearance.description}
								</div>
							</div>
						</div>
					</div>

					<div>
						<h4 className="font-semibold mb-2 text-primary-900 dark:text-primary-100">Pitch Sequence</h4>
						<div className="bg-white dark:bg-primary-800 p-3 rounded border border-primary-200 dark:border-primary-600">
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
								<div className="text-primary-600 dark:text-primary-400 text-sm">No pitch data available</div>
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
}
