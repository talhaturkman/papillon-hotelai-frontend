# Use Node.js 18 slim image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy server source code
COPY server/ ./server/

# Copy service account key
COPY gen-lang-client-0930707875-602c49a9d911.json ./

# Create environment file template
RUN echo "# Environment variables will be set by Cloud Run" > .env

# Expose port 8080 (Cloud Run standard)
EXPOSE 8080

# Set environment variables for Cloud Run
ENV NODE_ENV=production
ENV PORT=8080

# Start the server
CMD ["node", "server/index.js"] 