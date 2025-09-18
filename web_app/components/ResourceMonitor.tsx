'use client';

import React, { useState, useEffect, useRef } from 'react';
import { resourceManager } from '@/lib/resource-manager';
import { imageOptimizer } from '@/lib/image-optimizer';
import { teamLogoOptimizer } from '@/lib/image-optimizer';

interface ResourceMonitorProps {
	show?: boolean;
	position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
	updateInterval?: number;
	className?: string;
}

export default function ResourceMonitor({
	show = false,
	position = 'bottom-right',
	updateInterval = 1000,
	className = '',
}: ResourceMonitorProps) {
	const [stats, setStats] = useState({
		resources: resourceManager.getMemoryStats(),
		images: imageOptimizer.getCacheStats(),
		teamLogos: teamLogoOptimizer.getOptimizer().getCacheStats(),
	});
	const [isVisible, setIsVisible] = useState(show);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	// Update stats periodically
	useEffect(() => {
		if (!isVisible) return;

		const updateStats = () => {
			setStats({
				resources: resourceManager.getMemoryStats(),
				images: imageOptimizer.getCacheStats(),
				teamLogos: teamLogoOptimizer.getOptimizer().getCacheStats(),
			});
		};

		intervalRef.current = setInterval(updateStats, updateInterval);
		updateStats(); // Initial update

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, [isVisible, updateInterval]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, []);

	// Format bytes
	const formatBytes = (bytes: number): string => {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	};

	// Format time
	const formatTime = (timestamp: number): string => {
		const age = Date.now() - timestamp;
		if (age < 60000) return `${Math.floor(age / 1000)}s`;
		if (age < 3600000) return `${Math.floor(age / 60000)}m`;
		return `${Math.floor(age / 3600000)}h`;
	};

	// Get position classes
	const getPositionClasses = (): string => {
		switch (position) {
			case 'top-left':
				return 'top-4 left-4';
			case 'top-right':
				return 'top-4 right-4';
			case 'bottom-left':
				return 'bottom-4 left-4';
			case 'bottom-right':
			default:
				return 'bottom-4 right-4';
		}
	};

	// Toggle visibility
	const toggleVisibility = () => {
		setIsVisible(!isVisible);
	};

	// Clean up resources
	const cleanupResources = () => {
		resourceManager.cleanupOld();
		imageOptimizer.clearCache();
		teamLogoOptimizer.getOptimizer().clearCache();
	};

	if (!isVisible) {
		return (
			<button
				onClick={toggleVisibility}
				className={`fixed ${getPositionClasses()} z-50 p-2 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-colors ${className}`}
				title="Show Resource Monitor">
				📊
			</button>
		);
	}

	return (
		<div
			className={`fixed ${getPositionClasses()} z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 max-w-sm ${className}`}>
			<div className="flex items-center justify-between mb-3">
				<h3 className="text-sm font-semibold text-gray-900 dark:text-white">Resource Monitor</h3>
				<div className="flex space-x-2">
					<button
						onClick={cleanupResources}
						className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
						title="Cleanup Resources">
						🧹
					</button>
					<button
						onClick={toggleVisibility}
						className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
						title="Hide Monitor">
						✕
					</button>
				</div>
			</div>

			<div className="space-y-3 text-xs">
				{/* Resource Manager Stats */}
				<div className="border-b border-gray-200 dark:border-gray-700 pb-2">
					<h4 className="font-medium text-gray-900 dark:text-white mb-1">Resource Manager</h4>
					<div className="space-y-1 text-gray-600 dark:text-gray-400">
						<div>Total: {formatBytes(stats.resources.totalSize)}</div>
						<div>Resources: {stats.resources.resourceCount}</div>
						<div>Oldest: {formatTime(stats.resources.oldestResource)}</div>
						<div>Newest: {formatTime(stats.resources.newestResource)}</div>
					</div>
				</div>

				{/* Resource Types */}
				<div className="border-b border-gray-200 dark:border-gray-700 pb-2">
					<h4 className="font-medium text-gray-900 dark:text-white mb-1">By Type</h4>
					<div className="space-y-1 text-gray-600 dark:text-gray-400">
						{Object.entries(stats.resources.byType).map(([type, data]) => (
							<div key={type} className="flex justify-between">
								<span className="capitalize">{type}:</span>
								<span>
									{data.count} ({formatBytes(data.size)})
								</span>
							</div>
						))}
					</div>
				</div>

				{/* Image Cache Stats */}
				<div className="border-b border-gray-200 dark:border-gray-700 pb-2">
					<h4 className="font-medium text-gray-900 dark:text-white mb-1">Image Cache</h4>
					<div className="space-y-1 text-gray-600 dark:text-gray-400">
						<div>Size: {formatBytes(stats.images.size)}</div>
						<div>Count: {stats.images.count}</div>
						<div>Oldest: {formatTime(stats.images.oldestEntry)}</div>
					</div>
				</div>

				{/* Team Logo Cache Stats */}
				<div>
					<h4 className="font-medium text-gray-900 dark:text-white mb-1">Team Logo Cache</h4>
					<div className="space-y-1 text-gray-600 dark:text-gray-400">
						<div>Size: {formatBytes(stats.teamLogos.size)}</div>
						<div>Count: {stats.teamLogos.count}</div>
						<div>Oldest: {formatTime(stats.teamLogos.oldestEntry)}</div>
					</div>
				</div>
			</div>
		</div>
	);
}

// Development-only resource monitor
export function DevResourceMonitor(props: Partial<ResourceMonitorProps> = {}) {
	if (process.env.NODE_ENV !== 'development') {
		return null;
	}

	return <ResourceMonitor show={true} {...props} />;
}

// Production resource monitor (hidden by default)
export function ProdResourceMonitor(props: Partial<ResourceMonitorProps> = {}) {
	return <ResourceMonitor show={false} {...props} />;
}
