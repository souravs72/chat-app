import dotenv from 'dotenv'
dotenv.config()
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import cron from 'node-cron'
import { pool, runMigrations } from './db.js'
import { randomUUID as uuidv4 } from 'crypto'
import { storyCache, connectRedisCache } from './cache.js'

// Run migrations before starting server (non-blocking)
runMigrations().catch((error) => {
  console.error('Migration error on startup:', error.message)
  console.log('Service will continue, but database may not be properly initialized')
})

// Connect to Redis for caching (non-blocking)
connectRedisCache().catch((error) => {
  console.warn('Redis cache connection failed:', error.message)
  console.log('Service will continue without Redis caching (performance may be impacted)')
})

const app = express()

app.use(cors())
app.use(express.json())

// JWT verification middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    return res.status(401).json({ message: 'No token provided' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret')
    req.userId = decoded.userId || decoded.sub
    next()
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' })
  }
}

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'story-service' })
})

app.use('/api', verifyToken)

// Get all active stories
app.get('/api/stories', async (req, res) => {
  try {
    // Try cache first
    const cached = await storyCache.getStoriesList()
    if (cached) {
      return res.json(cached)
    }

    // Cache miss - fetch from database
    const result = await pool.query(`
      SELECT s.*, u.id as user_id, u.name, u.phone
      FROM stories s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.expires_at > NOW()
      ORDER BY s.created_at DESC
    `)

    const stories = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      mediaUrl: row.media_url,
      expiresAt: row.expires_at,
      user: row.user_id ? {
        id: row.user_id,
        name: row.name,
        phone: row.phone,
      } : null,
    }))

    // Cache the result
    await storyCache.setStoriesList(stories)

    res.json(stories)
  } catch (error) {
    console.error('Error fetching stories:', error)
    res.status(500).json({ message: 'Failed to fetch stories' })
  }
})

// Create story
app.post('/api/stories', async (req, res) => {
  try {
    const { mediaUrl } = req.body
    const userId = req.userId

    const storyId = uuidv4()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // 24 hours from now

    await pool.query(
      'INSERT INTO stories (id, user_id, media_url, expires_at) VALUES ($1, $2, $3, $4)',
      [storyId, userId, mediaUrl, expiresAt]
    )

    const result = await pool.query(`
      SELECT s.*, u.id as user_id, u.name, u.phone
      FROM stories s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = $1
    `, [storyId])

    const story = {
      id: result.rows[0].id,
      userId: result.rows[0].user_id,
      mediaUrl: result.rows[0].media_url,
      expiresAt: result.rows[0].expires_at,
      user: {
        id: result.rows[0].user_id,
        name: result.rows[0].name,
        phone: result.rows[0].phone,
      },
    }

    // Invalidate cache when a new story is created
    await storyCache.invalidateStoriesList()

    res.json(story)
  } catch (error) {
    console.error('Error creating story:', error)
    res.status(500).json({ message: 'Failed to create story' })
  }
})

// Cleanup expired stories (runs every hour)
cron.schedule('0 * * * *', async () => {
  try {
    await pool.query('DELETE FROM stories WHERE expires_at < NOW()')
    // Invalidate cache after cleanup
    await storyCache.invalidateStoriesList()
    console.log('Expired stories cleaned up')
  } catch (error) {
    console.error('Error cleaning up stories:', error)
  }
})

const PORT = process.env.PORT || 3003
app.listen(PORT, () => {
  console.log(`Story service running on port ${PORT}`)
})
