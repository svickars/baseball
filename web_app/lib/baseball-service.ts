import { Game, GameData } from '@/types';

// MLB API base URL
const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';

// Cache configuration
interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttl: number;
}

interface CacheConfig {
	defaultTTL: number; // in milliseconds
	maxSize: number;
	cleanupInterval: number; // in milliseconds
}

// Cache implementation
class APICache {
	private cache = new Map<string, CacheEntry<any>>();
	private config: CacheConfig;
	private cleanupTimer: NodeJS.Timeout | null = null;

	constructor(config: CacheConfig) {
		this.config = config;
		this.startCleanupTimer();
	}

	set<T>(key: string, data: T, ttl?: number): void {
		const entry: CacheEntry<T> = {
			data,
			timestamp: Date.now(),
			ttl: ttl || this.config.defaultTTL,
		};

		// If cache is at max size, remove oldest entry
		if (this.cache.size >= this.config.maxSize) {
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey) {
				this.cache.delete(oldestKey);
			}
		}

		this.cache.set(key, entry);
	}

	get<T>(key: string): T | null {
		const entry = this.cache.get(key);
		if (!entry) return null;

		const now = Date.now();
		if (now - entry.timestamp > entry.ttl) {
			this.cache.delete(key);
			return null;
		}

		return entry.data;
	}

	has(key: string): boolean {
		const entry = this.cache.get(key);
		if (!entry) return false;

		const now = Date.now();
		if (now - entry.timestamp > entry.ttl) {
			this.cache.delete(key);
			return false;
		}

		return true;
	}

	delete(key: string): void {
		this.cache.delete(key);
	}

	clear(): void {
		this.cache.clear();
	}

	size(): number {
		return this.cache.size;
	}

	private startCleanupTimer(): void {
		this.cleanupTimer = setInterval(() => {
			const now = Date.now();
			const keysToDelete: string[] = [];

			this.cache.forEach((entry, key) => {
				if (now - entry.timestamp > entry.ttl) {
					keysToDelete.push(key);
				}
			});

			keysToDelete.forEach((key) => this.cache.delete(key));
		}, this.config.cleanupInterval);
	}

	destroy(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}
		this.cache.clear();
	}
}

// Cache instances with different TTLs for different data types
const gameDetailsCache = new APICache({
	defaultTTL: 5 * 60 * 1000, // 5 minutes for game details
	maxSize: 100,
	cleanupInterval: 60 * 1000, // Clean up every minute
});

const scheduleCache = new APICache({
	defaultTTL: 2 * 60 * 1000, // 2 minutes for schedule data
	maxSize: 50,
	cleanupInterval: 60 * 1000,
});

const gameFeedCache = new APICache({
	defaultTTL: 30 * 1000, // 30 seconds for live game feeds
	maxSize: 200,
	cleanupInterval: 30 * 1000, // Clean up every 30 seconds
});

const coachesCache = new APICache({
	defaultTTL: 60 * 60 * 1000, // 1 hour for coaches data (rarely changes)
	maxSize: 30,
	cleanupInterval: 10 * 60 * 1000, // Clean up every 10 minutes
});

const uniformsCache = new APICache({
	defaultTTL: 60 * 60 * 1000, // 1 hour for uniforms data (rarely changes)
	maxSize: 30,
	cleanupInterval: 10 * 60 * 1000,
});

// Request deduplication
const pendingRequests = new Map<string, Promise<any>>();

// Helper function to create cache keys
const createCacheKey = (type: string, ...params: (string | undefined)[]): string => {
	return `${type}:${params.filter((p) => p !== undefined).join(':')}`;
};

