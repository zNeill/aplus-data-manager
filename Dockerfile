# Use a lightweight Node.js base image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Install nodemon for hot-reloading (for development)
RUN npm install -g nodemon

# Expose the port
EXPOSE 5000

# Start the application
CMD ["node", "src/server.js"]
