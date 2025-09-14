'use client';

import { X } from 'lucide-react';

interface HelpModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
	if (!isOpen) return null;

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-content" onClick={(e) => e.stopPropagation()}>
				<div className="flex justify-between items-center p-6 border-b border-secondary-200">
					<h3 className="text-lg font-semibold text-secondary-900">How to Use</h3>
					<button
						onClick={onClose}
						className="p-2 text-secondary-500 hover:text-secondary-700 hover:bg-secondary-100 rounded-lg transition-colors">
						<X className="w-5 h-5" />
					</button>
				</div>

				<div className="p-6 space-y-6">
					<div>
						<h4 className="text-base font-semibold text-secondary-900 mb-3">Getting Started</h4>
						<ol className="list-decimal list-inside space-y-2 text-secondary-700">
							<li>Select a date using the date picker</li>
							<li>Click "Load Games" to see available games</li>
							<li>Click on a game to view its scorecard</li>
						</ol>
					</div>

					<div>
						<h4 className="text-base font-semibold text-secondary-900 mb-3">Controls</h4>
						<ul className="list-disc list-inside space-y-2 text-secondary-700">
							<li>
								<strong>Detail Level:</strong> Adjust how much information is shown
							</li>
							<li>
								<strong>Time Delay:</strong> Add a delay to simulate live viewing
							</li>
							<li>
								<strong>View Mode:</strong> Switch between different display modes
							</li>
							<li>
								<strong>Show Pitch Data:</strong> Toggle pitch-by-pitch information
							</li>
							<li>
								<strong>Show Player Stats:</strong> Toggle player statistics
							</li>
						</ul>
					</div>

					<div>
						<h4 className="text-base font-semibold text-secondary-900 mb-3">Features</h4>
						<ul className="list-disc list-inside space-y-2 text-secondary-700">
							<li>Responsive design works on all devices</li>
							<li>Interactive scorecard with hover details</li>
							<li>Real-time game updates (when available)</li>
							<li>Export scorecard as SVG</li>
							<li>Live game indicators and auto-refresh</li>
						</ul>
					</div>

					<div>
						<h4 className="text-base font-semibold text-secondary-900 mb-3">Keyboard Shortcuts</h4>
						<ul className="list-disc list-inside space-y-2 text-secondary-700">
							<li>
								<kbd className="px-2 py-1 bg-secondary-100 rounded text-sm">Esc</kbd> Close modals
							</li>
							<li>
								<kbd className="px-2 py-1 bg-secondary-100 rounded text-sm">Ctrl/Cmd + R</kbd> Refresh current game
							</li>
							<li>
								<kbd className="px-2 py-1 bg-secondary-100 rounded text-sm">←</kbd> Back to games list (when viewing a
								game)
							</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
}
