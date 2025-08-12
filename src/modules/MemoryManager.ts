import { Message, MessageContext } from '../types/Message';
import { LLMResponse } from '../../mechanisms/llmOrchestration/index';

export interface MemoryEntry {
  id: string;
  sessionId: string;
  messages: Message[];
  responses: LLMResponse[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMemoryManager {
  saveContext(sessionId: string, context: MessageContext): Promise<void>;
  getContext(sessionId: string): Promise<MessageContext | null>;
  addMessage(sessionId: string, message: Message): Promise<void>;
  addResponse(sessionId: string, response: LLMResponse): Promise<void>;
  getConversationHistory(sessionId: string, limit?: number): Promise<Message[]>;
  clearSession(sessionId: string): Promise<void>;
  getAllSessions(): Promise<string[]>;
}

export class MemoryManager implements IMemoryManager {
  private memory: Map<string, MemoryEntry> = new Map();

  async saveContext(sessionId: string, context: MessageContext): Promise<void> {
    let entry = this.memory.get(sessionId);
    
    if (!entry) {
      entry = {
        id: this.generateId(),
        sessionId,
        messages: [],
        responses: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    // Update context data
    if (context.conversationHistory) {
      entry.messages = [...context.conversationHistory];
    }
    
    if (context.variables) {
      entry.metadata.variables = { ...context.variables };
    }

    entry.metadata.userId = context.userId;
    entry.updatedAt = new Date();

    this.memory.set(sessionId, entry);
  }

  async getContext(sessionId: string): Promise<MessageContext | null> {
    const entry = this.memory.get(sessionId);
    
    if (!entry) {
      return null;
    }

    return {
      userId: entry.metadata.userId,
      sessionId,
      conversationHistory: [...entry.messages],
      variables: entry.metadata.variables || {}
    };
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    let entry = this.memory.get(sessionId);
    
    if (!entry) {
      entry = {
        id: this.generateId(),
        sessionId,
        messages: [],
        responses: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    entry.messages.push(message);
    entry.updatedAt = new Date();
    
    // Keep only last 50 messages to prevent memory bloat
    if (entry.messages.length > 50) {
      entry.messages = entry.messages.slice(-50);
    }

    this.memory.set(sessionId, entry);
  }

  async addResponse(sessionId: string, response: LLMResponse): Promise<void> {
    let entry = this.memory.get(sessionId);
    
    if (!entry) {
      entry = {
        id: this.generateId(),
        sessionId,
        messages: [],
        responses: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    entry.responses.push(response);
    entry.updatedAt = new Date();
    
    // Keep only last 20 responses
    if (entry.responses.length > 20) {
      entry.responses = entry.responses.slice(-20);
    }

    this.memory.set(sessionId, entry);
  }

  async getConversationHistory(sessionId: string, limit: number = 10): Promise<Message[]> {
    const entry = this.memory.get(sessionId);
    
    if (!entry) {
      return [];
    }

    return entry.messages.slice(-limit);
  }

  async clearSession(sessionId: string): Promise<void> {
    this.memory.delete(sessionId);
  }

  async getAllSessions(): Promise<string[]> {
    return Array.from(this.memory.keys());
  }

  // Additional methods for advanced memory management
  async getSessionMetrics(sessionId: string): Promise<{
    messageCount: number;
    responseCount: number;
    sessionAge: number;
    lastActivity: Date;
  } | null> {
    const entry = this.memory.get(sessionId);
    
    if (!entry) {
      return null;
    }

    return {
      messageCount: entry.messages.length,
      responseCount: entry.responses.length,
      sessionAge: Date.now() - entry.createdAt.getTime(),
      lastActivity: entry.updatedAt
    };
  }

  async compactMemory(): Promise<void> {
    // Remove old sessions and compact data
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    
    for (const [sessionId, entry] of this.memory.entries()) {
      if (entry.updatedAt.getTime() < cutoffTime) {
        this.memory.delete(sessionId);
      }
    }
  }

  async getMemoryStats(): Promise<{
    totalSessions: number;
    totalMessages: number;
    totalResponses: number;
    memoryUsage: number;
  }> {
    let totalMessages = 0;
    let totalResponses = 0;
    
    for (const entry of this.memory.values()) {
      totalMessages += entry.messages.length;
      totalResponses += entry.responses.length;
    }

    return {
      totalSessions: this.memory.size,
      totalMessages,
      totalResponses,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage in bytes
    let size = 0;
    
    for (const entry of this.memory.values()) {
      size += JSON.stringify(entry).length * 2; // Rough estimation
    }
    
    return size;
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Factory method for dependency injection
  static create(): IMemoryManager {
    return new MemoryManager();
  }
}
