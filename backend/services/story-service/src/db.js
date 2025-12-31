import dotenv from 'dotenv'
dotenv.config()
import pg from 'pg'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readdirSync } from 'fs'

const { Pool } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'chatdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
})

// Simple migration runner compatible with ES modules
export async function runMigrations() {
  const client = await pool.connect()
  try {
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS pgmigrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        run_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Get list of migration files
    const migrationsDir = join(__dirname, '../migrations')
    let migrationFiles = []
    
    try {
      const files = readdirSync(migrationsDir)
        .filter(f => f.endsWith('.js') && f.match(/^\d+_.*\.js$/))
        .sort()
      
      for (const file of files) {
        const migrationPath = join(migrationsDir, file)
        // Use file:// protocol for ES module imports
        const fileUrl = `file://${migrationPath}`
        const migration = await import(fileUrl)
        migrationFiles.push({ name: file, migration })
      }
    } catch (error) {
      console.warn('Could not read migrations directory, using fallback schema initialization')
      return await initSchemaFallback(client)
    }

    // Check which migrations have been run
    const result = await client.query('SELECT name FROM pgmigrations')
    const runMigrations = new Set(result.rows.map(row => row.name))

    // Run pending migrations
    for (const { name, migration } of migrationFiles) {
      if (!runMigrations.has(name)) {
        console.log(`Running migration: ${name}`)
        try {
          // Create a pgm-like object for compatibility
          const pgm = {
            query: (sql, params) => client.query(sql, params),
            sql: (sql) => client.query(sql),
          }

          if (migration.up) {
            await migration.up(pgm)
          }
          await client.query('INSERT INTO pgmigrations (name) VALUES ($1)', [name])
          console.log(`Migration ${name} completed successfully`)
        } catch (error) {
          console.error(`Error running migration ${name}:`, error)
          throw error
        }
      }
    }

    console.log('Database migrations completed')
  } catch (error) {
    console.error('Migration error:', error.message)
    // Fallback to old schema initialization for backward compatibility
    console.log('Falling back to schema initialization...')
    await initSchemaFallback(client)
  } finally {
    client.release()
  }
}

// Fallback schema initialization (for backward compatibility)
async function initSchemaFallback(client) {
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

    console.log('Stories database schema initialized (fallback)')
  } catch (error) {
    console.error('Fallback schema initialization failed:', error.message)
    throw error
  }
}

// Run migrations on import (non-blocking)
runMigrations().catch((error) => {
  console.error('Failed to run migrations:', error.message)
  console.log('Service will continue, but database may not be properly initialized')
})
