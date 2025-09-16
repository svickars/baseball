#!/usr/bin/env python3
"""
Integration script to get detailed game data using the baseball library.
This script fetches real game data from the MLB API and formats it for the frontend.
"""

import sys
import os
import json
import requests
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

def get_mlb_api_supplementary_data(date_str: str, away_code: str, home_code: str) -> Dict[str, Any]:
    """Fetch supplementary game data from MLB API (umpires, managers, times, weather, wind)"""
    try:
        print(f"🌐 MLB API - Fetching supplementary data for {away_code} @ {home_code} on {date_str}", file=sys.stderr)
        
        # Check if requests is available
        try:
            import requests
            print(f"🌐 MLB API - Requests library imported successfully", file=sys.stderr)
        except ImportError as e:
            print(f"❌ MLB API - Requests library not available: {e}", file=sys.stderr)
            return {}
        
        # MLB API base URL
        base_url = "https://statsapi.mlb.com/api/v1"
        
        # Get team IDs first
        teams_response = requests.get(f"{base_url}/teams", timeout=10)
        if teams_response.status_code != 200:
            print(f"❌ MLB API - Failed to fetch teams: {teams_response.status_code}", file=sys.stderr)
            return {}
        
        teams_data = teams_response.json()
        print(f"🌐 MLB API - Teams response structure: {json.dumps(teams_data, indent=2)[:1000]}...", file=sys.stderr)
        away_team_id = None
        home_team_id = None
        
        # Find team IDs by abbreviation (only main MLB teams, not alternate training sites)
        for team in teams_data.get('teams', []):
            # Skip alternate training sites and other non-main teams
            if team.get('sport', {}).get('id') != 1:  # Only MLB teams
                continue
            if team.get('abbreviation', '').upper() == away_code.upper():
                away_team_id = team.get('id')
                print(f"🌐 MLB API - Found away team: {team.get('name')} ({away_code}) = ID {away_team_id}", file=sys.stderr)
            elif team.get('abbreviation', '').upper() == home_code.upper():
                home_team_id = team.get('id')
                print(f"🌐 MLB API - Found home team: {team.get('name')} ({home_code}) = ID {home_team_id}", file=sys.stderr)
        
        if not away_team_id or not home_team_id:
            print(f"❌ MLB API - Could not find team IDs for {away_code} or {home_code}", file=sys.stderr)
            return {}
        
        print(f"🌐 MLB API - Found team IDs: {away_code}={away_team_id}, {home_code}={home_team_id}", file=sys.stderr)
        
        # Get schedule for the date
        schedule_response = requests.get(
            f"{base_url}/schedule",
            params={
                'sportId': 1,  # MLB
                'date': date_str,
                'teamId': f"{away_team_id},{home_team_id}"
            },
            timeout=10
        )
        
        if schedule_response.status_code != 200:
            print(f"❌ MLB API - Failed to fetch schedule: {schedule_response.status_code}", file=sys.stderr)
            return {}
        
        schedule_data = schedule_response.json()
        print(f"🌐 MLB API - Schedule response structure: {json.dumps(schedule_data, indent=2)[:2000]}...", file=sys.stderr)
        game_data = None
        
        # Find the specific game
        for date_group in schedule_data.get('dates', []):
            for game in date_group.get('games', []):
                teams = game.get('teams', {})
                away_team = teams.get('away', {}).get('team', {})
                home_team = teams.get('home', {}).get('team', {})
                
                if (away_team.get('id') == away_team_id and 
                    home_team.get('id') == home_team_id):
                    game_data = game
                    print(f"🌐 MLB API - Found matching game! Full game data: {json.dumps(game_data, indent=2)}", file=sys.stderr)
                    break
        
        if not game_data:
            print(f"❌ MLB API - Game not found in schedule", file=sys.stderr)
            return {}
        
        print(f"✅ MLB API - Found game data", file=sys.stderr)
        
        # Extract supplementary data
        supplementary_data = {
            'umpires': [],
            'managers': {
                'away': None,
                'home': None
            },
            'start_time': None,
            'end_time': None,
            'weather': None,
            'wind': None,
            'venue': game_data.get('venue', {}).get('name', 'Unknown Stadium')
        }
        
        # Extract umpires
        umpires = game_data.get('officials', [])
        for umpire in umpires:
            if umpire.get('officialType') == 'Umpire':
                supplementary_data['umpires'].append({
                    'name': f"{umpire.get('firstName', '')} {umpire.get('lastName', '')}".strip(),
                    'position': umpire.get('position', 'Unknown')
                })
        
        # Extract managers
        teams_data = game_data.get('teams', {})
        away_team_data = teams_data.get('away', {}).get('team', {})
        home_team_data = teams_data.get('home', {}).get('team', {})
        
        # Get active roster for managers
        for team_id in [away_team_id, home_team_id]:
            coaches_response = requests.get(f"{base_url}/teams/{team_id}/coaches", timeout=10)
            if coaches_response.status_code == 200:
                coaches_info = coaches_response.json()
                print(f"🌐 MLB API - Team {team_id} coaches data: {json.dumps(coaches_info, indent=2)[:1000]}...", file=sys.stderr)
                coaches = coaches_info.get('roster', [])
                
                for coach in coaches:
                    if coach.get('job') == 'Manager':
                        manager_name = coach.get('person', {}).get('fullName', '')
                        if team_id == away_team_id:
                            supplementary_data['managers']['away'] = manager_name
                        else:
                            supplementary_data['managers']['home'] = manager_name
                        print(f"🌐 MLB API - Found manager for team {team_id}: {manager_name}", file=sys.stderr)
                        break
        
        # Get detailed game feed for umpires, weather, and other data
        game_pk = game_data.get('gamePk')
        if game_pk:
            print(f"🌐 MLB API - Fetching game feed for gamePk: {game_pk}", file=sys.stderr)
            game_feed_response = requests.get(f"https://statsapi.mlb.com/api/v1.1/game/{game_pk}/feed/live", timeout=10)
            if game_feed_response.status_code == 200:
                game_feed_data = game_feed_response.json()
                print(f"🌐 MLB API - Game feed data structure: {json.dumps(game_feed_data, indent=2)[:2000]}...", file=sys.stderr)
                
                # Extract umpires from game feed (in liveData.boxscore section)
                live_data = game_feed_data.get('liveData', {})
                print(f"🌐 MLB API - LiveData keys: {list(live_data.keys())}", file=sys.stderr)
                boxscore = live_data.get('boxscore', {})
                print(f"🌐 MLB API - Boxscore keys: {list(boxscore.keys())}", file=sys.stderr)
                info_data = boxscore.get('info', [])
                print(f"🌐 MLB API - Info data: {info_data}", file=sys.stderr)
                
                # Look for umpires in info section
                umpires = []
                for info_item in info_data:
                    if info_item.get('label') == 'Umpires':
                        umpires_text = info_item.get('value', '')
                        print(f"🌐 MLB API - Umpires text: {umpires_text}", file=sys.stderr)
                        # Parse umpires text like "HP: Marvin Hudson. 1B: Hunter Wendelstedt. 2B: Charlie Ramos. 3B: John Tumpane."
                        umpire_entries = umpires_text.split('.')
                        for entry in umpire_entries:
                            entry = entry.strip()
                            if ':' in entry:
                                position, name = entry.split(':', 1)
                                umpires.append({
                                    'name': name.strip(),
                                    'position': position.strip(),
                                    'id': None
                                })
                        break
                
                if umpires:
                    supplementary_data['umpires'] = umpires
                    print(f"🌐 MLB API - Found umpires: {umpires}", file=sys.stderr)
                else:
                    print(f"🌐 MLB API - No umpires found in info section", file=sys.stderr)
                
                # Extract game times from info section
                start_time_found = False
                for info_item in info_data:
                    if info_item.get('label') == 'First pitch':
                        first_pitch = info_item.get('value', '')
                        print(f"🌐 MLB API - First pitch: {first_pitch}", file=sys.stderr)
                        supplementary_data['start_time'] = first_pitch
                        start_time_found = True
                        break
                
                # Fallback to gameDate if no first pitch found
                if not start_time_found:
                    game_date = game_data.get('gameDate')
                    if game_date:
                        try:
                            # Parse ISO datetime
                            start_dt = datetime.fromisoformat(game_date.replace('Z', '+00:00'))
                            supplementary_data['start_time'] = start_dt.strftime('%I:%M %p')
                        except:
                            supplementary_data['start_time'] = 'TBD'
                
                # Extract end time from info section
                for info_item in info_data:
                    if info_item.get('label') == 'T':
                        game_duration = info_item.get('value', '')
                        print(f"🌐 MLB API - Game duration: {game_duration}", file=sys.stderr)
                        # For now, just store the duration, could calculate end time if needed
                        supplementary_data['end_time'] = f"Duration: {game_duration}"
                        break
                
                # Extract weather and wind from game feed info section
                info_section = game_feed_data.get('info', [])
                for info_item in info_section:
                    if info_item.get('label') == 'Weather':
                        supplementary_data['weather'] = info_item.get('value', 'TBD')
                    elif info_item.get('label') == 'Wind':
                        supplementary_data['wind'] = info_item.get('value', 'TBD')
                
                # Also try the gameData weather section
                game_data_feed = game_feed_data.get('gameData', {})
                weather_data = game_data_feed.get('weather', {})
                if weather_data:
                    supplementary_data['weather'] = weather_data.get('condition', 'TBD')
                    wind_data = weather_data.get('wind', {})
                    if wind_data and isinstance(wind_data, dict):
                        wind_speed = wind_data.get('speed', '')
                        wind_direction = wind_data.get('direction', '')
                        if wind_speed and wind_direction:
                            supplementary_data['wind'] = f"{wind_direction} {wind_speed} mph"
                        elif wind_speed:
                            supplementary_data['wind'] = f"{wind_speed} mph"
                    elif wind_data and isinstance(wind_data, str):
                        supplementary_data['wind'] = wind_data
                    print(f"🌐 MLB API - Found weather: {weather_data}", file=sys.stderr)
                
                # Extract end time from game feed
                game_info = game_feed_data.get('gameData', {}).get('game', {})
                if game_info.get('status') == 'Final':
                    # Try to get end time from game events or calculate from duration
                    live_data = game_feed_data.get('liveData', {})
                    plays = live_data.get('plays', {})
                    all_plays = plays.get('allPlays', [])
                    if all_plays:
                        last_play = all_plays[-1]
                        end_time = last_play.get('about', {}).get('endTime')
                        if end_time:
                            try:
                                from datetime import datetime
                                dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                                formatted_end_time = dt.strftime('%I:%M %p').lstrip('0')
                                supplementary_data['end_time'] = formatted_end_time
                                print(f"🌐 MLB API - Found end time: {formatted_end_time}", file=sys.stderr)
                            except Exception as e:
                                print(f"❌ MLB API - Error parsing end time: {e}", file=sys.stderr)
            else:
                print(f"❌ MLB API - Failed to fetch game feed: {game_feed_response.status_code}", file=sys.stderr)
        
        # Get uniforms for the game
        if game_pk:
            print(f"🌐 MLB API - Fetching uniforms for gamePk: {game_pk}", file=sys.stderr)
            uniforms_response = requests.get(f"{base_url}/uniforms/game?gamePks={game_pk}", timeout=10)
            if uniforms_response.status_code == 200:
                uniforms_data = uniforms_response.json()
                print(f"🌐 MLB API - Uniforms data: {json.dumps(uniforms_data, indent=2)[:1000]}...", file=sys.stderr)
                uniforms = uniforms_data.get('uniforms', [])
                if uniforms:
                    game_uniforms = uniforms[0]  # Should be only one game
                    away_uniforms = game_uniforms.get('away', {}).get('uniformAssets', [])
                    home_uniforms = game_uniforms.get('home', {}).get('uniformAssets', [])
                    
                    # Extract uniform descriptions
                    away_jersey = next((u.get('uniformAssetText', '') for u in away_uniforms if u.get('uniformAssetType', {}).get('uniformAssetTypeCode') == 'J'), '')
                    home_jersey = next((u.get('uniformAssetText', '') for u in home_uniforms if u.get('uniformAssetType', {}).get('uniformAssetTypeCode') == 'J'), '')
                    
                    supplementary_data['uniforms'] = {
                        'away': away_jersey,
                        'home': home_jersey
                    }
                    print(f"🌐 MLB API - Found uniforms - Away: {away_jersey}, Home: {home_jersey}", file=sys.stderr)
            else:
                print(f"❌ MLB API - Failed to fetch uniforms: {uniforms_response.status_code}", file=sys.stderr)
        
        # Extract weather and wind (if available)
        weather = game_data.get('weather', {})
        if weather:
            supplementary_data['weather'] = {
                'condition': weather.get('condition', 'Unknown'),
                'temp': weather.get('temp', 'Unknown'),
                'wind': weather.get('wind', 'Unknown')
            }
            supplementary_data['wind'] = weather.get('wind', 'Unknown')
        
        print(f"✅ MLB API - Successfully extracted supplementary data", file=sys.stderr)
        return supplementary_data
        
    except Exception as e:
        print(f"❌ MLB API - Error fetching supplementary data: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return {}

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
        
        # Fetch supplementary data from MLB API
        print(f"🐍 Python Script - About to call MLB API for {away_code} @ {home_code} on {date_str}", file=sys.stderr)
        mlb_supplementary_data = get_mlb_api_supplementary_data(date_str, away_code, home_code)
        print(f"🐍 Python Script - MLB API returned: {mlb_supplementary_data}", file=sys.stderr)
        
        if BASEBALL_LIBRARY_AVAILABLE:
            # Use the baseball library to get real game data
            try:
                game_id_result, game = get_game_from_url(date_str, away_code, home_code, game_number)
                
                if game:
                    print(f"Successfully loaded game from baseball library", file=sys.stderr)
                    return extract_detailed_data_from_baseball_library(game, game_id, date_str, away_code, home_code, mlb_supplementary_data)
                else:
                    print("Game not found in baseball library", file=sys.stderr)
            except Exception as e:
                print(f"Error using baseball library: {e}", file=sys.stderr)
        
        # Fallback to mock data if baseball library fails
        print("Falling back to mock data", file=sys.stderr)
        return get_basic_fallback_data(game_id, date_str, away_code, home_code, mlb_supplementary_data)
            
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

def extract_detailed_data_from_baseball_library(game, game_id: str, date_str: str, away_code: str, home_code: str, mlb_supplementary_data: Dict[str, Any] = None) -> Dict[str, Any]:
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
        
        # Merge with MLB API supplementary data
        venue_name = mlb_supplementary_data.get('venue', venue) if mlb_supplementary_data else venue
        
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
            "venue": venue_name,
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
            "total_home_runs": total_home_runs,
            # MLB API supplementary data
            "umpires": mlb_supplementary_data.get('umpires', []) if mlb_supplementary_data else [],
            "managers": mlb_supplementary_data.get('managers', {'away': None, 'home': None}) if mlb_supplementary_data else {'away': None, 'home': None},
            "start_time": mlb_supplementary_data.get('start_time', 'TBD') if mlb_supplementary_data else 'TBD',
            "end_time": mlb_supplementary_data.get('end_time', 'TBD') if mlb_supplementary_data else 'TBD',
            "weather": mlb_supplementary_data.get('weather', 'TBD') if mlb_supplementary_data else 'TBD',
            "wind": mlb_supplementary_data.get('wind', 'TBD') if mlb_supplementary_data else 'TBD',
            "uniforms": mlb_supplementary_data.get('uniforms', {'away': 'TBD', 'home': 'TBD'}) if mlb_supplementary_data else {'away': 'TBD', 'home': 'TBD'}
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


def get_basic_fallback_data(game_id: str, date_str: str, away_code: str, home_code: str, mlb_supplementary_data: Dict[str, Any] = None) -> Dict[str, Any]:
    """Basic fallback data if JSON parsing fails"""
    # Merge with MLB API supplementary data
    venue_name = mlb_supplementary_data.get('venue', f"{home_code} Stadium") if mlb_supplementary_data else f"{home_code} Stadium"
    
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
        "venue": venue_name,
        "status": "completed",
        "innings": [],
        "batters": {"away": [], "home": []},
        "pitchers": {"away": [], "home": []},
        "events": [],
        "integration_status": "fallback_data",
        "note": "Fallback data due to JSON parsing failure",
        # MLB API supplementary data
        "umpires": mlb_supplementary_data.get('umpires', []) if mlb_supplementary_data else [],
        "managers": mlb_supplementary_data.get('managers', {'away': None, 'home': None}) if mlb_supplementary_data else {'away': None, 'home': None},
        "start_time": mlb_supplementary_data.get('start_time', 'TBD') if mlb_supplementary_data else 'TBD',
        "end_time": mlb_supplementary_data.get('end_time', 'TBD') if mlb_supplementary_data else 'TBD',
        "weather": mlb_supplementary_data.get('weather', 'TBD') if mlb_supplementary_data else 'TBD',
        "wind": mlb_supplementary_data.get('wind', 'TBD') if mlb_supplementary_data else 'TBD',
        "uniforms": mlb_supplementary_data.get('uniforms', {'away': 'TBD', 'home': 'TBD'}) if mlb_supplementary_data else {'away': 'TBD', 'home': 'TBD'}
    }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        game_id_arg = sys.argv[1]
        print(f"🐍 Python Script - Starting detailed game data fetch for: {game_id_arg}", file=sys.stderr)
        data = get_detailed_game_data_from_json(game_id_arg)
        if data:
            print(f"🐍 Python Script - Successfully generated data for {game_id_arg}", file=sys.stderr)
            print(json.dumps(data, indent=2))
        else:
            print(f"🐍 Python Script - Failed to generate data for {game_id_arg}", file=sys.stderr)
            print(json.dumps({"error": "Failed to generate game data", "code": 1}))
    else:
        print("🐍 Python Script - No game ID provided", file=sys.stderr)
        print(json.dumps({"error": "No game ID provided", "code": 1}))
        sys.exit(1)
