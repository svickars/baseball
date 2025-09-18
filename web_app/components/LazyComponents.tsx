'use client';

import { lazy, Suspense } from 'react';
import LoadingSpinner from './LoadingSpinner';

// Lazy load heavy components
const TraditionalScorecard = lazy(() => import('./TraditionalScorecard'));
const GamePage = lazy(() => import('./GamePage'));
const GamesList = lazy(() => import('./GamesList'));

// Lazy-loaded TraditionalScorecard with loading fallback
export const LazyTraditionalScorecard = (props: any) => (
	<Suspense fallback={<LoadingSpinner message="Loading scorecard..." />}>
		<TraditionalScorecard {...props} />
	</Suspense>
);

// Lazy-loaded GamePage with loading fallback
export const LazyGamePage = (props: any) => (
	<Suspense fallback={<LoadingSpinner message="Loading game details..." />}>
		<GamePage {...props} />
	</Suspense>
);

// Lazy-loaded GamesList with loading fallback
export const LazyGamesList = (props: any) => (
	<Suspense fallback={<LoadingSpinner message="Loading games..." />}>
		<GamesList {...props} />
	</Suspense>
);
