#!/usr/bin/env python3
"""
Integration script to bridge the Next.js app with the existing Baseball library.
This script provides detailed game data for the modern scorecard interface.
"""

import sys
import os
import json
import urllib.request
import urllib.parse
from datetime import datetime, date
from typing import Dict, List, Any, Optional

# Add the baseball library to the path
baseball_path = os.path.join(os.path.dirname(__file__), '..', '..', 'baseball')
if os.path.exists(baseball_path):
    sys.path.insert(0, baseball_path)
else:
    # Try alternative path
    baseball_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'baseball')
    if os.path.exists(baseball_path):
        sys.path.insert(0, baseball_path)

# Change to the baseball directory to fix import issues
original_cwd = os.getcwd()
baseball_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'baseball')
if os.path.exists(baseball_dir):
    os.chdir(baseball_dir)

def customize_game_data(template_data: Dict[str, Any], date_str: str, away_code: str, home_code: str, game_number: int) -> Dict[str, Any]:
    """Customize template game data to match the requested teams and date"""
    
    # Team name mapping
    team_names = {
        'TB': 'Tampa Bay Rays',
        'CHC': 'Chicago Cubs',
        'NYM': 'New York Mets',
        'LAD': 'Los Angeles Dodgers',
        'BOS': 'Boston Red Sox',
        'ATL': 'Atlanta Braves',
        'CLE': 'Cleveland Guardians',
        'DET': 'Detroit Tigers',
        'SEA': 'Seattle Mariners',
        'MIN': 'Minnesota Twins',
        'ARI': 'Arizona Diamondbacks',
        'COL': 'Colorado Rockies',
        'SD': 'San Diego Padres',
        'LAA': 'Los Angeles Angels',
        'OAK': 'Oakland Athletics',
        'TEX': 'Texas Rangers',
        'HOU': 'Houston Astros',
        'KC': 'Kansas City Royals',
        'STL': 'St. Louis Cardinals',
        'MIL': 'Milwaukee Brewers',
        'CIN': 'Cincinnati Reds',
        'PIT': 'Pittsburgh Pirates',
        'CHW': 'Chicago White Sox',
        'BAL': 'Baltimore Orioles',
        'WSH': 'Washington Nationals',
        'PHI': 'Philadelphia Phillies',
        'MIA': 'Miami Marlins',
        'NYY': 'New York Yankees',
        'TOR': 'Toronto Blue Jays',
        'SF': 'San Francisco Giants'
    }
    
    # Venue mapping
    venue_mapping = {
        'CHC': 'Wrigley Field',
        'TB': 'Tropicana Field',
        'NYM': 'Citi Field',
        'LAD': 'Dodger Stadium',
        'BOS': 'Fenway Park',
        'ATL': 'Truist Park',
        'CLE': 'Progressive Field',
        'DET': 'Comerica Park',
        'SEA': 'T-Mobile Park',
        'MIN': 'Target Field',
        'ARI': 'Chase Field',
        'COL': 'Coors Field',
        'SD': 'Petco Park',
        'LAA': 'Angel Stadium',
        'OAK': 'Oakland Coliseum',
        'TEX': 'Globe Life Field',
        'HOU': 'Minute Maid Park',
        'KC': 'Kauffman Stadium',
        'STL': 'Busch Stadium',
        'MIL': 'American Family Field',
        'CIN': 'Great American Ball Park',
        'PIT': 'PNC Park',
        'CHW': 'Guaranteed Rate Field',
        'BAL': 'Oriole Park at Camden Yards',
        'WSH': 'Nationals Park',
        'PHI': 'Citizens Bank Park',
        'MIA': 'loanDepot park',
        'NYY': 'Yankee Stadium',
        'TOR': 'Rogers Centre',
        'SF': 'Oracle Park'
    }
    
    # Create a copy of the template data
    customized_data = template_data.copy()
    
    # Update basic game information
    customized_data['game_id'] = f"{date_str}-{away_code}-{home_code}-{game_number}"
    customized_data['date'] = date_str
    customized_data['away_team'] = {
        'name': team_names.get(away_code, f'{away_code} Team'),
        'abbreviation': away_code
    }
    customized_data['home_team'] = {
        'name': team_names.get(home_code, f'{home_code} Team'),
        'abbreviation': home_code
    }
    customized_data['venue'] = venue_mapping.get(home_code, f'{home_code} Stadium')
    customized_data['integration_status'] = 'customized_template_data'
    customized_data['note'] = f'Template data customized for {away_code} @ {home_code} on {date_str}'
    
	return customized_data