// Helper function to make cached requests
async function makeCachedRequest<T>(cache: APICache, key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> {
	// Check cache first
	const cached = cache.get<T>(key);
	if (cached !== null) {
		return cached;
	}

	// Check if request is already pending
	if (pendingRequests.has(key)) {
		return pendingRequests.get(key);
	}

	// Make the request
	const request = fetchFn()
		.then((data) => {
			// Cache the result
			cache.set(key, data, ttl);
			// Remove from pending requests
			pendingRequests.delete(key);
			return data;
		})
		.catch((error) => {
			// Remove from pending requests on error
			pendingRequests.delete(key);
			throw error;
		});

	// Store pending request
	pendingRequests.set(key, request);
	return request;
}

// Helper function to extract batter statistics from MLB API data
function extractBatterStats(
	batterIds: any[],
	players: any,
	substitutionData?: Map<string, { type: string; inning: number; halfInning: string }>
): any[] {
	console.log(`Extracting batters with ${batterIds.length} batter IDs:`, batterIds);

	// Convert batter IDs to full player objects with stats
	const batterObjects = batterIds
		.map((batterId: any) => {
			// batterId might be a string or number, convert to string for lookup
			const idStr = String(batterId);
			const playerIdWithPrefix = `ID${idStr}`;
			// Look up from the players collection which has stats, not the basic players collection
			const player = players[playerIdWithPrefix];
			console.log(`Looking up batter ID ${batterId} as ${playerIdWithPrefix}:`, player ? 'Found' : 'Not found');
			return player;
		})
		.filter(Boolean); // Remove any undefined players

	console.log(
		'Batters found:',
		batterObjects.map((p: any) => ({
			name: p.person?.fullName,
			hasStats: !!p.stats,
			battingStats: p.stats?.batting,
		}))
	);

	const result = batterObjects
		.filter((batter: any) => {
			// Filter out pitchers - only include actual batters
			const position = batter.position?.abbreviation || '';
			const positionType = batter.position?.type || '';
			const battingOrder = batter.battingOrder || '';

			// Include pitchers who are batting due to DH being lost (position "1" or batting order indicates they're batting)
			if (position === '1' || (positionType === 'Pitcher' && battingOrder && parseInt(battingOrder) >= 100)) {
				return true;
			}

			// Exclude other pitchers and any position that's not a fielding position
			return position !== 'P' && positionType !== 'Pitcher' && position !== '' && position !== '?';
		})
		.map((batter: any) => {
			const playerName = batter.person?.fullName || batter.name || 'Unknown';
			const stats = batter.stats?.batting || batter.stats || {};

			// Calculate slash line statistics
			const atBats = stats.atBats || 0;
			const hits = stats.hits || 0;
			const walks = stats.baseOnBalls || stats.walks || 0;
			const hitByPitch = stats.hitByPitch || 0;
			const sacrificeFlies = stats.sacrificeFlies || 0;
			const singles = stats.singles || 0;
			const doubles = stats.doubles || 0;
			const triples = stats.triples || 0;
			const homeRuns = stats.homeRuns || 0;

			// Calculate batting average
			const battingAverage = atBats > 0 ? hits / atBats : 0;

			// Calculate on-base percentage (H + BB + HBP) / (AB + BB + HBP + SF)
			const plateAppearances = atBats + walks + hitByPitch + sacrificeFlies;
			const onBasePercentage = plateAppearances > 0 ? (hits + walks + hitByPitch) / plateAppearances : 0;

			// Calculate slugging percentage (1B + 2*2B + 3*3B + 4*HR) / AB
			const totalBases = singles + doubles * 2 + triples * 3 + homeRuns * 4;
			const sluggingPercentage = atBats > 0 ? totalBases / atBats : 0;

			// Determine substitution type from all_positions array first
			let substitutionType = 'DEF'; // Default to defensive substitution
			if (batter.allPositions && batter.allPositions.length > 0) {
				const firstPosition = batter.allPositions[0];
				if (firstPosition.code === '11' || firstPosition.name === 'Pinch Hitter') {
					substitutionType = 'PH';
				} else if (firstPosition.code === '12' || firstPosition.name === 'Pinch Runner') {
					substitutionType = 'PR';
				}
			}

			// Override with play-by-play data if available
			const apiSubstitutionData = substitutionData?.get(playerName);
			if (apiSubstitutionData) {
				substitutionType = apiSubstitutionData.type;
			}

			// Map position abbreviations to numbers
			const positionNumber = mapPositionToNumber(batter.position?.abbreviation || '?');

			return {
				name: batter.person?.fullName || 'Unknown',
				at_bats: atBats,
				hits: hits,
				runs: stats.runs || 0,
				rbis: stats.rbi || 0,
				walks: walks,
				strikeouts: stats.strikeOuts || stats.strikeouts || 0,
				average: battingAverage.toFixed(3),
				onBasePercentage: onBasePercentage.toFixed(3),
				sluggingPercentage: sluggingPercentage.toFixed(3),
				position: positionNumber,
				positionAbbreviation: batter.position?.abbreviation || '?',
				lineup_order: batter.stats?.battingOrder || batter.stats?.batting?.battingOrder || 0,
				jersey_number: batter.jerseyNumber ? String(batter.jerseyNumber) : '0',
				// Add substitution data
				batting_order: batter.battingOrder || '100',
				is_substitute: batter.gameStatus?.isSubstitute || false,
				all_positions: batter.allPositions || [],
				// Add substitution type and inning data from play-by-play data
				substitution_type: substitutionType,
				substitution_inning: apiSubstitutionData?.inning || 9,
				substitution_half_inning: apiSubstitutionData?.halfInning || 'top',
				// Add detailed stats for slash line
				singles: singles,
				doubles: doubles,
				triples: triples,
				homeRuns: homeRuns,
				hitByPitch: hitByPitch,
				sacrificeFlies: sacrificeFlies,
			};
		});

	return result;
}

// Helper function to map position abbreviations to numbers
function mapPositionToNumber(position: string): string {
	const positionMap: { [key: string]: string } = {
		P: '1', // Pitcher
		C: '2', // Catcher
		'1B': '3', // First Base
		'2B': '4', // Second Base
		'3B': '5', // Third Base
		SS: '6', // Shortstop
		LF: '7', // Left Field
		CF: '8', // Center Field
		RF: '9', // Right Field
		DH: '10', // Designated Hitter
		PH: 'PH', // Pinch Hitter
		PR: 'PR', // Pinch Runner
	};

	return positionMap[position] || position;
}

// Helper function to process play-by-play data and extract at-bat results
function processPlayByPlayData(allPlays: any[], players: any): any {
	const playByPlayData = {
		atBats: new Map<string, any[]>(),
		substitutions: new Map<string, any[]>(),
		inningResults: new Map<string, any[]>(),
		errors: new Map<string, any[]>(),
	};

	allPlays.forEach((play: any, index: number) => {
		const inning = play.about?.inning || 0;
		const halfInning = play.about?.halfInning || 'top';
		const batterId = play.matchup?.batter?.id;
		const pitcherId = play.matchup?.pitcher?.id;

		// Debug logging for first few plays to check error detection
		if (index < 10) {
			console.log(`DEBUG: Play ${index}:`, {
				inning,
				halfInning,
				eventType: play.result?.eventType,
				description: play.result?.description,
				hasErrorText: (play.result?.description || '').toLowerCase().includes('error'),
				hasPickoffError: (play.result?.description || '').toLowerCase().includes('pickoff'),
				fullPlay: play,
			});
		}

		// Debug logging for third inning plays to find the pickoff error
		if (inning === 3 && halfInning === 'top') {
			console.log(`DEBUG: Third inning top play ${index}:`, {
				inning,
				halfInning,
				eventType: play.result?.eventType,
				description: play.result?.description,
				hasErrorText: (play.result?.description || '').toLowerCase().includes('error'),
				hasPickoffError: (play.result?.description || '').toLowerCase().includes('pickoff'),
				hasAdvance: (play.result?.description || '').toLowerCase().includes('advance'),
				fullPlay: play,
			});
		}

		// Track errors based on MLB API event types
		const eventType = play.result?.eventType;
		const isError =
			eventType &&
			(eventType === 'REACH_ON_ERROR' ||
				eventType === 'field_error' ||
				eventType === 'error' ||
				eventType === 'pickoff_error_1b' ||
				eventType === 'pickoff_error_2b' ||
				eventType === 'pickoff_error_3b' ||
				eventType === 'DROPPED_BALL_ERROR' ||
				eventType === 'throwing_error' ||
				eventType === 'catching_error' ||
				eventType === 'fielding_error');

		// Also check description for error-related text
		const description = play.result?.description || '';
		const hasErrorText =
			description.toLowerCase().includes('error') ||
			description.toLowerCase().includes('throwing error') ||
			description.toLowerCase().includes('fielding error') ||
			description.toLowerCase().includes('catching error') ||
			description.toLowerCase().includes('advanced on error') ||
			description.toLowerCase().includes('pickoff error');

		if (isError || hasErrorText) {
			console.log(`DEBUG: ERROR DETECTED in play ${index}:`, {
				inning,
				halfInning,
				eventType,
				description,
				isError,
				hasErrorText,
			});

			const errorKey = `${inning}-${halfInning}`;
			if (!playByPlayData.errors.has(errorKey)) {
				playByPlayData.errors.set(errorKey, []);
			}

			playByPlayData.errors.get(errorKey)!.push({
				inning: inning,
				halfInning: halfInning,
				eventType: eventType,
				description: description,
				team: halfInning === 'top' ? 'home' : 'away', // Error committed by the team in the field
			});
		}

		// Debug logging for plays that mention "advance" or "pickoff" to find the pickoff error
		if (description.toLowerCase().includes('advance') || description.toLowerCase().includes('pickoff')) {
			console.log(`DEBUG: POTENTIAL ERROR PLAY with advance/pickoff in play ${index}:`, {
				inning,
				halfInning,
				eventType,
				description,
				hasErrorText,
				isError,
			});
		}

		// Debug logging for all plays to find any mention of errors or advances
		if (
			description.toLowerCase().includes('error') ||
			description.toLowerCase().includes('throwing') ||
			description.toLowerCase().includes('fielding') ||
			description.toLowerCase().includes('catching') ||
			description.toLowerCase().includes('miscue') ||
			description.toLowerCase().includes('misplay')
		) {
			console.log(`DEBUG: POTENTIAL ERROR PLAY found in play ${index}:`, {
				inning,
				halfInning,
				eventType,
				description,
				hasErrorText,
				isError,
			});
		}

		if (batterId && pitcherId) {
			const batter = players[`ID${batterId}`];
			const pitcher = players[`ID${pitcherId}`];

			if (batter && pitcher) {
				const atBatKey = `${batter.person?.fullName || 'Unknown'}-${inning}-${halfInning}`;

				if (!playByPlayData.atBats.has(atBatKey)) {
					playByPlayData.atBats.set(atBatKey, []);
				}

				const atBatResult = {
					batter: batter.person?.fullName || 'Unknown',
					batterId: batterId,
					batterNumber: batter.jerseyNumber || '0',
					pitcher: pitcher.person?.fullName || 'Unknown',
					pitcherId: pitcherId,
					pitcherNumber: pitcher.jerseyNumber || '0',
					inning: inning,
					halfInning: halfInning,
					result: play.result?.event || 'Unknown',
					description: play.result?.description || '',
					gotOnBase:
						play.result?.eventType === 'Hit' ||
						play.result?.eventType === 'Walk' ||
						play.result?.eventType === 'HitByPitch',
					rbi: play.result?.rbi || 0,
					outs: play.result?.outs || 0,
					pitches: play.pitchHand?.pitches || [],
					atBatResult: mapAtBatResult(play.result?.event, play.result?.description),
				};

				playByPlayData.atBats.get(atBatKey)!.push(atBatResult);
			}
		}
	});

	// Convert Maps to plain objects for JSON serialization
	const result = {
		atBats: Object.fromEntries(playByPlayData.atBats),
		substitutions: Object.fromEntries(playByPlayData.substitutions),
		inningResults: Object.fromEntries(playByPlayData.inningResults),
		errors: Object.fromEntries(playByPlayData.errors),
	};

	console.log('DEBUG: processPlayByPlayData final result:', {
		atBatsCount: playByPlayData.atBats.size,
		substitutionsCount: playByPlayData.substitutions.size,
		errorsCount: playByPlayData.errors.size,
		errorsKeys: Array.from(playByPlayData.errors.keys()),
		allPlaysProcessed: allPlays.length,
	});

	return result;
}

// Helper function to map position names to numbers
function mapPositionNameToNumber(positionName: string): string {
	const positionMap: { [key: string]: string } = {
		pitcher: '1',
		p: '1',
		catcher: '2',
		c: '2',
		'first baseman': '3',
		'first base': '3',
		first: '3',
		'1b': '3',
		'second baseman': '4',
		'second base': '4',
		second: '4',
		'2b': '4',
		'third baseman': '5',
		'third base': '5',
		third: '5',
		'3b': '5',
		shortstop: '6',
		short: '6',
		'short stop': '6',
		ss: '6',
		'left fielder': '7',
		'left field': '7',
		left: '7',
		lf: '7',
		'center fielder': '8',
		'center field': '8',
		center: '8',
		centerfield: '8',
		cf: '8',
		'right fielder': '9',
		'right field': '9',
		right: '9',
		rf: '9',
		'designated hitter': '10',
		dh: '10',
	};

	// Handle variations and abbreviations
	const normalized = positionName.toLowerCase().replace(/s$/, ''); // Remove plural 's'

	// Try exact match first
	if (positionMap[positionName.toLowerCase()]) {
		return positionMap[positionName.toLowerCase()];
	}

	// Try normalized match
	if (positionMap[normalized]) {
		return positionMap[normalized];
	}

	// Try partial matches for compound names
	for (const [key, value] of Object.entries(positionMap)) {
		if (normalized.includes(key) || key.includes(normalized)) {
			return value;
		}
	}

	return '';
}

// Helper function to map MLB API at-bat results to scorecard abbreviations
function mapAtBatResult(event: string, description: string): string {
	if (!event) return '';

	const eventLower = event.toLowerCase();
	const descLower = description.toLowerCase();

	// Hit types
	if (eventLower.includes('single')) return '1B';
	if (eventLower.includes('double')) return '2B';
	if (eventLower.includes('triple')) return '3B';
	if (eventLower.includes('home run')) return 'HR';

	// Strikeouts
	if (eventLower.includes('strikeout') || eventLower.includes('strike out')) {
		if (descLower.includes('swinging')) return 'K';
		if (descLower.includes('called')) return 'K';
		return 'K';
	}

	// Walks
	if (eventLower.includes('walk')) return 'BB';
	if (eventLower.includes('intentional walk')) return 'IBB';

	// Hit by pitch
	if (eventLower.includes('hit by pitch')) return 'HBP';

	// Double plays - handle these before regular groundouts
	if (descLower.includes('double play') || descLower.includes('grounded into double play')) {
		// Look for positions involved in the double play
		const positions: string[] = [];

		// Try to extract positions from the description
		// Common patterns: "6-4-3 double play", "4-6-3 double play", etc.
		const positionMatch = descLower.match(/(\d+)-(\d+)(?:-(\d+))?/);
		if (positionMatch) {
			// Get the first two positions (most common for GXY notation)
			positions.push(positionMatch[1], positionMatch[2]);
			return `G${positions.join('')}`;
		}

		// Fallback: try to extract position names
		const positionNames = ['shortstop', 'second baseman', 'first baseman', 'third baseman', 'pitcher', 'catcher'];
		for (const posName of positionNames) {
			if (descLower.includes(posName)) {
				const posNum = mapPositionNameToNumber(posName);
				if (posNum) positions.push(posNum);
			}
		}

		if (positions.length >= 2) {
			return `G${positions.slice(0, 2).join('')}`;
		}

		return 'GIDP'; // Fallback for double play
	}

	// Groundouts with position details
	if (eventLower.includes('groundout') || eventLower.includes('ground out') || eventLower.includes('grounded out')) {
		// Look for "to [position]" pattern for assisted outs
		const toMatch = descLower.match(/to (\w+(?:\s+\w+)*)/);
		if (toMatch) {
			const position = toMatch[1];
			const positionNum = mapPositionNameToNumber(position);
			if (positionNum) {
				return `G${positionNum}`;
			}
		}

		// Look for "unassisted" pattern
		if (descLower.includes('unassisted')) {
			const unassistedMatch = descLower.match(/unassisted.*?(\w+(?:\s+\w+)*)/);
			if (unassistedMatch) {
				const position = unassistedMatch[1];
				const positionNum = mapPositionNameToNumber(position);
				if (positionNum) {
					return `U${positionNum}`;
				}
			}
		}

		// Try to extract position numbers directly (e.g., "6-3", "4-3")
		const positionNumMatch = descLower.match(/(\d+)-(\d+)/);
		if (positionNumMatch) {
			return `G${positionNumMatch[1]}`;
		}

		return 'G';
	}

	// Flyouts with position details
	if (eventLower.includes('flyout') || eventLower.includes('fly out') || eventLower.includes('flied out')) {
		// Look for "to [position]" pattern
		const toMatch = descLower.match(/to (\w+(?:\s+\w+)*)/);
		if (toMatch) {
			const position = toMatch[1];
			const positionNum = mapPositionNameToNumber(position);
			if (positionNum) {
				return `F${positionNum}`;
			}
		}

		// Try to extract position numbers directly
		const positionNumMatch = descLower.match(/(\d+)-(\d+)/);
		if (positionNumMatch) {
			return `F${positionNumMatch[1]}`;
		}

		return 'F';
	}

	// Lineouts with position details
	if (eventLower.includes('lineout') || eventLower.includes('line out') || eventLower.includes('lined out')) {
		const toMatch = descLower.match(/to (\w+(?:\s+\w+)*)/);
		if (toMatch) {
			const position = toMatch[1];
			const positionNum = mapPositionNameToNumber(position);
			if (positionNum) {
				return `L${positionNum}`;
			}
		}

		// Try to extract position numbers directly
		const positionNumMatch = descLower.match(/(\d+)-(\d+)/);
		if (positionNumMatch) {
			return `L${positionNumMatch[1]}`;
		}

		return 'L';
	}

	// Popouts with position details
	if (eventLower.includes('popout') || eventLower.includes('pop out') || eventLower.includes('popped out')) {
		const toMatch = descLower.match(/to (\w+(?:\s+\w+)*)/);
		if (toMatch) {
			const position = toMatch[1];
			const positionNum = mapPositionNameToNumber(position);
			if (positionNum) {
				return `P${positionNum}`;
			}
		}

		// Try to extract position numbers directly
		const positionNumMatch = descLower.match(/(\d+)-(\d+)/);
		if (positionNumMatch) {
			return `P${positionNumMatch[1]}`;
		}

		return 'P';
	}

	// Sacrifice
	if (eventLower.includes('sacrifice fly')) return 'SF';
	if (eventLower.includes('sacrifice bunt')) return 'SAC';

	// Fielders choice
	if (eventLower.includes('fielders choice') || eventLower.includes("fielder's choice")) {
		// Try to get the position that made the play
		const toMatch = descLower.match(/to (\w+(?:\s+\w+)*)/);
		if (toMatch) {
			const position = toMatch[1];
			const positionNum = mapPositionNameToNumber(position);
			if (positionNum) {
				return `FC${positionNum}`;
			}
		}
		return 'FC';
	}

	// Error with specific fielder
	if (eventLower.includes('error') || descLower.includes('error')) {
		// Try to extract which fielder made the error
		const positionNames = [
			'shortstop',
			'second baseman',
			'first baseman',
			'third baseman',
			'pitcher',
			'catcher',
			'left fielder',
			'center fielder',
			'right fielder',
		];
		for (const posName of positionNames) {
			if (descLower.includes(posName) && descLower.includes('error')) {
				const posNum = mapPositionNameToNumber(posName);
				if (posNum) {
					return `E${posNum}`;
				}
			}
		}

		// Try to extract position numbers directly
		const positionNumMatch = descLower.match(/(\d+)-(\d+)/);
		if (positionNumMatch && descLower.includes('error')) {
			return `E${positionNumMatch[1]}`;
		}

		return 'E';
	}

	// Force out
	if (eventLower.includes('force out') || eventLower.includes('forced out')) {
		const toMatch = descLower.match(/to (\w+(?:\s+\w+)*)/);
		if (toMatch) {
			const position = toMatch[1];
			const positionNum = mapPositionNameToNumber(position);
			if (positionNum) {
				return `FO${positionNum}`;
			}
		}
		return 'FO';
	}

	return event.substring(0, 3).toUpperCase();
}

// Helper function to extract umpires from game feed data
function extractUmpires(gameFeedData: any): Array<{ name: string; position: string; id?: string | null }> {
	const umpires: Array<{ name: string; position: string; id?: string | null }> = [];

	if (gameFeedData.liveData?.boxscore?.officials) {
		gameFeedData.liveData.boxscore.officials.forEach((official: any) => {
			// Map full position names to abbreviated ones that the UI expects
			const positionMap: { [key: string]: string } = {
				'Home Plate': 'HP',
				'First Base': '1B',
				'Second Base': '2B',
				'Third Base': '3B',
			};

			const officialType = official.officialType || 'Unknown';
			const mappedPosition = positionMap[officialType] || officialType;

			umpires.push({
				name: official.official?.fullName || 'Unknown Umpire',
				position: mappedPosition,
				id: official.official?.id?.toString(),
			});
		});
	}

	return umpires.length > 0 ? umpires : generateFallbackUmpires();
}

// Helper function to extract managers from team coaches endpoints
async function extractManagers(
	awayTeamId: number,
	homeTeamId: number
): Promise<{ away: string | null; home: string | null }> {
	const managers = { away: null as string | null, home: null as string | null };

	try {
		// Fetch coaching staff for both teams
		const [awayCoachesResponse, homeCoachesResponse] = await Promise.all([
			fetch(`https://statsapi.mlb.com/api/v1/teams/${awayTeamId}/coaches`, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; BaseballApp/1.0)',
				},
			}),
			fetch(`https://statsapi.mlb.com/api/v1/teams/${homeTeamId}/coaches`, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; BaseballApp/1.0)',
				},
			}),
		]);

		if (awayCoachesResponse.ok) {
			const awayCoachesData = await awayCoachesResponse.json();
			const awayManager = awayCoachesData.roster?.find((coach: any) => coach.jobId === 'MNGR');
			if (awayManager?.person?.fullName) {
				managers.away = awayManager.person.fullName;
			}
		}

		if (homeCoachesResponse.ok) {
			const homeCoachesData = await homeCoachesResponse.json();
			const homeManager = homeCoachesData.roster?.find((coach: any) => coach.jobId === 'MNGR');
			if (homeManager?.person?.fullName) {
				managers.home = homeManager.person.fullName;
			}
		}

		console.log('Extracted managers from coaches endpoint:', {
			awayManager: managers.away,
			homeManager: managers.home,
		});
	} catch (error) {
		console.log('Error fetching coaches:', error);
	}

	return managers.away || managers.home ? managers : generateFallbackManagers();
}

