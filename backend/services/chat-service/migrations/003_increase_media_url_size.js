export const up = async (pgm) => {
  // Increase media_url column size to TEXT to support long signed URLs
  await pgm.query(`
    ALTER TABLE messages 
    ALTER COLUMN media_url TYPE TEXT
  `)
}

export const down = async (pgm) => {
  // Revert back to VARCHAR(500) - this may truncate existing URLs
  await pgm.query(`
    ALTER TABLE messages 
    ALTER COLUMN media_url TYPE VARCHAR(500)
  `)
}

