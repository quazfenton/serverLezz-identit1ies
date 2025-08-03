# Multi-stage build for production optimization
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install PM2 globally
RUN npm install -g pm2

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S orchestrator -u 1001

# Copy built application
COPY --from=builder --chown=orchestrator:nodejs /app/dist ./dist
COPY --from=builder --chown=orchestrator:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=orchestrator:nodejs /app/package*.json ./
COPY --from=builder --chown=orchestrator:nodejs /app/ecosystem.config.js ./

# Create necessary directories
RUN mkdir -p logs data && \
    chown -R orchestrator:nodejs logs data

# Switch to non-root user
USER orchestrator

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { \
    if (res.statusCode === 200) process.exit(0); else process.exit(1); \
  }).on('error', () => process.exit(1));"

# Start the application with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]

# Development stage
FROM node:18-alpine AS development

WORKDIR /app

# Install dependencies including dev dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Start in development mode
CMD ["npm", "run", "dev"]