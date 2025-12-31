# Technical Documentation

This document provides in-depth technical details about the chat platform implementation.

## Database Migrations

### Spring Boot Services (Flyway)

**Auth Service** and **User Service** use Flyway for database migrations.

- **Location**: `src/main/resources/db/migration/`
- **Naming**: `V{version}__{description}.sql`
- **History Table**: Separate tables per service (`flyway_schema_history_auth`, `flyway_schema_history_user`)
- **Configuration**: See `application.properties`

**Migration Files**:
- `V1__create_users_table.sql` - Initial users table schema

Migrations run automatically on service startup. Flyway validates and applies pending migrations.

### Node.js Services (Custom Migration System)

**Chat Service** and **Story Service** use a custom migration runner.

- **Location**: `migrations/` directory
- **Naming**: `{number}_{description}.js`
- **History Table**: `pgmigrations` (shared)
- **Execution**: Runs on service startup via `db.js`

**Migration Files**:
- `001_initial_schema.js` - Initial schema creation
- `002_add_blocked_column.js` - Blocked column addition (chat-service only)

**Migration Runner**:
- Checks for existing tables before creation (backward compatible)
- Tracks executed migrations in `pgmigrations` table
- Falls back to schema initialization if migrations fail

## Real-Time Messaging Flow

### Message Sending Flow

```
1. Client → POST /api/chats/:chatId/messages
2. API Gateway → Validates JWT
3. Chat Service → Persists message to database
4. Chat Service → Publishes MESSAGE_SENT event to RabbitMQ
5. Chat Service → Broadcasts to connected WebSocket clients
6. Notification Service → Sends push to offline users
```

### Message Receiving Flow

```
1. WebSocket receives MESSAGE_SENT event
2. RealtimeProvider → Calls addMessage() in store
3. Store → Deduplicates by message ID
4. UI → Updates chat window
```

### Deduplication Logic

Messages are deduplicated in `useChatStore.ts`:
- Checks if message ID already exists before adding
- Prevents duplicate messages from API response + WebSocket event
- Sender's own messages come from API response only

## Event-Driven Architecture

### Event Types

| Event | Publisher | Consumers | Purpose |
|-------|-----------|-----------|---------|
| `MESSAGE_SENT` | Chat Service | Chat Service, Notification Service | Message delivery |
| `USER_CONNECTED` | User Service | All services | Presence update |
| `USER_DISCONNECTED` | User Service | All services | Presence update |
| `STORY_CREATED` | Story Service | Notification Service | Story notifications |
| `TYPING_INDICATOR` | Chat Service | Chat Service | Typing status |

### Event Flow

```
Service → RabbitMQ Exchange → Queue → Consumer Service
```

**Benefits**:
- Decoupled services
- Async processing
- Retry capability
- Scalability

## Database Schema

### Tables

**users** (Auth & User Services)
```sql
- id VARCHAR(255) PRIMARY KEY
- name VARCHAR(255) NOT NULL
- phone VARCHAR(255) NOT NULL UNIQUE
- email VARCHAR(255) UNIQUE
- password VARCHAR(255) NOT NULL (auth-service only)
- status VARCHAR(50)
- last_seen TIMESTAMP
```

**chats**
```sql
- id VARCHAR(255) PRIMARY KEY
- type VARCHAR(50) NOT NULL (personal/channel)
- name VARCHAR(255)
- created_at TIMESTAMP
```

**chat_members**
```sql
- chat_id VARCHAR(255) NOT NULL
- user_id VARCHAR(255) NOT NULL
- role VARCHAR(50) DEFAULT 'member'
- blocked BOOLEAN DEFAULT FALSE
- PRIMARY KEY (chat_id, user_id)
```

**messages**
```sql
- id VARCHAR(255) PRIMARY KEY
- chat_id VARCHAR(255) NOT NULL
- sender_id VARCHAR(255) NOT NULL
- type VARCHAR(50) NOT NULL
- content TEXT NOT NULL
- media_url VARCHAR(500)
- created_at TIMESTAMP
```

**stories**
```sql
- id VARCHAR(255) PRIMARY KEY
- user_id VARCHAR(255) NOT NULL
- media_url VARCHAR(500) NOT NULL
- expires_at TIMESTAMP NOT NULL
- created_at TIMESTAMP
```

### Indexes

- `idx_users_phone` - Fast phone lookups
- `idx_messages_chat_id` - Chat message queries
- `idx_messages_created_at` - Message ordering
- `idx_stories_expires_at` - Story cleanup

## Authentication & Authorization

### JWT Structure

```json
{
  "userId": "user-id",
  "sub": "user-id",
  "iat": 1234567890,
  "exp": 1234654290
}
```

