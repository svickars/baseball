import { Game, GameData } from '@/types';

// MLB API base URL
const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';

// Team abbreviation mapping (since MLB API doesn't include abbreviations in schedule)
const TEAM_ABBREVIATIONS: { [key: string]: string } = {
	'Arizona Diamondbacks': 'ARI',
	'Atlanta Braves': 'ATL',
	'Baltimore Orioles': 'BAL',
	'Boston Red Sox': 'BOS',
	'Chicago Cubs': 'CHC',
	'Chicago White Sox': 'CWS',
	'Cincinnati Reds': 'CIN',
	'Cleveland Guardians': 'CLE',
	'Colorado Rockies': 'COL',
	'Detroit Tigers': 'DET',
	'Houston Astros': 'HOU',
	'Kansas City Royals': 'KC',
	'Los Angeles Angels': 'LAA',
	'Los Angeles Dodgers': 'LAD',
	'Miami Marlins': 'MIA',
	'Milwaukee Brewers': 'MIL',
	'Minnesota Twins': 'MIN',
	'New York Mets': 'NYM',
	'New York Yankees': 'NYY',
	'Oakland Athletics': 'OAK',
	'Philadelphia Phillies': 'PHI',
	'Pittsburgh Pirates': 'PIT',
	'San Diego Padres': 'SD',
	'San Francisco Giants': 'SF',
	'Seattle Mariners': 'SEA',
	'St. Louis Cardinals': 'STL',
	'Tampa Bay Rays': 'TB',
	'Texas Rangers': 'TEX',
	'Toronto Blue Jays': 'TOR',
	'Washington Nationals': 'WSH',
};

