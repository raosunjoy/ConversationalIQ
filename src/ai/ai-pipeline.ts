/**
 * AI Processing Pipeline
 * Orchestrates sentiment analysis, intent classification, and response generation
 */

import { EventEmitter } from 'events';
import {
  AIProcessingResult,
  Message,
  ConversationContext,
  AIProcessingError,
  TimeoutError,
  ModelVersions,
  AIMetrics,
  CacheStats,
} from './models';
import { SentimentAnalysisService } from './sentiment-analysis';
import { IntentClassificationService } from './intent-classification';
import { ResponseGenerationService } from './response-generation';
import { aiConfig, AIConfig } from './config';

export class AIPipeline extends EventEmitter {
  private sentimentService: SentimentAnalysisService;
  private intentService: IntentClassificationService;
  private responseService: ResponseGenerationService;
  private config: AIConfig;
  private metrics: AIMetrics;
  private processing: Map<string, Promise<AIProcessingResult>>;
  private cache: Map<string, any>;

  constructor() {
    super();
    this.config = aiConfig;
    this.sentimentService = new SentimentAnalysisService();
    this.intentService = new IntentClassificationService();
    this.responseService = new ResponseGenerationService();
    this.processing = new Map();
    this.cache = new Map();
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize the AI pipeline and load all models
   */
  async initialize(): Promise<void> {
    const startTime = Date.now();

    try {
      console.log('Initializing AI Pipeline...');

      // Initialize services in parallel for faster startup
      const initPromises = [
        this.sentimentService.initialize(),
        this.intentService.initialize(),
        this.responseService.initialize(),
      ];

      await Promise.all(initPromises);

      const initTime = Date.now() - startTime;
      console.log(`AI Pipeline initialized successfully in ${initTime}ms`);

      this.emit('initialized', { initTime });
    } catch (error) {
      console.error('Failed to initialize AI Pipeline:', error);
      this.emit('error', error);
      throw new AIProcessingError(
        'AI Pipeline initialization failed',
        'INITIALIZATION_ERROR',
        'pipeline',
        false
      );
    }
  }

  /**
   * Process a message through the complete AI pipeline
   */
  async processMessage(
    message: Message,
    conversationContext: ConversationContext
  ): Promise<AIProcessingResult> {
    const startTime = Date.now();
    const messageKey = `${message.id}:${message.conversationId}`;

    // Check if already processing this message
    if (this.processing.has(messageKey)) {
      return this.processing.get(messageKey)!;
    }

    // Check cache first
    const cacheKey = this.generateCacheKey(message);
    if (this.config.processing.enableCaching && this.cache.has(cacheKey)) {
      const cachedResult = this.cache.get(cacheKey);
      if (!this.isCacheExpired(cachedResult)) {
        this.metrics.cacheStats.hits++;
        this.emit('cacheHit', { messageId: message.id });
        return cachedResult.data;
      }
    }

    // Create processing promise
    const processingPromise = this.executeProcessing(
      message,
      conversationContext,
      startTime
    );
    this.processing.set(messageKey, processingPromise);

    try {
      const result = await processingPromise;

      // Cache the result
      if (this.config.processing.enableCaching) {
        this.cacheResult(cacheKey, result);
      }

      return result;
    } finally {
      this.processing.delete(messageKey);
    }
  }

  /**
   * Execute the complete AI processing pipeline
   */
  private async executeProcessing(
    message: Message,
    conversationContext: ConversationContext,
    startTime: number
  ): Promise<AIProcessingResult> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError('pipeline', this.config.processing.timeoutMs));
      }, this.config.processing.timeoutMs);
    });

    try {
      const result = await Promise.race([
        this.runPipelineStages(message, conversationContext),
        timeoutPromise,
      ]);

      const processingTime = Date.now() - startTime;

      // Update metrics
      this.updateMetrics(processingTime, true);

      // Emit events
      this.emit('messageProcessed', {
        messageId: message.id,
        processingTime,
        result,
      });

      return {
        ...result,
        processingTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, false);

      this.emit('processingError', {
        messageId: message.id,
        error,
        processingTime,
      });

      throw error;
    }
  }

  /**
   * Run all pipeline stages (sentiment, intent, response generation)
   */
  private async runPipelineStages(
    message: Message,
    conversationContext: ConversationContext
  ): Promise<Omit<AIProcessingResult, 'processingTime' | 'timestamp'>> {
    // Stage 1: Sentiment Analysis (runs independently)
    const sentimentPromise = this.sentimentService.analyzeMessage(message);

    // Stage 2: Intent Classification (can run in parallel with sentiment)
    const intentPromise = this.intentService.classifyMessage(
      message,
      conversationContext
    );

    // Wait for sentiment and intent analysis to complete
    const [sentiment, intent] = await Promise.all([
      sentimentPromise,
      intentPromise,
    ]);

    // Stage 3: Response Generation (depends on sentiment and intent)
    const suggestions = await this.responseService.generateSuggestions({
      conversationContext,
      messageToRespond: message,
      sentimentAnalysis: sentiment,
      intentAnalysis: intent,
    });

    return {
      messageId: message.id,
      conversationId: message.conversationId,
      sentiment,
      intent,
      suggestions,
      modelVersions: this.getModelVersions(),
    };
  }

  /**
   * Get current model versions
   */
  private getModelVersions(): ModelVersions {
    return {
      sentimentModel: this.sentimentService.getVersion(),
      intentModel: this.intentService.getVersion(),
      responseModel: this.responseService.getVersion(),
    };
  }

  /**
   * Generate cache key for a message
   */
  private generateCacheKey(message: Message): string {
    // Include content hash and model versions for cache invalidation
    const content = message.content.toLowerCase().trim();
    const versions = this.getModelVersions();
    return `msg:${Buffer.from(content).toString('base64')}:${versions.sentimentModel}:${versions.intentModel}`;
  }

  /**
   * Check if cache entry is expired
   */
  private isCacheExpired(cacheEntry: any): boolean {
    return new Date() > cacheEntry.expiresAt;
  }

  /**
   * Cache processing result
   */
  private cacheResult(key: string, result: AIProcessingResult): void {
    const expiresAt = new Date(
      Date.now() + this.config.sentiment.cacheTimeout * 1000
    );
    this.cache.set(key, {
      data: result,
      timestamp: new Date(),
      expiresAt,
    });

    // Cleanup expired entries periodically
    if (this.cache.size % 100 === 0) {
      this.cleanupCache();
    }
  }

  /**
   * Remove expired cache entries
   */
  private cleanupCache(): void {
    const now = new Date();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(processingTime: number, success: boolean): void {
    this.metrics.requestCount++;

    if (success) {
      // Update average latency (rolling average)
      this.metrics.averageLatency =
        (this.metrics.averageLatency * (this.metrics.requestCount - 1) +
          processingTime) /
        this.metrics.requestCount;

      // Update p95 latency (simplified - would need proper percentile calculation)
      if (processingTime > this.metrics.p95Latency) {
        this.metrics.p95Latency = processingTime;
      }
    } else {
      // Update error rate
      const errorCount = this.metrics.requestCount * this.metrics.errorRate + 1;
      this.metrics.errorRate = errorCount / this.metrics.requestCount;
    }

    // Update throughput (requests per second)
    this.metrics.throughput =
      this.metrics.requestCount /
      ((Date.now() - this.metrics.timestamp.getTime()) / 1000);

    // Update cache stats
    this.metrics.cacheStats = this.getCacheStats();
  }

  /**
   * Get current cache statistics
   */
  private getCacheStats(): CacheStats {
    const totalRequests =
      this.metrics.cacheStats.hits + this.metrics.cacheStats.misses;
    return {
      hits: this.metrics.cacheStats.hits,
      misses: this.metrics.cacheStats.misses,
      hitRate:
        totalRequests > 0 ? this.metrics.cacheStats.hits / totalRequests : 0,
      totalEntries: this.cache.size,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  /**
   * Estimate cache memory usage
   */
  private estimateMemoryUsage(): number {
    // Rough estimation - would use proper memory profiling in production
    return this.cache.size * 1024; // Assume 1KB per cached entry
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): AIMetrics {
    return {
      requestCount: 0,
      averageLatency: 0,
      p95Latency: 0,
      errorRate: 0,
      accuracyScore: 0,
      throughput: 0,
      cacheStats: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalEntries: 0,
        memoryUsage: 0,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): AIMetrics {
    return { ...this.metrics };
  }

  /**
   * Get health status of the AI pipeline
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, boolean>;
    metrics: AIMetrics;
  }> {
    const components = {
      sentiment: await this.sentimentService.isHealthy(),
      intent: await this.intentService.isHealthy(),
      response: await this.responseService.isHealthy(),
      cache: this.cache.size < 10000, // Simple cache health check
      pipeline: this.processing.size < this.config.processing.maxConcurrent,
    };

    const healthyComponents = Object.values(components).filter(Boolean).length;
    const totalComponents = Object.keys(components).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyComponents === totalComponents) {
      status = 'healthy';
    } else if (healthyComponents >= totalComponents / 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      components,
      metrics: this.getMetrics(),
    };
  }

  /**
   * Shutdown the AI pipeline gracefully
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down AI Pipeline...');

    // Wait for pending processing to complete (with timeout)
    const pendingPromises = Array.from(this.processing.values());
    if (pendingPromises.length > 0) {
      console.log(
        `Waiting for ${pendingPromises.length} pending operations...`
      );

      const timeoutPromise = new Promise<void>(resolve => {
        setTimeout(resolve, 5000); // 5 second timeout
      });

      await Promise.race([Promise.allSettled(pendingPromises), timeoutPromise]);
    }

    // Shutdown services
    await Promise.all([
      this.sentimentService.shutdown(),
      this.intentService.shutdown(),
      this.responseService.shutdown(),
    ]);

    // Clear cache and processing maps
    this.cache.clear();
    this.processing.clear();

    console.log('AI Pipeline shutdown complete');
    this.emit('shutdown');
  }
}

// Export singleton instance
export const aiPipeline = new AIPipeline();
