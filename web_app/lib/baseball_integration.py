#!/usr/bin/env python3
"""
Integration script to bridge the Next.js app with the existing Baseball library.
This script provides detailed game data for the modern scorecard interface.
"""

import sys
import os
import json
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

# Import the Baseball library
try:
    from baseball import get_game_from_url, get_game_from_file
    from baseball.generate_svg import get_game_svg_str
    from baseball.stats import get_all_pitcher_stats, get_all_batter_stats
    BASEBALL_LIB_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Baseball library not available: {e}", file=sys.stderr)
    BASEBALL_LIB_AVAILABLE = False

def get_mlb_game_url(game_id: str) -> str:
    """Convert game ID to MLB API URL"""
    # Parse game ID: YYYY-MM-DD-AWAY-HOME-GAME_NUMBER
    parts = game_id.split('-')
    if len(parts) < 6:
        raise ValueError("Invalid game ID format")
    
    date_str = f"{parts[0]}-{parts[1]}-{parts[2]}"
    away_code = parts[3]
    home_code = parts[4]
    
    # For now, we'll use a placeholder URL structure
    # In a real implementation, you'd need to map team codes to game IDs
    return f"https://statsapi.mlb.com/api/v1/game/{game_id}/feed/live"

def extract_game_data(game) -> Dict[str, Any]:
    """Extract structured data from a Baseball library game object"""
    try:
        # Basic game info
        game_data = {
            "game_id": getattr(game, 'game_id', 'unknown'),
            "date": getattr(game, 'game_date_str', ''),
            "away_team": {
                "name": getattr(game.away_team, 'name', 'Away Team'),
                "abbreviation": getattr(game.away_team, 'abbreviation', 'AWY')
            },
            "home_team": {
                "name": getattr(game.home_team, 'name', 'Home Team'),
                "abbreviation": getattr(game.home_team, 'abbreviation', 'HOM')
            },
            "venue": getattr(game, 'venue', 'Stadium'),
            "status": "completed",  # Assume completed for now
            "innings": [],
            "batters": {"away": [], "home": []},
            "pitchers": {"away": [], "home": []},
            "events": []
        }
        
        # Extract inning data
        if hasattr(game, 'inning_list') and game.inning_list:
            for inning in game.inning_list:
                inning_data = {
                    "inning": getattr(inning, 'inning', 0),
                    "away_runs": 0,
                    "home_runs": 0,
                    "top_events": [],
                    "bottom_events": []
                }
                
                # Extract top half events
                if hasattr(inning, 'top_half_appearance_list') and inning.top_half_appearance_list:
                    for appearance in inning.top_half_appearance_list:
                        event_data = extract_appearance_data(appearance, "top")
                        inning_data["top_events"].append(event_data)
                        inning_data["away_runs"] += len(getattr(appearance, 'scoring_runners_list', []))
                
                # Extract bottom half events
                if hasattr(inning, 'bottom_half_appearance_list') and inning.bottom_half_appearance_list:
                    for appearance in inning.bottom_half_appearance_list:
                        event_data = extract_appearance_data(appearance, "bottom")
                        inning_data["bottom_events"].append(event_data)
                        inning_data["home_runs"] += len(getattr(appearance, 'scoring_runners_list', []))
                
                game_data["innings"].append(inning_data)
        
        # Extract batter statistics
        try:
            away_batters = get_all_batter_stats(game, game.away_team)
            home_batters = get_all_batter_stats(game, game.home_team)
            
            for batter in away_batters:
                game_data["batters"]["away"].append(extract_batter_stats(batter))
            
            for batter in home_batters:
                game_data["batters"]["home"].append(extract_batter_stats(batter))
        except Exception as e:
            print(f"Warning: Could not extract batter stats: {e}", file=sys.stderr)
        
        # Extract pitcher statistics
        try:
            away_pitchers = get_all_pitcher_stats(game, game.away_team)
            home_pitchers = get_all_pitcher_stats(game, game.home_team)
            
            for pitcher in away_pitchers:
                game_data["pitchers"]["away"].append(extract_pitcher_stats(pitcher))
            
            for pitcher in home_pitchers:
                game_data["pitchers"]["home"].append(extract_pitcher_stats(pitcher))
        except Exception as e:
            print(f"Warning: Could not extract pitcher stats: {e}", file=sys.stderr)
        
        return game_data
        
    except Exception as e:
        raise Exception(f"Error extracting game data: {e}")

