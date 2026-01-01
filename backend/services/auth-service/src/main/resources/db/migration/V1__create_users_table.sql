-- Create users table for auth service (if not exists, user-service may have created it)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    last_seen TIMESTAMP
);

-- Add password column if it doesn't exist (user-service creates table without password)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);

-- Update existing rows to have a default password if null (for existing data)
UPDATE users SET password = '' WHERE password IS NULL;

-- Make password NOT NULL (will fail if there are nulls, but we just set them above)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' 
               AND column_name = 'password' 
               AND is_nullable = 'YES') THEN
        ALTER TABLE users ALTER COLUMN password SET NOT NULL;
    END IF;
END $$;

-- Ensure status is NOT NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' 
               AND column_name = 'status' 
               AND is_nullable = 'YES') THEN
        ALTER TABLE users ALTER COLUMN status SET NOT NULL;
    END IF;
END $$;

-- Create index on phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);




