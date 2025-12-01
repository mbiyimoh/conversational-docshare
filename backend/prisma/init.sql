-- Initialize PostgreSQL database with pgvector extension
-- Run this before running Prisma migrations

-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is installed
SELECT * FROM pg_extension WHERE extname = 'vector';
