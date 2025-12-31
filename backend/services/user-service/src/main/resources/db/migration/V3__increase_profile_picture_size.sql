-- Increase profile_picture column size to support base64 images
ALTER TABLE users ALTER COLUMN profile_picture TYPE TEXT;

