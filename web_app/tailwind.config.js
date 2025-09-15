/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: 'class',
	content: [
		'./pages/**/*.{js,ts,jsx,tsx,mdx}',
		'./components/**/*.{js,ts,jsx,tsx,mdx}',
		'./app/**/*.{js,ts,jsx,tsx,mdx}',
	],
	theme: {
		extend: {
			colors: {
				// Vintage baseball color palette inspired by Eephus League
				primary: {
					50: '#faf9f7', // Cream white
					100: '#f5f4f2', // Warm off-white
					200: '#e8e6e1', // Light beige
					300: '#d4d0c7', // Muted beige
					400: '#b8b2a6', // Soft brown
					500: '#9c9485', // Medium brown
					600: '#7a6f5e', // Rich brown
					700: '#5d5344', // Dark brown
					800: '#40382e', // Deep brown
					900: '#2d251c', // Very dark brown
				},
				secondary: {
					50: '#fefdfb', // Pure cream
					100: '#faf8f5', // Warm cream
					200: '#f2ede6', // Light cream
					300: '#e6ddd1', // Muted cream
					400: '#d4c7b5', // Soft tan
					500: '#c2b199', // Medium tan
					600: '#a8957a', // Rich tan
					700: '#8b7a63', // Dark tan
					800: '#6b5d4c', // Deep tan
					900: '#4a3f35', // Very dark tan
				},
				accent: {
					50: '#f7f5f0', // Warm accent
					100: '#ede8dd', // Light accent
					200: '#d9d0bf', // Soft accent
					300: '#c4b8a1', // Medium accent
					400: '#a8957a', // Rich accent
					500: '#8b7a63', // Dark accent
					600: '#6b5d4c', // Deep accent
					700: '#4a3f35', // Very dark accent
					800: '#2d251c', // Darkest accent
					900: '#1a1510', // Almost black
				},
				success: {
					50: '#f0f9f0',
					100: '#dcf2dc',
					200: '#b8e5b8',
					300: '#8dd18d',
					400: '#5bb85b',
					500: '#3a9d3a',
					600: '#2d7a2d',
					700: '#245f24',
					800: '#1f4f1f',
					900: '#1a3f1a',
				},
				warning: {
					50: '#fff8e1',
					100: '#ffecb3',
					200: '#ffd54f',
					300: '#ffc107',
					400: '#ffb300',
					500: '#ff8f00',
					600: '#ff6f00',
					700: '#e65100',
					800: '#bf360c',
					900: '#8d1b00',
				},
				error: {
					50: '#ffebee',
					100: '#ffcdd2',
					200: '#ef9a9a',
					300: '#e57373',
					400: '#ef5350',
					500: '#f44336',
					600: '#e53935',
					700: '#d32f2f',
					800: '#c62828',
					900: '#b71c1c',
				},
			},
			fontFamily: {
				sans: ['overpass', '-apple-system', 'Segoe UI', 'sans-serif'],
				serif: ['Pipetton Sans', 'prohibition', 'Arial Black', 'sans-serif'],
				display: ['Pipetton Sans', 'prohibition', 'Arial Black', 'sans-serif'],
				script: ['Pipetton Script', 'cursive'],
				swash: ['Pipetton Swash', 'cursive'],
				mono: ['overpass-mono', 'Courier New', 'monospace'],
			},
			fontSize: {
				'2xs': ['0.625rem', { lineHeight: '0.75rem' }], // 10px
			},
			animation: {
				'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
				'spin-slow': 'spin 3s linear infinite',
			},
			gridTemplateColumns: {
				13: '1.5fr repeat(12, minmax(0, 1fr))',
				14: '1.5fr repeat(13, minmax(0, 1fr))',
				15: '1.5fr repeat(14, minmax(0, 1fr))',
				16: '1.5fr repeat(15, minmax(0, 1fr))',
				17: '1.5fr repeat(16, minmax(0, 1fr))',
				18: '1.5fr repeat(17, minmax(0, 1fr))',
				19: '1.5fr repeat(18, minmax(0, 1fr))',
				20: '1.5fr repeat(19, minmax(0, 1fr))',
			},
		},
	},
	plugins: [],
};