export async function getGamesForDate(date: string): Promise<Game[]> {
	try {
		// Parse the date to get year, month, day
		const dateObj = new Date(date);
		const year = dateObj.getFullYear();
		const month = dateObj.getMonth() + 1; // JavaScript months are 0-indexed
		const day = dateObj.getDate();

		// Fetch games from MLB API
		const response = await fetch(
			`${MLB_API_BASE}/schedule?sportId=1&date=${month}/${day}/${year}`
		);

		if (!response.ok) {
			throw new Error(`MLB API error: ${response.status}`);
		}

		const data = await response.json();

		const games: Game[] = [];

		if (data.dates && data.dates.length > 0) {
			for (const gameData of data.dates[0].games) {
				const gamePk = gameData.gamePk;
				const teams = gameData.teams || {};
				const awayTeam = teams.away || {};
				const homeTeam = teams.home || {};
				const gameDetails = gameData.game || {};
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
					} catch (e) {
						// Keep original format if parsing fails
					}
				}

				const awayTeamName = awayTeam.team?.name || '';
				const homeTeamName = homeTeam.team?.name || '';
				const awayCode = TEAM_ABBREVIATIONS[awayTeamName] || '';
				const homeCode = TEAM_ABBREVIATIONS[homeTeamName] || '';

				const game: Game = {
					id: `${date}-${awayCode}-${homeCode}-${gameDetails.gameNumber || 1}`,
					away_team: awayTeamName,
					home_team: homeTeamName,
					away_code: awayCode,
					home_code: homeCode,
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

				games.push(game);
			}
		}

		return games;
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
		// Parse game ID to extract gamePk
		// Format: YYYY-MM-DD-AWAY-HOME-GAME_NUMBER
		const parts = gameId.split('-');
		if (parts.length < 6) {
			throw new Error('Invalid game ID format');
		}

		const date = `${parts[0]}-${parts[1]}-${parts[2]}`;
		const awayCode = parts[3];
		const homeCode = parts[4];
		const gameNumber = parseInt(parts[5]);

		// First, get the gamePk from the schedule
		const dateObj = new Date(date);
		const year = dateObj.getFullYear();
		const month = dateObj.getMonth() + 1;
		const day = dateObj.getDate();

		const scheduleResponse = await fetch(
			`${MLB_API_BASE}/schedule?sportId=1&date=${month}/${day}/${year}`
		);

		if (!scheduleResponse.ok) {
			throw new Error(`MLB API error: ${scheduleResponse.status}`);
		}

		const scheduleData = await scheduleResponse.json();
		let gamePk = null;

		if (scheduleData.dates && scheduleData.dates.length > 0) {
			for (const gameData of scheduleData.dates[0].games) {
				const teams = gameData.teams || {};
				const awayTeam = teams.away || {};
				const homeTeam = teams.home || {};
				const gameDetails = gameData.game || {};

				if (
					awayTeam.team?.abbreviation === awayCode &&
					homeTeam.team?.abbreviation === homeCode &&
					(gameDetails.gameNumber || 1) === gameNumber
				) {
					gamePk = gameData.gamePk;
					break;
				}
			}
		}

		if (!gamePk) {
			throw new Error('Game not found in schedule');
		}

		// Get detailed game data
		const gameResponse = await fetch(`${MLB_API_BASE}/game/${gamePk}/feed/live`);
		if (!gameResponse.ok) {
			throw new Error(`MLB API error: ${gameResponse.status}`);
		}

		const gameData = await gameResponse.json();

		// For now, return a simplified game data structure
		// In a full implementation, you'd process this data similar to your Python library
		const gameInfo = gameData.gameData || {};
		const teams = gameInfo.teams || {};
		const awayTeam = teams.away || {};
		const homeTeam = teams.home || {};

		const awayTeamName = awayTeam.team?.name || 'Away Team';
		const homeTeamName = homeTeam.team?.name || 'Home Team';
		const awayCodeFromName = TEAM_ABBREVIATIONS[awayTeamName] || 'AWY';
		const homeCodeFromName = TEAM_ABBREVIATIONS[homeTeamName] || 'HOM';

		return {
			game_id: gameId,
			game_data: {
				away_team: {
					name: awayTeamName,
					abbreviation: awayCodeFromName,
				},
				home_team: {
					name: homeTeamName,
					abbreviation: homeCodeFromName,
				},
				game_date_str: date,
				location: gameInfo.venue?.name || 'Stadium',
				inning_list: Array.from({ length: 9 }, (_, i) => ({ inning: i + 1 })),
				is_postponed: gameInfo.status?.detailedState === 'Postponed',
				is_suspended: gameInfo.status?.detailedState === 'Suspended',
			},
			svg_content: generateSimpleSVG(gameData),
			success: true,
		};
	} catch (error) {
		console.error(`Error fetching game details for ${gameId}:`, error);

		// Fallback to mock data if API fails
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

// Simple SVG generator for demonstration
function generateSimpleSVG(gameData: any): string {
	const gameInfo = gameData.gameData || {};
	const teams = gameInfo.teams || {};
	const awayTeam = teams.away || {};
	const homeTeam = teams.home || {};
	const liveData = gameData.liveData || {};
	const linescore = liveData.linescore || {};

	const awayTeamName = awayTeam.team?.name || 'Away';
	const homeTeamName = homeTeam.team?.name || 'Home';
	const awayCode = TEAM_ABBREVIATIONS[awayTeamName] || 'AWY';
	const homeCode = TEAM_ABBREVIATIONS[homeTeamName] || 'HOM';

	return `
		<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
			<rect width="800" height="600" fill="white" stroke="black" stroke-width="2"/>
			<text x="400" y="50" text-anchor="middle" font-size="24" font-weight="bold">
				${awayTeamName} (${awayCode}) vs ${homeTeamName} (${homeCode})
			</text>
			<text x="400" y="100" text-anchor="middle" font-size="18">
				Score: ${linescore.teams?.away?.runs || 0} - ${linescore.teams?.home?.runs || 0}
			</text>
			<text x="400" y="150" text-anchor="middle" font-size="16">
				Status: ${gameInfo.status?.detailedState || 'Unknown'}
			</text>
			<text x="400" y="200" text-anchor="middle" font-size="14">
				This is a simplified scorecard. For full functionality, 
				the Python baseball library would be used to generate detailed SVG.
			</text>
		</svg>
	`;
}

export async function getGameSVG(gameId: string): Promise<string> {
	try {
		// Get game details first, then extract SVG
		const gameDetails = await getGameDetails(gameId);
		return gameDetails.svg_content;
	} catch (error) {
		console.error(`Error fetching SVG for ${gameId}:`, error);
		throw error;
	}
}

export async function getTeams(): Promise<{ teams: { code: string; name: string }[] }> {
	try {
		// For now, return a static list of MLB teams
		// In a full implementation, this could fetch from the MLB API
		const teams = [
			{ code: 'ARI', name: 'Arizona Diamondbacks' },
			{ code: 'ATL', name: 'Atlanta Braves' },
			{ code: 'BAL', name: 'Baltimore Orioles' },
			{ code: 'BOS', name: 'Boston Red Sox' },
			{ code: 'CHC', name: 'Chicago Cubs' },
			{ code: 'CWS', name: 'Chicago White Sox' },
			{ code: 'CIN', name: 'Cincinnati Reds' },
			{ code: 'CLE', name: 'Cleveland Guardians' },
			{ code: 'COL', name: 'Colorado Rockies' },
			{ code: 'DET', name: 'Detroit Tigers' },
			{ code: 'HOU', name: 'Houston Astros' },
			{ code: 'KC', name: 'Kansas City Royals' },
			{ code: 'LAA', name: 'Los Angeles Angels' },
			{ code: 'LAD', name: 'Los Angeles Dodgers' },
			{ code: 'MIA', name: 'Miami Marlins' },
			{ code: 'MIL', name: 'Milwaukee Brewers' },
			{ code: 'MIN', name: 'Minnesota Twins' },
			{ code: 'NYM', name: 'New York Mets' },
			{ code: 'NYY', name: 'New York Yankees' },
			{ code: 'OAK', name: 'Oakland Athletics' },
			{ code: 'PHI', name: 'Philadelphia Phillies' },
			{ code: 'PIT', name: 'Pittsburgh Pirates' },
			{ code: 'SD', name: 'San Diego Padres' },
			{ code: 'SF', name: 'San Francisco Giants' },
			{ code: 'SEA', name: 'Seattle Mariners' },
			{ code: 'STL', name: 'St. Louis Cardinals' },
			{ code: 'TB', name: 'Tampa Bay Rays' },
			{ code: 'TEX', name: 'Texas Rangers' },
			{ code: 'TOR', name: 'Toronto Blue Jays' },
			{ code: 'WSH', name: 'Washington Nationals' },
		];

		return { teams };
	} catch (error) {
		console.error('Error fetching teams:', error);
		return { teams: [] };
	}
}

export async function getTodayGames(): Promise<Game[]> {
	try {
		const today = new Date();
		const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
		return await getGamesForDate(dateStr);
	} catch (error) {
		console.error("Error fetching today's games:", error);
		return [];
	}
}

export async function getHealth(): Promise<{ status: string; timestamp: string; version: string }> {
	return {
		status: 'healthy',
		timestamp: new Date().toISOString(),
		version: '1.0.0',
	};
}
