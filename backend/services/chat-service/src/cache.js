import { createClient } from 'redis'

/**
 * Cache service for chat metadata
 * Uses Redis for distributed caching
 */
class ChatCacheService {
  constructor() {
    this.client = null
    this.isConnected = false
    this.CHAT_CACHE_PREFIX = 'chat:'
    this.CHAT_LIST_CACHE_PREFIX = 'chatlist:'
    this.MESSAGES_CACHE_PREFIX = 'messages:'
    this.CHAT_CACHE_TTL_SECONDS = 60 // 1 minute
    this.MESSAGES_CACHE_TTL_SECONDS = 300 // 5 minutes for messages
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    try {
      const redisUrl = process.env.REDIS_PASSWORD
        ? `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
        : `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`

      this.client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 10000,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              return new Error('Max reconnection attempts reached')
            }
            return Math.min(retries * 100, 3000)
          }
        }
      })

      this.client.on('error', (err) => {
        console.error('[ChatCache] Redis error:', err)
        this.isConnected = false
      })

      this.client.on('connect', () => {
        console.log('[ChatCache] Connecting to Redis...')
      })

      this.client.on('ready', () => {
        console.log('[ChatCache] Redis connected and ready')
        this.isConnected = true
      })

      this.client.on('reconnecting', () => {
        console.log('[ChatCache] Reconnecting to Redis...')
      })

      await this.client.connect()
      this.isConnected = true
      console.log('[ChatCache] Chat cache service initialized')
    } catch (error) {
      console.error('[ChatCache] Failed to initialize cache:', error)
      console.warn('[ChatCache] Continuing without cache (cache operations will be no-ops)')
      this.isConnected = false
      // Don't throw - cache is optional
    }
  }

  /**
   * Get chat metadata from cache
   * @param {string} chatId - Chat ID
   * @returns {Promise<Object|null>} - Cached chat data or null
   */
  async getChat(chatId) {
    if (!this.isConnected || !this.client) {
      return null
    }

    try {
      const key = `${this.CHAT_CACHE_PREFIX}${chatId}`
      const cached = await this.client.get(key)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (error) {
      console.error('[ChatCache] Error reading chat from cache:', error)
    }
    return null
  }

  /**
   * Cache chat metadata
   * @param {string} chatId - Chat ID
   * @param {Object} chatData - Chat data to cache
   */
  async setChat(chatId, chatData) {
    if (!this.isConnected || !this.client) {
      return
    }

    try {
      const key = `${this.CHAT_CACHE_PREFIX}${chatId}`
      await this.client.setEx(key, this.CHAT_CACHE_TTL_SECONDS, JSON.stringify(chatData))
    } catch (error) {
      console.error('[ChatCache] Error caching chat:', error)
    }
  }

  /**
   * Get user's chat list from cache
   * @param {string} userId - User ID
   * @returns {Promise<Array|null>} - Cached chat list or null
   */
  async getChatList(userId) {
    if (!this.isConnected || !this.client) {
      return null
    }

    try {
      const key = `${this.CHAT_LIST_CACHE_PREFIX}${userId}`
      const cached = await this.client.get(key)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (error) {
      console.error('[ChatCache] Error reading chat list from cache:', error)
    }
    return null
  }

  /**
   * Cache user's chat list
   * @param {string} userId - User ID
   * @param {Array} chats - Chat list to cache
   */
  async setChatList(userId, chats) {
    if (!this.isConnected || !this.client) {
      return
    }

    try {
      const key = `${this.CHAT_LIST_CACHE_PREFIX}${userId}`
      await this.client.setEx(key, this.CHAT_CACHE_TTL_SECONDS, JSON.stringify(chats))
    } catch (error) {
      console.error('[ChatCache] Error caching chat list:', error)
    }
  }

  /**
   * Invalidate chat cache
   * @param {string} chatId - Chat ID
   */
  async invalidateChat(chatId) {
    if (!this.isConnected || !this.client) {
      return
    }

    try {
      const key = `${this.CHAT_CACHE_PREFIX}${chatId}`
      await this.client.del(key)
    } catch (error) {
      console.error('[ChatCache] Error invalidating chat cache:', error)
    }
  }

  /**
   * Invalidate user's chat list cache
   * @param {string} userId - User ID
   */
  async invalidateChatList(userId) {
    if (!this.isConnected || !this.client) {
      return
    }

    try {
      const key = `${this.CHAT_LIST_CACHE_PREFIX}${userId}`
      await this.client.del(key)
    } catch (error) {
      console.error('[ChatCache] Error invalidating chat list cache:', error)
    }
  }

  /**
   * Invalidate chat list for multiple users (when chat is updated)
   * @param {Array<string>} userIds - Array of user IDs
   */
  async invalidateChatListForUsers(userIds) {
    if (!this.isConnected || !this.client || !userIds || userIds.length === 0) {
      return
    }

    try {
      const keys = userIds.map(userId => `${this.CHAT_LIST_CACHE_PREFIX}${userId}`)
      if (keys.length > 0) {
        await this.client.del(keys)
      }
    } catch (error) {
      console.error('[ChatCache] Error invalidating chat list for users:', error)
    }
  }

  /**
   * Get recent messages from cache
   * @param {string} chatId - Chat ID
   * @param {number} limit - Number of messages to retrieve
   * @param {string|null} before - Timestamp to fetch messages before (for pagination)
   * @returns {Promise<Array|null>} - Cached messages or null
   */
  async getMessages(chatId, limit, before = null) {
    if (!this.isConnected || !this.client) {
      return null
    }

    try {
      // Create cache key based on chatId, limit, and before timestamp
      const cacheKey = before 
        ? `${this.MESSAGES_CACHE_PREFIX}${chatId}:${limit}:${before}`
        : `${this.MESSAGES_CACHE_PREFIX}${chatId}:${limit}:latest`
      
      const cached = await this.client.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (error) {
      console.error('[ChatCache] Error reading messages from cache:', error)
    }
    return null
  }

  /**
   * Cache recent messages
   * @param {string} chatId - Chat ID
   * @param {number} limit - Number of messages cached
   * @param {string|null} before - Timestamp used for pagination
   * @param {Array} messages - Messages to cache
   */
  async setMessages(chatId, limit, before, messages) {
    if (!this.isConnected || !this.client) {
      return
    }

    try {
      const cacheKey = before 
        ? `${this.MESSAGES_CACHE_PREFIX}${chatId}:${limit}:${before}`
        : `${this.MESSAGES_CACHE_PREFIX}${chatId}:${limit}:latest`
      
      await this.client.setEx(cacheKey, this.MESSAGES_CACHE_TTL_SECONDS, JSON.stringify(messages))
    } catch (error) {
      console.error('[ChatCache] Error caching messages:', error)
    }
  }

  /**
   * Invalidate message cache for a chat (when new message is sent)
   * @param {string} chatId - Chat ID
   */
  async invalidateMessages(chatId) {
    if (!this.isConnected || !this.client) {
      return
    }

    try {
      // Use pattern matching to delete all message cache keys for this chat
      const pattern = `${this.MESSAGES_CACHE_PREFIX}${chatId}:*`
      const keys = await this.client.keys(pattern)
      if (keys.length > 0) {
        await this.client.del(keys)
      }
    } catch (error) {
      console.error('[ChatCache] Error invalidating messages cache:', error)
    }
  }
}

// Singleton instance
export const chatCache = new ChatCacheService()

