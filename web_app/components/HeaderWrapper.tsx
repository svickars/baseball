'use client';

import { useBaseballContext } from '@/contexts/BaseballContext';
import Header from './Header';

export default function HeaderWrapper() {
	const { loadGames, isLoading } = useBaseballContext();

	return <Header onLoadGames={loadGames} isLoading={isLoading} />;
}
