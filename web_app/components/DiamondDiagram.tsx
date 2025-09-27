import React from 'react';

interface PlayerSlot {
	name: string;
	position: string;
	isStarter: boolean;
	isReplacement?: boolean;
	replacementOrder?: number;
	isReplaced?: boolean;
	positionChanges?: Array<{
		position: string;
		inning: number;
		halfInning: string;
	}>;
}

interface DiamondDiagramProps {
	players: PlayerSlot[];
	teamName: string;
	className?: string;
}

const DiamondDiagram: React.FC<DiamondDiagramProps> = ({ players, teamName, className = '' }) => {
	// Group players by position
	const playersByPosition = players.reduce((acc, player) => {
		const pos = player.position;
		if (!acc[pos]) {
			acc[pos] = { starter: null, replacements: [] };
		}
		if (player.isStarter) {
			acc[pos].starter = player;
		} else if (player.isReplacement) {
			acc[pos].replacements.push(player);
		}
		return acc;
	}, {} as Record<string, { starter: PlayerSlot | null; replacements: PlayerSlot[] }>);

	// Truncate text to fit in allocated space
	const truncateText = (text: string, maxLength: number = 25) => {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength - 3) + '...';
	};

	// Get position number from position name
	const getPositionNumber = (position: string): string => {
		const positionMap: Record<string, string> = {
			P: '1',
			C: '2',
			'1B': '3',
			'2B': '4',
			'3B': '5',
			SS: '6',
			LF: '7',
			CF: '8',
			RF: '9',
			// Handle numeric positions
			'1': '1',
			'2': '2',
			'3': '3',
			'4': '4',
			'5': '5',
			'6': '6',
			'7': '7',
			'8': '8',
			'9': '9',
			'10': '10',
		};
		return positionMap[position] || position;
	};

	// Convert numeric position to standard abbreviation for lookup
	const getPositionKey = (position: string): string => {
		const numericToStandard: Record<string, string> = {
			'1': 'P',
			'2': 'C',
			'3': '1B',
			'4': '2B',
			'5': '3B',
			'6': 'SS',
			'7': 'LF',
			'8': 'CF',
			'9': 'RF',
			'10': 'P', // Designated Hitter, treat as Pitcher for display
		};
		return numericToStandard[position] || position;
	};

	return (
		<div className={`w-full h-full ${className}`}>
			<svg width="700" height="395" viewBox="0 0 700 395" fill="none" xmlns="http://www.w3.org/2000/svg">
				<g id="DiamondDiagram" clipPath="url(#clip0_354_982)">
					{/* Diamond outline */}
					<path
						id="Diamond"
						d="M44.3762 52.5625L209.046 217.232M655.624 52.5625L490.954 217.232M209.046 217.232L350 358.186L490.954 217.232M209.046 217.232L350 76.2786L490.954 217.232"
						stroke="currentColor"
						strokeWidth="1"
						className="text-primary-900 dark:text-primary-100"
					/>

					{/* Player Names */}
					<g id="Player Names">
						{/* Position 9 (RF) */}
						<g id="position_9">
							<g id="starter">
								<rect
									id="Rectangle 3"
									x="516.629"
									y="31.2422"
									width="135.132"
									height="18.1533"
									className="fill-primary-100 dark:fill-primary-800"
								/>
								<line
									id="Line 1"
									x1="516.629"
									y1="49.6787"
									x2="651.761"
									y2="49.6787"
									stroke="currentColor"
									strokeWidth="1"
									className="text-primary-900 dark:text-primary-100"
								/>
								<text
									x="584.195"
									y="42.5"
									textAnchor="middle"
									className={`text-xs font-medium fill-primary-900 dark:fill-primary-100 ${
										playersByPosition['9']?.starter?.isReplaced ? 'line-through' : ''
									}`}>
									{playersByPosition['9']?.starter ? truncateText(playersByPosition['9'].starter.name) : ''}
								</text>
								<text
									x="647.446"
									y="38.5"
									textAnchor="middle"
									className="text-[8px] fill-primary-700 dark:fill-primary-100">
									{getPositionNumber('RF')}
								</text>
							</g>

							{/* Replacement 1 */}
							{playersByPosition['9']?.replacements[0] && (
								<g id="replacement_1">
									<rect
										id="Rectangle 3_2"
										x="516.629"
										y="54.8938"
										width="135.132"
										height="18.1533"
										className="fill-primary-100 dark:fill-primary-800"
									/>
									<line
										id="Line 1_2"
										x1="516.629"
										y1="73.3303"
										x2="651.761"
										y2="73.3303"
										stroke="currentColor"
										strokeWidth="1"
										className="text-primary-900 dark:text-primary-100"
									/>
									<text
										x="584.195"
										y="66.2"
										textAnchor="middle"
										className="text-xs font-medium fill-primary-900 dark:fill-primary-100">
										{truncateText(playersByPosition['9'].replacements[0].name)}
									</text>
									<text
										x="647.446"
										y="62.2"
										textAnchor="middle"
										className="text-[8px] fill-primary-700 dark:fill-primary-100">
										{getPositionNumber('RF')}
									</text>
								</g>
							)}

							{/* Replacement 2 */}
							{playersByPosition['9']?.replacements[1] && (
								<g id="replacement_2">
									<rect
										id="Rectangle 3_3"
										x="516.629"
										y="78.5454"
										width="135.132"
										height="18.1533"
										className="fill-primary-100 dark:fill-primary-800"
									/>
									<line
										id="Line 1_3"
										x1="516.629"
										y1="96.9819"
										x2="651.761"
										y2="96.9819"
										stroke="currentColor"
										strokeWidth="1"
										className="text-primary-900 dark:text-primary-100"
									/>
									<text
										x="584.195"
										y="89.9"
										textAnchor="middle"
										className="text-xs font-medium fill-primary-900 dark:fill-primary-100">
										{truncateText(playersByPosition['9'].replacements[1].name)}
									</text>
									<text
										x="647.446"
										y="85.9"
										textAnchor="middle"
										className="text-[8px] fill-primary-700 dark:fill-primary-100">
										{getPositionNumber('RF')}
									</text>
								</g>
							)}
						</g>

						{/* Position 8 (CF) */}
						<g id="position_8">
							<g id="starter_2">
								<rect
									id="Rectangle 3_4"
									x="282.434"
									y="18.8057"
									width="135.132"
									height="18.1533"
									className="fill-primary-100 dark:fill-primary-800"
								/>
								<line
									id="Line 1_4"
									x1="282.434"
									y1="37.2422"
									x2="417.566"
									y2="37.2422"
									stroke="currentColor"
									strokeWidth="1"
									className="text-primary-900 dark:text-primary-100"
								/>
								<text
									x="350"
									y="30.1"
									textAnchor="middle"
									className={`text-xs font-medium fill-primary-900 dark:fill-primary-100 ${
										playersByPosition['8']?.starter?.isReplaced ? 'line-through' : ''
									}`}>
									{playersByPosition['8']?.starter ? truncateText(playersByPosition['8'].starter.name) : ''}
								</text>
								<text
									x="414.142"
									y="26.1"
									textAnchor="middle"
									className="text-[8px] fill-primary-700 dark:fill-primary-100">
									{getPositionNumber('CF')}
								</text>
							</g>

							{/* Replacement 1 */}
							{playersByPosition['8']?.replacements[0] && (
								<g id="replacement_1_2">
									<rect
										id="Rectangle 3_5"
										x="282.434"
										y="42.4573"
										width="135.132"
										height="18.1533"
										className="fill-primary-100 dark:fill-primary-800"
									/>
									<line
										id="Line 1_5"
										x1="282.434"
										y1="60.8938"
										x2="417.566"
										y2="60.8938"
										stroke="currentColor"
										strokeWidth="1"
										className="text-primary-900 dark:text-primary-100"
									/>
									<text
										x="350"
										y="53.7"
										textAnchor="middle"
										className="text-xs font-medium fill-primary-900 dark:fill-primary-100">
										{truncateText(playersByPosition['8'].replacements[0].name)}
									</text>
									<text
										x="414.142"
										y="49.7"
										textAnchor="middle"
										className="text-[8px] fill-primary-700 dark:fill-primary-100">
										{getPositionNumber('CF')}
									</text>
								</g>
							)}

							{/* Replacement 2 */}
							{playersByPosition['8']?.replacements[1] && (
								<g id="replacement_2_2">
									<rect
										id="Rectangle 3_6"
										x="282.434"
										y="66.1089"
										width="135.132"
										height="18.1533"
										className="fill-primary-100 dark:fill-primary-800"
									/>
									<line
										id="Line 1_6"
										x1="282.434"
										y1="84.5454"
										x2="417.566"
										y2="84.5454"
										stroke="currentColor"
										strokeWidth="1"
										className="text-primary-900 dark:text-primary-100"
									/>
									<text
										x="350"
										y="77.4"
										textAnchor="middle"
										className="text-xs font-medium fill-primary-900 dark:fill-primary-100">
										{truncateText(playersByPosition['8'].replacements[1].name)}
									</text>
									<text
										x="414.142"
										y="73.4"
										textAnchor="middle"
										className="text-[8px] fill-primary-700 dark:fill-primary-100">
										{getPositionNumber('CF')}
									</text>
								</g>
							)}
						</g>

						{/* Position 7 (LF) */}
						<g id="position_7">
							<g id="starter_3">
								<rect
									id="Rectangle 3_7"
									x="48.2394"
									y="31.2422"
									width="135.132"
									height="18.1533"
									className="fill-primary-100 dark:fill-primary-800"
								/>
								<line
									id="Line 1_7"
									x1="48.2394"
									y1="49.6787"
									x2="183.371"
									y2="49.6787"
									stroke="currentColor"
									strokeWidth="1"
									className="text-primary-900 dark:text-primary-100"
								/>
								<text
									x="115.805"
									y="42.5"
									textAnchor="middle"
									className={`text-xs font-medium fill-primary-900 dark:fill-primary-100 ${
										playersByPosition['7']?.starter?.isReplaced ? 'line-through' : ''
									}`}>
									{playersByPosition['7']?.starter ? truncateText(playersByPosition['7'].starter.name) : ''}
								</text>
								<text
									x="179.674"
									y="38.5"
									textAnchor="middle"
									className="text-[8px] fill-primary-700 dark:fill-primary-100">
									{getPositionNumber('LF')}
								</text>
							</g>

							{/* Replacement 1 */}
							{playersByPosition['7']?.replacements[0] && (
								<g id="replacement_1_3">
									<rect
										id="Rectangle 3_8"
										x="48.2394"
										y="54.8938"
										width="135.132"
										height="18.1533"
										className="fill-primary-100 dark:fill-primary-800"
									/>
									<line
										id="Line 1_8"
										x1="48.2394"
										y1="73.3303"
										x2="183.371"
										y2="73.3303"
										stroke="currentColor"
										strokeWidth="1"
										className="text-primary-900 dark:text-primary-100"
									/>
									<text
										x="115.805"
										y="66.2"
										textAnchor="middle"
										className="text-xs font-medium fill-primary-900 dark:fill-primary-100">
										{truncateText(playersByPosition['7'].replacements[0].name)}
									</text>
									<text
										x="179.674"
										y="62.2"
										textAnchor="middle"
										className="text-[8px] fill-primary-700 dark:fill-primary-100">
										{getPositionNumber('LF')}
									</text>
								</g>
							)}

							{/* Replacement 2 */}
							{playersByPosition['7']?.replacements[1] && (
								<g id="replacement_2_3">
									<rect
										id="Rectangle 3_9"
										x="48.2394"
										y="78.5454"
										width="135.132"
										height="18.1533"
										className="fill-primary-100 dark:fill-primary-800"
									/>
									<line
										id="Line 1_9"
										x1="48.2394"
										y1="96.9819"
										x2="183.371"
										y2="96.9819"
										stroke="currentColor"
										strokeWidth="1"
										className="text-primary-900 dark:text-primary-100"
									/>
									<text
										x="115.805"
										y="89.9"
										textAnchor="middle"
										className="text-xs font-medium fill-primary-900 dark:fill-primary-100">
										{truncateText(playersByPosition['7'].replacements[1].name)}
									</text>
									<text
										x="179.674"
										y="85.9"
										textAnchor="middle"
										className="text-[8px] fill-primary-700 dark:fill-primary-100">
										{getPositionNumber('LF')}
									</text>
								</g>
							)}
						</g>

						{/* Position 6 (SS) */}
						<g id="position_6">
							<g id="starter_4">
								<rect
									id="Rectangle 3_10"
									x="156.653"
									y="129.597"
									width="135.132"
									height="18.1533"
									className="fill-primary-100 dark:fill-primary-800"
								/>
								<line
									id="Line 1_10"
									x1="156.653"
									y1="148.033"
									x2="291.785"
									y2="148.033"
									stroke="currentColor"
									strokeWidth="1"
									className="text-primary-900 dark:text-primary-100"
								/>
								<text
									x="224.219"
									y="140.9"
									textAnchor="middle"
									className={`text-xs font-medium fill-primary-900 dark:fill-primary-100 ${
										playersByPosition['6']?.starter?.isReplaced ? 'line-through' : ''
									}`}>
									{playersByPosition['6']?.starter ? truncateText(playersByPosition['6'].starter.name) : ''}
								</text>
								<text
									x="288.088"
									y="136.9"
									textAnchor="middle"
									className="text-[8px] fill-primary-700 dark:fill-primary-100">
									{getPositionNumber('SS')}
								</text>
							</g>

							{/* Replacement 1 */}
							{playersByPosition['6']?.replacements[0] && (
								<g id="replacement_1_4">
									<rect
										id="Rectangle 3_11"
										x="156.653"
										y="153.249"
										width="135.132"
										height="18.1533"
										className="fill-primary-100 dark:fill-primary-800"
									/>
									<line
										id="Line 1_11"
										x1="156.653"
										y1="171.685"
										x2="291.785"
										y2="171.685"
										stroke="currentColor"
										strokeWidth="1"
										className="text-primary-900 dark:text-primary-100"
									/>
									<text
										x="224.219"
										y="164.6"
										textAnchor="middle"
										className="text-xs font-medium fill-primary-900 dark:fill-primary-100">
										{truncateText(playersByPosition['6'].replacements[0].name)}
									</text>
									<text
										x="288.088"
										y="160.6"
										textAnchor="middle"
										className="text-[8px] fill-primary-700 dark:fill-primary-100">
										{getPositionNumber('SS')}
									</text>
								</g>
							)}

							{/* Replacement 2 */}
							{playersByPosition['6']?.replacements[1] && (
								<g id="replacement_2_4">
									<rect
										id="Rectangle 3_12"
										x="156.653"
										y="176.9"
										width="135.132"
										height="18.1533"
										className="fill-primary-100 dark:fill-primary-800"
									/>
									<line
										id="Line 1_12"
										x1="156.653"
										y1="195.337"
										x2="291.785"
										y2="195.337"
										stroke="currentColor"
										strokeWidth="1"
										className="text-primary-900 dark:text-primary-100"
									/>
									<text
										x="224.219"
										y="188.3"
										textAnchor="middle"
										className="text-xs font-medium fill-primary-900 dark:fill-primary-100">
										{truncateText(playersByPosition['6'].replacements[1].name)}
									</text>
									<text
										x="288.088"
										y="184.3"
										textAnchor="middle"
										className="text-[8px] fill-primary-700 dark:fill-primary-100">
										{getPositionNumber('SS')}
									</text>
								</g>
							)}
						</g>

						{/* Position 5 (3B) */}
						<g id="position_5">
							<g id="starter_5">
								<rect
									id="Rectangle 3_13"
									x="114.055"
									y="247.307"
									width="135.132"
									height="18.1533"
									className="fill-primary-100 dark:fill-primary-800"
								/>
								<line
									id="Line 1_13"
									x1="114.055"
									y1="265.743"
									x2="249.187"
									y2="265.743"
									stroke="currentColor"
									strokeWidth="1"
									className="text-primary-900 dark:text-primary-100"
								/>
								<text
									x="181.621"
									y="258.6"
									textAnchor="middle"
									className={`text-xs font-medium fill-primary-900 dark:fill-primary-100 ${
										playersByPosition['5']?.starter?.isReplaced ? 'line-through' : ''
									}`}>
									{playersByPosition['5']?.starter ? truncateText(playersByPosition['5'].starter.name) : ''}
								</text>
								<text
									x="245.49"
									y="254.6"
									textAnchor="middle"
									className="text-[8px] fill-primary-700 dark:fill-primary-100">
									{getPositionNumber('3B')}
								</text>
							</g>

							{/* Replacement 1 */}
							{playersByPosition['5']?.replacements[0] && (
								<g id="replacement_1_5">
									<rect
										id="Rectangle 3_14"
										x="114.055"
										y="270.958"
										width="135.132"
										height="18.1533"
										className="fill-primary-100 dark:fill-primary-800"
									/>
									<line
										id="Line 1_14"
										x1="114.055"
										y1="289.395"
										x2="249.187"
										y2="289.395"
										stroke="currentColor"
										strokeWidth="1"
										className="text-primary-900 dark:text-primary-100"
									/>
									<text
										x="181.621"
										y="282.3"
										textAnchor="middle"
										className="text-xs font-medium fill-primary-900 dark:fill-primary-100">
										{truncateText(playersByPosition['5'].replacements[0].name)}
									</text>
									<text
										x="245.49"
										y="278.3"
										textAnchor="middle"
										className="text-[8px] fill-primary-700 dark:fill-primary-100">
										{getPositionNumber('3B')}
									</text>
								</g>
							)}

							{/* Replacement 2 */}
							{playersByPosition['5']?.replacements[1] && (
								<g id="replacement_2_5">
									<rect
										id="Rectangle 3_15"
										x="114.055"
										y="294.61"
										width="135.132"
										height="18.1533"
										className="fill-primary-100 dark:fill-primary-800"
									/>
									<line
										id="Line 1_15"
										x1="114.055"
										y1="313.046"
										x2="249.187"
										y2="313.046"
										stroke="currentColor"
										strokeWidth="1"
										className="text-primary-900 dark:text-primary-100"
									/>
									<text
										x="181.621"
										y="305.9"
										textAnchor="middle"
										className="text-xs font-medium fill-primary-900 dark:fill-primary-100">
										{truncateText(playersByPosition['5'].replacements[1].name)}
									</text>
									<text
										x="245.49"
										y="301.9"
										textAnchor="middle"
										className="text-[8px] fill-primary-700 dark:fill-primary-100">
										{getPositionNumber('3B')}
									</text>
								</g>
							)}
						</g>

						{/* Position 4 (2B) */}
						<g id="position_4">
							<g id="starter_6">
								<rect
									id="Rectangle 3_16"
									x="408.215"
									y="129.597"
									width="135.132"
									height="18.1533"
									className="fill-primary-100 dark:fill-primary-800"
								/>
								<line
									id="Line 1_16"
									x1="408.215"
									y1="148.033"
									x2="543.347"
									y2="148.033"
									stroke="currentColor"
									strokeWidth="1"
									className="text-primary-900 dark:text-primary-100"
								/>
								<text
									x="475.781"
									y="140.9"
									textAnchor="middle"
									className={`text-xs font-medium fill-primary-900 dark:fill-primary-100 ${
										playersByPosition['4']?.starter?.isReplaced ? 'line-through' : ''
									}`}>
									{playersByPosition['4']?.starter ? truncateText(playersByPosition['4'].starter.name) : ''}
								</text>
								<text
									x="539.65"
									y="136.9"
									textAnchor="middle"
									className="text-[8px] fill-primary-700 dark:fill-primary-100">
									{getPositionNumber('2B')}
								</text>
							</g>

							{/* Replacement 1 */}
							{playersByPosition['4']?.replacements[0] && (
								<g id="replacement_1_6">
									<rect
										id="Rectangle 3_17"
										x="408.215"
										y="153.249"
										width="135.132"
										height="18.1533"
										className="fill-primary-100 dark:fill-primary-800"
									/>
									<line
										id="Line 1_17"
										x1="408.215"
										y1="171.685"
										x2="543.347"
										y2="171.685"
										stroke="currentColor"
										strokeWidth="1"
										className="text-primary-900 dark:text-primary-100"
									/>
									<text
										x="475.781"
										y="164.6"
										textAnchor="middle"
										className="text-xs font-medium fill-primary-900 dark:fill-primary-100">
										{truncateText(playersByPosition['4'].replacements[0].name)}
									</text>
									<text
										x="539.65"
										y="160.6"
										textAnchor="middle"
										className="text-[8px] fill-primary-700 dark:fill-primary-100">
										{getPositionNumber('2B')}
									</text>
								</g>
							)}

							{/* Replacement 2 */}
							{playersByPosition['4']?.replacements[1] && (
								<g id="replacement_2_6">
									<rect
										id="Rectangle 3_18"
										x="408.215"
										y="176.9"
										width="135.132"
										height="18.1533"
										className="fill-primary-100 dark:fill-primary-800"
									/>
									<line
										id="Line 1_18"
										x1="408.215"
										y1="195.337"
										x2="543.347"
										y2="195.337"
										stroke="currentColor"
										strokeWidth="1"
										className="text-primary-900 dark:text-primary-100"
									/>
									<text
										x="475.781"
										y="188.3"
										textAnchor="middle"
										className="text-xs font-medium fill-primary-900 dark:fill-primary-100">
										{truncateText(playersByPosition['4'].replacements[1].name)}
									</text>
									<text
										x="539.65"
										y="184.3"
										textAnchor="middle"
										className="text-[8px] fill-primary-700 dark:fill-primary-100">
										{getPositionNumber('2B')}
									</text>
								</g>
							)}
						</g>

						{/* Position 3 (1B) */}
						<g id="position_3">
							<g id="starter_7">
								<rect
									id="Rectangle 3_19"
									x="450.813"
									y="247.307"
									width="135.132"
									height="18.1533"
									className="fill-primary-100 dark:fill-primary-800"
								/>
								<line
									id="Line 1_19"
									x1="450.813"
									y1="265.743"
									x2="585.945"
									y2="265.743"
									stroke="currentColor"
									strokeWidth="1"
									className="text-primary-900 dark:text-primary-100"
								/>
								<text
									x="518.379"
									y="258.6"
									textAnchor="middle"
									className={`text-xs font-medium fill-primary-900 dark:fill-primary-100 ${
										playersByPosition['3']?.starter?.isReplaced ? 'line-through' : ''
									}`}>
									{playersByPosition['3']?.starter ? truncateText(playersByPosition['3'].starter.name) : ''}
								</text>
								<text
									x="582.248"
									y="254.6"
									textAnchor="middle"
									className="text-[8px] fill-primary-700 dark:fill-primary-100">
									{getPositionNumber('1B')}
								</text>
							</g>

							{/* Replacement 1 */}
							{playersByPosition['3']?.replacements[0] && (
								<g id="replacement_1_7">
									<rect
										id="Rectangle 3_20"
										x="450.813"
										y="270.958"
										width="135.132"
										height="18.1533"
										className="fill-primary-100 dark:fill-primary-800"
									/>
									<line
										id="Line 1_20"
										x1="450.813"
										y1="289.395"
										x2="585.945"
										y2="289.395"
										stroke="currentColor"
										strokeWidth="1"
										className="text-primary-900 dark:text-primary-100"
									/>
									<text
										x="518.379"
										y="282.3"
										textAnchor="middle"
										className="text-xs font-medium fill-primary-900 dark:fill-primary-100">
										{truncateText(playersByPosition['3'].replacements[0].name)}
									</text>
									<text
										x="582.248"
										y="278.3"
										textAnchor="middle"
										className="text-[8px] fill-primary-700 dark:fill-primary-100">
										{getPositionNumber('1B')}
									</text>
								</g>
							)}

							{/* Replacement 2 */}
							{playersByPosition['3']?.replacements[1] && (
								<g id="replacement_2_7">
									<rect
										id="Rectangle 3_21"
										x="450.813"
										y="294.61"
										width="135.132"
										height="18.1533"
										className="fill-primary-100 dark:fill-primary-800"
									/>
									<line
										id="Line 1_21"
										x1="450.813"
										y1="313.046"
										x2="585.945"
										y2="313.046"
										stroke="currentColor"
										strokeWidth="1"
										className="text-primary-900 dark:text-primary-100"
									/>
									<text
										x="518.379"
										y="305.9"
										textAnchor="middle"
										className="text-xs font-medium fill-primary-900 dark:fill-primary-100">
										{truncateText(playersByPosition['3'].replacements[1].name)}
									</text>
									<text
										x="582.248"
										y="301.9"
										textAnchor="middle"
										className="text-[8px] fill-primary-700 dark:fill-primary-100">
										{getPositionNumber('1B')}
									</text>
								</g>
							)}
						</g>

						{/* Position 2 (C) */}
						<g id="position_2">
							<g id="starter_8">
								<rect
									id="Rectangle 3_22"
									x="282.434"
									y="330.26"
									width="135.132"
									height="18.1533"
									className="fill-primary-100 dark:fill-primary-800"
								/>
								<line
									id="Line 1_22"
									x1="282.434"
									y1="348.697"
									x2="417.566"
									y2="348.697"
									stroke="currentColor"
									strokeWidth="1"
									className="text-primary-900 dark:text-primary-100"
								/>
								<text
									x="350"
									y="341.6"
									textAnchor="middle"
									className={`text-xs font-medium fill-primary-900 dark:fill-primary-100 ${
										playersByPosition['2']?.starter?.isReplaced ? 'line-through' : ''
									}`}>
									{playersByPosition['2']?.starter ? truncateText(playersByPosition['2'].starter.name) : ''}
								</text>
								<text
									x="414.142"
									y="337.6"
									textAnchor="middle"
									className="text-[8px] fill-primary-700 dark:fill-primary-100">
									{getPositionNumber('C')}
								</text>
							</g>

							{/* Replacement 1 */}
							{playersByPosition['2']?.replacements[0] && (
								<g id="replacement_1_8">
									<rect
										id="Rectangle 3_23"
										x="282.434"
										y="353.912"
										width="135.132"
										height="18.1533"
										className="fill-primary-100 dark:fill-primary-800"
									/>
									<line
										id="Line 1_23"
										x1="282.434"
										y1="372.348"
										x2="417.566"
										y2="372.348"
										stroke="currentColor"
										strokeWidth="1"
										className="text-primary-900 dark:text-primary-100"
									/>
									<text
										x="350"
										y="365.3"
										textAnchor="middle"
										className="text-xs font-medium fill-primary-900 dark:fill-primary-100">
										{truncateText(playersByPosition['2'].replacements[0].name)}
									</text>
									<text
										x="414.142"
										y="361.3"
										textAnchor="middle"
										className="text-[8px] fill-primary-700 dark:fill-primary-100">
										{getPositionNumber('C')}
									</text>
								</g>
							)}

							{/* Replacement 2 */}
							{playersByPosition['2']?.replacements[1] && (
								<g id="replacement_2_8">
									<rect
										id="Rectangle 3_24"
										x="282.434"
										y="377.563"
										width="135.132"
										height="18.1533"
										className="fill-primary-100 dark:fill-primary-800"
									/>
									<line
										id="Line 1_24"
										x1="282.434"
										y1="396"
										x2="417.566"
										y2="396"
										stroke="currentColor"
										strokeWidth="1"
										className="text-primary-900 dark:text-primary-100"
									/>
									<text
										x="350"
										y="388.9"
										textAnchor="middle"
										className="text-xs font-medium fill-primary-900 dark:fill-primary-100">
										{truncateText(playersByPosition['2'].replacements[1].name)}
									</text>
									<text
										x="414.142"
										y="384.9"
										textAnchor="middle"
										className="text-[8px] fill-primary-700 dark:fill-primary-100">
										{getPositionNumber('C')}
									</text>
								</g>
							)}
						</g>
					</g>
				</g>

				{/* Clip path definition */}
				<defs>
					<clipPath id="clip0_354_982">
						<rect width="700" height="395" fill="white" />
					</clipPath>
				</defs>
			</svg>
		</div>
	);
};

export default DiamondDiagram;
