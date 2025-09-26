import { NextRequest, NextResponse } from 'next/server';
import { getGameDetails, getGameDetailsLive } from '@/lib/baseball-service';

export async function GET(request: NextRequest, { params }: { params: { gameId: string } }) {
	try {
		const { gameId } = params;
		const { searchParams } = new URL(request.url);

		// Parse game_id (format: YYYY-MM-DD-AWAY-HOME-GAME)
		const parts = gameId.split('-');
		if (parts.length !== 6) {
			return NextResponse.json({ error: 'Invalid game ID format', success: false }, { status: 400 });
		}

		// Check for live update parameters
		const isLiveUpdate = searchParams.get('live') === 'true';
		const lastUpdate = searchParams.get('lastUpdate');
		const gamePk = searchParams.get('gamePk');

		// Use live update function for live games with diffPatch
		if (isLiveUpdate && gamePk) {
			const liveData = await getGameDetailsLive(gamePk, lastUpdate);
			return NextResponse.json({
				game_id: gameId,
				game: liveData.game_data,
				game_data: liveData.game_data,
				liveData: liveData.liveData,
				svg_content: liveData.svg_content,
				success: true,
				isLiveUpdate: true,
				timestamp: new Date().toISOString(),
				hasChanges: liveData.hasChanges || false,
			});
		}

		// Use regular game details for non-live or initial requests
		const gameData = await getGameDetails(gameId);

		return NextResponse.json({
			game_id: gameId,
			game: gameData.game_data, // Include basic game data for compatibility
			game_data: gameData.game_data,
			liveData: gameData.liveData, // Include liveData for basepath tracking
			svg_content: gameData.svg_content,
			success: true,
			isLiveUpdate: false,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Error in get_game_details:', error);

		if (error instanceof Error && error.message.includes('not found')) {
			return NextResponse.json({ error: 'Game not found or no data available', success: false }, { status: 404 });
		}

		return NextResponse.json({ error: 'Internal server error', success: false }, { status: 500 });
	}
}
