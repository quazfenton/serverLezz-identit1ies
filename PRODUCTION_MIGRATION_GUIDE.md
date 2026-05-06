# Production Migration Guide - Coordination Cosmos

## Overview

This document provides a comprehensive guide to the production-ready improvements made to the Coordination Cosmos platform.

## Completed Improvements

### Phase 1: Security Critical Fixes ✅

#### 1. JWT Authentication System
**File:** `backend/middleware/auth.ts`

**Features:**
- Cryptographically secure token generation using `crypto.randomBytes()`
- JWT access tokens with configurable expiration
- Refresh token mechanism for session continuity
- Secure session management with automatic cleanup
- Password hashing with bcrypt (12 salt rounds)

**Usage:**
```typescript
import { generateAuthToken, authenticateToken } from './middleware/auth';

// Generate token
const token = generateAuthToken(profileId, sessionId);

// Protect routes
app.get('/api/profile/current', authenticateToken, async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  // auth.profileId, auth.sessionId available
});
```

#### 2. Input Sanitization
**File:** `backend/middleware/auth.ts`

**Features:**
- XSS prevention with `sanitize-html`
- Prototype pollution prevention
- Null byte injection prevention
- Recursive sanitization for nested objects

**Usage:**
```typescript
import { sanitizeAll, sanitizeInput } from './middleware/auth';

// Middleware for all POST/PUT/PATCH
app.use(sanitizeAll);

// Or manual sanitization
const clean = sanitizeInput(userInput);
```

#### 3. Rate Limiting
**File:** `backend/middleware/auth.ts`

**Configuration:**
- General API: 100 requests per 15 minutes
- Auth endpoints: 5 attempts per 15 minutes
- Creation endpoints: 10 per hour

**Usage:**
```typescript
import { apiLimiter, authLimiter, createLimiter } from './middleware/auth';

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/profiles', createLimiter);
```

#### 4. Log Sanitization
**File:** `backend/middleware/auth.ts`

**Features:**
- API key redaction (OpenAI, Anthropic, Google)
- JWT token redaction
- Email redaction
- Password/secret redaction

**Usage:**
```typescript
import { sanitizeLogInput, sanitizeObjectForLogging } from './middleware/auth';

logger.info(`Processing: ${sanitizeLogInput(input)}`);
logger.info(sanitizeObjectForLogging(sensitiveData));
```

### Phase 2: Core Architecture ✅

#### 1. Service Layer
**Files:** `backend/services/ProfileService.ts`, `backend/services/ListingService.ts`

**Features:**
- Business logic separation from routes
- Comprehensive input validation
- Optimistic locking for concurrent updates
- Pagination support
- Geographic filtering
- Tag-based filtering
- Search functionality

**Usage:**
```typescript
import { createProfileService } from './services/ProfileService';

const profileService = createProfileService(profilesRepo);

// Create profile
const profile = await profileService.createProfile({
  name: 'John Doe',
  location: { latitude: 37.7749, longitude: -122.4194 },
}, requestId);

// Update with optimistic locking
const updated = await profileService.updateProfile(
  profileId,
  { name: 'Jane Doe' },
  expectedVersion, // For optimistic locking
  requestId
);

// Get with pagination
const result = await profileService.getProfiles({
  limit: 20,
  offset: 0,
  isActive: true,
}, requestId);
```

#### 2. Error Handling Hierarchy
**File:** `backend/middleware/errors.ts`

**Error Classes:**
- `AppError` - Base error
- `BadRequestError` (400)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `NotFoundError` (404)
- `ConflictError` (409)
- `ValidationError` (400)
- `DatabaseError` (500)
- `ProfileNotFoundError`, `ListingNotFoundError`, etc.

**Usage:**
```typescript
import { ProfileNotFoundError, asyncHandler } from './middleware/errors';

app.get('/api/profiles/:id', asyncHandler(async (req, res) => {
  const profile = await profileService.getProfileById(req.params.id);
  // If not found, throws ProfileNotFoundError automatically
  res.json(profile);
}));
```

### Phase 3: Database Improvements ✅

#### 1. Schema Enhancements
**File:** `prisma/schema.prisma`

**Improvements:**
- Added indexes on frequently queried fields
- Cascade deletes for referential integrity
- Version field for optimistic locking
- Email unique constraint
- Session management table enhancements

**Indexes Added:**
- `Profile`: name, email, isActive, latitude, longitude
- `Listing`: title, type, status, providerId, createdAt
- `Connection`: fromId, toId, status
- `Session`: profileId, expiresAt, token
- `SystemMetrics`: timestamp

#### 2. Optimistic Locking
**Implementation:**
```typescript
// Profile update with version check
async updateProfile(
  profileId: string,
  input: UpdateProfileInput,
  expectedVersion?: number, // Optional version check
  requestId?: string
): Promise<Profile> {
  const profile = await this.getProfileById(profileId, requestId);
  
  if (expectedVersion !== undefined && profile.version !== expectedVersion) {
    throw new ValidationError(
      "Profile was modified by another user",
      { currentVersion: profile.version, expectedVersion },
      requestId
    );
  }
  
  // ... update logic
  profile.version = (profile.version || 0) + 1;
}
```

