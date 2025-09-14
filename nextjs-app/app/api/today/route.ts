import { NextResponse } from 'next/server';
import { getGamesForDate } from '@/lib/baseball-service';

export async function GET() {
	try {
		const today = new Date();
		const dateStr = today.toISOString().split('T')[0];

		const gamesData = await getGamesForDate(dateStr);

		return NextResponse.json({
			date: dateStr,
			games: gamesData,
			message: "Today's games",
			success: true,
		});
	} catch (error) {
		console.error('Error in get_todays_games:', error);
		return NextResponse.json({ error: 'Internal server error', success: false }, { status: 500 });
	}
}
