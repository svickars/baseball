'use client';

import { baseballApi } from './api';
import { Game, GameData } from '@/types';

// Prefetcher configuration
interface PrefetchConfig {
	maxConcurrent: number;
	batchSize: number;
	prefetchDelay: number; // ms to wait before prefetching
	retryAttempts: number;
	retryDelay: number;
}

const defaultConfig: PrefetchConfig = {
	maxConcurrent: 3,
	batchSize: 5,
	prefetchDelay: 1000,
	retryAttempts: 3,
	retryDelay: 1000,
};

// Prefetcher state
interface PrefetchState {
	pending: Set<string>;
	inProgress: Set<string>;
	completed: Set<string>;
	failed: Set<string>;
	cache: Map<string, GameData>;
	retryCount: Map<string, number>;
}

class DataPrefetcher {
	private config: PrefetchConfig;
	private state: PrefetchState;
	private listeners: Map<string, Array<(data: GameData | null, error?: Error) => void>>;

	constructor(config: Partial<PrefetchConfig> = {}) {
		this.config = { ...defaultConfig, ...config };
		this.state = {
			pending: new Set(),
			inProgress: new Set(),
			completed: new Set(),
			failed: new Set(),
			cache: new Map(),
			retryCount: new Map(),
		};
		this.listeners = new Map();
	}

	// Prefetch game details for a list of games
	async prefetchGames(games: Game[]): Promise<void> {
		// Filter out games that are already cached or in progress
		const gamesToPrefetch = games.filter(
			(game) =>
				!this.state.cache.has(game.id) && !this.state.inProgress.has(game.id) && !this.state.pending.has(game.id)
		);

		// Add to pending queue
		gamesToPrefetch.forEach((game) => {
			this.state.pending.add(game.id);
		});

		// Start prefetching in batches
		this.processBatch();
	}

	// Get game data (from cache or fetch if needed)
	async getGameData(gameId: string): Promise<GameData | null> {
		// Return cached data if available
		if (this.state.cache.has(gameId)) {
			return this.state.cache.get(gameId)!;
		}

		// If already in progress, wait for it
		if (this.state.inProgress.has(gameId)) {
			return this.waitForGameData(gameId);
		}

		// Fetch immediately
		try {
			const data = await this.fetchGameData(gameId);
			this.state.cache.set(gameId, data);
			this.state.completed.add(gameId);
			return data;
		} catch (error) {
			this.state.failed.add(gameId);
			console.error(`Failed to fetch game data for ${gameId}:`, error);
			return null;
		}
	}

	// Process a batch of pending requests
	private async processBatch(): Promise<void> {
		const batch = Array.from(this.state.pending).slice(0, this.config.batchSize);

		if (batch.length === 0) return;

		// Move from pending to in progress
		batch.forEach((gameId) => {
			this.state.pending.delete(gameId);
			this.state.inProgress.add(gameId);
		});

		// Process batch concurrently (limited by maxConcurrent)
		const chunks = this.chunkArray(batch, this.config.maxConcurrent);

		for (const chunk of chunks) {
			const promises = chunk.map((gameId) => this.fetchGameDataWithRetry(gameId));
			await Promise.allSettled(promises);
		}

		// Process next batch if there are more pending requests
		if (this.state.pending.size > 0) {
			setTimeout(() => this.processBatch(), this.config.prefetchDelay);
		}
	}

	// Fetch game data with retry logic
	private async fetchGameDataWithRetry(gameId: string): Promise<void> {
		const retryCount = this.state.retryCount.get(gameId) || 0;

		try {
			const data = await this.fetchGameData(gameId);
			this.state.cache.set(gameId, data);
			this.state.completed.add(gameId);
			this.state.retryCount.delete(gameId);

			// Notify listeners
			this.notifyListeners(gameId, data, null);
		} catch (error) {
			this.state.retryCount.set(gameId, retryCount + 1);

			if (retryCount < this.config.retryAttempts) {
				// Retry after delay
				setTimeout(() => {
					this.state.inProgress.delete(gameId);
					this.state.pending.add(gameId);
					this.processBatch();
				}, this.config.retryDelay * Math.pow(2, retryCount)); // Exponential backoff
			} else {
				// Max retries exceeded
				this.state.failed.add(gameId);
				this.state.retryCount.delete(gameId);
				this.notifyListeners(gameId, null, error as Error);
			}
		} finally {
			this.state.inProgress.delete(gameId);
		}
	}

	// Fetch game data from API
	private async fetchGameData(gameId: string): Promise<GameData> {
		const response = await baseballApi.getGameDetails(gameId);
		if (!response.success) {
			throw new Error('Failed to fetch game data');
		}
		return response;
	}

	// Wait for game data to be available
	private waitForGameData(gameId: string): Promise<GameData | null> {
		return new Promise((resolve) => {
			const listener = (data: GameData | null, error?: Error) => {
				this.removeListener(gameId, listener);
				resolve(data);
			};
			this.addListener(gameId, listener);
		});
	}

	// Add listener for game data
	private addListener(gameId: string, listener: (data: GameData | null, error?: Error) => void): void {
		if (!this.listeners.has(gameId)) {
			this.listeners.set(gameId, []);
		}
		this.listeners.get(gameId)!.push(listener);
	}

	// Remove listener
	private removeListener(gameId: string, listener: (data: GameData | null, error?: Error) => void): void {
		const listeners = this.listeners.get(gameId);
		if (listeners) {
			const index = listeners.indexOf(listener);
			if (index > -1) {
				listeners.splice(index, 1);
			}
		}
	}

	// Notify all listeners for a game
	private notifyListeners(gameId: string, data: GameData | null, error?: Error): void {
		const listeners = this.listeners.get(gameId);
		if (listeners) {
			listeners.forEach((listener) => listener(data, error));
		}
	}

	// Utility function to chunk array
	private chunkArray<T>(array: T[], size: number): T[][] {
		const chunks: T[][] = [];
		for (let i = 0; i < array.length; i += size) {
			chunks.push(array.slice(i, i + size));
		}
		return chunks;
	}

	// Clear cache for a specific game
	clearGameCache(gameId: string): void {
		this.state.cache.delete(gameId);
		this.state.completed.delete(gameId);
		this.state.failed.delete(gameId);
		this.state.retryCount.delete(gameId);
	}

	// Clear all cache
	clearAllCache(): void {
		this.state.cache.clear();
		this.state.completed.clear();
		this.state.failed.clear();
		this.state.retryCount.clear();
		this.state.pending.clear();
		this.state.inProgress.clear();
	}

	// Get cache statistics
	getCacheStats(): {
		cached: number;
		pending: number;
		inProgress: number;
		failed: number;
	} {
		return {
			cached: this.state.cache.size,
			pending: this.state.pending.size,
			inProgress: this.state.inProgress.size,
			failed: this.state.failed.size,
		};
	}

	// Check if game is cached
	isGameCached(gameId: string): boolean {
		return this.state.cache.has(gameId);
	}

	// Get cached game data
	getCachedGameData(gameId: string): GameData | null {
		return this.state.cache.get(gameId) || null;
	}
}

// Singleton instance
export const dataPrefetcher = new DataPrefetcher();

// Hook for using the prefetcher
export function useDataPrefetcher() {
	return dataPrefetcher;
}
