'use client';

import { Game } from '@/types';

// Progressive loading states
export interface ProgressiveGameData extends Game {
	loadingState: 'basic' | 'loading-details' | 'detailed' | 'error';
	loadingProgress?: number;
	lastUpdated?: number;
}

// Event types for progressive loading
export type ProgressiveLoadingEvent =
	| { type: 'GAME_DETAILS_LOADED'; gameId: string; data: Partial<Game> }
	| { type: 'GAME_DETAILS_ERROR'; gameId: string; error: string }
	| { type: 'LOADING_PROGRESS'; gameId: string; progress: number };

// Progressive data loader class
export class ProgressiveDataLoader {
	private loadingStates = new Map<string, ProgressiveGameData>();
	private listeners = new Set<(event: ProgressiveLoadingEvent) => void>();
	private loadingQueue = new Set<string>();
	private isProcessing = false;
	private maxConcurrentLoads = 6;

	constructor() {
		// Start processing queue
		this.processQueue();
	}

	// Initialize games with basic data
	initializeGames(games: Game[]): ProgressiveGameData[] {
		return games.map((game) => ({
			...game,
			loadingState: 'basic' as const,
			lastUpdated: Date.now(),
		}));
	}

	// Start loading detailed data for a game
	async loadGameDetails(gameId: string): Promise<void> {
		if (this.loadingQueue.has(gameId) || this.loadingStates.get(gameId)?.loadingState === 'detailed') {
			return;
		}

		this.loadingQueue.add(gameId);
		this.updateGameState(gameId, { loadingState: 'loading-details', loadingProgress: 0 });
		this.notifyListeners({ type: 'LOADING_PROGRESS', gameId, progress: 0 });

		// Process the queue
		this.processQueue();
	}

	// Load detailed data for multiple games
	async loadMultipleGameDetails(gameIds: string[]): Promise<void> {
		for (const gameId of gameIds) {
			await this.loadGameDetails(gameId);
		}
	}

	// Get current game data
	getGameData(gameId: string): ProgressiveGameData | undefined {
		return this.loadingStates.get(gameId);
	}

	// Get all games data
	getAllGamesData(): ProgressiveGameData[] {
		return Array.from(this.loadingStates.values());
	}

	// Subscribe to loading events
	subscribe(listener: (event: ProgressiveLoadingEvent) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	// Update game state
	private updateGameState(gameId: string, updates: Partial<ProgressiveGameData>): void {
		const current = this.loadingStates.get(gameId);
		if (current) {
			this.loadingStates.set(gameId, { ...current, ...updates, lastUpdated: Date.now() });
		}
	}

	// Notify listeners
	private notifyListeners(event: ProgressiveLoadingEvent): void {
		this.listeners.forEach((listener) => {
			try {
				listener(event);
			} catch (error) {
				console.error('Error in progressive loading listener:', error);
			}
		});
	}

	// Process the loading queue
	private async processQueue(): Promise<void> {
		if (this.isProcessing || this.loadingQueue.size === 0) {
			return;
		}

		this.isProcessing = true;

		try {
			const batch = Array.from(this.loadingQueue).slice(0, this.maxConcurrentLoads);

			// Process batch concurrently
			await Promise.allSettled(batch.map((gameId) => this.loadSingleGameDetails(gameId)));

			// Remove processed games from queue
			batch.forEach((gameId) => this.loadingQueue.delete(gameId));

			// Continue processing if there are more games
			if (this.loadingQueue.size > 0) {
				setTimeout(() => this.processQueue(), 100);
			}
		} finally {
			this.isProcessing = false;
		}
	}

	// Load detailed data for a single game
	private async loadSingleGameDetails(gameId: string): Promise<void> {
		try {
			// Quick progress update
			this.updateGameState(gameId, { loadingProgress: 50 });
			this.notifyListeners({ type: 'LOADING_PROGRESS', gameId, progress: 50 });

			// Load actual detailed data immediately
			const detailedData = await this.fetchGameDetails(gameId);

			// Update with real data
			this.updateGameState(gameId, {
				...detailedData,
				loadingState: 'detailed',
				loadingProgress: 100,
			});

			this.notifyListeners({ type: 'GAME_DETAILS_LOADED', gameId, data: detailedData });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to load game details';

			this.updateGameState(gameId, {
				loadingState: 'error',
				loadingProgress: 0,
			});

			this.notifyListeners({ type: 'GAME_DETAILS_ERROR', gameId, error: errorMessage });
		}
	}

	// Fetch detailed game data from API
	private async fetchGameDetails(gameId: string): Promise<Partial<Game>> {
		// Parse game ID to get gamePk
		const parts = gameId.split('-');
		if (parts.length < 6) {
			throw new Error('Invalid game ID format');
		}

		const date = `${parts[0]}-${parts[1]}-${parts[2]}`;
		const awayCode = parts[3];
		const homeCode = parts[4];
		const gameNumber = parseInt(parts[5]);

		// Fetch detailed game data from MLB API
		const response = await fetch(`/api/game/${gameId}`);
		if (!response.ok) {
			throw new Error(`Failed to fetch game details: ${response.status}`);
		}

		const gameData = await response.json();

		// Extract detailed data
		const detailedData = gameData.game_data;

		// Return the data in the format expected by the Game interface
		return {
			innings:
				detailedData.inning_list?.map((inning: any) => ({
					inning: inning.inning,
					away_runs: inning.away_runs || 0,
					home_runs: inning.home_runs || 0,
				})) || [],
			away_hits: detailedData.player_stats?.away?.hits || 0,
			home_hits: detailedData.player_stats?.home?.hits || 0,
			away_errors: detailedData.player_stats?.away?.errors || 0,
			home_errors: detailedData.player_stats?.home?.errors || 0,
		};
	}

	// Clear all data
	clear(): void {
		this.loadingStates.clear();
		this.loadingQueue.clear();
		this.listeners.clear();
	}
}

// Global instance
export const progressiveDataLoader = new ProgressiveDataLoader();
