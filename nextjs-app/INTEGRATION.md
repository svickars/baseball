# Baseball Library Integration Guide

This document explains how to integrate your existing baseball library with the Next.js application.

## Current Status

The Next.js app is currently set up with mock data and API endpoints. To fully integrate with your existing baseball library, you'll need to complete the integration in the `lib/baseball-service.ts` file.

## Integration Steps

### 1. Python Integration Options

Since your baseball library is written in Python and the Next.js app is in TypeScript, you have several integration options:

#### Option A: Python Subprocess (Recommended for Vercel)

- Use Node.js `child_process` to call Python scripts
- Good for serverless environments like Vercel
- Minimal changes to existing code

#### Option B: Python HTTP Service

- Run your Python library as a separate HTTP service
- Next.js app calls the Python service via HTTP
- More complex but allows for better separation

#### Option C: Python-to-JS Bridge

- Use tools like Pyodide to run Python in the browser
- Complex but allows client-side Python execution

### 2. Recommended Implementation (Option A)

Here's how to implement the Python subprocess approach:

#### Update `lib/baseball-service.ts`:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

export async function getGameDetails(gameId: string): Promise<GameData> {
	try {
		// Parse game_id (format: YYYY-MM-DD-AWAY-HOME-GAME)
		const parts = gameId.split('-');
		if (parts.length !== 6) {
			throw new Error('Invalid game ID format');
		}

		const dateStr = `${parts[0]}-${parts[1]}-${parts[2]}`;
		const awayCode = parts[3];
		const homeCode = parts[4];
		const gameNumber = parseInt(parts[5]);

		// Create a temporary Python script
		const pythonScript = `
import sys
import os
sys.path.insert(0, '${process.env.BASEBALL_LIB_PATH || '../baseball'}')

import baseball
import json

try:
    # Get game data using your existing library
    game_id_result, game = baseball.get_game_from_url(
        '${dateStr}', '${awayCode}', '${homeCode}', ${gameNumber}
    )
    
    if game:
        # Generate SVG
        svg_content = game.get_svg_str()
        
        # Convert game to JSON
        game_json = game.json()
        game_data = json.loads(game_json)
        
        # Output as JSON
        result = {
            'success': True,
            'game_data': game_data,
            'svg_content': svg_content
        }
        print(json.dumps(result))
    else:
        result = {
            'success': False,
            'error': 'Game not found'
        }
        print(json.dumps(result))
        
except Exception as e:
    result = {
        'success': False,
        'error': str(e)
    }
    print(json.dumps(result))
`;

		// Write Python script to temporary file
		const scriptPath = join('/tmp', `baseball_${Date.now()}.py`);
		await writeFile(scriptPath, pythonScript);

		try {
			// Execute Python script
			const { stdout, stderr } = await execAsync(`python3 ${scriptPath}`);

			if (stderr) {
				console.error('Python script stderr:', stderr);
			}

			const result = JSON.parse(stdout);

			if (!result.success) {
				throw new Error(result.error || 'Failed to fetch game data');
			}

			return {
				game_id: gameId,
				game_data: result.game_data,
				svg_content: result.svg_content,
				success: true,
			};
		} finally {
			// Clean up temporary file
			try {
				await unlink(scriptPath);
			} catch (error) {
				console.warn('Failed to delete temporary script:', error);
			}
		}
	} catch (error) {
		console.error(`Error fetching game ${gameId}:`, error);
		throw error;
	}
}
```

### 3. Environment Setup

#### For Local Development:

```bash
# Install Python dependencies
pip install -r ../requirements.txt

# Set environment variable
export BASEBALL_LIB_PATH=../baseball
```

#### For Vercel Deployment:

1. Add Python runtime to your Vercel project
2. Set environment variable `BASEBALL_LIB_PATH=../baseball`
3. Ensure your baseball library is included in the deployment

### 4. Vercel Configuration

Update `vercel.json`:

```json
{
	"functions": {
		"app/api/**/*.ts": {
			"maxDuration": 30,
			"runtime": "nodejs18.x"
		}
	},
	"build": {
		"env": {
			"BASEBALL_LIB_PATH": "../baseball"
		}
	},
	"buildCommand": "npm run build && pip install -r ../requirements.txt"
}
```

### 5. Testing the Integration

1. **Test locally**:

   ```bash
   cd nextjs-app
   npm run dev
   ```

2. **Test with real data**:

   - Select a date with games
   - Click on a game to view the scorecard
   - Verify SVG generation works

3. **Test live updates**:
   - Select a live game
   - Verify auto-refresh functionality
   - Test delay controls

### 6. Performance Considerations

- **Caching**: Consider caching game data and SVGs
- **Rate Limiting**: Implement rate limiting for API calls
- **Error Handling**: Add comprehensive error handling
- **Monitoring**: Add logging and monitoring

### 7. Alternative: HTTP Service Approach

If the subprocess approach doesn't work well with Vercel, you can run your Python library as a separate service:

1. **Create a Python Flask/FastAPI service**:

   ```python
   from flask import Flask, jsonify, request
   import baseball

   app = Flask(__name__)

   @app.route('/api/game/<game_id>')
   def get_game(game_id):
       # Your existing logic here
       pass
   ```

2. **Update Next.js to call the service**:
   ```typescript
   const response = await fetch(`${process.env.PYTHON_SERVICE_URL}/api/game/${gameId}`);
   ```

### 8. Migration Checklist

- [ ] Update `lib/baseball-service.ts` with Python integration
- [ ] Test locally with real baseball data
- [ ] Configure Vercel environment variables
- [ ] Deploy and test on Vercel
- [ ] Verify live updates work
- [ ] Test error handling
- [ ] Monitor performance

## Support

If you encounter issues with the integration:

1. Check the browser console for errors
2. Check the Vercel function logs
3. Verify Python dependencies are installed
4. Test the Python library independently
5. Check environment variables are set correctly
