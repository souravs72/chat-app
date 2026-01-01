# Chat Platform

A modern, scalable real-time messaging platform built for millions of users. Web-first architecture with seamless mobile transition path.

## 🚀 Quick Start

```bash
# Start all services with Docker Compose
docker compose up -d

# Access the application
Frontend: http://localhost:3000
API Gateway: http://localhost:8080
RabbitMQ Management: http://localhost:15672 (admin/admin)
```

See [INSTALLATION.md](./INSTALLATION.md) for detailed setup instructions.

## ✨ Features

### Core Functionality

- **Real-time messaging** - One-to-one and group chats
- **User management** - Signup, login, presence, last seen
- **Media sharing** - Images, videos, audio, documents
- **Stories** - 24-hour expiring content
- **Typing indicators** - Real-time typing status
- **Read receipts** - Message delivery and read status

### Advanced Features

- **Messages from non-contacts** - Receive messages from any user with block option
- **Profile management** - Update name and email
- **Online/offline presence** - Real-time status updates
- **Multi-device support** - Login from multiple devices

## 🏗️ Architecture

### High-Level Overview

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
┌──────▼──────────┐
│  API Gateway   │
└──────┬──────────┘
       │
   ┌───┴───┬──────────┬──────────┬──────────┐
   │       │          │          │          │
┌──▼──┐ ┌─▼──┐  ┌────▼───┐  ┌───▼──┐  ┌───▼──┐
│Auth │ │User│  │  Chat  │  │Media │  │Story │
└─────┘ └────┘  └────────┘  └──────┘  └──────┘
```

### Technology Stack

- **Frontend**: React + TypeScript + Zustand
- **Backend**: Node.js + Spring Boot (hybrid)
- **Database**: PostgreSQL
- **Message Broker**: RabbitMQ
- **Real-time**: WebSocket (transport-agnostic)

### Services

| Service              | Technology  | Port | Purpose            |
| -------------------- | ----------- | ---- | ------------------ |
| API Gateway          | Node.js     | 8080 | Request routing    |
| Auth Service         | Spring Boot | 8081 | Authentication     |
| User Service         | Spring Boot | 8082 | User management    |
| Chat Service         | Node.js     | 3001 | Messaging          |
| Media Service        | Node.js     | 3002 | Media handling     |
| Story Service        | Node.js     | 3003 | Stories            |
| Notification Service | Spring Boot | 8083 | Push notifications |

## 📁 Project Structure

```
chat/
├── frontend/              # React frontend
│   ├── src/
│   │   ├── app/          # Routing
│   │   ├── auth/         # Login/signup
│   │   ├── chat/         # Chat UI
│   │   ├── realtime/     # Real-time layer
│   │   └── store/        # State management
│   └── package.json
│
├── backend/
│   ├── api-gateway/      # API Gateway
│   └── services/         # Microservices
│       ├── auth-service/
│       ├── user-service/
│       ├── chat-service/
│       ├── media-service/
│       ├── story-service/
│       └── notification-service/
│
└── docker-compose.yml    # Service orchestration
```

## 🛠️ Development

### Prerequisites

- Node.js 18+
- Java 17+
- Docker & Docker Compose
- PostgreSQL (or use Docker)

### Running Locally

```bash
# Start infrastructure (PostgreSQL, RabbitMQ)
docker compose up -d postgres rabbitmq

# Start services individually (see INSTALLATION.md)
# Or use Docker Compose for all services
docker compose up -d
```

### Database Migrations

- **Spring Boot services**: Flyway migrations in `src/main/resources/db/migration/`
- **Node.js services**: Custom migration system in `migrations/` directory

Migrations run automatically on service startup.

## 🔄 CI/CD

This project includes comprehensive CI/CD pipelines using GitHub Actions.

### Continuous Integration

The CI pipeline runs on every push and pull request:

- **Frontend**: Linting, type checking, and building React/TypeScript application
- **Node.js Services**: Dependency installation and syntax validation for all Node.js services
- **Java Services**: Maven tests and JAR building for Spring Boot services
- **Docker Builds**: Validates all Docker images build successfully
- **Integration Tests**: Full docker-compose validation on main/dev branches

**Features:**

- ✅ Parallel execution for faster builds
- ✅ Smart dependency caching (npm, Maven)
- ✅ Docker layer caching
- ✅ Matrix strategy for efficient testing
- ✅ Test result and build artifacts

### Code Quality

Additional checks run automatically:

- Secret scanning
- Large file detection
- YAML validation
- Dockerfile verification

### Continuous Deployment

Deployment workflow is available for:

- Version tag releases (`v*.*.*`)
- Manual deployment to staging/production

See [`.github/workflows/CD.md`](.github/workflows/CD.md) for detailed documentation.

## 📚 Documentation

- [INSTALLATION.md](./INSTALLATION.md) - Detailed installation and setup
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture overview
- [TECHNICAL.md](./TECHNICAL.md) - Technical deep-dive
- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) - Production readiness

## 🎯 Design Principles

1. **Stateless Services** - Horizontal scaling ready
2. **Event-Driven** - Decoupled service communication
3. **Transport-Agnostic** - WebSocket is replaceable
4. **Single Source of Truth** - Backend owns business logic
5. **Media Offloading** - Direct client-to-storage uploads

## 🔒 Security

- JWT-based authentication
- Role-based access control
- Password hashing (BCrypt)
- Input validation
- SQL injection prevention

## 📈 Scaling

- **Horizontal scaling** - All services are stateless
- **Database partitioning** - By chat_id and user_id
- **Message broker** - Absorbs traffic spikes
- **Read replicas** - For read-heavy operations

## 🚧 Roadmap

- Message reactions
- Threads/replies
- Mentions (@user)
- Full-text search
- End-to-end encryption
- AI-powered features

## 📝 License

[Add your license here]

## 🤝 Contributing

[Add contribution guidelines here]

---

For detailed technical information, see [TECHNICAL.md](./TECHNICAL.md) and [ARCHITECTURE.md](./ARCHITECTURE.md).
