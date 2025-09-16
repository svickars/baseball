'use client';

import { useBaseballContext } from '@/contexts/BaseballContext';
import GamesList from '@/components/GamesList';
import GameControls from '@/components/GameControls';
import ScorecardViewer from '@/components/ScorecardViewer';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { getGameStatusFromMLB } from '@/lib/utils';

export default function HomePage() {
	const {
		games,
		selectedGame,
		selectedDate,
		isLoading,
		error,
		view,
		controls,
		liveGames,
		loadGames,
		loadGame,
		refreshCurrentGame,
		goBackToGames,
		updateControls,
		setError,
	} = useBaseballContext();

	const isCurrentGameLive =
		selectedGame &&
		games.some((game) => {
			if (game.id === selectedGame.game_id) {
				// Use MLB API status as the primary and only source of truth
				if (game.mlbStatus) {
					const { status } = getGameStatusFromMLB(game.mlbStatus);
					return status === 'live';
				}
				// No fallback - if no MLB status, game is not live
				return false;
			}
			return false;
		});

	return (
		<main className="flex-1 px-0 py-0 mx-auto w-full max-w-7xl min-h-full border-r border-l border-primary-400 dark:border-primary-700">
			{view === 'games' && (
				<>
					{error && (
						<ErrorMessage message={error} onRetry={() => (selectedDate ? loadGames(selectedDate) : undefined)} />
					)}

					{isLoading && !error && <LoadingSpinner message="Loading games..." />}

					{!isLoading && !error && games.length > 0 && (
						<GamesList games={games} selectedDate={selectedDate} onGameSelect={loadGame} />
					)}
				</>
			)}

			{view === 'scorecard' && selectedGame && (
				<>
					{/* Game Header with Navigation */}
					<div className="flex justify-between items-center mb-8">
						<button onClick={goBackToGames} className="btn btn-secondary">
							<ArrowLeft className="w-4 h-4" />
							Back to Games
						</button>

						<div className="flex gap-3 items-center">
							{isCurrentGameLive && <span className="text-sm font-medium text-success-600">🔴 Live Game</span>}
							<button onClick={refreshCurrentGame} className="btn btn-outline">
								<RefreshCw className="w-4 h-4" />
								Refresh
							</button>
						</div>
					</div>

					{error && <ErrorMessage message={error} onRetry={refreshCurrentGame} />}

					{isLoading && !error && <LoadingSpinner message="Loading game data..." />}

					{!isLoading && !error && (
						<>
							<GameControls controls={controls} onControlsChange={updateControls} />

							<ScorecardViewer gameData={selectedGame} controls={controls} isLive={isCurrentGameLive || false} />
						</>
					)}
				</>
			)}
		</main>
	);
}
