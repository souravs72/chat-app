import jwt from 'jsonwebtoken'

/**
 * Extract and verify JWT token from request headers
 * @param {string} authHeader - Authorization header value (e.g., "Bearer <token>")
 * @param {string} secret - JWT secret for verification
 * @returns {string|null} - User ID if token is valid, null otherwise
 */
export function extractUserIdFromToken(authHeader, secret) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  try {
    const token = authHeader.substring(7) // Remove "Bearer " prefix
    const decoded = jwt.verify(token, secret)
    // JWT can have userId in claims or sub field
    return decoded.userId || decoded.sub || null
  } catch (error) {
    // Token is invalid or expired
    return null
  }
}

