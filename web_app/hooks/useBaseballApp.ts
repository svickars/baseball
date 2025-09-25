'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Game, GameData, GameControls } from '@/types';
import { baseballApi } from '@/lib/api';
import { getGameStatusFromMLB, getTodayLocalDate } from '@/lib/utils';
import { perf, performanceDiagnostic } from '@/lib/performance-diagnostic';

export function useBaseballApp() {
	const [games, setGames] = useState<Game[]>([]);
	const [selectedGame, setSelectedGame] = useState<GameData | null>(null);
	const [selectedDate, setSelectedDate] = useState<string>(() => getTodayLocalDate());
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
		perf.start('loadGames');
		setIsLoading(true);
		setError(null);

		try {
			perf.start('getGamesForDate');
			const response = await baseballApi.getGamesForDate(date);
			perf.end('getGamesForDate');

			if (response.success) {
				perf.start('processGamesData');

				perf.start('setGames');
				setGames(response.games);
				perf.end('setGames');

				perf.start('setSelectedDate');
				setSelectedDate(date);
				perf.end('setSelectedDate');

				perf.start('setView');
				setView('games');
				perf.end('setView');

				perf.start('processLiveGames');
				// Track live games using MLB API status
				const liveGameIds = new Set(
					response.games
						.filter((game) => {
							if (game.mlbStatus) {
								const { status } = getGameStatusFromMLB(game.mlbStatus);
								return status === 'live';
							}
							return false;
						})
						.map((game) => game.id)
				);
				setLiveGames(liveGameIds);
				perf.end('processLiveGames');

				perf.start('autoRefreshLogic');
				// Start auto-refresh if there are live games
				if (liveGameIds.size > 0) {
					startAutoRefresh();
				} else {
					stopAutoRefresh();
				}
				perf.end('autoRefreshLogic');
				perf.end('processGamesData');
			} else {
				throw new Error('Failed to load games');
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to load games';
			setError(errorMessage);
		} finally {
			setIsLoading(false);
			perf.end('loadGames');
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

				// Log gamePk if available in the game data
				if (response.game_data && response.game_data.game_pk) {
					console.log('🎮 Game loaded via useBaseballApp - gamePk:', response.game_data.game_pk);
				}
			} else {
				throw new Error('Failed to load game');
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

						// Update live games tracking using MLB API status
						const liveGameIds = new Set(
							response.games
								.filter((game) => {
									if (game.mlbStatus) {
										const { status } = getGameStatusFromMLB(game.mlbStatus);
										return status === 'live';
									}
									return false;
								})
								.map((game) => game.id)
						);
						setLiveGames(liveGameIds);

						// Also update individual live games for more frequent updates
						liveGameIds.forEach(async (gameId) => {
							try {
								const gameResponse = await baseballApi.getGameDetails(gameId);
								if (gameResponse.success) {
									// Update the specific game in the games array
									setGames((prevGames) =>
										prevGames.map((game) => (game.id === gameId ? { ...game, ...gameResponse } : game))
									);
								}
							} catch (error) {
								console.error(`Error updating live game ${gameId}:`, error);
							}
						});

						// Stop auto-refresh if no more live games
						if (liveGameIds.size === 0) {
							stopAutoRefresh();
						}
					}
				} catch (error) {
					console.error('Error refreshing live games:', error);
				}
			}
		}, 10000); // Refresh every 10 seconds for live games
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
			}, 5000); // Update every 5 seconds for live games

			// Check for delayed updates every second
			delayCheckIntervalRef.current = setInterval(() => {
				const currentTime = Date.now();
				const delayMs = controls.timeDelay * 1000;

				setLiveDataBuffer((prev) => {
					const newBuffer = new Map(prev);
					let hasUpdates = false;

					newBuffer.forEach((liveData, id) => {
						const timeSinceData = currentTime - liveData.timestamp;

						if (timeSinceData >= delayMs) {
							// Data is ready to be displayed
							setSelectedGame(liveData.data);
							newBuffer.delete(id);
							hasUpdates = true;
						}
					});

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

	// Load games on mount with current date
	useEffect(() => {
		const today = getTodayLocalDate();
		loadGames(today);
	}, [loadGames]);

	// Log performance summary after initial load
	useEffect(() => {
		if (games.length > 0) {
			setTimeout(() => {
				performanceDiagnostic.logSummary();
			}, 1000);
		}
	}, [games.length]); // Include loadGames in dependencies

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