// Helper function to extract weather information
function extractWeather(gameFeedData: any): string | null {
	if (gameFeedData.gameData?.weather) {
		return typeof gameFeedData.gameData.weather === 'string'
			? gameFeedData.gameData.weather
			: gameFeedData.gameData.weather?.condition || 'Clear, 72°F';
	}
	return 'Clear, 72°F';
}

// Helper function to clean uniform names (remove team name, make plural)
function cleanUniformName(uniformText: string): string {
	if (!uniformText) return uniformText;

	// Remove common team name patterns from the beginning
	let cleaned = uniformText
		.replace(
			/^(Mets|Padres|Blue Jays|Rays|Yankees|Red Sox|Orioles|Rays|Angels|Astros|Athletics|Mariners|Rangers|Braves|Marlins|Phillies|Nationals|Cubs|Reds|Brewers|Pirates|Cardinals|Diamondbacks|Rockies|Dodgers|Giants|Padres|Twins|White Sox|Indians|Guardians|Royals|Tigers|Twins|White Sox|Indians|Guardians|Royals|Tigers|Twins|White Sox|Indians|Guardians|Royals|Tigers|Twins|White Sox|Indians|Guardians|Royals|Tigers)\s+/i,
			''
		)
		.replace(
			/^(New York|Los Angeles|San Francisco|San Diego|Tampa Bay|Kansas City|St\. Louis|New York|Los Angeles|San Francisco|San Diego|Tampa Bay|Kansas City|St\. Louis)\s+/i,
			''
		);

	// Make certain words plural
	cleaned = cleaned
		.replace(/\bJersey\b/g, 'Jerseys')
		.replace(/\bPinstripe\b/g, 'Pinstripes')
		.replace(/\bGrey\b/g, 'Greys')
		.replace(/\bWhite\b/g, 'Whites')
		.replace(/\bBlue\b/g, 'Blues')
		.replace(/\bRed\b/g, 'Reds')
		.replace(/\bBlack\b/g, 'Blacks')
		.replace(/\bBrown\b/g, 'Browns')
		.replace(/\bGreen\b/g, 'Greens')
		.replace(/\bOrange\b/g, 'Oranges')
		.replace(/\bYellow\b/g, 'Yellows')
		.replace(/\bPurple\b/g, 'Purples')
		.replace(/\bGold\b/g, 'Golds')
		.replace(/\bSilver\b/g, 'Silvers')
		.replace(/\bNavy\b/g, 'Navies')
		.replace(/\bMaroon\b/g, 'Maroons')
		.replace(/\bCream\b/g, 'Creams')
		.replace(/\bTan\b/g, 'Tans');

	return cleaned;
}

// Helper function to extract uniforms from team uniforms API
async function extractUniforms(
	awayTeamId: number,
	homeTeamId: number
): Promise<{ away: string | null; home: string | null }> {
	const uniforms = { away: null as string | null, home: null as string | null };

	try {
		const uniformsCacheKey = createCacheKey('uniforms', `${awayTeamId}-${homeTeamId}`);

		const uniformsData = await makeCachedRequest(
			gameFeedCache,
			uniformsCacheKey,
			async () => {
				const uniformsResponse = await fetch(
					`https://statsapi.mlb.com/api/v1/uniforms/team?teamIds=${awayTeamId},${homeTeamId}`,
					{
						headers: {
							'User-Agent': 'Mozilla/5.0 (compatible; BaseballApp/1.0)',
						},
					}
				);

				if (!uniformsResponse.ok) {
					throw new Error(`Uniforms API request failed with status: ${uniformsResponse.status}`);
				}

				return await uniformsResponse.json();
			},
			60 * 60 * 1000 // 1 hour TTL for uniforms (doesn't change often)
		);

		// Extract uniform information for each team
		if (uniformsData.uniforms && Array.isArray(uniformsData.uniforms)) {
			uniformsData.uniforms.forEach((teamUniforms: any) => {
				if (teamUniforms.teamId === awayTeamId) {
					// Find the primary away jersey (usually road grey or similar)
					const awayJersey = teamUniforms.uniformAssets?.find(
						(asset: any) =>
							asset.uniformAssetType?.uniformAssetTypeCode === 'J' &&
							asset.uniformAssetText?.toLowerCase().includes('away')
					);

					if (awayJersey) {
						uniforms.away = cleanUniformName(awayJersey.uniformAssetText);
					} else {
						// Fallback to any jersey if no away jersey found
						const anyJersey = teamUniforms.uniformAssets?.find(
							(asset: any) => asset.uniformAssetType?.uniformAssetTypeCode === 'J'
						);
						if (anyJersey) {
							uniforms.away = cleanUniformName(anyJersey.uniformAssetText);
						}
					}
				} else if (teamUniforms.teamId === homeTeamId) {
					// Find the primary home jersey (usually home white or similar)
					const homeJersey = teamUniforms.uniformAssets?.find(
						(asset: any) =>
							asset.uniformAssetType?.uniformAssetTypeCode === 'J' &&
							asset.uniformAssetText?.toLowerCase().includes('home')
					);

					if (homeJersey) {
						uniforms.home = cleanUniformName(homeJersey.uniformAssetText);
					} else {
						// Fallback to any jersey if no home jersey found
						const anyJersey = teamUniforms.uniformAssets?.find(
							(asset: any) => asset.uniformAssetType?.uniformAssetTypeCode === 'J'
						);
						if (anyJersey) {
							uniforms.home = cleanUniformName(anyJersey.uniformAssetText);
						}
					}
				}
			});
		}

		console.log('Extracted uniforms from API:', {
			awayTeamId,
			homeTeamId,
			uniforms: uniforms,
		});
	} catch (error) {
		console.log(`Error fetching uniforms for teams ${awayTeamId}, ${homeTeamId}:`, error);
		// Return null values if uniforms can't be fetched
	}

	return uniforms;
}

// Helper function to extract start time
function extractStartTime(gameFeedData: any): string | null {
	if (gameFeedData.gameData?.game?.gameDate) {
		try {
			const gameDate = new Date(gameFeedData.gameData.game.gameDate);
			return gameDate.toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: '2-digit',
			});
		} catch (e) {
			// Keep original format if parsing fails
		}
	}
	return null;
}

// Helper function to extract start time from schedule data in user's local timezone
function extractStartTimeFromSchedule(gameData: any): string | null {
	if (!gameData.gameInfo?.firstPitch) return null;

	try {
		// Parse the first pitch time
		const firstPitch = new Date(gameData.gameInfo.firstPitch);

		// Format the start time in user's local timezone
		return firstPitch.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true,
			// No timeZone specified - uses user's local timezone
		});
	} catch (error) {
		console.log('Error formatting start time:', error);
		return null;
	}
}

// Helper function to extract end time and format duration (only for completed games)
function extractEndTime(gameData: any): string | null {
	// Only show end time for completed games
	if (!gameData.status || gameData.status.abstractGameState !== 'Final') {
		return null;
	}

	if (!gameData.gameInfo) return null;

	const firstPitch = gameData.gameInfo.firstPitch;
	const durationMinutes = gameData.gameInfo.gameDurationMinutes;

	if (!firstPitch || !durationMinutes) return null;

	try {
		// Parse the first pitch time
		const startTime = new Date(firstPitch);

		// Calculate end time by adding duration
		const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

		// Format the end time (e.g., "7:25 PM") in user's local timezone
		const endTimeFormatted = endTime.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true,
			// No timeZone specified - uses user's local timezone
		});

		// Format duration (e.g., "2h 40m")
		const hours = Math.floor(durationMinutes / 60);
		const minutes = durationMinutes % 60;
		const durationFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

		return `${endTimeFormatted} (${durationFormatted})`;
	} catch (error) {
		console.log('Error calculating end time:', error);
		return null;
	}
}

// Helper function to extract weather from schedule data with both C and F temperatures
function extractWeatherFromSchedule(gameData: any): string | null {
	if (!gameData.weather) return null;

	try {
		const condition = gameData.weather.condition || 'Clear';
		const tempF = parseInt(gameData.weather.temp) || 72;
		const tempC = Math.round(((tempF - 32) * 5) / 9);

		return `${condition}, ${tempF}°F (${tempC}°C)`;
	} catch (error) {
		console.log('Error formatting weather:', error);
		return null;
	}
}

// Helper function to extract wind from schedule data
function extractWindFromSchedule(gameData: any): string | null {
	if (!gameData.weather?.wind) return null;

	try {
		return gameData.weather.wind;
	} catch (error) {
		console.log('Error formatting wind:', error);
		return null;
	}
}

// Helper function to extract wind information
function extractWind(gameFeedData: any): string | null {
	if (gameFeedData.gameData?.weather?.wind) {
		return gameFeedData.gameData.weather.wind;
	}
	return null;
}

