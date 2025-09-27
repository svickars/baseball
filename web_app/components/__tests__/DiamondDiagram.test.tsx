import React from 'react';
import { render, screen } from '@testing-library/react';
import DiamondDiagram from '../DiamondDiagram';

// Mock data for testing
const mockPlayers = [
	{ name: 'John Smith', position: 'P', isStarter: true },
	{ name: 'Mike Johnson', position: 'C', isStarter: true },
	{ name: 'Tom Wilson', position: '1B', isStarter: true },
	{ name: 'Bob Davis', position: '2B', isStarter: true },
	{ name: 'Jim Brown', position: '3B', isStarter: true },
	{ name: 'Steve Miller', position: 'SS', isStarter: true },
	{ name: 'Dave Jones', position: 'LF', isStarter: true },
	{ name: 'Paul White', position: 'CF', isStarter: true },
	{ name: 'Mark Green', position: 'RF', isStarter: true },
	// Add some replacements
	{ name: 'Replacement Player', position: 'RF', isStarter: false, isReplacement: true, replacementOrder: 1 },
];

describe('DiamondDiagram', () => {
	it('renders without crashing', () => {
		render(<DiamondDiagram players={mockPlayers} teamName="Test Team" />);
		expect(screen.getByRole('img')).toBeInTheDocument();
	});

	it('displays player names correctly', () => {
		render(<DiamondDiagram players={mockPlayers} teamName="Test Team" />);

		// Check that starter names are displayed
		expect(screen.getByText('John Smith')).toBeInTheDocument();
		expect(screen.getByText('Mike Johnson')).toBeInTheDocument();
		expect(screen.getByText('Tom Wilson')).toBeInTheDocument();
	});

	it('truncates long names', () => {
		const longNamePlayers = [
			{ name: 'ThisIsAVeryLongPlayerNameThatShouldBeTruncated', position: 'P', isStarter: true },
		];

		render(<DiamondDiagram players={longNamePlayers} teamName="Test Team" />);

		// The name should be truncated
		expect(screen.getByText(/ThisIsAVeryLon.../)).toBeInTheDocument();
	});

	it('applies theme classes correctly', () => {
		render(<DiamondDiagram players={mockPlayers} teamName="Test Team" />);

		// Check that theme classes are applied
		const svg = screen.getByRole('img');
		expect(svg).toHaveClass('text-primary-900', 'dark:text-primary-100');
	});
});
