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

		console.log(`Fetching games for date: ${date} (${month}/${day}/${year})`);

		// Fetch games from MLB API
		const response = await fetch(`${MLB_API_BASE}/schedule?sportId=1&date=${month}/${day}/${year}`);

		if (!response.ok) {
			throw new Error(`MLB API error: ${response.status}`);
		}

		const data = await response.json();
		console.log(`MLB API returned ${data.dates?.length || 0} dates, ${data.dates?.[0]?.games?.length || 0} games`);
		
		// Debug: log first few games
		if (data.dates?.[0]?.games) {
			console.log('First 3 games:');
			data.dates[0].games.slice(0, 3).forEach((game: any, index: number) => {
				const awayTeam = game.teams?.away?.team?.name;
				const homeTeam = game.teams?.home?.team?.name;
				const awayCode = TEAM_ABBREVIATIONS[awayTeam];
				const homeCode = TEAM_ABBREVIATIONS[homeTeam];
				console.log(`  ${index + 1}. ${awayTeam} (${awayCode}) vs ${homeTeam} (${homeCode})`);
			});
		}

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

				// Get current scores from the teams data
				const awayScore = awayTeam.score || 0;
				const homeScore = homeTeam.score || 0;

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
					away_score: awayScore,
					home_score: homeScore,
				};

				games.push(game);
			}
		}

		return games;
	} catch (error) {
		console.error(`Error fetching games for ${date}:`, error);
		console.log('Falling back to mock data');

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

		const scheduleResponse = await fetch(`${MLB_API_BASE}/schedule?sportId=1&date=${month}/${day}/${year}`);

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

				const awayTeamName = awayTeam.team?.name;
				const homeTeamName = homeTeam.team?.name;
				const awayCodeFromName = TEAM_ABBREVIATIONS[awayTeamName];
				const homeCodeFromName = TEAM_ABBREVIATIONS[homeTeamName];

				if (
					awayCodeFromName === awayCode &&
					homeCodeFromName === homeCode &&
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

		// Find the game data from the schedule
		let gameData = null;
		if (scheduleData.dates && scheduleData.dates.length > 0) {
			// First try to find by gamePk if we have it
			if (gamePk) {
				gameData = scheduleData.dates[0].games.find((game: any) => game.gamePk === gamePk);
				if (gameData) {
					console.log('Found game by gamePk:', gamePk);
				}
			}
			
			// If not found by gamePk, try by team codes
			if (!gameData) {
				for (const game of scheduleData.dates[0].games) {
					const teams = game.teams || {};
					const awayTeam = teams.away || {};
					const homeTeam = teams.home || {};
					const gameDetails = game.game || {};

					const awayTeamName = awayTeam.team?.name;
					const homeTeamName = homeTeam.team?.name;
					const awayCodeFromName = TEAM_ABBREVIATIONS[awayTeamName];
					const homeCodeFromName = TEAM_ABBREVIATIONS[homeTeamName];

					console.log(`Checking game: ${awayTeamName} (${awayCodeFromName}) vs ${homeTeamName} (${homeCodeFromName})`);
					console.log(`Looking for: ${awayCode} vs ${homeCode}`);

					if (
						awayCodeFromName === awayCode &&
						homeCodeFromName === homeCode
					) {
						gameData = game;
						console.log('Found matching game!');
						break;
					}
				}
			}
		}

		if (!gameData) {
			throw new Error('Game not found in schedule');
		}

		// Extract game information from schedule data
		const teams = gameData.teams || {};
		const awayTeam = teams.away || {};
		const homeTeam = teams.home || {};
		const gameInfo = gameData.game || {};
		const status = gameData.status || {};

		const awayTeamName = awayTeam.team?.name || 'Away Team';
		const homeTeamName = homeTeam.team?.name || 'Home Team';
		const awayCodeFromName = TEAM_ABBREVIATIONS[awayTeamName] || 'AWY';
		const homeCodeFromName = TEAM_ABBREVIATIONS[homeTeamName] || 'HOM';

		// Get scores from the schedule data
		const awayScore = awayTeam.score || 0;
		const homeScore = homeTeam.score || 0;

		// Build a simple inning list (since we don't have detailed inning data)
		const inningList = Array.from({ length: 9 }, (_, i) => ({ 
			inning: i + 1,
			away: 0,
			home: 0
		}));

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
				location: gameData.venue?.name || 'Stadium',
				inning_list: inningList,
				is_postponed: status.detailedState === 'Postponed',
				is_suspended: status.detailedState === 'Suspended',
			},
			svg_content: generateDetailedSVGFromSchedule(gameData, awayCodeFromName, homeCodeFromName),
			success: true,
		};
	} catch (error) {
		console.error(`Error fetching game details for ${gameId}:`, error);
		console.error('Error details:', error instanceof Error ? error.message : String(error));
		console.log('Falling back to mock data');

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

// SVG generator for schedule data
function generateDetailedSVGFromSchedule(gameData: any, awayCode: string, homeCode: string): string {
	const teams = gameData.teams || {};
	const awayTeam = teams.away || {};
	const homeTeam = teams.home || {};
	const gameInfo = gameData.game || {};
	const status = gameData.status || {};

	const awayTeamName = awayTeam.team?.name || 'Away';
	const homeTeamName = homeTeam.team?.name || 'Home';
	const awayScore = awayTeam.score || 0;
	const homeScore = homeTeam.score || 0;
	const gameStatus = status.detailedState || 'Unknown';

	return `
		<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
			<rect width="800" height="600" fill="white" stroke="black" stroke-width="2"/>
			
			<!-- Header -->
			<text x="400" y="30" text-anchor="middle" font-size="20" font-weight="bold">
				${awayTeamName} (${awayCode}) vs ${homeTeamName} (${homeCode})
			</text>
			
			<!-- Game Info -->
			<text x="400" y="55" text-anchor="middle" font-size="16">
				${gameData.venue?.name || 'Stadium'} - ${gameData.gameDate ? new Date(gameData.gameDate).toLocaleDateString() : ''}
			</text>
			
			<!-- Current Score -->
			<text x="400" y="80" text-anchor="middle" font-size="18" font-weight="bold">
				Final Score: ${awayCode} ${awayScore} - ${homeCode} ${homeScore}
			</text>
			
			<!-- Game Status -->
			<text x="400" y="105" text-anchor="middle" font-size="14">
				Status: ${gameStatus}
			</text>
			
			<!-- Score Summary -->
			<text x="400" y="150" text-anchor="middle" font-size="16" font-weight="bold">
				Game Summary
			</text>
			
			<text x="400" y="180" text-anchor="middle" font-size="14">
				${awayTeamName}: ${awayScore} runs
			</text>
			
			<text x="400" y="200" text-anchor="middle" font-size="14">
				${homeTeamName}: ${homeScore} runs
			</text>
			
			<!-- Winner -->
			<text x="400" y="240" text-anchor="middle" font-size="16" font-weight="bold" fill="${awayScore > homeScore ? 'blue' : 'red'}">
				Winner: ${awayScore > homeScore ? awayTeamName : homeTeamName}
			</text>
			
			<!-- Footer -->
			<text x="400" y="550" text-anchor="middle" font-size="12" fill="gray">
				Generated from MLB API - For detailed inning-by-inning scorecard, use the Python baseball library
			</text>
		</svg>
	`;
}

// Detailed SVG generator with actual game data
function generateDetailedSVG(gameData: any, awayCode: string, homeCode: string): string {
	const gameInfo = gameData.gameData || {};
	const liveData = gameData.liveData || {};
	const teams = gameInfo.teams || {};
	const awayTeam = teams.away || {};
	const homeTeam = teams.home || {};
	const linescore = liveData.linescore || {};

	const awayTeamName = awayTeam.team?.name || 'Away';
	const homeTeamName = homeTeam.team?.name || 'Home';
	const awayScore = awayTeam.score || 0;
	const homeScore = homeTeam.score || 0;
	const status = gameInfo.status?.detailedState || 'Unknown';
	const currentInning = linescore.currentInning || '';
	const inningState = linescore.inningState || '';

	// Build inning-by-inning score table
	let inningRows = '';
	let awayTotal = 0;
	let homeTotal = 0;

	if (linescore.innings && linescore.innings.length > 0) {
		linescore.innings.forEach((inning: any, index: number) => {
			const awayRuns = inning.away?.runs || 0;
			const homeRuns = inning.home?.runs || 0;
			awayTotal += awayRuns;
			homeTotal += homeRuns;
			
			inningRows += `
				<text x="100" y="${120 + index * 25}" font-size="14">${inning.num}</text>
				<text x="200" y="${120 + index * 25}" font-size="14" text-anchor="middle">${awayRuns}</text>
				<text x="300" y="${120 + index * 25}" font-size="14" text-anchor="middle">${homeRuns}</text>
			`;
		});
	}

	// Add totals row
	const totalRowY = 120 + (linescore.innings?.length || 0) * 25 + 10;
	inningRows += `
		<line x1="80" y1="${totalRowY - 5}" x2="320" y2="${totalRowY - 5}" stroke="black" stroke-width="1"/>
		<text x="100" y="${totalRowY + 15}" font-size="14" font-weight="bold">Total</text>
		<text x="200" y="${totalRowY + 15}" font-size="14" text-anchor="middle" font-weight="bold">${awayTotal}</text>
		<text x="300" y="${totalRowY + 15}" font-size="14" text-anchor="middle" font-weight="bold">${homeTotal}</text>
	`;

	return `
		<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
			<rect width="800" height="600" fill="white" stroke="black" stroke-width="2"/>
			
			<!-- Header -->
			<text x="400" y="30" text-anchor="middle" font-size="20" font-weight="bold">
				${awayTeamName} (${awayCode}) vs ${homeTeamName} (${homeCode})
			</text>
			
			<!-- Game Info -->
			<text x="400" y="55" text-anchor="middle" font-size="16">
				${gameInfo.venue?.name || 'Stadium'} - ${gameInfo.game?.gameDate ? new Date(gameInfo.game.gameDate).toLocaleDateString() : ''}
			</text>
			
			<!-- Current Score -->
			<text x="400" y="80" text-anchor="middle" font-size="18" font-weight="bold">
				Score: ${awayCode} ${awayScore} - ${homeCode} ${homeScore}
			</text>
			
			<!-- Game Status -->
			<text x="400" y="105" text-anchor="middle" font-size="14">
				Status: ${status} ${currentInning ? `- ${inningState} ${currentInning}` : ''}
			</text>
			
			<!-- Scorecard Table Header -->
			<text x="100" y="115" font-size="14" font-weight="bold">Inning</text>
			<text x="200" y="115" font-size="14" text-anchor="middle" font-weight="bold">${awayCode}</text>
			<text x="300" y="115" font-size="14" text-anchor="middle" font-weight="bold">${homeCode}</text>
			
			<!-- Inning-by-inning scores -->
			${inningRows}
			
			<!-- Footer -->
			<text x="400" y="550" text-anchor="middle" font-size="12" fill="gray">
				Generated from MLB API - For detailed scorecard, use the Python baseball library
			</text>
		</svg>
	`;
}

// Simple SVG generator for demonstration (fallback)
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
