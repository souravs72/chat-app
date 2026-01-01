# Redis vs RabbitMQ/Kafka Usage Guide

This document explains how Redis and the message broker (RabbitMQ) are used in the application, when each is used, and confirms they do not conflict.

## Important Note: Kafka vs RabbitMQ

**Current Implementation**: The application uses **RabbitMQ** (not Kafka) for message brokering.

- **RabbitMQ**: Currently implemented and running
- **Kafka**: Not currently used in the codebase

If you plan to migrate from RabbitMQ to Kafka, that would require code changes. This document focuses on the current RabbitMQ implementation.

---

## Overview: They Don't Conflict

**Redis** and **RabbitMQ** serve completely different purposes and are complementary technologies:

| Aspect               | Redis                           | RabbitMQ                         |
| -------------------- | ------------------------------- | -------------------------------- |
| **Primary Purpose**  | In-memory data store / cache    | Message broker / event streaming |
| **Data Model**       | Key-value, sorted sets, lists   | Queues, exchanges, topics        |
| **Persistence**      | Optional (can be in-memory)     | Persistent queues                |
| **Use Case**         | Fast data access, rate limiting | Asynchronous event communication |
| **Data Lifespan**    | TTL-based (seconds/minutes)     | Until consumed and acknowledged  |
| **Network Protocol** | Redis protocol (RESP)           | AMQP protocol                    |

---

## Redis Usage

### Current Implementation

Redis is used for **distributed rate limiting** in the API Gateway.

#### Location

- **Service**: API Gateway (`backend/api-gateway`)
- **Connection**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`

#### Use Cases

1. **Rate Limiting (Sliding Window Algorithm)**
   - Stores request timestamps in Redis sorted sets
   - Keys: `ratelimit:user:{userId}` or `ratelimit:ip:{ipAddress}`
   - TTL: Automatically expires after the rate limit window
   - Algorithm: Sliding window log for accurate distributed rate limiting

#### Example Redis Keys

```
ratelimit:user:user123        → Sorted set with request timestamps
ratelimit:ip:192.168.1.100    → Sorted set with request timestamps
```

#### Code References

- `backend/api-gateway/src/middleware/rateLimiter.js`
- `backend/api-gateway/src/utils/redis.js`

#### Redis Operations Used

- `ZADD` - Add timestamp to sorted set
- `ZREMRANGEBYSCORE` - Remove old timestamps outside window
- `ZCARD` - Count requests in current window
- `ZRANGEWITHSCORES` - Get oldest timestamp for reset time calculation
- `EXPIRE` - Set TTL to prevent memory leaks

---

## RabbitMQ Usage

### Current Implementation

RabbitMQ is used for **asynchronous event-driven communication** between microservices.

#### Location

- **Service**: Chat Service, Notification Service
- **Connection**: `AMQP_URL` (e.g., `amqp://admin:admin@rabbitmq:5672`)

#### Use Cases

1. **Event Publishing**
   - Chat Service publishes events when messages are sent
   - Events: `message.sent`, `typing.indicator`, etc.

2. **Event Consumption**
   - Notification Service consumes `message.sent` events
   - Chat Service consumes its own events for WebSocket broadcasting

#### Exchange and Queues

**Exchange**: `chat_events` (topic exchange)

**Queues**:

- `notification_queue` - Consumed by Notification Service
- `chat_service_queue` - Consumed by Chat Service

**Routing Keys**:

- `message.sent` - Message sent event
- `message.*` - All message events
- `typing.indicator` - Typing indicator events

#### Code References

- `backend/services/chat-service/src/events.js`
- `backend/services/notification-service/src/main/java/com/chatplatform/notification/service/NotificationService.java`

#### Event Flow Example

```
1. User sends message via REST API
   ↓
2. Chat Service receives request
   ↓
3. Chat Service saves message to PostgreSQL
   ↓
4. Chat Service publishes event to RabbitMQ
   Exchange: "chat_events"
   Routing Key: "message.sent"
   ↓
5. RabbitMQ routes to queues:
   - notification_queue → Notification Service
   - chat_service_queue → Chat Service (for WebSocket)
   ↓
6. Services consume and process events asynchronously
```

---

## When to Use Each

### Use Redis When:

✅ **Rate Limiting**

- Need to track request counts across distributed services
- Need fast, atomic operations
- Need automatic expiration (TTL)

✅ **Caching** (Future Use)

- User profiles
- Chat metadata
- Recent messages
- Session data

✅ **Real-time Data** (Future Use)

- User presence (online/offline)
- Typing indicators (could be cached)
- Real-time counters

✅ **Distributed Locks** (Future Use)

- Preventing duplicate processing
- Coordinating between service instances

### Use RabbitMQ When:

✅ **Event-Driven Communication**

- Services need to communicate asynchronously
- Need guaranteed message delivery
- Need message persistence
- Need pub/sub patterns

✅ **Decoupling Services**

- Services should not directly call each other
- Need to buffer messages during high load
- Need retry mechanisms

✅ **Event Sourcing** (Future Use)

- Store all events for audit trail
- Replay events for debugging
- Event-driven architecture

---

## Current Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP Request
       ↓
