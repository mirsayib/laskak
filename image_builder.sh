#!/bin/bash

# Define the services and their respective ports

# Base image name
BASE_IMAGE_NAME="takemi085/laskak"

# Build and tag custom postgres image in one command
podman build -t "docker.io/takemi085/laskak:postgresql" -f "services/dockerfiles/postgres/Dockerfile"

# Push the postgres image
echo "Pushing postgres image..."
podman push "docker.io/takemi085/laskak:postgresql"

# List of services
services=(
    "user-service"
    "order-service"
    "payment-service"
    "product-service"
    "shopping-cart-service"
)

# Iterate over each service and build the Docker image
for service in "${services[@]}"; do
    echo "Building image for $service..."
    podman build -t "docker.io/$BASE_IMAGE_NAME:$service" -f "services/$service/Dockerfile"
    
    # Push the image
    echo "Pushing image for $service..."
    podman push "docker.io/$BASE_IMAGE_NAME:$service"
done

echo "All images built and pushed successfully."
