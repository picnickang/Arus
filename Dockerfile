# Multi-stage build for ARUS (Marine Predictive Maintenance & Scheduling)
# Use Debian-based image for TensorFlow.js compatibility (requires glibc)
FROM node:20-slim AS builder

# Install dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
# NOSONAR: S5996 - Sensitive files excluded via .dockerignore
# The .dockerignore file prevents .env, secrets, test files, and node_modules from being copied
COPY . .

# Build the application
RUN echo "Building frontend..." && \
    npx vite build && \
    echo "Building backend..." && \
    node esbuild.config.js && \
    echo "Build complete!"

# Production stage
# Use Debian-based image for TensorFlow.js native dependencies
FROM node:20-slim AS production

# Install runtime dependencies for TensorFlow.js
RUN apt-get update && apt-get install -y \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -g 1001 nodejs
RUN useradd -u 1001 -g nodejs -s /bin/bash arus

WORKDIR /app

# CRITICAL FIX: Copy node_modules from builder instead of reinstalling
# This preserves the successfully-built native modules (TensorFlow, etc.)
# Reinstalling in production without python3/make/g++ causes native modules to fail
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Change ownership to non-root user
RUN chown -R arus:nodejs /app
USER arus

# Expose the application port
EXPOSE 5000

# Health check disabled - Render provides its own health monitoring
# The /api/health endpoint requires authentication which conflicts with Docker healthchecks

# Start the application
CMD ["node", "dist/index.js"]