def get_game_pk_from_schedule(date_str: str, away_code: str, home_code: str, game_number: int) -> Optional[int]:
	"""Get gamePk from MLB schedule API"""
	try:
		# Parse date
		date_obj = datetime.strptime(date_str, '%Y-%m-%d')
		month = date_obj.month
		day = date_obj.day
		year = date_obj.year
		
		# Team name mapping (reverse of the one in customize_game_data)
		team_names = {
			'TB': 'Tampa Bay Rays',
			'CHC': 'Chicago Cubs',
			'NYM': 'New York Mets',
			'LAD': 'Los Angeles Dodgers',
			'BOS': 'Boston Red Sox',
			'ATL': 'Atlanta Braves',
			'CLE': 'Cleveland Guardians',
			'DET': 'Detroit Tigers',
			'SEA': 'Seattle Mariners',
			'MIN': 'Minnesota Twins',
			'ARI': 'Arizona Diamondbacks',
			'COL': 'Colorado Rockies',
			'SD': 'San Diego Padres',
			'LAA': 'Los Angeles Angels',
			'OAK': 'Oakland Athletics',
			'TEX': 'Texas Rangers',
			'HOU': 'Houston Astros',
			'KC': 'Kansas City Royals',
			'STL': 'St. Louis Cardinals',
			'MIL': 'Milwaukee Brewers',
			'CIN': 'Cincinnati Reds',
			'PIT': 'Pittsburgh Pirates',
			'CHW': 'Chicago White Sox',
			'BAL': 'Baltimore Orioles',
			'WSH': 'Washington Nationals',
			'PHI': 'Philadelphia Phillies',
			'MIA': 'Miami Marlins',
			'NYY': 'New York Yankees',
			'TOR': 'Toronto Blue Jays',
			'SF': 'San Francisco Giants'
		}
		
		away_team_name = team_names.get(away_code, f'{away_code} Team')
		home_team_name = team_names.get(home_code, f'{home_code} Team')
		
		# Fetch from MLB schedule API
		url = f'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date={month}/{day}/{year}'
		print(f"Fetching schedule from: {url}", file=sys.stderr)
		
		with urllib.request.urlopen(url) as response:
			data = json.loads(response.read().decode())
		
		if data.get('dates') and len(data['dates']) > 0:
			games = data['dates'][0].get('games', [])
			print(f"Found {len(games)} games for {date_str}", file=sys.stderr)
			
			for game in games:
				teams = game.get('teams', {})
				away_team = teams.get('away', {}).get('team', {})
				home_team = teams.get('home', {}).get('team', {})
				game_details = game.get('game', {})
				
				away_name = away_team.get('name', '')
				home_name = home_team.get('name', '')
				game_num = game_details.get('gameNumber', 1)
				
				if (away_name == away_team_name and 
					home_name == home_team_name and 
					game_num == game_number):
					game_pk = game.get('gamePk')
					print(f"Found matching game: {away_name} @ {home_name} (Game {game_num}) - gamePk: {game_pk}", file=sys.stderr)
					return game_pk
		
		print(f"No matching game found for {away_code} @ {home_code} on {date_str}", file=sys.stderr)
		return None
		
	except Exception as e:
		print(f"Error fetching gamePk: {e}", file=sys.stderr)
		return None

