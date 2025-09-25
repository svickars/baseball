# Baseball App Deployment & Development Guidelines

## Critical Deployment Checklist

### TypeScript Compilation Issues (MUST CHECK BEFORE EVERY DEPLOY)

1. **Set Spread Operator Pattern** ⚠️

   - **Problem**: `[...new Set(array)]` fails with TypeScript targets < ES2015
   - **Solution**: Always use `Array.from(new Set(array))` instead
   - **Search Pattern**: `grep -n "\[\.\.\.new Set(" web_app/lib/baseball-service.ts`

2. **Implicit Array Types** ⚠️

   - **Problem**: `const array = []` without explicit typing causes compilation errors
   - **Solution**: Always specify types: `const array: Array<Type> = []`
   - **Search Pattern**: `grep -n "const.*= \[\];" web_app/lib/baseball-service.ts`

3. **Object Type Assignment Issues** ⚠️

   - **Problem**: Assigning empty object `{}` to typed interfaces causes compilation errors
   - **Solution**: Always provide complete object structure with required properties
   - **Search Pattern**: `grep -n "= {};" web_app/components/`

4. **Common Problematic Patterns to Fix**:

   ```typescript
   // ❌ WRONG - Causes compilation errors
   const uniqueValues = [...new Set(values)];
   const myArray = [];
   detailedData.play_by_play = {}; // Missing required properties

   // ✅ CORRECT - Works with all TypeScript targets
   const uniqueValues = Array.from(new Set(values));
   const myArray: Array<MyType> = [];
   detailedData.play_by_play = {
   	atBats: {},
   	substitutions: {},
   	inningResults: {},
   	errors: {},
   };
   ```

### Pre-Deployment Verification Steps

1. **Local Build Test** (MANDATORY)

   ```bash
   cd web_app && npm run build
   ```

   - Must return exit code 0
   - Must show "✓ Compiled successfully"
   - Any TypeScript errors = DO NOT DEPLOY

2. **Search for Problematic Patterns**

   ```bash
   # Check for spread operators with Sets
   grep -r "\[\.\.\.new Set(" web_app/

   # Check for untyped arrays
   grep -r "const.*= \[\];" web_app/
   grep -r "let.*= \[\];" web_app/

   # Check for empty object assignments to typed interfaces
   grep -r "= {};" web_app/components/
   grep -r "= {};" web_app/lib/
   ```

3. **Linting Check**
   ```bash
   cd web_app && npm run lint
   ```

## MLB API Data Requirements (NEVER VIOLATE)

### Core Principle: REAL DATA ONLY

- **NEVER** generate fake, demo, mock, or placeholder data
- **ALWAYS** use live MLB API data from `statsapi.mlb.com`
- **ALWAYS** handle API failures gracefully without fallback to fake data

### API Data Sources (in order of preference):

1. **Primary**: `gameFeedData.liveData.linescore.innings` - Official MLB inning data
2. **Secondary**: `gameFeedData.liveData.plays.allPlays` - Reconstruct from play-by-play
3. **Tertiary**: `gameFeedData.boxscore` - Box score data
4. **NEVER**: Hardcoded values, mock data, or placeholder arrays

### Data Integrity Rules:

- If API data is missing/incomplete → Log the issue but don't create fake data
- If game is "Final" but missing innings → Log warning, don't fill with zeros unless it's a known short game
- Always preserve original API response structure
- Use console.log for debugging API data issues, not for generating fake responses

### Example of CORRECT approach:

```typescript
// ✅ CORRECT - Use real API data, handle missing gracefully
if (linescore && linescore.innings) {
	innings = linescore.innings.map((inning: any) => ({
		inning: inning.num,
		away_runs: inning.away?.runs || 0,
		home_runs: inning.home?.runs || 0,
	}));
} else if (allPlays && allPlays.length > 0) {
	// Reconstruct from real play data
	innings = reconstructFromPlays(allPlays);
} else {
	console.log(`Game ${gamePk} - No inning data available from any source`);
	// Don't create fake data - just log and continue
}
```

### Example of INCORRECT approach:

```typescript
// ❌ WRONG - Never do this
if (!innings || innings.length === 0) {
	innings = generateFakeInnings(); // NEVER!
	innings = Array.from({ length: 9 }, (_, i) => ({
		// NEVER!
		inning: i + 1,
		away_runs: Math.floor(Math.random() * 5),
		home_runs: Math.floor(Math.random() * 5),
	}));
}
```

