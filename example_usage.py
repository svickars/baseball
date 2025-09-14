#!/usr/bin/env python3
"""
Example usage of the baseball library
"""

import baseball
from datetime import datetime

def fetch_and_visualize_game():
    """Fetch a famous game and create visualizations"""
    
    # Fetch the 2017 World Series Game 7
    print("🏟️  Fetching 2017 World Series Game 7...")
    game_id, game = baseball.get_game_from_url('2017-11-1', 'HOU', 'LAD', 1)
    
    if game:
        print(f"✅ Game fetched: {game_id}")
        print(f"   {game.away_team.name} @ {game.home_team.name}")
        print(f"   Location: {game.location}")
        print(f"   Innings: {len(game.inning_list)}")
        
        # Generate SVG scorecard
        print("\n🎨 Generating SVG scorecard...")
        svg_content = game.get_svg_str()
        with open('world_series_game7.svg', 'w') as f:
            f.write(svg_content)
        print("✅ SVG saved as 'world_series_game7.svg'")
        
        # Export to JSON
        print("\n📊 Exporting to JSON...")
        json_content = game.json()
        with open('world_series_game7.json', 'w') as f:
            f.write(json_content)
        print("✅ JSON saved as 'world_series_game7.json'")
        
        # Show some stats
        print(f"\n📈 Game Stats:")
        if game.away_team_stats:
            print(f"   Away team stats: {game.away_team_stats}")
        if game.home_team_stats:
            print(f"   Home team stats: {game.home_team_stats}")
        
    else:
        print("❌ Could not fetch game data")

def fetch_todays_games():
    """Fetch today's MLB games"""
    print("\n📅 Fetching today's games...")
    try:
        baseball.generate_today_game_svgs('./todays_games/', write_game_html=True)
        print("✅ Today's games saved to ./todays_games/")
    except Exception as e:
        print(f"ℹ️  No games today or API issue: {e}")

if __name__ == "__main__":
    print("⚾ Baseball Library Example")
    print("=" * 40)
    
    fetch_and_visualize_game()
    fetch_todays_games()
    
    print("\n🎉 Done! Check the generated files.")
