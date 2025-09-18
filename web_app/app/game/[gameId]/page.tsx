'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { GameData, Game } from '@/types';
import GamePage from '@/components/GamePage';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';

export default function GameDetailPage() {
	const params = useParams();
	const gameId = params.gameId as string;

	const [gameData, setGameData] = useState<GameData | null>(null);
	const [originalGame, setOriginalGame] = useState<Game | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

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

	useEffect(() => {
		if (gameId) {
			fetchGameData();
		}
	}, [gameId, fetchGameData]);

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