def extract_appearance_data(appearance, half: str) -> Dict[str, Any]:
    """Extract data from a plate appearance"""
    return {
        "batter": str(getattr(appearance, 'batter', 'Unknown')),
        "pitcher": str(getattr(appearance, 'pitcher', 'Unknown')),
        "description": getattr(appearance, 'plate_appearance_description', ''),
        "summary": getattr(appearance, 'scorecard_summary', ''),
        "got_on_base": getattr(appearance, 'got_on_base', False),
        "runs_scored": len(getattr(appearance, 'scoring_runners_list', [])),
        "rbis": len(getattr(appearance, 'runners_batted_in_list', [])),
        "outs": getattr(appearance, 'inning_outs', 0),
        "half": half,
        "events": []
    }

def extract_batter_stats(batter) -> Dict[str, Any]:
    """Extract batter statistics"""
    return {
        "name": str(batter),
        "at_bats": getattr(batter, 'at_bats', 0),
        "hits": getattr(batter, 'hits', 0),
        "runs": getattr(batter, 'runs', 0),
        "rbis": getattr(batter, 'rbis', 0),
        "average": f"{getattr(batter, 'average', 0):.3f}" if hasattr(batter, 'average') else "0.000"
    }

def extract_pitcher_stats(pitcher) -> Dict[str, Any]:
    """Extract pitcher statistics"""
    return {
        "name": str(pitcher),
        "innings_pitched": getattr(pitcher, 'innings_pitched', 0),
        "hits": getattr(pitcher, 'hits', 0),
        "runs": getattr(pitcher, 'runs', 0),
        "earned_runs": getattr(pitcher, 'earned_runs', 0),
        "walks": getattr(pitcher, 'walks', 0),
        "strikeouts": getattr(pitcher, 'strikeouts', 0),
        "era": f"{getattr(pitcher, 'era', 0):.2f}" if hasattr(pitcher, 'era') else "0.00"
    }

