import type { Metadata } from 'next';
import './globals.css';
import { BaseballProvider } from '@/contexts/BaseballContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import HeaderWrapper from '@/components/HeaderWrapper';

export const metadata: Metadata = {
	title: 'Caught Looking',
	description: 'Follow along as you make your baseball scorecard with live updates',
	keywords: ['baseball', 'scorecard', 'MLB', 'live', 'stats'],
	authors: [{ name: 'Sam Vickars' }],
	viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>
				<ThemeProvider>
					<BaseballProvider>
						<div id="app" className="min-h-screen bg-primary-50 dark:bg-primary-900 flex flex-col">
							<HeaderWrapper />
							<main className="flex-1 min-h-full flex flex-col">{children}</main>
							<footer className="bg-primary-50 dark:bg-primary-900 border-t border-primary-400 dark:border-primary-700 py-8 mt-0">
								<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
									<div className="flex justify-between items-center">
										<div className="flex items-center gap-4">
											<p className="text-primary-700 dark:text-primary-300 text-sm">© 2025</p>
											<p className="text-primary-700 dark:text-primary-300 text-sm">
												Built with ⚾ using{' '}
												<a
													href="https://github.com/benjamincrom/baseball?tab=readme-ov-file"
													target="_blank"
													rel="noopener noreferrer"
													className="text-accent-600 dark:text-accent-400 hover:underline">
													Benjamin Crom&rsquo;s Baseball project
												</a>{' '}
												and the MLB API.
											</p>
										</div>
										<a
											href="/about"
											className="text-primary-700 dark:text-primary-300 text-sm hover:text-accent-600 dark:hover:text-accent-400 hover:underline">
											About this Project
										</a>
									</div>
								</div>
							</footer>
						</div>
					</BaseballProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
