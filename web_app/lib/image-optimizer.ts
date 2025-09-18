'use client';

import { resourceManager, ResourceUtils } from './resource-manager';

// Image loading configuration
interface ImageConfig {
	lazy: boolean;
	placeholder?: string;
	fallback?: string;
	maxSize?: number;
	quality?: number;
	format?: 'webp' | 'jpeg' | 'png' | 'svg';
}

// Image cache entry
interface ImageCacheEntry {
	url: string;
	element: HTMLImageElement;
	loaded: boolean;
	error: boolean;
	timestamp: number;
	size: number;
}

// Image optimizer class
class ImageOptimizer {
	private cache = new Map<string, ImageCacheEntry>();
	private loadingQueue: string[] = [];
	private maxCacheSize = 50 * 1024 * 1024; // 50MB
	private maxConcurrentLoads = 3;
	private currentLoads = 0;
	private observer: IntersectionObserver | null = null;

	constructor() {
		this.setupIntersectionObserver();
		this.registerWithResourceManager();
	}

	// Setup intersection observer for lazy loading
	private setupIntersectionObserver(): void {
		if (typeof window === 'undefined') return;

		// Temporarily disable intersection observer to reduce overhead
		// this.observer = new IntersectionObserver(
		// 	(entries) => {
		// 		entries.forEach((entry) => {
		// 			if (entry.isIntersecting) {
		// 				const img = entry.target as HTMLImageElement;
		// 				const src = img.dataset.src;
		// 				if (src) {
		// 					this.loadImage(src, img);
		// 				}
		// 			}
		// 		});
		// 	},
		// 	{
		// 		rootMargin: '50px',
		// 		threshold: 0.1,
		// 	}
		// );
	}

	// Register with resource manager
	private registerWithResourceManager(): void {
		ResourceUtils.registerCache(
			'image-optimizer',
			{
				clear: () => this.clearCache(),
			},
			this.getCacheSize()
		);
	}

	// Load image with optimization
	async loadImage(
		url: string,
		element?: HTMLImageElement,
		config: Partial<ImageConfig> = {}
	): Promise<HTMLImageElement> {
		const finalConfig: ImageConfig = {
			lazy: true,
			quality: 80,
			format: 'webp',
			maxSize: 1024,
			...config,
		};

		// Check cache first
		const cached = this.cache.get(url);
		if (cached && cached.loaded) {
			if (element) {
				element.src = cached.url;
				element.classList.remove('loading', 'error');
				element.classList.add('loaded');
			}
			return cached.element;
		}

		// Create new image element if not provided
		const img = element || new Image();

		// Set up loading states
		img.classList.add('loading');
		img.dataset.src = url;

		// Register with resource manager
		ResourceUtils.registerImage(`image-${url}`, img, this.estimateImageSize(url));

		// Load image
		return new Promise((resolve, reject) => {
			img.onload = () => {
				img.classList.remove('loading');
				img.classList.add('loaded');

				// Cache the image
				this.cacheImage(url, img);

				// Unobserve if lazy loading
				if (this.observer && img.dataset.src) {
					this.observer.unobserve(img);
					delete img.dataset.src;
				}

				resolve(img);
			};

			img.onerror = () => {
				img.classList.remove('loading');
				img.classList.add('error');

				// Try fallback if available
				if (finalConfig.fallback) {
					img.src = finalConfig.fallback;
				}

				reject(new Error(`Failed to load image: ${url}`));
			};

			// Start loading
			if (finalConfig.lazy && this.observer) {
				this.observer.observe(img);
			} else {
				img.src = url;
			}
		});
	}

	// Cache image
	private cacheImage(url: string, element: HTMLImageElement): void {
		const size = this.estimateImageSize(url);

		// Check cache size limit
		if (this.getCacheSize() + size > this.maxCacheSize) {
			this.evictOldestCache();
		}

		this.cache.set(url, {
			url,
			element,
			loaded: true,
			error: false,
			timestamp: Date.now(),
			size,
		});
	}

	// Evict oldest cache entries
	private evictOldestCache(): void {
		const entries = Array.from(this.cache.entries());
		entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);

