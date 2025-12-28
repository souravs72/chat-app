# Chat Platform – Scalable Real‑Time Messaging System

## 1. Overview

This project is a **modern, scalable chat application** designed to support **millions of users** with real‑time messaging, media sharing, stories, and group communication. The platform is **web‑first**, with a clean path to mobile (React Native / Flutter) without architectural rewrites.

The system prioritizes:

- Horizontal scalability
- Event‑driven design
- Transport‑agnostic real‑time communication
- Clean separation of concerns
- Long‑term maintainability

The frontend is built with **React**, while the backend uses a **hybrid Node.js + Spring Boot architecture**, leveraging each stack where it performs best.

---

## 2. Key Features

### User Management

- Secure signup & login
- JWT‑based authentication
- Online / offline presence
- Last seen timestamps
- Multi‑device login support

### Messaging

- One‑to‑one personal chats
- Channel / group chats
- Role‑based access for channels (admin, member)
- Message types:

  - Text
  - Images
  - Videos
  - Audio recordings
  - Documents
  - Location (live & static)

### User Experience

- Pin chats
- Typing indicators
- Read receipts
- Message delivery status
- Stories (24‑hour expiry, WhatsApp‑style)

### Non‑Functional

- Millions of concurrent users
- Fault tolerance
- Horizontal scalability
- Smooth web → mobile transition

---

## 3. Design Principles

1. **Stateless Services** – Enables easy horizontal scaling
2. **Event‑Driven Architecture** – Decouples producers and consumers
3. **Transport Independence** – WebSocket is replaceable
4. **Single Source of Truth** – Backend owns all business rules
5. **Media Offloading** – Files never pass through core services

---

## 4. High‑Level Architecture

### Logical Components

- API Gateway
- Authentication Service
- User Service
- Chat Service
- Media Service
- Story Service
- Notification Service
- Message Broker

Each service is independently deployable and horizontally scalable.

---

## 5. Frontend Architecture (React)

### Goals

- Web‑first implementation
- Mobile‑ready design
- Minimal coupling with transport layer

### Structure

```
src/
 ├── app/                # App shell & routing
 ├── auth/               # Login & signup
 ├── chat/               # Chat UI components
 ├── channels/           # Group chats
 ├── stories/            # Stories UI
 ├── realtime/           # Real‑time abstraction layer
 ├── api/                # REST API clients
 ├── store/              # Global state
 └── types/              # Shared contracts
```

### Real‑Time Abstraction

The UI never directly uses WebSockets. All real‑time communication flows through a `RealtimeClient` layer.

This allows future replacement with:

- Server‑Sent Events
- WebTransport
- gRPC‑Web
- Mobile push + sync

---

## 6. Backend Architecture

### Technology Choice

| Responsibility | Technology  | Reason                |
| -------------- | ----------- | --------------------- |
| Auth & Users   | Spring Boot | Security, consistency |
| Messaging      | Node.js     | Async, high fan‑out   |
| Media          | Node.js     | Streaming uploads     |
| Notifications  | Spring Boot | Reliability & retries |

### Services

```
api-gateway
├── auth-service
├── user-service
├── chat-service
├── media-service
├── story-service
└── notification-service
```

---

## 7. Real‑Time Messaging Model

### Core Idea

WebSocket is treated as **just a transport**, not as business logic.

### Message Flow

1. Client sends message
2. Gateway validates JWT
3. Event published to message broker
4. Message processor persists message
5. Fan‑out event to recipients
6. Online users receive real‑time push
7. Offline users receive notification

This ensures:

- No sticky sessions
- No socket‑bound state
- Easy scaling

---

## 8. Event‑Driven Design

### Example Events

- USER_CONNECTED
- USER_DISCONNECTED
- MESSAGE_SENT
- MESSAGE_DELIVERED
- MESSAGE_READ
- STORY_CREATED
- STORY_EXPIRED

All services communicate **via events**, not direct calls, wherever possible.

---

## 9. Database Design (Logical)

### Users

```
User(id, name, phone, status, last_seen)
```

### Chats

```
Chat(id, type, created_at)
```

### Chat Members

```
ChatMember(chat_id, user_id, role)
```

### Messages

```
Message(
  id,
  chat_id,
  sender_id,
  type,
  content,
  media_url,
  created_at
)
```

### Stories

```
Story(id, user_id, media_url, expires_at)
```

---

## 10. Media Handling

### Upload Flow

1. Client requests upload permission
2. Media Service generates pre‑signed URL
3. Client uploads directly to object storage
4. Message stores metadata only

### Benefits

- No large payloads in core services
- Better performance
- Reduced infrastructure cost

---

## 11. Security Model

- JWT for all APIs and real‑time connections
- Role‑based channel authorization
- Rate limiting per user
- Short‑lived media URLs
- Audit logs for sensitive actions

---

## 12. Scaling Strategy

### Horizontal Scaling

- Stateless services
- Auto‑scaling enabled

### Partitioning

- Messages by chat_id
- Users by user_id

### Resilience

- Broker absorbs spikes
- Retry queues for failures
- Graceful degradation

---

## 13. Web → Mobile Transition

### What Stays the Same

- APIs
- Events
- Authentication
- Data contracts

### What Changes

- UI layer only

This ensures minimal rewrite when launching mobile apps.

---

## 14. Future Enhancements

- Message reactions
- Threads
- Mentions
- Full‑text search
- End‑to‑end encryption
- AI‑powered summaries

---

## 15. Why This Architecture Works

- WebSocket is replaceable
- Event‑driven scalability
- Clean service boundaries
- Production‑grade reliability
- Long‑term maintainability

---

## 16. Target Audience

- Engineers building scalable chat platforms
- Teams planning web‑first, mobile‑later apps
- Systems requiring high throughput messaging

---

## 17. Status

This README serves as **verbal system documentation** and a **single source of architectural truth** for implementing the platform.

---

End of document.