### Phase 4: Health Checks & Monitoring ✅

#### 1. Health Check System
**File:** `backend/middleware/health.ts`

**Endpoints:**
- `GET /health` - Basic health check (for load balancers)
- `GET /health/detailed` - Detailed health with all checks
- `GET /ready` - Readiness probe
- `GET /live` - Liveness probe
- `GET /metrics` - Application metrics

**Health Checks:**
- Memory usage monitoring
- Event loop latency
- Database connectivity
- External API configuration

**Usage:**
```typescript
import { createMonitoringSystem } from './middleware/health';

const { healthCheckManager, metricsCollector, createHealthCheckHandlers } = createMonitoringSystem();

// Register database health check
healthCheckManager.registerCheck('database', async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { name: 'database', status: 'healthy' as const };
});

// Add routes
const handlers = createHealthCheckHandlers();
app.get('/health', handlers.healthHandler);
app.get('/health/detailed', handlers.healthDetailedHandler);
app.get('/metrics', handlers.metricsHandler);
```

#### 2. Metrics Collection
**Collected Metrics:**
- Memory usage (RSS, heap, external)
- Request counts and rates
- Response times
- WebSocket connections
- Error rates
- Business metrics (users, listings, coordinations)

### Phase 5: Environment Configuration ✅

#### 1. Environment Variables
**File:** `.env.example`

**Required in Production:**
```bash
# JWT Secrets (generate with: openssl rand -hex 32)
JWT_SECRET="min-32-character-secret-key"
REFRESH_TOKEN_SECRET="another-32-char-secret"

# Database
DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# Server
NODE_ENV=production
PORT=3003
ALLOWED_ORIGINS=https://yourdomain.com
```

### Phase 6: TypeScript Strict Mode ✅

**File:** `tsconfig.json`

**Enabled:**
- `strict: true`
- `strictNullChecks: true`
- `noImplicitAny: true`
- `noImplicitReturns: true`
- `noUncheckedIndexedAccess: true`

## Remaining Work

### High Priority (P1)

1. **Refactor server.ts** - Split into modular routes using new services
2. **Real LLM Integration** - Replace mock implementations
3. **WebSocket Improvements** - Fix memory leaks, add heartbeat
4. **Caching Layer** - Add Redis for sessions and query caching

### Medium Priority (P2)

1. **API Documentation** - OpenAPI/Swagger spec
2. **CI/CD Pipeline** - Automated testing and deployment
3. **Docker Optimization** - Multi-stage builds, security hardening
4. **Backup Strategy** - Automated database backups

## Migration Steps

### 1. Install Dependencies
```bash
npm install
npx prisma generate
npx prisma migrate dev
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your secrets
```

### 3. Update Routes to Use Services

**Before:**
```typescript
app.post('/api/profiles', async (req, res) => {
  const profile = { /* ... */ };
  await profilesRepo.save(profile);
  res.json(profile);
});
```

**After:**
```typescript
import { ProfileService } from '../services/ProfileService';
import { asyncHandler } from '../middleware/errors';

const profileService = new ProfileService(profilesRepo);

app.post('/api/profiles', 
  authenticateToken,
  validateSchema(ProfileSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const profile = await profileService.createProfile(
      req.body,
      (req as any).requestId
    );
    res.status(201).json(profile);
  })
);
```

### 4. Add Health Check Routes
```typescript
import { createMonitoringSystem } from './middleware/health';

const monitoring = createMonitoringSystem();
const handlers = monitoring.createHealthCheckHandlers();

app.get('/health', handlers.healthHandler);
app.get('/health/detailed', handlers.healthDetailedHandler);
app.get('/metrics', handlers.metricsHandler);
```

## Testing

### Run Tests
```bash
npm test
npm run test:coverage
```

### Type Check
```bash
npm run type-check
```

### Development
```bash
npm run dev
```

## Security Checklist

- [ ] Changed JWT secrets from defaults
- [ ] Configured CORS for production domain
- [ ] Enabled HTTPS in production
- [ ] Set up rate limiting
- [ ] Configured logging with sanitization
- [ ] Enabled helmet security headers
- [ ] Set up database backups
- [ ] Configured monitoring and alerting

## Performance Recommendations

1. **Enable Redis** for session storage and caching
2. **Use PostgreSQL** instead of SQLite for production
3. **Add CDN** for static assets
4. **Enable gzip/brotli** compression
5. **Implement connection pooling** for database
6. **Add horizontal scaling** with load balancer

## Monitoring Setup

### Prometheus Metrics
```prometheus
# Add to prometheus.yml
scrape_configs:
  - job_name: 'coordination-cosmos'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/metrics'
```

### Grafana Dashboard
Import dashboard from `monitoring/grafana-dashboard.json` (to be created)

## Support

For issues or questions:
1. Check existing GitHub issues
2. Review documentation in `/docs`
3. Contact development team

---

**Last Updated:** March 5, 2026  
**Version:** 2.0.0 (Production Ready)
