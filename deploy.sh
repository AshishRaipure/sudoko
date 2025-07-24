#!/bin/bash

# Production Deployment Script for Sudoku Game
echo "🚀 Starting production deployment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create logs directory
mkdir -p logs

# Set production environment variables
export FLASK_ENV=production
export SECRET_KEY=$(openssl rand -hex 32)

echo "🔧 Building Docker image..."
docker-compose build

echo "🚀 Starting services..."
docker-compose up -d

echo "⏳ Waiting for services to start..."
sleep 10

# Check if the application is running
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Deployment successful!"
    echo "🌐 Application is running at: http://localhost:5000"
    echo "📊 Health check: http://localhost:5000/health"
else
    echo "❌ Deployment failed. Check logs with: docker-compose logs"
    exit 1
fi

echo "📝 To view logs: docker-compose logs -f"
echo "🛑 To stop: docker-compose down" 