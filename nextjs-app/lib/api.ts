import axios from 'axios';
import { GamesResponse, GameData, TeamsResponse, ApiResponse } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

const api = axios.create({
	baseURL: API_BASE_URL,
	timeout: 30000,
	headers: {
		'Content-Type': 'application/json',
	},
});

// Request interceptor for logging
api.interceptors.request.use(
	(config) => {
		console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
		return config;
	},
	(error) => {
		console.error('API Request Error:', error);
		return Promise.reject(error);
	}
);

// Response interceptor for error handling
api.interceptors.response.use(
	(response) => {
		return response;
	},
	(error) => {
		console.error('API Response Error:', error);
		if (error.response?.status === 404) {
			throw new Error('Resource not found');
		} else if (error.response?.status >= 500) {
			throw new Error('Server error. Please try again later.');
		} else if (error.code === 'ECONNABORTED') {
			throw new Error('Request timeout. Please check your connection.');
		}
		throw error;
	}
);

export const baseballApi = {
	// Get games for a specific date
	async getGamesForDate(date: string): Promise<GamesResponse> {
		try {
			const response = await api.get(`/api/games/${date}`);
			return response.data;
		} catch (error) {
			console.error('Error fetching games:', error);
			throw error;
		}
	},

	// Get detailed game data
	async getGameDetails(gameId: string): Promise<GameData> {
		try {
			const response = await api.get(`/api/game/${gameId}`);
			return response.data;
		} catch (error) {
			console.error('Error fetching game details:', error);
			throw error;
		}
	},

	// Get game SVG
	async getGameSVG(gameId: string): Promise<string> {
		try {
			const response = await api.get(`/api/game/${gameId}/svg`, {
				responseType: 'text',
			});
			return response.data;
		} catch (error) {
			console.error('Error fetching game SVG:', error);
			throw error;
		}
	},

	// Get teams list
	async getTeams(): Promise<TeamsResponse> {
		try {
			const response = await api.get('/api/teams');
			return response.data;
		} catch (error) {
			console.error('Error fetching teams:', error);
			throw error;
		}
	},

	// Get today's games
	async getTodaysGames(): Promise<GamesResponse> {
		try {
			const response = await api.get('/api/today');
			return response.data;
		} catch (error) {
			console.error("Error fetching today's games:", error);
			throw error;
		}
	},

	// Health check
	async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string; version: string }>> {
		try {
			const response = await api.get('/api/health');
			return response.data;
		} catch (error) {
			console.error('Error checking health:', error);
			throw error;
		}
	},
};

export default api;
