# Use official Node.js LTS image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Install ffmpeg (includes ffprobe)
RUN apt-get update && apt-get install -y ffmpeg

# Copy the rest of the application code
COPY . .

# Expose the port (change if your service uses a different port)
EXPOSE 4005

# Start the service
CMD ["npm", "start"]