'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Game } from '@/types';
import { progressiveDataLoader, ProgressiveGameData, ProgressiveLoadingEvent } from '@/lib/progressive-data-loader';

interface UseProgressiveGameDataOptions {
	autoLoadDetails?: boolean;
	loadDelay?: number;
	prioritizeLiveGames?: boolean;
}

export function useProgressiveGameData(games: Game[], options: UseProgressiveGameDataOptions = {}) {
	const { autoLoadDetails = true, loadDelay = 100, prioritizeLiveGames = true } = options;

	const [progressiveGames, setProgressiveGames] = useState<ProgressiveGameData[]>([]);
	const [loadingStates, setLoadingStates] = useState<Map<string, string>>(new Map());
	const initializedRef = useRef(false);

	// Initialize games when they change
	useEffect(() => {
		if (games.length > 0) {
			const initialized = progressiveDataLoader.initializeGames(games);
			setProgressiveGames(initialized);
			initializedRef.current = true;
		}
	}, [games]);

	// Set up event listener
	useEffect(() => {
		const unsubscribe = progressiveDataLoader.subscribe((event: ProgressiveLoadingEvent) => {
			setProgressiveGames((prev) => {
				const updated = [...prev];
				const gameIndex = updated.findIndex((game) => game.id === event.gameId);

				if (gameIndex !== -1) {
					const currentGame = updated[gameIndex];

					switch (event.type) {
						case 'GAME_DETAILS_LOADED':
							updated[gameIndex] = {
								...currentGame,
								...event.data,
								loadingState: 'detailed',
								loadingProgress: 100,
								lastUpdated: Date.now(),
							};
							break;

						case 'GAME_DETAILS_ERROR':
							updated[gameIndex] = {
								...currentGame,
								loadingState: 'error',
								loadingProgress: 0,
								lastUpdated: Date.now(),
							};
							break;

						case 'LOADING_PROGRESS':
							updated[gameIndex] = {
								...currentGame,
								loadingProgress: event.progress,
								lastUpdated: Date.now(),
							};
							break;
					}
				}

				return updated;
			});

			// Update loading states
			setLoadingStates((prev) => {
				const newStates = new Map(prev);
				const game = progressiveDataLoader.getGameData(event.gameId);
				if (game) {
					newStates.set(event.gameId, game.loadingState);
				}
				return newStates;
			});
		});

		return unsubscribe;
	}, []);

	// Auto-load details after delay
	useEffect(() => {
		if (!autoLoadDetails || !initializedRef.current || progressiveGames.length === 0) {
			return;
		}

		const timer = setTimeout(() => {
			// Prioritize live games if enabled
			let gameIds: string[];

			if (prioritizeLiveGames) {
				const liveGames = progressiveGames.filter((game) => game.is_live).map((game) => game.id);

				const otherGames = progressiveGames.filter((game) => !game.is_live).map((game) => game.id);

				gameIds = [...liveGames, ...otherGames];
			} else {
				gameIds = progressiveGames.map((game) => game.id);
			}

			// Load details for all games
			progressiveDataLoader.loadMultipleGameDetails(gameIds);
		}, loadDelay);

		return () => clearTimeout(timer);
	}, [progressiveGames, autoLoadDetails, loadDelay, prioritizeLiveGames]);

	// Manual loading functions
	const loadGameDetails = useCallback((gameId: string) => {
		progressiveDataLoader.loadGameDetails(gameId);
	}, []);

	const loadMultipleGameDetails = useCallback((gameIds: string[]) => {
		progressiveDataLoader.loadMultipleGameDetails(gameIds);
	}, []);

	const refreshGameData = useCallback((gameId: string) => {
		// Reset to basic state and reload
		const game = progressiveDataLoader.getGameData(gameId);
		if (game) {
			progressiveDataLoader.loadGameDetails(gameId);
		}
	}, []);

	// Get loading state for a specific game
	const getGameLoadingState = useCallback(
		(gameId: string) => {
			return loadingStates.get(gameId) || 'basic';
		},
		[loadingStates]
	);

	// Get loading progress for a specific game
	const getGameLoadingProgress = useCallback((gameId: string) => {
		const game = progressiveDataLoader.getGameData(gameId);
		return game?.loadingProgress || 0;
	}, []);

	// Check if any games are loading
	const isAnyGameLoading = progressiveGames.some((game) => game.loadingState === 'loading-details');

	// Get games by loading state
	const getGamesByState = useCallback(
		(state: string) => {
			return progressiveGames.filter((game) => game.loadingState === state);
		},
		[progressiveGames]
	);

	return {
		progressiveGames,
		loadingStates,
		loadGameDetails,
		loadMultipleGameDetails,
		refreshGameData,
		getGameLoadingState,
		getGameLoadingProgress,
		isAnyGameLoading,
		getGamesByState,
	};
}
