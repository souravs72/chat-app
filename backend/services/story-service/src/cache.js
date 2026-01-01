import { createClient } from 'redis'

let redisClient = null

export async function connectRedisCache() {
  try {
    const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
    
    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('[StoryService Cache] Max reconnection attempts to Redis cache reached')
            return new Error('Max reconnection attempts reached')
          }
          return Math.min(retries * 100, 3000)
        }
      }
    })

    redisClient.on('error', (err) => console.error('[StoryService Cache] Redis Client Error', err))
    redisClient.on('connect', () => console.log('[StoryService Cache] Connecting to Redis...'))
    redisClient.on('ready', () => console.log('[StoryService Cache] Redis connected and ready'))

    await redisClient.connect()
    console.log('[StoryService Cache] Story cache service initialized')
  } catch (error) {
    console.error('[StoryService Cache] Failed to connect to Redis for caching:', error)
    redisClient = null // Ensure client is null if connection fails
  }
}

export function getRedisClient() {
  return redisClient
}

class StoryCache {
  constructor() {
    this.client = () => redisClient
    this.storiesListTTL = parseInt(process.env.STORIES_CACHE_TTL_SECONDS || '300') // 5 minutes default
  }

  async getStoriesList() {
    if (!this.client()) return null
    try {
      const key = 'stories:active'
      const data = await this.client().get(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('[StoryCache] Error getting stories list from Redis:', error)
      return null
    }
  }

  async setStoriesList(stories) {
    if (!this.client()) return
    try {
      const key = 'stories:active'
      await this.client().setEx(key, this.storiesListTTL, JSON.stringify(stories))
    } catch (error) {
      console.error('[StoryCache] Error setting stories list in Redis:', error)
    }
  }

  async invalidateStoriesList() {
    if (!this.client()) return
    try {
      const key = 'stories:active'
      await this.client().del(key)
    } catch (error) {
      console.error('[StoryCache] Error invalidating stories list in Redis:', error)
    }
  }
}

export const storyCache = new StoryCache()

