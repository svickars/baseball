'use client';

import { HelpCircle } from 'lucide-react';
import { useState } from 'react';
import HelpModal from './HelpModal';

export default function Header() {
	const [showHelp, setShowHelp] = useState(false);

	return (
		<>
			<header className="bg-white border-b border-secondary-200 shadow-sm sticky top-0 z-40">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center py-4">
						<div className="flex items-center gap-3">
							<div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
								<span className="text-white text-lg font-bold">⚾</span>
							</div>
							<h1 className="text-xl font-semibold text-secondary-900">Baseball Scorecard Viewer</h1>
						</div>
						<div className="flex items-center gap-3">
							<button onClick={() => setShowHelp(true)} className="btn btn-secondary">
								<HelpCircle className="w-4 h-4" />
								Help
							</button>
						</div>
					</div>
				</div>
			</header>

			<HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
		</>
	);
}
