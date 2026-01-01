import { createClient } from 'redis'
import { extractUserIdFromToken } from '../utils/jwt.js'

/**
 * Rate limiter using sliding window log algorithm
 * This algorithm is more accurate than token bucket for distributed systems
 */
class RateLimiter {
  constructor(redisClient) {
    this.redis = redisClient
  }

  /**
   * Get client IP address from request
   * @param {Object} req - Express request object
   * @returns {string} - IP address
   */
  getClientIp(req) {
    return (
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip ||
      'unknown'
    )
  }

  /**
   * Get identifier for rate limiting (user ID or IP)
   * @param {Object} req - Express request object
   * @param {string} jwtSecret - JWT secret for token verification
   * @returns {Object} - { identifier: string, type: 'user' | 'ip' }
   */
  getIdentifier(req, jwtSecret) {
    const authHeader = req.headers.authorization
    
    if (authHeader) {
      const userId = extractUserIdFromToken(authHeader, jwtSecret)
      if (userId) {
        return { identifier: `user:${userId}`, type: 'user' }
      }
    }

    // Fallback to IP-based rate limiting for unauthenticated requests
    const ip = this.getClientIp(req)
    return { identifier: `ip:${ip}`, type: 'ip' }
  }

  /**
   * Check if request is allowed based on rate limit
   * @param {string} key - Redis key for the rate limit
   * @param {number} limit - Maximum number of requests
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Promise<Object>} - { allowed: boolean, remaining: number, resetTime: number }
   */
  async checkLimit(key, limit, windowMs) {
    const now = Date.now()
    const windowStart = now - windowMs

    try {
      // Use Redis sorted set for sliding window log
      const redisKey = `ratelimit:${key}`
      
      // Remove entries outside the time window
      await this.redis.zRemRangeByScore(redisKey, 0, windowStart)

      // Count requests in current window
      const count = await this.redis.zCard(redisKey)

      if (count >= limit) {
        // Rate limit exceeded - get the oldest request timestamp (score) to calculate reset time
        // zRangeWithScores returns objects with { value: member, score: score }
        const oldestRequests = await this.redis.zRangeWithScores(redisKey, 0, 0, { REV: true })
        const oldestTimestamp = oldestRequests.length > 0 ? oldestRequests[0].score : now
        const resetTime = oldestTimestamp + windowMs

        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter: Math.ceil((resetTime - now) / 1000)
        }
      }

      // Add current request timestamp
      // In redis v4, zAdd uses an object where keys are members and values are scores
      // Use timestamp + random to ensure uniqueness (multiple requests can have same timestamp)
      const member = `${now}-${Math.random().toString(36).substring(2, 9)}`
      await this.redis.zAdd(redisKey, { [member]: now })
      
      // Set expiration on the key to prevent memory leaks
      await this.redis.expire(redisKey, Math.ceil(windowMs / 1000))

      const remaining = limit - count - 1
      const resetTime = now + windowMs

      return {
        allowed: true,
        remaining: Math.max(0, remaining),
        resetTime
      }
    } catch (error) {
      console.error('[RateLimiter] Redis error:', error)
      // On Redis error, allow the request (fail open)
      // In production, you might want to fail closed
      return {
        allowed: true,
        remaining: limit,
        resetTime: now + windowMs,
        error: true
      }
    }
  }
}

/**
 * Create rate limiting middleware
 * @param {Object} options - Configuration options
 * @param {Object} options.redisClient - Redis client instance
 * @param {string} options.jwtSecret - JWT secret for token verification
 * @param {number} options.userLimit - Per-user rate limit (default: 100)
 * @param {number} options.userWindowMs - Per-user time window in milliseconds (default: 60000 = 1 minute)
 * @param {number} options.ipLimit - Per-IP rate limit (default: 50)
 * @param {number} options.ipWindowMs - Per-IP time window in milliseconds (default: 60000 = 1 minute)
 * @param {Array<string>} options.skipPaths - Path patterns to skip rate limiting (default: ['/health'])
 * @returns {Function} - Express middleware function
 */
export function createRateLimiter({
  redisClient,
  jwtSecret,
  userLimit = 100,
  userWindowMs = 60000, // 1 minute
  ipLimit = 50,
  ipWindowMs = 60000, // 1 minute
  skipPaths = ['/health']
} = {}) {
  if (!redisClient) {
    throw new Error('Redis client is required')
  }
  if (!jwtSecret) {
    throw new Error('JWT secret is required')
  }

  const limiter = new RateLimiter(redisClient)

  return async (req, res, next) => {
    // Skip rate limiting for health checks and other specified paths
    if (skipPaths.some(path => req.path === path || req.path.startsWith(path))) {
      return next()
    }

    try {
      const { identifier, type } = limiter.getIdentifier(req, jwtSecret)
      const isUserBased = type === 'user'

      // Use different limits for user vs IP
      const limit = isUserBased ? userLimit : ipLimit
      const windowMs = isUserBased ? userWindowMs : ipWindowMs

      const result = await limiter.checkLimit(identifier, limit, windowMs)

      // Set rate limit headers (RFC 6585)
      res.setHeader('X-RateLimit-Limit', limit)
      res.setHeader('X-RateLimit-Remaining', result.remaining)
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000))

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter)
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. ${isUserBased ? 'Per-user' : 'Per-IP'} limit: ${limit} requests per ${Math.floor(windowMs / 1000)} seconds.`,
          retryAfter: result.retryAfter
        })
      }

      next()
    } catch (error) {
      console.error('[RateLimiter] Middleware error:', error)
      // On error, allow the request (fail open)
      next()
    }
  }
}

