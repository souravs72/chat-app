# Rate Limiting Implementation Guide

## Current Status

✅ **API Gateway** - Rate limiting implemented with Redis
- Per-user: 100 requests/minute
- Per-IP: 50 requests/minute
- Sliding window algorithm
- Distributed rate limiting via Redis

## Services Needing Rate Limiting

To add rate limiting to individual services (defense-in-depth):

### Node.js Services (Chat, Story, Media)
1. Copy `backend/api-gateway/src/middleware/rateLimiter.js` to each service
2. Install `redis` and `jsonwebtoken` packages
3. Add Redis connection setup
4. Apply middleware to routes

### Spring Boot Services (Auth, User, Notification)
1. Add Spring Data Redis dependency (already present)
2. Create RateLimitingFilter or Interceptor
3. Use RedisTemplate for sliding window logic
4. Add filter to SecurityFilterChain

## Recommended Limits by Service

- **Auth Service**: 5 login attempts/minute per IP, 20 signups/hour per IP
- **User Service**: 100 requests/minute per user
- **Chat Service**: 200 requests/minute per user (high volume)
- **Story Service**: 10 stories/day per user, 100 reads/minute
- **Media Service**: 50 uploads/hour per user
- **Notification Service**: Internal service, may not need rate limiting

## Redis Cluster Configuration

For production, consider Redis Cluster:
- 3-6 Redis nodes (3 masters + 3 replicas)
- Automatic failover
- High availability
- Horizontal scaling

For docker-compose (development), single instance is sufficient.
For production, use Redis Cluster or managed Redis (AWS ElastiCache, Redis Cloud).

