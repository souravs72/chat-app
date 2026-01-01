import express from 'express'
import cors from 'cors'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { createRedisClient } from './utils/redis.js'
import { createRateLimiter } from './middleware/rateLimiter.js'
import { createRequestQueueMiddleware } from './middleware/requestQueue.js'

const app = express()

// Initialize Redis client and middleware
let redisClient = null
let rateLimiter = null
let requestQueueMiddleware = null

async function initializeRateLimiting() {
  try {
    // Create Redis client
    redisClient = await createRedisClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD
    })

    // Create rate limiter middleware
    rateLimiter = createRateLimiter({
      redisClient,
      jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production-minimum-32-characters',
      userLimit: parseInt(process.env.RATE_LIMIT_USER || '100'), // 100 requests per minute per user
      userWindowMs: parseInt(process.env.RATE_LIMIT_USER_WINDOW_MS || '60000'), // 1 minute
      ipLimit: parseInt(process.env.RATE_LIMIT_IP || '50'), // 50 requests per minute per IP
      ipWindowMs: parseInt(process.env.RATE_LIMIT_IP_WINDOW_MS || '60000'), // 1 minute
      skipPaths: ['/health']
    })

    // Create request queue middleware
    requestQueueMiddleware = createRequestQueueMiddleware({
      redisClient,
      highPriorityPaths: [
        '/api/chats/personal',
        '/api/chats/channel',
        '/api/users/me'
      ]
    })

    console.log('[RateLimiter] Rate limiting initialized')
    console.log('[RequestQueue] Request queue middleware initialized')

    // Initialize async operations queue (optional, non-blocking)
    const { initializeAsyncQueue } = await import('./utils/asyncQueue.js')
    const amqpUrl = process.env.AMQP_URL || 'amqp://admin:admin@rabbitmq:5672'
    initializeAsyncQueue(amqpUrl).catch((error) => {
      console.warn('[AsyncQueue] Failed to initialize async queue:', error.message)
    })

    return true
  } catch (error) {
    console.error('[RateLimiter] Failed to initialize rate limiting:', error)
    console.warn('[RateLimiter] Continuing without rate limiting (requests will not be rate limited)')
    // Continue without rate limiting if Redis is unavailable
    // In production, you might want to fail fast instead
    return false
  }
}

// Service URLs
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:8081',
  user: process.env.USER_SERVICE_URL || 'http://localhost:8082',
  chat: process.env.CHAT_SERVICE_URL || 'http://localhost:3001',
  media: process.env.MEDIA_SERVICE_URL || 'http://localhost:3002',
  story: process.env.STORY_SERVICE_URL || 'http://localhost:3003',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8083',
}

async function setupApp() {
  // Initialize rate limiting first
  await initializeRateLimiting()

  // Setup middleware
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false
  }))

  // Parse JSON body BEFORE proxy middleware
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  // Apply rate limiting middleware (if initialized)
  app.use((req, res, next) => {
    if (rateLimiter) {
      return rateLimiter(req, res, next)
    }
    // If rate limiter is not initialized, allow the request
    next()
  })

  // Apply request queue middleware (if initialized)
  if (requestQueueMiddleware) {
    app.use(requestQueueMiddleware)
  }

  // Setup routes
  // Proxy to auth service
  app.use('/api/auth', createProxyMiddleware({
    target: SERVICES.auth,
    changeOrigin: true,
    secure: false,
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[AUTH] ${req.method} ${req.url} -> ${SERVICES.auth}${req.url}`)
      // Forward request body if present
      if (req.body && Object.keys(req.body).length > 0) {
        const bodyData = JSON.stringify(req.body)
        proxyReq.setHeader('Content-Type', 'application/json')
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData))
        proxyReq.write(bodyData)
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`[AUTH] ${proxyRes.statusCode} ${req.url}`)
    },
    onError: (err, req, res) => {
      console.error('[AUTH] Error:', err.message)
      if (!res.headersSent) {
        res.status(502).json({ message: 'Service unavailable', error: err.message })
      }
    },
  }))

  // Proxy user message endpoint to chat service (must be before general /api/users route)
  app.use('/api/users/:userId/messages', createProxyMiddleware({
    target: SERVICES.chat,
    changeOrigin: true,
    pathRewrite: {
      '^/api/users': '/api/users', // Keep the path as is for chat service
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[CHAT] ${req.method} ${req.url} -> ${SERVICES.chat}${req.url}`)
      if (req.body && Object.keys(req.body).length > 0) {
        const bodyData = JSON.stringify(req.body)
        proxyReq.setHeader('Content-Type', 'application/json')
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData))
        proxyReq.write(bodyData)
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`[CHAT] ${proxyRes.statusCode} ${req.url}`)
    },
    onError: (err, req, res) => {
      console.error('[CHAT] Error:', err.message)
      if (!res.headersSent) {
        res.status(502).json({ message: 'Service unavailable', error: err.message })
      }
    },
  }))

  // Proxy to user service
  app.use('/api/users', createProxyMiddleware({
    target: SERVICES.user,
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      if (req.body && Object.keys(req.body).length > 0) {
        const bodyData = JSON.stringify(req.body)
        proxyReq.setHeader('Content-Type', 'application/json')
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData))
        proxyReq.write(bodyData)
      }
    },
  }))

  // Proxy to chat service
  app.use('/api/chats', createProxyMiddleware({
    target: SERVICES.chat,
    changeOrigin: true,
    ws: true,
    onProxyReq: (proxyReq, req, res) => {
      if (req.body && Object.keys(req.body).length > 0) {
        const bodyData = JSON.stringify(req.body)
        proxyReq.setHeader('Content-Type', 'application/json')
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData))
        proxyReq.write(bodyData)
      }
    },
  }))

  // Proxy to media service
  app.use('/api/media', createProxyMiddleware({
    target: SERVICES.media,
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      if (req.body && Object.keys(req.body).length > 0) {
        const bodyData = JSON.stringify(req.body)
        proxyReq.setHeader('Content-Type', 'application/json')
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData))
        proxyReq.write(bodyData)
      }
    },
  }))

  // Proxy to story service
  app.use('/api/stories', createProxyMiddleware({
    target: SERVICES.story,
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      if (req.body && Object.keys(req.body).length > 0) {
        const bodyData = JSON.stringify(req.body)
        proxyReq.setHeader('Content-Type', 'application/json')
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData))
        proxyReq.write(bodyData)
      }
    },
  }))

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' })
  })
}

const PORT = process.env.PORT || 8080

// Initialize and start server
async function startServer() {
  // Setup app (middleware and routes)
  await setupApp()
  
  const server = app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`)
  })

  // Handle WebSocket upgrades for chat service
  server.on('upgrade', (request, socket, head) => {
    // Proxy WebSocket connections to chat service
    const chatServiceUrl = new URL(SERVICES.chat.replace('http://', 'ws://').replace('https://', 'wss://'))
    // This would need proper WebSocket proxying implementation
    // For now, clients should connect directly to chat service WebSocket
  })

  // Graceful shutdown
  const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`)
    
    server.close(() => {
      console.log('HTTP server closed')
    })

    if (redisClient) {
      try {
        await redisClient.quit()
        console.log('Redis connection closed')
      } catch (error) {
        console.error('Error closing Redis connection:', error)
      }
    }

    // Close async queue connection
    await closeAsyncQueue()

    process.exit(0)
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
