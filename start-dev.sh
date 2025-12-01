#!/bin/bash

# Conversational DocShare - Development Startup Script
# This script sets up and starts the development environment

set -e  # Exit on error

echo "🚀 Starting Conversational DocShare Development Environment"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please copy .env.example to .env and configure your settings"
    exit 1
fi

# Load environment variables
echo "📋 Loading environment variables..."
export $(cat .env | grep -v '^#' | xargs)

# Check required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set in .env"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ Error: OPENAI_API_KEY not set in .env"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "❌ Error: JWT_SECRET not set in .env"
    exit 1
fi

echo "✅ Environment variables loaded"
echo ""

# Run Prisma migrations
echo "🗄️  Running database migrations..."
cd backend
npx prisma migrate deploy
echo "✅ Database migrations complete"
echo ""

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate
echo "✅ Prisma client generated"
echo ""

# Go back to root
cd ..

# Start backend and frontend in parallel
echo "🎯 Starting backend and frontend servers..."
echo ""
echo "Backend will be available at: http://localhost:4000"
echo "Frontend will be available at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Start both servers using npm-run-all or concurrently if available
# Otherwise, provide instructions
if command -v npx &> /dev/null; then
    # Use concurrently to run both
    npx concurrently \
        --names "BACKEND,FRONTEND" \
        --prefix-colors "blue,green" \
        "cd backend && npm run dev" \
        "cd frontend && npm run dev"
else
    echo "⚠️  Please open two terminal windows:"
    echo ""
    echo "Terminal 1 (Backend):"
    echo "  cd backend && npm run dev"
    echo ""
    echo "Terminal 2 (Frontend):"
    echo "  cd frontend && npm run dev"
fi
