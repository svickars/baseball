'use client';

import { useEffect, useRef } from 'react';
import { GameData, GameControls } from '@/types';
import { formatDate } from '@/lib/utils';
import { Calendar, MapPin, Users, Clock, Trophy } from 'lucide-react';

interface ScorecardViewerProps {
	gameData: GameData;
	controls: GameControls;
	isLive: boolean;
}

export default function ScorecardViewer({ gameData, controls, isLive }: ScorecardViewerProps) {
	const svgRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (svgRef.current && gameData.svg_content) {
			// Insert SVG content
			svgRef.current.innerHTML = gameData.svg_content;

			// Make SVG responsive
			const svg = svgRef.current.querySelector('svg');
			if (svg) {
				svg.removeAttribute('width');
				svg.removeAttribute('height');
				svg.style.width = '100%';
				svg.style.height = 'auto';
				svg.style.maxWidth = '100%';

				// Add hover effects to interactive elements
				addSVGInteractivity(svg);
			}
		}
	}, [gameData.svg_content]);

	useEffect(() => {
		// Apply controls to SVG
		if (svgRef.current) {
			applyScorecardFilters(svgRef.current, controls);
		}
	}, [controls]);

	const addSVGInteractivity = (svg: SVGElement) => {
		// Add hover effects to player names and stats
		const textElements = svg.querySelectorAll('text');
		textElements.forEach((text) => {
			if (text.textContent && text.textContent.trim()) {
				text.style.cursor = 'pointer';
				text.addEventListener('mouseenter', (e) => {
					const target = e.target as SVGTextElement;
					target.style.fill = '#2563eb';
					target.style.fontWeight = 'bold';
				});
				text.addEventListener('mouseleave', (e) => {
					const target = e.target as SVGTextElement;
					target.style.fill = '';
					target.style.fontWeight = '';
				});
			}
		});

		// Add click handlers for detailed views
		const links = svg.querySelectorAll('a');
		links.forEach((link) => {
			link.addEventListener('click', (e) => {
				e.preventDefault();
				const href = link.getAttribute('xlink:href') || link.getAttribute('href');
				if (href && href.includes('mlb.com/player')) {
					window.open(href, '_blank');
				}
			});
		});
	};

	const applyScorecardFilters = (container: HTMLElement, controls: GameControls) => {
		const svg = container.querySelector('svg');
		if (!svg) return;

		// Apply detail level filtering
		filterByDetailLevel(svg, controls.detailLevel);

		// Apply pitch data filtering
		filterPitchData(svg, controls.showPitchData);

		// Apply player stats filtering
		filterPlayerStats(svg, controls.showPlayerStats);

		// Apply view mode
		applyViewMode(svg, controls.viewMode);
	};

	const filterByDetailLevel = (svg: SVGElement, level: string) => {
		const elements = svg.querySelectorAll('[data-detail]');
		elements.forEach((el) => {
			const detail = el.getAttribute('data-detail');
			const shouldShow = shouldShowDetail(detail, level);
			(el as HTMLElement).style.display = shouldShow ? '' : 'none';
		});
	};

	const shouldShowDetail = (detail: string | null, level: string): boolean => {
		if (!detail) return true;

		const levels = ['basic', 'standard', 'detailed', 'full'];
		const detailLevels = {
			basic: ['basic'],
			standard: ['basic', 'standard'],
			detailed: ['basic', 'standard', 'detailed'],
			full: ['basic', 'standard', 'detailed', 'full'],
		};
		return detailLevels[level as keyof typeof detailLevels]?.includes(detail) || false;
	};

	const filterPitchData = (svg: SVGElement, show: boolean) => {
		const pitchElements = svg.querySelectorAll('[data-type="pitch"]');
		pitchElements.forEach((el) => {
			(el as HTMLElement).style.display = show ? '' : 'none';
		});
	};

	const filterPlayerStats = (svg: SVGElement, show: boolean) => {
		const statElements = svg.querySelectorAll('[data-type="stats"]');
		statElements.forEach((el) => {
			(el as HTMLElement).style.display = show ? '' : 'none';
		});
	};

	const applyViewMode = (svg: SVGElement, mode: string) => {
		// Reset all view modes
		svg.classList.remove('view-scorecard', 'view-stats', 'view-pitch');

		// Apply current view mode
		svg.classList.add(`view-${mode}`);
	};

	return (
		<div className="space-y-8">
			{/* Game Header */}
			<div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
				<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
					<div>
						<h2 className="text-2xl font-bold text-secondary-900 mb-2">
							{gameData.game_data.away_team.name} @ {gameData.game_data.home_team.name}
							{isLive && <span className="live-indicator ml-3">🔴 LIVE</span>}
						</h2>
						<div className="flex items-center gap-4 text-secondary-600">
							<div className="flex items-center gap-1">
								<Calendar className="w-4 h-4" />
								<span>{formatDate(gameData.game_data.game_date_str)}</span>
							</div>
							<div className="flex items-center gap-1">
								<MapPin className="w-4 h-4" />
								<span>{gameData.game_data.location}</span>
							</div>
						</div>
					</div>

					<div className="flex items-center gap-6 text-sm">
						<div className="text-center">
							<div className="text-secondary-500">Away Team</div>
							<div className="font-semibold text-secondary-900">{gameData.game_data.away_team.name}</div>
							<div className="text-secondary-600">({gameData.game_data.away_team.abbreviation})</div>
						</div>
						<div className="text-center">
							<div className="text-secondary-500">Home Team</div>
							<div className="font-semibold text-secondary-900">{gameData.game_data.home_team.name}</div>
							<div className="text-secondary-600">({gameData.game_data.home_team.abbreviation})</div>
						</div>
					</div>
				</div>
			</div>

			{/* Scorecard Container */}
			<div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
				<div className="flex justify-center">
					<div ref={svgRef} className="w-full max-w-6xl" style={{ minHeight: '400px' }} />
				</div>
			</div>

			{/* Game Info Panel */}
			<div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
				<h3 className="text-lg font-semibold text-secondary-900 mb-4">Game Information</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
					<div className="space-y-1">
						<div className="text-xs font-medium text-secondary-500 uppercase tracking-wide">Date</div>
						<div className="text-sm text-secondary-900">{formatDate(gameData.game_data.game_date_str)}</div>
					</div>
					<div className="space-y-1">
						<div className="text-xs font-medium text-secondary-500 uppercase tracking-wide">Location</div>
						<div className="text-sm text-secondary-900">{gameData.game_data.location}</div>
					</div>
					<div className="space-y-1">
						<div className="text-xs font-medium text-secondary-500 uppercase tracking-wide">Innings</div>
						<div className="text-sm text-secondary-900">{gameData.game_data.inning_list.length}</div>
					</div>
					<div className="space-y-1">
						<div className="text-xs font-medium text-secondary-500 uppercase tracking-wide">Status</div>
						<div className="text-sm text-secondary-900">
							{gameData.game_data.is_postponed
								? 'Postponed'
								: gameData.game_data.is_suspended
								? 'Suspended'
								: 'Completed'}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
