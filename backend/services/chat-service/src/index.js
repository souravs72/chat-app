import dotenv from 'dotenv'
dotenv.config()
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'
import { pool, runMigrations } from './db.js'
import { setupRoutes } from './routes.js'
import { setupWebSocket } from './websocket.js'
import { setupEventHandlers, connectToBroker } from './events.js'
import { chatCache } from './cache.js'

// Run migrations before starting server (non-blocking)
runMigrations().catch((error) => {
  console.error('Migration error on startup:', error.message)
  console.log('Service will continue, but database may not be properly initialized')
})

// Initialize cache service (non-blocking)
chatCache.initialize().catch((error) => {
  console.warn('Cache initialization failed:', error.message)
  console.log('Service will continue without cache (cache operations will be no-ops)')
})

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ noServer: true })

app.use(cors())
app.use(express.json())

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'chat-service' })
})

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

app.use('/api', verifyToken)

// Setup routes
setupRoutes(app)

// Upgrade HTTP to WebSocket
server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`)
    const token = url.searchParams.get('token')
    
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret')
      request.userId = decoded.userId || decoded.sub
      
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
    } catch (error) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
    }
  } catch (error) {
    console.error('WebSocket upgrade error:', error)
    socket.destroy()
  }
})

// Setup WebSocket handlers
setupWebSocket(wss)

// Connect to message broker (non-blocking)
connectToBroker().catch((error) => {
  console.warn('Message broker connection failed:', error.message)
  console.log('Service will continue without message broker (some features may not work)')
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Chat service running on port ${PORT}`)
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`)
  console.log(`Health check: http://localhost:${PORT}/health`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close(async () => {
    // Close Redis connection if connected
    if (chatCache.client) {
      try {
        await chatCache.client.quit()
        console.log('Redis connection closed')
      } catch (error) {
        console.error('Error closing Redis connection:', error)
      }
    }
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully')
  server.close(async () => {
    if (chatCache.client) {
      try {
        await chatCache.client.quit()
        console.log('Redis connection closed')
      } catch (error) {
        console.error('Error closing Redis connection:', error)
      }
    }
    console.log('Server closed')
    process.exit(0)
  })
})
