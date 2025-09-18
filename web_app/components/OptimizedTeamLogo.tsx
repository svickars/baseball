'use client';

import React, { useState, useEffect, useRef } from 'react';
import { teamLogoOptimizer } from '@/lib/image-optimizer';
import { resourceManager } from '@/lib/resource-manager';

interface OptimizedTeamLogoProps {
	teamCode: string;
	size?: number | string;
	className?: string;
	lazy?: boolean;
	showFallback?: boolean;
	onLoad?: () => void;
	onError?: () => void;
}

export default function OptimizedTeamLogo({
	teamCode,
	size = 100,
	className = '',
	lazy = true,
	showFallback = true,
	onLoad,
	onError,
}: OptimizedTeamLogoProps) {
	const [isLoaded, setIsLoaded] = useState(false);
	const [hasError, setHasError] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const imgRef = useRef<HTMLImageElement>(null);

	// Load the team logo
	useEffect(() => {
		if (!teamCode) return;

		const loadLogo = async () => {
			try {
				setIsLoading(true);
				setHasError(false);

				await teamLogoOptimizer.loadTeamLogo(teamCode, imgRef.current || undefined);

				setIsLoaded(true);
				setIsLoading(false);
				onLoad?.();
			} catch (error) {
				console.error(`Failed to load logo for team ${teamCode}:`, error);
				setHasError(true);
				setIsLoading(false);
				onError?.();
			}
		};

		loadLogo();
	}, [teamCode, onLoad, onError]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (imgRef.current) {
				resourceManager.unregister(`team-logo-${teamCode}`);
			}
		};
	}, [teamCode]);

	// Handle image load
	const handleLoad = () => {
		setIsLoaded(true);
		setIsLoading(false);
		onLoad?.();
	};

	// Handle image error
	const handleError = () => {
		setHasError(true);
		setIsLoading(false);
		onError?.();
	};

	// Render loading state
	if (isLoading) {
		return (
			<div
				className={`flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded ${className}`}
				style={{ width: size, height: size }}>
				<div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
			</div>
		);
	}

	// Render error state
	if (hasError && showFallback) {
		return (
			<div
				className={`flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400 text-xs font-medium ${className}`}
				style={{ width: size, height: size }}>
				{teamCode}
			</div>
		);
	}

	// Render the logo
	return (
		<img
			ref={imgRef}
			src={teamLogoOptimizer.getLogoUrl(teamCode)}
			alt={`${teamCode} team logo`}
			className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
			style={{ width: size, height: size }}
			onLoad={handleLoad}
			onError={handleError}
			loading={lazy ? 'lazy' : 'eager'}
		/>
	);
}

// Optimized team logo with lazy loading
export function LazyTeamLogo(props: OptimizedTeamLogoProps) {
	return <OptimizedTeamLogo {...props} lazy={true} />;
}

// Optimized team logo with eager loading
export function EagerTeamLogo(props: OptimizedTeamLogoProps) {
	return <OptimizedTeamLogo {...props} lazy={false} />;
}

// Team logo with fallback text
export function TeamLogoWithFallback(props: OptimizedTeamLogoProps) {
	return <OptimizedTeamLogo {...props} showFallback={true} />;
}

// Team logo without fallback
export function TeamLogoOnly(props: OptimizedTeamLogoProps) {
	return <OptimizedTeamLogo {...props} showFallback={false} />;
}
