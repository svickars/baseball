'use client';

import { Game } from '@/types';
import { formatDate, getStatusColor, isGameLive } from '@/lib/utils';
import { Clock, MapPin, Trophy } from 'lucide-react';
import Link from 'next/link';

interface GamesListProps {
	games: Game[];
	selectedDate: string;
	onGameSelect: (gameId: string) => void;
}

export default function GamesList({ games, selectedDate, onGameSelect }: GamesListProps) {
	if (games.length === 0) {
		return (
			<section className="my-8">
				<h2 className="text-xl font-semibold text-secondary-900 mb-6">Games for {formatDate(selectedDate)}</h2>
				<div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-12 text-center">
					<div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
						<Clock className="w-8 h-8 text-secondary-500" />
					</div>
					<h3 className="text-lg font-semibold text-secondary-900 mb-2">No games found</h3>
					<p className="text-secondary-600">No games were scheduled for {formatDate(selectedDate)}.</p>
				</div>
			</section>
		);
	}

	return (
		<section className="my-8">
			<h2 className="text-xl font-semibold text-secondary-900 mb-6">Games for {formatDate(selectedDate)}</h2>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{games.map((game) => {
					const isLive = isGameLive(game);
					const statusClass = game.status.toLowerCase().replace(/\s+/g, '-');

					return (
						<Link key={game.id} href={`/game/${game.id}`} className={`game-card ${isLive ? 'live' : ''} block`}>
							<div className="flex justify-between items-start mb-3">
								<h3 className="text-lg font-semibold text-secondary-900">
									{game.away_team} @ {game.home_team}
								</h3>
								{isLive && <span className="live-indicator">🔴 LIVE</span>}
							</div>

							<div className="text-secondary-600 mb-3">
								{game.away_code} vs {game.home_code}
							</div>

							{game.away_score !== undefined && game.home_score !== undefined && (
								<div className="text-center text-lg font-semibold text-secondary-900 mb-3">
									{game.away_code} {game.away_score} - {game.home_score} {game.home_code}
								</div>
							)}

							{isLive && game.inning && (
								<div className="text-center text-success-600 font-medium mb-3">
									{game.inning}
									{game.inning_state ? ` ${game.inning_state}` : ''}
								</div>
							)}

							<div className="flex justify-between items-center mb-3">
								<div className="flex items-center gap-1 text-secondary-600">
									<Clock className="w-4 h-4" />
									<span className="text-sm">{game.start_time}</span>
								</div>
								<span className={`status-badge status-${statusClass}`}>{game.status}</span>
							</div>

							<div className="flex items-center gap-1 text-secondary-500 text-sm">
								<MapPin className="w-4 h-4" />
								<span>{game.location}</span>
							</div>
						</Link>
					);
				})}
			</div>
		</section>
	);
}
