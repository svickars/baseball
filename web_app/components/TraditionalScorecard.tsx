'use client';

import React, { useState, useEffect } from 'react';
import { GameData } from '@/types';
import LoadingSpinner from './LoadingSpinner';
import * as TeamLogos from './team-logos';

interface TraditionalScorecardProps {
	gameData: GameData;
	gameId: string;
}

// Helper function to get team logo component
const getTeamLogo = (teamCode: string) => {
	const LogoComponent = (TeamLogos as any)[teamCode];
	return LogoComponent ? <LogoComponent size={40} /> : null;
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

	// Log initial game data
	useEffect(() => {
		// Component initialized
	}, [gameData, gameId]);

	useEffect(() => {
		fetchDetailedData();
	}, [gameId]);

	// Handle detailed data changes
	useEffect(() => {
		if (detailedData) {
			// Detailed data updated
		}
	}, [detailedData]);

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

		// Only show extra innings if there's actual data for them
		const inningsWithData = detailedData.innings.map((i) => i.inning);
		const maxInnings = inningsWithData.length > 0 ? Math.max(...inningsWithData) : 9;
		const displayInnings = Math.max(9, maxInnings); // Always show at least 9 innings

		return (
			<div className="overflow-x-auto min-w-[1152px]">
				{/* TOP Scorecard (Away Team) */}
				<div className="mb-4 border-b border-primary-300 dark:border-primary-800">
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
						<div className="relative border-r border-primary-200 dark:border-primary-700">
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
						<div className="relative border-r border-primary-200 dark:border-primary-700">
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
							PLAYER
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-300 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							POS
						</div>
						{Array.from({ length: displayInnings }, (_, i) => (
							<div
								key={i}
								className="flex justify-center items-center h-8 text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
								{i + 1}
							</div>
						))}
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
						<div
							key={index}
							className="grid gap-0 border-b border-primary-200 dark:border-primary-700"
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
									{/* Second row content */}
								</div>
								<div className="flex justify-center items-center h-6 font-medium text-2xs text-primary-900 dark:text-primary-100">
									{/* Third row content */}
								</div>
							</div>

							{/* Player Name */}
							<div className="flex flex-col border-r border-primary-200 dark:border-primary-800 h-18">
								<div className="flex items-center px-2 h-6 border-b bg-primary-50 dark:bg-primary-800 border-primary-200 dark:border-primary-700">
									<span className="font-medium text-2xs text-primary-900 dark:text-primary-100">{batter.name}</span>
								</div>
								<div className="flex items-center px-2 h-6 border-b bg-primary-50 dark:bg-primary-800 border-primary-200 dark:border-primary-700">
									{/* Second row content */}
								</div>
								<div className="flex items-center px-2 h-6 bg-primary-50 dark:bg-primary-800">
									{/* Third row content */}
								</div>
							</div>

							{/* Position */}
							<div className="flex flex-col border-r border-primary-300 dark:border-primary-700 h-18">
								<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{batter.position}
								</div>
								<div className="flex justify-center items-center h-6 font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{/* Second row content */}
								</div>
								<div className="flex justify-center items-center h-6 font-medium text-2xs text-primary-900 dark:text-primary-100">
									{/* Third row content */}
								</div>
							</div>

							{/* Inning Columns */}
							{Array.from({ length: displayInnings }, (_, i) => (
								<div
									key={i}
									className="flex justify-center items-center border-r h-fill w-fill border-primary-200 dark:border-primary-700">
									{/* Square cell for at-bat results */}
								</div>
							))}

							{/* Stats Columns */}
							<div className="flex flex-col border-r border-l border-l-primary-300 dark:border-l-primary-800 border-r-primary-200 dark:border-r-primary-700 h-18">
								<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{batter.at_bats || 0}
								</div>
								<div className="flex justify-center items-center h-6 font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{/* Second row content */}
								</div>
								<div className="flex justify-center items-center h-6 font-medium text-2xs text-primary-900 dark:text-primary-100">
									{/* Third row content */}
								</div>
							</div>
							<div className="flex flex-col border-r border-primary-200 dark:border-primary-700 h-18">
								<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{batter.hits || 0}
								</div>
								<div className="flex justify-center items-center h-6 font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{/* Second row content */}
								</div>
								<div className="flex justify-center items-center h-6 font-medium text-2xs text-primary-900 dark:text-primary-100">
									{/* Third row content */}
								</div>
							</div>
							<div className="flex flex-col border-r border-primary-200 dark:border-primary-700 h-18">
								<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{batter.runs || 0}
								</div>
								<div className="flex justify-center items-center h-6 font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{/* Second row content */}
								</div>
								<div className="flex justify-center items-center h-6 font-medium text-2xs text-primary-900 dark:text-primary-100">
									{/* Third row content */}
								</div>
							</div>
							<div className="flex flex-col border-r border-primary-200 dark:border-primary-700 h-18">
								<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{batter.rbi || 0}
								</div>
								<div className="flex justify-center items-center h-6 font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{/* Second row content */}
								</div>
								<div className="flex justify-center items-center h-6 font-medium text-2xs text-primary-900 dark:text-primary-100">
									{/* Third row content */}
								</div>
							</div>
							<div className="flex flex-col border-r border-primary-200 dark:border-primary-700 h-18">
								<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{batter.walks || 0}
								</div>
								<div className="flex justify-center items-center h-6 font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{/* Second row content */}
								</div>
								<div className="flex justify-center items-center h-6 font-medium text-2xs text-primary-900 dark:text-primary-100">
									{/* Third row content */}
								</div>
							</div>
							<div className="flex flex-col h-18">
								<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{batter.strikeouts || 0}
								</div>
								<div className="flex justify-center items-center h-6 font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{/* Second row content */}
								</div>
								<div className="flex justify-center items-center h-6 font-medium text-2xs text-primary-900 dark:text-primary-100">
									{/* Third row content */}
								</div>
							</div>
						</div>
					))}
				</div>

				{/* BOTTOM Scorecard (Home Team) */}
				<div className="border-b border-primary-300 dark:border-primary-800">
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
						<div className="relative border-r border-primary-200 dark:border-primary-700">
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
						<div className="relative border-r border-primary-200 dark:border-primary-700">
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
							PLAYER
						</div>
						<div className="flex justify-center items-center h-8 font-mono text-xs font-bold border-r border-primary-300 dark:border-primary-700 text-primary-900 dark:text-primary-100">
							POS
						</div>
						{Array.from({ length: displayInnings }, (_, i) => (
							<div
								key={i}
								className="flex justify-center items-center h-8 text-xs font-bold border-r border-primary-200 dark:border-primary-700 text-primary-900 dark:text-primary-100">
								{i + 1}
							</div>
						))}
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
						<div
							key={index}
							className="grid gap-0 border-b border-primary-200 dark:border-primary-700"
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
									{/* Second row content */}
								</div>
								<div className="flex justify-center items-center h-6 font-medium text-2xs text-primary-900 dark:text-primary-100">
									{/* Third row content */}
								</div>
							</div>

							{/* Player Name */}
							<div className="flex flex-col border-r border-primary-200 dark:border-primary-800 h-18">
								<div className="flex items-center px-2 h-6 border-b bg-primary-50 dark:bg-primary-800 border-primary-200 dark:border-primary-700">
									<span className="font-medium text-2xs text-primary-900 dark:text-primary-100">{batter.name}</span>
								</div>
								<div className="flex items-center px-2 h-6 border-b bg-primary-50 dark:bg-primary-800 border-primary-200 dark:border-primary-700">
									{/* Second row content */}
								</div>
								<div className="flex items-center px-2 h-6 bg-primary-50 dark:bg-primary-800">
									{/* Third row content */}
								</div>
							</div>

							{/* Position */}
							<div className="flex flex-col border-r border-primary-300 dark:border-primary-700 h-18">
								<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{batter.position}
								</div>
								<div className="flex justify-center items-center h-6 font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{/* Second row content */}
								</div>
								<div className="flex justify-center items-center h-6 font-medium text-2xs text-primary-900 dark:text-primary-100">
									{/* Third row content */}
								</div>
							</div>

							{/* Inning Columns */}
							{Array.from({ length: displayInnings }, (_, i) => (
								<div
									key={i}
									className="flex justify-center items-center w-full h-full border-r border-primary-200 dark:border-primary-700">
									{/* Square cell for at-bat results */}
								</div>
							))}

							{/* Stats Columns */}
							<div className="flex flex-col border-r border-l border-l-primary-300 dark:border-l-primary-800 border-r-primary-200 dark:border-r-primary-700 h-18">
								<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{batter.at_bats || 0}
								</div>
								<div className="flex justify-center items-center h-6 font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{/* Second row content */}
								</div>
								<div className="flex justify-center items-center h-6 font-medium text-2xs text-primary-900 dark:text-primary-100">
									{/* Third row content */}
								</div>
							</div>
							<div className="flex flex-col border-r border-primary-200 dark:border-primary-700 h-18">
								<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{batter.hits || 0}
								</div>
								<div className="flex justify-center items-center h-6 font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{/* Second row content */}
								</div>
								<div className="flex justify-center items-center h-6 font-medium text-2xs text-primary-900 dark:text-primary-100">
									{/* Third row content */}
								</div>
							</div>
							<div className="flex flex-col border-r border-primary-200 dark:border-primary-700 h-18">
								<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{batter.runs || 0}
								</div>
								<div className="flex justify-center items-center h-6 font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{/* Second row content */}
								</div>
								<div className="flex justify-center items-center h-6 font-medium text-2xs text-primary-900 dark:text-primary-100">
									{/* Third row content */}
								</div>
							</div>
							<div className="flex flex-col border-r border-primary-200 dark:border-primary-700 h-18">
								<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{batter.rbi || 0}
								</div>
								<div className="flex justify-center items-center h-6 font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{/* Second row content */}
								</div>
								<div className="flex justify-center items-center h-6 font-medium text-2xs text-primary-900 dark:text-primary-100">
									{/* Third row content */}
								</div>
							</div>
							<div className="flex flex-col border-r border-primary-200 dark:border-primary-700 h-18">
								<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{batter.walks || 0}
								</div>
								<div className="flex justify-center items-center h-6 font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{/* Second row content */}
								</div>
								<div className="flex justify-center items-center h-6 font-medium text-2xs text-primary-900 dark:text-primary-100">
									{/* Third row content */}
								</div>
							</div>
							<div className="flex flex-col h-18">
								<div className="flex justify-center items-center h-6 font-mono font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{batter.strikeouts || 0}
								</div>
								<div className="flex justify-center items-center h-6 font-medium border-b text-2xs text-primary-900 dark:text-primary-100 border-primary-200 dark:border-primary-700">
									{/* Second row content */}
								</div>
								<div className="flex justify-center items-center h-6 font-medium text-2xs text-primary-900 dark:text-primary-100">
									{/* Third row content */}
								</div>
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
}
