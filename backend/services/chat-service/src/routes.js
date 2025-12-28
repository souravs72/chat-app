import { pool } from './db.js'
import { randomUUID as uuidv4 } from 'crypto'
import { publishEvent } from './events.js'

export function setupRoutes(app) {
  // Get all chats for user
  app.get('/api/chats', async (req, res) => {
    try {
      const userId = req.userId
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
          SELECT cm.*, u.id as user_id, u.name, u.phone, u.status, u.last_seen
          FROM chat_members cm
          LEFT JOIN users u ON cm.user_id = u.id
          WHERE cm.chat_id = $1
        `, [chat.id])

        return {
          ...chat,
          members: membersResult.rows.map(row => ({
            chatId: row.chat_id,
            userId: row.user_id,
            role: row.role,
            user: row.user_id ? {
              id: row.user_id,
              name: row.name,
              phone: row.phone,
              status: row.status,
              lastSeen: row.last_seen,
            } : null,
          })),
        }
      }))

      res.json(chats)
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

      const chatResult = await pool.query('SELECT * FROM chats WHERE id = $1', [chatId])
      if (chatResult.rows.length === 0) {
        return res.status(404).json({ message: 'Chat not found' })
      }

      const chat = chatResult.rows[0]

      // Get members
      const membersResult = await pool.query(`
        SELECT cm.*, u.id as user_id, u.name, u.phone, u.status, u.last_seen
        FROM chat_members cm
        LEFT JOIN users u ON cm.user_id = u.id
        WHERE cm.chat_id = $1
      `, [chatId])

      chat.members = membersResult.rows.map(row => ({
        chatId: row.chat_id,
        userId: row.user_id,
        role: row.role,
        user: row.user_id ? {
          id: row.user_id,
          name: row.name,
          phone: row.phone,
          status: row.status,
          lastSeen: row.last_seen,
        } : null,
      }))

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

      // Verify user is member
      const memberCheck = await pool.query(
        'SELECT * FROM chat_members WHERE chat_id = $1 AND user_id = $2',
        [chatId, userId]
      )

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Not a member of this chat' })
      }

      let query = `
        SELECT m.*, u.id as sender_id, u.name as sender_name, u.phone as sender_phone
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
        } : null,
      }))

      res.json(messages.reverse())
    } catch (error) {
      console.error('Error fetching messages:', error)
      res.status(500).json({ message: 'Failed to fetch messages' })
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

      const messageId = uuidv4()
      await pool.query(
        'INSERT INTO messages (id, chat_id, sender_id, type, content, media_url) VALUES ($1, $2, $3, $4, $5, $6)',
        [messageId, chatId, userId, type, content, mediaUrl]
      )

      // Get message with sender info
      const messageResult = await pool.query(`
        SELECT m.*, u.id as sender_id, u.name as sender_name, u.phone as sender_phone
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

      // Publish event to message broker
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
}