### Token Flow

1. **Login**: Auth Service validates credentials → Returns JWT
2. **API Requests**: Client sends `Authorization: Bearer <token>`
3. **WebSocket**: Token in query string `?token=<jwt>`
4. **Validation**: Each service validates JWT independently

### Security Features

- **Password Hashing**: BCrypt with salt rounds
- **Token Expiration**: Configurable (default 24 hours)
- **Token Validation**: On every request
- **CORS**: Configured per service

## WebSocket Implementation

### Connection Flow

```
1. Client → ws://host:3001/ws?token=<jwt>
2. Server → Validates JWT
3. Server → Upgrades HTTP to WebSocket
4. Server → Stores connection in memory
5. Server → Sends USER_CONNECTED event
```

### Message Broadcasting

```javascript
// When message is sent
1. Persist to database
2. Publish to RabbitMQ
3. Broadcast to all connected clients in chat
4. Filter by chat_id and user_id
```

### Reconnection Logic

- Automatic reconnection on disconnect
- Token refresh on reconnection
- State synchronization on reconnect

## State Management

### Frontend Store (Zustand)

**useAuthStore**:
- `user` - Current user
- `token` - JWT token
- `login()` - Authentication
- `logout()` - Cleanup

**useChatStore**:
- `chats` - List of chats
- `messages` - Messages by chat ID
- `activeChat` - Currently selected chat
- `addMessage()` - Add message (with deduplication)
- `loadChats()` - Fetch chats from API

### Real-Time Updates

**RealtimeProvider**:
- Manages WebSocket connection
- Subscribes to events
- Updates Zustand stores
- Handles reconnection

## API Endpoints

### Authentication

- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login

### Users

- `GET /api/users/me` - Current user profile
- `PATCH /api/users/me` - Update profile
- `GET /api/users/search?q=...` - Search users
- `POST /api/users/status` - Update status

### Chats

- `GET /api/chats` - List user's chats
- `GET /api/chats/:chatId` - Get chat details
- `POST /api/chats` - Create chat
- `POST /api/chats/:chatId/messages` - Send message
- `GET /api/chats/:chatId/messages` - Get messages
- `POST /api/users/:userId/messages` - Send message to user (auto-create chat)
- `POST /api/chats/:chatId/block` - Block user in chat
- `POST /api/chats/:chatId/unblock` - Unblock user in chat

### Stories

- `GET /api/stories` - Get active stories
- `POST /api/stories` - Create story

## Error Handling

### Backend

- **Spring Boot**: Global exception handlers
- **Node.js**: Try-catch with proper error responses
- **HTTP Status Codes**: 400 (Bad Request), 401 (Unauthorized), 500 (Server Error)

### Frontend

- **API Errors**: Displayed in UI
- **WebSocket Errors**: Automatic reconnection
- **Network Errors**: Retry logic

## Performance Optimizations

### Database

- **Indexes**: On frequently queried columns
- **Connection Pooling**: HikariCP (Spring Boot), pg.Pool (Node.js)
- **Query Optimization**: Parameterized queries

### Frontend

- **Message Deduplication**: Prevents duplicate renders
- **Debouncing**: Load chats on message events
- **Lazy Loading**: Components loaded on demand

### Backend

- **Stateless Services**: No session storage
- **Event-Driven**: Async processing
- **Connection Pooling**: Database connections

## Monitoring & Logging

### Logging

- **Backend**: Console logging (structured in production)
- **Frontend**: Console logging (disabled in production)
- **Docker**: Logs via `docker compose logs`

### Health Checks

- `GET /health` - Service health endpoint
- Docker health checks configured
- Service dependencies tracked

## Deployment

### Docker Compose

All services containerized:
- Multi-stage builds for Spring Boot
- Alpine images for Node.js
- Health checks configured
- Service dependencies managed

### Environment Variables

Key variables:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`, `JWT_EXPIRATION`
- `RABBITMQ_URL`
- `AWS_*` (for S3 media storage)

## Testing

### Unit Tests

- [To be implemented]

### Integration Tests

- [To be implemented]

### E2E Tests

- [To be implemented]

## Troubleshooting

### Common Issues

**Services not starting**:
- Check database connection
- Verify RabbitMQ is running
- Check service logs: `docker compose logs <service>`

**Migrations failing**:
- Check database permissions
- Verify migration files are correct
- Check Flyway/pgmigrations tables

**WebSocket connection issues**:
- Verify JWT token is valid
- Check CORS configuration
- Verify WebSocket endpoint URL

## Future Technical Enhancements

- Database sharding
- Redis caching layer
- CDN for media files
- GraphQL API
- gRPC for inter-service communication
- Kubernetes deployment configs


