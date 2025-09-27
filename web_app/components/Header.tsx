'use client';

import { Calendar, ChevronLeft, ChevronRight, ArrowLeft, CalendarCheck2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDateInTimezone, getTodayLocalDate } from '@/lib/utils';
import ThemeToggle from './ThemeToggle';
import ResponsiveLogo from './ResponsiveLogo';

interface HeaderProps {
	onLoadGames: (date: string) => void;
	isLoading: boolean;
	onNavigateToGames?: () => void;
	selectedDate: string;
	currentView: 'games' | 'scorecard';
}

export default function Header({ onLoadGames, isLoading, onNavigateToGames, selectedDate, currentView }: HeaderProps) {
	// Use selectedDate from context, fallback to today if empty
	const currentDate = selectedDate || getTodayLocalDate();
	const router = useRouter();

	const handleBackToGames = () => {
		// Always navigate to homepage
		router.push('/');
	};

	const handleGoToToday = () => {
		const today = getTodayLocalDate();
		handleDateChange(today);
	};

	const handleDateChange = (date: string) => {
		if (date !== currentDate) {
			// Immediately load games when date changes
			onLoadGames(date);
			// Navigate back to games view if we're on a game page
			if (onNavigateToGames) {
				onNavigateToGames();
			}
		}
	};

	const handlePreviousDay = () => {
		const date = new Date(currentDate);
		date.setDate(date.getDate() - 1);
		const newDate = date.toISOString().split('T')[0];
		handleDateChange(newDate);
	};

	const handleNextDay = () => {
		const date = new Date(currentDate);
		date.setDate(date.getDate() + 1);
		const newDate = date.toISOString().split('T')[0];
		handleDateChange(newDate);
	};

	const isCurrentDay = currentDate === getTodayLocalDate();

	return (
		<header className="bg-primary-50 dark:bg-primary-900 border-b border-primary-400 dark:border-primary-700 sticky top-0 z-[99]">
			<div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
				<div className="flex justify-between items-center py-6">
					<Link href="/" className="transition-opacity hover:opacity-80">
						<ResponsiveLogo />
					</Link>

					<div className="flex gap-4 items-center">
						{currentView === 'games' ? (
							<>
								<div className="flex gap-2 items-center text-primary-700"></div>

								<div className="flex gap-2 items-center">
									<button
										onClick={handlePreviousDay}
										disabled={isLoading}
										className="p-2 btn btn-primary btn-sm hover:bg-primary-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
										aria-label="Previous day"
										title="Previous day">
										<ChevronLeft className="w-4 h-4" />
									</button>

									<div className="relative w-[160px]">
										<input
											type="date"
											id="gameDate"
											value={currentDate}
											onChange={(e) => {
												handleDateChange(e.target.value);
											}}
											onClick={(e) => {
												(e.target as HTMLInputElement).showPicker?.();
											}}
											onFocus={(e) => {
												// Date input focused
											}}
											className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer"
											max={getTodayLocalDate()} // Don't allow future dates
											disabled={isLoading}
										/>
										<div
											className="flex gap-2 items-center w-full text-sm cursor-pointer pointer-events-none input"
											onClick={(e) => {
												// Visible div clicked
											}}>
											<Calendar className="w-4 h-4 text-primary-500" />
											<span>{formatDateInTimezone(currentDate, "EEE, MMM d, 'yy")}</span>
										</div>
									</div>

									<button
										onClick={handleNextDay}
										disabled={isCurrentDay || isLoading}
										className="p-2 btn btn-primary btn-sm hover:bg-primary-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
										aria-label="Next day"
										title="Next day">
										<ChevronRight className="w-4 h-4" />
									</button>

									<button
										onClick={handleGoToToday}
										disabled={isCurrentDay || isLoading}
										className="p-2 btn btn-primary btn-sm hover:bg-primary-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
										aria-label="Go to today"
										title="Go to today">
										<CalendarCheck2 className="w-4 h-4" />
									</button>

									<ThemeToggle />
								</div>
							</>
						) : (
							<div className="flex gap-2 items-center">
								<button
									onClick={handleBackToGames}
									className="flex gap-2 items-center btn btn-primary btn-sm"
									aria-label="Back to all games"
									title="Back to all games">
									<ArrowLeft className="w-4 h-4" />
									Back to all games
								</button>
								<ThemeToggle />
							</div>
						)}
					</div>
				</div>
			</div>
		</header>
	);
}
