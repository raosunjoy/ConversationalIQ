/**
 * Mock for ResponseGenerationService
 */

import { ResponseSuggestion } from '../models';

export class ResponseGenerationService {
  private initialized = true;

  async initialize(): Promise<void> {
    // Mock successful initialization
  }

  async generateSuggestions(_request: any): Promise<ResponseSuggestion[]> {
    return [
      {
        id: 'suggestion_1',
        content:
          "I understand your billing concern and I'm here to help resolve this issue for you.",
        confidence: 0.88,
        category: 'template',
        tone: 'empathetic',
        tags: ['billing', 'empathetic'],
        reasoning: 'Template match for billing intent',
      },
      {
        id: 'suggestion_2',
        content:
          'Let me review your account details and get back to you with a solution within 24 hours.',
        confidence: 0.82,
        category: 'generated',
        tone: 'professional',
        tags: ['billing', 'timeline'],
        reasoning: 'AI-generated response based on context',
      },
    ];
  }

  async isHealthy(): Promise<boolean> {
    return this.initialized;
  }

  getVersion(): string {
    return '1.0.0-mock';
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }
}
