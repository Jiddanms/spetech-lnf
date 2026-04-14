
# Use official Node LTS image as build base
FROM node:18-alpine AS builder

# Create app directory
WORKDIR /app

# Copy package manifests first to leverage Docker layer cache
COPY package*.json ./

# Install dependencies (production only)
RUN npm install --omit=dev

# Copy app source
COPY . .

# Final runtime image (smaller, non-root)
FROM node:18-alpine

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy installed node_modules and app from builder
COPY --from=builder /app ./

# Ensure node_modules owned by non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port (Back4App will inject PORT env)
EXPOSE 3000

# Healthcheck (optional but useful)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- --timeout=2 http://127.0.0.1:${PORT:-3000}/health || exit 1

# Start the app using npm script
CMD ["npm", "start"]
