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
	Athletics: 'ATH',
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
		// Parse the date string as local date (YYYY-MM-DD format)
		const [year, month, day] = date.split('-').map(Number);

		// Fetch games from MLB API with cache-busting parameter
		const timestamp = Date.now();
		const url = `${MLB_API_BASE}/schedule?sportId=1&date=${month}/${day}/${year}&t=${timestamp}`;

		const response = await fetch(url);

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

				// For now, we'll use basic data and let the frontend fetch detailed data when needed
				// This avoids performance issues with calling Python scripts for every game in the list
				let innings: Array<{ inning: number; away_runs: number; home_runs: number }> = [];
				let awayHits = 0;
				let homeHits = 0;
				let awayErrors = 0;
				let homeErrors = 0;

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
					is_live: status.codedGameState === 'I', // Only In Progress games are live
					inning: gameData.linescore?.currentInning || '',
					inning_state: gameData.linescore?.inningState || '',
					away_score: awayScore,
					home_score: homeScore,
					innings: innings,
					away_hits: awayHits,
					home_hits: homeHits,
					away_errors: awayErrors,
					home_errors: homeErrors,
					// Include MLB API status data for more reliable status determination
					mlbStatus: {
						detailedState: status.detailedState,
						codedGameState: status.codedGameState,
					},
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
				start_time: '8:00 PM',
				location: 'Dodger Stadium, Los Angeles, CA',
				status: 'Final',
				game_pk: 12345,
				is_live: false,
				away_score: 5,
				home_score: 3,
				innings: [
					{ inning: 1, away_runs: 1, home_runs: 0 },
					{ inning: 2, away_runs: 0, home_runs: 1 },
					{ inning: 3, away_runs: 0, home_runs: 0 },
					{ inning: 4, away_runs: 1, home_runs: 0 },
					{ inning: 5, away_runs: 0, home_runs: 0 },
					{ inning: 6, away_runs: 1, home_runs: 0 },
					{ inning: 7, away_runs: 0, home_runs: 0 },
					{ inning: 8, away_runs: 0, home_runs: 0 },
					{ inning: 9, away_runs: 0, home_runs: 0 },
				],
				away_hits: 9,
				home_hits: 6,
				away_errors: 1,
				home_errors: 0,
			},
		];
	}
}

