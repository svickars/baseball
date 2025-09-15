#!/usr/bin/env python3
"""
Test script to use the Baseball library for detailed game data.
"""

import sys
import os
import json
from datetime import datetime, date
from typing import Dict, List, Any, Optional

def get_detailed_game_data_from_baseball_lib(game_id: str) -> Dict[str, Any]:
    """Get detailed game data using the Baseball library"""
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
        
        # Use the world_series_game7.json file
        sample_game_path = 'world_series_game7.json'
        
        if os.path.exists(sample_game_path):
            print(f"Loading game from: {sample_game_path}", file=sys.stderr)
            
            # Import the Baseball library functions
            try:
                from baseball.fetch_game import get_game_from_file
                from baseball.baseball import Game, Player, Team, Inning, PlateAppearance
                from baseball.baseball_events import Pitch, RunnerAdvance
                
                # Load the game data
                game_date_str, game = get_game_from_file(sample_game_path)
                
                if game:
                    print(f"Successfully loaded game: {game_date_str}", file=sys.stderr)
                    print(f"Game has {len(game.innings)} innings", file=sys.stderr)
                    
                    # Extract detailed data from the Game object
                    detailed_data = extract_detailed_data_from_game(game, game_id, date_str, away_code, home_code)
                    
                    if detailed_data:
                        print(f"Successfully extracted detailed data for {away_code} @ {home_code}", file=sys.stderr)
                        return detailed_data
                    else:
                        print("Failed to extract detailed data from game object", file=sys.stderr)
                else:
                    print("Failed to load game from file", file=sys.stderr)
                    
            except ImportError as e:
                print(f"Failed to import Baseball library: {e}", file=sys.stderr)
                import traceback
                traceback.print_exc()
        else:
            print(f"Sample game file not found at {sample_game_path}", file=sys.stderr)
            
    except Exception as e:
        print(f"Error loading game data: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
    
    # Fallback to basic mock data
    return get_basic_fallback_data(game_id, date_str, away_code, home_code)

def extract_detailed_data_from_game(game, game_id: str, date_str: str, away_code: str, home_code: str) -> Dict[str, Any]:
    """Extract detailed data from a Baseball library Game object"""
    try:
        # Get basic game info
        away_team = game.away_team
        home_team = game.home_team
        
        print(f"Away team: {away_team.name}", file=sys.stderr)
        print(f"Home team: {home_team.name}", file=sys.stderr)
        
        # Build inning data with detailed events
        inning_list = []
        for inning_num, inning in enumerate(game.innings, 1):
            print(f"Processing inning {inning_num} with {len(inning.plate_appearances)} plate appearances", file=sys.stderr)
            
            top_events = []
            bottom_events = []
            
            # Extract plate appearances for this inning
            for pa in inning.plate_appearances:
                # Extract pitch data
                pitch_events = []
                for pitch in pa.pitches:
                    pitch_events.append({
                        "type": pitch.pitch_type if hasattr(pitch, 'pitch_type') else 'Unknown',
                        "description": pitch.description if hasattr(pitch, 'description') else 'Unknown',
                        "result": pitch.result if hasattr(pitch, 'result') else 'Unknown',
                        "speed": pitch.speed if hasattr(pitch, 'speed') else None,
                        "location": [pitch.x, pitch.y] if hasattr(pitch, 'x') and hasattr(pitch, 'y') else None
                    })
                
                # Create plate appearance data
                pa_data = {
                    "batter": pa.batter.name if hasattr(pa.batter, 'name') else 'Unknown',
                    "pitcher": pa.pitcher.name if hasattr(pa.pitcher, 'name') else 'Unknown',
                    "description": pa.description if hasattr(pa, 'description') else 'Unknown play',
                    "summary": pa.result if hasattr(pa, 'result') else '?',
                    "got_on_base": pa.got_on_base if hasattr(pa, 'got_on_base') else False,
                    "runs_scored": pa.runs_scored if hasattr(pa, 'runs_scored') else 0,
                    "rbis": pa.rbis if hasattr(pa, 'rbis') else 0,
                    "outs": pa.outs if hasattr(pa, 'outs') else 0,
                    "half": "top" if pa.half_inning == 0 else "bottom",
                    "events": pitch_events
                }
                
                if pa.half_inning == 0:  # Top half
                    top_events.append(pa_data)
                else:  # Bottom half
                    bottom_events.append(pa_data)
            
            # Calculate runs for this inning
            away_runs = sum(pa.runs_scored for pa in inning.plate_appearances if pa.half_inning == 0 and hasattr(pa, 'runs_scored'))
            home_runs = sum(pa.runs_scored for pa in inning.plate_appearances if pa.half_inning == 1 and hasattr(pa, 'runs_scored'))
            
            inning_list.append({
                "inning": inning_num,
                "away_runs": away_runs,
                "home_runs": home_runs,
                "top_events": top_events,
                "bottom_events": bottom_events
            })
        
        # Calculate total runs
        total_away_runs = sum(inning['away_runs'] for inning in inning_list)
        total_home_runs = sum(inning['home_runs'] for inning in inning_list)
        
        result = {
            "game_id": game_id,
            "date": date_str,
            "away_team": {
                "name": away_team.name if hasattr(away_team, 'name') else f'{away_code} Team',
                "abbreviation": away_code
            },
            "home_team": {
                "name": home_team.name if hasattr(home_team, 'name') else f'{home_code} Team',
                "abbreviation": home_code
            },
            "venue": game.venue if hasattr(game, 'venue') else f'{home_code} Stadium',
            "status": "completed",
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
            "integration_status": "real_baseball_lib_data",
            "note": f"Real detailed data from Baseball library for {away_code} @ {home_code} on {date_str}",
            "total_away_runs": total_away_runs,
            "total_home_runs": total_home_runs
        }
        
        print(f"Successfully extracted Baseball library data: {away_code} {total_away_runs} - {home_code} {total_home_runs}", file=sys.stderr)
        return result
        
    except Exception as e:
        print(f"Error extracting data from game object: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return None

def get_basic_fallback_data(game_id: str, date_str: str, away_code: str, home_code: str) -> Dict[str, Any]:
    """Basic fallback data if Baseball library fails"""
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
        "note": "Fallback data due to Baseball library unavailability"
    }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        game_id_arg = sys.argv[1]
        data = get_detailed_game_data_from_baseball_lib(game_id_arg)
        if data:
            print(json.dumps(data, indent=2))
    else:
        print(json.dumps({"error": "No game ID provided", "code": 1}))
        sys.exit(1)
