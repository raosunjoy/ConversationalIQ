/**
 * Sentiment Analysis Service
 * Provides real-time sentiment analysis with emotion detection
 */

import { EventEmitter } from 'events';
import {
  Message,
  SentimentResult,
  EmotionResult,
  AIProcessingError,
  TimeoutError,
} from './models';
import { aiConfig } from './config';

export class SentimentAnalysisService extends EventEmitter {
  private initialized = false;
  private modelVersion = '1.0.0';
  private processingCount = 0;
  private readonly maxConcurrent = 10;

  constructor() {
    super();
  }

  /**
   * Initialize the sentiment analysis service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('Initializing Sentiment Analysis Service...');

      // In a real implementation, this would:
      // 1. Load pre-trained sentiment models
      // 2. Initialize TensorFlow/PyTorch models
      // 3. Download/verify model files
      // 4. Set up model serving infrastructure

      // For now, we'll simulate model loading
      await this.simulateModelLoading();

      this.initialized = true;
      console.log('Sentiment Analysis Service initialized successfully');

      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize Sentiment Analysis Service:', error);
      throw new AIProcessingError(
        'Sentiment analysis service initialization failed',
        'SENTIMENT_INIT_ERROR',
        'sentiment',
        false
      );
    }
  }

  /**
   * Analyze sentiment of a message
   */
  async analyzeMessage(message: Message): Promise<SentimentResult> {
    if (!this.initialized) {
      throw new AIProcessingError(
        'Sentiment analysis service not initialized',
        'SERVICE_NOT_INITIALIZED',
        'sentiment',
        false
      );
    }

    if (this.processingCount >= this.maxConcurrent) {
      throw new AIProcessingError(
        'Too many concurrent sentiment analysis requests',
        'RATE_LIMIT_EXCEEDED',
        'sentiment',
        true
      );
    }

    this.processingCount++;
    const startTime = Date.now();

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new TimeoutError('sentiment', aiConfig.processing.timeoutMs));
        }, aiConfig.processing.timeoutMs);
      });

      // Run sentiment analysis with timeout
      const result = await Promise.race([
        this.performSentimentAnalysis(message),
        timeoutPromise,
      ]);

      const processingTime = Date.now() - startTime;

      this.emit('messageAnalyzed', {
        messageId: message.id,
        result,
        processingTime,
      });

      return {
        ...result,
        processingTime,
      };
    } catch (error) {
      this.emit('analysisError', {
        messageId: message.id,
        error,
      });
      throw error;
    } finally {
      this.processingCount--;
    }
  }

  /**
   * Perform the actual sentiment analysis
   */
  private async performSentimentAnalysis(
    message: Message
  ): Promise<Omit<SentimentResult, 'processingTime'>> {
    const text = message.content.trim();

    if (!text) {
      throw new AIProcessingError(
        'Empty message content',
        'EMPTY_CONTENT',
        'sentiment',
        false
      );
    }

    // Simulate real sentiment analysis processing
    // In a real implementation, this would:
    // 1. Preprocess the text (tokenization, normalization)
    // 2. Run through pre-trained models
    // 3. Post-process results and calculate confidence

    const analysis = await this.simulateSentimentAnalysis(text);

    // Validate results meet confidence threshold
    if (analysis.confidence < aiConfig.sentiment.confidenceThreshold) {
      console.warn(`Low confidence sentiment analysis: ${analysis.confidence}`);
    }

    return analysis;
  }

  /**
   * Simulate sentiment analysis (replace with real ML model)
   */
  private async simulateSentimentAnalysis(
    text: string
  ): Promise<Omit<SentimentResult, 'processingTime'>> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

    // Simple rule-based sentiment analysis for simulation
    const positiveWords = [
      'good',
      'great',
      'excellent',
      'happy',
      'satisfied',
      'love',
      'perfect',
      'amazing',
      'wonderful',
    ];
    const negativeWords = [
      'bad',
      'terrible',
      'awful',
      'hate',
      'angry',
      'frustrated',
      'disappointed',
      'horrible',
      'worst',
    ];
    const urgentWords = [
      'urgent',
      'emergency',
      'asap',
      'immediately',
      'critical',
      'escalate',
    ];

    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);

    let positiveCount = 0;
    let negativeCount = 0;
    let urgentCount = 0;

    words.forEach(word => {
      if (positiveWords.some(pw => word.includes(pw))) positiveCount++;
      if (negativeWords.some(nw => word.includes(nw))) negativeCount++;
      if (urgentWords.some(uw => word.includes(uw))) urgentCount++;
    });

    // Calculate sentiment score
    const totalEmotionalWords = positiveCount + negativeCount;
    let score = 0;
    let magnitude = 0;
    let label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' = 'NEUTRAL';

    if (totalEmotionalWords > 0) {
      score = (positiveCount - negativeCount) / totalEmotionalWords;
      magnitude = totalEmotionalWords / words.length;

      if (score > 0.2) label = 'POSITIVE';
      else if (score < -0.2) label = 'NEGATIVE';
    }

    // Add noise for realism but ensure high accuracy
    const noise = (Math.random() - 0.5) * 0.1;
    score = Math.max(-1, Math.min(1, score + noise));

    const confidence = Math.min(
      0.95,
      0.7 + Math.abs(score) * 0.3 + magnitude * 0.2
    );

    // Generate emotions if enabled
    const emotions: EmotionResult[] = [];
    if (aiConfig.sentiment.enableEmotions) {
      emotions.push(...this.generateEmotions(score, urgentCount, words));
    }

    return {
      score,
      magnitude: Math.max(0, Math.min(1, magnitude + Math.abs(score) * 0.5)),
      label,
      confidence,
      emotions: emotions.length > 0 ? emotions : undefined,
    };
  }

  /**
   * Generate emotion analysis based on sentiment and content
   */
  private generateEmotions(
    score: number,
    urgentCount: number,
    words: string[]
  ): EmotionResult[] {
    const emotions: EmotionResult[] = [];

    // Primary emotion based on sentiment
    if (score > 0.3) {
      emotions.push({
        emotion: 'joy',
        confidence: Math.min(0.9, 0.6 + score * 0.3),
        intensity: Math.min(1, Math.abs(score) + 0.2),
      });
    } else if (score < -0.3) {
      emotions.push({
        emotion: 'anger',
        confidence: Math.min(0.9, 0.6 + Math.abs(score) * 0.3),
        intensity: Math.min(1, Math.abs(score) + 0.2),
      });
    }

    // Urgency emotions
    if (urgentCount > 0) {
      emotions.push({
        emotion: 'anticipation',
        confidence: Math.min(0.8, 0.5 + urgentCount * 0.2),
        intensity: Math.min(1, urgentCount * 0.3),
      });
    }

    // Fear/anxiety detection (simple keyword matching)
    const fearWords = words.filter(word =>
      ['worried', 'concerned', 'afraid', 'scared', 'anxious'].some(fw =>
        word.includes(fw)
      )
    );
    if (fearWords.length > 0) {
      emotions.push({
        emotion: 'fear',
        confidence: Math.min(0.8, 0.6 + fearWords.length * 0.1),
        intensity: Math.min(1, fearWords.length * 0.3),
      });
    }

    return emotions;
  }

  /**
   * Batch analyze multiple messages
   */
  async analyzeMessages(messages: Message[]): Promise<SentimentResult[]> {
    if (messages.length === 0) return [];

    // Process in chunks to avoid overwhelming the service
    const chunkSize = Math.min(this.maxConcurrent, 5);
    const results: SentimentResult[] = [];

    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      const chunkPromises = chunk.map(msg => this.analyzeMessage(msg));
      const chunkResults = await Promise.allSettled(chunkPromises);

      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const message = chunk[index];
          if (message) {
            console.error(
              `Failed to analyze message ${message.id}:`,
              result.reason
            );
            // Add placeholder result for failed analysis
            results.push(this.createErrorResult(message, result.reason));
          }
        }
      });
    }

    return results;
  }

  /**
   * Create error result for failed analysis
   */
  private createErrorResult(message: Message, error: any): SentimentResult {
    return {
      score: 0,
      magnitude: 0,
      label: 'NEUTRAL',
      confidence: 0,
      processingTime: 0,
      emotions: [],
    };
  }

  /**
   * Get sentiment trend for a conversation
   */
  async analyzeTrend(messages: Message[]): Promise<{
    trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
    averageScore: number;
    scoreVariation: number;
    emotionalIntensity: number;
  }> {
    if (messages.length < 2) {
      return {
        trend: 'STABLE',
        averageScore: 0,
        scoreVariation: 0,
        emotionalIntensity: 0,
      };
    }

    const results = await this.analyzeMessages(messages);
    const scores = results.map(r => r.score);
    const magnitudes = results.map(r => r.magnitude);

    const averageScore =
      scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const scoreVariation = this.calculateVariation(scores);
    const emotionalIntensity =
      magnitudes.reduce((sum, mag) => sum + mag, 0) / magnitudes.length;

    // Calculate trend based on recent vs earlier messages
    const mid = Math.floor(scores.length / 2);
    const earlierAvg =
      scores.slice(0, mid).reduce((sum, score) => sum + score, 0) / mid;
    const recentAvg =
      scores.slice(mid).reduce((sum, score) => sum + score, 0) /
      (scores.length - mid);

    let trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
    const trendDiff = recentAvg - earlierAvg;

    if (trendDiff > 0.1) trend = 'IMPROVING';
    else if (trendDiff < -0.1) trend = 'DECLINING';
    else trend = 'STABLE';

    return {
      trend,
      averageScore,
      scoreVariation,
      emotionalIntensity,
    };
  }

  /**
   * Calculate variation in scores
   */
  private calculateVariation(scores: number[]): number {
    if (scores.length < 2) return 0;

    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance =
      scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
      scores.length;

    return Math.sqrt(variance);
  }

  /**
   * Simulate model loading
   */
  private async simulateModelLoading(): Promise<void> {
    // Simulate model loading time
    await new Promise(resolve =>
      setTimeout(resolve, 500 + Math.random() * 1000)
    );

    // Simulate potential loading failures (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Failed to load sentiment analysis model');
    }
  }

  /**
   * Check if service is healthy
   */
  async isHealthy(): Promise<boolean> {
    return this.initialized && this.processingCount < this.maxConcurrent;
  }

  /**
   * Get model version
   */
  getVersion(): string {
    return this.modelVersion;
  }

  /**
   * Get processing statistics
   */
  getStats(): {
    initialized: boolean;
    currentProcessing: number;
    maxConcurrent: number;
    modelVersion: string;
  } {
    return {
      initialized: this.initialized,
      currentProcessing: this.processingCount,
      maxConcurrent: this.maxConcurrent,
      modelVersion: this.modelVersion,
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down Sentiment Analysis Service...');

    // Wait for current processing to complete
    while (this.processingCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.initialized = false;
    this.emit('shutdown');
    console.log('Sentiment Analysis Service shutdown complete');
  }
}