┌─────────────────────────────────────┐
│        API Gateway                  │
│  ┌──────────────────────────────┐  │
│  │   Rate Limiting Middleware   │  │
│  │   (Uses Redis)               │  │
│  │   - Check rate limit         │  │
│  │   - Update counters          │  │
│  └──────────────────────────────┘  │
└──────┬──────────────────────────────┘
       │
       │ HTTP Request (if rate limit OK)
       ↓
┌─────────────────────────────────────┐
│      Chat Service                   │
│  ┌──────────────────────────────┐  │
│  │  1. Process request          │  │
│  │  2. Save to PostgreSQL       │  │
│  │  3. Publish to RabbitMQ      │──┼──┐
│  │     Exchange: chat_events    │  │  │
│  │     Routing: message.sent    │  │  │
│  └──────────────────────────────┘  │  │
└─────────────────────────────────────┘  │
                                         │
                            ┌────────────┴────────────┐
                            │                         │
                            ↓                         ↓
                    ┌───────────────┐        ┌───────────────┐
                    │   RabbitMQ    │        │   RabbitMQ    │
                    │   Exchange    │        │     Queue     │
                    │ chat_events   │───────→│ notification_ │
                    │  (topic)      │        │    queue      │
                    └───────────────┘        └───────┬───────┘
                            │                        │
                            │                        ↓
                    ┌───────┴────────┐     ┌─────────────────┐
                    │                │     │ Notification    │
                    │  chat_service  │     │ Service         │
                    │     queue      │     │ (consumes       │
                    │                │     │  messages)      │
                    └───────┬────────┘     └─────────────────┘
                            │
                            ↓
                    ┌─────────────────┐
                    │  Chat Service   │
                    │  (WebSocket     │
                    │   Broadcasting) │
                    └─────────────────┘
```

---

## Configuration

### Redis Configuration

**Environment Variables**:

```bash
REDIS_HOST=redis              # Docker service name
REDIS_PORT=6379
REDIS_PASSWORD=               # Optional
```

**Docker Compose**:

```yaml
redis:
  image: redis:7-alpine
  container_name: chat-redis
  ports:
    - '6379:6379'
  command: redis-server --appendonly yes
  volumes:
    - redis_data:/data
```

### RabbitMQ Configuration

**Environment Variables**:

```bash
AMQP_URL=amqp://admin:admin@rabbitmq:5672
```

**Docker Compose**:

```yaml
rabbitmq:
  image: rabbitmq:3-management
  container_name: chat-rabbitmq
  ports:
    - '5672:5672'
    - '15672:15672' # Management UI
  environment:
    RABBITMQ_DEFAULT_USER: admin
    RABBITMQ_DEFAULT_PASS: admin
```

---

## Data Flow Comparison

### Redis Data Flow (Rate Limiting)

```
Request → API Gateway → Check Redis → Allow/Deny → Response
         (Read/Write)    (Fast lookup)
```

### RabbitMQ Data Flow (Events)

```
Event → Producer → RabbitMQ Exchange → Queue → Consumer → Action
        (Publish)    (Route)           (Store)   (Process)
```

---

## Performance Characteristics

### Redis

- **Latency**: Sub-millisecond (in-memory)
- **Throughput**: 100,000+ ops/second
- **Use Case**: Real-time rate limiting, fast lookups
- **Scaling**: Redis Cluster for horizontal scaling

### RabbitMQ

- **Latency**: Milliseconds (network + disk I/O)
- **Throughput**: 10,000-50,000 messages/second
- **Use Case**: Asynchronous messaging, event streaming
- **Scaling**: RabbitMQ Cluster for high availability

---

## Future Use Cases

### Redis (Potential)

- ✅ **Rate Limiting** (Implemented)
- ⬜ **User Profile Caching** (5-minute TTL)
- ⬜ **Chat Metadata Caching**
- ⬜ **User Presence** (online/offline status)
- ⬜ **Session Storage**
- ⬜ **Distributed Locks**

### RabbitMQ (Current + Potential)

- ✅ **Event Publishing** (Implemented)
- ✅ **Event Consumption** (Implemented)
- ⬜ **Dead Letter Queues** (Error handling)
- ⬜ **Message Retry Logic**
- ⬜ **Priority Queues**
- ⬜ **Delayed Messages**

---

## Migration to Kafka (If Needed)

If you want to migrate from RabbitMQ to Kafka, you would need to:

1. **Replace AMQP client** with Kafka client
2. **Change messaging patterns**:
   - RabbitMQ: Queues, Exchanges, Routing Keys
   - Kafka: Topics, Partitions, Consumer Groups
3. **Update code**:
   - `backend/services/chat-service/src/events.js`
   - `backend/services/notification-service/...`
4. **Update docker-compose.yml**: Replace RabbitMQ with Kafka
5. **Consider differences**:
   - Kafka: Better for high-throughput event streaming
   - RabbitMQ: Better for request/response and complex routing

**Note**: Redis usage would remain unchanged - it's completely independent.

---

## Summary

✅ **Redis and RabbitMQ do NOT conflict** - they serve different purposes:

- **Redis**: Fast, in-memory data store for rate limiting (and future caching)
- **RabbitMQ**: Message broker for asynchronous event communication

✅ **Current Usage**:

- **Redis**: Rate limiting in API Gateway
- **RabbitMQ**: Event-driven communication between services

✅ **They complement each other**:

- Redis handles fast, real-time operations
- RabbitMQ handles reliable, asynchronous messaging

✅ **No conflicts** - Different ports, different protocols, different use cases.
