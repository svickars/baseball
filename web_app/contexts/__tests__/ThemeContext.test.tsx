import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeContext';

// Mock localStorage
const localStorageMock = {
	getItem: jest.fn(),
	setItem: jest.fn(),
	removeItem: jest.fn(),
	clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
	value: localStorageMock,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: jest.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: jest.fn(),
		removeListener: jest.fn(),
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
		dispatchEvent: jest.fn(),
	})),
});

// Test component that uses the theme context
function TestComponent() {
	const { theme, toggleTheme } = useTheme();
	return (
		<div>
			<span data-testid="theme">{theme}</span>
			<button data-testid="toggle" onClick={toggleTheme}>
				Toggle Theme
			</button>
		</div>
	);
}

describe('ThemeContext', () => {
	beforeEach(() => {
		localStorageMock.getItem.mockClear();
		localStorageMock.setItem.mockClear();
	});

	it('should default to light theme when no saved preference', () => {
		localStorageMock.getItem.mockReturnValue(null);

		render(
			<ThemeProvider>
				<TestComponent />
			</ThemeProvider>
		);

		expect(screen.getByTestId('theme')).toHaveTextContent('light');
	});

	it('should use saved theme preference', () => {
		localStorageMock.getItem.mockReturnValue('dark');

		render(
			<ThemeProvider>
				<TestComponent />
			</ThemeProvider>
		);

		expect(screen.getByTestId('theme')).toHaveTextContent('dark');
	});

	it('should toggle theme when button is clicked', () => {
		localStorageMock.getItem.mockReturnValue('light');

		render(
			<ThemeProvider>
				<TestComponent />
			</ThemeProvider>
		);

		expect(screen.getByTestId('theme')).toHaveTextContent('light');

		fireEvent.click(screen.getByTestId('toggle'));

		expect(screen.getByTestId('theme')).toHaveTextContent('dark');
		expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
	});
});