def get_mlb_game_details(game_pk: int, game_id: str, date_str: str, away_code: str, home_code: str) -> Optional[Dict[str, Any]]:
	"""Get detailed game data from MLB API"""
	try:
		# Fetch detailed game data
		url = f'https://statsapi.mlb.com/api/v1/game/{game_pk}/feed/live'
		print(f"Fetching game details from: {url}", file=sys.stderr)
		
		with urllib.request.urlopen(url) as response:
			data = json.loads(response.read().decode())
		
		# Extract game data
		game_data = data.get('gameData', {})
		live_data = data.get('liveData', {})
		
		# Get teams
		teams = game_data.get('teams', {})
		away_team_data = teams.get('away', {})
		home_team_data = teams.get('home', {})
		
		# Get linescore (inning-by-inning scores)
		linescore = live_data.get('linescore', {})
		innings = linescore.get('innings', [])
		
		# Build inning data
		inning_list = []
		for i, inning in enumerate(innings):
			inning_num = i + 1
			away_runs = inning.get('away', {}).get('runs', 0)
			home_runs = inning.get('home', {}).get('runs', 0)
			
			inning_list.append({
				"inning": inning_num,
				"away_runs": away_runs,
				"home_runs": home_runs,
				"top_events": [],  # We'll populate these from play data if available
				"bottom_events": []
			})
		
		# Get boxscore data
		boxscore = live_data.get('boxscore', {})
		away_batters = boxscore.get('teams', {}).get('away', {}).get('batters', [])
		home_batters = boxscore.get('teams', {}).get('home', {}).get('batters', [])
		away_pitchers = boxscore.get('teams', {}).get('away', {}).get('pitchers', [])
		home_pitchers = boxscore.get('teams', {}).get('home', {}).get('pitchers', [])
		
		# Get player stats
		away_batter_stats = []
		home_batter_stats = []
		away_pitcher_stats = []
		home_pitcher_stats = []
		
		# This is a simplified version - in a full implementation, you'd parse the detailed stats
		# For now, we'll create basic stat structures
		
		# Get venue
		venue = game_data.get('venue', {}).get('name', 'Unknown Stadium')
		
		# Get game status
		status = game_data.get('status', {}).get('detailedState', 'Unknown')
		
		# Calculate total runs
		total_away_runs = sum(inning['away_runs'] for inning in inning_list)
		total_home_runs = sum(inning['home_runs'] for inning in inning_list)
		
		result = {
			"game_id": game_id,
			"date": date_str,
			"away_team": {
				"name": away_team_data.get('name', f'{away_code} Team'),
				"abbreviation": away_code
			},
			"home_team": {
				"name": home_team_data.get('name', f'{home_code} Team'),
				"abbreviation": home_code
			},
			"venue": venue,
			"status": status,
			"innings": inning_list,
			"batters": {
				"away": away_batter_stats,
				"home": home_batter_stats
			},
			"pitchers": {
				"away": away_pitcher_stats,
				"home": home_pitcher_stats
			},
			"events": [],
			"integration_status": "real_mlb_api_data",
			"note": f"Real data from MLB API for {away_code} @ {home_code} on {date_str}",
			"total_away_runs": total_away_runs,
			"total_home_runs": total_home_runs
		}
		
		print(f"Successfully parsed MLB API data: {total_away_runs}-{total_home_runs}", file=sys.stderr)
		return result
		
	except Exception as e:
		print(f"Error fetching MLB game details: {e}", file=sys.stderr)
		import traceback
		traceback.print_exc()
		return None

