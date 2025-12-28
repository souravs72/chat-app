# Installation Guide

## Prerequisites

- Node.js 18+ and npm
- Java 17+ and Maven
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL (optional, for production - H2 used for local dev)

## Quick Start with Docker Compose

### Option 1: Full Docker Compose (Production-like)

This starts all services in containers with PostgreSQL:

```bash
docker compose up -d
```

This will start:
- PostgreSQL on port 5432
- RabbitMQ on port 5672 (Management UI on 15672)
- All backend services
- Frontend

Access:
- Frontend: http://localhost:3000
- API Gateway: http://localhost:8080
- RabbitMQ Management: http://localhost:15672 (admin/admin)

### Option 2: Local Development

For local development with H2 database (Spring Boot services):

1. Start infrastructure only:
```bash
docker compose -f docker-compose.local.yml up -d
```

2. Start Spring Boot services locally (they'll use H2):
```bash
# Auth Service (uses H2 in dev profile)
cd backend/services/auth-service
mvn spring-boot:run

# User Service (uses H2 in dev profile)
cd backend/services/user-service
mvn spring-boot:run
```

3. Start Node.js services locally:
```bash
# API Gateway
cd backend/api-gateway
npm install && npm run dev

# Chat Service
cd backend/services/chat-service
npm install && npm run dev

# Media Service
cd backend/services/media-service
npm install && npm run dev

# Story Service
cd backend/services/story-service
npm install && npm run dev
```

4. Start Frontend:
```bash
cd frontend
npm install && npm run dev
```

## Manual Installation

### 1. Install Dependencies

#### Frontend
```bash
cd frontend
npm install
```

#### Backend Node.js Services
```bash
cd backend/api-gateway && npm install
cd ../services/chat-service && npm install
cd ../services/media-service && npm install
cd ../services/story-service && npm install
```

#### Backend Spring Boot Services
```bash
cd backend/services/auth-service
mvn clean install

cd ../user-service
mvn clean install

cd ../notification-service
mvn clean install
```

### 2. Configure Environment Variables

**For Local Development (H2 Database):**

Spring Boot services will automatically use H2 when `SPRING_PROFILES_ACTIVE=dev` (default).

**For Production (PostgreSQL):**

Set environment variables or update `application.properties`:

**Chat Service** (`backend/services/chat-service/.env`):
```
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chatdb
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-secret-key-minimum-32-characters-for-hs256-algorithm
AMQP_URL=amqp://admin:admin@localhost:5672
```

**Media Service** (`backend/services/media-service/.env`):
```
PORT=3002
JWT_SECRET=your-secret-key-minimum-32-characters-for-hs256-algorithm
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET=chat-media
S3_ENDPOINT=
S3_FORCE_PATH_STYLE=false
MEDIA_BASE_URL=https://s3.amazonaws.com
```

**Story Service** (`backend/services/story-service/.env`):
```
PORT=3003
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chatdb
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-secret-key-minimum-32-characters-for-hs256-algorithm
```

**API Gateway** (`backend/api-gateway/.env`):
```
PORT=8080
AUTH_SERVICE_URL=http://localhost:8081
USER_SERVICE_URL=http://localhost:8082
CHAT_SERVICE_URL=http://localhost:3001
MEDIA_SERVICE_URL=http://localhost:3002
STORY_SERVICE_URL=http://localhost:3003
NOTIFICATION_SERVICE_URL=http://localhost:8083
```

**Spring Boot Services** - Update `application.properties` or set environment variables:
- `SPRING_PROFILES_ACTIVE=dev` (for H2) or `prod` (for PostgreSQL)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (for PostgreSQL)
- `JWT_SECRET` (must match across all services, minimum 32 characters)

### 3. Start Services

#### Start Infrastructure
```bash
docker compose -f docker-compose.local.yml up -d
```

#### Start Services (in separate terminals)

**Terminal 1 - API Gateway:**
```bash
cd backend/api-gateway
npm run dev
```

**Terminal 2 - Chat Service:**
```bash
cd backend/services/chat-service
npm run dev
```

**Terminal 3 - Media Service:**
```bash
cd backend/services/media-service
npm run dev
```

**Terminal 4 - Story Service:**
```bash
cd backend/services/story-service
npm run dev
```

**Terminal 5 - Auth Service:**
```bash
cd backend/services/auth-service
mvn spring-boot:run
```

**Terminal 6 - User Service:**
```bash
cd backend/services/user-service
mvn spring-boot:run
```

**Terminal 7 - Notification Service:**
```bash
cd backend/services/notification-service
mvn spring-boot:run
```

**Terminal 8 - Frontend:**
```bash
cd frontend
npm run dev
```

### 4. Access the Application

- Frontend: http://localhost:3000
- API Gateway: http://localhost:8080
- RabbitMQ Management: http://localhost:15672 (admin/admin)
- H2 Console (dev mode): http://localhost:8081/h2-console (auth-service) or http://localhost:8082/h2-console (user-service)

## Database Configuration

### Development (H2 - In-Memory)

Spring Boot services use H2 by default when `SPRING_PROFILES_ACTIVE=dev`:
- No setup required
- Data is lost on restart
- H2 Console available at `/h2-console`

### Production (PostgreSQL)

1. Start PostgreSQL:
```bash
docker compose -f docker-compose.local.yml up -d postgres
```

2. Set Spring Boot profile to `prod`:
```bash
export SPRING_PROFILES_ACTIVE=prod
```

3. Configure database connection in `application.properties` or environment variables

## Troubleshooting

1. **Database connection errors**: 
   - For H2: Ensure Spring Boot profile is set to `dev`
   - For PostgreSQL: Ensure PostgreSQL is running and credentials match

2. **RabbitMQ connection errors**: 
   - Ensure RabbitMQ is running: `docker compose -f docker-compose.local.yml up -d rabbitmq`
   - Check connection URL: `amqp://admin:admin@localhost:5672`

3. **JWT validation errors**: 
   - Ensure all services use the same `JWT_SECRET`
   - Secret must be at least 32 characters for HS256 algorithm

4. **CORS errors**: 
   - Check that services allow requests from frontend origin
   - Frontend runs on port 3000 by default

5. **Port conflicts**: 
   - Check if ports are already in use
   - Modify port numbers in configuration files

6. **S3/Media service errors**:
   - Media service will work without S3 but uploads won't function
   - Configure AWS credentials for production use

## Production Deployment

For production deployment:

1. Use `docker-compose.yml` (uses PostgreSQL)
2. Set strong `JWT_SECRET` (minimum 32 characters)
3. Configure proper S3 credentials for media service
4. Use environment variables for all sensitive configuration
5. Enable HTTPS/TLS
6. Configure proper logging and monitoring
7. Set up database backups
8. Configure rate limiting and security headers
