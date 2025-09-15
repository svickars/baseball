'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useEffect } from 'react';

export default function ThemeToggle() {
	const [mounted, setMounted] = useState(false);
	const { theme, toggleTheme } = useTheme();

	useEffect(() => {
		setMounted(true);
	}, []);

	// Don't render during SSR to prevent hydration mismatch
	if (!mounted) {
		return (
			<button
				className="btn btn-outline btn-sm p-2 hover:bg-accent-600 hover:text-white transition-all duration-200"
				aria-label="Theme toggle"
				title="Theme toggle">
				<Sun className="w-4 h-4" />
			</button>
		);
	}

	return (
		<button
			onClick={toggleTheme}
			className="btn btn-outline btn-sm p-2 hover:bg-accent-600 hover:text-white transition-all duration-200"
			aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
			title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
			{theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
		</button>
	);
}
