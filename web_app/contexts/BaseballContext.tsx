'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useBaseballApp } from '@/hooks/useBaseballApp';

const BaseballContext = createContext<ReturnType<typeof useBaseballApp> | null>(null);

export function BaseballProvider({ children }: { children: ReactNode }) {
	const baseballApp = useBaseballApp();

	return <BaseballContext.Provider value={baseballApp}>{children}</BaseballContext.Provider>;
}

export function useBaseballContext() {
	const context = useContext(BaseballContext);
	if (!context) {
		throw new Error('useBaseballContext must be used within a BaseballProvider');
	}
	return context;
}
