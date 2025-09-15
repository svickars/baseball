#!/bin/bash

# Setup script for Caught Looking Next.js app

echo "🏟️  Setting up Caught Looking..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the web_app directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create environment file if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo "⚙️  Creating environment file..."
    cp env.example .env.local
    echo "✅ Created .env.local - please review and update if needed"
else
    echo "✅ Environment file already exists"
fi

# Check if baseball library exists
if [ ! -d "../baseball" ]; then
    echo "⚠️  Warning: Baseball library not found at ../baseball"
    echo "   Please ensure the baseball library is in the parent directory"
else
    echo "✅ Baseball library found"
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p public/images
mkdir -p .next

echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Review .env.local and update if needed"
echo "2. Run 'npm run dev' to start development server"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "For deployment to Vercel:"
echo "1. Push your code to GitHub"
echo "2. Connect your repository to Vercel"
echo "3. Set environment variables in Vercel dashboard"
echo "4. Deploy!"
