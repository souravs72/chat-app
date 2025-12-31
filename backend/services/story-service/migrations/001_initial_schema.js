export const up = async (pgm) => {
  // Check if table already exists (for backward compatibility)
  const storiesExists = await pgm.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'stories'
    )
  `)

  if (!storiesExists.rows[0].exists) {
    // Create stories table
    await pgm.query(`
      CREATE TABLE stories (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        media_url VARCHAR(500) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  // Create index for efficient expiry queries (IF NOT EXISTS handles duplicates)
  await pgm.query(`
    CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at)
  `)
}

export const down = async (pgm) => {
  await pgm.query('DROP INDEX IF EXISTS idx_stories_expires_at')
  await pgm.query('DROP TABLE IF EXISTS stories')
}

