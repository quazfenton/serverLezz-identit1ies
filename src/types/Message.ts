// Message types and interfaces for the LLM orchestration pipeline
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface MessageContext {
  userId?: string;
  sessionId?: string;
  conversationHistory?: Message[];
  variables?: Record<string, any>;
}

export class MessageImpl implements Message {
  public readonly id: string;
  public readonly content: string;
  public readonly role: 'user' | 'assistant' | 'system';
  public readonly timestamp: Date;
  public readonly metadata?: Record<string, any>;

  constructor(
    content: string,
    role: 'user' | 'assistant' | 'system' = 'user',
    metadata?: Record<string, any>
  ) {
    this.id = this.generateId();
    this.content = content;
    this.role = role;
    this.timestamp = new Date();
    this.metadata = metadata;
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export interface MessageProcessor {
  process(message: Message, context?: MessageContext): Promise<Message>;
}