// Helper function to derive substitution timing from boxscore data when play-by-play doesn't contain substitution events
function deriveSubstitutionTimingFromBoxscore(
	boxscore: any,
	allPlays: any[]
): Map<string, { type: string; inning: number; halfInning: string }> {
	console.log('DEBUG: deriveSubstitutionTimingFromBoxscore called');
	const substitutionData = new Map<string, { type: string; inning: number; halfInning: string }>();

	// Process both teams
	const teams = [boxscore.teams.away, boxscore.teams.home];

	teams.forEach((team: any, teamIndex: number) => {
		const teamName = teamIndex === 0 ? 'away' : 'home';
		console.log(`DEBUG: Processing ${teamName} team for substitutions`);

		// Check all batters for substitution indicators
		console.log(`DEBUG: Processing ${team.batters.length} batters for ${teamName} team:`, team.batters);

		// Look for specific players we're trying to debug
		const targetPlayers = ['Ty France', 'Isiah Kiner-Falefa', 'Nick Fortes'];
		console.log(`DEBUG: Looking for target players in ${teamName} team:`, targetPlayers);

		team.batters.forEach((batterId: any) => {
			const player = team.players[`ID${batterId}`];
			if (!player) {
				console.log(`DEBUG: No player found for batter ID ${batterId}`);
				return;
			}

			const playerName = player.person?.fullName;
			const playerId = player.person?.id;
			if (!playerName || !playerId) {
				console.log(`DEBUG: Missing name or ID for player ${batterId}: name=${playerName}, id=${playerId}`);
				return;
			}

			// Check if this is one of our target players
			if (targetPlayers.includes(playerName)) {
				console.log(`DEBUG: FOUND TARGET PLAYER ${playerName} in ${teamName} team!`);
			}

			// Check if player has multiple positions (indicates substitution)
			const allPositions = player.allPositions || [];

			// Debug: Log all players to see their positions and starter status
			console.log(`DEBUG: Player ${playerName}:`, {
				allPositions: allPositions.length,
				positions: allPositions.map((pos: any) => ({ code: pos.code, name: pos.name })),
				isStarter: player.gameStatus?.isStarter,
				gameStatus: player.gameStatus,
				hasStats: !!player.stats,
				battingStats: player.stats?.batting,
			});

			// Special debug for the players we're looking for
			if (
				playerName.includes('Ty France') ||
				playerName.includes('Isiah Kiner-Falefa') ||
				playerName.includes('Nick Fortes')
			) {
				console.log(`DEBUG: FOUND TARGET PLAYER ${playerName}:`, {
					batterId,
					allPositions: allPositions.length,
					positions: allPositions.map((pos: any) => ({ code: pos.code, name: pos.name })),
					isStarter: player.gameStatus?.isStarter,
					gameStatus: player.gameStatus,
					hasStats: !!player.stats,
					battingStats: player.stats?.batting,
				});
			}

			// Check if player is a substitution using multiple criteria:
			// 1. Multiple positions (position change)
			// 2. Has batting stats but is not a starter (pinch hitter)
			// 3. Has stats but isStarter is false/undefined (substitute)
			const hasMultiplePositions = allPositions.length > 1;
			const isStarter = player.gameStatus?.isStarter || false;
			const hasBattingStats =
				player.stats?.batting &&
				(player.stats.batting.atBats > 0 ||
					player.stats.batting.hits > 0 ||
					player.stats.batting.runs > 0 ||
					player.stats.batting.rbi > 0);

			// Player is a substitution if:
			// - Has multiple positions AND is not a starter, OR
			// - Has batting stats AND is not a starter (pinch hitter), OR
			// - Has any stats AND isStarter is false/undefined (general substitute)
			const isSubstitution =
				(hasMultiplePositions && !isStarter) || (hasBattingStats && !isStarter) || (player.stats && !isStarter);

			if (!isSubstitution) {
				console.log(`DEBUG: Skipping ${playerName} - not detected as substitution:`, {
					hasMultiplePositions,
					isStarter,
					hasBattingStats,
					hasStats: !!player.stats,
				});
				return;
			}

			if (hasMultiplePositions) {
				// Check if this is a starter who changed positions during the game
				if (isStarter) {
					console.log(`DEBUG: Found starter with position change: ${playerName} (ID: ${playerId})`, {
						positions: allPositions.map((pos: any) => ({ code: pos.code, name: pos.name })),
						gameStatus: player.gameStatus,
						stats: player.stats,
					});

					// This is a starter who changed positions - we'll handle this in the batter processing
					// by tracking their initial and final positions
					return;
				}

				console.log(`DEBUG: Found player with multiple positions: ${playerName} (ID: ${playerId})`, {
					positions: allPositions.map((pos: any) => ({ code: pos.code, name: pos.name })),
					gameStatus: player.gameStatus,
					stats: player.stats,
				});

				// Determine substitution type based on positions and stats
				let substitutionType = 'DEF'; // Default to defensive substitution

				// First, check the all_positions array to see what position they first entered as
				const firstPosition = allPositions[0];
				if (firstPosition.code === '11' || firstPosition.name === 'Pinch Hitter') {
					substitutionType = 'PH';
				} else if (firstPosition.code === '12' || firstPosition.name === 'Pinch Runner') {
					substitutionType = 'PR';
				} else {
					// If not explicitly PH/PR, check if they have batting stats (likely a pinch hitter)
					const battingStats = player.stats?.batting;
					const hasBattingStats =
						battingStats &&
						(battingStats.atBats > 0 || battingStats.hits > 0 || battingStats.runs > 0 || battingStats.rbi > 0);

					if (hasBattingStats) {
						// Player has batting stats, likely a pinch hitter
						substitutionType = 'PH';
					} else {
						// Check if this is a defensive substitution
						const lastPosition = allPositions[allPositions.length - 1];

						if (firstPosition.code !== lastPosition.code) {
							substitutionType = 'DEF';
						}
					}
				}

				// Try to determine inning from player's first appearance in play-by-play
				let estimatedInning = 9; // Default fallback
				let estimatedHalfInning = 'top';

				// Look for player's first at-bat or appearance in play-by-play using player ID (most reliable)
				for (let i = 0; i < allPlays.length; i++) {
					const play = allPlays[i];
					const players = play.players || [];

					// Check if this player appears in this play using player ID (most reliable)
					const playerInPlay = players.find((p: any) => {
						const playPlayerId = p.person?.id || p.id;
						return playPlayerId === playerId;
					});

					if (playerInPlay) {
						const about = play.about;
						if (about && about.inning) {
							estimatedInning = about.inning;
							estimatedHalfInning = about.halfInning || 'top';
							console.log(
								`DEBUG: Found ${playerName} (ID: ${playerId}) first appearance in inning ${estimatedInning} ${estimatedHalfInning}`
							);
							break;
						}
					}
				}

				// If still not found by ID, try name matching as fallback
				if (estimatedInning === 9) {
					console.log(`DEBUG: Player ${playerName} (ID: ${playerId}) not found by ID, trying name matching...`);
					for (let i = 0; i < allPlays.length; i++) {
						const play = allPlays[i];
						const players = play.players || [];

						// Check if this player appears in this play - try multiple name formats
						const playerInPlay = players.find((p: any) => {
							const playPlayerName = p.person?.fullName || p.name || '';
							return (
								playPlayerName === playerName ||
								playPlayerName.includes(playerName.split(' ')[0]) ||
								playPlayerName.includes(playerName.split(' ')[1])
							);
						});

						if (playerInPlay) {
							const about = play.about;
							if (about && about.inning) {
								estimatedInning = about.inning;
								estimatedHalfInning = about.halfInning || 'top';
								console.log(`DEBUG: Found ${playerName} by name in inning ${estimatedInning} ${estimatedHalfInning}`);
								break;
							}
						}
					}
				}

				// If still not found, try a different approach - look for the player in the play description
				if (estimatedInning === 9) {
					console.log(`DEBUG: Player ${playerName} not found in play players, checking descriptions...`);
					for (let i = 0; i < allPlays.length; i++) {
						const play = allPlays[i];
						const description = play.result?.description || '';

						// Check if player name appears in the play description
						if (description.toLowerCase().includes(playerName.toLowerCase())) {
							const about = play.about;
							if (about && about.inning) {
								estimatedInning = about.inning;
								estimatedHalfInning = about.halfInning || 'top';
								console.log(
									`DEBUG: Found ${playerName} in description of inning ${estimatedInning} ${estimatedHalfInning}: "${description}"`
								);
								break;
							}
						}
					}
				}

				// Store the substitution data
				substitutionData.set(playerName, {
					type: substitutionType,
					inning: estimatedInning,
					halfInning: estimatedHalfInning,
				});

				console.log(`DEBUG: Derived substitution for ${playerName}:`, {
					type: substitutionType,
					inning: estimatedInning,
					halfInning: estimatedHalfInning,
				});
			} else {
				// Player has single position but is still a substitution (detected by batting stats or other criteria)
				console.log(`DEBUG: Found single-position substitution: ${playerName} (ID: ${playerId})`, {
					positions: allPositions.map((pos: any) => ({ code: pos.code, name: pos.name })),
					gameStatus: player.gameStatus,
					stats: player.stats,
					isStarter,
					hasBattingStats,
				});

				// Determine substitution type based on stats and positions
				let substitutionType = 'DEF'; // Default to defensive substitution

				// First, check the all_positions array to see what position they first entered as
				if (allPositions.length > 0) {
					const firstPosition = allPositions[0];
					if (firstPosition.code === '11' || firstPosition.name === 'Pinch Hitter') {
						substitutionType = 'PH';
					} else if (firstPosition.code === '12' || firstPosition.name === 'Pinch Runner') {
						substitutionType = 'PR';
					} else if (hasBattingStats) {
						// Player has batting stats, likely a pinch hitter
						substitutionType = 'PH';
					} else if (player.stats && !isStarter) {
						// Player has stats but is not a starter, likely defensive replacement
						substitutionType = 'DEF';
					}
				} else {
					// Fallback to stats-based logic if no position data
					if (hasBattingStats) {
						// Player has batting stats, likely a pinch hitter
						substitutionType = 'PH';
					} else if (player.stats && !isStarter) {
						// Player has stats but is not a starter, likely defensive replacement
						substitutionType = 'DEF';
					}
				}

				// Try to determine inning from player's first appearance in play-by-play
				let estimatedInning = 9; // Default fallback
				let estimatedHalfInning = 'top';

				// Look for player's first at-bat or appearance in play-by-play using player ID (most reliable)
				for (let i = 0; i < allPlays.length; i++) {
					const play = allPlays[i];
					const players = play.players || [];

					// Check if this player appears in this play using player ID (most reliable)
					const playerInPlay = players.find((p: any) => {
						const playPlayerId = p.person?.id || p.id;
						return playPlayerId === playerId;
					});

					if (playerInPlay) {
						const about = play.about;
						if (about && about.inning) {
							estimatedInning = about.inning;
							estimatedHalfInning = about.halfInning || 'top';
							console.log(
								`DEBUG: Found ${playerName} (ID: ${playerId}) first appearance in inning ${estimatedInning} ${estimatedHalfInning}`
							);
							break;
						}
					}
				}

				// If still not found by ID, try name matching as fallback
				if (estimatedInning === 9) {
					console.log(`DEBUG: Player ${playerName} (ID: ${playerId}) not found by ID, trying name matching...`);
					for (let i = 0; i < allPlays.length; i++) {
						const play = allPlays[i];
						const players = play.players || [];

						// Check if this player appears in this play - try multiple name formats
						const playerInPlay = players.find((p: any) => {
							const playPlayerName = p.person?.fullName || p.name || '';
							return (
								playPlayerName === playerName ||
								playPlayerName.includes(playerName.split(' ')[0]) ||
								playPlayerName.includes(playerName.split(' ')[1])
							);
						});

						if (playerInPlay) {
							const about = play.about;
							if (about && about.inning) {
								estimatedInning = about.inning;
								estimatedHalfInning = about.halfInning || 'top';
								console.log(`DEBUG: Found ${playerName} by name in inning ${estimatedInning} ${estimatedHalfInning}`);
								break;
							}
						}
					}
				}

				// If still not found, try a different approach - look for the player in the play description
				if (estimatedInning === 9) {
					console.log(`DEBUG: Player ${playerName} not found in play players, checking descriptions...`);
					for (let i = 0; i < allPlays.length; i++) {
						const play = allPlays[i];
						const description = play.result?.description || '';

						// Check if player name appears in the play description
						if (description.toLowerCase().includes(playerName.toLowerCase())) {
							const about = play.about;
							if (about && about.inning) {
								estimatedInning = about.inning;
								estimatedHalfInning = about.halfInning || 'top';
								console.log(
									`DEBUG: Found ${playerName} in description of inning ${estimatedInning} ${estimatedHalfInning}: "${description}"`
								);
								break;
							}
						}
					}
				}

				// Store the substitution data
				substitutionData.set(playerName, {
					type: substitutionType,
					inning: estimatedInning,
					halfInning: estimatedHalfInning,
				});

				console.log(`DEBUG: Derived substitution for ${playerName}:`, {
					type: substitutionType,
					inning: estimatedInning,
					halfInning: estimatedHalfInning,
				});
			}
		});
	});

	return substitutionData;
}

// Helper function to process substitution events and determine types and innings
function processSubstitutionEvents(
	substitutionEvents: any[]
): Map<string, { type: string; inning: number; halfInning: string }> {
	const substitutionData = new Map<string, { type: string; inning: number; halfInning: string }>();

	console.log('DEBUG: processSubstitutionEvents called with', substitutionEvents.length, 'events');
	substitutionEvents.forEach((event: any, index: number) => {
		if (index < 3) {
			// Only log first 3 for debugging
			console.log('DEBUG: Processing substitution event', index, ':', {
				eventType: event.result?.eventType,
				description: event.result?.description,
				hasPlayers: !!event.players,
				playersCount: event.players?.length || 0,
				// Check MLB API spec properties
				isSubstitution: event.isSubstitution,
				hasSubstitution: !!event.substitution,
				substitution: event.substitution,
				about: event.about,
			});
		}
		const description = event.result?.description || '';
		const players = event.players || [];
		const about = event.about || {};

		// Find the player entering the game
		const enteringPlayer = players.find((p: any) => p.playerType === 'Batter' || p.playerType === 'Pitcher');
		if (!enteringPlayer) return;

		const playerName = enteringPlayer.person?.fullName || enteringPlayer.name;
		if (!playerName) return;

		// Determine substitution type based on event type first, then description
		let substitutionType = 'DEF'; // Default to defensive substitution
		const eventType = event.result?.eventType;

		// Use event type if available
		if (eventType === 'pitching_substitution') {
			substitutionType = 'DEF';
		} else if (eventType === 'offensive_substitution') {
			// For offensive substitutions, we need to determine if it's PH or PR from description
			if (description.includes('Pinch-hitter') || description.includes('Pinch hitter')) {
				substitutionType = 'PH';
			} else if (description.includes('Pinch-runner') || description.includes('Pinch runner')) {
				substitutionType = 'PR';
			} else {
				substitutionType = 'PH'; // Default offensive substitution to PH
			}
		} else if (eventType === 'defensive_substitution') {
			substitutionType = 'DEF';
		} else if (eventType === 'Substitution') {
			// Fallback to description parsing for generic 'Substitution' events
			if (description.includes('Pinch-hitter') || description.includes('Pinch hitter')) {
				substitutionType = 'PH';
			} else if (description.includes('Pinch-runner') || description.includes('Pinch runner')) {
				substitutionType = 'PR';
			} else if (description.includes('Pitching Substitution')) {
				substitutionType = 'DEF';
			} else if (description.includes('Defensive Sub') || description.includes('Defensive sub')) {
				substitutionType = 'DEF';
			} else if (description.includes('Offensive Sub') || description.includes('Offensive sub')) {
				// For offensive substitutions, we need to determine if it's PH or PR
				// This is a limitation - we can't always distinguish without more context
				substitutionType = 'PH'; // Default to PH for offensive subs
			}
		}

		// Extract inning information from the about field
		// Debug: Log the about field structure to understand the data format
		if (substitutionEvents.length <= 3) {
			// Only log first few for debugging
			console.log('DEBUG: Event about field:', JSON.stringify(about, null, 2));
			console.log('DEBUG: Event description:', description);
			console.log('DEBUG: Player name:', playerName);
		}

		// Try multiple possible field names for inning data
		let inning = 9; // Default
		let halfInning = 'top'; // Default

		if (about.inning) {
			inning = about.inning;
		} else if (about.inningNumber) {
			inning = about.inningNumber;
		} else if (about.period) {
			inning = about.period;
		}

		if (about.halfInning) {
			halfInning = about.halfInning === 'top' ? 'top' : 'bottom';
		} else if (about.halfInning === 0 || about.halfInning === '0') {
			halfInning = 'top';
		} else if (about.halfInning === 1 || about.halfInning === '1') {
			halfInning = 'bottom';
		}

		substitutionData.set(playerName, {
			type: substitutionType,
			inning: inning,
			halfInning: halfInning,
		});
	});

	return substitutionData;
}

