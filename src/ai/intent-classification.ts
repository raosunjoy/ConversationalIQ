/**
 * Intent Classification Service
 * Provides real-time intent classification for customer service messages
 */

import { EventEmitter } from 'events';
import {
  Message,
  ConversationContext,
  IntentResult,
  Intent,
  AIProcessingError,
  TimeoutError,
} from './models';
import { aiConfig } from './config';

export class IntentClassificationService extends EventEmitter {
  private initialized = false;
  private modelVersion = '1.0.0';
  private processingCount = 0;
  private readonly maxConcurrent = 10;
  private intentCategories: string[];
  private intentPatterns: Map<string, RegExp[]>;

  constructor() {
    super();
    this.intentCategories = aiConfig.intent.categories;
    this.intentPatterns = new Map();
    this.initializeIntentPatterns();
  }

  /**
   * Initialize intent patterns for classification
   */
  private initializeIntentPatterns(): void {
    // Define keyword patterns for each intent category
    const patterns = {
      complaint: [
        /\b(complain|complaint|issue|problem|dissatisfied|unhappy|disappointed)\b/i,
        /\b(not working|broken|failed|error|bug|glitch)\b/i,
        /\b(terrible|awful|horrible|worst|bad experience)\b/i,
      ],
      question: [
        /\b(how|what|when|where|why|which|can you|could you|would you)\b/i,
        /\b(question|ask|wondering|curious|clarify|explain)\b/i,
        /\?\s*$/,
      ],
      request: [
        /\b(please|could you|can you|would you|help me|assist|need)\b/i,
        /\b(want|would like|looking for|need to|require)\b/i,
        /\b(request|asking for|hoping|expecting)\b/i,
      ],
      compliment: [
        /\b(thank|thanks|great|excellent|amazing|wonderful|fantastic)\b/i,
        /\b(good job|well done|impressed|satisfied|happy|love)\b/i,
        /\b(appreciate|grateful|perfect|outstanding)\b/i,
      ],
      urgent: [
        /\b(urgent|emergency|asap|immediately|critical|priority)\b/i,
        /\b(escalate|manager|supervisor|rush|time sensitive)\b/i,
        /\b(can't wait|need now|right away|quickly)\b/i,
      ],
      billing: [
        /\b(bill|billing|invoice|payment|charge|cost|price|fee)\b/i,
        /\b(refund|credit|money|account|subscription|plan)\b/i,
        /\b(overcharged|discount|promotion|pricing)\b/i,
      ],
      technical: [
        /\b(technical|tech|system|software|app|website|login)\b/i,
        /\b(error|bug|crash|freeze|loading|connection|internet)\b/i,
        /\b(install|update|configure|setup|troubleshoot)\b/i,
      ],
      cancellation: [
        /\b(cancel|cancellation|terminate|end|stop|discontinue)\b/i,
        /\b(unsubscribe|opt out|remove|delete|close account)\b/i,
        /\b(don't want|no longer need|quit|leave)\b/i,
      ],
      upgrade: [
        /\b(upgrade|improve|enhance|better|premium|pro)\b/i,
        /\b(more features|additional|expand|increase|higher plan)\b/i,
        /\b(enterprise|business|professional)\b/i,
      ],
      information: [
        /\b(information|info|details|explain|tell me|learn)\b/i,
        /\b(how it works|what is|documentation|guide|tutorial)\b/i,
        /\b(status|progress|update|notification)\b/i,
      ],
      feedback: [
        /\b(feedback|suggestion|recommend|improve|better)\b/i,
        /\b(feature request|enhancement|idea|opinion)\b/i,
        /\b(survey|review|rating|comment)\b/i,
      ],
      escalation: [
        /\b(escalate|manager|supervisor|senior|higher level)\b/i,
        /\b(not satisfied|not resolved|still having|continues)\b/i,
        /\b(speak to|transfer|escalation|complaint)\b/i,
      ],
      refund: [
        /\b(refund|money back|return|reimbursement|credit)\b/i,
        /\b(wrong charge|unauthorized|dispute|chargeback)\b/i,
        /\b(didn't receive|not delivered|damaged|defective)\b/i,
      ],
      support: [
        /\b(help|support|assistance|guide|walk through)\b/i,
        /\b(stuck|confused|lost|don't understand|unclear)\b/i,
        /\b(tutorial|documentation|how to|step by step)\b/i,
      ],
      other: [/\b(misc|miscellaneous|general|other|different)\b/i],
    };

    // Convert patterns to RegExp objects
    Object.entries(patterns).forEach(([intent, regexList]) => {
      this.intentPatterns.set(intent, regexList);
    });
  }

  /**
   * Initialize the intent classification service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('Initializing Intent Classification Service...');

      // In a real implementation, this would:
      // 1. Load pre-trained intent classification models
      // 2. Initialize zero-shot classification models
      // 3. Load custom intent taxonomies
      // 4. Set up model serving infrastructure

      await this.simulateModelLoading();

      this.initialized = true;
      console.log('Intent Classification Service initialized successfully');

      this.emit('initialized');
    } catch (error) {
      console.error(
        'Failed to initialize Intent Classification Service:',
        error
      );
      throw new AIProcessingError(
        'Intent classification service initialization failed',
        'INTENT_INIT_ERROR',
        'intent',
        false
      );
    }
  }

  /**
   * Classify intent of a message
   */
  async classifyMessage(
    message: Message,
    conversationContext?: ConversationContext
  ): Promise<IntentResult> {
    if (!this.initialized) {
      throw new AIProcessingError(
        'Intent classification service not initialized',
        'SERVICE_NOT_INITIALIZED',
        'intent',
        false
      );
    }

    if (this.processingCount >= this.maxConcurrent) {
      throw new AIProcessingError(
        'Too many concurrent intent classification requests',
        'RATE_LIMIT_EXCEEDED',
        'intent',
        true
      );
    }

    this.processingCount++;
    const startTime = Date.now();

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new TimeoutError('intent', aiConfig.processing.timeoutMs));
        }, aiConfig.processing.timeoutMs);
      });

