FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built files
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./
COPY --from=base /app/frontend ./frontend
COPY --from=base /app/prisma ./prisma

# Expose ports
EXPOSE 3000 8080

# Run the server
CMD ["node", "dist/backend/server.js"]
