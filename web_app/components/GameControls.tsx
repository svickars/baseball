'use client';

import { GameControls as GameControlsType } from '@/types';
import { Settings } from 'lucide-react';

interface GameControlsProps {
	controls: GameControlsType;
	onControlsChange: (controls: GameControlsType) => void;
}

export default function GameControls({ controls, onControlsChange }: GameControlsProps) {
	const handleControlChange = (key: keyof GameControlsType, value: any) => {
		onControlsChange({
			...controls,
			[key]: value,
		});
	};

	return (
		<div className="bg-white dark:bg-primary-800 rounded-xl shadow-sm border border-secondary-200 dark:border-primary-700 p-6 mb-8">
			<div className="flex items-center gap-2 mb-6">
				<Settings className="w-5 h-5 text-secondary-600 dark:text-secondary-400" />
				<h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100">Game Controls</h3>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				<div className="space-y-2">
					<label htmlFor="detailLevel" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">
						Detail Level
					</label>
					<select
						id="detailLevel"
						value={controls.detailLevel}
						onChange={(e) => handleControlChange('detailLevel', e.target.value)}
						className="select">
						<option value="basic">Basic</option>
						<option value="standard">Standard</option>
						<option value="detailed">Detailed</option>
						<option value="full">Full</option>
					</select>
				</div>

				<div className="space-y-2">
					<label htmlFor="timeDelay" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">
						Live Data Delay
					</label>
					<select
						id="timeDelay"
						value={controls.timeDelay}
						onChange={(e) => handleControlChange('timeDelay', parseInt(e.target.value))}
						className="select">
						<option value={0}>Live (no delay)</option>
						<option value={5}>5 seconds delay</option>
						<option value={10}>10 seconds delay</option>
						<option value={15}>15 seconds delay</option>
						<option value={30}>30 seconds delay</option>
						<option value={45}>45 seconds delay</option>
						<option value={60}>1 minute delay</option>
						<option value={120}>2 minutes delay</option>
						<option value={180}>3 minutes delay</option>
						<option value={300}>5 minutes delay</option>
						<option value={600}>10 minutes delay</option>
					</select>
				</div>

				<div className="space-y-2">
					<label htmlFor="viewMode" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">
						View Mode
					</label>
					<select
						id="viewMode"
						value={controls.viewMode}
						onChange={(e) => handleControlChange('viewMode', e.target.value)}
						className="select">
						<option value="scorecard">Scorecard</option>
						<option value="stats">Player Stats</option>
						<option value="pitch">Pitch Analysis</option>
					</select>
				</div>

				<div className="space-y-2">
					<label className="flex items-center gap-2 text-sm font-medium text-secondary-700 dark:text-secondary-300">
						<input
							type="checkbox"
							checked={controls.showPitchData}
							onChange={(e) => handleControlChange('showPitchData', e.target.checked)}
							className="w-4 h-4 text-primary-600 dark:text-primary-400 border-secondary-300 dark:border-secondary-600 rounded focus:ring-primary-500 dark:focus:ring-primary-400"
						/>
						Show Pitch Data
					</label>
				</div>

				<div className="space-y-2">
					<label className="flex items-center gap-2 text-sm font-medium text-secondary-700 dark:text-secondary-300">
						<input
							type="checkbox"
							checked={controls.showPlayerStats}
							onChange={(e) => handleControlChange('showPlayerStats', e.target.checked)}
							className="w-4 h-4 text-primary-600 dark:text-primary-400 border-secondary-300 dark:border-secondary-600 rounded focus:ring-primary-500 dark:focus:ring-primary-400"
						/>
						Show Player Stats
					</label>
				</div>
			</div>
		</div>
	);
}
