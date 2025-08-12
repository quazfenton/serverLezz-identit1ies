import * as fs from 'fs/promises';
import * as path from 'path';
import { OrchestrationResponse } from '../index';

export interface IResponseStore {
  storeResponse(response: OrchestrationResponse): Promise<void>;
  retrieveResponse(responseId: string): Promise<OrchestrationResponse | null>;
  findResponseById(responseId: string): Promise<OrchestrationResponse | null>;
  deleteResponse(responseId: string): Promise<boolean>;
  cleanup(): Promise<void>;
}

export class FileBasedResponseStore implements IResponseStore {
  private basePath: string;
  private maxAge: number; // in milliseconds

  constructor(basePath: string = './data/responses', maxAgeHours: number = 24) {
    this.basePath = basePath;
    this.maxAge = maxAgeHours * 60 * 60 * 1000;
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
    } catch (error) {
      console.warn('Failed to create responses directory:', error);
    }
  }

  private getResponsePath(responseId: string): string {
    return path.join(this.basePath, `${responseId}.json`);
  }

  async storeResponse(response: OrchestrationResponse): Promise<void> {
    await this.ensureDirectory();
    
    const responseData = {
      ...response,
      storedAt: new Date().toISOString(),
      // Convert Date objects to ISO strings for JSON serialization
      createdAt: response.createdAt?.toISOString(),
      responses: response.responses.map(r => ({
        ...r,
        timestamp: r.timestamp?.toISOString()
      }))
    };

    try {
      const filePath = this.getResponsePath(response.requestId);
      await fs.writeFile(filePath, JSON.stringify(responseData, null, 2));
    } catch (error) {
      console.error(`Failed to store response ${response.requestId}:`, error);
      throw error;
    }
  }

  async retrieveResponse(responseId: string): Promise<OrchestrationResponse | null> {
    return this.findResponseById(responseId);
  }

  async findResponseById(responseId: string): Promise<OrchestrationResponse | null> {
    const filePath = this.getResponsePath(responseId);
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const responseData = JSON.parse(data);
      
      // Convert ISO strings back to Date objects
      const response: OrchestrationResponse = {
        ...responseData,
        createdAt: new Date(responseData.createdAt),
        responses: responseData.responses.map((r: any) => ({
          ...r,
          timestamp: new Date(r.timestamp)
        }))
      };

      // Check if response is still within max age
      const storedAt = new Date(responseData.storedAt);
      if (Date.now() - storedAt.getTime() > this.maxAge) {
        await this.deleteResponse(responseId);
        return null;
      }

      return response;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null; // File doesn't exist
      }
      console.error(`Failed to retrieve response ${responseId}:`, error);
      throw error;
    }
  }

  async deleteResponse(responseId: string): Promise<boolean> {
    const filePath = this.getResponsePath(responseId);
    
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return false; // File doesn't exist
      }
      console.error(`Failed to delete response ${responseId}:`, error);
      return false;
    }
  }

  async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.basePath);
      const now = Date.now();

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.basePath, file);
        try {
          const data = await fs.readFile(filePath, 'utf-8');
          const responseData = JSON.parse(data);
          const storedAt = new Date(responseData.storedAt);
          
          if (now - storedAt.getTime() > this.maxAge) {
            await fs.unlink(filePath);
            console.log(`Cleaned up expired response: ${file}`);
          }
        } catch (error) {
          console.warn(`Failed to process cleanup for file ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup responses:', error);
    }
  }

  async getAllResponses(): Promise<OrchestrationResponse[]> {
    try {
      await this.ensureDirectory();
      const files = await fs.readdir(this.basePath);
      const responses: OrchestrationResponse[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const responseId = file.replace('.json', '');
        const response = await this.findResponseById(responseId);
        if (response) {
          responses.push(response);
        }
      }

      return responses;
    } catch (error) {
      console.error('Failed to get all responses:', error);
      return [];
    }
  }
}

// Factory function for creating response store instances
export function createResponseStore(
  type: 'file' | 'memory' = 'file',
  config?: { basePath?: string; maxAgeHours?: number }
): IResponseStore {
  switch (type) {
    case 'file':
      return new FileBasedResponseStore(config?.basePath, config?.maxAgeHours);
    case 'memory':
      // Could implement an in-memory store for testing
      throw new Error('Memory-based response store not implemented yet');
    default:
      throw new Error(`Unknown response store type: ${type}`);
  }
}

export default FileBasedResponseStore;
