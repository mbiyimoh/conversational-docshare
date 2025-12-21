# Multi-stage build for Node.js backend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy Prisma schema for migrations
COPY prisma ./prisma

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Generate Prisma client in production image
RUN npx prisma generate

# Create uploads directory
RUN mkdir -p /app/uploads

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership (including uploads directory)
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 4000

# Run migrations and start server
CMD npx prisma migrate deploy && node dist/index.js
