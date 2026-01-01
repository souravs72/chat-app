import amqp from 'amqplib'

/**
 * Async operation queue using RabbitMQ
 * This utility can be used to enqueue async operations that don't need immediate response
 */

let connection = null
let channel = null
const EXCHANGE_NAME = 'async_operations'
const QUEUE_NAME = 'async_ops_queue'

/**
 * Initialize RabbitMQ connection for async operations
 * @param {string} amqpUrl - RabbitMQ connection URL
 * @returns {Promise<void>}
 */
export async function initializeAsyncQueue(amqpUrl) {
  try {
    connection = await amqp.connect(amqpUrl)
    channel = await connection.createChannel()

    // Declare exchange for async operations
    await channel.assertExchange(EXCHANGE_NAME, 'direct', { durable: true })

    // Declare queue for async operations
    await channel.assertQueue(QUEUE_NAME, { durable: true })

    // Bind queue to exchange
    await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'operation')

    console.warn('[AsyncQueue] RabbitMQ connection established for async operations')
  } catch (error) {
    console.error('[AsyncQueue] Failed to initialize RabbitMQ connection:', error)
    console.warn('[AsyncQueue] Async operations will be disabled')
    // Don't throw - async operations are optional
  }
}

/**
 * Enqueue an async operation
 * @param {string} operationType - Type of operation (e.g., 'email-send', 'notification', 'cache-warm')
 * @param {Object} operationData - Operation data payload
 * @param {Object} options - Additional options (priority, delay)
 * @returns {Promise<boolean>} - True if successfully enqueued
 */
export async function enqueueAsyncOperation(operationType, operationData, options = {}) {
  if (!channel) {
    console.warn('[AsyncQueue] Channel not available, cannot enqueue operation')
    return false
  }

  try {
    const message = {
      type: operationType,
      data: operationData,
      timestamp: Date.now(),
      ...options
    }

    const messageBuffer = Buffer.from(JSON.stringify(message))

    // Publish to exchange with routing key
    const published = channel.publish(
      EXCHANGE_NAME,
      'operation',
      messageBuffer,
      {
        persistent: true, // Make messages persistent
        priority: options.priority || 0, // Message priority (0-255)
        expiration: options.expiration || undefined // Message expiration in ms
      }
    )

    if (!published) {
      console.warn('[AsyncQueue] Message could not be published (channel buffer full)')
      return false
    }

    return true
  } catch (error) {
    console.error('[AsyncQueue] Error enqueuing operation:', error)
    return false
  }
}

/**
 * Close RabbitMQ connection
 * @returns {Promise<void>}
 */
export async function closeAsyncQueue() {
  try {
    if (channel) {
      await channel.close()
      channel = null
    }
    if (connection) {
      await connection.close()
      connection = null
    }
    console.warn('[AsyncQueue] RabbitMQ connection closed')
  } catch (error) {
    console.error('[AsyncQueue] Error closing connection:', error)
  }
}

/**
 * Check if async queue is available
 * @returns {boolean}
 */
export function isAsyncQueueAvailable() {
  return channel !== null
}


