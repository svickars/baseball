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

# For now, we'll use mock data while we work on the integration
# TODO: Integrate with the actual Baseball library
try:
    # from baseball import get_game_from_url, get_game_from_file
    # from baseball.generate_svg import get_game_svg_str
    # from baseball.stats import get_all_pitcher_stats, get_all_batter_stats
    pass
except ImportError as e:
    print(json.dumps({"error": f"Failed to import baseball library: {e}"}))
    sys.exit(1)

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
        # For now, we'll create a mock response since we don't have actual game files
        # In a real implementation, you'd either:
        # 1. Have game files stored locally
        # 2. Fetch from MLB API and parse with the library
        # 3. Use a different data source
        
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
                    "away_runs": 0,
                    "home_runs": 0,
                    "top_events": [
                        {
                            "batter": "Player 1",
                            "pitcher": "Pitcher 1",
                            "description": "Strikeout",
                            "summary": "K",
                            "got_on_base": False,
                            "runs_scored": 0,
                            "rbis": 0,
                            "outs": 1,
                            "half": "top",
                            "events": []
                        }
                    ],
                    "bottom_events": []
                }
            ],
            "batters": {
                "away": [
                    {
                        "name": "Player 1",
                        "at_bats": 4,
                        "hits": 2,
                        "runs": 1,
                        "rbis": 2,
                        "average": "0.500"
                    }
                ],
                "home": [
                    {
                        "name": "Player 2",
                        "at_bats": 4,
                        "hits": 1,
                        "runs": 0,
                        "rbis": 0,
                        "average": "0.250"
                    }
                ]
            },
            "pitchers": {
                "away": [
                    {
                        "name": "Pitcher 1",
                        "innings_pitched": 6.0,
                        "hits": 5,
                        "runs": 3,
                        "earned_runs": 3,
                        "walks": 2,
                        "strikeouts": 7,
                        "era": "4.50"
                    }
                ],
                "home": [
                    {
                        "name": "Pitcher 2",
                        "innings_pitched": 7.0,
                        "hits": 4,
                        "runs": 2,
                        "earned_runs": 2,
                        "walks": 1,
                        "strikeouts": 8,
                        "era": "2.57"
                    }
                ]
            },
            "events": [],
            "integration_status": "mock_data",
            "note": "This is mock data. Integration with actual Baseball library data is in progress."
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