def get_template_data_fallback(game_id: str, date_str: str, away_code: str, home_code: str, game_number: int) -> Dict[str, Any]:
	"""Fallback to template data if real data is not available"""
	try:
		# Use the World Series Game 7 data as a template
		sample_game_path = os.path.join(original_cwd, '..', 'world_series_game7.json')
		
		if os.path.exists(sample_game_path):
			print(f"Loading template game from: {sample_game_path}", file=sys.stderr)
			
			# Import and use the wrapper script
			wrapper_path = os.path.join(os.path.dirname(__file__), 'baseball_wrapper.py')
			if os.path.exists(wrapper_path):
				# Add the wrapper directory to path
				sys.path.insert(0, os.path.dirname(wrapper_path))
				from baseball_wrapper import load_game_data
				
				data = load_game_data(sample_game_path)
				if data:
					# Modify the data to match the requested game
					data = customize_game_data(data, date_str, away_code, home_code, game_number)
					print(f"Successfully customized template data for {away_code} @ {home_code}", file=sys.stderr)
					return data
				else:
					print("Failed to load template data from wrapper", file=sys.stderr)
			else:
				print(f"Wrapper script not found at {wrapper_path}", file=sys.stderr)
		else:
			print(f"Template game file not found at {sample_game_path}", file=sys.stderr)
	except Exception as e:
		print(f"Error loading template data: {e}", file=sys.stderr)
	
	# Final fallback to basic mock data
	return get_basic_mock_data(game_id, date_str, away_code, home_code)

def get_basic_mock_data(game_id: str, date_str: str, away_code: str, home_code: str) -> Dict[str, Any]:
	"""Basic mock data as final fallback"""
	return {
		"game_id": game_id,
		"date": date_str,
		"away_team": {
			"name": f"{away_code} Team",
			"abbreviation": away_code
		},
		"home_team": {
			"name": f"{home_code} Team",
			"abbreviation": home_code
		},
		"venue": f"{home_code} Stadium",
		"status": "completed",
		"innings": [],
		"batters": {"away": [], "home": []},
		"pitchers": {"away": [], "home": []},
		"events": [],
		"integration_status": "fallback_mock_data",
		"note": "Fallback mock data due to API unavailability"
	}

def get_detailed_game_data(game_id: str) -> Dict[str, Any]:
	"""Get detailed game data using the MLB API"""
	try:
		# Parse the game_id to extract game information
		parts = game_id.split('-')
		if len(parts) < 6:
			raise ValueError("Invalid game ID format")
		
		date_str = f"{parts[0]}-{parts[1]}-{parts[2]}"
		away_code = parts[3]
		home_code = parts[4]
		game_number = int(parts[5])
		
		print(f"Processing game: {away_code} @ {home_code} on {date_str} (Game {game_number})", file=sys.stderr)
		
		# First, get the gamePk from the MLB schedule API
		game_pk = get_game_pk_from_schedule(date_str, away_code, home_code, game_number)
		
		if game_pk:
			print(f"Found gamePk: {game_pk}", file=sys.stderr)
			# Get detailed game data from MLB API
			detailed_data = get_mlb_game_details(game_pk, game_id, date_str, away_code, home_code)
			if detailed_data:
				print(f"Successfully fetched real game data for {away_code} @ {home_code}", file=sys.stderr)
				return detailed_data
			else:
				print("Failed to fetch detailed game data from MLB API", file=sys.stderr)
		else:
			print(f"Could not find gamePk for {away_code} @ {home_code} on {date_str}", file=sys.stderr)
		
		# Fallback to template data if real data not available
		print("Falling back to template data", file=sys.stderr)
		return get_template_data_fallback(game_id, date_str, away_code, home_code, game_number)
		
	except Exception as e:
		print(f"Error loading real game data: {e}", file=sys.stderr)
		import traceback
		traceback.print_exc()
		# Return fallback data
		return get_template_data_fallback(game_id, date_str, away_code, home_code, game_number)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        game_id_arg = sys.argv[1]
        data = get_detailed_game_data(game_id_arg)
        if data:
            print(json.dumps(data, indent=2))
    else:
        print(json.dumps({"error": "No game ID provided", "code": 1}))
        sys.exit(1)
