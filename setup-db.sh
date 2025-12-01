#!/bin/bash

# Database Setup Script
# Run this once to set up your Supabase database

set -e  # Exit on error

echo "🗄️  Setting up Supabase Database"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please copy .env.example to .env and configure your DATABASE_URL"
    exit 1
fi

# Load environment variables
echo "📋 Loading environment variables..."
export $(cat .env | grep -v '^#' | xargs)

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set in .env"
    exit 1
fi

echo "✅ Environment variables loaded"
echo ""

# Enable pgvector extension (required for document embeddings)
echo "🔧 Checking pgvector extension..."
echo ""
echo "⚠️  IMPORTANT: You need to enable the pgvector extension in Supabase"
echo ""
echo "Steps:"
echo "1. Go to your Supabase dashboard"
echo "2. Click 'SQL Editor' in the sidebar"
echo "3. Click 'New query'"
echo "4. Run this SQL:"
echo ""
echo "   CREATE EXTENSION IF NOT EXISTS vector;"
echo ""
read -p "Press Enter once you've enabled pgvector in Supabase... "

# Run Prisma migrations
echo ""
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

# Test database connection
echo "🔍 Testing database connection..."
npx prisma db execute --stdin <<SQL
SELECT version();
SQL
echo "✅ Database connection successful!"
echo ""

echo "✅ Database setup complete!"
echo ""
echo "You can now start the development server with:"
echo "  ./start-dev.sh"
