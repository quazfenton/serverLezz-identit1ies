import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { AdvancedLLMOrchestrator, createAndInitializeOrchestrator } from './orchestrator';
import { LLMOrchestrationConfig } from './config';

// ==================== SERVER CONFIGURATION ====================

interface ServerConfig {
  port: number;
  host: string;
  enableWebSocket: boolean;
  enableCors: boolean;
  enableRateLimit: boolean;
  maxRequestsPerMinute: number;
  orchestratorConfig?: Partial<LLMOrchestrationConfig>;
}

const defaultServerConfig: ServerConfig = {
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '0.0.0.0',
  enableWebSocket: true,
  enableCors: true,
  enableRateLimit: true,
  maxRequestsPerMinute: 100
};

// ==================== ADVANCED LLM ORCHESTRATION SERVER ====================

export class LLMOrchestrationServer {
  private app: express.Application;
  private server: any;
  private wss?: WebSocketServer;
  private orchestrator?: AdvancedLLMOrchestrator;
  private config: ServerConfig;
  private isRunning: boolean = false;

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = { ...defaultServerConfig, ...config };
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Security
    this.app.use(helmet());

    // CORS
    if (this.config.enableCors) {
      this.app.use(cors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        credentials: true
      }));
    }

    // Rate limiting
    if (this.config.enableRateLimit) {
      const limiter = rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: this.config.maxRequestsPerMinute,
        message: {
          error: 'Too many requests',
          retryAfter: '1 minute'
        }
      });
      this.app.use('/api/', limiter);
    }

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        orchestrator: this.orchestrator ? 'initialized' : 'not initialized'
      });
    });

    // API routes
    this.setupAPIRoutes();

    // WebSocket info
    this.app.get('/ws-info', (req, res) => {
      res.json({
        websocketEnabled: this.config.enableWebSocket,
        endpoint: this.config.enableWebSocket ? `ws://${this.config.host}:${this.config.port}/ws` : null
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
      });
    });

    // Error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Server error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    });
  }

  private setupAPIRoutes(): void {
    const router = express.Router();

    // Execute prompt
    router.post('/execute', async (req, res) => {
      try {
        if (!this.orchestrator) {
          return res.status(503).json({ error: 'Orchestrator not initialized' });
        }

        const { promptId, variables, options = {} } = req.body;
        
        if (!promptId) {
          return res.status(400).json({ error: 'promptId is required' });
        }

        const response = await this.orchestrator.executePrompt(promptId, variables || {}, {
          ...options,
          userId: req.headers['x-user-id'] as string
        });

        res.json({
          success: true,
          data: response,
          metadata: {
            requestId: response.requestId,
            timestamp: new Date().toISOString()
          }
        });

        // Broadcast to WebSocket clients
        this.broadcastToWebSocket('prompt_executed', {
          promptId,
          requestId: response.requestId,
          quality: response.quality.overall,
          cost: response.totalCost
        });

      } catch (error: any) {
        console.error('Execute prompt error:', error);
        res.status(500).json({
          success: false,
          error: error.message,
          code: error.code || 'EXECUTION_ERROR'
        });
      }
    });

    // Execute prompt sequence
    router.post('/execute-sequence', async (req, res) => {
      try {
        if (!this.orchestrator) {
          return res.status(503).json({ error: 'Orchestrator not initialized' });
        }

        const { promptIds, variables, options = {} } = req.body;
        
        if (!Array.isArray(promptIds) || promptIds.length === 0) {
          return res.status(400).json({ error: 'promptIds array is required' });
        }

        const responses = await this.orchestrator.executePromptSequence(promptIds, variables || {}, {
          ...options,
          userId: req.headers['x-user-id'] as string
        });

        res.json({
          success: true,
          data: responses,
          metadata: {
            sequenceLength: responses.length,
            timestamp: new Date().toISOString()
          }
        });

      } catch (error: any) {
        console.error('Execute sequence error:', error);
        res.status(500).json({
          success: false,
          error: error.message,
          code: error.code || 'SEQUENCE_ERROR'
        });
      }
    });

    // Submit feedback
    router.post('/feedback', async (req, res) => {
      try {
        if (!this.orchestrator) {
          return res.status(503).json({ error: 'Orchestrator not initialized' });
        }

        const feedback = req.body;
        await this.orchestrator.submitFeedback(feedback);

        res.json({
          success: true,
          message: 'Feedback submitted successfully'
        });

        this.broadcastToWebSocket('feedback_submitted', feedback);

      } catch (error: any) {
        console.error('Submit feedback error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get analytics
    router.get('/analytics', async (req, res) => {
      try {
        if (!this.orchestrator) {
          return res.status(503).json({ error: 'Orchestrator not initialized' });
        }

        const analytics = await this.orchestrator.getAdvancedAnalytics();
        res.json({
          success: true,
          data: analytics
        });

      } catch (error: any) {
        console.error('Get analytics error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get performance analysis
    router.get('/performance', async (req, res) => {
      try {
        if (!this.orchestrator) {
          return res.status(503).json({ error: 'Orchestrator not initialized' });
        }

        const analysis = await this.orchestrator.analyzePerformance();
        res.json({
          success: true,
          data: analysis
        });

      } catch (error: any) {
        console.error('Get performance error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Trigger evolution
    router.post('/evolve/:promptId', async (req, res) => {
      try {
        if (!this.orchestrator) {
          return res.status(503).json({ error: 'Orchestrator not initialized' });
        }

        const { promptId } = req.params;
        const { strategy } = req.body;

        const evolvedPromptId = await this.orchestrator.triggerManualEvolution(promptId, strategy);

        res.json({
          success: true,
          data: {
            originalPromptId: promptId,
            evolvedPromptId,
            strategy: strategy || 'hybrid'
          }
        });

        this.broadcastToWebSocket('prompt_evolved', {
          originalPromptId: promptId,
          evolvedPromptId,
          strategy
        });

      } catch (error: any) {
        console.error('Trigger evolution error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get task classification metrics
    router.get('/tasks/:taskClass', async (req, res) => {
      try {
        if (!this.orchestrator) {
          return res.status(503).json({ error: 'Orchestrator not initialized' });
        }

        const { taskClass } = req.params;
        const metrics = await this.orchestrator.getTaskClassificationMetrics(taskClass);

        res.json({
          success: true,
          data: metrics
        });

      } catch (error: any) {
        console.error('Get task metrics error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get coordination patterns
    router.get('/coordination-patterns', (req, res) => {
      try {
        if (!this.orchestrator) {
          return res.status(503).json({ error: 'Orchestrator not initialized' });
        }

        const patterns = this.orchestrator.getCoordinationPatterns();
        res.json({
          success: true,
          data: patterns
        });

      } catch (error: any) {
        console.error('Get coordination patterns error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Export configuration
    router.get('/config/export', async (req, res) => {
      try {
        if (!this.orchestrator) {
          return res.status(503).json({ error: 'Orchestrator not initialized' });
        }

        const config = await this.orchestrator.exportConfiguration();
        res.json({
          success: true,
          data: config
        });

      } catch (error: any) {
        console.error('Export config error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Import configuration
    router.post('/config/import', async (req, res) => {
      try {
        if (!this.orchestrator) {
          return res.status(503).json({ error: 'Orchestrator not initialized' });
        }

        await this.orchestrator.importConfiguration(req.body);
        res.json({
          success: true,
          message: 'Configuration imported successfully'
        });

      } catch (error: any) {
        console.error('Import config error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.use('/api', router);
  }

  private setupWebSocket(): void {
    if (!this.config.enableWebSocket || !this.server) return;

    this.wss = new WebSocketServer({ server: this.server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      console.log(`WebSocket client connected from ${req.socket.remoteAddress}`);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log('WebSocket message received:', data);

          // Handle WebSocket commands
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('WebSocket message error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to LLM Orchestration Server',
        timestamp: new Date().toISOString()
      }));
    });

    console.log(`WebSocket server enabled on ws://${this.config.host}:${this.config.port}/ws`);
  }

  private handleWebSocketMessage(ws: any, data: any): void {
    switch (data.type) {
      case 'subscribe':
        // Handle subscription to events
        ws.subscriptions = data.events || [];
        ws.send(JSON.stringify({
          type: 'subscribed',
          events: ws.subscriptions
        }));
        break;

      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString()
        }));
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${data.type}`
        }));
    }
  }

  private broadcastToWebSocket(event: string, data: any): void {
    if (!this.wss) return;

    const message = JSON.stringify({
      type: 'event',
      event,
      data,
      timestamp: new Date().toISOString()
    });

    this.wss.clients.forEach((client: any) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        if (!client.subscriptions || client.subscriptions.includes(event)) {
          client.send(message);
        }
      }
    });
  }

  public async start(): Promise<void> {
    try {
      console.log('🚀 Starting LLM Orchestration Server...');

      // Initialize orchestrator
      console.log('🧠 Initializing Advanced LLM Orchestrator...');
      this.orchestrator = await createAndInitializeOrchestrator(this.config.orchestratorConfig);

      // Setup event listeners
      this.orchestrator.on('response_generated', (data) => {
        this.broadcastToWebSocket('response_generated', data);
      });

      this.orchestrator.on('feedback_received', (data) => {
        this.broadcastToWebSocket('feedback_received', data);
      });

      this.orchestrator.on('prompt_evolved', (data) => {
        this.broadcastToWebSocket('prompt_evolved', data);
      });

      this.orchestrator.on('provider_performance_warning', (data) => {
        this.broadcastToWebSocket('provider_performance_warning', data);
      });

      // Start HTTP server
      this.server = createServer(this.app);
      
      // Setup WebSocket
      this.setupWebSocket();

      // Start listening
      await new Promise<void>((resolve, reject) => {
        this.server.listen(this.config.port, this.config.host, (error?: Error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.isRunning = true;

      console.log(`✅ Server running on http://${this.config.host}:${this.config.port}`);
      console.log(`📡 API endpoints available at http://${this.config.host}:${this.config.port}/api`);
      
      if (this.config.enableWebSocket) {
        console.log(`🔌 WebSocket available at ws://${this.config.host}:${this.config.port}/ws`);
      }

      console.log('🎉 LLM Orchestration Server is ready for production!');

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    console.log('🛑 Stopping LLM Orchestration Server...');

    if (this.orchestrator) {
      await this.orchestrator.shutdown();
    }

    if (this.wss) {
      this.wss.close();
    }

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server.close(() => {
          resolve();
        });
      });
    }

    this.isRunning = false;
    console.log('✅ Server stopped successfully');
  }

  public isServerRunning(): boolean {
    return this.isRunning;
  }

  public getOrchestrator(): AdvancedLLMOrchestrator | undefined {
    return this.orchestrator;
  }
}

// ==================== FACTORY FUNCTIONS ====================

export function createLLMOrchestrationServer(config?: Partial<ServerConfig>): LLMOrchestrationServer {
  return new LLMOrchestrationServer(config);
}

// ==================== MAIN EXECUTION ====================

if (require.main === module) {
  const server = createLLMOrchestrationServer({
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    enableWebSocket: process.env.ENABLE_WEBSOCKET !== 'false',
    enableCors: process.env.ENABLE_CORS !== 'false',
    enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
    maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '100')
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  // Start server
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default LLMOrchestrationServer;