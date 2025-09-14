import { NextRequest, NextResponse } from 'next/server';
import { getGamesForDate } from '@/lib/baseball-service';

export async function GET(request: NextRequest, { params }: { params: { date: string } }) {
	try {
		const { date } = params;

		// Validate date format (YYYY-MM-DD)
		const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
		if (!dateRegex.test(date)) {
			return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD', success: false }, { status: 400 });
		}

		const gamesData = await getGamesForDate(date);

		return NextResponse.json({
			date,
			games: gamesData,
			success: true,
		});
	} catch (error) {
		console.error('Error in get_games_for_date:', error);
		return NextResponse.json({ error: 'Internal server error', success: false }, { status: 500 });
	}
}