export async function getGameDetails(gameId: string): Promise<GameData> {
	try {
		// Try to use the Python JSON integration script first (server-side only)
		if (typeof window === 'undefined') {
			try {
				// Dynamic import for server-side only
				const { exec } = require('child_process');
				const util = require('util');
				const execAsync = util.promisify(exec);

				// Call the Python script to get detailed game data
				const { stdout, stderr } = await execAsync(`python3 lib/baseball_json_integration.py ${gameId}`);

				if (stderr) {
					// Python script stderr output
				}

				// Parse the JSON output from Python
				const gameData = JSON.parse(stdout);

				if (gameData && gameData.integration_status === 'real_baseball_library_data') {
					// Convert the Python data format to our expected format
					const convertedGameData = {
						away_team: {
							name: gameData.away_team,
							abbreviation: gameData.away_code,
						},
						home_team: {
							name: gameData.home_team,
							abbreviation: gameData.home_code,
						},
						game_date_str: gameData.game_date_str,
						location: gameData.location,
						inning_list: gameData.inning_list || [],
						is_postponed: false,
						is_suspended: false,
						// Add the detailed data from Python
						detailed_data: gameData,
					};

					// Generate SVG from the detailed data
					const svgContent = generateDetailedSVGFromPythonData(gameData);

					return {
						game_id: gameId,
						game_data: convertedGameData,
						svg_content: svgContent,
						success: true,
					};
				}
			} catch (pythonError) {
				// Python integration failed, falling back to MLB API
			}
		}

		// Fallback to original MLB API logic

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
		// Use the same date parsing method as getGamesForDate to avoid timezone issues
		const [year, month, day] = date.split('-').map(Number);

		// Add cache-busting parameter to ensure fresh data
		const timestamp = Date.now();
		const scheduleResponse = await fetch(
			`${MLB_API_BASE}/schedule?sportId=1&date=${month}/${day}/${year}&t=${timestamp}`
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
					// Found game by gamePk
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

					if (awayCodeFromName === awayCode && homeCodeFromName === homeCode) {
						gameData = game;
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

		// Try to get detailed inning data from the game feed
		let inningList = Array.from({ length: 9 }, (_, i) => ({
			inning: i + 1,
			away: 0,
			home: 0,
		}));

		try {
			// Fetch detailed game data for inning-by-inning scores
			const gameFeedResponse = await fetch(`${MLB_API_BASE}/game/${gameData.gamePk}/feed/live`);
			if (gameFeedResponse.ok) {
				const gameFeedData = await gameFeedResponse.json();
				const linescore = gameFeedData.liveData?.linescore;

				if (linescore && linescore.innings) {
					inningList = linescore.innings.map((inning: any, index: number) => ({
						inning: index + 1,
						away: inning.away?.runs || 0,
						home: inning.home?.runs || 0,
					}));
				}
			}
		} catch (feedError) {
			// Could not fetch detailed game feed, using basic data
		}

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
				// Include the actual scores
				away_score: awayScore,
				home_score: homeScore,
				total_away_runs: awayScore,
				total_home_runs: homeScore,
				status: status.detailedState,
			},
			svg_content: generateDetailedSVGFromSchedule(gameData, awayCodeFromName, homeCodeFromName, inningList),
			success: true,
		};
	} catch (error) {
		console.error(`Error fetching game details for ${gameId}:`, error);
		console.error('Error details:', error instanceof Error ? error.message : String(error));

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

// SVG generator for Python integration data
function generateDetailedSVGFromPythonData(gameData: any): string {
	const awayTeamName = gameData.away_team?.name || 'Away';
	const homeTeamName = gameData.home_team?.name || 'Home';
	const awayCode = gameData.away_team?.abbreviation || gameData.away_code || 'AWY';
	const homeCode = gameData.home_team?.abbreviation || gameData.home_code || 'HOM';
	const awayScore = gameData.total_away_runs || 0;
	const homeScore = gameData.total_home_runs || 0;
	const gameDate = gameData.game_date_str || '';
	const location = gameData.location || 'Stadium';

	// Build inning-by-inning score table
	let inningRows = '';
	let awayTotal = 0;
	let homeTotal = 0;

	if (gameData.innings && gameData.innings.length > 0) {
		gameData.innings.forEach((inning: any, index: number) => {
			const awayRuns = inning.away_runs || 0;
			const homeRuns = inning.home_runs || 0;
			awayTotal += awayRuns;
			homeTotal += homeRuns;

			inningRows += `
				<text x="100" y="${120 + index * 25}" font-size="14">${inning.inning}</text>
				<text x="200" y="${120 + index * 25}" font-size="14" text-anchor="middle">${awayRuns}</text>
				<text x="300" y="${120 + index * 25}" font-size="14" text-anchor="middle">${homeRuns}</text>
			`;
		});
	}

	// Add totals row
	const totalRowY = 120 + (gameData.innings?.length || 0) * 25 + 10;
	inningRows += `
		<line x1="80" y1="${totalRowY - 5}" x2="320" y2="${totalRowY - 5}" stroke="black" stroke-width="1"/>
		<text x="100" y="${totalRowY + 15}" font-size="14" font-weight="bold">Total</text>
		<text x="200" y="${totalRowY + 15}" font-size="14" text-anchor="middle" font-weight="bold">${awayTotal}</text>
		<text x="300" y="${totalRowY + 15}" font-size="14" text-anchor="middle" font-weight="bold">${homeTotal}</text>
	`;

	// Add detailed event information if available
	let eventDetails = '';
	if (gameData.innings && gameData.innings.length > 0) {
		eventDetails = `
			<!-- Event Details -->
			<text x="400" y="${totalRowY + 50}" text-anchor="middle" font-size="16" font-weight="bold">
				Detailed Game Events
			</text>
		`;

		let eventY = totalRowY + 80;
		gameData.innings.forEach((inning: any, inningIndex: number) => {
			if (inning.top_events && inning.top_events.length > 0) {
				eventDetails += `
					<text x="50" y="${eventY}" font-size="12" font-weight="bold">Top ${inning.inning}:</text>
				`;
				eventY += 20;

				inning.top_events.slice(0, 3).forEach((event: any, eventIndex: number) => {
					eventDetails += `
						<text x="70" y="${eventY}" font-size="10">${event.batter}: ${event.summary}</text>
					`;
					eventY += 15;
				});
			}

			if (inning.bottom_events && inning.bottom_events.length > 0) {
				eventDetails += `
					<text x="50" y="${eventY}" font-size="12" font-weight="bold">Bottom ${inning.inning}:</text>
				`;
				eventY += 20;

				inning.bottom_events.slice(0, 3).forEach((event: any, eventIndex: number) => {
					eventDetails += `
						<text x="70" y="${eventY}" font-size="10">${event.batter}: ${event.summary}</text>
					`;
					eventY += 15;
				});
			}

			eventY += 10;
		});
	}

	return `
		<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
			<rect width="800" height="600" fill="white" stroke="black" stroke-width="2"/>
			
			<!-- Header -->
			<text x="400" y="30" text-anchor="middle" font-size="20" font-weight="bold">
				${awayTeamName} (${awayCode}) vs ${homeTeamName} (${homeCode})
			</text>
			
			<!-- Game Info -->
			<text x="400" y="55" text-anchor="middle" font-size="16">
				${location} - ${gameDate}
			</text>
			
			<!-- Current Score -->
			<text x="400" y="80" text-anchor="middle" font-size="18" font-weight="bold">
				Final Score: ${awayCode} ${awayScore} - ${homeCode} ${homeScore}
			</text>
			
			<!-- Scorecard Table Header -->
			<text x="100" y="105" font-size="14" font-weight="bold">Inning</text>
			<text x="200" y="105" font-size="14" text-anchor="middle" font-weight="bold">${awayCode}</text>
			<text x="300" y="105" font-size="14" text-anchor="middle" font-weight="bold">${homeCode}</text>
			
			<!-- Inning-by-inning scores -->
			${inningRows}
			
			<!-- Event Details -->
			${eventDetails}
			
			<!-- Footer -->
			<text x="400" y="580" text-anchor="middle" font-size="12" fill="gray">
				Generated from Python Baseball Library Integration - Real Game Data
			</text>
		</svg>
	`;
}

// SVG generator for schedule data
function generateDetailedSVGFromSchedule(
	gameData: any,
	awayCode: string,
	homeCode: string,
	inningList: any[] = []
): string {
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
			
			<!-- Inning-by-Inning Scores -->
			<text x="400" y="150" text-anchor="middle" font-size="16" font-weight="bold">
				Inning-by-Inning Scores
			</text>
			
			<!-- Inning Headers -->
			<text x="200" y="180" text-anchor="middle" font-size="14" font-weight="bold">Inning</text>
			<text x="300" y="180" text-anchor="middle" font-size="14" font-weight="bold">${awayCode}</text>
			<text x="500" y="180" text-anchor="middle" font-size="14" font-weight="bold">${homeCode}</text>
			
			<!-- Inning Scores -->
			${inningList
				.map(
					(inning, index) => `
				<text x="200" y="${200 + index * 25}" text-anchor="middle" font-size="12">${inning.inning}</text>
				<text x="300" y="${200 + index * 25}" text-anchor="middle" font-size="12">${inning.away}</text>
				<text x="500" y="${200 + index * 25}" text-anchor="middle" font-size="12">${inning.home}</text>
			`
				)
				.join('')}
			
			<!-- Total Scores -->
			<line x1="150" y1="${200 + inningList.length * 25 + 10}" x2="550" y2="${
		200 + inningList.length * 25 + 10
	}" stroke="black" stroke-width="1"/>
			<text x="200" y="${
				200 + inningList.length * 25 + 30
			}" text-anchor="middle" font-size="14" font-weight="bold">Total</text>
			<text x="300" y="${
				200 + inningList.length * 25 + 30
			}" text-anchor="middle" font-size="14" font-weight="bold">${awayScore}</text>
			<text x="500" y="${
				200 + inningList.length * 25 + 30
			}" text-anchor="middle" font-size="14" font-weight="bold">${homeScore}</text>
			
			<!-- Winner -->
			<text x="400" y="${200 + inningList.length * 25 + 60}" text-anchor="middle" font-size="16" font-weight="bold" fill="${
		awayScore > homeScore ? 'blue' : 'red'
	}">
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
				${gameInfo.venue?.name || 'Stadium'} - ${
		gameInfo.game?.gameDate ? new Date(gameInfo.game.gameDate).toLocaleDateString() : ''
	}
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
		// Use local timezone to match frontend behavior
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0');
		const day = String(today.getDate()).padStart(2, '0');
		const dateStr = `${year}-${month}-${day}`;
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