		// Remove oldest 25% of entries
		const toRemove = Math.ceil(entries.length * 0.25);
		for (let i = 0; i < toRemove; i++) {
			const [url] = entries[i];
			this.cache.delete(url);
		}
	}

	// Estimate image size
	private estimateImageSize(url: string): number {
		// Rough estimation based on URL and format
		if (url.includes('.svg')) return 10 * 1024; // 10KB for SVG
		if (url.includes('.png')) return 100 * 1024; // 100KB for PNG
		if (url.includes('.jpg') || url.includes('.jpeg')) return 50 * 1024; // 50KB for JPEG
		if (url.includes('.webp')) return 30 * 1024; // 30KB for WebP
		return 50 * 1024; // Default 50KB
	}

	// Get cache size
	private getCacheSize(): number {
		let total = 0;
		this.cache.forEach((entry) => {
			total += entry.size;
		});
		return total;
	}

	// Clear cache
	clearCache(): void {
		this.cache.forEach((entry) => {
			entry.element.src = '';
			entry.element.onload = null;
			entry.element.onerror = null;
		});
		this.cache.clear();
	}

	// Get cache statistics
	getCacheStats(): {
		size: number;
		count: number;
		oldestEntry: number;
		newestEntry: number;
	} {
		const entries = Array.from(this.cache.values());
		return {
			size: this.getCacheSize(),
			count: this.cache.size,
			oldestEntry: entries.length > 0 ? Math.min(...entries.map((e) => e.timestamp)) : 0,
			newestEntry: entries.length > 0 ? Math.max(...entries.map((e) => e.timestamp)) : 0,
		};
	}

	// Preload images
	async preloadImages(urls: string[]): Promise<void> {
		const promises = urls.map((url) => this.loadImage(url, undefined, { lazy: false }));
		await Promise.allSettled(promises);
	}

	// Destroy the optimizer
	destroy(): void {
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}
		this.clearCache();
	}
}

// Team logo optimizer
class TeamLogoOptimizer {
	private optimizer: ImageOptimizer;
	private logoCache = new Map<string, string>();

	constructor() {
		this.optimizer = new ImageOptimizer();
		this.initializeLogoCache();
	}

	// Initialize logo cache with optimized URLs
	private initializeLogoCache(): void {
		const teams = [
			'ARI',
			'ATL',
			'BAL',
			'BOS',
			'CHC',
			'CWS',
			'CIN',
			'CLE',
			'COL',
			'DET',
			'HOU',
			'KC',
			'LAA',
			'LAD',
			'MIA',
			'MIL',
			'MIN',
			'NYM',
			'NYY',
			'OAK',
			'PHI',
			'PIT',
			'SD',
			'SEA',
			'SF',
			'STL',
			'TB',
			'TEX',
			'TOR',
			'WSH',
		];

		teams.forEach((team) => {
			// Use optimized logo URLs (you would replace these with your actual optimized logo URLs)
			this.logoCache.set(team, `/images/logos/${team.toLowerCase()}.webp`);
		});
	}

	// Get optimized logo URL
	getLogoUrl(teamCode: string): string {
		return this.logoCache.get(teamCode) || `/images/logos/default.webp`;
	}

	// Load team logo
	async loadTeamLogo(teamCode: string, element?: HTMLImageElement): Promise<HTMLImageElement> {
		const url = this.getLogoUrl(teamCode);
		return this.optimizer.loadImage(url, element, {
			lazy: true,
			format: 'webp',
			quality: 90,
			maxSize: 200,
			fallback: `/images/logos/default.png`,
		});
	}

	// Preload team logos
	async preloadTeamLogos(teamCodes: string[]): Promise<void> {
		const urls = teamCodes.map((code) => this.getLogoUrl(code));
		await this.optimizer.preloadImages(urls);
	}

	// Get optimizer
	getOptimizer(): ImageOptimizer {
		return this.optimizer;
	}
}

// Singleton instances
export const imageOptimizer = new ImageOptimizer();
export const teamLogoOptimizer = new TeamLogoOptimizer();

// Hook for using image optimizer
export function useImageOptimizer() {
	return imageOptimizer;
}

// Hook for using team logo optimizer
export function useTeamLogoOptimizer() {
	return teamLogoOptimizer;
}
