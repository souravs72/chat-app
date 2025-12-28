import { publishEvent } from './events.js'

const connectedClients = new Map() // userId -> Set of WebSocket connections

export function setupWebSocket(wss) {
  wss.on('connection', (ws, request) => {
    const userId = request.userId

    if (!connectedClients.has(userId)) {
      connectedClients.set(userId, new Set())
    }
    connectedClients.get(userId).add(ws)

    console.log(`User ${userId} connected`)

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

    ws.on('close', () => {
      connectedClients.get(userId)?.delete(ws)
      if (connectedClients.get(userId)?.size === 0) {
        connectedClients.delete(userId)
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

export function broadcastToUser(userId, event) {
  const clients = connectedClients.get(userId)
  if (clients) {
    const message = JSON.stringify(event)
    clients.forEach(ws => {
      if (ws.readyState === 1) { // OPEN
        ws.send(message)
      }
    })
  }
}

export function broadcastToChat(chatId, event, excludeUserId = null) {
  // This would need to get chat members from database
  // For now, we'll use a simpler approach
  // In production, you'd query the database for chat members
  // and broadcast to all their connected clients
}

