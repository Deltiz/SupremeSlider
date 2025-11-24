# Use Node.js 24
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy all project files
COPY . .

# Expose port 8080
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
