'use client';

import React from 'react';

interface ProgressiveLoadingIndicatorProps {
	progress: number;
	state: 'basic' | 'loading-details' | 'detailed' | 'error';
	size?: 'sm' | 'md' | 'lg';
	showText?: boolean;
	className?: string;
}

export default function ProgressiveLoadingIndicator({
	progress,
	state,
	size = 'md',
	showText = true,
	className = '',
}: ProgressiveLoadingIndicatorProps) {
	const sizeClasses = {
		sm: 'w-4 h-4',
		md: 'w-6 h-6',
		lg: 'w-8 h-8',
	};

	const textSizeClasses = {
		sm: 'text-xs',
		md: 'text-sm',
		lg: 'text-base',
	};

	const getStateColor = () => {
		switch (state) {
			case 'basic':
				return 'text-gray-400';
			case 'loading-details':
				return 'text-blue-500';
			case 'detailed':
				return 'text-green-500';
			case 'error':
				return 'text-red-500';
			default:
				return 'text-gray-400';
		}
	};

	const getStateText = () => {
		switch (state) {
			case 'basic':
				return 'Basic';
			case 'loading-details':
				return `${progress}%`;
			case 'detailed':
				return 'Complete';
			case 'error':
				return 'Error';
			default:
				return '';
		}
	};

	if (state === 'basic') {
		return (
			<div className={`flex items-center gap-2 ${className}`}>
				<div className={`${sizeClasses[size]} rounded-full border-2 border-gray-200 ${getStateColor()}`} />
				{showText && <span className={`${textSizeClasses[size]} ${getStateColor()}`}>{getStateText()}</span>}
			</div>
		);
	}

	if (state === 'error') {
		return (
			<div className={`flex items-center gap-2 ${className}`}>
				<div
					className={`${sizeClasses[size]} rounded-full border-2 border-red-500 bg-red-50 flex items-center justify-center`}>
					<svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
						<path
							fillRule="evenodd"
							d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
							clipRule="evenodd"
						/>
					</svg>
				</div>
				{showText && <span className={`${textSizeClasses[size]} ${getStateColor()}`}>{getStateText()}</span>}
			</div>
		);
	}

	if (state === 'detailed') {
		return (
			<div className={`flex items-center gap-2 ${className}`}>
				<div
					className={`${sizeClasses[size]} rounded-full border-2 border-green-500 bg-green-50 flex items-center justify-center animate-pulse`}>
					<svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
						<path
							fillRule="evenodd"
							d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
							clipRule="evenodd"
						/>
					</svg>
				</div>
				{showText && <span className={`${textSizeClasses[size]} ${getStateColor()}`}>{getStateText()}</span>}
			</div>
		);
	}

	// Loading state
	return (
		<div className={`flex items-center gap-2 ${className}`}>
			<div className={`${sizeClasses[size]} relative`}>
				{/* Background circle */}
				<div className={`${sizeClasses[size]} rounded-full border-2 border-gray-200`} />

				{/* Progress circle */}
				<svg className={`${sizeClasses[size]} absolute top-0 left-0 transform -rotate-90`} viewBox="0 0 24 24">
					<circle
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						strokeWidth="2"
						fill="none"
						strokeDasharray={`${2 * Math.PI * 10}`}
						strokeDashoffset={`${2 * Math.PI * 10 * (1 - progress / 100)}`}
						className="text-blue-500 transition-all duration-300 ease-out"
					/>
				</svg>

				{/* Spinning indicator */}
				<div className={`${sizeClasses[size]} absolute top-0 left-0 flex items-center justify-center animate-spin`}>
					<div className="w-1 h-1 bg-blue-500 rounded-full" />
				</div>
			</div>

			{showText && <span className={`${textSizeClasses[size]} ${getStateColor()}`}>{getStateText()}</span>}
		</div>
	);
}

// Skeleton loader for inning data
export function InningDataSkeleton({ count = 9 }: { count?: number }) {
	return (
		<div className="flex gap-1">
			{Array.from({ length: count }, (_, i) => (
				<div key={i} className="w-6 h-6 bg-gray-200 rounded animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
			))}
		</div>
	);
}

// Skeleton loader for team stats
export function TeamStatsSkeleton() {
	return (
		<div className="flex gap-2">
			{Array.from({ length: 3 }, (_, i) => (
				<div key={i} className="w-8 h-6 bg-gray-200 rounded animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
			))}
		</div>
	);
}
