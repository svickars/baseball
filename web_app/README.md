# Baseball Scorecard Viewer - Next.js

A modern React/Next.js web application for viewing baseball scorecards with live updates, built with TypeScript and Tailwind CSS.

## Features

- 🏟️ **Game Browser**: Browse games by date with a clean, responsive interface
- 📊 **Interactive Scorecards**: View detailed SVG scorecards with hover effects
- 🔴 **Live Updates**: Real-time game updates with configurable delays
- 🎛️ **Customizable Controls**: Adjust detail level, view mode, and data display
- 📱 **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- ⚡ **Fast Performance**: Built with Next.js 14 and optimized for speed
- 🎨 **Modern UI**: Beautiful design with Tailwind CSS

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Date Handling**: date-fns
- **HTTP Client**: Axios
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Access to the baseball library (from the parent directory)

### Installation

1. **Install dependencies**:

   ```bash
   cd web_app
   npm install
   ```

2. **Set up environment variables**:

   ```bash
   cp env.example .env.local
   ```

   Update `.env.local` with your configuration:

   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3000
   BASEBALL_LIB_PATH=../baseball
   ```

3. **Start the development server**:

   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

### Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Type checking
npm run type-check
```

## Project Structure

```
web_app/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── DatePicker.tsx
│   ├── GamesList.tsx
│   ├── GameControls.tsx
│   ├── ScorecardViewer.tsx
│   ├── Header.tsx
│   ├── HelpModal.tsx
│   ├── LoadingSpinner.tsx
│   └── ErrorMessage.tsx
├── hooks/                 # Custom React hooks
│   └── useBaseballApp.ts
├── lib/                   # Utility libraries
│   ├── api.ts
│   ├── baseball-service.ts
│   └── utils.ts
├── types/                 # TypeScript type definitions
│   └── index.ts
└── public/               # Static assets
```

## API Routes

The application includes the following API routes that replace the Flask endpoints:

- `GET /api/games/[date]` - Get games for a specific date
- `GET /api/game/[gameId]` - Get detailed game data and SVG
- `GET /api/game/[gameId]/svg` - Get just the SVG content
- `GET /api/teams` - Get list of MLB teams
- `GET /api/today` - Get today's games
- `GET /api/health` - Health check endpoint

## Live Updates

The application includes sophisticated live update functionality:

- **Auto-refresh**: Games list refreshes every 30 seconds for live games
- **Live data collection**: Individual games update every 10 seconds
- **Configurable delays**: Simulate live viewing with delays from 0 to 10 minutes
- **Buffer management**: Delayed updates are buffered and displayed at the right time

## Deployment

### Vercel (Recommended)

1. **Connect your repository** to Vercel
2. **Set environment variables** in Vercel dashboard:
   - `BASEBALL_LIB_PATH`: `../baseball`
   - `NEXT_PUBLIC_API_URL`: Your production URL
3. **Deploy**: Vercel will automatically build and deploy

### Manual Deployment

1. **Build the application**:

   ```bash
   npm run build
   ```

2. **Deploy the `.next` folder** to your hosting provider

## Configuration

### Environment Variables

- `NEXT_PUBLIC_API_URL`: Base URL for API calls (default: current domain)
- `BASEBALL_LIB_PATH`: Path to the baseball library (default: `../baseball`)
- `DEBUG`: Enable debug logging (default: `false`)

### Customization

- **Styling**: Modify `tailwind.config.js` for theme customization
- **Components**: All components are in the `components/` directory
- **API**: Baseball service integration is in `lib/baseball-service.ts`

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:

1. Check the existing issues
2. Create a new issue with detailed information
3. Include browser console logs for debugging
