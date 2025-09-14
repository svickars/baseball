'use client';

import { Calendar, Search } from 'lucide-react';
import { useState } from 'react';

interface DatePickerProps {
	onLoadGames: (date: string) => void;
	isLoading: boolean;
}

export default function DatePicker({ onLoadGames, isLoading }: DatePickerProps) {
	const [selectedDate, setSelectedDate] = useState(() => {
		const today = new Date();
		return today.toISOString().split('T')[0];
	});

	const handleLoadGames = () => {
		if (selectedDate) {
			onLoadGames(selectedDate);
		}
	};

	return (
		<section className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6 my-8">
			<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
				<div className="flex items-center gap-2 text-secondary-700">
					<Calendar className="w-5 h-5" />
					<label htmlFor="gameDate" className="font-medium">
						Select Date:
					</label>
				</div>

				<input
					type="date"
					id="gameDate"
					value={selectedDate}
					onChange={(e) => setSelectedDate(e.target.value)}
					className="input flex-1 max-w-xs"
					max={new Date().toISOString().split('T')[0]} // Don't allow future dates
				/>

				<button onClick={handleLoadGames} disabled={!selectedDate || isLoading} className="btn btn-primary">
					<Search className="w-4 h-4" />
					{isLoading ? 'Loading...' : 'Load Games'}
				</button>
			</div>
		</section>
	);
}
