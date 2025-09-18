'use client';

import { useEffect, useRef, useCallback } from 'react';
import { resourceManager, ResourceUtils } from '@/lib/resource-manager';

// Cleanup function type
type CleanupFunction = () => void;

// Resource types for cleanup
type ResourceType = 'interval' | 'listener' | 'cache' | 'image' | 'svg' | 'data';

// Resource cleanup hook
export function useResourceCleanup() {
	const cleanupFunctions = useRef<CleanupFunction[]>([]);
	const resourceIds = useRef<string[]>([]);

	// Add cleanup function
	const addCleanup = useCallback((cleanup: CleanupFunction) => {
		cleanupFunctions.current.push(cleanup);
	}, []);

	// Register interval resource
	const registerInterval = useCallback((id: string, interval: NodeJS.Timeout) => {
		ResourceUtils.registerInterval(id, interval);
		resourceIds.current.push(id);
	}, []);

	// Register listener resource
	const registerListener = useCallback((id: string, cleanup: CleanupFunction) => {
		ResourceUtils.registerListener(id, cleanup);
		resourceIds.current.push(id);
	}, []);

	// Register cache resource
	const registerCache = useCallback((id: string, cache: { clear: () => void }, size?: number) => {
		ResourceUtils.registerCache(id, cache, size);
		resourceIds.current.push(id);
	}, []);

	// Register image resource
	const registerImage = useCallback((id: string, image: HTMLImageElement, size?: number) => {
		ResourceUtils.registerImage(id, image, size);
		resourceIds.current.push(id);
	}, []);

	// Register SVG resource
	const registerSVG = useCallback((id: string, svg: SVGElement, size?: number) => {
		ResourceUtils.registerSVG(id, svg, size);
		resourceIds.current.push(id);
	}, []);

	// Register data resource
	const registerData = useCallback((id: string, data: any, cleanup: CleanupFunction, size?: number) => {
		ResourceUtils.registerData(id, data, cleanup, size);
		resourceIds.current.push(id);
	}, []);

	// Unregister resource
	const unregisterResource = useCallback((id: string) => {
		resourceManager.unregister(id);
		resourceIds.current = resourceIds.current.filter((resourceId) => resourceId !== id);
	}, []);

	// Cleanup all resources
	const cleanupAll = useCallback(() => {
		// Run cleanup functions
		cleanupFunctions.current.forEach((cleanup) => {
			try {
				cleanup();
			} catch (error) {
				console.error('Error during cleanup:', error);
			}
		});

		// Unregister all resources
		resourceIds.current.forEach((id) => {
			resourceManager.unregister(id);
		});

		// Clear arrays
		cleanupFunctions.current = [];
		resourceIds.current = [];
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return cleanupAll;
	}, [cleanupAll]);

	// Return cleanup utilities
	return {
		addCleanup,
		registerInterval,
		registerListener,
		registerCache,
		registerImage,
		registerSVG,
		registerData,
		unregisterResource,
		cleanupAll,
	};
}

// Hook for managing intervals
export function useManagedInterval(callback: () => void, delay: number | null, id?: string): void {
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const { registerInterval, unregisterResource } = useResourceCleanup();

	useEffect(() => {
		if (delay !== null) {
			intervalRef.current = setInterval(callback, delay);

			// Register with resource manager
			if (id) {
				registerInterval(id, intervalRef.current);
			}
		}

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				if (id) {
					unregisterResource(id);
				}
			}
		};
	}, [callback, delay, id, registerInterval, unregisterResource]);
}

