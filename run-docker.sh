#!/bin/bash

# Stop and remove existing container if it exists
echo "Stopping and removing existing container..."
docker stop barreiros-threeai-container 2>/dev/null || true
docker rm barreiros-threeai-container 2>/dev/null || true

# Build the Docker image
echo "Building Docker image..."
docker build -t barreiros-threeai .

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "Build successful! Starting container..."
    
    # Run the container with environment variables from .env file
    docker run -p 80:3001 -p 443:3001 \
        --env-file .env \
        --name barreiros-threeai-container \
        barreiros-threeai
else
    echo "Build failed!"
    exit 1
fi
