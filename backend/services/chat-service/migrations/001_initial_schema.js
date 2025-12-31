export const up = async (pgm) => {
  // Check if tables already exist (for backward compatibility)
  const chatsExists = await pgm.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'chats'
    )
  `)

  if (!chatsExists.rows[0].exists) {
    // Create chats table
    await pgm.query(`
      CREATE TABLE chats (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  const membersExists = await pgm.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'chat_members'
    )
  `)

  if (!membersExists.rows[0].exists) {
    // Create chat_members table
    await pgm.query(`
      CREATE TABLE chat_members (
        chat_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'member',
        blocked BOOLEAN DEFAULT FALSE,
        PRIMARY KEY (chat_id, user_id),
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      )
    `)
  }

  const messagesExists = await pgm.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'messages'
    )
  `)

  if (!messagesExists.rows[0].exists) {
    // Create messages table
    await pgm.query(`
      CREATE TABLE messages (
        id VARCHAR(255) PRIMARY KEY,
        chat_id VARCHAR(255) NOT NULL,
        sender_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        media_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      )
    `)
  }

  // Create indexes (IF NOT EXISTS handles duplicates)
  await pgm.query(`
    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)
  `)

  await pgm.query(`
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC)
  `)
}

export const down = async (pgm) => {
  await pgm.query('DROP INDEX IF EXISTS idx_messages_created_at')
  await pgm.query('DROP INDEX IF EXISTS idx_messages_chat_id')
  await pgm.query('DROP TABLE IF EXISTS messages')
  await pgm.query('DROP TABLE IF EXISTS chat_members')
  await pgm.query('DROP TABLE IF EXISTS chats')
}

