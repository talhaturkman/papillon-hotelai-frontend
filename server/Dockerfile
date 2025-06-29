# Use Node.js 18 slim image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy root package.json for dependency management
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy server source code
COPY server/ ./server/

# Copy service account key from root
COPY gen-lang-client-0930707875-602c49a9d911.json ./

# Copy environment file from root
COPY .env ./

# Expose port 8080 (Cloud Run standard)
EXPOSE 8080

# Set environment variables for Cloud Run
ENV NODE_ENV=production
ENV PORT=8080

# Start the server from server directory
CMD ["node", "server/index.js"] 