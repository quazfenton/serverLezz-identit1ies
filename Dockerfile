# ═══════════════════════════════════════════════════════════════════════════════
# Coordination Cosmos - Production Dockerfile
# Multi-stage build for optimized production image
# ═══════════════════════════════════════════════════════════════════════════════

# ───────────────────────────────────────────────────────────────────────────────
# Stage 1: Base - Install dependencies
# ───────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

# Install packages needed for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# ───────────────────────────────────────────────────────────────────────────────
# Stage 2: Dependencies - Install all dependencies
# ───────────────────────────────────────────────────────────────────────────────
FROM base AS dependencies

# Install all dependencies (including devDependencies for build)
RUN npm ci

# ───────────────────────────────────────────────────────────────────────────────
# Stage 3: Build - Compile TypeScript
# ───────────────────────────────────────────────────────────────────────────────
FROM dependencies AS build

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# ───────────────────────────────────────────────────────────────────────────────
# Stage 4: Production - Create minimal production image
# ───────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Install packages needed for runtime
RUN apk add --no-cache libc6-compat openssl

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3003
ENV WS_PORT=8080

# Copy package files
COPY --from=dependencies /app/package*.json ./
COPY --from=dependencies /app/node_modules ./node_modules

# Copy built files
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/frontend ./frontend

# Copy Prisma client (generated during build)
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose ports
EXPOSE 3003 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3003/api/system/health || exit 1

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/backend/server.js"]

# ───────────────────────────────────────────────────────────────────────────────
# Stage 5: Development - Development image with hot reload
# ───────────────────────────────────────────────────────────────────────────────
FROM base AS development

# Install ts-node-dev for hot reload
RUN npm install -g ts-node-dev

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code
COPY . .

# Set environment variables
ENV NODE_ENV=development
ENV PORT=3003
ENV WS_PORT=8080

# Expose ports
EXPOSE 3003 8080

# Run with hot reload
CMD ["npm", "run", "dev"]
