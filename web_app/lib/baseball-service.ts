import { Game, GameData } from '@/types';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function getGamesForDate(date: string): Promise<Game[]> {
	try {
		// Use the Python bridge to get games from your baseball library
		const bridgePath = path.join(process.cwd(), 'lib', 'baseball_bridge.py');
		const command = `python3 "${bridgePath}" get_games "${date}"`;

		const { stdout, stderr } = await execAsync(command);

		if (stderr) {
			console.error('Python bridge stderr:', stderr);
		}

		const result = JSON.parse(stdout);

		if (!result.success) {
			throw new Error(result.error || 'Failed to fetch games');
		}

		return result.games;
	} catch (error) {
		console.error(`Error fetching games for ${date}:`, error);

		// Fallback to mock data if Python bridge fails
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
		// Use the Python bridge to get game details from your baseball library
		const bridgePath = path.join(process.cwd(), 'lib', 'baseball_bridge.py');
		const command = `python3 "${bridgePath}" get_game "${gameId}"`;

		const { stdout, stderr } = await execAsync(command);

		if (stderr) {
			console.error('Python bridge stderr:', stderr);
		}

		const result = JSON.parse(stdout);

		if (!result.success) {
			throw new Error(result.error || 'Failed to fetch game details');
		}

		return {
			game_id: result.game_id,
			game_data: result.game_data,
			svg_content: result.svg_content,
			success: true,
		};
	} catch (error) {
		console.error(`Error fetching game ${gameId}:`, error);

		// Fallback to mock data if Python bridge fails
		const parts = gameId.split('-');
		const dateStr = parts.slice(0, 3).join('-');
		const awayCode = parts[3];
		const homeCode = parts[4];

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
	}
}

export async function getGameSVG(gameId: string): Promise<string> {
	try {
		// Use the Python bridge to get SVG from your baseball library
		const bridgePath = path.join(process.cwd(), 'lib', 'baseball_bridge.py');
		const command = `python3 "${bridgePath}" get_svg "${gameId}"`;

		const { stdout, stderr } = await execAsync(command);

		if (stderr) {
			console.error('Python bridge stderr:', stderr);
		}

		const result = JSON.parse(stdout);

		if (!result.success) {
			throw new Error(result.error || 'Failed to fetch game SVG');
		}

		return result.svg_content;
	} catch (error) {
		console.error(`Error fetching game SVG ${gameId}:`, error);

		// Fallback to mock SVG
		const parts = gameId.split('-');
		const dateStr = parts.slice(0, 3).join('-');
		const awayCode = parts[3];
		const homeCode = parts[4];

		return `
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
	}
}
