// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Enhanced WebSocket Manager
// Heartbeat • Rate Limiting • Connection Tracking • Automatic Cleanup
// ═══════════════════════════════════════════════════════════════════════════════

import { WebSocket } from 'ws';
import { logger, logSecurityEvent } from '../middleware';
import { generateSecureId, sanitizeObjectForLogging } from '../middleware/auth';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface WebSocketClient {
  id: string;
  ws: WebSocket;
  ip: string;
  profileId?: string;
  connectedAt: Date;
  lastPing: Date;
  lastPong: Date;
  messageCount: number;
  subscriptions: Set<string>;
  isAlive: boolean;
}

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface WebSocketManagerOptions {
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  maxConnectionsPerIp?: number;
  rateLimitWindow?: number;
  rateLimitMax?: number;
  maxMessageSize?: number;
  idleTimeout?: number;
}

const DEFAULT_OPTIONS: WebSocketManagerOptions = {
  heartbeatInterval: 30000, // 30 seconds
  heartbeatTimeout: 10000,  // 10 seconds
  maxConnectionsPerIp: 10,
  rateLimitWindow: 60000,   // 1 minute
  rateLimitMax: 30,         // 30 messages per minute
  maxMessageSize: 1024 * 1024, // 1MB
  idleTimeout: 5 * 60 * 1000, // 5 minutes
};

// ═══════════════════════════════════════════════════════════════════════════════
// WebSocket Manager
// ═══════════════════════════════════════════════════════════════════════════════

