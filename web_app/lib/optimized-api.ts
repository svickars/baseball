'use client';

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { GamesResponse, GameData, TeamsResponse, ApiResponse } from '@/types';

// Retry configuration
interface RetryConfig {
	retries: number;
	retryDelay: number;
	retryCondition: (error: any) => boolean;
}

// Request queue for rate limiting
interface QueuedRequest {
	config: AxiosRequestConfig;
	resolve: (value: any) => void;
	reject: (reason: any) => void;
	timestamp: number;
}

class OptimizedApiClient {
	private api: AxiosInstance;
	private requestQueue: QueuedRequest[] = [];
	private isProcessingQueue = false;
	private activeRequests = 0;
	private maxConcurrentRequests = 5;
	private retryConfig: RetryConfig;
	private requestTimings = new Map<string, number>();

	constructor() {
		this.api = axios.create({
			baseURL: '',
			timeout: 30000,
			headers: {
				'Content-Type': 'application/json',
			},
		});

		this.retryConfig = {
			retries: 3,
			retryDelay: 1000,
			retryCondition: (error) => {
				// Retry on network errors or 5xx status codes
				return !error.response || error.response.status >= 500;
			},
		};

		this.setupInterceptors();
	}

	private setupInterceptors(): void {
		// Request interceptor
		this.api.interceptors.request.use(
			(config) => {
				// Add request timestamp for tracking
				const requestId = `${config.method}-${config.url}-${Date.now()}`;
				this.requestTimings.set(requestId, Date.now());
				(config as any).requestId = requestId;
				return config;
			},
			(error) => {
				console.error('API Request Error:', error);
				return Promise.reject(error);
			}
		);

		// Response interceptor
		this.api.interceptors.response.use(
			(response) => {
				// Log response time
				const requestId = (response.config as any).requestId;
				const startTime = this.requestTimings.get(requestId);
				if (startTime) {
					this.requestTimings.delete(requestId);
				}
				return response;
			},
			async (error) => {
				const config = error.config;

				// Check if we should retry
				if (this.shouldRetry(error, config)) {
					return this.retryRequest(config);
				}

				// Handle specific error types
				this.handleError(error);
				return Promise.reject(error);
			}
		);
	}

	private shouldRetry(error: any, config: any): boolean {
		// Don't retry if already retried max times
		if (config.__retryCount >= this.retryConfig.retries) {
			return false;
		}

		// Don't retry if retry count is not set
		if (!config.__retryCount) {
			config.__retryCount = 0;
		}

		// Check retry condition
		return this.retryConfig.retryCondition(error);
	}

	private async retryRequest(config: any): Promise<AxiosResponse> {
		config.__retryCount += 1;

		// Exponential backoff
		const delay = this.retryConfig.retryDelay * Math.pow(2, config.__retryCount - 1);

		await new Promise((resolve) => setTimeout(resolve, delay));

		return this.api(config);
	}

	private handleError(error: any): void {
		if (error.response?.status === 404) {
			throw new Error('Resource not found');
		} else if (error.response?.status >= 500) {
			throw new Error('Server error. Please try again later.');
		} else if (error.code === 'ECONNABORTED') {
			throw new Error('Request timeout. Please check your connection.');
		} else if (error.code === 'NETWORK_ERROR') {
			throw new Error('Network error. Please check your connection.');
		}
	}

	// Queue management
	private async processQueue(): Promise<void> {
		if (this.isProcessingQueue || this.requestQueue.length === 0) {
			return;
		}

		this.isProcessingQueue = true;

		while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
			const request = this.requestQueue.shift()!;
			this.activeRequests++;

			try {
				const response = await this.api(request.config);
				request.resolve(response.data);
			} catch (error) {
				request.reject(error);
			} finally {
				this.activeRequests--;
			}
		}

		this.isProcessingQueue = false;

		// Continue processing if there are more requests
		if (this.requestQueue.length > 0) {
			setTimeout(() => this.processQueue(), 100);
		}
	}

	private queueRequest<T>(config: AxiosRequestConfig): Promise<T> {
		return new Promise((resolve, reject) => {
			this.requestQueue.push({
				config,
				resolve,
				reject,
				timestamp: Date.now(),
			});

			this.processQueue();
		});
	}

	// API methods
	async getGamesForDate(date: string): Promise<GamesResponse> {
		try {
			return await this.queueRequest<GamesResponse>({
				method: 'GET',
				url: `/api/games/${date}`,
			});
		} catch (error) {
			console.error('Error fetching games:', error);
			throw error;
		}
	}

	async getGameDetails(gameId: string): Promise<GameData> {
		try {
			return await this.queueRequest<GameData>({
				method: 'GET',
				url: `/api/game/${gameId}`,
			});
		} catch (error) {
			console.error('Error fetching game details:', error);
			throw error;
		}
	}

	async getGameSVG(gameId: string): Promise<string> {
		try {
			return await this.queueRequest<string>({
				method: 'GET',
				url: `/api/game/${gameId}/svg`,
				responseType: 'text',
			});
		} catch (error) {
			console.error('Error fetching game SVG:', error);
			throw error;
		}
	}

	async getTeams(): Promise<TeamsResponse> {
		try {
			return await this.queueRequest<TeamsResponse>({
				method: 'GET',
				url: '/api/teams',
			});
		} catch (error) {
			console.error('Error fetching teams:', error);
			throw error;
		}
	}

	async getTodaysGames(): Promise<GamesResponse> {
		try {
			return await this.queueRequest<GamesResponse>({
				method: 'GET',
				url: '/api/today',
			});
		} catch (error) {
			console.error("Error fetching today's games:", error);
			throw error;
		}
	}

	async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string; version: string }>> {
		try {
			return await this.queueRequest<ApiResponse<{ status: string; timestamp: string; version: string }>>({
				method: 'GET',
				url: '/api/health',
			});
		} catch (error) {
			console.error('Error checking health:', error);
			throw error;
		}
	}

	// Batch requests for multiple games
	async getMultipleGameDetails(gameIds: string[]): Promise<GameData[]> {
		const promises = gameIds.map((gameId) => this.getGameDetails(gameId));
		return Promise.allSettled(promises).then((results) =>
			results
				.filter((result) => result.status === 'fulfilled')
				.map((result) => (result as PromiseFulfilledResult<GameData>).value)
		);
	}

	// Get queue statistics
	getQueueStats(): {
		queued: number;
		active: number;
		maxConcurrent: number;
	} {
		return {
			queued: this.requestQueue.length,
			active: this.activeRequests,
			maxConcurrent: this.maxConcurrentRequests,
		};
	}

	// Clear queue
	clearQueue(): void {
		this.requestQueue.forEach((request) => {
			request.reject(new Error('Request cancelled'));
		});
		this.requestQueue = [];
	}

	// Update retry configuration
	updateRetryConfig(config: Partial<RetryConfig>): void {
		this.retryConfig = { ...this.retryConfig, ...config };
	}
}

// Singleton instance
export const optimizedApi = new OptimizedApiClient();

// Export for backward compatibility
export const baseballApi = optimizedApi;
