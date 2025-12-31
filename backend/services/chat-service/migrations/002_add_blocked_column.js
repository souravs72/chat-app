export const up = async (pgm) => {
  // Add blocked column if it doesn't exist (for backward compatibility)
  await pgm.query(`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_members' AND column_name = 'blocked'
      ) THEN
        ALTER TABLE chat_members ADD COLUMN blocked BOOLEAN DEFAULT FALSE;
      END IF;
    END $$;
  `)
}

export const down = async (pgm) => {
  await pgm.query(`
    DO $$ 
    BEGIN 
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_members' AND column_name = 'blocked'
      ) THEN
        ALTER TABLE chat_members DROP COLUMN blocked;
      END IF;
    END $$;
  `)
}

