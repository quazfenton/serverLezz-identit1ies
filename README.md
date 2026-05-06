# Coordination Cosmos - Production Platform

> **A revolutionary AI-powered coordination system for optimizing human collaboration, resource allocation, and community building.**

[![Production Ready](https://img.shields.io/badge/status-production--ready-success)](https://github.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ and npm
- Docker & Docker Compose (for containerized deployment)
- PostgreSQL 15+ (or use Docker)
- Redis 7+ (optional, for caching)

### Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd coordination-cosmos

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env and set your secrets
# Required: JWT_SECRET, REFRESH_TOKEN_SECRET

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Docker Deployment

```bash
# Start all services (PostgreSQL, Redis, Backend)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [API Documentation](#api-documentation)
- [Configuration](#configuration)
- [Security](#security)
- [Testing](#testing)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Contributing](#contributing)

## ✨ Features

### 🔐 Security

- **JWT Authentication** - Secure token-based auth with refresh tokens
- **Input Sanitization** - XSS and injection attack prevention
- **Rate Limiting** - Configurable rate limits per endpoint type
- **Password Hashing** - bcrypt with 12 salt rounds
- **CORS Protection** - Configurable allowed origins
- **Helmet Security** - HTTP security headers
- **Log Sanitization** - Automatic redaction of sensitive data

### 🏗️ Architecture

- **Service Layer** - Clean separation of business logic
- **Repository Pattern** - Abstracted data access
- **Error Handling** - Hierarchical error classes
- **Optimistic Locking** - Concurrent update prevention
- **Transaction Support** - Atomic database operations
- **Health Checks** - Comprehensive system monitoring

### 📡 Real-time

- **WebSocket Support** - Bi-directional communication
- **Heartbeat Mechanism** - Automatic connection health monitoring
- **Rate Limiting** - Per-IP message rate limiting
- **Automatic Cleanup** - Idle connection management

### 🤖 AI Integration

- **Multi-Provider LLM** - OpenAI, Anthropic, Google AI support
- **Automatic Retry** - Exponential backoff with jitter
- **Fallback Logic** - Graceful degradation
- **Quality Assessment** - Response quality metrics

### 📊 Monitoring

- **Health Endpoints** - `/health`, `/health/detailed`, `/ready`, `/live`
- **Metrics Collection** - Request rates, response times, errors
- **System Metrics** - Memory, CPU, event loop latency
- **Business Metrics** - Users, listings, coordinations

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Web App   │  │  Mobile App │  │   CLI/API   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       API Gateway                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Authentication • Rate Limiting • Validation        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Routes    │  │  Services   │  │  WebSocket  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       Data Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  PostgreSQL │  │    Redis    │  │   Prisma    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## 📖 API Documentation

### Base URL

```
Development: http://localhost:3003
Production:  https://api.yourdomain.com
```

### Authentication

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123",
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194
  }
}

Response: 201 Created
{
  "success": true,
  "profile": { ... },
  "sessionId": "...",
  "authToken": "...",
  "refreshToken": "..."
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepassword123"
}

Response: 200 OK
{
  "success": true,
  "profile": { ... },
  "sessionId": "...",
  "authToken": "...",
  "refreshToken": "..."
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "..."
}

Response: 200 OK
{
  "success": true,
  "authToken": "...",
  "refreshToken": "..."
}
```

### Profiles

#### Get Current Profile
```http
GET /api/profiles/current
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "profile": { ... }
}
```

#### Update Profile
```http
PUT /api/profiles/:id
Authorization: Bearer <token>
If-Version: 1

{
  "name": "Jane Doe",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  }
}

Response: 200 OK
{
  "success": true,
  "profile": { ... },
  "version": 2
}
```

### Listings

#### Get Listings
```http
GET /api/listings?limit=20&offset=0&type=service&nearLat=37.7749&nearLon=-122.4194&radiusKm=50

Response: 200 OK
{
  "success": true,
  "listings": [...],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

#### Create Listing
```http
POST /api/listings
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Web Development Services",
  "description": "Full-stack web development...",
  "type": "service",
  "tags": ["javascript", "react", "nodejs"],
  "pricing": {
    "basePrice": 75,
    "currency": "USD",
    "pricingType": "hourly"
  }
}

Response: 201 Created
{
  "success": true,
  "listing": { ... }
}
```

### System

#### Health Check
```http
GET /api/system/health

Response: 200 OK
{
  "status": "healthy",
  "timestamp": "2026-03-05T12:00:00.000Z"
}
```

#### Detailed Health
```http
GET /api/system/health/detailed

Response: 200 OK
{
  "status": "healthy",
  "timestamp": "...",
  "uptime": 86400,
  "version": "2.0.0",
  "checks": [
    {
      "name": "memory",
      "status": "healthy",
      "message": "Memory usage normal",
      "details": { "heapUtilization": 0.45 }
    },
    {
      "name": "database",
      "status": "healthy",
      "message": "Database connected",
      "latency": 5
    }
  ]
}
```

#### Metrics
```http
GET /api/system/metrics

Response: 200 OK
{
  "system": {
    "memory": { "rss": ..., "heapUsed": ... },
    "cpu": { "usage": ... },
    "eventLoop": { "latency": ... }
  },
  "application": {
    "requests": { "total": ..., "rate": ... },
    "websocket": { "connections": ... },
    "errors": { "total": ..., "rate": ... }
  },
  "business": {
    "users": { "total": ..., "active": ... },
    "listings": { "total": ..., "active": ... }
  }
}
```

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment |
| `PORT` | No | `3003` | HTTP port |
| `WS_PORT` | No | `8080` | WebSocket port |
| `JWT_SECRET` | **Yes** | - | JWT signing secret |
| `REFRESH_TOKEN_SECRET` | **Yes** | - | Refresh token secret |
| `DATABASE_URL` | No | `file:./dev.db` | Database connection |
| `REDIS_HOST` | No | `localhost` | Redis host |
| `REDIS_PORT` | No | `6379` | Redis port |
| `OPENAI_API_KEY` | No | - | OpenAI API key |
| `ANTHROPIC_API_KEY` | No | - | Anthropic API key |
| `ALLOWED_ORIGINS` | No | `http://localhost:5173` | CORS origins |

See `.env.example` for full configuration.

## 🔒 Security

### Best Practices Implemented

1. **Authentication**
   - JWT tokens with expiration
   - Refresh token rotation
   - Secure password hashing (bcrypt, 12 rounds)
   - Rate limiting on auth endpoints

2. **Input Validation**
   - Zod schemas for all inputs
   - HTML sanitization
   - Prototype pollution prevention
   - SQL injection prevention

3. **Data Protection**
   - Password hashes never returned
   - Sensitive data redacted in logs
   - CORS configuration
   - Helmet security headers

4. **Infrastructure**
   - Non-root Docker user
   - Health checks
   - Graceful shutdown
   - Connection limits

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- ProfileService.test.ts

# Type check
npm run type-check
```

### Test Coverage Thresholds

- Statements: 50%
- Branches: 50%
- Functions: 50%
- Lines: 50%

## 🚀 Deployment

### Production Checklist

- [ ] Set strong JWT secrets
- [ ] Configure database (PostgreSQL)
- [ ] Set up Redis for caching
- [ ] Configure CORS for production domain
- [ ] Enable HTTPS
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure log aggregation
- [ ] Set up backups
- [ ] Test health checks
- [ ] Load test the system

### Docker Production

```bash
# Build production image
docker build --target production -t coordination-cosmos:latest .

# Run with docker-compose
docker-compose -f docker-compose.yml up -d

# With monitoring
docker-compose -f docker-compose.yml --profile monitoring up -d
```

### Environment-Specific Builds

```bash
# Development
docker-compose up -d development

# Production
docker-compose up -d production

# With frontend
docker-compose --profile with-frontend up -d
```

## 📊 Monitoring

### Health Endpoints

| Endpoint | Purpose | Use Case |
|----------|---------|----------|
| `/health` | Basic status | Load balancer |
| `/health/detailed` | Full system check | Monitoring systems |
| `/ready` | Readiness probe | Kubernetes |
| `/live` | Liveness probe | Kubernetes |
| `/metrics` | Prometheus metrics | Prometheus |

### Key Metrics

- **Request rate** - Requests per second
- **Response time** - Average latency
- **Error rate** - Errors per second
- **WebSocket connections** - Active connections
- **Memory usage** - Heap utilization
- **Event loop latency** - Node.js responsiveness

### Grafana Dashboard

Import the provided Grafana dashboard from `monitoring/grafana/`:

```bash
docker-compose --profile monitoring up -d grafana
# Access at http://localhost:3000
# Default credentials: admin/admin
```

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- TypeScript strict mode enabled
- ESLint for code quality
- Prettier for formatting
- Comprehensive error handling
- Input validation on all endpoints

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Express.js team
- Prisma team
- TypeScript team
- All open-source contributors

---

**Built with ❤️ for the future of human coordination**

For support, questions, or collaboration opportunities, please open an issue or contact the development team.
