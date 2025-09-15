'use client';

import { useBaseballContext } from '@/contexts/BaseballContext';
import { usePathname } from 'next/navigation';
import Header from './Header';

export default function HeaderWrapper() {
	const { loadGames, isLoading, goBackToGames, selectedDate, view } = useBaseballContext();
	const pathname = usePathname();

	// Determine if we're on a game page based on the route
	const isGamePage = pathname.startsWith('/game/');
	const currentView = isGamePage ? 'scorecard' : view;

	return (
		<Header
			onLoadGames={loadGames}
			isLoading={isLoading}
			onNavigateToGames={goBackToGames}
			selectedDate={selectedDate}
			currentView={currentView}
		/>
	);
}
