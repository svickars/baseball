'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { GameData } from '@/types';
import ModernScorecard from '@/components/ModernScorecard';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';

export default function GameDetailPage() {
	const params = useParams();
	const gameId = params.gameId as string;

	const [gameData, setGameData] = useState<GameData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (gameId) {
			fetchGameData();
		}
	}, [gameId]);

	const fetchGameData = async () => {
		try {
			setLoading(true);
			setError(null);

			const response = await fetch(`/api/game/${gameId}`);
			if (!response.ok) {
				throw new Error(`Failed to fetch game data: ${response.status}`);
			}

			const data = await response.json();
			setGameData(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load game data');
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<LoadingSpinner />
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<ErrorMessage message={error} />
			</div>
		);
	}

	if (!gameData) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<ErrorMessage message="Game data not found" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<ModernScorecard gameData={gameData} gameId={gameId} />
		</div>
	);
}
