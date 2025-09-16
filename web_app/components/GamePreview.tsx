'use client';

import React from 'react';
import { GameData, Game } from '@/types';

interface GamePreviewProps {
	gameData: GameData;
	originalGame?: Game | null;
	detailedData?: any;
}

export default function GamePreview({ gameData, originalGame, detailedData }: GamePreviewProps) {
	// This is the new scoreboard component that replaces the previous scorecard display
	// For now, let's create a placeholder that shows the basic game information

	return (
		<div className="space-y-6">
			{/* Game Summary */}
			<div className="bg-white dark:bg-primary-800 rounded-lg border border-primary-200 dark:border-primary-700 p-6">
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-lg font-semibold text-primary-900 dark:text-primary-100">Game Summary</h3>
					{originalGame && (
						<div className="text-sm text-primary-600 dark:text-primary-400">
							{originalGame.status === 'Final' ? 'Final' : originalGame.status === 'Live' ? 'Live' : 'Upcoming'}
						</div>
					)}
				</div>

				<div className="grid grid-cols-2 gap-6">
					{/* Away Team */}
					<div className="text-center">
						<div className="text-2xl font-bold text-primary-900 dark:text-primary-100">
							{originalGame?.away_score || 0}
						</div>
						<div className="text-sm text-primary-600 dark:text-primary-400">{gameData.game_data.away_team.name}</div>
					</div>

					{/* Home Team */}
					<div className="text-center">
						<div className="text-2xl font-bold text-primary-900 dark:text-primary-100">
							{originalGame?.home_score || 0}
						</div>
						<div className="text-sm text-primary-600 dark:text-primary-400">{gameData.game_data.home_team.name}</div>
					</div>
				</div>
			</div>

			{/* Game Details */}
			{detailedData && (
				<div className="bg-white dark:bg-primary-800 rounded-lg border border-primary-200 dark:border-primary-700 p-6">
					<h3 className="text-lg font-semibold text-primary-900 dark:text-primary-100 mb-4">Game Details</h3>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<h4 className="font-medium text-primary-900 dark:text-primary-100 mb-2">
								{gameData.game_data.away_team.name}
							</h4>
							<div className="space-y-1 text-sm text-primary-600 dark:text-primary-400">
								<div>
									Hits:{' '}
									{detailedData.batters?.away?.reduce((sum: number, batter: any) => sum + (batter.hits || 0), 0) || 0}
								</div>
								<div>Errors: 0</div>
								<div>Runs: {originalGame?.away_score || 0}</div>
							</div>
						</div>

						<div>
							<h4 className="font-medium text-primary-900 dark:text-primary-100 mb-2">
								{gameData.game_data.home_team.name}
							</h4>
							<div className="space-y-1 text-sm text-primary-600 dark:text-primary-400">
								<div>
									Hits:{' '}
									{detailedData.batters?.home?.reduce((sum: number, batter: any) => sum + (batter.hits || 0), 0) || 0}
								</div>
								<div>Errors: 0</div>
								<div>Runs: {originalGame?.home_score || 0}</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Inning Summary */}
			{detailedData?.innings && (
				<div className="bg-white dark:bg-primary-800 rounded-lg border border-primary-200 dark:border-primary-700 p-6">
					<h3 className="text-lg font-semibold text-primary-900 dark:text-primary-100 mb-4">Inning Summary</h3>

					<div className="space-y-2">
						{detailedData.innings.map((inning: any, index: number) => (
							<div
								key={index}
								className="flex justify-between items-center py-2 border-b border-primary-100 dark:border-primary-700 last:border-b-0">
								<span className="font-medium text-primary-900 dark:text-primary-100">Inning {inning.inning}</span>
								<div className="flex gap-4 text-sm text-primary-600 dark:text-primary-400">
									<span>
										{gameData.game_data.away_team.abbreviation}: {inning.away_runs || 0}
									</span>
									<span>
										{gameData.game_data.home_team.abbreviation}: {inning.home_runs || 0}
									</span>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
