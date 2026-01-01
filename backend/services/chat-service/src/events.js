import { pool } from './db.js'
import { broadcastToUser } from './websocket.js'

let amqpChannel = null
let amqpConnection = null

export function setAmqpChannel(channel) {
  amqpChannel = channel
}

export async function publishEvent(eventType, payload) {
  if (amqpChannel) {
    try {
      amqpChannel.publish('chat_events', eventType, Buffer.from(JSON.stringify({
        type: eventType,
        payload,
        timestamp: new Date().toISOString(),
      })), { persistent: true })
    } catch (error) {
      console.error('Error publishing event:', error)
    }
  } else {
    console.warn('Message broker not connected, event not published:', eventType)
  }
}

export async function connectToBroker() {
  try {
    const { connect } = await import('amqplib')
    const amqpUrl = process.env.AMQP_URL || 'amqp://localhost'
    amqpConnection = await connect(amqpUrl)
    amqpChannel = await amqpConnection.createChannel()
    
    // Declare exchanges and queues
    await amqpChannel.assertExchange('chat_events', 'topic', { durable: true })
    await amqpChannel.assertQueue('chat_service_queue', { durable: true })
    // Bind to message events and typing indicator events
    await amqpChannel.bindQueue('chat_service_queue', 'chat_events', 'message.*')
    await amqpChannel.bindQueue('chat_service_queue', 'chat_events', 'typing.indicator')
    
    setupEventHandlers(amqpChannel)
    console.log('Connected to message broker')
    return { connection: amqpConnection, channel: amqpChannel }
  } catch (error) {
    console.error('Failed to connect to message broker:', error.message)
    throw error
  }
}

export function setupEventHandlers(channel) {
  setAmqpChannel(channel)

  // Consume events from queue
  channel.consume('chat_service_queue', async (msg) => {
    if (!msg) return

    try {
      const event = JSON.parse(msg.content.toString())
      await handleEvent(event)
      channel.ack(msg)
    } catch (error) {
      console.error('Error handling event:', error)
      channel.nack(msg, false, false)
    }
  }).catch((error) => {
    console.error('Error setting up event consumer:', error)
  })
}

async function handleEvent(event) {
  const { type, payload } = event

  switch (type) {
    case 'message.sent':
      await handleMessageSent(payload)
      break
    case 'message.read':
      await handleMessageRead(payload)
      break
    case 'typing.indicator':
      await handleTypingIndicator(payload)
      break
    default:
      console.log('Unhandled event type:', type)
  }
}

async function handleMessageSent(payload) {
  try {
    const { message, chatId } = payload

    // Get chat members
    const result = await pool.query(
      'SELECT user_id FROM chat_members WHERE chat_id = $1',
      [chatId]
    )

    // Broadcast to all chat members except sender
    result.rows.forEach(row => {
      if (row.user_id !== message.senderId) {
        broadcastToUser(row.user_id, {
          type: 'MESSAGE_SENT',
          payload: message,
          timestamp: new Date().toISOString(),
        })
      }
    })
  } catch (error) {
    console.error('Error handling message.sent event:', error)
  }
}

async function handleMessageRead(payload) {
  try {
    const { chatId, messageId, userId } = payload

    // Get chat members
    const result = await pool.query(
      'SELECT user_id FROM chat_members WHERE chat_id = $1',
      [chatId]
    )

    // Broadcast read receipt to all members
    result.rows.forEach(row => {
      broadcastToUser(row.user_id, {
        type: 'MESSAGE_READ',
        payload: { chatId, messageId, userId },
        timestamp: new Date().toISOString(),
      })
    })
  } catch (error) {
    console.error('Error handling message.read event:', error)
  }
}

async function handleTypingIndicator(payload) {
  try {
    const { chatId, userId, isTyping } = payload

    // Get chat members
    const result = await pool.query(
      'SELECT user_id FROM chat_members WHERE chat_id = $1',
      [chatId]
    )

    // Broadcast typing indicator to all members except the typist
    result.rows.forEach(row => {
      if (row.user_id !== userId) {
        broadcastToUser(row.user_id, {
          type: 'TYPING_INDICATOR',
          payload: { chatId, userId, isTyping },
          timestamp: new Date().toISOString(),
        })
      }
    })
  } catch (error) {
    console.error('Error handling typing.indicator event:', error)
  }
}
