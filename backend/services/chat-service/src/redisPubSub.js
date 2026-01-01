import { createClient } from 'redis';
import { randomUUID } from 'crypto';

/**
 * Redis Pub/Sub for cross-instance WebSocket communication
 * Enables horizontal scaling of chat service instances
 */

let publisher = null;
let subscriber = null;
let instanceId = null;

const USER_CHANNEL_PREFIX = 'ws:user:';
const CHAT_CHANNEL_PREFIX = 'ws:chat:';

/**
 * Initialize Redis pub/sub connections
 */
export async function initializeRedisPubSub() {
  try {
    const redisUrl =
      process.env.REDIS_URL ||
      `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;

    instanceId = randomUUID(); // Unique instance identifier

    // Create base client
    const baseClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: retries => {
          if (retries > 10) {
            console.error('[RedisPubSub] Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    // Publisher is the base client
    publisher = baseClient;

    publisher.on('error', err =>
      console.error('[RedisPubSub] Publisher error:', err)
    );
    publisher.on('connect', () =>
      console.warn('[RedisPubSub] Publisher connecting...')
    );
    publisher.on('ready', () => console.warn('[RedisPubSub] Publisher ready'));

    // Create subscriber using duplicate() - required for pub/sub in Redis v4
    subscriber = baseClient.duplicate({
      socket: {
        reconnectStrategy: retries => {
          if (retries > 10) {
            console.error(
              '[RedisPubSub] Max reconnection attempts for subscriber reached'
            );
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    subscriber.on('error', err =>
      console.error('[RedisPubSub] Subscriber error:', err)
    );
    subscriber.on('connect', () =>
      console.warn('[RedisPubSub] Subscriber connecting...')
    );
    subscriber.on('ready', () => console.warn('[RedisPubSub] Subscriber ready'));

    await publisher.connect();
    await subscriber.connect();

    console.warn(`[RedisPubSub] Initialized (instance: ${instanceId})`);
    return { publisher, subscriber, instanceId };
  } catch (error) {
    console.error('[RedisPubSub] Failed to initialize Redis pub/sub:', error);
    throw error;
  }
}

// Store handlers for each subscribed channel
const channelHandlers = new Map();

/**
 * Subscribe to user-specific channel for cross-instance broadcasts
 * @param {string} userId - User ID to subscribe to
 * @param {Function} handler - Message handler function
 */
export async function subscribeToUser(userId, handler) {
  if (!subscriber) {
    console.warn(
      '[RedisPubSub] Subscriber not initialized, cannot subscribe to user channel'
    );
    return;
  }

  try {
    const channel = USER_CHANNEL_PREFIX + userId;

    // Store handler for this channel
    channelHandlers.set(channel, handler);

    // Subscribe to channel with handler as callback (Redis v4 API pattern)
    // In Redis v4, the listener function is passed as second argument to subscribe()
    await subscriber.subscribe(channel, (message, channelName) => {
      try {
        const event = JSON.parse(message);
        // Ignore messages from the same instance to prevent loops
        if (event.instanceId !== instanceId) {
          const channelHandler = channelHandlers.get(channelName);
          if (channelHandler) {
            channelHandler(event);
          }
        }
      } catch (error) {
        console.error(
          `[RedisPubSub] Error handling message on channel ${channelName}:`,
          error
        );
      }
    });

    console.warn(`[RedisPubSub] Subscribed to user channel: ${channel}`);
  } catch (error) {
    console.error(`[RedisPubSub] Error subscribing to user ${userId}:`, error);
    channelHandlers.delete(USER_CHANNEL_PREFIX + userId);
  }
}

/**
 * Publish message to user-specific channel
 * @param {string} userId - User ID to broadcast to
 * @param {Object} event - Event object to broadcast
 */
export async function publishToUser(userId, event) {
  if (!publisher) {
    console.warn(
      '[RedisPubSub] Publisher not initialized, cannot publish to user channel'
    );
    return;
  }

  try {
    const channel = USER_CHANNEL_PREFIX + userId;
    const message = JSON.stringify({
      ...event,
      instanceId, // Include instance ID to prevent echo
      timestamp: new Date().toISOString(),
    });
    await publisher.publish(channel, message);
  } catch (error) {
    console.error(`[RedisPubSub] Error publishing to user ${userId}:`, error);
  }
}

/**
 * Subscribe to chat-specific channel
 * @param {string} chatId - Chat ID to subscribe to
 * @param {Function} handler - Message handler function
 */
export async function subscribeToChat(chatId, handler) {
  if (!subscriber) {
    console.warn(
      '[RedisPubSub] Subscriber not initialized, cannot subscribe to chat channel'
    );
    return;
  }

  try {
    const channel = CHAT_CHANNEL_PREFIX + chatId;

    // Store handler for this channel
    channelHandlers.set(channel, handler);

    // Subscribe to channel with handler as callback (Redis v4 API pattern)
    await subscriber.subscribe(channel, (message, channelName) => {
      try {
        const event = JSON.parse(message);
        // Ignore messages from the same instance to prevent loops
        if (event.instanceId !== instanceId) {
          const channelHandler = channelHandlers.get(channelName);
          if (channelHandler) {
            channelHandler(event);
          }
        }
      } catch (error) {
        console.error(
          `[RedisPubSub] Error handling message on channel ${channelName}:`,
          error
        );
      }
    });

    console.warn(`[RedisPubSub] Subscribed to chat channel: ${channel}`);
  } catch (error) {
    console.error(`[RedisPubSub] Error subscribing to chat ${chatId}:`, error);
    channelHandlers.delete(CHAT_CHANNEL_PREFIX + chatId);
  }
}

/**
 * Publish message to chat-specific channel
 * @param {string} chatId - Chat ID to broadcast to
 * @param {Object} event - Event object to broadcast
 */
export async function publishToChat(chatId, event) {
  if (!publisher) {
    console.warn(
      '[RedisPubSub] Publisher not initialized, cannot publish to chat channel'
    );
    return;
  }

  try {
    const channel = CHAT_CHANNEL_PREFIX + chatId;
    const message = JSON.stringify({
      ...event,
      instanceId,
      timestamp: new Date().toISOString(),
    });
    await publisher.publish(channel, message);
  } catch (error) {
    console.error(`[RedisPubSub] Error publishing to chat ${chatId}:`, error);
  }
}

/**
 * Get instance ID (for debugging/monitoring)
 */
export function getInstanceId() {
  return instanceId;
}

/**
 * Check if Redis pub/sub is available
 */
export function isPubSubAvailable() {
  return publisher !== null && subscriber !== null;
}

/**
 * Unsubscribe from user channel
 * @param {string} userId - User ID to unsubscribe from
 */
export async function unsubscribeFromUser(userId) {
  if (!subscriber) return;

  try {
    const channel = USER_CHANNEL_PREFIX + userId;
    await subscriber.unsubscribe(channel);
    channelHandlers.delete(channel);
    console.warn(`[RedisPubSub] Unsubscribed from user channel: ${channel}`);
  } catch (error) {
    console.error(
      `[RedisPubSub] Error unsubscribing from user ${userId}:`,
      error
    );
  }
}

/**
 * Close Redis pub/sub connections
 */
export async function closeRedisPubSub() {
  try {
    // Clear all handlers
    channelHandlers.clear();

    if (subscriber) {
      await subscriber.quit();
      subscriber = null;
    }
    if (publisher) {
      await publisher.quit();
      publisher = null;
    }
    console.warn('[RedisPubSub] Connections closed');
  } catch (error) {
    console.error('[RedisPubSub] Error closing connections:', error);
  }
}
