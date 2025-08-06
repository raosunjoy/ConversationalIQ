/**
 * AI Models and Types
 * Defines data structures for AI processing components
 */

export interface Message {
  id: string;
  content: string;
  sender: 'AGENT' | 'CUSTOMER';
  timestamp: Date;
  conversationId: string;
}

export interface ConversationContext {
  id: string;
  messages: Message[];
  agentId?: string | undefined;
  customerId: string;
  ticketId: string;
  subject?: string | undefined;
  tags?: string[] | undefined;
  status: 'OPEN' | 'PENDING' | 'SOLVED' | 'CLOSED';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | undefined;
}

// Sentiment Analysis Models
export interface SentimentResult {
  score: number; // -1 (negative) to 1 (positive)
  magnitude: number; // 0 to 1 (intensity)
  label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  confidence: number; // 0 to 1
  emotions?: EmotionResult[] | undefined;
  processingTime: number;
}

export interface EmotionResult {
  emotion:
    | 'joy'
    | 'anger'
    | 'fear'
    | 'sadness'
    | 'surprise'
    | 'disgust'
    | 'trust'
    | 'anticipation';
  confidence: number;
  intensity: number;
}

// Intent Classification Models
export interface IntentResult {
  intents: Intent[];
  primaryIntent: Intent;
  confidence: number;
  processingTime: number;
}

export interface Intent {
  category: string;
  confidence: number;
  subcategory?: string | undefined;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  actionRequired: boolean;
}

// Response Generation Models
export interface ResponseSuggestion {
  id: string;
  content: string;
  confidence: number;
  category: 'template' | 'generated' | 'macro';
  tone: 'professional' | 'friendly' | 'empathetic' | 'formal';
  tags: string[];
  macroId?: string;
  reasoning?: string;
  estimatedSatisfaction?: number;
}

export interface ResponseGenerationRequest {
  conversationContext: ConversationContext;
  messageToRespond: Message;
  sentimentAnalysis?: SentimentResult;
  intentAnalysis?: IntentResult;
  agentPreferences?: AgentPreferences;
  constraints?: ResponseConstraints;
}

export interface AgentPreferences {
  tone: 'professional' | 'friendly' | 'empathetic' | 'formal';
  maxLength: number;
  includeTemplates: boolean;
  includeMacros: boolean;
  personalizeResponse: boolean;
}

export interface ResponseConstraints {
  maxSuggestions: number;
  minConfidence: number;
  excludeCategories?: string[];
  requireApproval?: boolean;
  complianceCheck?: boolean;
}

// AI Pipeline Models
export interface AIProcessingResult {
  messageId: string;
  conversationId: string;
  sentiment: SentimentResult;
  intent: IntentResult;
  suggestions: ResponseSuggestion[];
  contextualInsights?: any[]; // From conversation context service
  escalationPrediction?: any; // From escalation prevention service
  processingTime: number;
  timestamp: Date;
  modelVersions: ModelVersions;
}

export interface ModelVersions {
  sentimentModel: string;
  intentModel: string;
  responseModel: string;
}

// Caching Models
export interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: Date;
  expiresAt: Date;
  version: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalEntries: number;
  memoryUsage: number;
}

// Performance Metrics
export interface AIMetrics {
  requestCount: number;
  averageLatency: number;
  p95Latency: number;
  errorRate: number;
  accuracyScore: number;
  throughput: number;
  cacheStats: CacheStats;
  timestamp: Date;
}

export interface ModelPerformance {
  modelName: string;
  version: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  evaluatedAt: Date;
  testSetSize: number;
}

// Error Types
export class AIProcessingError extends Error {
  constructor(
    message: string,
    public code: string,
    public component: 'sentiment' | 'intent' | 'response' | 'pipeline',
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'AIProcessingError';
  }
}

export class ModelLoadError extends AIProcessingError {
  constructor(modelName: string, cause?: Error) {
    super(
      `Failed to load model: ${modelName}. ${cause?.message || ''}`,
      'MODEL_LOAD_ERROR',
      'pipeline',
      false
    );
  }
}

export class TimeoutError extends AIProcessingError {
  constructor(
    component: 'sentiment' | 'intent' | 'response' | 'pipeline',
    timeoutMs: number
  ) {
    super(
      `AI processing timeout after ${timeoutMs}ms`,
      'PROCESSING_TIMEOUT',
      component,
      true
    );
  }
}

export class InsufficientDataError extends AIProcessingError {
  constructor(component: 'sentiment' | 'intent' | 'response' | 'pipeline') {
    super(
      'Insufficient data for AI processing',
      'INSUFFICIENT_DATA',
      component,
      false
    );
  }
}
