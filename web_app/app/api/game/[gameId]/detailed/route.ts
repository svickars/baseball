import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function GET(request: NextRequest, { params }: { params: { gameId: string } }) {
	try {
		const { gameId } = params;

		// Parse game ID to get date and teams
		const parts = gameId.split('-');
		if (parts.length < 6) {
			return NextResponse.json({ error: 'Invalid game ID format' }, { status: 400 });
		}

		const date = `${parts[0]}-${parts[1]}-${parts[2]}`;
		const awayCode = parts[3];
		const homeCode = parts[4];

		// Use the Baseball library integration script
		const pythonScript = path.join(process.cwd(), 'lib', 'baseball_json_integration.py');

		return new Promise<NextResponse>((resolve) => {
			const python = spawn('python3', [pythonScript, gameId]);
			let output = '';
			let error = '';

			python.stdout.on('data', (data) => {
				output += data.toString();
			});

			python.stderr.on('data', (data) => {
				error += data.toString();
			});

			python.on('close', (code) => {
				if (code === 0) {
					try {
						const result = JSON.parse(output);
						resolve(NextResponse.json(result));
					} catch (parseError) {
						resolve(
							NextResponse.json(
								{
									error: 'Failed to parse Python output',
									output,
									stderr: error,
								},
								{ status: 500 }
							)
						);
					}
				} else {
					resolve(
						NextResponse.json(
							{
								error: 'Python script failed',
								code,
								error,
							},
							{ status: 500 }
						)
					);
				}
			});
		});
	} catch (error) {
		console.error('Error in detailed game API:', error);
		return NextResponse.json(
			{
				error: 'Internal server error',
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
