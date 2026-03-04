/**
 * WebSocket Security & Validation Middleware
 * Handles WebSocket connections with proper validation, rate limiting, and cleanup
 */

import { WebSocket } from 'ws';
import { z } from 'zod';
import { generateSecureId, sanitizeLogInput, logger, logSecurityEvent } from '../../shared/utils';
import { RateLimiter } from '../../mechanisms/llmOrchestration/utils';

// WebSocket message schemas
const PingMessageSchema = z.object({
  type: z.literal('ping'),
});

const SubscribeMessageSchema = z.object({
  type: z.literal('subscribe_metrics'),
  events: z.array(z.string()).optional(),
});

const ResonanceMessageSchema = z.object({
  type: z.literal('update_resonance'),
  resonanceFilter: z.any().optional(),
  profileId: z.string().optional(),
});

const InteractionMessageSchema = z.object({
  type: z.literal('interaction'),
  interaction: z.object({
    fromId: z.string(),
    toId: z.string().optional(),
    type: z.string(),
    data: z.any().optional(),
  }),
});

const WebSocketMessageSchema = z.union([
  PingMessageSchema,
  SubscribeMessageSchema,
  ResonanceMessageSchema,
  InteractionMessageSchema,
]);

export interface WebSocketClient {
  id: string;
  ws: WebSocket;
  profileId?: string;
  sessionId?: string;
  connectedAt: Date;
  lastActivity: Date;
  messageCount: number;
  heartbeatInterval: NodeJS.Timeout;
}

export class WebSocketManager {
  private clients: Map<string, WebSocketClient> = new Map();
  private rateLimiter: RateLimiter;
  private maxConnectionsPerIp: number;
  private connectionAttempts: Map<string, number[]> = new Map();

