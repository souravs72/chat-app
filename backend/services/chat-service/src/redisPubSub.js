import { createClient } from 'redis'
import { randomUUID } from 'crypto'

/**
 * Redis Pub/Sub for cross-instance WebSocket communication
 * Enables horizontal scaling of chat service instances
 */

let publisher = null
let subscriber = null
let instanceId = null

const WEBSOCKET_CHANNEL_PREFIX = 'ws:broadcast:'
const USER_CHANNEL_PREFIX = 'ws:user:'
const CHAT_CHANNEL_PREFIX = 'ws:chat:'

/**
 * Initialize Redis pub/sub connections
 */
export async function initializeRedisPubSub() {
  try {
    const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
    
    instanceId = randomUUID() // Unique instance identifier
    
    // Create publisher client
    publisher = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('[RedisPubSub] Max reconnection attempts for publisher reached')
            return new Error('Max reconnection attempts reached')
          }
          return Math.min(retries * 100, 3000)
        }
      }
    })

    publisher.on('error', (err) => console.error('[RedisPubSub] Publisher error:', err))
    publisher.on('connect', () => console.log('[RedisPubSub] Publisher connecting...'))
    publisher.on('ready', () => console.log('[RedisPubSub] Publisher ready'))

    // Create subscriber client (separate connection required for pub/sub)
    subscriber = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('[RedisPubSub] Max reconnection attempts for subscriber reached')
            return new Error('Max reconnection attempts reached')
          }
          return Math.min(retries * 100, 3000)
        }
      }
    })

    subscriber.on('error', (err) => console.error('[RedisPubSub] Subscriber error:', err))
    subscriber.on('connect', () => console.log('[RedisPubSub] Subscriber connecting...'))
    subscriber.on('ready', () => console.log('[RedisPubSub] Subscriber ready'))

    await publisher.connect()
    await subscriber.connect()
    
    // Setup message handler for subscriber
    setupSubscriberHandler()

    console.log(`[RedisPubSub] Initialized (instance: ${instanceId})`)
    return { publisher, subscriber, instanceId }
  } catch (error) {
    console.error('[RedisPubSub] Failed to initialize Redis pub/sub:', error)
    throw error
  }
}

// Store handlers for each subscribed channel
const channelHandlers = new Map()

// Setup message handler once for all channels
if (!channelHandlers.has('__setup__')) {
  channelHandlers.set('__setup__', true)
  // This will be set up after subscriber is connected
}

/**
 * Setup message handler for subscriber (call once after connection)
 */
function setupSubscriberHandler() {
  if (subscriber) {
    subscriber.on('message', (channel, message) => {
      try {
        const handler = channelHandlers.get(channel)
        if (handler) {
          const event = JSON.parse(message)
          // Ignore messages from the same instance to prevent loops
          if (event.instanceId !== instanceId) {
            handler(event)
          }
        }
      } catch (error) {
        console.error(`[RedisPubSub] Error handling message on channel ${channel}:`, error)
      }
    })
  }
}

/**
 * Subscribe to user-specific channel for cross-instance broadcasts
 * @param {string} userId - User ID to subscribe to
 * @param {Function} handler - Message handler function
 */
export async function subscribeToUser(userId, handler) {
  if (!subscriber) {
    console.warn('[RedisPubSub] Subscriber not initialized, cannot subscribe to user channel')
    return
  }

  try {
    const channel = USER_CHANNEL_PREFIX + userId
    
    // Setup handler mapping
    channelHandlers.set(channel, handler)
    
    // Subscribe to channel (Redis v4 API)
    await subscriber.subscribe([channel])
    
    console.log(`[RedisPubSub] Subscribed to user channel: ${channel}`)
  } catch (error) {
    console.error(`[RedisPubSub] Error subscribing to user ${userId}:`, error)
    channelHandlers.delete(USER_CHANNEL_PREFIX + userId)
  }
}

/**
 * Publish message to user-specific channel
 * @param {string} userId - User ID to broadcast to
 * @param {Object} event - Event object to broadcast
 */
export async function publishToUser(userId, event) {
  if (!publisher) {
    console.warn('[RedisPubSub] Publisher not initialized, cannot publish to user channel')
    return
  }

  try {
    const channel = USER_CHANNEL_PREFIX + userId
    const message = JSON.stringify({
      ...event,
      instanceId, // Include instance ID to prevent echo
      timestamp: new Date().toISOString()
    })
    await publisher.publish(channel, message)
  } catch (error) {
    console.error(`[RedisPubSub] Error publishing to user ${userId}:`, error)
  }
}

/**
 * Subscribe to chat-specific channel
 * @param {string} chatId - Chat ID to subscribe to
 * @param {Function} handler - Message handler function
 */
export async function subscribeToChat(chatId, handler) {
  if (!subscriber) {
    console.warn('[RedisPubSub] Subscriber not initialized, cannot subscribe to chat channel')
    return
  }

  try {
    const channel = CHAT_CHANNEL_PREFIX + chatId
    
    // Setup handler mapping
    channelHandlers.set(channel, handler)
    
    // Subscribe to channel (Redis v4 API)
    await subscriber.subscribe([channel])
    
    console.log(`[RedisPubSub] Subscribed to chat channel: ${channel}`)
  } catch (error) {
    console.error(`[RedisPubSub] Error subscribing to chat ${chatId}:`, error)
    channelHandlers.delete(CHAT_CHANNEL_PREFIX + chatId)
  }
}

/**
 * Publish message to chat-specific channel
 * @param {string} chatId - Chat ID to broadcast to
 * @param {Object} event - Event object to broadcast
 */
export async function publishToChat(chatId, event) {
  if (!publisher) {
    console.warn('[RedisPubSub] Publisher not initialized, cannot publish to chat channel')
    return
  }

  try {
    const channel = CHAT_CHANNEL_PREFIX + chatId
    const message = JSON.stringify({
      ...event,
      instanceId,
      timestamp: new Date().toISOString()
    })
    await publisher.publish(channel, message)
  } catch (error) {
    console.error(`[RedisPubSub] Error publishing to chat ${chatId}:`, error)
  }
}

/**
 * Get instance ID (for debugging/monitoring)
 */
export function getInstanceId() {
  return instanceId
}

/**
 * Check if Redis pub/sub is available
 */
export function isPubSubAvailable() {
  return publisher !== null && subscriber !== null
}

/**
 * Unsubscribe from user channel
 * @param {string} userId - User ID to unsubscribe from
 */
export async function unsubscribeFromUser(userId) {
  if (!subscriber) return
  
  try {
    const channel = USER_CHANNEL_PREFIX + userId
    await subscriber.unsubscribe([channel])
    channelHandlers.delete(channel)
    console.log(`[RedisPubSub] Unsubscribed from user channel: ${channel}`)
  } catch (error) {
    console.error(`[RedisPubSub] Error unsubscribing from user ${userId}:`, error)
  }
}

/**
 * Close Redis pub/sub connections
 */
export async function closeRedisPubSub() {
  try {
    // Clear all handlers
    channelHandlers.clear()
    
    if (subscriber) {
      await subscriber.quit()
      subscriber = null
    }
    if (publisher) {
      await publisher.quit()
      publisher = null
    }
    console.log('[RedisPubSub] Connections closed')
  } catch (error) {
    console.error('[RedisPubSub] Error closing connections:', error)
  }
}

