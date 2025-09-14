import { NextResponse } from 'next/server';

export async function GET() {
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

	return NextResponse.json({
		teams,
		success: true,
	});
}
