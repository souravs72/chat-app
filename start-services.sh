#!/bin/bash

set -e

echo "=== Building and Starting Chat Application Services ==="
echo ""

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Remove old containers and images
echo "🧹 Cleaning up old containers..."
docker compose down -v 2>/dev/null || true

echo ""
echo "🔨 Building Docker images..."
docker compose build --no-cache postgres rabbitmq api-gateway auth-service user-service notification-service chat-service media-service story-service

echo ""
echo "🚀 Starting services..."
docker compose up -d postgres rabbitmq

echo "⏳ Waiting for infrastructure services to be healthy..."
sleep 10

docker compose up -d auth-service user-service notification-service chat-service media-service story-service api-gateway

echo ""
echo "⏳ Waiting for services to start..."
sleep 15

echo ""
echo "📊 Service Status:"
docker compose ps

echo ""
echo "📋 Checking service logs for errors..."
echo ""
echo "=== POSTGRES LOGS ==="
docker compose logs postgres | tail -20

echo ""
echo "=== RABBITMQ LOGS ==="
docker compose logs rabbitmq | tail -20

echo ""
echo "=== AUTH SERVICE LOGS ==="
docker compose logs auth-service | tail -30

echo ""
echo "=== USER SERVICE LOGS ==="
docker compose logs user-service | tail -30

echo ""
echo "=== NOTIFICATION SERVICE LOGS ==="
docker compose logs notification-service | tail -30

echo ""
echo "=== CHAT SERVICE LOGS ==="
docker compose logs chat-service | tail -30

echo ""
echo "=== MEDIA SERVICE LOGS ==="
docker compose logs media-service | tail -30

echo ""
echo "=== STORY SERVICE LOGS ==="
docker compose logs story-service | tail -30

echo ""
echo "=== API GATEWAY LOGS ==="
docker compose logs api-gateway | tail -30

echo ""
echo "✅ All services started. To view logs in real-time, run:"
echo "   docker compose logs -f"
echo ""
echo "To check service health:"
echo "   docker compose ps"

