'use client';

// Resource types
export type ResourceType = 'cache' | 'interval' | 'listener' | 'image' | 'svg' | 'data';

// Resource interface
interface Resource {
	id: string;
	type: ResourceType;
	created: number;
	lastAccessed: number;
	size?: number;
	cleanup: () => void;
	metadata?: Record<string, any>;
}

// Memory usage tracking
interface MemoryStats {
	totalSize: number;
	resourceCount: number;
	byType: Record<ResourceType, { count: number; size: number }>;
	oldestResource: number;
	newestResource: number;
}

// Resource manager class
class ResourceManager {
	private resources = new Map<string, Resource>();
	private cleanupInterval: NodeJS.Timeout | null = null;
	private memoryThreshold = 100 * 1024 * 1024; // 100MB default threshold
	private maxResourceAge = 30 * 60 * 1000; // 30 minutes default max age
	private isMonitoring = false;

	constructor() {
		this.startMonitoring();
	}

	// Register a resource
	register(id: string, type: ResourceType, cleanup: () => void, size?: number, metadata?: Record<string, any>): void {
		// Remove existing resource with same ID
		this.unregister(id);

		const resource: Resource = {
			id,
			type,
			created: Date.now(),
			lastAccessed: Date.now(),
			size: size || 0,
			cleanup,
			metadata,
		};

		this.resources.set(id, resource);
		this.logResourceAction('register', id, type, size);
	}

	// Unregister a resource
	unregister(id: string): boolean {
		const resource = this.resources.get(id);
		if (resource) {
			resource.cleanup();
			this.resources.delete(id);
			this.logResourceAction('unregister', id, resource.type, resource.size);
			return true;
		}
		return false;
	}

	// Access a resource (updates last accessed time)
	access(id: string): boolean {
		const resource = this.resources.get(id);
		if (resource) {
			resource.lastAccessed = Date.now();
			return true;
		}
		return false;
	}

	// Get resource information
	getResource(id: string): Resource | null {
		return this.resources.get(id) || null;
	}

	// Clean up resources by type
	cleanupByType(type: ResourceType): number {
		let cleaned = 0;
		const toDelete: string[] = [];

		this.resources.forEach((resource, id) => {
			if (resource.type === type) {
				resource.cleanup();
				toDelete.push(id);
				cleaned++;
			}
		});

		toDelete.forEach((id) => this.resources.delete(id));
		this.logResourceAction('cleanupByType', type, type, cleaned);
		return cleaned;
	}

	// Clean up old resources
	cleanupOld(maxAge?: number): number {
		const age = maxAge || this.maxResourceAge;
		const cutoff = Date.now() - age;
		let cleaned = 0;
		const toDelete: string[] = [];

		this.resources.forEach((resource, id) => {
			if (resource.lastAccessed < cutoff) {
				resource.cleanup();
				toDelete.push(id);
				cleaned++;
			}
		});

		toDelete.forEach((id) => this.resources.delete(id));
		this.logResourceAction('cleanupOld', 'multiple', 'multiple', cleaned);
		return cleaned;
	}

	// Clean up resources by memory usage
	cleanupByMemory(): number {
		const stats = this.getMemoryStats();
		if (stats.totalSize <= this.memoryThreshold) {
			return 0;
		}

		// Sort resources by last accessed time (oldest first)
		const sortedResources = Array.from(this.resources.entries()).sort(
			([, a], [, b]) => a.lastAccessed - b.lastAccessed
		);

		let cleaned = 0;
		let freedSize = 0;
		const targetSize = this.memoryThreshold * 0.8; // Clean up to 80% of threshold

		for (const [id, resource] of sortedResources) {
			if (stats.totalSize - freedSize <= targetSize) {
				break;
			}

			resource.cleanup();
			this.resources.delete(id);
			freedSize += resource.size || 0;
			cleaned++;
		}

		this.logResourceAction('cleanupByMemory', 'multiple', 'multiple', cleaned, freedSize);
		return cleaned;
	}

