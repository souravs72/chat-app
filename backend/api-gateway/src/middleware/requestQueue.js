import { createClient } from 'redis'

/**
 * Request queue middleware for handling high-priority operations
 * Uses Redis lists to implement a distributed queue
 */
class RequestQueueService {
  constructor(redisClient) {
    this.redis = redisClient
    this.queuePrefix = 'request-queue:'
    this.processingPrefix = 'processing:'
  }

  /**
   * Enqueue a high-priority request
   * @param {string} queueName - Queue name (e.g., 'high-priority', 'async-ops')
   * @param {Object} requestData - Request data to queue
   * @returns {Promise<string>} - Queue position or job ID
   */
  async enqueue(queueName, requestData) {
    if (!this.redis) {
      throw new Error('Redis client not available')
    }

    try {
      const queueKey = `${this.queuePrefix}${queueName}`
      const jobId = `job:${Date.now()}:${Math.random().toString(36).substring(2, 9)}`
      const jobData = {
        id: jobId,
        ...requestData,
        enqueuedAt: Date.now()
      }

      // Add to queue (right push - FIFO)
      await this.redis.rPush(queueKey, JSON.stringify(jobData))
      
      // Set expiration on queue key (24 hours)
      await this.redis.expire(queueKey, 86400)

      return jobId
    } catch (error) {
      console.error('[RequestQueue] Error enqueuing request:', error)
      throw error
    }
  }

  /**
   * Dequeue a request from the queue
   * @param {string} queueName - Queue name
   * @param {number} timeout - Blocking timeout in seconds (0 = non-blocking)
   * @returns {Promise<Object|null>} - Dequeued job or null
   */
  async dequeue(queueName, timeout = 0) {
    if (!this.redis) {
      return null
    }

    try {
      const queueKey = `${this.queuePrefix}${queueName}`
      
      if (timeout > 0) {
        // Blocking pop (BLPOP)
        const result = await this.redis.blPop(
          this.redis.commandOptions({ isolated: true }),
          queueKey,
          timeout
        )
        return result ? JSON.parse(result.element) : null
      } else {
        // Non-blocking pop (LPOP)
        const result = await this.redis.lPop(queueKey)
        return result ? JSON.parse(result) : null
      }
    } catch (error) {
      console.error('[RequestQueue] Error dequeuing request:', error)
      return null
    }
  }

  /**
   * Get queue length
   * @param {string} queueName - Queue name
   * @returns {Promise<number>} - Queue length
   */
  async getQueueLength(queueName) {
    if (!this.redis) {
      return 0
    }

    try {
      const queueKey = `${this.queuePrefix}${queueName}`
      return await this.redis.lLen(queueKey)
    } catch (error) {
      console.error('[RequestQueue] Error getting queue length:', error)
      return 0
    }
  }
}

/**
 * Create request queue middleware for high-priority operations
 * @param {Object} options - Configuration options
 * @param {Object} options.redisClient - Redis client instance
 * @param {Array<string>} options.highPriorityPaths - Path patterns that should be queued
 * @returns {Function} - Express middleware function
 */
export function createRequestQueueMiddleware({
  redisClient,
  highPriorityPaths = []
} = {}) {
  if (!redisClient) {
    // Return no-op middleware if Redis is not available
    return (req, res, next) => next()
  }

  const queueService = new RequestQueueService(redisClient)

  return async (req, res, next) => {
    // Check if this is a high-priority path that should be queued
    const isHighPriority = highPriorityPaths.some(pattern => {
      if (typeof pattern === 'string') {
        return req.path === pattern || req.path.startsWith(pattern)
      } else if (pattern instanceof RegExp) {
        return pattern.test(req.path)
      }
      return false
    })

    if (!isHighPriority) {
      // Not a high-priority path, proceed normally
      return next()
    }

    // For high-priority paths, we can optionally queue them
    // For now, we'll just add queue length to headers for monitoring
    try {
      const queueLength = await queueService.getQueueLength('high-priority')
      res.setHeader('X-Queue-Length', queueLength)
      // For now, continue with normal processing
      // In a full implementation, you might want to queue the request
      // and process it asynchronously
      next()
    } catch (error) {
      console.error('[RequestQueue] Middleware error:', error)
      // On error, continue normally
      next()
    }
  }
}

/**
 * Utility function to enqueue async operations
 * @param {Object} redisClient - Redis client
 * @param {string} operationType - Type of operation (e.g., 'email-send', 'notification')
 * @param {Object} operationData - Operation data
 * @returns {Promise<string>} - Job ID
 */
export async function enqueueAsyncOperation(redisClient, operationType, operationData) {
  if (!redisClient) {
    throw new Error('Redis client not available')
  }

  const queueService = new RequestQueueService(redisClient)
  return await queueService.enqueue('async-ops', {
    type: operationType,
    data: operationData
  })
}

