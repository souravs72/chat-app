import dotenv from 'dotenv'
dotenv.config()
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import { randomUUID as uuidv4 } from 'crypto'

const app = express()

app.use(cors())
app.use(express.json())

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'media-service' })
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

// Configure AWS S3 (or compatible object storage)
// For local development, you can use MinIO or skip S3 configuration
let s3 = null
let s3Configured = false

try {
  const AWS = await import('aws-sdk').catch(() => null)
  if (AWS && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      endpoint: process.env.S3_ENDPOINT || undefined,
      s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      signatureVersion: 'v4',
    })
    s3Configured = true
    console.log('S3 configured successfully')
  } else {
    console.warn('S3 not configured - AWS credentials not provided')
  }
} catch (error) {
  console.warn('S3 not configured:', error.message)
}

const BUCKET_NAME = process.env.S3_BUCKET || 'chat-media'
const URL_EXPIRY = parseInt(process.env.URL_EXPIRY || '3600') // 1 hour default

// Generate pre-signed upload URL
app.post('/api/media/upload-url', verifyToken, async (req, res) => {
  try {
    if (!s3Configured || !s3) {
      return res.status(503).json({ 
        message: 'Media service not configured. Please configure S3 credentials.' 
      })
    }

    const { fileName, fileType } = req.body
    const userId = req.userId

    if (!fileName || !fileType) {
      return res.status(400).json({ message: 'fileName and fileType are required' })
    }

    // Generate unique file name
    const fileExtension = fileName.split('.').pop() || 'bin'
    const uniqueFileName = `${userId}/${uuidv4()}.${fileExtension}`

    // Generate pre-signed URL for upload
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: uniqueFileName,
      ContentType: fileType,
      Expires: URL_EXPIRY,
    }

    const uploadUrl = s3.getSignedUrl('putObject', uploadParams)

    // Generate media URL (this would be the public URL or another pre-signed URL)
    const mediaUrl = `${process.env.MEDIA_BASE_URL || 'https://s3.amazonaws.com'}/${BUCKET_NAME}/${uniqueFileName}`

    res.json({
      uploadUrl,
      mediaUrl,
    })
  } catch (error) {
    console.error('Error generating upload URL:', error)
    res.status(500).json({ message: 'Failed to generate upload URL' })
  }
})

// For local development, you might want a simple file upload endpoint
// In production, clients should upload directly to S3 using the pre-signed URL
app.post('/api/media/upload', verifyToken, async (req, res) => {
  // This is a fallback for local development
  // In production, use pre-signed URLs
  res.status(501).json({ message: 'Direct upload not supported. Use pre-signed URLs.' })
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.log(`Media service running on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
  if (!s3Configured) {
    console.warn('⚠️  S3 not configured - media uploads will not work')
  }
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  process.exit(0)
})
