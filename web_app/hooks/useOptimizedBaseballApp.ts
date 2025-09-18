'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Game, GameData, GameControls } from '@/types';
import { optimizedApi } from '@/lib/optimized-api';
import { dataPrefetcher } from '@/lib/data-prefetcher';
import { dataNormalizer, NormalizedGame } from '@/lib/data-normalizer';
import { getGameStatusFromMLB, getTodayLocalDate } from '@/lib/utils';

export function useOptimizedBaseballApp() {
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

	// Prefetch timer ref
	const prefetchTimerRef = useRef<NodeJS.Timeout | null>(null);

	// Memoized normalized games for performance
	const normalizedGames = useMemo(() => {
		return games.map((game) => {
			// Try to get normalized version from cache
			const normalized = dataNormalizer.getCachedGame(game.id);
			if (normalized) {
				return normalized;
			}

			// Create a basic normalized version for games list
			return {
				id: game.id,
				date: game.id.split('-').slice(0, 3).join('-'), // Extract date from game ID
				awayTeam: {
					id: game.away_team.toLowerCase().replace(/\s+/g, '-'),
					name: game.away_team,
					abbreviation: game.away_code,
					score: game.away_score,
					hits: game.away_hits || 0,
					errors: game.away_errors || 0,
				},
				homeTeam: {
					id: game.home_team.toLowerCase().replace(/\s+/g, '-'),
					name: game.home_team,
					abbreviation: game.home_code,
					score: game.home_score,
					hits: game.home_hits || 0,
					errors: game.home_errors || 0,
				},
				status: game.status,
				venue: game.location || 'Unknown',
				innings: (game.innings || []).map((inning) => ({
					number: inning.inning,
					awayRuns: inning.away_runs,
					homeRuns: inning.home_runs,
					topEvents: [],
					bottomEvents: [],
				})),
				batters: { away: [], home: [] },
				pitchers: { away: [], home: [] },
				metadata: {
					lastUpdated: Date.now(),
					isLive: game.status?.toLowerCase().includes('live'),
					gameType: 'regular' as const,
				},
			} as NormalizedGame;
		});
	}, [games]);

	// Load games for a specific date with prefetching
	const loadGames = useCallback(async (date: string) => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await optimizedApi.getGamesForDate(date);
			if (response.success) {
				setGames(response.games);
				setSelectedDate(date);
				setView('games');

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

				// Prefetch game details for better UX
				prefetchGameDetails(response.games);

				// Start auto-refresh if there are live games
				if (liveGameIds.size > 0) {
					startAutoRefresh();
				} else {
					stopAutoRefresh();
				}
			} else {
				throw new Error('Failed to load games');
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to load games';
			setError(errorMessage);
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Prefetch game details for better performance
	const prefetchGameDetails = useCallback((games: Game[]) => {
		// Clear existing prefetch timer
		if (prefetchTimerRef.current) {
			clearTimeout(prefetchTimerRef.current);
		}

		// Prefetch after a short delay to not block initial render
		prefetchTimerRef.current = setTimeout(() => {
			dataPrefetcher.prefetchGames(games);
		}, 1000);
	}, []);

	// Load a specific game with caching
	const loadGame = useCallback(async (gameId: string) => {
		setIsLoading(true);
		setError(null);

		try {
			// Try to get from prefetcher cache first
			let gameData = dataPrefetcher.getCachedGameData(gameId);

			if (!gameData) {
				// Fallback to API call
				const response = await optimizedApi.getGameDetails(gameId);
				if (response.success) {
					gameData = response;
				} else {
					throw new Error('Failed to load game');
				}
			}

			// Normalize the data
			const normalizedData = dataNormalizer.normalizeGame(gameData);

			setSelectedGame(gameData);
			setView('scorecard');
			startLiveDataCollection(gameId);
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
			// Clear cache for this game to force refresh
			dataPrefetcher.clearGameCache(selectedGame.game_id);
			dataNormalizer.clearCache();
			await loadGame(selectedGame.game_id);
		}
	}, [selectedGame, loadGame]);

	// Go back to games list
	const goBackToGames = useCallback(() => {
		setView('games');
		setSelectedGame(null);
		stopLiveDataCollection();
	}, []);

	// Auto-refresh for live games with optimized polling
	const startAutoRefresh = useCallback(() => {
		if (refreshIntervalRef.current) {
			clearInterval(refreshIntervalRef.current);
		}

		refreshIntervalRef.current = setInterval(async () => {
			if (selectedDate) {
				try {
					const response = await optimizedApi.getGamesForDate(selectedDate);
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

						// Prefetch updated game details
						prefetchGameDetails(response.games);

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
	}, [selectedDate, prefetchGameDetails]);

	const stopAutoRefresh = useCallback(() => {
		if (refreshIntervalRef.current) {
			clearInterval(refreshIntervalRef.current);
			refreshIntervalRef.current = null;
		}
	}, []);

	// Live data collection for current game with optimized caching
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
					// Try to get from prefetcher cache first
					let response = dataPrefetcher.getCachedGameData(gameId);

					if (!response) {
						const apiResponse = await optimizedApi.getGameDetails(gameId);
						if (apiResponse.success) {
							response = apiResponse;
						}
					}

					if (response) {
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

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			stopAutoRefresh();
			stopLiveDataCollection();
			if (prefetchTimerRef.current) {
				clearTimeout(prefetchTimerRef.current);
			}
		};
	}, [stopAutoRefresh, stopLiveDataCollection]);

	// Update controls
	const updateControls = useCallback((newControls: Partial<GameControls>) => {
		setControls((prev) => ({ ...prev, ...newControls }));
	}, []);

	// Get performance statistics
	const getPerformanceStats = useCallback(() => {
		return {
			prefetcher: dataPrefetcher.getCacheStats(),
			normalizer: dataNormalizer.getCacheStats(),
			api: optimizedApi.getQueueStats(),
		};
	}, []);

	return {
		// State
		games,
		normalizedGames,
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
		prefetchGameDetails,

		// Utilities
		setError,
		getPerformanceStats,
	};
}
