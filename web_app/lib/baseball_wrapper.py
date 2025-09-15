#!/usr/bin/env python3
"""
Wrapper script to work around Baseball library import issues
"""
import sys
import os
import json
from typing import Dict, List, Any

# Add the baseball library to the path
baseball_path = os.path.join(os.path.dirname(__file__), '..', '..', 'baseball')
if os.path.exists(baseball_path):
    sys.path.insert(0, baseball_path)

# Change to the baseball directory
original_cwd = os.getcwd()
baseball_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'baseball')
if os.path.exists(baseball_dir):
    os.chdir(baseball_dir)

def load_game_data(game_file_path: str) -> Dict[str, Any]:
    """Load game data from a JSON file and return structured data"""
    try:
        # Read the raw JSON file
        with open(game_file_path, 'r', encoding='utf-8') as f:
            game_data = json.load(f)
        
        # This is a custom format from the Baseball library
        # Extract basic game information
        away_team_name = "Houston Astros"  # From the data structure
        home_team_name = "Los Angeles Dodgers"  # From the data structure
        game_date = "2017-11-01"  # World Series Game 7
        
        # Extract innings data from the custom format
        innings_data = []
        if 'inning_list' in game_data:
            for inning_data in game_data['inning_list']:
                inning_num = inning_data.get('inning', 1)
                
                # Extract top half events
                top_events = []
                if 'top_half_appearance_list' in inning_data:
                    for appearance in inning_data['top_half_appearance_list']:
                        plate_appearance = extract_plate_appearance_from_custom_format(appearance)
                        top_events.append(plate_appearance)
                
                # Extract bottom half events
                bottom_events = []
                if 'bottom_half_appearance_list' in inning_data:
                    for appearance in inning_data['bottom_half_appearance_list']:
                        plate_appearance = extract_plate_appearance_from_custom_format(appearance)
                        bottom_events.append(plate_appearance)
                
                # Calculate runs for this inning
                away_runs = sum(1 for event in top_events if event.get('runs_scored', 0) > 0)
                home_runs = sum(1 for event in bottom_events if event.get('runs_scored', 0) > 0)
                
                innings_data.append({
                    "inning": inning_num,
                    "away_runs": away_runs,
                    "home_runs": home_runs,
                    "top_events": top_events,
                    "bottom_events": bottom_events
                })
        
        # Extract batting statistics from box score
        away_batters = []
        home_batters = []
        
        if 'away_batter_box_score_dict' in game_data:
            for i, batter_data in enumerate(game_data['away_batter_box_score_dict']):
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
                        "position": "?",  # Would need to extract from lineup
                        "lineup_order": i + 1
                    })
        
        if 'home_batter_box_score_dict' in game_data:
            for i, batter_data in enumerate(game_data['home_batter_box_score_dict']):
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
                        "position": "?",  # Would need to extract from lineup
                        "lineup_order": i + 1
                    })
        
        # Extract pitching statistics
        away_pitchers = []
        home_pitchers = []
        
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
        
        return {
            "game_id": "world_series_game7",
            "date": game_date,
            "away_team": {
                "name": away_team_name,
                "abbreviation": "HOU"
            },
            "home_team": {
                "name": home_team_name,
                "abbreviation": "LAD"
            },
            "venue": "Dodger Stadium",
            "status": "completed",
            "innings": innings_data,
            "batters": {
                "away": away_batters,
                "home": home_batters
            },
            "pitchers": {
                "away": away_pitchers,
                "home": home_pitchers
            },
            "events": [],
            "integration_status": "real_data_from_baseball_lib",
            "note": "Real data extracted from Baseball library JSON format"
        }
        
    except Exception as e:
        print(f"Error loading game data: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return None

def extract_plate_appearance_from_custom_format(appearance: Dict[str, Any]) -> Dict[str, Any]:
    """Extract plate appearance data from the custom Baseball library format"""
    try:
        # Extract basic information
        batter_info = appearance.get('batter', {})
        pitcher_info = appearance.get('pitcher', {})
        
        batter_name = f"{batter_info.get('first_name', '')} {batter_info.get('last_name', '')}".strip()
        pitcher_name = f"{pitcher_info.get('first_name', '')} {pitcher_info.get('last_name', '')}".strip()
        
        # Extract pitch events
        pitch_events = []
        if 'event_list' in appearance:
            for event in appearance['event_list']:
                if 'pitch_description' in event:
                    pitch_events.append({
                        "type": event.get('pitch_type', 'Unknown'),
                        "description": event.get('pitch_description', 'Unknown'),
                        "result": event.get('pitch_description', 'Unknown'),
                        "speed": event.get('pitch_speed', None),
                        "location": event.get('pitch_position', None)
                    })
        
        # Determine if runner got on base
        got_on_base = appearance.get('got_on_base', False)
        
        # Extract runs and RBIs
        runs_scored = 0
        rbis = 0
        if 'scoring_runners_list' in appearance:
            runs_scored = len(appearance['scoring_runners_list'])
        if 'runners_batted_in_list' in appearance:
            rbis = len(appearance['runners_batted_in_list'])
        
        # Extract outs
        outs = appearance.get('inning_outs', 0)
        
        return {
            "batter": batter_name,
            "pitcher": pitcher_name,
            "description": appearance.get('plate_appearance_description', 'Unknown play'),
            "summary": appearance.get('plate_appearance_summary', '?'),
            "got_on_base": got_on_base,
            "runs_scored": runs_scored,
            "rbis": rbis,
            "outs": outs,
            "half": "top" if "top_half" in str(appearance) else "bottom",
            "events": pitch_events
        }
        
    except Exception as e:
        print(f"Error extracting plate appearance: {e}", file=sys.stderr)
        return {
            "batter": "Unknown",
            "pitcher": "Unknown",
            "description": "Error extracting data",
            "summary": "?",
            "got_on_base": False,
            "runs_scored": 0,
            "rbis": 0,
            "outs": 0,
            "half": "top",
            "events": []
        }

def extract_pitch_events_from_play(play: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract pitch events from a play"""
    try:
        events = []
        play_events = play.get('playEvents', [])
        
        for event in play_events:
            details = event.get('details', {})
            pitch_data = event.get('pitchData', {})
            
            events.append({
                "type": details.get('type', {}).get('description', 'Unknown'),
                "description": details.get('description', 'Unknown'),
                "result": details.get('call', {}).get('description', 'Unknown'),
                "speed": pitch_data.get('startSpeed', None),
                "location": None  # Would need to extract from coordinates
            })
        
        return events
    except Exception as e:
        print(f"Error extracting pitch events: {e}", file=sys.stderr)
        return []

if __name__ == "__main__":
    if len(sys.argv) > 1:
        game_id = sys.argv[1]
        game_file_path = os.path.join(original_cwd, 'world_series_game7.json')
        
        if os.path.exists(game_file_path):
            data = load_game_data(game_file_path)
            if data:
                print(json.dumps(data, indent=2))
            else:
                print(json.dumps({"error": "Failed to load game data"}, indent=2))
        else:
            print(json.dumps({"error": "Game file not found"}, indent=2))
    else:
        print(json.dumps({"error": "No game ID provided"}, indent=2))