export class WebSocketManager {
  private clients: Map<string, WebSocketClient> = new Map();
  private connectionsByIp: Map<string, Set<string>> = new Map();
  private messageCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private options: WebSocketManagerOptions;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(options: WebSocketManagerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.startHeartbeat();
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws: WebSocket, req: any): string {
    const clientId = generateSecureId('ws');
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';

    // Check connection limit per IP
    const existingConnections = this.connectionsByIp.get(ip);
    if (existingConnections && existingConnections.size >= this.options.maxConnectionsPerIp!) {
      logSecurityEvent('websocket_ip_limit_exceeded', { ip, clientId });
      ws.close(4429, 'Too many connections from this IP');
      return clientId;
    }

    // Create client record
    const now = new Date();
    const client: WebSocketClient = {
      id: clientId,
      ws,
      ip,
      connectedAt: now,
      lastPing: now,
      lastPong: now,
      messageCount: 0,
      subscriptions: new Set(),
      isAlive: true,
    };

    // Store client
    this.clients.set(clientId, client);

    // Track IP connections
    if (!existingConnections) {
      this.connectionsByIp.set(ip, new Set());
    }
    this.connectionsByIp.get(ip)!.add(clientId);

    // Set up event handlers
    this.setupEventHandlers(ws, client);

    // Send welcome message
    this.send(ws, {
      type: 'welcome',
      clientId,
      timestamp: now.toISOString(),
    });

    logger.info('WebSocket connected', {
      clientId,
      ip,
      totalConnections: this.clients.size,
    });

    return clientId;
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(ws: WebSocket, client: WebSocketClient): void {
    // Message handler
    ws.on('message', (data: Buffer) => {
      this.handleMessage(client, data);
    });

    // Pong handler
    ws.on('pong', () => {
      client.isAlive = true;
      client.lastPong = new Date();
    });

    // Close handler
    ws.on('close', (code: number, reason: Buffer) => {
      this.handleClose(client, code, reason.toString());
    });

    // Error handler
    ws.on('error', (error: Error) => {
      logger.error('WebSocket error', {
        clientId: client.id,
        error: error.message,
      });
    });

    // Set message size limit
    ws.on('unexpected-response', (req: any, res: any) => {
      logger.warn('WebSocket unexpected response', {
        clientId: client.id,
      });
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(client: WebSocketClient, data: Buffer): void {
    // Check message size
    if (data.length > this.options.maxMessageSize!) {
      logSecurityEvent('websocket_message_too_large', {
        clientId: client.id,
        size: data.length,
      });
      this.send(client.ws, {
        type: 'error',
        error: 'Message too large',
        maxSize: this.options.maxMessageSize,
      });
      return;
    }

    // Check rate limit
    if (!this.checkRateLimit(client.ip)) {
      logSecurityEvent('websocket_rate_limit_exceeded', {
        clientId: client.id,
        ip: client.ip,
      });
      this.send(client.ws, {
        type: 'error',
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((this.messageCounts.get(client.ip)?.resetTime || 0) / 1000),
      });
      return;
    }

    // Parse message
    let message: WebSocketMessage;
    try {
      message = JSON.parse(data.toString());
    } catch (error) {
      this.send(client.ws, {
        type: 'error',
        error: 'Invalid JSON',
      });
      return;
    }

    // Validate message type
    if (!message.type || typeof message.type !== 'string') {
      this.send(client.ws, {
        type: 'error',
        error: 'Missing message type',
      });
      return;
    }

    // Update message count
    client.messageCount++;

    // Log message (sanitized)
    logger.debug('WebSocket message received', {
      clientId: client.id,
      type: message.type,
      data: sanitizeObjectForLogging(message, 1),
    });

    // Handle message based on type
    this.processMessage(client, message);
  }

  /**
   * Process message based on type
   */
  private processMessage(client: WebSocketClient, message: WebSocketMessage): void {
    switch (message.type) {
      case 'ping':
        this.send(client.ws, { type: 'pong', timestamp: new Date().toISOString() });
        break;

      case 'subscribe':
        this.handleSubscribe(client, message.events);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(client, message.events);
        break;

      case 'authenticate':
        this.handleAuthenticate(client, message.token);
        break;

      case 'update_resonance':
        // Forward to application handler
        this.emit('resonance_update', { client, data: message });
        break;

      case 'interaction':
        // Forward to application handler
        this.emit('interaction', { client, data: message });
        break;

      default:
        logger.warn('Unknown WebSocket message type', {
          clientId: client.id,
          type: message.type,
        });
    }
  }

  /**
   * Handle subscription
   */
  private handleSubscribe(client: WebSocketClient, events: string[]): void {
    if (!Array.isArray(events)) return;

    events.forEach(event => {
      if (typeof event === 'string') {
        client.subscriptions.add(event);
      }
    });

    this.send(client.ws, {
      type: 'subscribed',
      events: Array.from(client.subscriptions),
    });
  }

  /**
   * Handle unsubscription
   */
  private handleUnsubscribe(client: WebSocketClient, events: string[]): void {
    if (!Array.isArray(events)) return;

    events.forEach(event => {
      client.subscriptions.delete(event);
    });

    this.send(client.ws, {
      type: 'unsubscribed',
      events: Array.from(client.subscriptions),
    });
  }

  /**
   * Handle authentication
   */
  private handleAuthenticate(client: WebSocketClient, token: string): void {
    // Token verification happens in application layer
    this.emit('authenticate', { client, token });
  }

  /**
   * Handle connection close
   */
  private handleClose(client: WebSocketClient, code: number, reason: string): void {
    logger.info('WebSocket disconnected', {
      clientId: client.id,
      code,
      reason,
      duration: Date.now() - client.connectedAt.getTime(),
      messages: client.messageCount,
    });

    this.removeClient(client);
  }

  /**
   * Remove client from tracking
   */
  private removeClient(client: WebSocketClient): void {
    this.clients.delete(client.id);

    const ipConnections = this.connectionsByIp.get(client.ip);
    if (ipConnections) {
      ipConnections.delete(client.id);
      if (ipConnections.size === 0) {
        this.connectionsByIp.delete(client.ip);
      }
    }
  }

  /**
   * Check rate limit for IP
   */
  private checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = this.messageCounts.get(ip);

    if (!record || now > record.resetTime) {
      this.messageCounts.set(ip, {
        count: 1,
        resetTime: now + this.options.rateLimitWindow!,
      });
      return true;
    }

    if (record.count >= this.options.rateLimitMax!) {
      return false;
    }

    record.count++;
    return true;
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.clients.forEach((client, id) => {
        // Check if client responded to last ping
        if (!client.isAlive) {
          logger.warn('WebSocket timeout - closing connection', {
            clientId: id,
            lastPing: client.lastPing,
          });
          client.ws.terminate();
          this.removeClient(client);
          return;
        }

        // Send ping
        client.isAlive = false;
        client.lastPing = new Date();
        
        try {
          client.ws.ping();
        } catch (error) {
          logger.error('WebSocket ping error', {
            clientId: id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });
    }, this.options.heartbeatInterval);

    logger.info('WebSocket heartbeat started', {
      interval: this.options.heartbeatInterval,
    });
  }

  /**
   * Stop heartbeat interval
   */
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Send message to client
   */
  send(ws: WebSocket, message: WebSocketMessage): boolean {
    if (ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('WebSocket send error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Send message to specific client
   */
  sendTo(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;
    return this.send(client.ws, message);
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message: WebSocketMessage, excludeId?: string): void {
    const str = JSON.stringify(message);
    this.clients.forEach((client, id) => {
      if (id === excludeId) return;
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(str);
        } catch (error) {
          logger.error('WebSocket broadcast error', {
            clientId: id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    });
  }

  /**
   * Broadcast to subscribed clients
   */
  broadcastToSubscribers(event: string, data: any): void {
    const message = {
      type: 'event',
      event,
      data,
      timestamp: new Date().toISOString(),
    };

    this.clients.forEach((client) => {
      if (client.subscriptions.has(event) || client.subscriptions.has('*')) {
        this.send(client.ws, message);
      }
    });
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
   * Get connections by IP
   */
  getConnectionsByIp(ip: string): number {
    return this.connectionsByIp.get(ip)?.size || 0;
  }

  /**
   * Get stats
   */
  getStats(): {
    totalConnections: number;
    uniqueIps: number;
    avgMessagesPerClient: number;
  } {
    const totalMessages = Array.from(this.clients.values())
      .reduce((sum, c) => sum + c.messageCount, 0);

    return {
      totalConnections: this.clients.size,
      uniqueIps: this.connectionsByIp.size,
      avgMessagesPerClient: this.clients.size > 0 ? totalMessages / this.clients.size : 0,
    };
  }

  /**
   * Clean up inactive clients
   */
  cleanupInactiveClients(idleTimeout?: number): number {
    const timeout = idleTimeout || this.options.idleTimeout!;
    const now = Date.now();
    let cleaned = 0;

    this.clients.forEach((client, id) => {
      const idleTime = now - client.lastPong.getTime();
      if (idleTime > timeout) {
        logger.info('Closing idle WebSocket', {
          clientId: id,
          idleTime,
        });
        client.ws.close(4000, 'Idle timeout');
        this.removeClient(client);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      logger.info('Cleaned up idle WebSocket clients', {
        cleaned,
        remaining: this.clients.size,
      });
    }

    return cleaned;
  }

  /**
   * Close all connections
   */
  closeAll(code: number = 1001, reason: string = 'Server shutting down'): void {
    logger.info('Closing all WebSocket connections', {
      count: this.clients.size,
      reason,
    });

    this.stopHeartbeat();

    this.clients.forEach((client) => {
      try {
        client.ws.close(code, reason);
      } catch (error) {
        logger.error('Error closing WebSocket', {
          clientId: client.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    this.clients.clear();
    this.connectionsByIp.clear();
    this.messageCounts.clear();
  }

  // Event emitter for application-level events
  private eventHandlers: Map<string, Set<(data: any) => void>> = new Map();

  on(event: string, handler: (data: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: (data: any) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          logger.error('WebSocket event handler error', {
            event,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════════

export default WebSocketManager;