      // Run intent classification with timeout
      const result = await Promise.race([
        this.performIntentClassification(message, conversationContext),
        timeoutPromise,
      ]);

      const processingTime = Date.now() - startTime;

      this.emit('messageClassified', {
        messageId: message.id,
        result,
        processingTime,
      });

      return {
        ...result,
        processingTime,
      };
    } catch (error) {
      this.emit('classificationError', {
        messageId: message.id,
        error,
      });
      throw error;
    } finally {
      this.processingCount--;
    }
  }

  /**
   * Perform the actual intent classification
   */
  private async performIntentClassification(
    message: Message,
    conversationContext?: ConversationContext
  ): Promise<Omit<IntentResult, 'processingTime'>> {
    const text = message.content.trim();

    if (!text) {
      throw new AIProcessingError(
        'Empty message content',
        'EMPTY_CONTENT',
        'intent',
        false
      );
    }

    // Simulate real intent classification processing
    const analysis = await this.simulateIntentClassification(
      text,
      conversationContext
    );

    // Validate results meet confidence threshold
    if (analysis.confidence < aiConfig.intent.confidenceThreshold) {
      console.warn(
        `Low confidence intent classification: ${analysis.confidence}`
      );
    }

    return analysis;
  }

  /**
   * Simulate intent classification (replace with real ML model)
   */
  private async simulateIntentClassification(
    text: string,
    conversationContext?: ConversationContext
  ): Promise<Omit<IntentResult, 'processingTime'>> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 70));

    const lowerText = text.toLowerCase();
    const intentScores: Map<string, number> = new Map();

    // Score each intent based on pattern matching
    this.intentPatterns.forEach((patterns, intent) => {
      let score = 0;
      patterns.forEach(pattern => {
        const matches = (lowerText.match(pattern) || []).length;
        score += matches * 0.3; // Each match adds to confidence
      });

      if (score > 0) {
        // Add context bonus
        if (conversationContext) {
          score += this.calculateContextBonus(intent, conversationContext);
        }

        // Normalize score
        score = Math.min(1.0, score);
        intentScores.set(intent, score);
      }
    });

    // Get top intents
    const sortedIntents = Array.from(intentScores.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, aiConfig.intent.maxIntentsPerMessage);

    if (sortedIntents.length === 0) {
      // Default to 'other' if no patterns match
      sortedIntents.push(['other', 0.5]);
    }

    // Create intent objects
    const intents: Intent[] = sortedIntents.map(([category, confidence]) => ({
      category,
      confidence: Math.min(0.95, confidence + Math.random() * 0.1), // Add some variation
      subcategory: this.getSubcategory(category, text),
      urgency: this.calculateUrgency(category, text),
      actionRequired: this.requiresAction(category),
    }));

    const primaryIntent = intents[0] || {
      category: 'other',
      confidence: 0.5,
      subcategory: undefined,
      urgency: 'LOW' as const,
      actionRequired: false,
    };
    const overallConfidence = this.calculateOverallConfidence(intents);

    return {
      intents,
      primaryIntent,
      confidence: overallConfidence,
    };
  }

  /**
   * Calculate context bonus based on conversation history
   */
  private calculateContextBonus(
    intent: string,
    context: ConversationContext
  ): number {
    let bonus = 0;

    // Priority bonus
    if (context.priority === 'URGENT' && intent === 'urgent') bonus += 0.2;
    if (
      context.priority === 'HIGH' &&
      ['urgent', 'escalation', 'complaint'].includes(intent)
    )
      bonus += 0.1;

    // Status bonus
    if (
      context.status === 'OPEN' &&
      ['request', 'question', 'support'].includes(intent)
    )
      bonus += 0.1;
    if (
      context.status === 'PENDING' &&
      ['escalation', 'complaint', 'urgent'].includes(intent)
    )
      bonus += 0.15;

    // Tags bonus
    if (context.tags) {
      context.tags.forEach(tag => {
        const tagLower = tag.toLowerCase();
        if (tagLower.includes('billing') && intent === 'billing') bonus += 0.1;
        if (tagLower.includes('technical') && intent === 'technical')
          bonus += 0.1;
        if (tagLower.includes('refund') && intent === 'refund') bonus += 0.1;
      });
    }

    // Recent message history bonus
    if (context.messages.length > 1) {
      const recentMessages = context.messages.slice(-3);
      const recentText = recentMessages
        .map(m => m.content.toLowerCase())
        .join(' ');

      if (intent === 'escalation' && recentMessages.length >= 2) {
        // Multiple back-and-forth messages suggest escalation
        bonus += 0.1;
      }

      if (intent === 'complaint' && recentText.includes('not satisfied')) {
        bonus += 0.15;
      }
    }

    return Math.min(0.3, bonus); // Cap bonus at 0.3
  }

  /**
   * Get subcategory for more specific classification
   */
  private getSubcategory(category: string, text: string): string | undefined {
    const lowerText = text.toLowerCase();

    const subcategories: Record<string, Record<string, string[]>> = {
      billing: {
        payment_issue: ['payment', 'card', 'declined', 'failed'],
        overcharge: ['overcharged', 'wrong amount', 'incorrect charge'],
        invoice: ['invoice', 'bill', 'statement', 'receipt'],
      },
      technical: {
        login_issue: ['login', 'password', 'access', 'sign in'],
        performance: ['slow', 'loading', 'crash', 'freeze'],
        integration: ['api', 'integration', 'connection', 'sync'],
      },
      request: {
        feature_request: ['feature', 'enhancement', 'add', 'new'],
        information: ['information', 'details', 'explain', 'how'],
        access: ['access', 'permission', 'enable', 'unlock'],
      },
    };

    if (subcategories[category]) {
      for (const [subcat, keywords] of Object.entries(
        subcategories[category]
      )) {
        if (keywords.some(keyword => lowerText.includes(keyword))) {
          return subcat;
        }
      }
    }

    return undefined;
  }

  /**
   * Calculate urgency level based on intent and content
   */
  private calculateUrgency(
    category: string,
    text: string
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
    const lowerText = text.toLowerCase();

    // Urgent keywords
    const urgentKeywords = [
      'urgent',
      'emergency',
      'asap',
      'immediately',
      'critical',
    ];
    const hasUrgentKeywords = urgentKeywords.some(keyword =>
      lowerText.includes(keyword)
    );

    if (hasUrgentKeywords || category === 'urgent') return 'URGENT';

    // High priority intents
    const highPriorityIntents = [
      'complaint',
      'escalation',
      'technical',
      'billing',
    ];
    if (highPriorityIntents.includes(category)) return 'HIGH';

    // Medium priority intents
    const mediumPriorityIntents = [
      'request',
      'support',
      'cancellation',
      'refund',
    ];
    if (mediumPriorityIntents.includes(category)) return 'MEDIUM';

    return 'LOW';
  }

  /**
   * Determine if intent requires action
   */
  private requiresAction(category: string): boolean {
    const actionRequiredIntents = [
      'complaint',
      'request',
      'technical',
      'billing',
      'urgent',
      'escalation',
      'cancellation',
      'refund',
      'support',
    ];

    return actionRequiredIntents.includes(category);
  }

  /**
   * Calculate overall confidence from multiple intents
   */
  private calculateOverallConfidence(intents: Intent[]): number {
    if (intents.length === 0) return 0;

    // Weight primary intent more heavily
    const primaryWeight = 0.7;
    const secondaryWeight = 0.3;

    let confidence = (intents[0]?.confidence || 0) * primaryWeight;

    if (intents.length > 1) {
      const secondaryAvg =
        intents.slice(1).reduce((sum, intent) => sum + intent.confidence, 0) /
        (intents.length - 1);
      confidence += secondaryAvg * secondaryWeight;
    }

    return Math.min(0.95, confidence);
  }

  /**
   * Batch classify multiple messages
   */
  async classifyMessages(
    messages: Message[],
    conversationContext?: ConversationContext
  ): Promise<IntentResult[]> {
    if (messages.length === 0) return [];

    // Process in chunks to avoid overwhelming the service
    const chunkSize = Math.min(this.maxConcurrent, 5);
    const results: IntentResult[] = [];

    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      const chunkPromises = chunk.map(msg =>
        this.classifyMessage(msg, conversationContext)
      );
      const chunkResults = await Promise.allSettled(chunkPromises);

      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const message = chunk[index];
          if (message) {
            console.error(
              `Failed to classify message ${message.id}:`,
              result.reason
            );
            // Add placeholder result for failed classification
            results.push(this.createErrorResult(message, result.reason));
          }
        }
      });
    }

    return results;
  }

  /**
   * Create error result for failed classification
   */
  private createErrorResult(message: Message, error: any): IntentResult {
    const defaultIntent: Intent = {
      category: 'other',
      confidence: 0,
      urgency: 'LOW',
      actionRequired: false,
    };

    return {
      intents: [defaultIntent],
      primaryIntent: defaultIntent,
      confidence: 0,
      processingTime: 0,
    };
  }

  /**
   * Get intent distribution for conversation analysis
   */
  async analyzeConversationIntents(messages: Message[]): Promise<{
    intentDistribution: Record<string, number>;
    primaryIntents: string[];
    urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    actionableMessages: number;
    averageConfidence: number;
  }> {
    if (messages.length === 0) {
      return {
        intentDistribution: {},
        primaryIntents: [],
        urgencyLevel: 'LOW',
        actionableMessages: 0,
        averageConfidence: 0,
      };
    }

    const results = await this.classifyMessages(messages);
    const intentCounts: Record<string, number> = {};
    const urgencyLevels: string[] = [];
    let actionableCount = 0;
    let totalConfidence = 0;

    results.forEach(result => {
      // Count primary intents
      const primaryIntent = result.primaryIntent.category;
      intentCounts[primaryIntent] = (intentCounts[primaryIntent] || 0) + 1;

      // Collect urgency levels
      urgencyLevels.push(result.primaryIntent.urgency);

      // Count actionable messages
      if (result.primaryIntent.actionRequired) {
        actionableCount++;
      }

      // Sum confidence
      totalConfidence += result.confidence;
    });

    // Calculate intent distribution as percentages
    const totalMessages = results.length;
    const intentDistribution: Record<string, number> = {};
    Object.entries(intentCounts).forEach(([intent, count]) => {
      intentDistribution[intent] = count / totalMessages;
    });

    // Get primary intents (top 3)
    const primaryIntents = Object.entries(intentCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([intent]) => intent);

    // Determine overall urgency level
    const urgencyPriority = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const maxUrgency = Math.max(
      ...urgencyLevels.map(
        u => urgencyPriority[u as keyof typeof urgencyPriority]
      )
    );
    const urgencyLevel = Object.keys(urgencyPriority).find(
      key => urgencyPriority[key as keyof typeof urgencyPriority] === maxUrgency
    ) as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

    return {
      intentDistribution,
      primaryIntents,
      urgencyLevel,
      actionableMessages: actionableCount,
      averageConfidence: totalConfidence / totalMessages,
    };
  }

  /**
   * Simulate model loading
   */
  private async simulateModelLoading(): Promise<void> {
    // Simulate model loading time
    await new Promise(resolve =>
      setTimeout(resolve, 300 + Math.random() * 700)
    );

    // Simulate potential loading failures (3% chance)
    if (Math.random() < 0.03) {
      throw new Error('Failed to load intent classification model');
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
    supportedCategories: string[];
  } {
    return {
      initialized: this.initialized,
      currentProcessing: this.processingCount,
      maxConcurrent: this.maxConcurrent,
      modelVersion: this.modelVersion,
      supportedCategories: this.intentCategories,
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down Intent Classification Service...');

    // Wait for current processing to complete
    while (this.processingCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.initialized = false;
    this.emit('shutdown');
    console.log('Intent Classification Service shutdown complete');
  }
}
