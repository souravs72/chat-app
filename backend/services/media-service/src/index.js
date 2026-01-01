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

// Configure Google Cloud Storage or AWS S3
let storage = null
let storageConfigured = false
let storageType = null // 'gcs' or 's3'

// Try Google Cloud Storage first (for local development)
try {
  if (process.env.GOOGLE_CLOUD_STORAGE_BUCKET || process.env.GCS_BUCKET_NAME) {
    const { Storage } = await import('@google-cloud/storage').catch(() => null)
    if (Storage) {
      // Initialize GCS client
      // If GOOGLE_APPLICATION_CREDENTIALS is set, it will use that automatically
      // Otherwise, you can provide credentials via environment variables
      const storageConfig = {}
      
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Use service account key file
        storageConfig.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS
      } else if (process.env.GCS_PROJECT_ID && process.env.GCS_CLIENT_EMAIL && process.env.GCS_PRIVATE_KEY) {
        // Use explicit credentials from environment variables
        storageConfig.projectId = process.env.GCS_PROJECT_ID
        storageConfig.credentials = {
          client_email: process.env.GCS_CLIENT_EMAIL,
          private_key: process.env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }
      }
      
      storage = new Storage(storageConfig)
      storageType = 'gcs'
      storageConfigured = true
      console.warn('Google Cloud Storage configured successfully')
    }
  }
} catch (error) {
  console.warn('Google Cloud Storage not configured:', error.message)
}

// Fallback to AWS S3 if GCS not configured
if (!storageConfigured) {
  try {
    const AWS = await import('aws-sdk').catch(() => null)
    if (AWS && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      storage = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        endpoint: process.env.S3_ENDPOINT || undefined,
        s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
        signatureVersion: 'v4',
      })
      storageType = 's3'
      storageConfigured = true
      console.warn('AWS S3 configured successfully')
    } else {
      console.warn('S3 not configured - AWS credentials not provided')
    }
  } catch (error) {
    console.warn('S3 not configured:', error.message)
  }
}

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || process.env.GOOGLE_CLOUD_STORAGE_BUCKET || process.env.S3_BUCKET || 'chat-media'
const URL_EXPIRY = parseInt(process.env.URL_EXPIRY || '3600') // 1 hour default
const MEDIA_BASE_URL = process.env.MEDIA_BASE_URL || 
  (storageType === 'gcs' ? `https://storage.googleapis.com/${BUCKET_NAME}` : 'https://s3.amazonaws.com')

// Generate pre-signed upload URL
app.post('/api/media/upload-url', verifyToken, async (req, res) => {
  try {
    if (!storageConfigured || !storage) {
      return res.status(503).json({ 
        message: 'Media service not configured. Please configure Google Cloud Storage or S3 credentials.' 
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

    let uploadUrl
    let mediaUrl

    if (storageType === 'gcs') {
      // Google Cloud Storage
      const bucket = storage.bucket(BUCKET_NAME)
      const file = bucket.file(uniqueFileName)

      // Generate signed URL for upload (PUT request)
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + URL_EXPIRY * 1000,
        contentType: fileType,
      })

      uploadUrl = signedUrl
      
      // Generate signed URL for viewing (read access, longer expiry - 7 days)
      const [viewUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
      })
      
      mediaUrl = viewUrl
    } else {
      // AWS S3
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: uniqueFileName,
        ContentType: fileType,
        Expires: URL_EXPIRY,
      }

      uploadUrl = storage.getSignedUrl('putObject', uploadParams)
      mediaUrl = `${MEDIA_BASE_URL}/${uniqueFileName}`
    }

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
// In production, clients should upload directly to storage using the pre-signed URL
app.post('/api/media/upload', verifyToken, async (req, res) => {
  // This is a fallback for local development
  // In production, use pre-signed URLs
  res.status(501).json({ message: 'Direct upload not supported. Use pre-signed URLs.' })
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.warn(`Media service running on port ${PORT}`)
  console.warn(`Health check: http://localhost:${PORT}/health`)
  if (!storageConfigured) {
    console.warn('⚠️  Storage not configured - media uploads will not work')
    console.warn('   Configure Google Cloud Storage or AWS S3 credentials')
  } else {
    console.warn(`✅ Storage configured: ${storageType.toUpperCase()}`)
    console.warn(`   Bucket: ${BUCKET_NAME}`)
  }
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.warn('SIGTERM received, shutting down gracefully')
  process.exit(0)
})
