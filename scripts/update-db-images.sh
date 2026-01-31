#!/bin/bash
# Script to update database images and perform necessary maintenance

echo "🔄 Updating PostgreSQL and Redis Docker images to latest versions..."

# Pull the latest images
echo "🐳 Pulling latest PostgreSQL and Redis images..."
docker pull postgres:18.1-alpine
docker pull redis:7.2.8-alpine

# Stop existing containers
echo "⏹️ Stopping existing containers..."
docker-compose down

# Remove old images (optional, to save space)
echo "🧹 Cleaning up old images..."
docker image prune -f

# Start services with new images
echo "🚀 Starting services with updated images..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
echo "🔍 Checking service status..."
docker-compose ps

# Run database migrations if needed
echo "🗄️ Running database migrations (if any)..."
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma generate

echo "✅ Database images updated successfully!"
echo "📈 PostgreSQL: Updated to 18.1-alpine"
echo "⚡ Redis: Updated to 7.2.8-alpine"