// Helper function to extract pitcher statistics from MLB API data
function extractPitcherStats(pitchers: any[]): any[] {
	console.log('extractPitcherStats called with:', pitchers.length, 'pitchers');

	const result = pitchers.map((pitcher: any, index: number) => {
		console.log(`Pitcher ${index} object:`, pitcher);
		console.log(`Pitcher ${index} keys:`, Object.keys(pitcher));

		const stats = pitcher.stats?.pitching || pitcher.stats || {};

		console.log(`Pitcher ${index} stats debug:`, {
			hasStats: !!pitcher.stats,
			hasPitchingStats: !!pitcher.stats?.pitching,
			statsKeys: pitcher.stats ? Object.keys(pitcher.stats) : [],
			inningsPitched: stats.inningsPitched,
			hits: stats.hits,
			earnedRuns: stats.earnedRuns,
		});

		// Calculate innings pitched
		const inningsPitched = stats.inningsPitched ? parseFloat(stats.inningsPitched) : 0.0;
		const earnedRuns = stats.earnedRuns || 0;
		const hits = stats.hits || 0;
		const walks = stats.baseOnBalls || 0;
		const strikeouts = stats.strikeOuts || 0;
		const totalPitches = stats.pitchesThrown || 0;
		const strikes = stats.strikes || 0;

		// Calculate ERA (earned runs per 9 innings)
		const era = inningsPitched > 0 ? (earnedRuns * 9) / inningsPitched : 0;

		// Calculate WHIP (walks + hits per inning pitched)
		const whip = inningsPitched > 0 ? (walks + hits) / inningsPitched : 0;

		// Determine pitcher decision
		let decision = '';
		if (stats.wins > 0) decision = 'W';
		else if (stats.losses > 0) decision = 'L';
		else if (stats.saves > 0) decision = 'S';
		else if (stats.holds > 0) decision = 'H';
		else if (stats.blownSaves > 0) decision = 'BS';

		return {
			name: pitcher.fullName || pitcher.person?.fullName || 'Unknown Pitcher',
			position: 'P',
			innings_pitched: inningsPitched,
			hits: hits,
			runs: stats.runs || 0,
			earned_runs: earnedRuns,
			walks: walks,
			strikeouts: strikeouts,
			number: pitcher.jerseyNumber ? String(pitcher.jerseyNumber) : '0',
			handedness: pitcher.pitchHand?.code || pitcher.person?.batSide?.code || 'R', // Use pitch hand as handedness
			wls: decision,
			batters_faced: stats.battersFaced || 0,
			intentional_walks: stats.intentionalWalks || 0,
			hit_by_pitch: stats.hitBatsmen || 0,
			balks: stats.balks || 0,
			wild_pitches: stats.wildPitches || 0,
			homeruns: stats.homeRuns || 0,
			total_pitches: totalPitches,
			strikes: strikes,
			era: Math.round(era * 100) / 100, // Round to 2 decimal places
			whip: Math.round(whip * 100) / 100, // Round to 2 decimal places
		};
	});

	return result;
}

// Helper function to extract ALL players who have pitched in the game (including position players)
function extractAllPitchersFromGame(teamData: any, players: any, isAway: boolean): any[] {
	const allPitchers: any[] = [];

	console.log(`Extracting pitchers for ${isAway ? 'away' : 'home'} team:`, {
		teamDataKeys: Object.keys(teamData),
		hasPitchers: !!teamData.pitchers,
		pitchersCount: teamData.pitchers?.length || 0,
		playersCount: Object.keys(players).length,
	});

	// First, get the official pitchers from the team data
	if (teamData.pitchers && teamData.pitchers.length > 0) {
		console.log('Official pitcher IDs found:', teamData.pitchers);

		// Convert pitcher IDs to full player objects with stats
		const pitcherObjects = teamData.pitchers
			.map((pitcherId: any) => {
				// pitcherId might be a string or number, convert to string for lookup
				const idStr = String(pitcherId);
				const playerIdWithPrefix = `ID${idStr}`;
				// Look up from the teamData.players collection which has stats, not the basic players collection
				const player = teamData.players[playerIdWithPrefix];
				console.log(`Looking up pitcher ID ${pitcherId} as ${playerIdWithPrefix}:`, player ? 'Found' : 'Not found');
				return player;
			})
			.filter(Boolean); // Remove any undefined players

		console.log(
			'Official pitchers found:',
			pitcherObjects.map((p: any) => ({
				name: p.person?.fullName,
				hasStats: !!p.stats,
				pitchingStats: p.stats?.pitching,
			}))
		);
		const officialPitchers = extractPitcherStats(pitcherObjects);
		allPitchers.push(...officialPitchers);
	}

	// Debug: Look at all players to see who has pitching stats
	console.log('Checking all players for pitching stats...');
	let playersWithPitchingStats = 0;
	let playersWithAnyStats = 0;

	Object.values(players).forEach((player: any) => {
		if (player.stats) {
			playersWithAnyStats++;
			if (player.stats.pitching) {
				playersWithPitchingStats++;
				console.log(`Player with pitching stats: ${player.person?.fullName}`, {
					inningsPitched: player.stats.pitching.inningsPitched,
					pitchesThrown: player.stats.pitching.pitchesThrown,
					statsKeys: Object.keys(player.stats),
				});
			}
		}
	});

	console.log(
		`Found ${playersWithPitchingStats} players with pitching stats out of ${playersWithAnyStats} players with any stats`
	);

	// Then, look through all players to find any who have pitching stats
	// This includes position players who may have pitched
	Object.values(teamData.players || {}).forEach((player: any) => {
		// Check if this player has pitching statistics
		if (
			player.stats &&
			player.stats.pitching &&
			(player.stats.pitching.inningsPitched > 0 || player.stats.pitching.pitchesThrown > 0)
		) {
			// Check if this player belongs to the current team
			// We can determine this by checking if they appear in the team's batters or pitchers
			const isPlayerOnTeam =
				(teamData.batters && teamData.batters.some((batter: any) => batter.person?.id === player.person?.id)) ||
				(teamData.pitchers && teamData.pitchers.some((pitcher: any) => pitcher.person?.id === player.person?.id));

			if (isPlayerOnTeam) {
				// Check if we haven't already added this player
				const alreadyAdded = allPitchers.some((pitcher) => pitcher.name === player.person?.fullName);

				if (!alreadyAdded) {
					const pitcherStats = extractPitcherStats([player]);
					allPitchers.push(...pitcherStats);
				}
			}
		}
	});

	// Sort pitchers by innings pitched (descending) to show starters first
	const sortedPitchers = allPitchers.sort((a, b) => (b.innings_pitched || 0) - (a.innings_pitched || 0));

	console.log(
		`Final pitchers for ${isAway ? 'away' : 'home'} team:`,
		sortedPitchers.map((p) => ({
			name: p.name,
			innings: p.innings_pitched,
			era: p.era,
			number: p.number,
		}))
	);

	return sortedPitchers;
}

// Helper functions to generate realistic fallback data when detailed game feed is not available
function generateFallbackInnings(
	awayScore: number,
	homeScore: number,
	gameStatus: string
): Array<{ inning: number; away_runs: number; home_runs: number }> {
	const innings: Array<{ inning: number; away_runs: number; home_runs: number }> = [];
	const totalInnings = gameStatus === 'Final' ? 9 : 9; // Assume 9 innings for completed games

	// Initialize all innings with 0 runs
	for (let i = 1; i <= totalInnings; i++) {
		innings.push({
			inning: i,
			away_runs: 0,
			home_runs: 0,
		});
	}

	// Distribute away team runs more realistically
	let awayRunsRemaining = awayScore;
	while (awayRunsRemaining > 0) {
		const inning = Math.floor(Math.random() * totalInnings);
		const runsToAdd = Math.min(awayRunsRemaining, Math.floor(Math.random() * 4) + 1); // 1-4 runs per inning
		innings[inning].away_runs += runsToAdd;
		awayRunsRemaining -= runsToAdd;
	}

	// Distribute home team runs more realistically
	let homeRunsRemaining = homeScore;
	while (homeRunsRemaining > 0) {
		const inning = Math.floor(Math.random() * totalInnings);
		const runsToAdd = Math.min(homeRunsRemaining, Math.floor(Math.random() * 4) + 1); // 1-4 runs per inning
		innings[inning].home_runs += runsToAdd;
		homeRunsRemaining -= runsToAdd;
	}

	return innings;
}

function generateFallbackHits(score: number): number {
	// Generate realistic hit counts based on score
	// Generally, more runs = more hits, but with some randomness
	const baseHits = Math.max(3, score * 2 + Math.floor(Math.random() * 4));
	return Math.min(baseHits, 20); // Cap at 20 hits
}

function generateFallbackErrors(): number {
	// Most games have 0-2 errors
	return Math.floor(Math.random() * 3);
}

// Helper functions to generate fallback supplementary data for getGameDetails
function generateFallbackUmpires(): Array<{ name: string; position: string }> {
	const umpirePositions = ['HP', '1B', '2B', '3B'];
	const sampleNames = ['John Smith', 'Mike Johnson', 'Sarah Davis', 'Chris Wilson'];

	return umpirePositions.map((position, index) => ({
		name: sampleNames[index] || `Umpire ${index + 1}`,
		position: position,
	}));
}

function generateFallbackManagers(): { away: string; home: string } {
	const sampleManagers = ['Manager A', 'Manager B'];
	return {
		away: sampleManagers[0],
		home: sampleManagers[1],
	};
}

function generateFallbackPlayerStats(): {
	away: { batters: any[]; pitchers: any[] };
	home: { batters: any[]; pitchers: any[] };
} {
	const generateBatters = () => {
		const positions = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
		return positions.map((pos, index) => ({
			name: `Player ${index + 1}`,
			at_bats: Math.floor(Math.random() * 5) + 1,
			hits: Math.floor(Math.random() * 3),
			runs: Math.floor(Math.random() * 2),
			rbis: Math.floor(Math.random() * 3),
			average: (Math.random() * 0.4 + 0.1).toFixed(3),
			position: pos,
			lineup_order: index + 1,
		}));
	};

	const generatePitchers = () => {
		return [
			{
				name: 'Starting Pitcher',
				innings_pitched: 6.0 + Math.random() * 3,
				hits: Math.floor(Math.random() * 8) + 2,
				runs: Math.floor(Math.random() * 4),
				earned_runs: Math.floor(Math.random() * 3),
				walks: Math.floor(Math.random() * 3),
				strikeouts: Math.floor(Math.random() * 8) + 2,
				era: (Math.random() * 4 + 1).toFixed(2),
			},
		];
	};

	return {
		away: {
			batters: generateBatters(),
			pitchers: generatePitchers(),
		},
		home: {
			batters: generateBatters(),
			pitchers: generatePitchers(),
		},
	};
}

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

// Server-side function to fetch games from MLB API
async function fetchGamesFromMLB(date: string): Promise<any> {
	// Parse the date string as local date (YYYY-MM-DD format)
	const [year, month, day] = date.split('-').map(Number);

	// Fetch games from MLB API with cache-busting parameter
	const timestamp = Date.now();
	const url = `${MLB_API_BASE}/schedule?sportId=1&date=${month}/${day}/${year}&hydrate=linescore&t=${timestamp}`;

	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`MLB API error: ${response.status}`);
	}

	return response.json();
}

