/**
 * Mock for SentimentAnalysisService
 */

import { SentimentResult } from '../models';

export class SentimentAnalysisService {
  private initialized = true;

  async initialize(): Promise<void> {
    // Mock successful initialization
  }

  async analyzeMessage(_message: any): Promise<SentimentResult> {
    return {
      score: -0.2,
      magnitude: 0.6,
      label: 'NEGATIVE',
      confidence: 0.85,
      emotions: [
        {
          emotion: 'anger',
          confidence: 0.7,
          intensity: 0.5,
        },
      ],
      processingTime: 150,
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
