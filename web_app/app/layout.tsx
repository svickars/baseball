import type { Metadata } from 'next';
import './globals.css';
import { BaseballProvider } from '@/contexts/BaseballContext';
import HeaderWrapper from '@/components/HeaderWrapper';

export const metadata: Metadata = {
	title: 'Caught Looking',
	description: 'Modern baseball scorecard viewer with live updates',
	keywords: ['baseball', 'scorecard', 'MLB', 'live', 'stats'],
	authors: [{ name: 'Caught Looking Team' }],
	viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>
				<BaseballProvider>
					<div id="app" className="min-h-screen bg-primary-50">
						<HeaderWrapper />
						{children}
						<footer className="bg-primary-100 border-t border-primary-200 py-8 mt-16">
							<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
								<p className="text-primary-700 text-sm">© 2024 Caught Looking. Built with the baseball library.</p>
							</div>
						</footer>
					</div>
				</BaseballProvider>
			</body>
		</html>
	);
}
