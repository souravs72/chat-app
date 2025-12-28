import express from 'express'
import cors from 'cors'
import { createProxyMiddleware } from 'http-proxy-middleware'

const app = express()

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false
}))

// Parse JSON body BEFORE proxy middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Service URLs
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:8081',
  user: process.env.USER_SERVICE_URL || 'http://localhost:8082',
  chat: process.env.CHAT_SERVICE_URL || 'http://localhost:3001',
  media: process.env.MEDIA_SERVICE_URL || 'http://localhost:3002',
  story: process.env.STORY_SERVICE_URL || 'http://localhost:3003',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8083',
}

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

const PORT = process.env.PORT || 8080
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
