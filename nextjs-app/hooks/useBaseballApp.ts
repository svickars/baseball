'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Game, GameData, GameControls } from '@/types';
import { baseballApi } from '@/lib/api';
import { isGameLive } from '@/lib/utils';

export function useBaseballApp() {
	const [games, setGames] = useState<Game[]>([]);
	const [selectedGame, setSelectedGame] = useState<GameData | null>(null);
	const [selectedDate, setSelectedDate] = useState<string>('');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [view, setView] = useState<'games' | 'scorecard'>('games');

	const [controls, setControls] = useState<GameControls>({
		detailLevel: 'standard',
		timeDelay: 0,
		viewMode: 'scorecard',
		showPitchData: true,
		showPlayerStats: true,
	});

	// Live update state
	const [liveGames, setLiveGames] = useState<Set<string>>(new Set());
	const [liveDataBuffer, setLiveDataBuffer] = useState<Map<string, { data: GameData; timestamp: number }>>(new Map());

	// Refs for intervals
	const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const liveDataIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const delayCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

	// Load games for a specific date
	const loadGames = useCallback(async (date: string) => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await baseballApi.getGamesForDate(date);
			if (response.success) {
				setGames(response.games);
				setSelectedDate(date);
				setView('games');

				// Track live games
				const liveGameIds = new Set(response.games.filter((game) => isGameLive(game)).map((game) => game.id));
				setLiveGames(liveGameIds);

				// Start auto-refresh if there are live games
				if (liveGameIds.size > 0) {
					startAutoRefresh();
				} else {
					stopAutoRefresh();
				}
			} else {
				throw new Error(response.error || 'Failed to load games');
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to load games';
			setError(errorMessage);
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Load a specific game
	const loadGame = useCallback(async (gameId: string) => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await baseballApi.getGameDetails(gameId);
			if (response.success) {
				setSelectedGame(response);
				setView('scorecard');
				startLiveDataCollection(gameId);
			} else {
				throw new Error(response.error || 'Failed to load game');
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to load game';
			setError(errorMessage);
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Refresh current game
	const refreshCurrentGame = useCallback(async () => {
		if (selectedGame) {
			await loadGame(selectedGame.game_id);
		}
	}, [selectedGame, loadGame]);

	// Go back to games list
	const goBackToGames = useCallback(() => {
		setView('games');
		setSelectedGame(null);
		stopLiveDataCollection();
	}, []);

	// Auto-refresh for live games
	const startAutoRefresh = useCallback(() => {
		if (refreshIntervalRef.current) {
			clearInterval(refreshIntervalRef.current);
		}

		refreshIntervalRef.current = setInterval(async () => {
			if (selectedDate) {
				try {
					const response = await baseballApi.getGamesForDate(selectedDate);
					if (response.success) {
						setGames(response.games);

						// Update live games tracking
						const liveGameIds = new Set(response.games.filter((game) => isGameLive(game)).map((game) => game.id));
						setLiveGames(liveGameIds);

						// Stop auto-refresh if no more live games
						if (liveGameIds.size === 0) {
							stopAutoRefresh();
						}
					}
				} catch (error) {
					console.error('Error refreshing live games:', error);
				}
			}
		}, 30000); // Refresh every 30 seconds
	}, [selectedDate]);

	const stopAutoRefresh = useCallback(() => {
		if (refreshIntervalRef.current) {
			clearInterval(refreshIntervalRef.current);
			refreshIntervalRef.current = null;
		}
	}, []);

	// Live data collection for current game
	const startLiveDataCollection = useCallback(
		(gameId: string) => {
			// Clear existing intervals
			if (liveDataIntervalRef.current) {
				clearInterval(liveDataIntervalRef.current);
			}
			if (delayCheckIntervalRef.current) {
				clearInterval(delayCheckIntervalRef.current);
			}

			// Fetch live data every 10 seconds
			liveDataIntervalRef.current = setInterval(async () => {
				try {
					const response = await baseballApi.getGameDetails(gameId);
					if (response.success) {
						const timestamp = Date.now();
						const delaySeconds = controls.timeDelay;

						if (delaySeconds === 0) {
							// No delay - display immediately
							setSelectedGame(response);
						} else {
							// Store for delayed display
							setLiveDataBuffer(
								(prev) =>
									new Map(
										prev.set(gameId, {
											data: response,
											timestamp,
										})
									)
							);
						}
					}
				} catch (error) {
					console.error('Error fetching live data:', error);
				}
			}, 10000);

			// Check for delayed updates every second
			delayCheckIntervalRef.current = setInterval(() => {
				const currentTime = Date.now();
				const delayMs = controls.timeDelay * 1000;

				setLiveDataBuffer((prev) => {
					const newBuffer = new Map(prev);
					let hasUpdates = false;

					for (const [id, liveData] of newBuffer.entries()) {
						const timeSinceData = currentTime - liveData.timestamp;

						if (timeSinceData >= delayMs) {
							// Data is ready to be displayed
							setSelectedGame(liveData.data);
							newBuffer.delete(id);
							hasUpdates = true;
						}
					}

					return hasUpdates ? newBuffer : prev;
				});
			}, 1000);
		},
		[controls.timeDelay]
	);

	const stopLiveDataCollection = useCallback(() => {
		if (liveDataIntervalRef.current) {
			clearInterval(liveDataIntervalRef.current);
			liveDataIntervalRef.current = null;
		}
		if (delayCheckIntervalRef.current) {
			clearInterval(delayCheckIntervalRef.current);
			delayCheckIntervalRef.current = null;
		}
		setLiveDataBuffer(new Map());
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			stopAutoRefresh();
			stopLiveDataCollection();
		};
	}, [stopAutoRefresh, stopLiveDataCollection]);

	// Update controls
	const updateControls = useCallback((newControls: Partial<GameControls>) => {
		setControls((prev) => ({ ...prev, ...newControls }));
	}, []);

	return {
		// State
		games,
		selectedGame,
		selectedDate,
		isLoading,
		error,
		view,
		controls,
		liveGames,

		// Actions
		loadGames,
		loadGame,
		refreshCurrentGame,
		goBackToGames,
		updateControls,

		// Utilities
		setError,
	};
}
