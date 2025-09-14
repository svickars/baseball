import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
	title: 'Baseball Scorecard Viewer',
	description: 'Modern baseball scorecard viewer with live updates',
	keywords: ['baseball', 'scorecard', 'MLB', 'live', 'stats'],
	authors: [{ name: 'Baseball Scorecard Team' }],
	viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body className={inter.className}>
				<div id="app" className="min-h-screen bg-secondary-50">
					{children}
				</div>
			</body>
		</html>
	);
}
