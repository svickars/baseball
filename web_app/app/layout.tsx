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
	icons: {
		icon: [
			{ url: '/favicon.ico', sizes: 'any' },
			{ url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
			{ url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
		],
		apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
	},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body suppressHydrationWarning={true}>
				<ThemeProvider>
					<BaseballProvider>
						<div id="app" className="flex flex-col min-h-screen bg-primary-50 dark:bg-primary-900">
							<HeaderWrapper />
							<main className="flex flex-col flex-1 px-6 min-h-full">{children}</main>
							<footer className="py-8 mt-0 border-t bg-primary-50 dark:bg-primary-900 border-primary-400 dark:border-primary-700">
								<div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
									<div className="flex justify-between items-center">
										<div className="flex gap-4 items-center">
											<p className="text-sm text-primary-700 dark:text-primary-300">© 2025</p>
											<p className="text-sm text-primary-700 dark:text-primary-300">Built with ⚾ using the MLB API.</p>
										</div>
										{/* <a
											href="/about"
											className="text-sm text-primary-700 dark:text-primary-300 hover:text-accent-600 dark:hover:text-accent-400 hover:underline">
											About this Project
										</a> */}
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
