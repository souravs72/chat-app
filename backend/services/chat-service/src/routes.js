import { pool } from './db.js'
import { randomUUID as uuidv4 } from 'crypto'
import { publishEvent } from './events.js'
import { chatCache } from './cache.js'
import { broadcastToUser } from './websocket.js'

export function setupRoutes(app) {
  // Get all chats for user
  app.get('/api/chats', async (req, res) => {
    try {
      const userId = req.userId

      // Try cache first
      const cached = await chatCache.getChatList(userId)
      if (cached) {
        return res.json(cached)
      }

      const result = await pool.query(`
        SELECT DISTINCT c.*
        FROM chats c
        INNER JOIN chat_members cm ON c.id = cm.chat_id
        WHERE cm.user_id = $1
        ORDER BY c.created_at DESC
      `, [userId])

      // Get members for each chat
      const chats = await Promise.all(result.rows.map(async (chat) => {
        const membersResult = await pool.query(`
          SELECT cm.*, u.id as user_id, u.name, u.phone, u.status, u.last_seen, u.profile_picture
          FROM chat_members cm
          LEFT JOIN users u ON cm.user_id = u.id
          WHERE cm.chat_id = $1
        `, [chat.id])

        // Filter out chats where current user is the only member
        const otherMembers = membersResult.rows.filter(row => row.user_id !== userId)
        if (chat.type === 'personal' && otherMembers.length === 0) {
          return null
        }

        return {
          ...chat,
          members: membersResult.rows.map(row => ({
            chatId: row.chat_id,
            userId: row.user_id,
            role: row.role,
            blocked: row.blocked || false,
            user: row.user_id ? {
              id: row.user_id,
              name: row.name,
              phone: row.phone,
              status: row.status,
              lastSeen: row.last_seen,
              profilePicture: row.profile_picture,
            } : null,
          })),
        }
      }))

      // Filter out null chats (self-only chats)
      const filteredChats = chats.filter(chat => chat !== null)

      // Cache the result
      await chatCache.setChatList(userId, filteredChats)

      res.json(filteredChats)
    } catch (error) {
      console.error('Error fetching chats:', error)
      res.status(500).json({ message: 'Failed to fetch chats' })
    }
  })

  // Get specific chat
  app.get('/api/chats/:chatId', async (req, res) => {
    try {
      const { chatId } = req.params
      const userId = req.userId

      // Verify user is member
      const memberCheck = await pool.query(
        'SELECT * FROM chat_members WHERE chat_id = $1 AND user_id = $2',
        [chatId, userId]
      )

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Not a member of this chat' })
      }

      // Try cache first
      const cached = await chatCache.getChat(chatId)
      if (cached) {
        return res.json(cached)
      }

      const chatResult = await pool.query('SELECT * FROM chats WHERE id = $1', [chatId])
      if (chatResult.rows.length === 0) {
        return res.status(404).json({ message: 'Chat not found' })
      }

      const chat = chatResult.rows[0]

      // Get members
      const membersResult = await pool.query(`
        SELECT cm.*, u.id as user_id, u.name, u.phone, u.status, u.last_seen, u.profile_picture
        FROM chat_members cm
        LEFT JOIN users u ON cm.user_id = u.id
        WHERE cm.chat_id = $1
      `, [chatId])

      chat.members = membersResult.rows.map(row => ({
        chatId: row.chat_id,
        userId: row.user_id,
        role: row.role,
        blocked: row.blocked || false,
        user: row.user_id ? {
          id: row.user_id,
          name: row.name,
          phone: row.phone,
          status: row.status,
          lastSeen: row.last_seen,
        } : null,
      }))

      // Cache the result
      await chatCache.setChat(chatId, chat)

      res.json(chat)
    } catch (error) {
      console.error('Error fetching chat:', error)
      res.status(500).json({ message: 'Failed to fetch chat' })
    }
  })

  // Create personal chat
  app.post('/api/chats/personal', async (req, res) => {
    try {
      const { userId: otherUserId } = req.body
      const currentUserId = req.userId

      // Check if chat already exists
      const existingChat = await pool.query(`
        SELECT c.id
        FROM chats c
        INNER JOIN chat_members cm1 ON c.id = cm1.chat_id
        INNER JOIN chat_members cm2 ON c.id = cm2.chat_id
        WHERE c.type = 'personal'
        AND cm1.user_id = $1
        AND cm2.user_id = $2
      `, [currentUserId, otherUserId])

      if (existingChat.rows.length > 0) {
        return res.json({ id: existingChat.rows[0].id })
      }

      const chatId = uuidv4()
      await pool.query('INSERT INTO chats (id, type) VALUES ($1, $2)', [chatId, 'personal'])

      // Add both users as members
      await pool.query('INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2)', [chatId, currentUserId])
      await pool.query('INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2)', [chatId, otherUserId])

      // Invalidate cache for both users
      await chatCache.invalidateChatListForUsers([currentUserId, otherUserId])

      res.json({ id: chatId, type: 'personal' })
    } catch (error) {
      console.error('Error creating personal chat:', error)
      res.status(500).json({ message: 'Failed to create chat' })
    }
  })

  // Create channel
  app.post('/api/chats/channel', async (req, res) => {
    try {
      const { name } = req.body
      const userId = req.userId

      const chatId = uuidv4()
      await pool.query('INSERT INTO chats (id, type, name) VALUES ($1, $2, $3)', [chatId, 'channel', name])

      // Add creator as admin
      await pool.query('INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, $3)', [chatId, userId, 'admin'])

      // Invalidate cache for creator
      await chatCache.invalidateChatList(userId)

      res.json({ id: chatId, type: 'channel', name })
    } catch (error) {
      console.error('Error creating channel:', error)
      res.status(500).json({ message: 'Failed to create channel' })
    }
  })

  // Get messages
  app.get('/api/chats/:chatId/messages', async (req, res) => {
    try {
      const { chatId } = req.params
      const { limit = 50, before } = req.query
      const userId = req.userId
      const limitNum = Math.min(parseInt(limit) || 50, 100) // Max 100 messages per request

      // Verify user is member
      const memberCheck = await pool.query(
        'SELECT * FROM chat_members WHERE chat_id = $1 AND user_id = $2',
        [chatId, userId]
      )

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Not a member of this chat' })
      }

      // Try cache first (only for recent messages without pagination or with before param)
      const cachedMessages = await chatCache.getMessages(chatId, limitNum, before || null)
      if (cachedMessages) {
        return res.json(cachedMessages)
      }

      let query = `
        SELECT m.*, u.id as sender_id, u.name as sender_name, u.phone as sender_phone, u.profile_picture as sender_profile_picture
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.chat_id = $1
      `
      const params = [chatId]

      if (before) {
        query += ' AND m.created_at < $2'
        params.push(before)
        query += ' ORDER BY m.created_at DESC LIMIT $' + (params.length + 1)
      } else {
        query += ' ORDER BY m.created_at DESC LIMIT $2'
      }

      params.push(parseInt(limit))

      const result = await pool.query(query, params)

      const messages = result.rows.map(row => ({
        id: row.id,
        chatId: row.chat_id,
        senderId: row.sender_id,
        type: row.type,
        content: row.content,
        mediaUrl: row.media_url,
        createdAt: row.created_at,
        sender: row.sender_id ? {
          id: row.sender_id,
          name: row.sender_name,
          phone: row.sender_phone,
          profilePicture: row.sender_profile_picture,
        } : null,
      }))

      res.json(messages.reverse())
    } catch (error) {
      console.error('Error fetching messages:', error)
      res.status(500).json({ message: 'Failed to fetch messages' })
    }
  })

  // Send message to user (auto-creates chat if needed)
  app.post('/api/users/:userId/messages', async (req, res) => {
    try {
      const { userId: recipientId } = req.params
      const { type, content, mediaUrl } = req.body
      const senderId = req.userId

      if (senderId === recipientId) {
        return res.status(400).json({ message: 'Cannot send message to yourself' })
      }

      // Check if recipient has blocked sender
      const blockedCheck = await pool.query(`
        SELECT cm.blocked 
        FROM chat_members cm
        INNER JOIN chats c ON cm.chat_id = c.id
        WHERE c.type = 'personal'
        AND cm.user_id = $1
        AND cm.chat_id IN (
          SELECT chat_id FROM chat_members WHERE user_id = $2
        )
      `, [recipientId, senderId])

      if (blockedCheck.rows.length > 0 && blockedCheck.rows[0].blocked) {
        return res.status(403).json({ message: 'You have been blocked by this user' })
      }

      // Find or create personal chat
      let chatResult = await pool.query(`
        SELECT c.id
        FROM chats c
        INNER JOIN chat_members cm1 ON c.id = cm1.chat_id
        INNER JOIN chat_members cm2 ON c.id = cm2.chat_id
        WHERE c.type = 'personal'
        AND cm1.user_id = $1
        AND cm2.user_id = $2
      `, [senderId, recipientId])

      let chatId
      if (chatResult.rows.length > 0) {
        chatId = chatResult.rows[0].id
      } else {
        // Create new chat
        chatId = uuidv4()
        await pool.query('INSERT INTO chats (id, type) VALUES ($1, $2)', [chatId, 'personal'])
        await pool.query('INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2)', [chatId, senderId])
        await pool.query('INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2)', [chatId, recipientId])
        // Invalidate cache for both users
        await chatCache.invalidateChatListForUsers([senderId, recipientId])
      }

      // Unblock user if they're replying (sending a message)
      await pool.query(
        'UPDATE chat_members SET blocked = FALSE WHERE chat_id = $1 AND user_id = $2',
        [chatId, senderId]
      )

      // Create message
      const messageId = uuidv4()
      await pool.query(
        'INSERT INTO messages (id, chat_id, sender_id, type, content, media_url) VALUES ($1, $2, $3, $4, $5, $6)',
        [messageId, chatId, senderId, type, content, mediaUrl]
      )

      // Get message with sender info
      const messageResult = await pool.query(`
        SELECT m.*, u.id as sender_id, u.name as sender_name, u.phone as sender_phone, u.profile_picture as sender_profile_picture
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.id = $1
      `, [messageId])

      const message = {
        id: messageResult.rows[0].id,
        chatId: messageResult.rows[0].chat_id,
        senderId: messageResult.rows[0].sender_id,
        type: messageResult.rows[0].type,
        content: messageResult.rows[0].content,
        mediaUrl: messageResult.rows[0].media_url,
        createdAt: messageResult.rows[0].created_at,
        sender: {
          id: messageResult.rows[0].sender_id,
          name: messageResult.rows[0].sender_name,
          phone: messageResult.rows[0].sender_phone,
        },
      }

      // Invalidate message cache for this chat
      await chatCache.invalidateMessages(chatId)

      // Get chat members for broadcasting
      const membersResult = await pool.query(
        'SELECT user_id FROM chat_members WHERE chat_id = $1',
        [chatId]
      )

      // Broadcast message to recipient immediately via WebSocket
      // This ensures real-time delivery in addition to RabbitMQ event
      broadcastToUser(recipientId, {
        type: 'MESSAGE_SENT',
        payload: message,
        timestamp: new Date().toISOString(),
      })

      // Clear typing indicator for sender - broadcast to recipient
      broadcastToUser(recipientId, {
        type: 'TYPING_INDICATOR',
        payload: { chatId, userId: senderId, isTyping: false },
        timestamp: new Date().toISOString(),
      })

      // Publish event to message broker (for other services like notifications)
      await publishEvent('message.sent', {
        message,
        chatId,
      })

      res.json(message)
    } catch (error) {
      console.error('Error sending message to user:', error)
      res.status(500).json({ message: 'Failed to send message' })
    }
  })

  // Send message
  app.post('/api/chats/:chatId/messages', async (req, res) => {
    try {
      const { chatId } = req.params
      const { type, content, mediaUrl } = req.body
      const userId = req.userId

      // Verify user is member
      const memberCheck = await pool.query(
        'SELECT * FROM chat_members WHERE chat_id = $1 AND user_id = $2',
        [chatId, userId]
      )

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Not a member of this chat' })
      }

      // Check if user is blocked
      if (memberCheck.rows[0].blocked) {
        return res.status(403).json({ message: 'You are blocked in this chat' })
      }

      // Unblock user if they're replying (sending a message)
      await pool.query(
        'UPDATE chat_members SET blocked = FALSE WHERE chat_id = $1 AND user_id = $2',
        [chatId, userId]
      )

      const messageId = uuidv4()
      await pool.query(
        'INSERT INTO messages (id, chat_id, sender_id, type, content, media_url) VALUES ($1, $2, $3, $4, $5, $6)',
        [messageId, chatId, userId, type, content, mediaUrl]
      )

      // Get message with sender info
      const messageResult = await pool.query(`
        SELECT m.*, u.id as sender_id, u.name as sender_name, u.phone as sender_phone, u.profile_picture as sender_profile_picture
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.id = $1
      `, [messageId])

      const message = {
        id: messageResult.rows[0].id,
        chatId: messageResult.rows[0].chat_id,
        senderId: messageResult.rows[0].sender_id,
        type: messageResult.rows[0].type,
        content: messageResult.rows[0].content,
        mediaUrl: messageResult.rows[0].media_url,
        createdAt: messageResult.rows[0].created_at,
        sender: {
          id: messageResult.rows[0].sender_id,
          name: messageResult.rows[0].sender_name,
          phone: messageResult.rows[0].sender_phone,
        },
      }

      // Invalidate message cache for this chat
      await chatCache.invalidateMessages(chatId)

      // Get chat members for broadcasting
      const membersResult = await pool.query(
        'SELECT user_id FROM chat_members WHERE chat_id = $1',
        [chatId]
      )

      // Broadcast message to all chat members except sender immediately via WebSocket
      // This ensures real-time delivery in addition to RabbitMQ event
      membersResult.rows.forEach(row => {
        if (row.user_id !== userId) {
          broadcastToUser(row.user_id, {
            type: 'MESSAGE_SENT',
            payload: message,
            timestamp: new Date().toISOString(),
          })
        }
      })

      // Clear typing indicator for sender - broadcast to all other members
      membersResult.rows.forEach(row => {
        if (row.user_id !== userId) {
          broadcastToUser(row.user_id, {
            type: 'TYPING_INDICATOR',
            payload: { chatId, userId, isTyping: false },
            timestamp: new Date().toISOString(),
          })
        }
      })

      // Publish event to message broker (for other services like notifications)
      await publishEvent('message.sent', {
        message,
        chatId,
      })

      res.json(message)
    } catch (error) {
      console.error('Error sending message:', error)
      res.status(500).json({ message: 'Failed to send message' })
    }
  })

  // Mark message as read
  app.post('/api/chats/:chatId/messages/:messageId/read', async (req, res) => {
    try {
      const { chatId, messageId } = req.params
      const userId = req.userId

      // Unblock if user replies (sends a message after receiving)
      // This is handled when user sends a message, so we just mark as read here

      // Publish read event
      await publishEvent('message.read', {
        chatId,
        messageId,
        userId,
      })

      res.json({ success: true })
    } catch (error) {
      console.error('Error marking message as read:', error)
      res.status(500).json({ message: 'Failed to mark message as read' })
    }
  })

  // Block user in a chat
  app.post('/api/chats/:chatId/block', async (req, res) => {
    try {
      const { chatId } = req.params
      const userId = req.userId

      // Verify user is member
      const memberCheck = await pool.query(
        'SELECT * FROM chat_members WHERE chat_id = $1 AND user_id = $2',
        [chatId, userId]
      )

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Not a member of this chat' })
      }

      // Get the other user in personal chat
      const otherMember = await pool.query(
        'SELECT user_id FROM chat_members WHERE chat_id = $1 AND user_id != $2',
        [chatId, userId]
      )

      if (otherMember.rows.length === 0) {
        return res.status(400).json({ message: 'Cannot block in this chat' })
      }

      // Block the other user (set blocked = true for the current user's membership)
      await pool.query(
        'UPDATE chat_members SET blocked = TRUE WHERE chat_id = $1 AND user_id = $2',
        [chatId, userId]
      )

      res.json({ success: true })
    } catch (error) {
      console.error('Error blocking user:', error)
      res.status(500).json({ message: 'Failed to block user' })
    }
  })

  // Unblock user in a chat (happens automatically when user replies)
  app.post('/api/chats/:chatId/unblock', async (req, res) => {
    try {
      const { chatId } = req.params
      const userId = req.userId

      // Verify user is member
      const memberCheck = await pool.query(
        'SELECT * FROM chat_members WHERE chat_id = $1 AND user_id = $2',
        [chatId, userId]
      )

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Not a member of this chat' })
      }

      // Unblock (set blocked = false)
      await pool.query(
        'UPDATE chat_members SET blocked = FALSE WHERE chat_id = $1 AND user_id = $2',
        [chatId, userId]
      )

      res.json({ success: true })
    } catch (error) {
      console.error('Error unblocking user:', error)
      res.status(500).json({ message: 'Failed to unblock user' })
    }
  })
}
