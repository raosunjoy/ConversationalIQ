/**
 * AI Services Configuration
 * Manages configuration for all AI/ML components
 */

import { getConfig } from '../config/environment';

export interface AIConfig {
  openai: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
    timeout: number;
  };
  sentiment: {
    modelPath: string;
    confidenceThreshold: number;
    cacheTimeout: number;
    enableEmotions: boolean;
  };
  intent: {
    modelPath: string;
    categories: string[];
    confidenceThreshold: number;
    maxIntentsPerMessage: number;
  };
  processing: {
    maxConcurrent: number;
    timeoutMs: number;
    retryAttempts: number;
    enableCaching: boolean;
  };
  performance: {
    targetLatency: number;
    accuracyThreshold: number;
    enableMetrics: boolean;
  };
}

/**
 * Get AI configuration with environment variable overrides
 */
export function getAIConfig(): AIConfig {
  getConfig(); // Access environment config

  return {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000'),
    },
    sentiment: {
      modelPath: process.env.SENTIMENT_MODEL_PATH || 'models/sentiment',
      confidenceThreshold: parseFloat(
        process.env.SENTIMENT_CONFIDENCE_THRESHOLD || '0.8'
      ),
      cacheTimeout: parseInt(process.env.SENTIMENT_CACHE_TIMEOUT || '3600'),
      enableEmotions: process.env.SENTIMENT_ENABLE_EMOTIONS === 'true',
    },
    intent: {
      modelPath: process.env.INTENT_MODEL_PATH || 'models/intent',
      categories: (
        process.env.INTENT_CATEGORIES ||
        'complaint,question,request,compliment,urgent,billing,technical,cancellation,upgrade,information,feedback,escalation,refund,support,other'
      ).split(','),
      confidenceThreshold: parseFloat(
        process.env.INTENT_CONFIDENCE_THRESHOLD || '0.75'
      ),
      maxIntentsPerMessage: parseInt(process.env.INTENT_MAX_PER_MESSAGE || '3'),
    },
    processing: {
      maxConcurrent: parseInt(process.env.AI_MAX_CONCURRENT || '10'),
      timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '5000'),
      retryAttempts: parseInt(process.env.AI_RETRY_ATTEMPTS || '2'),
      enableCaching: process.env.AI_ENABLE_CACHING !== 'false',
    },
    performance: {
      targetLatency: parseInt(process.env.AI_TARGET_LATENCY || '500'),
      accuracyThreshold: parseFloat(
        process.env.AI_ACCURACY_THRESHOLD || '0.85'
      ),
      enableMetrics: process.env.AI_ENABLE_METRICS !== 'false',
    },
  };
}

/**
 * Validate AI configuration
 */
export function validateAIConfig(config: AIConfig): void {
  if (!config.openai.apiKey) {
    throw new Error('OpenAI API key is required for response generation');
  }

  if (config.processing.timeoutMs > config.performance.targetLatency * 10) {
    console.warn(
      'AI processing timeout is significantly higher than target latency'
    );
  }

  if (config.intent.categories.length < 10) {
    console.warn(
      'Intent classification has fewer than 10 categories, may impact accuracy'
    );
  }

  if (config.sentiment.confidenceThreshold < 0.7) {
    console.warn('Sentiment confidence threshold is low, may impact accuracy');
  }
}

// Export singleton instance
export const aiConfig = getAIConfig();
