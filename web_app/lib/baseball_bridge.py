#!/usr/bin/env python3
"""
Baseball Library Bridge
This script provides a bridge between the Next.js app and the Python baseball library.
It can be called from Node.js API routes to get real baseball data.
"""

import sys
import os
import json
from pathlib import Path

# Add the parent directory to the path so we can import the baseball library
parent_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(parent_dir))

try:
    import baseball
    from baseball.fetch_game import get_game_from_url
except ImportError as e:
    print(json.dumps({"error": f"Failed to import baseball library: {e}", "success": False}))
    sys.exit(1)

def get_games_for_date(date_str):
    """Get games for a specific date using the baseball library"""
    try:
        from datetime import datetime
        from dateutil import parser
        
        # Parse date string (YYYY-MM-DD format)
        date_obj = parser.parse(date_str)
        
        # Use the existing library to get games
        all_games_dict = baseball.fetch_game.get(
            baseball.fetch_game.ALL_GAMES_URL.format(
                month=date_obj.month, 
                day=date_obj.day, 
                year=date_obj.year
            )
        ).json()
        
        games_data = []
        
        if len(all_games_dict['dates']) > 0:
            for game_data in all_games_dict['dates'][0]['games']:
                game_pk = game_data['gamePk']
                
                # Get detailed game data
                game_dict = baseball.fetch_game.get(
                    baseball.fetch_game.GAME_URL_TEMPLATE.format(game_pk=game_pk)
                ).json()
                
                # Extract game information
                game_info = game_dict.get('gameData', {})
                teams = game_info.get('teams', {})
                away_team = teams.get('away', {})
                home_team = teams.get('home', {})
                game_details = game_info.get('game', {})
                status = game_data.get('status', {})
                
                # Format start time
                start_time = game_data.get('gameDate', '')
                if start_time:
                    try:
                        dt = parser.parse(start_time)
                        start_time = dt.strftime('%I:%M %p %Z')
                    except:
                        pass
                
                # Create game object
                game = {
                    "id": f"{date_str}-{away_team.get('abbreviation', '')}-{home_team.get('abbreviation', '')}-{game_details.get('gameNumber', 1)}",
                    "away_team": away_team.get('teamName', ''),
                    "home_team": home_team.get('teamName', ''),
                    "away_code": away_team.get('abbreviation', ''),
                    "home_code": home_team.get('abbreviation', ''),
                    "game_number": game_details.get('gameNumber', 1),
                    "start_time": start_time,
                    "location": f"{game_data.get('venue', {}).get('name', '')}, {game_data.get('venue', {}).get('city', '')}",
                    "status": status.get('detailedState', 'Unknown'),
                    "game_pk": game_pk,
                    "is_live": status.get('codedGameState') in ['I', 'S'],  # In Progress or Scheduled
                    "inning": game_data.get('linescore', {}).get('currentInning', ''),
                    "inning_state": game_data.get('linescore', {}).get('inningState', ''),
                    "away_score": game_data.get('linescore', {}).get('teams', {}).get('away', {}).get('runs', 0),
                    "home_score": game_data.get('linescore', {}).get('teams', {}).get('home', {}).get('runs', 0)
                }
                games_data.append(game)
        
        return json.dumps({
            "games": games_data,
            "success": True
        })
        
    except Exception as e:
        return json.dumps({
            "error": f"Error fetching games for {date_str}: {e}",
            "success": False
        })

def get_game_details(game_id):
    """Get detailed game data and SVG using the baseball library"""
    try:
        # Parse game_id (format: YYYY-MM-DD-AWAY-HOME-GAME)
        parts = game_id.split('-')
        if len(parts) != 6:
            raise ValueError("Invalid game ID format")
            
        date_str = f"{parts[0]}-{parts[1]}-{parts[2]}"
        away_code = parts[3]
        home_code = parts[4]
        game_number = int(parts[5])
        
        # Get game data using existing library
        game_id_result, game = baseball.get_game_from_url(
            date_str, away_code, home_code, game_number
        )
        
        if not game:
            return json.dumps({
                "error": "Game not found or no data available",
                "success": False
            })
        
        # Generate SVG
        svg_content = game.get_svg_str()
        
        # Convert game to JSON
        game_json = game.json()
        game_data = json.loads(game_json)
        
        return json.dumps({
            "game_id": game_id,
            "game_data": game_data,
            "svg_content": svg_content,
            "success": True
        })
        
    except Exception as e:
        return json.dumps({
            "error": f"Error fetching game {game_id}: {e}",
            "success": False
        })

def get_game_svg(game_id):
    """Get just the SVG content for a game"""
    try:
        # Parse game_id
        parts = game_id.split('-')
        if len(parts) != 6:
            raise ValueError("Invalid game ID format")
            
        date_str = f"{parts[0]}-{parts[1]}-{parts[2]}"
        away_code = parts[3]
        home_code = parts[4]
        game_number = int(parts[5])
        
        # Get game and generate SVG
        game_id_result, game = baseball.get_game_from_url(
            date_str, away_code, home_code, game_number
        )
        
        if not game:
            return json.dumps({
                "error": "Game not found",
                "success": False
            })
            
        svg_content = game.get_svg_str()
        
        return json.dumps({
            "svg_content": svg_content,
            "success": True
        })
        
    except Exception as e:
        return json.dumps({
            "error": f"Error fetching game SVG {game_id}: {e}",
            "success": False
        })

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python baseball_bridge.py <command> <args>", "success": False}))
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "get_games":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Usage: python baseball_bridge.py get_games <date>", "success": False}))
            sys.exit(1)
        date_str = sys.argv[2]
        result = get_games_for_date(date_str)
        print(result)
        
    elif command == "get_game":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Usage: python baseball_bridge.py get_game <game_id>", "success": False}))
            sys.exit(1)
        game_id = sys.argv[2]
        result = get_game_details(game_id)
        print(result)
        
    elif command == "get_svg":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Usage: python baseball_bridge.py get_svg <game_id>", "success": False}))
            sys.exit(1)
        game_id = sys.argv[2]
        result = get_game_svg(game_id)
        print(result)
        
    else:
        print(json.dumps({"error": f"Unknown command: {command}", "success": False}))
        sys.exit(1)