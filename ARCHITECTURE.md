# Architecture Overview

This document provides a detailed overview of the chat platform architecture, following the design principles outlined in the README.

## Transport-Agnostic Design

### Frontend Real-Time Layer

The frontend uses a **transport-agnostic abstraction** (`RealtimeClient`) that allows swapping the underlying transport mechanism without changing business logic.

**Current Implementation**: WebSocket (`WebSocketTransport`)
**Future Options**:
- Server-Sent Events (SSE)
- WebTransport
- gRPC-Web
- Mobile push notifications + sync

### Key Components

1. **Transport Interface** (`RealtimeClient.ts`)
   - Defines contract for any transport implementation
   - Handles connection, disconnection, message sending/receiving

2. **WebSocket Transport** (`WebSocketTransport`)
   - Current implementation using native WebSocket API
   - Handles reconnection logic
   - JWT-based authentication

3. **Realtime Client** (`RealtimeClient`)
   - High-level abstraction over transport
   - Event subscription/publishing model
   - Completely decoupled from WebSocket specifics

## Backend Architecture

### Service Communication

All services communicate via **events** through RabbitMQ message broker:

```
Client → API Gateway → Service → Message Broker → Other Services
```

### Event Flow Example: Sending a Message

1. Client sends message via REST API to Chat Service
2. Chat Service persists message to database
3. Chat Service publishes `message.sent` event to broker
4. Event handlers:
   - **Chat Service**: Broadcasts to online users via WebSocket
   - **Notification Service**: Sends push notifications to offline users
   - **User Service**: Updates user activity (optional)

### Stateless Services

All services are stateless:
- No session storage in services
- JWT tokens contain all necessary auth info
- WebSocket connections are not bound to specific server instances
- Horizontal scaling is straightforward

### Database Design

**Shared Database** (PostgreSQL):
- `users` - User accounts and presence
- `chats` - Chat/channel metadata
- `chat_members` - Chat membership and roles
- `messages` - All messages
- `stories` - User stories with expiry

**Partitioning Strategy** (for scale):
- Messages: Partition by `chat_id`
- Users: Partition by `user_id`
- Enables efficient querying and horizontal scaling

## Service Responsibilities

### Node.js Services

**Chat Service** (Port 3001)
- Message CRUD operations
- WebSocket connection management
- Real-time message broadcasting
- Chat/channel management

**Media Service** (Port 3002)
- Pre-signed URL generation for S3
- Media metadata handling
- Direct client-to-S3 upload flow

**Story Service** (Port 3003)
- Story creation and retrieval
- Automatic expiry (24 hours)
- Cron-based cleanup

### Spring Boot Services

**Auth Service** (Port 8081)
- User registration
- User login
- JWT token generation
- Password hashing

**User Service** (Port 8082)
- User profile management
- Status updates (online/offline)
- Last seen tracking

**Notification Service** (Port 8083)
- Consumes events from message broker
- Sends push notifications
- Handles offline user notifications

### API Gateway (Port 8080)

- Routes requests to appropriate services
- Single entry point for all API calls
- WebSocket proxying (future enhancement)
- Load balancing (when multiple instances)

## Scaling Strategy

### Horizontal Scaling

1. **Stateless Services**: Any service can be scaled horizontally
2. **Load Balancer**: Distributes traffic across instances
3. **Message Broker**: Absorbs spikes and decouples services
4. **Database**: Read replicas for read-heavy operations

### Partitioning

- **Messages**: By `chat_id` for efficient querying
- **Users**: By `user_id` for user-specific queries
- Enables sharding when database becomes bottleneck

### Resilience

- **Retry Queues**: Failed events are retried
- **Graceful Degradation**: Services continue operating if non-critical services fail
- **Circuit Breakers**: Prevent cascade failures

## Security

- **JWT Authentication**: All API calls and WebSocket connections
- **Role-Based Access**: Channel admins vs members
- **Rate Limiting**: Per-user rate limits (to be implemented)
- **Short-Lived Media URLs**: Pre-signed URLs expire after 1 hour
- **Audit Logs**: Track sensitive actions (to be implemented)

## Future Enhancements

The architecture supports easy addition of:
- Message reactions
- Threads/replies
- Mentions (@user)
- Full-text search
- End-to-end encryption
- AI-powered features

All can be added as new services or event handlers without major architectural changes.

