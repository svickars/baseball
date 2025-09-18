'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { GameData, Game } from '@/types';
import GamePage from '@/components/GamePage';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { getGameStatusFromMLB } from '@/lib/utils';

export default function GameDetailPage() {
	const params = useParams();
	const gameId = params.gameId as string;

	const [gameData, setGameData] = useState<GameData | null>(null);
	const [originalGame, setOriginalGame] = useState<Game | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Live update state
	const [isLive, setIsLive] = useState(false);
	const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

	const fetchGameData = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);

			// Parse game ID to get date
			const parts = gameId.split('-');
			if (parts.length < 6) {
				throw new Error('Invalid game ID format');
			}
			const date = `${parts[0]}-${parts[1]}-${parts[2]}`;
			const awayCode = parts[3];
			const homeCode = parts[4];

			// Fetch game data using the enhanced MLB API service
			const [gameDetailsResponse, gamesResponse] = await Promise.all([
				fetch(`/api/game/${gameId}`),
				fetch(`/api/games/${date}`),
			]);

			if (!gameDetailsResponse.ok) {
				throw new Error(`Failed to fetch game data: ${gameDetailsResponse.status}`);
			}

			const gameDetails: GameData = await gameDetailsResponse.json();
			const gamesData = await gamesResponse.json();

			// Find the original game data that matches this game
			const originalGame = gamesData.games.find(
				(game: Game) => game.away_code === awayCode && game.home_code === homeCode
			);

			if (originalGame) {
				setOriginalGame(originalGame);
			}

			setGameData(gameDetails);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load game data');
		} finally {
			setLoading(false);
		}
	}, [gameId]);

	// Start live updates for live games
	const startLiveUpdates = useCallback(() => {
		if (refreshIntervalRef.current) {
			clearInterval(refreshIntervalRef.current);
		}

		refreshIntervalRef.current = setInterval(async () => {
			try {
				console.log(`🔄 Live update for game ${gameId}`);
				// Fetch updated game data
				const gameDetailsResponse = await fetch(`/api/game/${gameId}`);
				if (gameDetailsResponse.ok) {
					const updatedGameData: GameData = await gameDetailsResponse.json();
					console.log(`✅ Updated game data for ${gameId}:`, updatedGameData.game_data.status);
					setGameData(updatedGameData);
				}

				// Also fetch updated games list to get the latest originalGame data
				const parts = gameId.split('-');
				if (parts.length >= 6) {
					const date = `${parts[0]}-${parts[1]}-${parts[2]}`;
					const awayCode = parts[3];
					const homeCode = parts[4];

					const gamesResponse = await fetch(`/api/games/${date}`);
					if (gamesResponse.ok) {
						const gamesData = await gamesResponse.json();
						const updatedOriginalGame = gamesData.games.find(
							(game: Game) => game.away_code === awayCode && game.home_code === homeCode
						);
						if (updatedOriginalGame) {
							setOriginalGame(updatedOriginalGame);

							// Check if game is still live
							const gameStatus = updatedOriginalGame.mlbStatus
								? getGameStatusFromMLB(updatedOriginalGame.mlbStatus)
								: { status: 'unknown' };

							if (gameStatus.status !== 'live') {
								// Game is no longer live, stop updates
								setIsLive(false);
								if (refreshIntervalRef.current) {
									clearInterval(refreshIntervalRef.current);
									refreshIntervalRef.current = null;
								}
							}
						}
					}
				}
			} catch (error) {
				console.error('Error updating live game data:', error);
			}
		}, 3000); // Update every 3 seconds for live games
	}, [gameId]);

	// Stop live updates
	const stopLiveUpdates = useCallback(() => {
		if (refreshIntervalRef.current) {
			clearInterval(refreshIntervalRef.current);
			refreshIntervalRef.current = null;
		}
		setIsLive(false);
	}, []);

	useEffect(() => {
		if (gameId) {
			fetchGameData();
		}
	}, [gameId, fetchGameData]);

	// Check if game is live and start/stop updates accordingly
	useEffect(() => {
		if (originalGame && originalGame.mlbStatus) {
			const gameStatus = getGameStatusFromMLB(originalGame.mlbStatus);
			const gameIsLive = gameStatus.status === 'live';

			console.log(`🎮 Game ${gameId} status check:`, {
				mlbStatus: originalGame.mlbStatus,
				gameStatus,
				gameIsLive,
				currentIsLive: isLive,
			});

			if (gameIsLive && !isLive) {
				console.log(`🚀 Starting live updates for game ${gameId}`);
				setIsLive(true);
				startLiveUpdates();
			} else if (!gameIsLive && isLive) {
				console.log(`⏹️ Stopping live updates for game ${gameId}`);
				stopLiveUpdates();
			}
		}
	}, [originalGame, isLive, startLiveUpdates, stopLiveUpdates, gameId]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			stopLiveUpdates();
		};
	}, [stopLiveUpdates]);

	if (loading) {
		return (
			<div className="flex justify-center items-center py-16">
				<LoadingSpinner />
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex justify-center items-center py-16">
				<ErrorMessage message={error} />
			</div>
		);
	}

	if (!gameData) {
		return (
			<div className="flex justify-center items-center py-16">
				<ErrorMessage message="Game data not found" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-primary-50 dark:bg-primary-900">
			<GamePage gameData={gameData} gameId={gameId} originalGame={originalGame} />
		</div>
	);
}
