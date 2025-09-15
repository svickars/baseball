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
    # Import the specific functions we need
    from baseball.fetch_game import get_game_from_file
    from baseball.baseball import Game, Player, Team, Inning, PlateAppearance
    from baseball.baseball_events import Pitch, RunnerAdvance
    from baseball.stats import get_all_pitcher_stats, get_all_batter_stats
    BASEBALL_LIB_AVAILABLE = True
    print("Successfully imported Baseball library", file=sys.stderr)
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
    def extract_game_data_from_baseball_lib(game, game_id: str) -> Dict[str, Any]:
    """Extract game data from Baseball library Game object"""
    try:
    # Extract basic game information
    game_data = {
        "game_id": game_id,
        "date": game.game_date_str[:10] if hasattr(game, 'game_date_str') else "2025-09-14",
        "away_team": {
            "name": game.away_team.name if hasattr(game, 'away_team') and game.away_team else "Away Team",
            "abbreviation": game.away_team.abbreviation if hasattr(game, 'away_team') and game.away_team else "AWY"
        },
        "home_team": {
            "name": game.home_team.name if hasattr(game, 'home_team') and game.home_team else "Home Team", 
            "abbreviation": game.home_team.abbreviation if hasattr(game, 'home_team') and game.home_team else "HOM"
        },
        "venue": getattr(game, 'venue', 'Stadium'),
        "status": "completed",
        "innings": [],
        "batters": {"away": [], "home": []},
        "pitchers": {"away": [], "home": []},
        "events": [],
        "integration_status": "real_data",
        "note": "Real data from Baseball library"
    }
        # Extract innings data
    if hasattr(game, 'innings') and game.innings:
        for inning in game.innings:
            inning_data = {
                "inning": inning.inning_number if hasattr(inning, 'inning_number') else 1,
                "away_runs": inning.away_runs if hasattr(inning, 'away_runs') else 0,
                "home_runs": inning.home_runs if hasattr(inning, 'home_runs') else 0,
                "top_events": [],
                "bottom_events": []
            }
                        # Extract plate appearances for top and bottom of inning
            if hasattr(inning, 'top_plate_appearances'):
                for pa in inning.top_plate_appearances:
                    inning_data["top_events"].append(extract_plate_appearance_data(pa))
                        if hasattr(inning, 'bottom_plate_appearances'):
                for pa in inning.bottom_plate_appearances:
                    inning_data["bottom_events"].append(extract_plate_appearance_data(pa))
                        game_data["innings"].append(inning_data)
        # Extract batting statistics
    if hasattr(game, 'away_team') and game.away_team and hasattr(game.away_team, 'batters'):
        for batter in game.away_team.batters:
            game_data["batters"]["away"].append(extract_batter_data(batter))
        if hasattr(game, 'home_team') and game.home_team and hasattr(game.home_team, 'batters'):
        for batter in game.home_team.batters:
            game_data["batters"]["home"].append(extract_batter_data(batter))
        # Extract pitching statistics
    if hasattr(game, 'away_team') and game.away_team and hasattr(game.away_team, 'pitchers'):
        for pitcher in game.away_team.pitchers:
            game_data["pitchers"]["away"].append(extract_pitcher_data(pitcher))
        if hasattr(game, 'home_team') and game.home_team and hasattr(game.home_team, 'pitchers'):
        for pitcher in game.home_team.pitchers:
            game_data["pitchers"]["home"].append(extract_pitcher_data(pitcher))
        return game_data
        except Exception as e:
    print(f"Error extracting game data: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc()
    # Return a basic structure if extraction fails
    return {
        "game_id": game_id,
        "date": "2025-09-14",
        "away_team": {"name": "Away Team", "abbreviation": "AWY"},
        "home_team": {"name": "Home Team", "abbreviation": "HOM"},
        "venue": "Stadium",
        "status": "completed",
        "innings": [],
        "batters": {"away": [], "home": []},
        "pitchers": {"away": [], "home": []},
        "events": [],
        "integration_status": "extraction_error",
        "note": f"Error extracting data: {str(e)}"
    }
    def extract_plate_appearance_data(pa) -> Dict[str, Any]:
    """Extract plate appearance data from Baseball library PlateAppearance object"""
    try:
    return {
        "batter": pa.batter.name if hasattr(pa, 'batter') and pa.batter else "Unknown",
        "pitcher": pa.pitcher.name if hasattr(pa, 'pitcher') and pa.pitcher else "Unknown",
        "description": pa.description if hasattr(pa, 'description') else "Unknown play",
        "summary": pa.summary if hasattr(pa, 'summary') else "?",
        "got_on_base": pa.got_on_base if hasattr(pa, 'got_on_base') else False,
        "runs_scored": pa.runs_scored if hasattr(pa, 'runs_scored') else 0,
        "rbis": pa.rbis if hasattr(pa, 'rbis') else 0,
        "outs": pa.outs if hasattr(pa, 'outs') else 0,
        "half": pa.half if hasattr(pa, 'half') else "top",
        "events": extract_pitch_events(pa)
    }
    except Exception as e:
    print(f"Error extracting plate appearance data: {e}", file=sys.stderr)
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
    def extract_pitch_events(pa) -> List[Dict[str, Any]]:
    """Extract pitch events from a plate appearance"""
    try:
    events = []
    if hasattr(pa, 'pitches') and pa.pitches:
        for pitch in pa.pitches:
            events.append({
                "type": pitch.pitch_type if hasattr(pitch, 'pitch_type') else "Unknown",
                "description": pitch.description if hasattr(pitch, 'description') else "Unknown",
                "result": pitch.result if hasattr(pitch, 'result') else "Unknown",
                "speed": getattr(pitch, 'speed', None),
                "location": getattr(pitch, 'location', None)
            })
    return events
    except Exception as e:
    print(f"Error extracting pitch events: {e}", file=sys.stderr)
    return []
    def extract_batter_data(batter) -> Dict[str, Any]:
    """Extract batter data from Baseball library Player object"""
    try:
    return {
        "name": batter.name if hasattr(batter, 'name') else "Unknown",
        "at_bats": batter.at_bats if hasattr(batter, 'at_bats') else 0,
        "hits": batter.hits if hasattr(batter, 'hits') else 0,
        "runs": batter.runs if hasattr(batter, 'runs') else 0,
        "rbis": batter.rbis if hasattr(batter, 'rbis') else 0,
        "average": f"{batter.average:.3f}" if hasattr(batter, 'average') and batter.average else "0.000",
        "position": batter.position if hasattr(batter, 'position') else "?",
        "lineup_order": batter.lineup_order if hasattr(batter, 'lineup_order') else 0
    }
    except Exception as e:
    print(f"Error extracting batter data: {e}", file=sys.stderr)
    return {
        "name": "Unknown",
        "at_bats": 0,
        "hits": 0,
        "runs": 0,
        "rbis": 0,
        "average": "0.000",
        "position": "?",
        "lineup_order": 0
    }
    def extract_pitcher_data(pitcher) -> Dict[str, Any]:
    """Extract pitcher data from Baseball library Player object"""
    try:
    return {
        "name": pitcher.name if hasattr(pitcher, 'name') else "Unknown",
        "innings_pitched": pitcher.innings_pitched if hasattr(pitcher, 'innings_pitched') else 0.0,
        "hits": pitcher.hits if hasattr(pitcher, 'hits') else 0,
        "runs": pitcher.runs if hasattr(pitcher, 'runs') else 0,
        "earned_runs": pitcher.earned_runs if hasattr(pitcher, 'earned_runs') else 0,
        "walks": pitcher.walks if hasattr(pitcher, 'walks') else 0,
        "strikeouts": pitcher.strikeouts if hasattr(pitcher, 'strikeouts') else 0,
        "era": f"{pitcher.era:.2f}" if hasattr(pitcher, 'era') and pitcher.era else "0.00"
    }
    except Exception as e:
    print(f"Error extracting pitcher data: {e}", file=sys.stderr)
    return {
        "name": "Unknown",
        "innings_pitched": 0.0,
        "hits": 0,
        "runs": 0,
        "earned_runs": 0,
        "walks": 0,
        "strikeouts": 0,
        "era": "0.00"
    }
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
    'NYM': 'New York Mets',
    'NYY': 'New York Yankees',
    'TOR': 'Toronto Blue Jays',
    'SF': 'San Francisco Giants'
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
        # Update venue based on home team
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
        customized_data['venue'] = venue_mapping.get(home_code, f'{home_code} Stadium')
        # Update integration status
    customized_data['integration_status'] = 'customized_template_data'
    customized_data['note'] = f'Template data customized for {away_code} @ {home_code} on {date_str}'
        return customized_data
    def get_detailed_game_data(game_id: str) -> Dict[str, Any]:
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
        # For now, we'll use the World Series Game 7 data as a template
    # but modify it to match the requested teams and date
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
        print(f"Successfully customized game data for {away_code} @ {home_code}", file=sys.stderr)
        return data
    else:
        print("Failed to load game data from wrapper", file=sys.stderr)
    else:
    print(f"Wrapper script not found at {wrapper_path}", file=sys.stderr)
    else:
    print(f"Template game file not found at {sample_game_path}", file=sys.stderr)
    except Exception as e:
    print(f"Error loading real game data: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc()
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
