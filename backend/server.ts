// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Production Server
// Express.js + WebSocket + AI-Enhanced Coordination Network
// ═══════════════════════════════════════════════════════════════════════════════

import express, { Application, Request, Response } from "express";
import path from "path";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import { WebSocketServer } from "ws";

// Middleware
import {
  logger,
  logSecurityEvent,
  requestLogger,
  sanitizeAll,
  apiLimiter,
  generateSecureId,
  cleanupExpiredSessions,
  authenticateToken,
} from "./middleware";
import { errorHandler, notFoundHandler, asyncHandler } from "./middleware/errors";
import { WebSocketManager } from "./middleware/WebSocketManager";
import { createMonitoringSystem, requestTimingMiddleware } from "./middleware/health";

// Routes
import authRouter from "./routes/auth";
import profilesRouter from "./routes/profiles";
import listingsRouter from "./routes/listings";
import systemRouter from "./routes/system";

// Services
import { ProfileService } from "./services/ProfileService";
import { ListingService } from "./services/ListingService";
import { createLLMClient } from "./services/LLMClient";

// Database
import { initializeDatabaseAdapters } from "./db/adapter";

// Prisma for health checks
let PrismaClient: any;
try {
  const mod = eval("require")('@prisma/client');
  PrismaClient = mod.PrismaClient;
} catch {
  PrismaClient = null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Application Setup
// ═══════════════════════════════════════════════════════════════════════════════

const app: Application = express();
const PORT = parseInt(process.env.PORT || "3003", 10);
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Create monitoring system
const monitoring = createMonitoringSystem();
const { metricsCollector } = monitoring;

// Create WebSocket manager
const wsManager = new WebSocketManager({
  heartbeatInterval: 30000,
  heartbeatTimeout: 10000,
  maxConnectionsPerIp: 10,
  rateLimitWindow: 60000,
  rateLimitMax: 30,
});

// ═══════════════════════════════════════════════════════════════════════════════
// Middleware Configuration
// ═══════════════════════════════════════════════════════════════════════════════

// Security headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://api.dicebear.com"],
        imgSrc: ["'self'", "data:", "https://api.dicebear.com"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    xssFilter: true,
  })
);

// CORS with restricted origins
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logSecurityEvent("cors_blocked", { origin });
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "If-Version"],
    exposedHeaders: ["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
    maxAge: 600,
  })
);

// Request logging with timing
app.use(requestTimingMiddleware(metricsCollector));
app.use(requestLogger);

// Body parsing with size limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Global sanitization
app.use(sanitizeAll);

// Request ID middleware
app.use((req: Request, res: Response, next) => {
  const requestId = generateSecureId("req");
  (req as any).requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
});

// Rate limiting for API endpoints
app.use("/api/", apiLimiter);

// ═══════════════════════════════════════════════════════════════════════════════
// Route Registration
// ═══════════════════════════════════════════════════════════════════════════════

// API routes (will be configured after services are initialized)
const routers = {
  auth: authRouter,
  profiles: profilesRouter,
  listings: listingsRouter,
  system: systemRouter,
};

// ═══════════════════════════════════════════════════════════════════════════════
// WebSocket Server
// ═══════════════════════════════════════════════════════════════════════════════

