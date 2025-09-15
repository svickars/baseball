'use client';

import { useBaseballContext } from '@/contexts/BaseballContext';
import GamesList from '@/components/GamesList';
import GameControls from '@/components/GameControls';
import ScorecardViewer from '@/components/ScorecardViewer';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { isGameLive } from '@/lib/utils';

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

	const isCurrentGameLive = selectedGame && games.some((game) => game.id === selectedGame.game_id && isGameLive(game));

	return (
		<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
					<div className="flex items-center justify-between mb-8">
						<button onClick={goBackToGames} className="btn btn-secondary">
							<ArrowLeft className="w-4 h-4" />
							Back to Games
						</button>

						<div className="flex items-center gap-3">
							{isCurrentGameLive && <span className="text-sm text-success-600 font-medium">🔴 Live Game</span>}
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
