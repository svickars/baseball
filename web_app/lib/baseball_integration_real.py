#!/usr/bin/env python3
"""
Integration script to fetch real game data from MLB API for the modern scorecard interface.
"""

import sys
import os
import json
import urllib.request
import urllib.parse
from datetime import datetime, date
from typing import Dict, List, Any, Optional

def get_game_pk_from_schedule(date_str: str, away_code: str, home_code: str, game_number: int) -> Optional[int]:
    """Get gamePk from MLB schedule API"""
    try:
        # Parse date
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        month = date_obj.month
        day = date_obj.day
        year = date_obj.year
        
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

def get_mlb_game_details_from_schedule(game_pk: int, game_id: str, date_str: str, away_code: str, home_code: str) -> Optional[Dict[str, Any]]:
    """Get game data from MLB schedule API (includes scores and basic info)"""
    try:
        # Parse date for schedule API
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        month = date_obj.month
        day = date_obj.day
        year = date_obj.year
        
        # Fetch from MLB schedule API
        url = f'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date={month}/{day}/{year}'
        print(f"Fetching schedule data from: {url}", file=sys.stderr)
        
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
        
        # Find the specific game
        game_data = None
        if data.get('dates') and len(data['dates']) > 0:
            games = data['dates'][0].get('games', [])
            for game in games:
                if game.get('gamePk') == game_pk:
                    game_data = game
                    break
        
        if not game_data:
            print(f"Game data not found in schedule for gamePk {game_pk}", file=sys.stderr)
            return None
        
        # Extract data from schedule
        teams = game_data.get('teams', {})
        away_team = teams.get('away', {})
        home_team = teams.get('home', {})
        status = game_data.get('status', {})
        venue = game_data.get('venue', {})
        
        # Get scores
        away_score = away_team.get('score', 0)
        home_score = home_team.get('score', 0)
        
        # Create basic inning data (we don't have inning-by-inning from schedule)
        # For now, we'll create a simple structure showing the final score
        inning_list = []
        for i in range(9):  # Standard 9 innings
            inning_list.append({
                "inning": i + 1,
                "away_runs": 0,  # We don't have inning-by-inning data from schedule
                "home_runs": 0,
                "top_events": [],
                "bottom_events": []
            })
        
        # Add the final score to the last inning (this is a workaround)
        if inning_list:
            inning_list[-1]["away_runs"] = away_score
            inning_list[-1]["home_runs"] = home_score
        
        result = {
            "game_id": game_id,
            "date": date_str,
            "away_team": {
                "name": away_team.get('team', {}).get('name', f'{away_code} Team'),
                "abbreviation": away_code
            },
            "home_team": {
                "name": home_team.get('team', {}).get('name', f'{home_code} Team'),
                "abbreviation": home_code
            },
            "venue": venue.get('name', f'{home_code} Stadium'),
            "status": status.get('detailedState', 'Unknown'),
            "innings": inning_list,
            "batters": {
                "away": [],
                "home": []
            },
            "pitchers": {
                "away": [],
                "home": []
            },
            "events": [],
            "integration_status": "real_mlb_schedule_data",
            "note": f"Real scores from MLB schedule API for {away_code} @ {home_code} on {date_str}",
            "total_away_runs": away_score,
            "total_home_runs": home_score
        }
        
        print(f"Successfully parsed MLB schedule data: {away_code} {away_score} - {home_code} {home_score}", file=sys.stderr)
        return result
        
    except Exception as e:
        print(f"Error fetching MLB schedule data: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return None

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
            # Get game data from MLB schedule API (includes real scores)
            detailed_data = get_mlb_game_details_from_schedule(game_pk, game_id, date_str, away_code, home_code)
            if detailed_data:
                print(f"Successfully fetched real game data for {away_code} @ {home_code}", file=sys.stderr)
                return detailed_data
            else:
                print("Failed to fetch game data from MLB schedule API", file=sys.stderr)
        else:
            print(f"Could not find gamePk for {away_code} @ {home_code} on {date_str}", file=sys.stderr)
        
        # Fallback to basic mock data if real data not available
        print("Falling back to basic mock data", file=sys.stderr)
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
        
    except Exception as e:
        print(f"Error loading real game data: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        # Return basic fallback data
        return {
            "game_id": game_id,
            "date": "2025-09-14",
            "away_team": {"name": "Unknown Team", "abbreviation": "UNK"},
            "home_team": {"name": "Unknown Team", "abbreviation": "UNK"},
            "venue": "Unknown Stadium",
            "status": "completed",
            "innings": [],
            "batters": {"away": [], "home": []},
            "pitchers": {"away": [], "home": []},
            "events": [],
            "integration_status": "error_fallback",
            "note": "Error fallback data"
        }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        game_id_arg = sys.argv[1]
        data = get_detailed_game_data(game_id_arg)
        if data:
            print(json.dumps(data, indent=2))
    else:
        print(json.dumps({"error": "No game ID provided", "code": 1}))
        sys.exit(1)