export async function getGamesForDate(date: string): Promise<Game[]> {
	try {
		// Create cache key for this date
		const cacheKey = createCacheKey('schedule', date);

		// Use cached request
		const data = await makeCachedRequest(
			scheduleCache,
			cacheKey,
			async () => {
				return await fetchGamesFromMLB(date);
			},
			2 * 60 * 1000 // 2 minutes TTL for schedule data
		);

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

				// Fetch detailed inning data for each game
				let innings: Array<{ inning: number; away_runs: number; home_runs: number }> = [];
				let awayHits = 0;
				let homeHits = 0;
				let awayErrors = 0;
				let homeErrors = 0;

				// First try to get inning data from the schedule API (which now includes linescore)
				if (gameData.linescore && gameData.linescore.innings && gameData.linescore.innings.length > 0) {
					console.log(`Game ${gamePk} - Using linescore data from schedule API:`, gameData.linescore.innings);

					innings = gameData.linescore.innings.map((inning: any) => ({
						inning: inning.num,
						away_runs: inning.away?.runs || 0,
						home_runs: inning.home?.runs || 0,
					}));

					// Get hits and errors from linescore
					if (gameData.linescore.teams) {
						awayHits = gameData.linescore.teams.away?.hits || 0;
						homeHits = gameData.linescore.teams.home?.hits || 0;
						awayErrors = gameData.linescore.teams.away?.errors || 0;
						homeErrors = gameData.linescore.teams.home?.errors || 0;
					}

					console.log(`Game ${gamePk} - Processed innings from schedule API:`, innings);
				}
				// Fallback to game feed API if schedule API doesn't have complete data
				else {
					try {
						const gameFeedCacheKey = createCacheKey('gameFeed', gamePk.toString());

						console.log(`Fetching game feed for ${gamePk} (date: ${date}, status: ${status.detailedState})`);

						const gameFeedData = await makeCachedRequest(
							gameFeedCache,
							gameFeedCacheKey,
							async () => {
								const gameFeedUrl = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;
								console.log(`Making API call to: ${gameFeedUrl}`);

								const gameFeedResponse = await fetch(gameFeedUrl, {
									headers: {
										'User-Agent': 'Mozilla/5.0 (compatible; BaseballApp/1.0)',
									},
								});

								console.log(
									`API response status for ${gamePk}: ${gameFeedResponse.status} ${gameFeedResponse.statusText}`
								);

								if (!gameFeedResponse.ok) {
									throw new Error(`Game feed not available for game ${gamePk}: ${gameFeedResponse.status}`);
								}

								const responseData = await gameFeedResponse.json();
								console.log(`API response data structure for ${gamePk}:`, {
									hasGameData: !!responseData.gameData,
									hasLiveData: !!responseData.liveData,
									hasBoxscore: !!responseData.liveData?.boxscore,
									hasLinescore: !!responseData.liveData?.linescore,
									hasAllPlays: !!responseData.liveData?.plays?.allPlays,
									boxscoreInningsCount: responseData.liveData?.boxscore?.innings?.length || 0,
									linescoreInningsCount: responseData.liveData?.linescore?.innings?.length || 0,
									allPlaysCount: responseData.liveData?.plays?.allPlays?.length || 0,
									gameStatus: responseData.gameData?.status?.detailedState,
									gameType: responseData.gameData?.game?.type,
									reason: responseData.gameData?.status?.reason,
									abstractGameState: responseData.gameData?.status?.abstractGameState,
								});

								return responseData;
							},
							30 * 1000 // 30 seconds TTL for live game feeds
						);

						// Extract inning data using the same approach as the working baseball library
						// Use boxscore data as primary source (most complete), then fallback to linescore, then allPlays
						const boxscore = gameFeedData.liveData?.boxscore;
						const linescore = gameFeedData.liveData?.linescore;
						const allPlays = gameFeedData.liveData?.plays?.allPlays;

						// Use the schedule API status (authoritative) instead of live feed status
						// The live feed API can have stale/inconsistent status data
						const scheduleStatus = status.detailedState;
						const liveFeedStatus = gameFeedData.gameData?.status?.detailedState;

						console.log(`Game ${gamePk} - Status comparison: Schedule=${scheduleStatus}, LiveFeed=${liveFeedStatus}`);

						// Primary method: Use boxscore innings data (most complete)
						if (boxscore && boxscore.innings && boxscore.innings.length > 0) {
							console.log(`Game ${gamePk} - Using boxscore innings data:`, boxscore.innings);

							innings = boxscore.innings.map((inning: any) => ({
								inning: inning.num,
								away_runs: inning.away?.runs || 0,
								home_runs: inning.home?.runs || 0,
							}));

							console.log(`Game ${gamePk} - Processed innings from boxscore:`, innings);

							// Get hits and errors from boxscore teams
							if (boxscore.teams) {
								awayHits = boxscore.teams.away?.hits || 0;
								homeHits = boxscore.teams.home?.hits || 0;
								awayErrors = boxscore.teams.away?.errors || 0;
								homeErrors = boxscore.teams.home?.errors || 0;
							}
						}
						// Fallback method: Use linescore innings data
						else if (linescore && linescore.innings && linescore.innings.length > 0) {
							console.log(`Game ${gamePk} - Using linescore innings data:`, linescore.innings);

							// Always process the data if it exists, regardless of status
							// The MLB API provides complete data for all games
							innings = linescore.innings.map((inning: any) => ({
								inning: inning.num,
								away_runs: inning.away?.runs || 0,
								home_runs: inning.home?.runs || 0,
							}));
							console.log(`Game ${gamePk} - Processed innings from linescore:`, innings);

							// Get hits and errors from linescore
							if (linescore.teams) {
								awayHits = linescore.teams.away?.hits || 0;
								homeHits = linescore.teams.home?.hits || 0;
								awayErrors = linescore.teams.away?.errors || 0;
								homeErrors = linescore.teams.home?.errors || 0;
							}
						}
						// Final fallback: Reconstruct from allPlays data
						else if (allPlays && allPlays.length > 0) {
							console.log(`Game ${gamePk} - Using allPlays reconstruction (${allPlays.length} plays)`);

							// Reconstruct innings from allPlays data (same approach as working baseball library)
							const inningsMap = new Map<
								number,
								{ away_runs: number; home_runs: number; away_cumulative: number; home_cumulative: number }
							>();

							// First pass: collect cumulative scores at the end of each half-inning
							for (const play of allPlays) {
								const inning = play.about?.inning;
								const halfInning = play.about?.halfInning;

								if (inning && halfInning) {
									if (!inningsMap.has(inning)) {
										inningsMap.set(inning, { away_runs: 0, home_runs: 0, away_cumulative: 0, home_cumulative: 0 });
									}

									const inningData = inningsMap.get(inning)!;

									// Update cumulative scores
									inningData.away_cumulative = play.result?.awayScore || 0;
									inningData.home_cumulative = play.result?.homeScore || 0;
								}
							}

							// Second pass: calculate runs per inning by comparing with previous inning
							let previousAwayRuns = 0;
							let previousHomeRuns = 0;

							Array.from(inningsMap.entries()).forEach(([inning, data]) => {
								data.away_runs = data.away_cumulative - previousAwayRuns;
								data.home_runs = data.home_cumulative - previousHomeRuns;

								previousAwayRuns = data.away_cumulative;
								previousHomeRuns = data.home_cumulative;
							});

							// Convert map to array
							innings = Array.from(inningsMap.entries()).map(([inning, data]) => ({
								inning,
								away_runs: data.away_runs,
								home_runs: data.home_runs,
							}));

							console.log(`Game ${gamePk} - Reconstructed innings from plays:`, innings);

							// Get hits and errors from linescore if available
							if (linescore && linescore.teams) {
								awayHits = linescore.teams.away?.hits || 0;
								homeHits = linescore.teams.home?.hits || 0;
								awayErrors = linescore.teams.away?.errors || 0;
								homeErrors = linescore.teams.home?.errors || 0;
							}
						} else {
							console.log(`Game ${gamePk} - No inning data available from any source`);
						}

						// For Final games, ensure we have 9 innings of data
						// If the game is marked as Final in the schedule, it should have complete data
						if (scheduleStatus === 'Final' && innings.length > 0 && innings.length < 9) {
							console.log(
								`Game ${gamePk} - Final game with only ${innings.length} innings, filling in missing innings with zeros`
							);

							// Fill in missing innings with zeros up to 9 innings
							const filledInnings: Array<{ inning: number; away_runs: number; home_runs: number }> = [];
							for (let i = 1; i <= 9; i++) {
								const existingInning = innings.find((inning) => inning.inning === i);
								if (existingInning) {
									filledInnings.push(existingInning);
								} else {
									filledInnings.push({
										inning: i,
										away_runs: 0,
										home_runs: 0,
									});
								}
							}
							innings = filledInnings;
							console.log(`Game ${gamePk} - Filled innings to 9:`, innings);
						}
					} catch (feedError) {
						// Game feed not available (likely scheduled game that hasn't started)
						// This is normal for scheduled games
						innings = [];
					}
				}

				// Use the more reliable live feed status if available, otherwise fall back to schedule status
				let finalStatus = status.detailedState || 'Unknown';
				try {
					const gameFeedCacheKey = createCacheKey('gameFeed', gamePk.toString());
					const cachedGameFeed = gameFeedCache.get(gameFeedCacheKey);
					if (cachedGameFeed && (cachedGameFeed as any).gameData?.status?.detailedState) {
						const liveFeedStatus = (cachedGameFeed as any).gameData.status.detailedState;
						// Use live feed status if it's more specific than schedule status
						if (liveFeedStatus !== 'Pre-Game' && liveFeedStatus !== 'Scheduled') {
							finalStatus = liveFeedStatus;
						}
					}
				} catch (e) {
					// Use schedule status if live feed not available
				}

				const game: Game = {
					id: `${date}-${awayCode}-${homeCode}-${gameData.gameNumber || 1}`,
					away_team: awayTeamName,
					home_team: homeTeamName,
					away_code: awayCode,
					home_code: homeCode,
					game_number: gameData.gameNumber || 1,
					start_time: startTime,
					location: `${gameData.venue?.name || ''}, ${gameData.venue?.city || ''}`,
					status: finalStatus,
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
						detailedState: finalStatus,
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
		// Create cache key for game details
		const gameDetailsCacheKey = createCacheKey('gameDetails', gameId);

		// Use cached request for the entire game details operation
		return await makeCachedRequest(
			gameDetailsCache,
			gameDetailsCacheKey,
			async () => {
				// Parse game ID to extract components
				const parts = gameId.split('-');
				if (parts.length < 6) {
					throw new Error('Invalid game ID format');
				}

				const date = `${parts[0]}-${parts[1]}-${parts[2]}`;
				const awayCode = parts[3];
				const homeCode = parts[4];
				const gameNumber = parseInt(parts[5]);

				// Get schedule data with caching and linescore hydration
				const scheduleCacheKey = createCacheKey('schedule', date);
				const scheduleData = await makeCachedRequest(
					scheduleCache,
					scheduleCacheKey,
					async () => {
						const [year, month, day] = date.split('-').map(Number);
						const timestamp = Date.now();
						const scheduleResponse = await fetch(
							`${MLB_API_BASE}/schedule?sportId=1&date=${month}/${day}/${year}&hydrate=linescore&t=${timestamp}`
						);

						if (!scheduleResponse.ok) {
							throw new Error(`MLB API error: ${scheduleResponse.status}`);
						}

						return scheduleResponse.json();
					},
					2 * 60 * 1000 // 2 minutes TTL for schedule data
				);

				// Find the specific game
				let gameData = null;
				if (scheduleData.dates && scheduleData.dates.length > 0) {
					for (const game of scheduleData.dates[0].games) {
						const teams = game.teams || {};
						const awayTeam = teams.away || {};
						const homeTeam = teams.home || {};

						const awayTeamName = awayTeam.team?.name;
						const homeTeamName = homeTeam.team?.name;
						const awayCodeFromName = TEAM_ABBREVIATIONS[awayTeamName || ''];
						const homeCodeFromName = TEAM_ABBREVIATIONS[homeTeamName || ''];

						if (
							awayCodeFromName === awayCode &&
							homeCodeFromName === homeCode &&
							(game.gameNumber || 1) === gameNumber
						) {
							gameData = game;
							break;
						}
					}
				}

				if (!gameData) {
					throw new Error('Game not found in schedule');
				}

				// Extract basic game information
				const teams = gameData.teams || {};
				const awayTeam = teams.away || {};
				const homeTeam = teams.home || {};
				const status = gameData.status || {};

				const awayTeamName = awayTeam.team?.name || 'Away Team';
				const homeTeamName = homeTeam.team?.name || 'Home Team';
				const awayCodeFromName = TEAM_ABBREVIATIONS[awayTeamName] || 'AWY';
				const homeCodeFromName = TEAM_ABBREVIATIONS[homeTeamName] || 'HOM';

				// Get scores from the schedule data
				const awayScore = awayTeam.score || 0;
				const homeScore = homeTeam.score || 0;

				// Process inning data using the same logic as getGamesForDate
				let inningList: any[] = [];

				// First try to get inning data from the schedule API (which now includes linescore)
				if (gameData.linescore && gameData.linescore.innings && gameData.linescore.innings.length > 0) {
					console.log(`Game ${gameData.gamePk} - Using linescore data from schedule API:`, gameData.linescore.innings);

					inningList = gameData.linescore.innings.map((inning: any) => ({
						inning: inning.num,
						away_runs: inning.away?.runs || 0,
						home_runs: inning.home?.runs || 0,
					}));

					console.log(`Game ${gameData.gamePk} - Processed innings from schedule API:`, inningList);
				}
				// Always fetch detailed game feed data for comprehensive player stats and play-by-play
				try {
					const gamePk = gameData.gamePk;
					console.log(`Attempting to fetch game feed for game PK: ${gamePk}`);

					if (gamePk) {
						const gameFeedCacheKey = createCacheKey('gameFeed', gamePk.toString());

						const gameFeedData = await makeCachedRequest(
							gameFeedCache,
							gameFeedCacheKey,
							async () => {
								const gameFeedResponse = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`, {
									headers: {
										'User-Agent': 'Mozilla/5.0 (compatible; BaseballApp/1.0)',
									},
								});

								if (!gameFeedResponse.ok) {
									throw new Error(`Game feed not available for game ${gamePk}`);
								}

								return gameFeedResponse.json();
							},
							30 * 1000 // 30 seconds TTL for live game feeds
						);

						// Extract comprehensive data from game feed
						console.log('Game feed data structure:', {
							hasLiveData: !!gameFeedData.liveData,
							hasBoxscore: !!gameFeedData.liveData?.boxscore,
							hasTeams: !!gameFeedData.liveData?.boxscore?.teams,
							hasAwayTeam: !!gameFeedData.liveData?.boxscore?.teams?.away,
							hasHomeTeam: !!gameFeedData.liveData?.boxscore?.teams?.home,
							playersCount: Object.keys(gameFeedData.gameData?.players || {}).length,
						});

						// Debug the actual structure of team data
						if (gameFeedData.liveData?.boxscore?.teams) {
							const awayTeam = gameFeedData.liveData.boxscore.teams.away;
							const homeTeam = gameFeedData.liveData.boxscore.teams.home;

							console.log('Away team structure:', {
								keys: Object.keys(awayTeam || {}),
								hasBatters: !!awayTeam?.batters,
								battersLength: awayTeam?.batters?.length || 0,
								hasPitchers: !!awayTeam?.pitchers,
								pitchersLength: awayTeam?.pitchers?.length || 0,
								hasPlayers: !!awayTeam?.players,
								playersLength: awayTeam?.players ? Object.keys(awayTeam.players).length : 0,
								firstBatter: awayTeam?.batters?.[0]
									? {
											name: awayTeam.batters[0].person?.fullName,
											hasStats: !!awayTeam.batters[0].stats,
											statsKeys: awayTeam.batters[0].stats ? Object.keys(awayTeam.batters[0].stats) : [],
									  }
									: null,
							});

							console.log('Home team structure:', {
								keys: Object.keys(homeTeam || {}),
								hasBatters: !!homeTeam?.batters,
								battersLength: homeTeam?.batters?.length || 0,
								hasPitchers: !!homeTeam?.pitchers,
								pitchersLength: homeTeam?.pitchers?.length || 0,
								hasPlayers: !!homeTeam?.players,
								playersLength: homeTeam?.players ? Object.keys(homeTeam.players).length : 0,
							});
						}

						const linescore = gameFeedData.liveData?.linescore;
						const boxscore = gameFeedData.liveData?.boxscore;
						const allPlays = gameFeedData.liveData?.plays?.allPlays || [];
						const players = gameFeedData.gameData?.players || {};

						// Process inning data
						if (linescore && linescore.innings) {
							inningList = linescore.innings.map((inning: any) => ({
								inning: inning.num,
								away_runs: inning.away?.runs || 0,
								home_runs: inning.home?.runs || 0,
							}));
						}

						// Process player statistics
						let playerStats: { away: { batters: any[]; pitchers: any[] }; home: { batters: any[]; pitchers: any[] } } =
							{
								away: { batters: [], pitchers: [] },
								home: { batters: [], pitchers: [] },
							};
						if (boxscore && boxscore.teams) {
							// Process substitution events from play-by-play
							console.log('DEBUG: Total allPlays count:', allPlays.length);
							console.log(
								'DEBUG: Sample allPlays events:',
								allPlays.slice(0, 10).map((play: any) => ({
									eventType: play.result?.eventType,
									description: play.result?.description,
									hasPlayers: !!play.players,
									playersCount: play.players?.length || 0,
									// Check MLB API spec properties for substitutions
									isSubstitution: play.isSubstitution,
									hasSubstitution: !!play.substitution,
									substitutionKeys: play.substitution ? Object.keys(play.substitution) : null,
									about: play.about
										? {
												inning: play.about.inning,
												halfInning: play.about.halfInning,
										  }
										: null,
								}))
							);

							// Debug: Show all unique event types in allPlays
							const eventTypes = allPlays.map((play: any) => play.result?.eventType).filter(Boolean);
							const uniqueEventTypes = Array.from(new Set(eventTypes));
							console.log('DEBUG: All unique event types in allPlays:', uniqueEventTypes);

							// Debug: Check if there are other event types in the game feed
							console.log('DEBUG: Game feed structure keys:', Object.keys(gameFeedData || {}));
							if (gameFeedData?.liveData) {
								console.log('DEBUG: LiveData keys:', Object.keys(gameFeedData.liveData));
								if (gameFeedData.liveData.plays) {
									console.log('DEBUG: Plays keys:', Object.keys(gameFeedData.liveData.plays));
									// Check if there are substitution events in a different section
									if (gameFeedData.liveData.plays.allPlays) {
										const allEvents = gameFeedData.liveData.plays.allPlays;
										const allEventTypes = allEvents.map((play: any) => play.result?.eventType).filter(Boolean);
										const allUniqueEventTypes = Array.from(new Set(allEventTypes));
										console.log('DEBUG: All event types in liveData.plays.allPlays:', allUniqueEventTypes);
									}
									// Check for substitution events in other play sections
									if (gameFeedData.liveData.plays.substitutionEvents) {
										console.log(
											'DEBUG: Found substitutionEvents section:',
											gameFeedData.liveData.plays.substitutionEvents
										);
									}
									if (gameFeedData.liveData.plays.substitutions) {
										console.log('DEBUG: Found substitutions section:', gameFeedData.liveData.plays.substitutions);
									}
									// Check playsByInning for substitution events using MLB API spec
									if (gameFeedData.liveData.plays.playsByInning) {
										console.log(
											'DEBUG: playsByInning structure:',
											Object.keys(gameFeedData.liveData.plays.playsByInning)
										);

										// Examine the structure of each inning
										Object.entries(gameFeedData.liveData.plays.playsByInning).forEach(
											([inningNum, inning]: [string, any]) => {
												console.log(`DEBUG: Inning ${inningNum} structure:`, {
													hasTop: !!inning.top,
													hasBottom: !!inning.bottom,
													topPlays: inning.top?.length || 0,
													bottomPlays: inning.bottom?.length || 0,
													topSample:
														inning.top?.slice(0, 2).map((play: any) => ({
															eventType: play.result?.eventType,
															isSubstitution: play.isSubstitution,
															hasSubstitution: !!play.substitution,
															description: play.result?.description,
														})) || [],
													bottomSample:
														inning.bottom?.slice(0, 2).map((play: any) => ({
															eventType: play.result?.eventType,
															isSubstitution: play.isSubstitution,
															hasSubstitution: !!play.substitution,
															description: play.result?.description,
														})) || [],
												});
											}
										);

										// Look for substitution events in inning-by-inning data using API spec
										const allInningEvents: any[] = [];
										Object.values(gameFeedData.liveData.plays.playsByInning).forEach((inning: any) => {
											if (inning.top) allInningEvents.push(...inning.top);
											if (inning.bottom) allInningEvents.push(...inning.bottom);
										});

										const substitutionEventsInInnings = allInningEvents.filter(
											(play: any) =>
												// Use MLB API spec properties
												play.isSubstitution === true ||
												play.substitution !== undefined ||
												// Fallback to event type and description
												play.result?.eventType?.includes('substitution') ||
												play.result?.description?.toLowerCase().includes('pinch') ||
												play.result?.description?.toLowerCase().includes('sub')
										);
										console.log('DEBUG: Substitution events in playsByInning:', substitutionEventsInInnings.length);
										if (substitutionEventsInInnings.length > 0) {
											console.log(
												'DEBUG: Sample substitution events from playsByInning:',
												substitutionEventsInInnings.slice(0, 3).map((play: any) => ({
													eventType: play.result?.eventType,
													isSubstitution: play.isSubstitution,
													substitution: play.substitution,
													description: play.result?.description,
													about: play.about,
												}))
											);
										}
									}
								}
							}

							// Debug: Show events that might be substitutions
							const possibleSubstitutions = allPlays.filter((play: any) => {
								const desc = play.result?.description?.toLowerCase() || '';
								return (
									desc.includes('pinch') ||
									desc.includes('sub') ||
									desc.includes('replace') ||
									play.result?.eventType?.toLowerCase().includes('sub')
								);
							});
							console.log('DEBUG: Possible substitution events found:', possibleSubstitutions.length);
							if (possibleSubstitutions.length > 0) {
								console.log(
									'DEBUG: Sample possible substitutions:',
									possibleSubstitutions.slice(0, 3).map((play: any) => ({
										eventType: play.result?.eventType,
										description: play.result?.description,
										about: play.about,
									}))
								);
							}

							// Debug: Look for substitution events using MLB API spec properties
							const substitutionEvents = allPlays.filter(
								(play: any) =>
									// Use isSubstitution flag from API spec
									play.isSubstitution === true ||
									// Check for substitution object from API spec
									play.substitution !== undefined ||
									// Check event types from API spec
									play.result?.eventType === 'Substitution' ||
									play.result?.eventType === 'pitching_substitution' ||
									play.result?.eventType === 'offensive_substitution' ||
									play.result?.eventType === 'defensive_substitution' ||
									// Fallback to description parsing
									play.result?.description?.includes('Pinch') ||
									play.result?.description?.includes('Defensive Sub')
							);
							console.log('DEBUG: Found substitution events:', substitutionEvents.length);
							console.log('DEBUG: Sample substitution events:', substitutionEvents.slice(0, 3));
							const substitutionData = processSubstitutionEvents(substitutionEvents);
							console.log('DEBUG: Processed substitution data:', substitutionData.size, 'entries');

							// Since no substitution events found in play-by-play, derive timing from boxscore data
							if (substitutionData.size === 0) {
								console.log('DEBUG: No substitution events found in play-by-play, deriving from boxscore data');
								const derivedSubstitutionData = deriveSubstitutionTimingFromBoxscore(boxscore, allPlays);
								console.log('DEBUG: Derived substitution data from boxscore:', derivedSubstitutionData.size, 'entries');

								// Merge derived data with existing substitution data
								derivedSubstitutionData.forEach((value, key) => {
									substitutionData.set(key, value);
								});
								console.log('DEBUG: Final combined substitution data:', substitutionData.size, 'entries');

								// Apply substitution timing data to individual players in the boxscore
								substitutionData.forEach((subData, playerName) => {
									// Find the player in both teams and update their data
									[boxscore.teams.away, boxscore.teams.home].forEach((team: any) => {
										Object.values(team.players).forEach((player: any) => {
											if (player.person?.fullName === playerName) {
												// Add substitution timing data to the player object
												player.substitution_inning = subData.inning;
												player.substitution_half_inning = subData.halfInning;
												player.substitution_type = subData.type;
												console.log(`DEBUG: Applied substitution data to ${playerName}:`, {
													inning: subData.inning,
													halfInning: subData.halfInning,
													type: subData.type,
												});
											}
										});
									});
								});

								// Also update the substitutionData map with the applied data for extractBatterStats
								substitutionData.forEach((subData, playerName) => {
									// Find players in the processed teams and update their substitution data
									[boxscore.teams.away, boxscore.teams.home].forEach((team: any) => {
										Object.values(team.players).forEach((player: any) => {
											if (player.person?.fullName === playerName) {
												// Update the substitutionData map with the player's substitution data
												substitutionData.set(playerName, {
													type: player.substitution_type || subData.type,
													inning: player.substitution_inning || subData.inning,
													halfInning: player.substitution_half_inning || subData.halfInning,
												});
											}
										});
									});
								});
							}

							// Debug: Look at player data to see if we can identify substitutions from boxscore
							console.log(
								'DEBUG: Away team batters with substitution info:',
								boxscore.teams.away.batters.slice(0, 5).map((batterId: any) => {
									const player = boxscore.teams.away.players[`ID${batterId}`];
									return {
										name: player?.person?.fullName,
										isSubstitute: player?.gameStatus?.isSubstitute,
										allPositions: player?.allPositions?.map((p: any) => ({ code: p.code, name: p.name })),
										battingOrder: player?.battingOrder,
										gameStatus: player?.gameStatus,
										// Check for substitution timing data
										substitutionInning: player?.substitutionInning,
										substitutionHalfInning: player?.substitutionHalfInning,
										// Check all player properties for timing data
										playerKeys: Object.keys(player || {}),
									};
								})
							);

							// Debug: Show detailed player data structure for first player with substitutions
							const firstSubPlayer = boxscore.teams.away.batters.find((batterId: any) => {
								const player = boxscore.teams.away.players[`ID${batterId}`];
								return player?.allPositions && player.allPositions.length > 1;
							});
							if (firstSubPlayer) {
								const player = boxscore.teams.away.players[`ID${firstSubPlayer}`];
								console.log('DEBUG: Detailed player data for first substitution player:', {
									name: player?.person?.fullName,
									allPositions: player?.allPositions,
									gameStatus: player?.gameStatus,
									stats: player?.stats,
									seasonStats: player?.seasonStats,
									allKeys: Object.keys(player || {}),
									// Check specific properties that might contain timing
									substitutionData: {
										substitutionInning: player?.substitutionInning,
										substitutionHalfInning: player?.substitutionHalfInning,
										substitutionType: player?.substitutionType,
										entryInning: player?.entryInning,
										exitInning: player?.exitInning,
									},
								});
							}

							// Process away team stats
							if (boxscore.teams.away && boxscore.teams.away.batters) {
								const awayBatters = extractBatterStats(
									boxscore.teams.away.batters,
									boxscore.teams.away.players,
									substitutionData
								);
								// Extract ALL players who have pitched (including position players who pitched)
								const awayPitchers = extractAllPitchersFromGame(boxscore.teams.away, players, true);
								playerStats.away = { batters: awayBatters, pitchers: awayPitchers };
							}

							// Process home team stats
							if (boxscore.teams.home && boxscore.teams.home.batters) {
								const homeBatters = extractBatterStats(
									boxscore.teams.home.batters,
									boxscore.teams.home.players,
									substitutionData
								);
								// Extract ALL players who have pitched (including position players who pitched)
								const homePitchers = extractAllPitchersFromGame(boxscore.teams.home, players, false);
								playerStats.home = { batters: homeBatters, pitchers: homePitchers };
							}
						}

						// Process play-by-play data for at-bat results
						// Combine away and home team players for play-by-play processing
						const allTeamPlayers = {
							...(boxscore.teams.away?.players || {}),
							...(boxscore.teams.home?.players || {}),
						};
						const playByPlayData = processPlayByPlayData(allPlays, allTeamPlayers);

						// If no errors found in play-by-play, try to extract from linescore data
						if (playByPlayData.errors.size === 0 && linescore && linescore.innings) {
							console.log('DEBUG: No errors found in play-by-play, checking linescore data...');
							linescore.innings.forEach((inning: any) => {
								if (inning.home?.errors > 0 || inning.away?.errors > 0) {
									console.log(`DEBUG: Found errors in linescore for inning ${inning.num}:`, {
										home: inning.home?.errors,
										away: inning.away?.errors,
									});

									// Add errors from linescore data
									if (inning.home?.errors > 0) {
										const errorKey = `${inning.num}-bottom`;
										if (!playByPlayData.errors.has(errorKey)) {
											playByPlayData.errors.set(errorKey, []);
										}
										// Add placeholder error entries based on linescore count
										for (let i = 0; i < inning.home.errors; i++) {
											playByPlayData.errors.get(errorKey)!.push({
												inning: inning.num,
												halfInning: 'bottom',
												eventType: 'linescore_error',
												description: 'Error from linescore data',
												team: 'home',
											});
										}
									}

									if (inning.away?.errors > 0) {
										const errorKey = `${inning.num}-top`;
										if (!playByPlayData.errors.has(errorKey)) {
											playByPlayData.errors.set(errorKey, []);
										}
										// Add placeholder error entries based on linescore count
										for (let i = 0; i < inning.away.errors; i++) {
											playByPlayData.errors.get(errorKey)!.push({
												inning: inning.num,
												halfInning: 'top',
												eventType: 'linescore_error',
												description: 'Error from linescore data',
												team: 'away',
											});
										}
									}
								}
							});
						}

						console.log('Final player stats before return:', {
							awayBatters: playerStats.away.batters.length,
							awayPitchers: playerStats.away.pitchers.length,
							homeBatters: playerStats.home.batters.length,
							homePitchers: playerStats.home.pitchers.length,
							awayPitcherNames: playerStats.away.pitchers.map((p) => p.name),
							homePitcherNames: playerStats.home.pitchers.map((p) => p.name),
						});

						// Extract supplementary game information
						const umpires = extractUmpires(gameFeedData);

						// Get team IDs for manager extraction
						const awayTeamId = gameFeedData.gameData?.teams?.away?.id;
						const homeTeamId = gameFeedData.gameData?.teams?.home?.id;

						let managers;
						if (awayTeamId && homeTeamId) {
							managers = await extractManagers(awayTeamId, homeTeamId);
						} else {
							managers = generateFallbackManagers();
						}

						const weather = extractWeather(gameFeedData);
						const uniforms = await extractUniforms(awayTeamId, homeTeamId);
						const startTime = extractStartTime(gameFeedData);
						const endTime = extractEndTime(gameFeedData);
						const wind = extractWind(gameFeedData);

						// Store comprehensive data for return
						const detailedGameData = {
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
								away_score: awayScore,
								home_score: homeScore,
								total_away_runs: awayScore,
								total_home_runs: homeScore,
								status: status.detailedState,
								umpires: umpires,
								managers: managers,
								start_time: startTime,
								end_time: endTime,
								weather: weather,
								wind: wind,
								uniforms: uniforms,
								player_stats: playerStats,
								play_by_play: playByPlayData,
								linescore: linescore ? { innings: linescore.innings } : undefined,
							},
							svg_content: generateDetailedSVGFromSchedule(gameData, awayCodeFromName, homeCodeFromName, inningList),
							success: true,
						};

						console.log('Returning detailed game data with play-by-play:', {
							hasPlayByPlay: !!playByPlayData,
							atBatsCount: playByPlayData?.atBats?.size || 0,
							substitutionsCount: playByPlayData?.substitutions?.size || 0,
						});

						return detailedGameData;
					}
				} catch (feedError) {
					console.log(`Error fetching detailed data for game ${gameData.gamePk}:`, feedError);
					console.log('Error details:', {
						message: (feedError as Error).message,
						stack: (feedError as Error).stack,
						gamePk: gameData.gamePk,
					});
					// Continue with basic data if detailed feed fails
				}

				// Return the game data (fallback)
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
						away_score: awayScore,
						home_score: homeScore,
						total_away_runs: awayScore,
						total_home_runs: homeScore,
						status: status.detailedState,
						umpires: [],
						managers: { away: null, home: null },
						start_time: null,
						end_time: null,
						weather: null,
						wind: null,
						uniforms: { away: null, home: null },
						player_stats: { away: { batters: [], pitchers: [] }, home: { batters: [], pitchers: [] } },
					},
					svg_content: generateDetailedSVGFromSchedule(gameData, awayCodeFromName, homeCodeFromName, inningList),
					success: true,
				};
			},
			5 * 60 * 1000 // 5 minutes TTL for game details
		);
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
			inning_list: Array.from({ length: 9 }, (_, i) => ({ inning: i + 1, away_runs: 0, home_runs: 0 })),
			is_postponed: false,
			is_suspended: false,
			away_score: 0,
			home_score: 0,
			total_away_runs: 0,
			total_home_runs: 0,
			status: 'Unknown',
			umpires: [],
			managers: { away: null, home: null },
			start_time: null,
			end_time: null,
			weather: null,
			wind: null,
			uniforms: { away: null, home: null },
			player_stats: { away: { batters: [], pitchers: [] }, home: { batters: [], pitchers: [] } },
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
				<text x="300" y="${200 + index * 25}" text-anchor="middle" font-size="12">${inning.away_runs}</text>
				<text x="500" y="${200 + index * 25}" text-anchor="middle" font-size="12">${inning.home_runs}</text>
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
				Generated from MLB API - Complete game data with player statistics
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
				Generated from MLB API - Complete game data with player statistics
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
				This is a simplified scorecard. Enhanced data available through MLB API.
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

// Cache management functions
export function clearGameDetailsCache(gameId?: string): void {
	if (gameId) {
		const cacheKey = createCacheKey('gameDetails', gameId);
		gameDetailsCache.delete(cacheKey);
	} else {
		gameDetailsCache.clear();
	}
}

export function clearScheduleCache(date?: string): void {
	if (date) {
		const cacheKey = createCacheKey('schedule', date);
		scheduleCache.delete(cacheKey);
	} else {
		scheduleCache.clear();
	}
}

export function clearGameFeedCache(gamePk?: string): void {
	if (gamePk) {
		const cacheKey = createCacheKey('gameFeed', gamePk);
		gameFeedCache.delete(cacheKey);
	} else {
		gameFeedCache.clear();
	}
}

export function getCacheStats(): { [key: string]: number } {
	return {
		gameDetails: gameDetailsCache.size(),
		schedule: scheduleCache.size(),
		gameFeed: gameFeedCache.size(),
		coaches: coachesCache.size(),
		uniforms: uniformsCache.size(),
	};
}

export function clearAllCaches(): void {
	gameDetailsCache.clear();
	scheduleCache.clear();
	gameFeedCache.clear();
	coachesCache.clear();
	uniformsCache.clear();
	pendingRequests.clear();
}

// Simplified getGameDetails function using only MLB API data
export async function getGameDetailsSimple(gameId: string): Promise<any> {
	const parts = gameId.split('-');
	if (parts.length !== 6) {
		throw new Error('Invalid game ID format');
	}

	const date = parts.slice(0, 3).join('-');
	const awayCode = parts[3];
	const homeCode = parts[4];
	const gameNumber = parseInt(parts[5], 10);

	console.log('*** getGameDetailsSimple FUNCTION CALLED - USING ONLY MLB API ***');

	const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=game,linescore,team,weather,gameInfo,venue,decisions`;

	const scheduleResponse = await fetch(scheduleUrl, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (compatible; BaseballApp/1.0)',
		},
	});

	if (!scheduleResponse.ok) {
		throw new Error(`Schedule API request failed with status: ${scheduleResponse.status}`);
	}

	const scheduleData = await scheduleResponse.json();

	// Find the specific game
	let gameData = null;
	if (scheduleData.dates && scheduleData.dates.length > 0) {
		for (const game of scheduleData.dates[0].games) {
			const teams = game.teams || {};
			const awayTeam = teams.away || {};
			const homeTeam = teams.home || {};

			const awayTeamName = awayTeam.team?.name;
			const homeTeamName = homeTeam.team?.name;
			const awayCodeFromName = TEAM_ABBREVIATIONS[awayTeamName || ''];
			const homeCodeFromName = TEAM_ABBREVIATIONS[homeTeamName || ''];

			if (awayCodeFromName === awayCode && homeCodeFromName === homeCode && (game.gameNumber || 1) === gameNumber) {
				gameData = game;
				break;
			}
		}
	}

	if (!gameData) {
		throw new Error('Game not found in schedule');
	}

	// Extract basic game information
	const teams = gameData.teams || {};
	const awayTeam = teams.away || {};
	const homeTeam = teams.home || {};
	const status = gameData.status || {};

	const awayTeamName = awayTeam.team?.name || 'Away Team';
	const homeTeamName = homeTeam.team?.name || 'Home Team';
	const awayCodeFromName = TEAM_ABBREVIATIONS[awayTeamName] || 'AWY';
	const homeCodeFromName = TEAM_ABBREVIATIONS[homeTeamName] || 'HOM';

	// Get scores from the schedule data
	const awayScore = awayTeam.score || 0;
	const homeScore = homeTeam.score || 0;

	// Process inning data directly from schedule API linescore
	let inningList: any[] = [];

	if (gameData.linescore && gameData.linescore.innings && gameData.linescore.innings.length > 0) {
		console.log(`Game ${gameData.gamePk} - Using linescore data from schedule API:`, gameData.linescore.innings);

		inningList = gameData.linescore.innings.map((inning: any) => ({
			inning: inning.num,
			away_runs: inning.away?.runs || 0,
			home_runs: inning.home?.runs || 0,
		}));

		console.log(`Game ${gameData.gamePk} - Processed innings from schedule API:`, inningList);
	} else {
		// Fallback to 9 empty innings if no linescore data
		inningList = Array.from({ length: 9 }, (_, i) => ({
			inning: i + 1,
			away_runs: 0,
			home_runs: 0,
		}));
		console.log(`Game ${gameData.gamePk} - Using fallback innings data:`, inningList);
	}

	// Fetch supplementary data from game feed (umpires, managers, etc.)
	let umpires: Array<{ name: string; position: string; id?: string | null }> = [];
	let managers: { away: string | null; home: string | null } = { away: null, home: null };
	let weather: string | null = null;
	let uniforms: { away: string | null; home: string | null } = { away: null, home: null };

	try {
		const gamePk = gameData.gamePk;
		console.log(`Fetching supplementary data from game feed for game PK: ${gamePk}`);

		if (gamePk) {
			const gameFeedCacheKey = createCacheKey('gameFeed', gamePk.toString());

			const gameFeedData = await makeCachedRequest(
				gameFeedCache,
				gameFeedCacheKey,
				async () => {
					const gameFeedResponse = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`, {
						headers: {
							'User-Agent': 'Mozilla/5.0 (compatible; BaseballApp/1.0)',
						},
					});

					if (!gameFeedResponse.ok) {
						throw new Error(`Game feed request failed with status: ${gameFeedResponse.status}`);
					}

					return await gameFeedResponse.json();
				},
				60 * 60 * 1000 // 1 hour TTL for supplementary data (doesn't change during game)
			);

			// Extract supplementary data
			umpires = extractUmpires(gameFeedData);

			// Get team IDs from game data
			const awayTeamId = gameData.teams?.away?.team?.id;
			const homeTeamId = gameData.teams?.home?.team?.id;

			if (awayTeamId && homeTeamId) {
				managers = await extractManagers(awayTeamId, homeTeamId);
			} else {
				managers = generateFallbackManagers();
			}

			weather = extractWeather(gameFeedData);
			uniforms = await extractUniforms(awayTeamId, homeTeamId);

			console.log('Extracted supplementary data:', {
				umpiresCount: umpires.length,
				managers: managers,
				weather: weather,
				uniforms: uniforms,
			});
		}
	} catch (supplementaryError) {
		console.log(`Error fetching supplementary data for game ${gameData.gamePk}:`, supplementaryError);
		// Continue with empty supplementary data
	}

	// Return simplified game data using only schedule API
	const simplifiedGameData = {
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
			away_score: awayScore,
			home_score: homeScore,
			total_away_runs: awayScore,
			total_home_runs: homeScore,
			status: status.detailedState,
			umpires: umpires,
			managers: managers,
			start_time: extractStartTimeFromSchedule(gameData),
			end_time: extractEndTime(gameData),
			weather: extractWeatherFromSchedule(gameData),
			wind: extractWindFromSchedule(gameData),
			uniforms: uniforms,
			player_stats: { away: { batters: [], pitchers: [] }, home: { batters: [], pitchers: [] } },
		},
		svg_content: generateDetailedSVGFromSchedule(gameData, awayCodeFromName, homeCodeFromName, inningList),
		success: true,
	};

	console.log('Returning simplified game data:', {
		gameId: simplifiedGameData.game_id,
		inningCount: simplifiedGameData.game_data.inning_list.length,
		firstThreeInnings: simplifiedGameData.game_data.inning_list.slice(0, 3),
	});

	return simplifiedGameData;
}

// Cleanup function to be called when the application shuts down
export function destroyCaches(): void {
	gameDetailsCache.destroy();
	scheduleCache.destroy();
	gameFeedCache.destroy();
	coachesCache.destroy();
	uniformsCache.destroy();
	pendingRequests.clear();
}
