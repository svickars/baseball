#!/usr/bin/env python3
"""
Integration script to get detailed game data using the baseball library.
This script fetches real game data from the MLB API and formats it for the frontend.
"""

import sys
import os
import json
from datetime import datetime, date
from typing import Dict, List, Any, Optional

# Add the parent directory to the path to import the baseball library
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

try:
    from baseball.fetch_game import get_game_from_url
    BASEBALL_LIBRARY_AVAILABLE = True
    print("Baseball library imported successfully", file=sys.stderr)
except ImportError as e:
    BASEBALL_LIBRARY_AVAILABLE = False
    print(f"Baseball library not available: {e}", file=sys.stderr)

def get_detailed_game_data_from_json(game_id: str) -> Dict[str, Any]:
    """Get detailed game data using the baseball library"""
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
        
        if BASEBALL_LIBRARY_AVAILABLE:
            # Use the baseball library to get real game data
            try:
                game_id_result, game = get_game_from_url(date_str, away_code, home_code, game_number)
                
                if game:
                    print(f"Successfully loaded game from baseball library", file=sys.stderr)
                    return extract_detailed_data_from_baseball_library(game, game_id, date_str, away_code, home_code)
                else:
                    print("Game not found in baseball library", file=sys.stderr)
            except Exception as e:
                print(f"Error using baseball library: {e}", file=sys.stderr)
        
        # Fallback to mock data if baseball library fails
        print("Falling back to mock data", file=sys.stderr)
        return get_basic_fallback_data(game_id, date_str, away_code, home_code)
            
    except Exception as e:
        print(f"Error loading game data: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
    
    # Final fallback
    parts = game_id.split('-')
    if len(parts) >= 6:
        date_str = f"{parts[0]}-{parts[1]}-{parts[2]}"
        away_code = parts[3]
        home_code = parts[4]
        return get_basic_fallback_data(game_id, date_str, away_code, home_code)
    else:
        return {"error": "Invalid game ID format", "success": False}

def extract_detailed_data_from_baseball_library(game, game_id: str, date_str: str, away_code: str, home_code: str) -> Dict[str, Any]:
    """Extract detailed data from the baseball library game object"""
    try:
        # Get game JSON data
        game_json = game.json()
        game_data = json.loads(game_json)
        
        # Extract team information
        away_team_name = game_data.get('away_team', {}).get('name', f"{away_code} Team")
        home_team_name = game_data.get('home_team', {}).get('name', f"{home_code} Team")
        venue = game_data.get('venue', f"{home_code} Stadium")
        
        print(f"Away team: {away_team_name}", file=sys.stderr)
        print(f"Home team: {home_team_name}", file=sys.stderr)
        
        # Build inning data
        inning_list = []
        if 'inning_list' in game_data:
            for i, inning_info in enumerate(game_data['inning_list']):
                inning_num = i + 1  # Use index + 1 for proper inning numbering
                
                # Count runs from appearances in this inning
                away_runs = 0
                home_runs = 0
                
                # Count runs from top half (away team)
                for appearance in inning_info.get('top_half_appearance_list', []):
                    if 'scoring_runners_list' in appearance and appearance['scoring_runners_list']:
                        away_runs += len(appearance['scoring_runners_list'])
                
                # Count runs from bottom half (home team)
                for appearance in inning_info.get('bottom_half_appearance_list', []):
                    if 'scoring_runners_list' in appearance and appearance['scoring_runners_list']:
                        home_runs += len(appearance['scoring_runners_list'])
                
                # Extract detailed events from plate appearances
                top_events = []
                bottom_events = []
                
                # Process top half appearances (away team)
                for appearance in inning_info.get('top_half_appearance_list', []):
                    event_data = extract_plate_appearance_data(appearance, 'top')
                    top_events.append(event_data)
                
                # Process bottom half appearances (home team)
                for appearance in inning_info.get('bottom_half_appearance_list', []):
                    event_data = extract_plate_appearance_data(appearance, 'bottom')
                    bottom_events.append(event_data)
                
                inning_list.append({
                    "inning": inning_num,
                    "away_runs": away_runs,
                    "home_runs": home_runs,
                    "top_events": top_events,
                    "bottom_events": bottom_events
                })
        
        # Extract player statistics
        away_batters = []
        home_batters = []
        away_pitchers = []
        home_pitchers = []
        
        # Get batter stats
        if 'away_batter_box_score_dict' in game_data:
            for batter_data in game_data['away_batter_box_score_dict']:
                if len(batter_data) >= 2 and isinstance(batter_data[0], dict):
                    player_info = batter_data[0]
                    stats = batter_data[1]
                    
                    away_batters.append({
                        "name": f"{player_info.get('first_name', '')} {player_info.get('last_name', '')}".strip(),
                        "at_bats": stats.get('AB', 0),
                        "hits": stats.get('H', 0),
                        "runs": stats.get('R', 0),
                        "rbis": stats.get('RBI', 0),
                        "average": f"{player_info.get('obp', 0):.3f}",
                        "position": "?",
                        "lineup_order": len(away_batters) + 1
                    })
        
        if 'home_batter_box_score_dict' in game_data:
            for batter_data in game_data['home_batter_box_score_dict']:
                if len(batter_data) >= 2 and isinstance(batter_data[0], dict):
                    player_info = batter_data[0]
                    stats = batter_data[1]
                    
                    home_batters.append({
                        "name": f"{player_info.get('first_name', '')} {player_info.get('last_name', '')}".strip(),
                        "at_bats": stats.get('AB', 0),
                        "hits": stats.get('H', 0),
                        "runs": stats.get('R', 0),
                        "rbis": stats.get('RBI', 0),
                        "average": f"{player_info.get('obp', 0):.3f}",
                        "position": "?",
                        "lineup_order": len(home_batters) + 1
                    })
        
        # Get pitcher stats
        if 'away_pitcher_box_score_dict' in game_data:
            for pitcher_data in game_data['away_pitcher_box_score_dict']:
                if len(pitcher_data) >= 2 and isinstance(pitcher_data[0], dict):
                    player_info = pitcher_data[0]
                    stats = pitcher_data[1]
                    
                    away_pitchers.append({
                        "name": f"{player_info.get('first_name', '')} {player_info.get('last_name', '')}".strip(),
                        "innings_pitched": float(stats.get('IP', 0.0)),
                        "hits": stats.get('H', 0),
                        "runs": stats.get('R', 0),
                        "earned_runs": stats.get('ER', 0),
                        "walks": stats.get('BB', 0),
                        "strikeouts": stats.get('SO', 0),
                        "era": f"{player_info.get('era', 0.00)}"
                    })
        
        if 'home_pitcher_box_score_dict' in game_data:
            for pitcher_data in game_data['home_pitcher_box_score_dict']:
                if len(pitcher_data) >= 2 and isinstance(pitcher_data[0], dict):
                    player_info = pitcher_data[0]
                    stats = pitcher_data[1]
                    
                    home_pitchers.append({
                        "name": f"{player_info.get('first_name', '')} {player_info.get('last_name', '')}".strip(),
                        "innings_pitched": float(stats.get('IP', 0.0)),
                        "hits": stats.get('H', 0),
                        "runs": stats.get('R', 0),
                        "earned_runs": stats.get('ER', 0),
                        "walks": stats.get('BB', 0),
                        "strikeouts": stats.get('SO', 0),
                        "era": f"{player_info.get('era', 0.00)}"
                    })
        
        # Calculate total runs
        total_away_runs = sum(inning['away_runs'] for inning in inning_list)
        total_home_runs = sum(inning['home_runs'] for inning in inning_list)
        
        result = {
            "game_id": game_id,
            "date": date_str,
            "away_team": {
                "name": away_team_name,
                "abbreviation": away_code
            },
            "home_team": {
                "name": home_team_name,
                "abbreviation": home_code
            },
            "venue": venue,
            "status": "completed",
            "innings": inning_list,
            "batters": {
                "away": away_batters,
                "home": home_batters
            },
            "pitchers": {
                "away": away_pitchers,
                "home": home_pitchers
            },
            "events": [],
            "integration_status": "real_baseball_library_data",
            "note": f"Real data from baseball library for {away_code} @ {home_code} on {date_str}",
            "total_away_runs": total_away_runs,
            "total_home_runs": total_home_runs
        }
        
        print(f"Successfully extracted baseball library data: {away_code} {total_away_runs} - {home_code} {total_home_runs}", file=sys.stderr)
        return result
        
    except Exception as e:
        print(f"Error extracting data from baseball library: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return None

def extract_plate_appearance_data(appearance: Dict[str, Any], half: str = 'top') -> Dict[str, Any]:
    """Extract detailed plate appearance data including pitch-by-pitch information"""
    try:
        # Get batter and pitcher info
        batter_info = appearance.get('batter', {})
        pitcher_info = appearance.get('pitcher', {})
        
        batter_name = f"{batter_info.get('first_name', '')} {batter_info.get('last_name', '')}".strip()
        pitcher_name = f"{pitcher_info.get('first_name', '')} {pitcher_info.get('last_name', '')}".strip()
        
        # Extract pitch-by-pitch data
        pitch_events = []
        for event in appearance.get('event_list', []):
            pitch_data = {
                "type": event.get('pitch_type', 'Unknown'),
                "description": event.get('pitch_description', 'Unknown'),
                "result": event.get('pitch_description', 'Unknown'),
                "speed": event.get('pitch_speed', None),
                "location": event.get('pitch_position', None),
                "datetime": event.get('pitch_datetime', None)
            }
            pitch_events.append(pitch_data)
        
        # Get scoring runners and RBIs
        scoring_runners = appearance.get('scoring_runners_list', [])
        runners_batted_in = appearance.get('runners_batted_in_list', [])
        out_runners = appearance.get('out_runners_list', [])
        
        return {
            "batter": batter_name,
            "batter_number": batter_info.get('number', ''),
            "pitcher": pitcher_name,
            "pitcher_number": pitcher_info.get('number', ''),
            "description": appearance.get('plate_appearance_description', 'Unknown play'),
            "summary": appearance.get('plate_appearance_summary', '?'),
            "scorecard_summary": appearance.get('scorecard_summary', '?'),
            "got_on_base": appearance.get('got_on_base', False),
            "runs_scored": len(scoring_runners),
            "rbis": len(runners_batted_in),
            "outs": appearance.get('inning_outs', 0),
            "half": half,
            "hit_location": appearance.get('hit_location', None),
            "error_str": appearance.get('error_str', None),
            "start_datetime": appearance.get('start_datetime', None),
            "end_datetime": appearance.get('end_datetime', None),
            "events": pitch_events,
            "scoring_runners": [f"{runner.get('first_name', '')} {runner.get('last_name', '')}".strip() for runner in scoring_runners],
            "runners_batted_in": [f"{runner.get('first_name', '')} {runner.get('last_name', '')}".strip() for runner in runners_batted_in],
            "out_runners": out_runners
        }
        
    except Exception as e:
        print(f"Error extracting plate appearance data: {e}", file=sys.stderr)
        return {
            "batter": "Unknown",
            "batter_number": "",
            "pitcher": "Unknown", 
            "pitcher_number": "",
            "description": "Unknown play",
            "summary": "?",
            "scorecard_summary": "?",
            "got_on_base": False,
            "runs_scored": 0,
            "rbis": 0,
            "outs": 0,
            "half": half,
            "hit_location": None,
            "error_str": None,
            "start_datetime": None,
            "end_datetime": None,
            "events": [],
            "scoring_runners": [],
            "runners_batted_in": [],
            "out_runners": []
        }

def extract_detailed_data_from_json(game_data: Dict[str, Any], game_id: str, date_str: str, away_code: str, home_code: str) -> Dict[str, Any]:
    """Extract detailed data from the world_series_game7.json structure"""
    try:
        # Get basic game info
        away_team_name = "Houston Astros"  # From the JSON data
        home_team_name = "Los Angeles Dodgers"  # From the JSON data
        venue = "Dodger Stadium"
        
        print(f"Away team: {away_team_name}", file=sys.stderr)
        print(f"Home team: {home_team_name}", file=sys.stderr)
        
        # Build inning data with detailed events
        inning_list = []
        processed_innings = set()  # Track which innings we've already processed
        if 'inning_list' in game_data:
            for inning_info in game_data['inning_list']:
                inning_num = inning_info.get('inning', 1)
                
                # Skip if we've already processed this inning
                if inning_num in processed_innings:
                    continue
                    
                processed_innings.add(inning_num)
                print(f"Processing inning {inning_num}", file=sys.stderr)
                
                top_events = []
                bottom_events = []
                
                # Extract top half events
                if 'top_half_appearance_list' in inning_info:
                    for appearance in inning_info['top_half_appearance_list']:
                        pa_data = extract_plate_appearance_data(appearance)
                        top_events.append(pa_data)
                
                # Extract bottom half events
                if 'bottom_half_appearance_list' in inning_info:
                    for appearance in inning_info['bottom_half_appearance_list']:
                        pa_data = extract_plate_appearance_data(appearance)
                        bottom_events.append(pa_data)
                
                # Get inning stats
                top_stats = inning_info.get('top_half_inning_stats', [0, 0, 0, 0, 0, 0, 0, 0])
                bottom_stats = inning_info.get('bottom_half_inning_stats', [0, 0, 0, 0, 0, 0, 0, 0])
                
                # First element is runs
                away_runs = top_stats[0] if len(top_stats) > 0 else 0
                home_runs = bottom_stats[0] if len(bottom_stats) > 0 else 0
                
                inning_list.append({
                    "inning": inning_num,
                    "away_runs": away_runs,
                    "home_runs": home_runs,
                    "top_events": top_events,
                    "bottom_events": bottom_events
                })
        
        # Extract player statistics
        away_batters = []
        home_batters = []
        away_pitchers = []
        home_pitchers = []
        
        # Get batter stats
        if 'away_batter_box_score_dict' in game_data:
            for batter_data in game_data['away_batter_box_score_dict']:
                if len(batter_data) >= 2 and isinstance(batter_data[0], dict):
                    player_info = batter_data[0]
                    stats = batter_data[1]
                    
                    away_batters.append({
                        "name": f"{player_info.get('first_name', '')} {player_info.get('last_name', '')}".strip(),
                        "at_bats": stats.get('AB', 0),
                        "hits": stats.get('H', 0),
                        "runs": stats.get('R', 0),
                        "rbis": stats.get('RBI', 0),
                        "average": f"{player_info.get('obp', 0):.3f}",
                        "position": "?",
                        "lineup_order": len(away_batters) + 1
                    })
        
        if 'home_batter_box_score_dict' in game_data:
            for batter_data in game_data['home_batter_box_score_dict']:
                if len(batter_data) >= 2 and isinstance(batter_data[0], dict):
                    player_info = batter_data[0]
                    stats = batter_data[1]
                    
                    home_batters.append({
                        "name": f"{player_info.get('first_name', '')} {player_info.get('last_name', '')}".strip(),
                        "at_bats": stats.get('AB', 0),
                        "hits": stats.get('H', 0),
                        "runs": stats.get('R', 0),
                        "rbis": stats.get('RBI', 0),
                        "average": f"{player_info.get('obp', 0):.3f}",
                        "position": "?",
                        "lineup_order": len(home_batters) + 1
                    })
        
        # Get pitcher stats
        if 'away_pitcher_box_score_dict' in game_data:
            for pitcher_data in game_data['away_pitcher_box_score_dict']:
                if len(pitcher_data) >= 2 and isinstance(pitcher_data[0], dict):
                    player_info = pitcher_data[0]
                    stats = pitcher_data[1]
                    
                    away_pitchers.append({
                        "name": f"{player_info.get('first_name', '')} {player_info.get('last_name', '')}".strip(),
                        "innings_pitched": float(stats.get('IP', 0.0)),
                        "hits": stats.get('H', 0),
                        "runs": stats.get('R', 0),
                        "earned_runs": stats.get('ER', 0),
                        "walks": stats.get('BB', 0),
                        "strikeouts": stats.get('SO', 0),
                        "era": f"{player_info.get('era', 0.00)}"
                    })
        
        if 'home_pitcher_box_score_dict' in game_data:
            for pitcher_data in game_data['home_pitcher_box_score_dict']:
                if len(pitcher_data) >= 2 and isinstance(pitcher_data[0], dict):
                    player_info = pitcher_data[0]
                    stats = pitcher_data[1]
                    
                    home_pitchers.append({
                        "name": f"{player_info.get('first_name', '')} {player_info.get('last_name', '')}".strip(),
                        "innings_pitched": float(stats.get('IP', 0.0)),
                        "hits": stats.get('H', 0),
                        "runs": stats.get('R', 0),
                        "earned_runs": stats.get('ER', 0),
                        "walks": stats.get('BB', 0),
                        "strikeouts": stats.get('SO', 0),
                        "era": f"{player_info.get('era', 0.00)}"
                    })
        
        # Calculate total runs
        total_away_runs = sum(inning['away_runs'] for inning in inning_list)
        total_home_runs = sum(inning['home_runs'] for inning in inning_list)
        
        result = {
            "game_id": game_id,
            "date": date_str,
            "away_team": {
                "name": away_team_name,
                "abbreviation": away_code
            },
            "home_team": {
                "name": home_team_name,
                "abbreviation": home_code
            },
            "venue": venue,
            "status": "completed",
            "innings": inning_list,
            "batters": {
                "away": away_batters,
                "home": home_batters
            },
            "pitchers": {
                "away": away_pitchers,
                "home": home_pitchers
            },
            "events": [],
            "integration_status": "real_json_data",
            "note": f"Real detailed data from JSON file for {away_code} @ {home_code} on {date_str}",
            "total_away_runs": total_away_runs,
            "total_home_runs": total_home_runs
        }
        
        print(f"Successfully extracted JSON data: {away_code} {total_away_runs} - {home_code} {total_home_runs}", file=sys.stderr)
        return result
        
    except Exception as e:
        print(f"Error extracting data from JSON: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return None


def get_basic_fallback_data(game_id: str, date_str: str, away_code: str, home_code: str) -> Dict[str, Any]:
    """Basic fallback data if JSON parsing fails"""
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
        "integration_status": "fallback_data",
        "note": "Fallback data due to JSON parsing failure"
    }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        game_id_arg = sys.argv[1]
        data = get_detailed_game_data_from_json(game_id_arg)
        if data:
            print(json.dumps(data, indent=2))
    else:
        print(json.dumps({"error": "No game ID provided", "code": 1}))
        sys.exit(1)
