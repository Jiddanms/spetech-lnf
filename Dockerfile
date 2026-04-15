
# Use a small Node LTS image
FROM node:18-alpine AS base

WORKDIR /app

# Copy package manifests first to leverage cache
COPY package*.json ./

# Install dependencies:
# - if package-lock.json exists use npm ci for reproducible install
# - otherwise fall back to npm install
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev; \
    fi

# Copy app source
COPY . .

# Use a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && chown -R appuser:appgroup /app
USER appuser

# Expose port (Back4App will inject PORT env)
EXPOSE 3000

# Optional health endpoint check removed to avoid failing if not present
# Start the app
CMD ["npm", "start"]
