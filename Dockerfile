# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-slim AS runner

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Install Playwright browsers
RUN npx playwright install chromium --with-deps

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prompts ./prompts
COPY --from=builder /app/configs ./configs

# Create non-root user for security
RUN groupadd -r valyrian && useradd -r -g valyrian valyrian
RUN mkdir -p /app/audit-logs && chown -R valyrian:valyrian /app
USER valyrian

# Environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Default command
ENTRYPOINT ["node", "dist/cli/index.js"]
CMD ["--help"]
