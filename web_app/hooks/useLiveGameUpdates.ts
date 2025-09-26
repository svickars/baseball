'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GameData } from '@/types';

interface LiveUpdateState {
	gameData: GameData | null;
	isLive: boolean;
	isLoading: boolean;
	error: string | null;
	lastUpdate: string | null;
	hasChanges: boolean;
}

interface UseLiveGameUpdatesOptions {
	gameId: string;
	gamePk?: string;
	isLiveGame: boolean;
	pollInterval?: number;
	onDataUpdate?: (data: GameData) => void;
	onError?: (error: string) => void;
}

export function useLiveGameUpdates({
	gameId,
	gamePk,
	isLiveGame,
	pollInterval = 3000,
	onDataUpdate,
	onError,
}: UseLiveGameUpdatesOptions) {
	const [state, setState] = useState<LiveUpdateState>({
		gameData: null,
		isLive: false,
		isLoading: false,
		error: null,
		lastUpdate: null,
		hasChanges: false,
	});

	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const isActiveRef = useRef(true);
	const retryCountRef = useRef(0);
	const maxRetries = 3;

	// Fetch live game data with diffPatch
	const fetchLiveData = useCallback(
		async (isInitial = false) => {
			if (!gamePk || !isActiveRef.current) return;

			setState((prev) => ({ ...prev, isLoading: true, error: null }));

			try {
				const params = new URLSearchParams({
					live: 'true',
					gamePk: gamePk,
				});

				// Get current lastUpdate from state at call time to avoid stale closure
				const currentLastUpdate = state.lastUpdate;
				if (currentLastUpdate && !isInitial) {
					params.append('lastUpdate', currentLastUpdate);
				}

				// Add timestamp to prevent caching
				params.append('t', Date.now().toString());

				const response = await fetch(`/api/game/${gameId}?${params.toString()}`);

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const data = await response.json();

				if (!data.success) {
					throw new Error(data.error || 'Failed to fetch live data');
				}

				// Only update if there are changes or it's the initial load
				if (data.hasChanges || isInitial) {
					setState((prev) => ({
						...prev,
						gameData: data,
						isLive: data.isLiveUpdate || false,
						isLoading: false,
						error: null,
						lastUpdate: data.timestamp,
						hasChanges: data.hasChanges || false,
					}));

					// Call the data update callback
					if (onDataUpdate && data.hasChanges) {
						onDataUpdate(data);
					}

					// Reset retry count on successful update
					retryCountRef.current = 0;
				} else {
					// No changes, just update the loading state
					setState((prev) => ({
						...prev,
						isLoading: false,
						error: null,
					}));
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

				setState((prev) => ({
					...prev,
					isLoading: false,
					error: errorMessage,
				}));

				// Handle retry logic
				if (retryCountRef.current < maxRetries) {
					retryCountRef.current++;
					const retryDelay = Math.pow(2, retryCountRef.current) * 1000; // Exponential backoff

					setTimeout(() => {
						if (isActiveRef.current) {
							fetchLiveData(false);
						}
					}, retryDelay);
				} else {
					// Max retries reached, call error callback
					if (onError) {
						onError(errorMessage);
					}
				}
			}
		},
		[gameId, gamePk, onDataUpdate, onError] // Removed state.lastUpdate from dependencies
	);

	// Start live updates for live games
	const startLiveUpdates = useCallback(() => {
		if (!isLiveGame || !gamePk || intervalRef.current) return;

		// Initial fetch
		fetchLiveData(true);

		// Set up polling interval
		intervalRef.current = setInterval(() => {
			if (isActiveRef.current && isLiveGame) {
				fetchLiveData(false);
			}
		}, pollInterval);
	}, [isLiveGame, gamePk, pollInterval]); // Removed fetchLiveData from dependencies

	// Stop live updates
	const stopLiveUpdates = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		setState((prev) => ({ ...prev, isLive: false }));
	}, []);

	// Handle visibility change (pause when tab is not active)
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.hidden) {
				// Pause updates when tab is not visible
				stopLiveUpdates();
			} else if (isLiveGame && gamePk) {
				// Resume updates when tab becomes visible
				startLiveUpdates();
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
	}, [isLiveGame, gamePk]); // Removed startLiveUpdates and stopLiveUpdates from dependencies

	// Start/stop updates based on game status
	useEffect(() => {
		if (isLiveGame && gamePk) {
			startLiveUpdates();
		} else {
			stopLiveUpdates();
		}

		return () => {
			stopLiveUpdates();
		};
	}, [isLiveGame, gamePk]); // Removed startLiveUpdates and stopLiveUpdates from dependencies

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			isActiveRef.current = false;
			stopLiveUpdates();
		};
	}, []); // Removed stopLiveUpdates from dependencies

	// Manual refresh function
	const refreshData = useCallback(() => {
		if (gamePk) {
			fetchLiveData(true);
		}
	}, [gamePk]); // Removed fetchLiveData from dependencies

	return {
		...state,
		refreshData,
		startLiveUpdates,
		stopLiveUpdates,
	};
}
