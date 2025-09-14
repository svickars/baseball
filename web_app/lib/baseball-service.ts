import { Game, GameData } from '@/types';
import { parse } from 'date-fns';

// This will be the interface to your existing baseball library
// We'll need to adapt this based on how your library works

export async function getGamesForDate(date: string): Promise<Game[]> {
	try {
		// For now, we'll use a direct HTTP approach to the MLB API
		// This matches what your Flask app was doing

		// Parse date string (YYYY-MM-DD format)
		const dateObj = parse(date, 'yyyy-MM-dd', new Date());

		// Use the MLB API directly (same as your Flask app)
		const allGamesUrl = `http://statsapi.mlb.com/api/v1/schedule/games/?sportId=1&startDate=${dateObj.getFullYear()}-${String(
			dateObj.getMonth() + 1
		).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}&endDate=${dateObj.getFullYear()}-${String(
			dateObj.getMonth() + 1
		).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

		const response = await fetch(allGamesUrl);
		const allGamesDict = await response.json();

		const gamesData: Game[] = [];

		if (allGamesDict.dates && allGamesDict.dates.length > 0) {
			for (const gameData of allGamesDict.dates[0].games) {
				const gamePk = gameData.gamePk;

				// Get detailed game data
				const gameUrl = `http://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;
				const gameResponse = await fetch(gameUrl);
				const gameDict = await gameResponse.json();

				// Extract game information
				const gameInfo = gameDict.gameData || {};
				const teams = gameInfo.teams || {};
				const awayTeam = teams.away || {};
				const homeTeam = teams.home || {};
				const gameDetails = gameInfo.game || {};
				const status = gameData.status || {};

				// Format start time
				let startTime = gameData.gameDate || '';
				if (startTime) {
					try {
						const dt = new Date(startTime);
						startTime = dt.toLocaleTimeString('en-US', {
							hour: 'numeric',
							minute: '2-digit',
							timeZoneName: 'short',
						});
					} catch (error) {
						// Keep original format if parsing fails
					}
				}

				// Create game object
				const game: Game = {
					id: `${date}-${awayTeam.abbreviation || ''}-${homeTeam.abbreviation || ''}-${gameDetails.gameNumber || 1}`,
					away_team: awayTeam.teamName || '',
					home_team: homeTeam.teamName || '',
					away_code: awayTeam.abbreviation || '',
					home_code: homeTeam.abbreviation || '',
					game_number: gameDetails.gameNumber || 1,
					start_time: startTime,
					location: `${gameData.venue?.name || ''}, ${gameData.venue?.city || ''}`,
					status: status.detailedState || 'Unknown',
					game_pk: gamePk,
					is_live: status.codedGameState === 'I' || status.codedGameState === 'S',
					inning: gameData.linescore?.currentInning || '',
					inning_state: gameData.linescore?.inningState || '',
					away_score: gameData.linescore?.teams?.away?.runs || 0,
					home_score: gameData.linescore?.teams?.home?.runs || 0,
				};

				gamesData.push(game);
			}
		}

		return gamesData;
	} catch (error) {
		console.error(`Error fetching games for ${date}:`, error);

		// Fallback to mock data if API fails
		return [
			{
				id: `${date}-HOU-LAD-1`,
				away_team: 'Houston Astros',
				home_team: 'Los Angeles Dodgers',
				away_code: 'HOU',
				home_code: 'LAD',
				game_number: 1,
				start_time: '8:00 PM EDT',
				location: 'Dodger Stadium, Los Angeles, CA',
				status: 'Final',
				game_pk: 12345,
				is_live: false,
				away_score: 5,
				home_score: 3,
			},
		];
	}
}

export async function getGameDetails(gameId: string): Promise<GameData> {
	try {
		// Parse game_id (format: YYYY-MM-DD-AWAY-HOME-GAME)
		const parts = gameId.split('-');
		if (parts.length !== 6) {
			throw new Error('Invalid game ID format');
		}

		const dateStr = `${parts[0]}-${parts[1]}-${parts[2]}`;
		const awayCode = parts[3];
		const homeCode = parts[4];
		const gameNumber = parseInt(parts[5]);

		// For now, we'll create a mock response that matches your existing structure
		// In production, you would integrate with your baseball library here

		// Mock game data structure that matches your existing format
		const mockGameData = {
			away_team: {
				name: `${awayCode} Team`,
				abbreviation: awayCode,
			},
			home_team: {
				name: `${homeCode} Team`,
				abbreviation: homeCode,
			},
			game_date_str: dateStr,
			location: 'Stadium Name, City, State',
			inning_list: Array.from({ length: 9 }, (_, i) => ({ inning: i + 1 })),
			is_postponed: false,
			is_suspended: false,
		};

		// Mock SVG content - in production this would come from your baseball library
		const mockSvgContent = `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="600" fill="white" stroke="black" stroke-width="2"/>
        <text x="400" y="50" text-anchor="middle" font-size="24" font-weight="bold">
          ${awayCode} vs ${homeCode}
        </text>
        <text x="400" y="100" text-anchor="middle" font-size="16">
          ${dateStr}
        </text>
        <text x="400" y="300" text-anchor="middle" font-size="18">
          Scorecard will be generated here
        </text>
        <text x="400" y="350" text-anchor="middle" font-size="14" fill="gray">
          Integration with baseball library needed
        </text>
      </svg>
    `;

		return {
			game_id: gameId,
			game_data: mockGameData,
			svg_content: mockSvgContent,
			success: true,
		};
	} catch (error) {
		console.error(`Error fetching game ${gameId}:`, error);
		throw error;
	}
}

export async function getGameSVG(gameId: string): Promise<string> {
	try {
		// Parse game_id
		const parts = gameId.split('-');
		if (parts.length !== 6) {
			throw new Error('Invalid game ID format');
		}

		const dateStr = `${parts[0]}-${parts[1]}-${parts[2]}`;
		const awayCode = parts[3];
		const homeCode = parts[4];
		const gameNumber = parseInt(parts[5]);

		// For now, return a mock SVG
		// In production, you would integrate with your baseball library here
		const mockSvgContent = `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="600" fill="white" stroke="black" stroke-width="2"/>
        <text x="400" y="50" text-anchor="middle" font-size="24" font-weight="bold">
          ${awayCode} vs ${homeCode}
        </text>
        <text x="400" y="100" text-anchor="middle" font-size="16">
          ${dateStr}
        </text>
        <text x="400" y="300" text-anchor="middle" font-size="18">
          SVG Scorecard
        </text>
        <text x="400" y="350" text-anchor="middle" font-size="14" fill="gray">
          Integration with baseball library needed
        </text>
      </svg>
    `;

		return mockSvgContent;
	} catch (error) {
		console.error(`Error fetching game SVG ${gameId}:`, error);
		throw error;
	}
}
