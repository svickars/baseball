'use client';

import React from 'react';

interface OptimizedLoadingSpinnerProps {
	message?: string;
	size?: 'small' | 'medium' | 'large';
	variant?: 'spinner' | 'dots' | 'pulse' | 'skeleton';
	showProgress?: boolean;
	progress?: number;
	estimatedTime?: number;
	className?: string;
}

export default function OptimizedLoadingSpinner({
	message = 'Loading...',
	size = 'medium',
	variant = 'spinner',
	showProgress = false,
	progress = 0,
	estimatedTime,
	className = '',
}: OptimizedLoadingSpinnerProps) {
	const sizeClasses = {
		small: 'w-4 h-4',
		medium: 'w-8 h-8',
		large: 'w-12 h-12',
	};

	const renderSpinner = () => {
		switch (variant) {
			case 'dots':
				return (
					<div className="flex space-x-1">
						{[0, 1, 2].map((i) => (
							<div
								key={i}
								className={`${sizeClasses[size]} bg-primary-500 rounded-full animate-pulse`}
								style={{
									animationDelay: `${i * 0.2}s`,
									animationDuration: '1s',
								}}
							/>
						))}
					</div>
				);

			case 'pulse':
				return <div className={`${sizeClasses[size]} bg-primary-500 rounded-full animate-pulse`} />;

			case 'skeleton':
				return (
					<div className="space-y-3">
						<div className="h-4 bg-primary-200 rounded animate-pulse"></div>
						<div className="h-4 bg-primary-200 rounded animate-pulse w-3/4"></div>
						<div className="h-4 bg-primary-200 rounded animate-pulse w-1/2"></div>
					</div>
				);

			default:
				return (
					<div
						className={`${sizeClasses[size]} border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin`}
					/>
				);
		}
	};

	const formatTime = (seconds: number): string => {
		if (seconds < 60) {
			return `${Math.round(seconds)}s`;
		}
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = Math.round(seconds % 60);
		return `${minutes}m ${remainingSeconds}s`;
	};

	return (
		<div className={`flex flex-col items-center justify-center space-y-4 ${className}`}>
			{renderSpinner()}

			{message && <p className="text-primary-600 dark:text-primary-400 text-sm font-medium">{message}</p>}

			{showProgress && (
				<div className="w-64 space-y-2">
					<div className="flex justify-between text-xs text-primary-500 dark:text-primary-400">
						<span>Progress</span>
						<span>{Math.round(progress)}%</span>
					</div>
					<div className="w-full bg-primary-200 dark:bg-primary-700 rounded-full h-2">
						<div
							className="bg-primary-500 h-2 rounded-full transition-all duration-300 ease-out"
							style={{ width: `${progress}%` }}
						/>
					</div>
					{estimatedTime && (
						<p className="text-xs text-primary-500 dark:text-primary-400 text-center">
							Estimated time remaining: {formatTime(estimatedTime)}
						</p>
					)}
				</div>
			)}
		</div>
	);
}

// Specialized loading components for different contexts
export function GameListLoadingSpinner() {
	return <OptimizedLoadingSpinner message="Loading games..." size="medium" variant="dots" className="py-8" />;
}

export function GameDetailsLoadingSpinner() {
	return <OptimizedLoadingSpinner message="Loading game details..." size="large" variant="spinner" className="py-12" />;
}

export function ScorecardLoadingSpinner() {
	return <OptimizedLoadingSpinner message="Generating scorecard..." size="medium" variant="pulse" className="py-8" />;
}

export function DataPrefetchingSpinner({ progress }: { progress: number }) {
	return (
		<OptimizedLoadingSpinner
			message="Preloading game data..."
			size="small"
			variant="dots"
			showProgress
			progress={progress}
			className="py-4"
		/>
	);
}

export function SkeletonLoader({ lines = 3 }: { lines?: number }) {
	return (
		<div className="space-y-3 animate-pulse">
			{Array.from({ length: lines }, (_, i) => (
				<div
					key={i}
					className={`h-4 bg-primary-200 dark:bg-primary-700 rounded ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
				/>
			))}
		</div>
	);
}
