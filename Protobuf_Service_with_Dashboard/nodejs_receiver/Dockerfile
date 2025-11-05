# Multi-stage build for optimized container
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    sqlite-dev \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
# Remove package-lock.json if it exists to avoid sync issues, then install
RUN rm -f package-lock.json && npm install --omit=dev && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    sqlite \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Create directories and set permissions
RUN mkdir -p /app/database /app/logs && \
    chown -R nodejs:nodejs /app && \
    chmod 755 /app/database /app/logs

USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"] 