## File-Specific Guidelines

### `web_app/lib/baseball-service.ts`

- **Critical file** - Most compilation errors occur here
- **Always run full build test** after any changes
- **Check for Set spread operators** before committing
- **Verify array type annotations** for all array declarations

### Common Array Types in baseball-service.ts:

```typescript
// Inning data arrays
Array<{ inning: number; away_runs: number; home_runs: number }>

// Game arrays
Array<{ gamePk: number; status: string; ... }>

// Play arrays
Array<{ result?: { eventType?: string; ... }; ... }>

// Pitcher arrays
Array<{ player: { fullName: string; ... }; ... }>
```

## Deployment Process

### Before Every Deploy:

1. ✅ Run local build test
2. ✅ Check for Set spread operators
3. ✅ Check for untyped arrays
4. ✅ Verify no fake/mock data generation
5. ✅ Test with real MLB API data
6. ✅ Check linting

### Emergency Fixes:

If deployment fails due to TypeScript errors:

1. **IMMEDIATELY** run local build to reproduce error
2. **FIX** the specific line mentioned in error
3. **TEST** build again before re-deploying
4. **DO NOT** make multiple changes at once

## Documentation References

### MLB API Documentation Sources

- **Official MLB StatsAPI OpenAPI Spec**: [MLB-StatsAPI-Spec.json](https://raw.githubusercontent.com/MajorLeagueBaseball/google-cloud-mlb-hackathon/refs/heads/main/datasets/mlb-statsapi-docs/MLB-StatsAPI-Spec.json)
- **MLB StatsAPI Documentation**: [github.com/MajorLeagueBaseball/google-cloud-mlb-hackathon/tree/main/datasets/mlb-statsapi-docs](https://github.com/MajorLeagueBaseball/google-cloud-mlb-hackathon/tree/main/datasets/mlb-statsapi-docs)
- **MLB Hackathon Repository**: [github.com/MajorLeagueBaseball/google-cloud-mlb-hackathon/tree/main](https://github.com/MajorLeagueBaseball/google-cloud-mlb-hackathon/tree/main)
- **Live Baseball Scorecards**: [livebaseballscorecards.com](https://livebaseballscorecards.com)
- **Baseball Library Reference**: [github.com/benjamincrom/baseball](https://github.com/benjamincrom/baseball)

### Technical Documentation

- **TypeScript Target Compatibility**: ES2015+ features require explicit handling
- **Next.js Build Process**: TypeScript compilation happens during `next build`

### How to Use These Documentation Sources

1. **MLB-StatsAPI-Spec.json**:

   - **Primary reference** for all MLB API endpoints and data structures
   - Contains complete OpenAPI 3.0 specification for `statsapi.mlb.com`
   - Use to verify correct API paths, parameters, and response schemas

2. **MLB StatsAPI Documentation**:

   - **Detailed examples** and usage patterns
   - Contains sample responses and field descriptions
   - Reference for understanding data formats and field meanings

3. **MLB Hackathon Repository**:

   - **Real-world implementations** and best practices
   - Contains working examples of MLB API integration
   - Reference for common patterns and data processing approaches

4. **Live Baseball Scorecards**:

   - **Production example** of baseball scorecard implementation
   - Shows how real MLB data should be displayed
   - Reference for UI/UX patterns and data visualization

5. **Baseball Library Reference**:
   - **Python implementation** of baseball data processing
   - Contains algorithms for scorecard generation and data parsing
   - Reference for understanding baseball statistics and calculations

## Common Error Messages & Solutions

### "Type 'Set<unknown>' can only be iterated through when using the '--downlevelIteration' flag"

- **Cause**: Using `[...new Set(array)]`
- **Fix**: Change to `Array.from(new Set(array))`

### "Variable implicitly has type 'any[]' in some locations"

- **Cause**: Untyped array declaration
- **Fix**: Add explicit type annotation

### "Property does not exist on type 'never'"

- **Cause**: TypeScript can't infer array element types
- **Fix**: Add proper type annotations to array declarations

### "Type '{}' is missing the following properties from type 'InterfaceName'"

- **Cause**: Assigning empty object `{}` to typed interface
- **Fix**: Provide complete object structure with all required properties
- **Example**: `detailedData.play_by_play = { atBats: {}, substitutions: {}, inningResults: {}, errors: {} };`

---

**Remember**: These issues are recurring patterns. Always check these specific patterns before deploying to avoid repeated deployment failures.
