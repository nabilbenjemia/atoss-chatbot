###############################
# User Service Dockerfile
# Multi-stage build for production & optional dev usage
# Targets Node LTS (20) for stability despite local Node 25 usage
###############################

ARG NODE_VERSION=20-alpine
FROM node:${NODE_VERSION} AS deps
LABEL org.opencontainers.image.source="https://github.com/atoss-gpt/user-service" \
      org.opencontainers.image.description="ATOSS GPT User Service" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Copy dependency manifests first (leverage Docker layer caching)
COPY package*.json ./

# Accept build arg to optionally include dev deps (e.g. nodemon)
ARG INSTALL_DEV=false
ENV NODE_ENV=production
RUN if [ "$INSTALL_DEV" = "true" ]; then \
      npm ci; \
    else \
      npm ci --omit=dev; \
    fi && npm cache clean --force

# Copy source code
COPY src ./src

###############################
# Final runtime image (slim, non-root)
###############################
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Copy only built app + production node_modules
COPY --from=deps /app /app

# Use the pre-created 'node' user from official image for better security
USER node

# Expose service port
EXPOSE 4001

# Health check (short timeout; triggers restart if unhealthy)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4001/health', r => { if (r.statusCode !== 200) { throw new Error('Health ' + r.statusCode); } }).on('error', e => { throw e })"

# Start application (no shell wrapping)
CMD ["node", "src/index.js"]

###############################
# Build examples:
# Production (default):
#   docker build -t user-service .
# Include dev deps (nodemon etc):
#   docker build --build-arg INSTALL_DEV=true -t user-service-dev .
###############################
