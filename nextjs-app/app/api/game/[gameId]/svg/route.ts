import { NextRequest, NextResponse } from 'next/server';
import { getGameSVG } from '@/lib/baseball-service';

export async function GET(request: NextRequest, { params }: { params: { gameId: string } }) {
	try {
		const { gameId } = params;

		// Parse game_id (format: YYYY-MM-DD-AWAY-HOME-GAME)
		const parts = gameId.split('-');
		if (parts.length !== 6) {
			return NextResponse.json({ error: 'Invalid game ID format', success: false }, { status: 400 });
		}

		const svgContent = await getGameSVG(gameId);

		return new NextResponse(svgContent, {
			status: 200,
			headers: {
				'Content-Type': 'image/svg+xml',
			},
		});
	} catch (error) {
		console.error('Error in get_game_svg:', error);

		if (error instanceof Error && error.message.includes('not found')) {
			return NextResponse.json({ error: 'Game not found', success: false }, { status: 404 });
		}

		return NextResponse.json({ error: 'Internal server error', success: false }, { status: 500 });
	}
}