  constructor(options?: {
    maxConnectionsPerIp?: number;
    rateLimitWindow?: number;
    rateLimitMax?: number;
  }) {
    this.maxConnectionsPerIp = options?.maxConnectionsPerIp || 10;
    this.rateLimiter = new RateLimiter({
      windowSize: options?.rateLimitWindow || 60000, // 1 minute
      maxRequests: options?.rateLimitMax || 30, // 30 messages per minute
    });
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws: WebSocket, req: any): WebSocketClient {
    const clientId = generateSecureId('client');
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';

    // Rate limit connection attempts
    if (!this.checkConnectionRateLimit(ip)) {
      logger.warn('WebSocket connection rate limit exceeded', { ip });
      ws.close(4429, 'Too many connection attempts');
      throw new Error('Connection rate limit exceeded');
    }

    // Check max connections per IP
    const ipConnections = Array.from(this.clients.values()).filter(
      c => (c.ws as any)._socket?.remoteAddress === ip
    ).length;

    if (ipConnections >= this.maxConnectionsPerIp) {
      logger.warn('Max WebSocket connections per IP exceeded', { ip });
      ws.close(4429, 'Too many connections');
      throw new Error('Max connections per IP exceeded');
    }

    // Create client record
    const client: WebSocketClient = {
      id: clientId,
      ws,
      connectedAt: new Date(),
      lastActivity: new Date(),
      messageCount: 0,
      heartbeatInterval: null as any,
    };

    this.clients.set(clientId, client);

    // Setup heartbeat
    client.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat(client);
    }, 30000);

    // Setup message handler
    ws.on('message', (data: Buffer) => {
      this.handleMessage(client, data);
    });

    // Setup close handler
    ws.on('close', () => {
      this.handleClose(client);
    });

    // Setup error handler
    ws.on('error', (error: Error) => {
      this.handleError(client, error);
    });

    // Setup pong handler for heartbeat
    ws.on('pong', () => {
      client.lastActivity = new Date();
    });

    // Send welcome message
    this.sendToClient(client, {
      type: 'welcome',
      clientId,
      timestamp: new Date().toISOString(),
      message: 'Connected to Coordination Cosmos',
    });

    logger.info('WebSocket connection established', {
      clientId,
      ip,
      totalConnections: this.clients.size,
    });

    return client;
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(client: WebSocketClient, data: Buffer): Promise<void> {
    try {
      client.lastActivity = new Date();
      client.messageCount++;

      // Rate limit messages
      const rateLimitKey = client.id;
      const allowed = await this.rateLimiter.checkLimit({ clientId: rateLimitKey });
      
      if (!allowed) {
        this.sendToClient(client, {
          type: 'error',
          error: 'Message rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
        });
        logger.warn('WebSocket message rate limit exceeded', {
          clientId: client.id,
        });
        return;
      }

      // Parse and validate message
      const rawMessage = data.toString();
      const parsed = JSON.parse(rawMessage);
      const validated = WebSocketMessageSchema.parse(parsed);

      logger.debug('WebSocket message received', {
        clientId: client.id,
        type: validated.type,
        messageCount: client.messageCount,
      });

      // Handle message based on type
      switch (validated.type) {
        case 'ping':
          this.sendToClient(client, {
            type: 'pong',
            timestamp: new Date().toISOString(),
          });
          break;

        case 'subscribe_metrics':
          this.handleSubscribe(client, validated);
          break;

        case 'update_resonance':
          this.handleResonance(client, validated);
          break;

        case 'interaction':
          this.handleInteraction(client, validated);
          break;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendToClient(client, {
          type: 'error',
          error: 'Invalid message format',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        logger.warn('WebSocket validation error', {
          clientId: client.id,
          errors: error.errors,
        });
      } else if (error instanceof SyntaxError) {
        this.sendToClient(client, {
          type: 'error',
          error: 'Invalid JSON',
        });
        logger.warn('WebSocket JSON parse error', {
          clientId: client.id,
        });
      } else {
        this.sendToClient(client, {
          type: 'error',
          error: 'Internal error',
        });
        logger.error('WebSocket message handling error', {
          clientId: client.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Handle connection close
   */
  private handleClose(client: WebSocketClient): void {
    // Clear heartbeat interval
    if (client.heartbeatInterval) {
      clearInterval(client.heartbeatInterval);
    }

    // Remove from clients
    this.clients.delete(client.id);

    logger.info('WebSocket connection closed', {
      clientId: client.id,
      totalConnections: this.clients.size,
      sessionDuration: Date.now() - client.connectedAt.getTime(),
      messageCount: client.messageCount,
    });
  }

  /**
   * Handle connection error
   */
  private handleError(client: WebSocketClient, error: Error): void {
    logger.error('WebSocket error', {
      clientId: client.id,
      error: error.message,
      stack: error.stack,
    });

    // Don't close on error - let the client handle it
  }

  /**
   * Send heartbeat/ping to client
   */
  private sendHeartbeat(client: WebSocketClient): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.ping();
    } else {
      // Client is not responsive, close connection
      this.closeClient(client, 'Client not responsive');
    }
  }

  /**
   * Handle subscribe message
   */
  private handleSubscribe(
    client: WebSocketClient,
    message: z.infer<typeof SubscribeMessageSchema>
  ): void {
    logger.info('Client subscribed to metrics', {
      clientId: client.id,
      events: message.events,
    });

    // Send current metrics
    this.sendToClient(client, {
      type: 'subscribed',
      events: message.events || ['metrics'],
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle resonance update message
   */
  private handleResonance(
    client: WebSocketClient,
    message: z.infer<typeof ResonanceMessageSchema>
  ): void {
    logger.info('Resonance update received', {
      clientId: client.id,
      profileId: message.profileId,
    });

    // Update client profile info
    if (message.profileId) {
      client.profileId = message.profileId;
    }

    // Broadcast update (to be handled by server)
    this.broadcast({
      type: 'resonance_updated',
      profileId: message.profileId,
      timestamp: new Date().toISOString(),
    }, client.id);
  }

  /**
   * Handle interaction message
   */
  private handleInteraction(
    client: WebSocketClient,
    message: z.infer<typeof InteractionMessageSchema>
  ): void {
    logger.info('Interaction received', {
      clientId: client.id,
      fromId: message.interaction.fromId,
      toId: message.interaction.toId,
      type: message.interaction.type,
    });

    // Forward interaction to server for processing
    this.broadcast({
      type: 'interaction',
      interaction: {
        ...message.interaction,
        timestamp: new Date().toISOString(),
      },
    }, client.id);
  }

  /**
   * Send message to specific client
   */
  sendToClient(client: WebSocketClient, data: any): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(data));
      } catch (error) {
        logger.error('Failed to send to client', {
          clientId: client.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(data: any, excludeClientId?: string): void {
    const message = JSON.stringify(data);
    const excluded = excludeClientId ? new Set([excludeClientId]) : new Set();

    for (const [clientId, client] of this.clients.entries()) {
      if (excluded.has(clientId)) continue;
      if (client.ws.readyState !== WebSocket.OPEN) continue;

      try {
        client.ws.send(message);
      } catch (error) {
        logger.debug('Failed to broadcast to client', {
          clientId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Send message to specific profile
   */
  sendToProfile(profileId: string, data: any): void {
    const message = JSON.stringify(data);

    for (const [clientId, client] of this.clients.entries()) {
      if (client.profileId !== profileId) continue;
      if (client.ws.readyState !== WebSocket.OPEN) continue;

      try {
        client.ws.send(message);
      } catch (error) {
        logger.debug('Failed to send to profile', {
          profileId,
          clientId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Close client connection
   */
  closeClient(client: WebSocketClient, reason: string = 'Connection closed'): void {
    if (client.heartbeatInterval) {
      clearInterval(client.heartbeatInterval);
    }

    try {
      client.ws.close(1000, reason);
    } catch (error) {
      logger.debug('Error closing client', {
        clientId: client.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    this.clients.delete(client.id);
  }

  /**
   * Get client by ID
   */
  getClient(clientId: string): WebSocketClient | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get all clients
   */
  getAllClients(): WebSocketClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.clients.size;
  }

  /**
   * Get stats
   */
  getStats(): {
    totalConnections: number;
    connectionsByProfile: Map<string, number>;
    averageSessionDuration: number;
    totalMessages: number;
  } {
    const now = Date.now();
    const connectionsByProfile = new Map<string, number>();
    let totalDuration = 0;
    let totalMessages = 0;

    for (const client of this.clients.values()) {
      if (client.profileId) {
        const count = connectionsByProfile.get(client.profileId) || 0;
        connectionsByProfile.set(client.profileId, count + 1);
      }
      totalDuration += now - client.connectedAt.getTime();
      totalMessages += client.messageCount;
    }

    return {
      totalConnections: this.clients.size,
      connectionsByProfile,
      averageSessionDuration: this.clients.size > 0 ? totalDuration / this.clients.size : 0,
      totalMessages,
    };
  }

  /**
   * Cleanup inactive clients
   */
  cleanupInactiveClients(maxInactiveTime: number = 30 * 60 * 1000): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [clientId, client] of this.clients.entries()) {
      const inactiveTime = now - client.lastActivity.getTime();
      if (inactiveTime > maxInactiveTime) {
        toRemove.push(clientId);
      }
    }

    for (const clientId of toRemove) {
      const client = this.clients.get(clientId);
      if (client) {
        this.closeClient(client, 'Inactive timeout');
        logger.info('Closed inactive client', {
          clientId,
          inactiveTime: `${inactiveTime}ms`,
        });
      }
    }

    if (toRemove.length > 0) {
      logger.info('Cleanup completed', {
        removedClients: toRemove.length,
        remainingClients: this.clients.size,
      });
    }
  }

  /**
   * Check connection rate limit
   */
  private checkConnectionRateLimit(ip: string): boolean {
    const now = Date.now();
    const attempts = this.connectionAttempts.get(ip) || [];

    // Remove old attempts (older than 1 minute)
    const recentAttempts = attempts.filter(time => now - time < 60000);

    if (recentAttempts.length >= 10) {
      return false;
    }

    recentAttempts.push(now);
    this.connectionAttempts.set(ip, recentAttempts);

    // Cleanup old entries periodically
    if (recentAttempts.length === 1) {
      setTimeout(() => {
        this.connectionAttempts.delete(ip);
      }, 60000);
    }

    return true;
  }

  /**
   * Shutdown all connections
   */
  shutdown(): void {
    logger.info('Shutting down WebSocket manager', {
      activeConnections: this.clients.size,
    });

    for (const client of this.clients.values()) {
      this.closeClient(client, 'Server shutting down');
    }

    this.clients.clear();
  }
}

// Export singleton instance for backward compatibility
export const wsManager = new WebSocketManager();
