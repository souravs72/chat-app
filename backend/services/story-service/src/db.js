import dotenv from 'dotenv'
dotenv.config()
import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'chatdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
})

// Initialize database schema
export async function initSchema() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS stories (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        media_url VARCHAR(500) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at)
    `)

    console.log('Stories database schema initialized')
  } finally {
    client.release()
  }
}

// Initialize on import (non-blocking)
initSchema().catch((error) => {
  console.error('Failed to initialize database schema:', error.message)
  console.log('Schema will be created on first connection')
})