	// Get memory statistics
	getMemoryStats(): MemoryStats {
		let totalSize = 0;
		let resourceCount = 0;
		let oldestResource = Date.now();
		let newestResource = 0;

		const byType: Record<ResourceType, { count: number; size: number }> = {
			cache: { count: 0, size: 0 },
			interval: { count: 0, size: 0 },
			listener: { count: 0, size: 0 },
			image: { count: 0, size: 0 },
			svg: { count: 0, size: 0 },
			data: { count: 0, size: 0 },
		};

		this.resources.forEach((resource) => {
			totalSize += resource.size || 0;
			resourceCount++;

			if (resource.created < oldestResource) {
				oldestResource = resource.created;
			}
			if (resource.created > newestResource) {
				newestResource = resource.created;
			}

			byType[resource.type].count++;
			byType[resource.type].size += resource.size || 0;
		});

		return {
			totalSize,
			resourceCount,
			byType,
			oldestResource,
			newestResource,
		};
	}

	// Start monitoring
	startMonitoring(): void {
		if (this.isMonitoring) return;

		this.isMonitoring = true;
		// Temporarily disable automatic cleanup to reduce overhead
		// this.cleanupInterval = setInterval(() => {
		// 	this.performMaintenance();
		// }, 60000); // Check every minute
	}

	// Stop monitoring
	stopMonitoring(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
		this.isMonitoring = false;
	}

	// Perform maintenance
	private performMaintenance(): void {
		const stats = this.getMemoryStats();

		// Clean up old resources
		this.cleanupOld();

		// Clean up by memory if needed
		if (stats.totalSize > this.memoryThreshold) {
			this.cleanupByMemory();
		}
	}

	// Set memory threshold
	setMemoryThreshold(threshold: number): void {
		this.memoryThreshold = threshold;
	}

	// Set max resource age
	setMaxResourceAge(maxAge: number): void {
		this.maxResourceAge = maxAge;
	}

	// Clear all resources
	clearAll(): void {
		const count = this.resources.size;
		this.resources.forEach((resource) => resource.cleanup());
		this.resources.clear();
		this.logResourceAction('clearAll', 'all', 'all', count);
	}

	// Format bytes for display
	private formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	// Log resource actions
	private logResourceAction(
		action: string,
		id: string,
		type: ResourceType | 'multiple' | 'all',
		count?: number,
		size?: number
	): void {
		if (process.env.NODE_ENV === 'development') {
			console.log(`Resource Manager: ${action}`, {
				id,
				type,
				count,
				size: size ? this.formatBytes(size) : undefined,
			});
		}
	}

	// Get resource count by type
	getResourceCount(type: ResourceType): number {
		let count = 0;
		this.resources.forEach((resource) => {
			if (resource.type === type) count++;
		});
		return count;
	}

	// Check if resource exists
	hasResource(id: string): boolean {
		return this.resources.has(id);
	}

	// Get all resource IDs
	getResourceIds(): string[] {
		return Array.from(this.resources.keys());
	}

	// Get resources by type
	getResourcesByType(type: ResourceType): Resource[] {
		const resources: Resource[] = [];
		this.resources.forEach((resource) => {
			if (resource.type === type) {
				resources.push(resource);
			}
		});
		return resources;
	}

	// Destroy the resource manager
	destroy(): void {
		this.stopMonitoring();
		this.clearAll();
	}
}

// Singleton instance
export const resourceManager = new ResourceManager();

// Utility functions for common resource types
export const ResourceUtils = {
	// Register a cache resource
	registerCache(id: string, cache: { clear: () => void }, size?: number): void {
		resourceManager.register(id, 'cache', () => cache.clear(), size);
	},

	// Register an interval resource
	registerInterval(id: string, interval: NodeJS.Timeout): void {
		resourceManager.register(id, 'interval', () => clearInterval(interval));
	},

	// Register a listener resource
	registerListener(id: string, cleanup: () => void): void {
		resourceManager.register(id, 'listener', cleanup);
	},

	// Register an image resource
	registerImage(id: string, image: HTMLImageElement, size?: number): void {
		resourceManager.register(
			id,
			'image',
			() => {
				image.src = '';
				image.onload = null;
				image.onerror = null;
			},
			size
		);
	},

	// Register SVG resource
	registerSVG(id: string, svg: SVGElement, size?: number): void {
		resourceManager.register(
			id,
			'svg',
			() => {
				if (svg.parentNode) {
					svg.parentNode.removeChild(svg);
				}
			},
			size
		);
	},

	// Register data resource
	registerData(id: string, data: any, cleanup: () => void, size?: number): void {
		resourceManager.register(id, 'data', cleanup, size);
	},
};

// Hook for using resource manager
export function useResourceManager() {
	return resourceManager;
}