// Hook for managing timeouts
export function useManagedTimeout(callback: () => void, delay: number | null, id?: string): void {
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	const { addCleanup } = useResourceCleanup();

	useEffect(() => {
		if (delay !== null) {
			timeoutRef.current = setTimeout(callback, delay);

			// Add cleanup function
			if (id) {
				addCleanup(() => {
					if (timeoutRef.current) {
						clearTimeout(timeoutRef.current);
					}
				});
			}
		}

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [callback, delay, id, addCleanup]);
}

// Hook for managing event listeners
export function useManagedEventListener<T extends keyof WindowEventMap>(
	event: T,
	handler: (event: WindowEventMap[T]) => void,
	options?: AddEventListenerOptions,
	id?: string
): void {
	const { registerListener, unregisterResource } = useResourceCleanup();

	useEffect(() => {
		// Register event listener
		window.addEventListener(event, handler, options);

		// Register with resource manager
		if (id) {
			registerListener(id, () => {
				window.removeEventListener(event, handler, options);
			});
		}

		return () => {
			window.removeEventListener(event, handler, options);
			if (id) {
				unregisterResource(id);
			}
		};
	}, [event, handler, options, id, registerListener, unregisterResource]);
}

// Hook for managing DOM element event listeners
export function useManagedElementEventListener<T extends HTMLElement, K extends keyof HTMLElementEventMap>(
	element: T | null,
	event: K,
	handler: (event: HTMLElementEventMap[K]) => void,
	options?: AddEventListenerOptions,
	id?: string
): void {
	const { registerListener, unregisterResource } = useResourceCleanup();

	useEffect(() => {
		if (element) {
			// Register event listener
			element.addEventListener(event, handler, options);

			// Register with resource manager
			if (id) {
				registerListener(id, () => {
					element.removeEventListener(event, handler, options);
				});
			}
		}

		return () => {
			if (element) {
				element.removeEventListener(event, handler, options);
				if (id) {
					unregisterResource(id);
				}
			}
		};
	}, [element, event, handler, options, id, registerListener, unregisterResource]);
}

// Hook for managing AbortController
export function useManagedAbortController(id?: string): AbortController {
	const controllerRef = useRef<AbortController | null>(null);
	const { addCleanup } = useResourceCleanup();

	useEffect(() => {
		controllerRef.current = new AbortController();

		// Add cleanup function
		if (id) {
			addCleanup(() => {
				if (controllerRef.current) {
					controllerRef.current.abort();
				}
			});
		}

		return () => {
			if (controllerRef.current) {
				controllerRef.current.abort();
			}
		};
	}, [id, addCleanup]);

	return controllerRef.current || new AbortController();
}

// Hook for managing IntersectionObserver
export function useManagedIntersectionObserver(
	callback: IntersectionObserverCallback,
	options?: IntersectionObserverInit,
	id?: string
): IntersectionObserver | null {
	const observerRef = useRef<IntersectionObserver | null>(null);
	const { registerListener, unregisterResource } = useResourceCleanup();

	useEffect(() => {
		if (typeof window !== 'undefined') {
			observerRef.current = new IntersectionObserver(callback, options);

			// Register with resource manager
			if (id) {
				registerListener(id, () => {
					if (observerRef.current) {
						observerRef.current.disconnect();
					}
				});
			}
		}

		return () => {
			if (observerRef.current) {
				observerRef.current.disconnect();
				if (id) {
					unregisterResource(id);
				}
			}
		};
	}, [callback, options, id, registerListener, unregisterResource]);

	return observerRef.current;
}

// Hook for managing MutationObserver
export function useManagedMutationObserver(
	callback: MutationCallback,
	options?: MutationObserverInit,
	id?: string
): MutationObserver | null {
	const observerRef = useRef<MutationObserver | null>(null);
	const { registerListener, unregisterResource } = useResourceCleanup();

	useEffect(() => {
		if (typeof window !== 'undefined') {
			observerRef.current = new MutationObserver(callback);

			// Register with resource manager
			if (id) {
				registerListener(id, () => {
					if (observerRef.current) {
						observerRef.current.disconnect();
					}
				});
			}
		}

		return () => {
			if (observerRef.current) {
				observerRef.current.disconnect();
				if (id) {
					unregisterResource(id);
				}
			}
		};
	}, [callback, options, id, registerListener, unregisterResource]);

	return observerRef.current;
}
