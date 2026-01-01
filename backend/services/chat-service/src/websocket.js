import { publishEvent } from './events.js'
import { 
  subscribeToUser, 
  unsubscribeFromUser,
  publishToUser as redisPublishToUser,
  isPubSubAvailable 
} from './redisPubSub.js'

const connectedClients = new Map() // userId -> Set of WebSocket connections
const userSubscriptions = new Set() // Track which users we've subscribed to

/**
 * Setup WebSocket server with Redis pub/sub for cross-instance communication
 */
export function setupWebSocket(wss) {
  wss.on('connection', (ws, request) => {
    const userId = request.userId

    if (!connectedClients.has(userId)) {
      connectedClients.set(userId, new Set())
    }
    connectedClients.get(userId).add(ws)

    console.log(`User ${userId} connected`)

    // Subscribe to Redis pub/sub for this user on first connection
    if (!userSubscriptions.has(userId) && isPubSubAvailable()) {
      userSubscriptions.add(userId)
      subscribeToUser(userId, (event) => {
        // Handle cross-instance broadcast
        broadcastToUserLocal(userId, event)
      }).catch((error) => {
        console.error(`[WebSocket] Error subscribing to user ${userId}:`, error)
        userSubscriptions.delete(userId)
      })
    }

    // Publish user connected event
    publishEvent('user.connected', { userId }).catch(console.error)

    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        const event = JSON.parse(data.toString())
        
        // Handle typing indicators
        if (event.type === 'TYPING_INDICATOR') {
          await publishEvent('typing.indicator', {
            chatId: event.payload.chatId,
            userId: userId,
            isTyping: event.payload.isTyping,
          })
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error)
      }
    })

    ws.on('close', async () => {
      connectedClients.get(userId)?.delete(ws)
      if (connectedClients.get(userId)?.size === 0) {
        connectedClients.delete(userId)
        userSubscriptions.delete(userId)
        
        // Unsubscribe from Redis channel when no more local connections
        if (isPubSubAvailable()) {
          await unsubscribeFromUser(userId).catch((error) => {
            console.error(`[WebSocket] Error unsubscribing from user ${userId}:`, error)
          })
        }
        
        // Publish user disconnected event
        publishEvent('user.disconnected', { userId }).catch(console.error)
        console.log(`User ${userId} disconnected`)
      }
    })

    ws.on('error', (error) => {
      console.error('WebSocket error:', error)
    })
  })
}

/**
 * Broadcast to user locally (on this instance only)
 * @param {string} userId - User ID
 * @param {Object} event - Event object
 */
function broadcastToUserLocal(userId, event) {
  const clients = connectedClients.get(userId)
  if (clients) {
    const message = JSON.stringify(event)
    clients.forEach(ws => {
      if (ws.readyState === 1) { // OPEN
        try {
          ws.send(message)
        } catch (error) {
          console.error(`[WebSocket] Error sending to user ${userId}:`, error)
        }
      }
    })
  }
}

/**
 * Broadcast to user across all instances using Redis pub/sub
 * Falls back to local broadcast if Redis is unavailable
 * @param {string} userId - User ID
 * @param {Object} event - Event object
 */
export function broadcastToUser(userId, event) {
  // Always broadcast locally first
  broadcastToUserLocal(userId, event)

  // Also publish to Redis for cross-instance communication
  if (isPubSubAvailable()) {
    redisPublishToUser(userId, event).catch((error) => {
      console.error(`[WebSocket] Error publishing to Redis for user ${userId}:`, error)
      // Continue - local broadcast already happened
    })
  }
}

/**
 * Broadcast to all members of a chat
 * @param {string} chatId - Chat ID
 * @param {Object} event - Event object
 * @param {string|null} excludeUserId - User ID to exclude from broadcast
 */
export function broadcastToChat(chatId, event, excludeUserId = null) {
  // This would need to get chat members from database
  // For now, we'll use a simpler approach
  // In production, you'd query the database for chat members
  // and broadcast to all their connected clients
  // This is handled via the events.js file which queries chat members
}

