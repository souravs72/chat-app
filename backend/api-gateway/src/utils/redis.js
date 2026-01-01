import { createClient } from 'redis'

/**
 * Create and connect Redis client
 * @param {Object} options - Redis connection options
 * @returns {Promise<Object>} - Connected Redis client
 */
export async function createRedisClient({
  host = process.env.REDIS_HOST || 'localhost',
  port = process.env.REDIS_PORT || 6379,
  password = process.env.REDIS_PASSWORD
} = {}) {
  const redisUrl = password 
    ? `redis://:${password}@${host}:${port}`
    : `redis://${host}:${port}`

  const client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 10000, // 10 seconds connection timeout
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('[Redis] Max reconnection attempts reached')
          return new Error('Max reconnection attempts reached')
        }
        // Exponential backoff: 100ms, 200ms, 400ms, 800ms, etc., max 3000ms
        return Math.min(retries * 100, 3000)
      }
    }
  })

  client.on('error', (err) => {
    console.error('[Redis] Client error:', err)
  })

  client.on('connect', () => {
    console.log('[Redis] Connecting...')
  })

  client.on('ready', () => {
    console.log('[Redis] Client ready')
  })

  client.on('reconnecting', () => {
    console.log('[Redis] Reconnecting...')
  })

  try {
    await client.connect()
    console.log(`[Redis] Connected to ${host}:${port}`)
    return client
  } catch (error) {
    console.error('[Redis] Connection error:', error)
    throw error
  }
}