wss.on("connection", (ws, req) => {
  const clientId = wsManager.handleConnection(ws, req as any);

  // Handle authentication
  wsManager.on("authenticate", async ({ client, token }) => {
    try {
      // Verify token
      const auth = require("./middleware/auth").verifyAuthToken(token);
      if (auth) {
        client.profileId = auth.profileId;
        wsManager.sendTo(clientId, {
          type: "authenticated",
          profileId: auth.profileId,
        });
        logger.info("WebSocket authenticated", {
          clientId,
          profileId: auth.profileId,
        });
      } else {
        wsManager.sendTo(clientId, {
          type: "error",
          error: "Invalid token",
        });
      }
    } catch (error) {
      logger.error("WebSocket authentication error", {
        clientId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Handle resonance updates
  wsManager.on("resonance_update", ({ client, data }) => {
    logger.debug("Resonance update", {
      clientId,
      profileId: client.profileId,
      filter: data.resonanceFilter,
    });
    // Forward to application logic
  });

  // Handle interactions
  wsManager.on("interaction", ({ client, data }) => {
    logger.debug("Interaction", {
      clientId,
      profileId: client.profileId,
      type: data.interaction?.type,
    });
    // Forward to application logic
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Background Processes
// ═══════════════════════════════════════════════════════════════════════════════

function startBackgroundProcesses() {
  // Cleanup expired sessions - every 5 minutes
  setInterval(() => {
    const cleaned = cleanupExpiredSessions();
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired sessions`);
    }
  }, 5 * 60 * 1000);

  // Cleanup idle WebSocket clients - every 5 minutes
  setInterval(() => {
    wsManager.cleanupInactiveClients();
  }, 5 * 60 * 1000);

  // Broadcast system metrics - every 30 seconds
  setInterval(() => {
    try {
      wsManager.broadcast({
        type: "system_metrics",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error broadcasting metrics", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, 30000);

  logger.info("Background processes started");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Static Files & Catch-All
// ═══════════════════════════════════════════════════════════════════════════════

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("*", (req: Request, res: Response) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
  } else {
    res.status(404).json({ error: "API endpoint not found" });
  }
});

// Error handling
app.use(errorHandler);
app.use(notFoundHandler);

// ═══════════════════════════════════════════════════════════════════════════════
// Server Startup
// ═══════════════════════════════════════════════════════════════════════════════

async function startServer() {
  try {
    logger.info("🌟 Starting Coordination Cosmos...");

    // Initialize database adapters
    const adapters = await initializeDatabaseAdapters();
    const profilesRepo = adapters.profilesRepo;
    const listingsRepo = adapters.listingsRepo;
    const connectionsRepo = adapters.connectionsRepo;

    // Initialize services
    const profileService = new ProfileService(profilesRepo);
    const listingService = new ListingService(listingsRepo, profilesRepo);

    // Initialize LLM client
    const llmClient = createLLMClient({
      openai: process.env.OPENAI_API_KEY
        ? { apiKey: process.env.OPENAI_API_KEY, model: "gpt-4o-mini" }
        : undefined,
      anthropic: process.env.ANTHROPIC_API_KEY
        ? { apiKey: process.env.ANTHROPIC_API_KEY, model: "claude-sonnet-4-20250514" }
        : undefined,
      google: process.env.GOOGLE_AI_KEY
        ? { apiKey: process.env.GOOGLE_AI_KEY, model: "gemini-2.0-flash" }
        : undefined,
    });

    // Store in app.locals for route access
    (app.locals as any).profilesRepo = profilesRepo;
    (app.locals as any).listingsRepo = listingsRepo;
    (app.locals as any).connectionsRepo = connectionsRepo;
    (app.locals as any).profileService = profileService;
    (app.locals as any).listingService = listingService;
    (app.locals as any).llmClient = llmClient;
    (app.locals as any).wsManager = wsManager;

    // Set up database health check
    if (PrismaClient) {
      let prisma: any;
      try {
        prisma = new PrismaClient();
        await prisma.$connect();
        logger.info("✅ Database connected via Prisma");

        (global as any).databaseHealthCheck = async () => {
          await prisma.$queryRaw`SELECT 1`;
        };

        // Business metrics function
        (global as any).businessMetricsFn = async () => {
          try {
            const allProfiles = await profilesRepo.getAll();
            const allListings = await listingsRepo.getAll();
            return {
              users: {
                total: allProfiles.length,
                active: allProfiles.filter((p: any) => p.isActive).length,
                newToday: 0, // Would need timestamp comparison
              },
              listings: {
                total: allListings.length,
                active: allListings.filter((l: any) => l.isActive).length,
                newToday: 0,
              },
              coordination: {
                activeCoordinations: 0,
                successfulMatches: 0,
                averageMatchScore: 0,
              },
            };
          } catch {
            return {
              users: { total: 0, active: 0, newToday: 0 },
              listings: { total: 0, active: 0, newToday: 0 },
              coordination: { activeCoordinations: 0, successfulMatches: 0, averageMatchScore: 0 },
            };
          }
        };
      } catch (error) {
        logger.warn("⚠️  Prisma connection failed, using in-memory storage");
        (global as any).databaseHealthCheck = null;
      }
    }

    // Register routes with services
    app.use("/api/auth", authRouter);
    app.use("/api/profiles", profilesRouter);
    app.use("/api/listings", listingsRouter);
    app.use("/api/system", systemRouter);

    // Start background processes
    startBackgroundProcesses();

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Server running at http://localhost:${PORT}`);
      logger.info(`📡 WebSocket active at ws://localhost:${PORT}`);
      logger.info(`🧠 AI-Enhanced Coordination Network Active`);
      logger.info("💫 Ready for coordination...\n");
    });

    // Store wsManager globally for shutdown
    (global as any).wsManager = wsManager;

    // Graceful shutdown
    const shutdownTimeout = Number(process.env.SHUTDOWN_TIMEOUT) || 30000;

    async function gracefulShutdown(signal: string) {
      logger.info(`Graceful shutdown initiated (${signal})`);

      // Stop accepting new connections
      server.close(() => {
        logger.info("HTTP server closed");
      });

      // Close WebSocket connections
      wsManager.closeAll(1001, "Server shutting down");

      // Close database connections
      if (prisma) {
        await prisma.$disconnect();
      }

      // Force close after timeout
      setTimeout(() => {
        logger.error("Forced shutdown due to timeout");
        process.exit(1);
      }, shutdownTimeout);

      // Cleanup completed
      logger.info("Cleanup completed");
      process.exit(0);
    }

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  } catch (err: any) {
    logger.error("❌ Fatal startup error", {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

// Launch
startServer().catch((err) => {
  logger.error("❌ Fatal startup error", {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

export default app;
