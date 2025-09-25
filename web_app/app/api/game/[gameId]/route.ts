import { NextRequest, NextResponse } from 'next/server';
import { getGameDetails } from '@/lib/baseball-service';

export async function GET(request: NextRequest, { params }: { params: { gameId: string } }) {
	try {
		const { gameId } = params;

		// Parse game_id (format: YYYY-MM-DD-AWAY-HOME-GAME)
		const parts = gameId.split('-');
		if (parts.length !== 6) {
			return NextResponse.json({ error: 'Invalid game ID format', success: false }, { status: 400 });
		}

		const gameData = await getGameDetails(gameId);

		return NextResponse.json({
			game_id: gameId,
			game: gameData.game_data, // Include basic game data for compatibility
			game_data: gameData.game_data,
			liveData: gameData.liveData, // Include liveData for basepath tracking
			svg_content: gameData.svg_content,
			success: true,
		});
	} catch (error) {
		console.error('Error in get_game_details:', error);

		if (error instanceof Error && error.message.includes('not found')) {
			return NextResponse.json({ error: 'Game not found or no data available', success: false }, { status: 404 });
		}

		return NextResponse.json({ error: 'Internal server error', success: false }, { status: 500 });
	}
}
