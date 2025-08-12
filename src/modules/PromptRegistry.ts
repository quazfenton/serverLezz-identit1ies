import { Message, MessageContext } from '../types/Message';
import { PromptTemplate } from '../../mechanisms/llmOrchestration/index';

export interface IPromptRegistry {
  getPrompt(id: string): PromptTemplate | null;
  addPrompt(prompt: PromptTemplate): void;
  removePrompt(id: string): boolean;
  listPrompts(): PromptTemplate[];
  compilePrompt(promptId: string, variables: Record<string, any>): string;
}

export class PromptRegistry implements IPromptRegistry {
  private prompts: Map<string, PromptTemplate> = new Map();

  constructor(prompts: PromptTemplate[] = []) {
    prompts.forEach(prompt => this.addPrompt(prompt));
  }

  getPrompt(id: string): PromptTemplate | null {
    return this.prompts.get(id) || null;
  }

  addPrompt(prompt: PromptTemplate): void {
    this.prompts.set(prompt.id, prompt);
  }

  removePrompt(id: string): boolean {
    return this.prompts.delete(id);
  }

  listPrompts(): PromptTemplate[] {
    return Array.from(this.prompts.values());
  }

  compilePrompt(promptId: string, variables: Record<string, any>): string {
    const prompt = this.getPrompt(promptId);
    if (!prompt) {
      throw new Error(`Prompt not found: ${promptId}`);
    }

    let compiled = prompt.content;

    // Replace variables in the prompt
    for (const variable of prompt.variables) {
      const value = variables[variable.name] || variable.defaultValue || '';
      const placeholder = `{{${variable.name}}}`;
      compiled = compiled.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return compiled;
  }

  // Factory method for dependency injection
  static create(prompts: PromptTemplate[] = []): IPromptRegistry {
    return new PromptRegistry(prompts);
  }
}
