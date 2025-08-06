/**
 * Mock for IntentClassificationService
 */

import { IntentResult } from '../models';

export class IntentClassificationService {
  private initialized = true;

  async initialize(): Promise<void> {
    // Mock successful initialization
  }

  async classifyMessage(_message: any, _context?: any): Promise<IntentResult> {
    return {
      intents: [
        {
          category: 'billing',
          confidence: 0.9,
          urgency: 'MEDIUM',
          actionRequired: true,
        },
        {
          category: 'complaint',
          confidence: 0.6,
          urgency: 'MEDIUM',
          actionRequired: true,
        },
      ],
      primaryIntent: {
        category: 'billing',
        confidence: 0.9,
        urgency: 'MEDIUM',
        actionRequired: true,
      },
      confidence: 0.9,
      processingTime: 100,
    };
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