def get_detailed_game_data(game_id: str) -> Dict[str, Any]:
    """Get detailed game data using the Baseball library"""
    try:
        if BASEBALL_LIB_AVAILABLE:
            # Try to get real game data using the Baseball library
            try:
                # For now, we'll use a sample game file if available
                # In production, you'd fetch from MLB API or use stored game files
                sample_game_path = os.path.join(original_cwd, 'world_series_game7.json')
                
                if os.path.exists(sample_game_path):
                    game = get_game_from_file(sample_game_path)
                    return extract_game_data(game)
                else:
                    print(f"Sample game file not found at {sample_game_path}", file=sys.stderr)
            except Exception as e:
                print(f"Error loading real game data: {e}", file=sys.stderr)
        
        # Enhanced mock data with realistic scorecard information
        mock_data = {
            "game_id": game_id,
            "date": "2025-09-14",
            "away_team": {
                "name": "Tampa Bay Rays",
                "abbreviation": "TB"
            },
            "home_team": {
                "name": "Chicago Cubs",
                "abbreviation": "CHC"
            },
            "venue": "Wrigley Field",
            "status": "completed",
            "innings": [
                {
                    "inning": 1,
                    "away_runs": 2,
                    "home_runs": 0,
                    "top_events": [
                        {
                            "batter": "Yandy Díaz",
                            "pitcher": "Justin Steele",
                            "description": "Single to center field",
                            "summary": "1B",
                            "got_on_base": True,
                            "runs_scored": 0,
                            "rbis": 0,
                            "outs": 0,
                            "half": "top",
                            "events": [
                                {"type": "Fastball", "description": "Called Strike", "result": "0-1"},
                                {"type": "Slider", "description": "Ball", "result": "1-1"},
                                {"type": "Fastball", "description": "In play, single", "result": "1B"}
                            ]
                        },
                        {
                            "batter": "Randy Arozarena",
                            "pitcher": "Justin Steele",
                            "description": "Home run to left field",
                            "summary": "HR",
                            "got_on_base": True,
                            "runs_scored": 1,
                            "rbis": 2,
                            "outs": 0,
                            "half": "top",
                            "events": [
                                {"type": "Fastball", "description": "Ball", "result": "1-0"},
                                {"type": "Curveball", "description": "Home run", "result": "HR"}
                            ]
                        },
                        {
                            "batter": "Isaac Paredes",
                            "pitcher": "Justin Steele",
                            "description": "Strikeout swinging",
                            "summary": "K",
                            "got_on_base": False,
                            "runs_scored": 0,
                            "rbis": 0,
                            "outs": 1,
                            "half": "top",
                            "events": [
                                {"type": "Fastball", "description": "Called Strike", "result": "0-1"},
                                {"type": "Slider", "description": "Swinging Strike", "result": "0-2"},
                                {"type": "Fastball", "description": "Swinging Strike", "result": "K"}
                            ]
                        }
                    ],
                    "bottom_events": [
                        {
                            "batter": "Nico Hoerner",
                            "pitcher": "Tyler Glasnow",
                            "description": "Ground out to shortstop",
                            "summary": "6-3",
                            "got_on_base": False,
                            "runs_scored": 0,
                            "rbis": 0,
                            "outs": 1,
                            "half": "bottom",
                            "events": [
                                {"type": "Fastball", "description": "Ball", "result": "1-0"},
                                {"type": "Curveball", "description": "Ground out", "result": "6-3"}
                            ]
                        }
                    ]
                },
                {
                    "inning": 2,
                    "away_runs": 0,
                    "home_runs": 1,
                    "top_events": [],
                    "bottom_events": [
                        {
                            "batter": "Cody Bellinger",
                            "pitcher": "Tyler Glasnow",
                            "description": "Home run to right field",
                            "summary": "HR",
                            "got_on_base": True,
                            "runs_scored": 1,
                            "rbis": 1,
                            "outs": 0,
                            "half": "bottom",
                            "events": [
                                {"type": "Fastball", "description": "Home run", "result": "HR"}
                            ]
                        }
                    ]
                }
            ],
            "batters": {
                "away": [
                    {"name": "Yandy Díaz", "at_bats": 4, "hits": 2, "runs": 1, "rbis": 0, "average": "0.285", "position": "1B", "lineup_order": 1},
                    {"name": "Randy Arozarena", "at_bats": 4, "hits": 1, "runs": 1, "rbis": 2, "average": "0.254", "position": "LF", "lineup_order": 2},
                    {"name": "Isaac Paredes", "at_bats": 4, "hits": 1, "runs": 0, "rbis": 0, "average": "0.267", "position": "3B", "lineup_order": 3},
                    {"name": "Harold Ramírez", "at_bats": 3, "hits": 1, "runs": 0, "rbis": 0, "average": "0.298", "position": "DH", "lineup_order": 4},
                    {"name": "Josh Lowe", "at_bats": 3, "hits": 0, "runs": 0, "rbis": 0, "average": "0.292", "position": "RF", "lineup_order": 5}
                ],
                "home": [
                    {"name": "Nico Hoerner", "at_bats": 4, "hits": 1, "runs": 0, "rbis": 0, "average": "0.283", "position": "2B", "lineup_order": 1},
                    {"name": "Cody Bellinger", "at_bats": 4, "hits": 2, "runs": 1, "rbis": 1, "average": "0.307", "position": "1B", "lineup_order": 2},
                    {"name": "Seiya Suzuki", "at_bats": 4, "hits": 1, "runs": 0, "rbis": 0, "average": "0.285", "position": "RF", "lineup_order": 3},
                    {"name": "Christopher Morel", "at_bats": 3, "hits": 0, "runs": 0, "rbis": 0, "average": "0.247", "position": "3B", "lineup_order": 4},
                    {"name": "Ian Happ", "at_bats": 3, "hits": 1, "runs": 0, "rbis": 0, "average": "0.248", "position": "LF", "lineup_order": 5}
                ]
            },
            "pitchers": {
                "away": [
                    {"name": "Tyler Glasnow", "innings_pitched": 6.0, "hits": 5, "runs": 3, "earned_runs": 3, "walks": 2, "strikeouts": 7, "era": "3.53"}
                ],
                "home": [
                    {"name": "Justin Steele", "innings_pitched": 5.2, "hits": 6, "runs": 4, "earned_runs": 4, "walks": 1, "strikeouts": 6, "era": "3.06"}
                ]
            },
            "events": [],
            "integration_status": "enhanced_mock_data",
            "note": "Enhanced mock data with realistic player names, pitch sequences, and traditional scorecard information. Ready for Baseball library integration."
        }
        
        return mock_data
        
    except Exception as e:
        return {
            "error": f"Failed to get detailed game data: {e}",
            "game_id": game_id
        }

def main():
    """Main function to handle command line arguments"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Game ID required"}))
        sys.exit(1)
    
    game_id = sys.argv[1]
    
    try:
        result = get_detailed_game_data(game_id)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e), "game_id": game_id}))
        sys.exit(1)

if __name__ == "__main__":
    main()
