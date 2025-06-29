# Use Node.js 18 official image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy server package.json and package-lock.json
COPY server/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy server source code
COPY server/ ./

# Expose port 8080 (Cloud Run standard)
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Start the application
CMD ["node", "index.js"] 