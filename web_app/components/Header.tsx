'use client';

import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

interface HeaderProps {
	onLoadGames: (date: string) => void;
	isLoading: boolean;
}

export default function Header({ onLoadGames, isLoading }: HeaderProps) {
	const [selectedDate, setSelectedDate] = useState(() => {
		const today = new Date();
		return today.toISOString().split('T')[0];
	});

	const handleDateChange = (date: string) => {
		setSelectedDate(date);
		// Immediately load games when date changes
		onLoadGames(date);
	};

	const handlePreviousDay = () => {
		const currentDate = new Date(selectedDate);
		currentDate.setDate(currentDate.getDate() - 1);
		const newDate = currentDate.toISOString().split('T')[0];
		handleDateChange(newDate);
	};

	const handleNextDay = () => {
		const currentDate = new Date(selectedDate);
		currentDate.setDate(currentDate.getDate() + 1);
		const newDate = currentDate.toISOString().split('T')[0];
		handleDateChange(newDate);
	};

	const isCurrentDay = selectedDate === new Date().toISOString().split('T')[0];

	return (
		<header className="bg-primary-100 border-b border-primary-200 shadow-sm sticky top-0 z-40">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex justify-between items-center py-6">
					<Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
						<div className="w-10 h-10 bg-accent-700 rounded-lg flex items-center justify-center shadow-sm">
							<span className="text-primary-50 text-xl font-bold">⚾</span>
						</div>
						<h1 className="text-2xl font-display text-accent-900">CAUGHT LOOKING</h1>
					</Link>

					<div className="flex items-center gap-4">
						<div className="flex items-center gap-2 text-primary-700">
							<Calendar className="w-5 h-5" />
							<label htmlFor="gameDate" className="text-sm font-medium">
								Date:
							</label>
						</div>

						<div className="flex items-center gap-2">
							<button
								onClick={handlePreviousDay}
								disabled={isLoading}
								className="btn btn-outline btn-sm p-2 hover:bg-accent-50"
								aria-label="Previous day"
								title="Previous day">
								<ChevronLeft className="w-4 h-4" />
							</button>

							<input
								type="date"
								id="gameDate"
								value={selectedDate}
								onChange={(e) => handleDateChange(e.target.value)}
								className="input text-sm max-w-xs"
								max={new Date().toISOString().split('T')[0]} // Don't allow future dates
								disabled={isLoading}
							/>

							<button
								onClick={handleNextDay}
								disabled={isCurrentDay || isLoading}
								className="btn btn-outline btn-sm p-2 hover:bg-accent-50"
								aria-label="Next day"
								title="Next day">
								<ChevronRight className="w-4 h-4" />
							</button>
						</div>
					</div>
				</div>
			</div>
		</header>
	);
}
