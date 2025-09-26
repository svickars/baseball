export interface PitchData {
	pitchNumber: number;
	pitchType: string;
	speed: number;
	result: string;
	count: { balls: number; strikes: number };
	description: string;
	isStrike: boolean;
	isBall: boolean;
	isFoul: boolean;
	isInPlay: boolean;
}

export interface AtBatPitchSequence {
	atBatIndex: number;
	batter: string;
	pitcher: string;
	finalResult: string;
	pitches: PitchData[];
	inning: number;
	halfInning: string;
	totalPitches: number;
}

export const extractPitchSequence = (atBat: any): AtBatPitchSequence | null => {
	if (!atBat.playEvents || !atBat.pitchIndex) {
		return null;
	}

	// Filter and process pitch events
	const pitchEvents = atBat.playEvents.filter((event: any) => event.isPitch && event.type === 'pitch');

	const pitches: PitchData[] = pitchEvents.map((pitch: any) => ({
		pitchNumber: pitch.pitchNumber || 0,
		pitchType: pitch.details?.type?.description || 'Unknown',
		speed: pitch.pitchData?.startSpeed || 0,
		result: pitch.details?.call?.description || pitch.details?.description || '',
		count: {
			balls: pitch.count?.balls || 0,
			strikes: pitch.count?.strikes || 0,
		},
		description: pitch.details?.description || '',
		isStrike: pitch.details?.isStrike || false,
		isBall: pitch.details?.isBall || false,
		isFoul: pitch.details?.call?.code === 'F' || pitch.details?.description?.toLowerCase().includes('foul'),
		isInPlay: pitch.details?.isInPlay || false,
	}));

	return {
		atBatIndex: atBat.about?.atBatIndex || 0,
		batter: atBat.matchup?.batter?.fullName || '',
		pitcher: atBat.matchup?.pitcher?.fullName || '',
		finalResult: atBat.result?.event || '',
		pitches,
		inning: atBat.about?.inning || 0,
		halfInning: atBat.about?.halfInning || '',
		totalPitches: pitches.length,
	};
};

export const getAllPitchSequences = (gameData: any): Map<string, AtBatPitchSequence> => {
	const sequences = new Map<string, AtBatPitchSequence>();

	// Try both possible data paths
	const allPlays = gameData?.liveData?.plays?.allPlays || gameData?.game_data?.liveData?.plays?.allPlays;

	if (!allPlays) {
		return sequences;
	}

	allPlays.forEach((play: any) => {
		if (play.result?.type === 'atBat') {
			const sequence = extractPitchSequence(play);
			if (sequence) {
				// Create a key based on batter name, inning, and half-inning
				// This matches how the scorecard identifies cells: (batter, inning, halfInning)
				const key = `${sequence.batter}-${sequence.inning}-${sequence.halfInning}`;
				sequences.set(key, sequence);
			}
		}
	});

	return sequences;
};

export const getPitchSequenceForAtBat = (
	pitchSequences: Map<string, AtBatPitchSequence>,
	batterName: string,
	inning: number,
	halfInning: string
): AtBatPitchSequence | null => {
	const key = `${batterName}-${inning}-${halfInning}`;
	return pitchSequences.get(key) || null;
};

export const getPitchSequenceDisplay = (sequence: AtBatPitchSequence | null) => {
	if (!sequence || sequence.pitches.length === 0) {
		return {
			balls: [],
			strikeEvents: [],
			inPlay: false,
		};
	}

	const balls: number[] = [];
	const strikeEvents: Array<{ pitchNumber: number; isFoul: boolean }> = [];
	let inPlay = false;

	sequence.pitches.forEach((pitch, index) => {
		const pitchNumber = index + 1;

		if (pitch.isBall) {
			balls.push(pitchNumber);
		} else if (pitch.isFoul || pitch.isStrike) {
			strikeEvents.push({ pitchNumber, isFoul: pitch.isFoul });
		}

		if (pitch.isInPlay) {
			inPlay = true;
		}
	});

	// Sort strike events to maintain sequential order
	strikeEvents.sort((a, b) => a.pitchNumber - b.pitchNumber);

	return {
		balls,
		strikeEvents,
		inPlay,
	};
};
