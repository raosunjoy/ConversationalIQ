/**
 * AI Service Integration Layer
 * Connects AI processing pipeline with the application's message handling
 */

import { EventEmitter } from 'events';
import { aiPipeline } from '../ai/ai-pipeline';
import {
  AIProcessingResult,
  Message,
  ConversationContext,
  AIProcessingError,
} from '../ai/models';
import { DatabaseService } from './database';
import { publishEvent } from '../graphql/subscriptions';
import { KafkaService, getKafkaService } from '../messaging/kafka';

export class AIService extends EventEmitter {
  private databaseService: DatabaseService;
  private kafkaService: KafkaService;
  private processingQueue: Map<string, Promise<AIProcessingResult>>;

  constructor() {
    super();
    this.databaseService = new DatabaseService();
    this.kafkaService = getKafkaService();
    this.processingQueue = new Map();
  }

  /**
   * Initialize the AI service
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing AI Service...');

      // Initialize AI pipeline
      await aiPipeline.initialize();

      // Set up event listeners
      this.setupEventListeners();

      console.log('AI Service initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize AI Service:', error);
      throw error;
    }
  }

  /**
   * Process a new message through the AI pipeline
   */
  async processMessage(
    messageId: string,
    conversationId: string,
    options: {
      publishEvents?: boolean;
      storeResults?: boolean;
      skipIfProcessed?: boolean;
    } = {}
  ): Promise<AIProcessingResult> {
    const {
      publishEvents = true,
      storeResults = true,
      skipIfProcessed = true,
    } = options;
    const processingKey = `${messageId}:${conversationId}`;

    try {
      // Check if already processing
      if (this.processingQueue.has(processingKey)) {
        return this.processingQueue.get(processingKey)!;
      }

      // Check if already processed (if skipIfProcessed is true)
      if (skipIfProcessed) {
        const existingResult = await this.getStoredResult(messageId);
        if (existingResult) {
          console.log(
            `Message ${messageId} already processed, returning cached result`
          );
          return existingResult;
        }
      }

      // Get message and conversation data
      const messageData = await this.getMessageData(messageId);
      const conversationData = await this.getConversationData(conversationId);

      if (!messageData || !conversationData) {
        throw new AIProcessingError(
          'Message or conversation not found',
          'DATA_NOT_FOUND',
          'pipeline',
          false
        );
      }

      // Create processing promise
      const processingPromise = this.executeAIProcessing(
        messageData,
        conversationData,
        {
          publishEvents,
          storeResults,
        }
      );

      this.processingQueue.set(processingKey, processingPromise);

      try {
        const result = await processingPromise;
        return result;
      } finally {
        this.processingQueue.delete(processingKey);
      }
    } catch (error) {
      this.emit('processingError', {
        messageId,
        conversationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Execute AI processing and handle results
   */
  private async executeAIProcessing(
    message: Message,
    conversation: ConversationContext,
    options: { publishEvents: boolean; storeResults: boolean }
  ): Promise<AIProcessingResult> {
    const startTime = Date.now();

    try {
      // Process through AI pipeline
      const result = await aiPipeline.processMessage(message, conversation);

      // Store results if requested
      if (options.storeResults) {
        await this.storeResults(result);
      }

      // Publish events if requested
      if (options.publishEvents) {
        await this.publishAIEvents(result);
      }

      // Publish to Kafka for downstream processing
      await this.publishKafkaEvents(result);

      const totalTime = Date.now() - startTime;
      console.log(
        `AI processing completed for message ${message.id} in ${totalTime}ms`
      );

      this.emit('messageProcessed', {
        messageId: message.id,
        conversationId: message.conversationId,
        result,
        totalTime,
      });

      return result;
    } catch (error) {
      console.error(`AI processing failed for message ${message.id}:`, error);
      throw error;
    }
  }

  /**
   * Get message data from database
   */
  private async getMessageData(messageId: string): Promise<Message | null> {
    try {
      // Convert database message to AI Message format
      const dbMessage = await this.databaseService.findMessageById(messageId);
      if (!dbMessage) return null;

      return {
        id: dbMessage.id,
        content: dbMessage.content,
        sender:
          (dbMessage as any).senderType === 'AGENT' ? 'AGENT' : 'CUSTOMER',
        timestamp: dbMessage.createdAt,
        conversationId: dbMessage.conversationId,
      };
    } catch (error) {
      console.error(`Failed to get message data for ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Get conversation data from database
   */
  private async getConversationData(
    conversationId: string
  ): Promise<ConversationContext | null> {
    try {
      const conversation =
        await this.databaseService.findConversationById(conversationId);
      if (!conversation) return null;

      const messages =
        await this.databaseService.findMessagesByConversation(conversationId);

      return {
        id: conversation.id,
        messages: messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          sender: (msg as any).senderType === 'AGENT' ? 'AGENT' : 'CUSTOMER',
          timestamp: msg.createdAt,
          conversationId: msg.conversationId,
        })),
        agentId: conversation.agentId || undefined,
        customerId: conversation.customerId,
        ticketId: (conversation as any).zendeskTicketId || conversation.id,
        subject: (conversation as any).subject || undefined,
        status: conversation.status as 'OPEN' | 'PENDING' | 'SOLVED' | 'CLOSED',
      };
    } catch (error) {
      console.error(
        `Failed to get conversation data for ${conversationId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Store AI processing results
   */
  private async storeResults(result: AIProcessingResult): Promise<void> {
    try {
      // TODO: Implement proper AI result storage in database
      // For now, we'll just log that we would store the results

      console.log(`Would store AI results for message ${result.messageId}:`);
      console.log(
        `- Sentiment: ${result.sentiment.label} (${result.sentiment.confidence})`
      );
      console.log(
        `- Intent: ${result.intent.primaryIntent.category} (${result.intent.confidence})`
      );
      console.log(`- Suggestions: ${result.suggestions.length} generated`);

      // In the future, this would call:
      // await this.databaseService.storeSentimentAnalysis(...)
      // await this.databaseService.storeIntentAnalysis(...)
      // await this.databaseService.storeResponseSuggestion(...)

      console.log(`AI results logged for message ${result.messageId}`);
    } catch (error) {
      console.error(
        `Failed to store AI results for message ${result.messageId}:`,
        error
      );
      // Don't throw - this shouldn't fail the entire processing
    }
  }

  /**
   * Publish GraphQL subscription events
   */
  private async publishAIEvents(result: AIProcessingResult): Promise<void> {
    try {
      // Publish sentiment analysis event
      publishEvent.sentimentAnalyzed({
        messageId: result.messageId,
        conversationId: result.conversationId,
        score: result.sentiment.score,
        confidence: result.sentiment.confidence,
        emotions:
          result.sentiment.emotions?.map(e => e.emotion.toString()) || [],
      });

      // Publish response suggestions event
      publishEvent.responseSuggested({
        conversationId: result.conversationId,
        suggestions: result.suggestions.map(s => ({
          id: s.id,
          content: s.content,
          confidence: s.confidence,
          category: s.category,
        })),
      });

      console.log(`Published GraphQL events for message ${result.messageId}`);
    } catch (error) {
      console.error(
        `Failed to publish GraphQL events for message ${result.messageId}:`,
        error
      );
    }
  }

  /**
   * Publish Kafka events for downstream processing
   */
  private async publishKafkaEvents(result: AIProcessingResult): Promise<void> {
    try {
      // For now, just log the events we would publish
      console.log(
        `Would publish Kafka events for message ${result.messageId}:`
      );
      console.log(
        `- Sentiment event: ${result.sentiment.label} (${result.sentiment.confidence})`
      );
      console.log(
        `- Analytics event: AI processing completed in ${result.processingTime}ms`
      );

      // TODO: Implement proper Kafka event publishing when event schemas are finalized
      // await this.kafkaService.publishSentimentEvent({...});
      // await this.kafkaService.publishAnalyticsEvent({...});

      console.log(`Kafka events logged for message ${result.messageId}`);
    } catch (error) {
      console.error(
        `Failed to publish Kafka events for message ${result.messageId}:`,
        error
      );
    }
  }

  /**
   * Get stored AI processing results
   */
  private async getStoredResult(
    messageId: string
  ): Promise<AIProcessingResult | null> {
    try {
      // This would retrieve stored results from database
      // For now, return null to always process
      return null;
    } catch (error) {
      console.error(
        `Failed to get stored result for message ${messageId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Batch process multiple messages
   */
  async processMessages(
    messageIds: string[],
    conversationId: string,
    options?: {
      maxConcurrent?: number;
      publishEvents?: boolean;
      storeResults?: boolean;
    }
  ): Promise<AIProcessingResult[]> {
    const {
      maxConcurrent = 5,
      publishEvents = true,
      storeResults = true,
    } = options || {};
    const results: AIProcessingResult[] = [];

    // Process in chunks to avoid overwhelming the system
    for (let i = 0; i < messageIds.length; i += maxConcurrent) {
      const chunk = messageIds.slice(i, i + maxConcurrent);
      const chunkPromises = chunk.map(messageId =>
        this.processMessage(messageId, conversationId, {
          publishEvents,
          storeResults,
          skipIfProcessed: true,
        }).catch(error => {
          console.error(`Failed to process message ${messageId}:`, error);
          return null;
        })
      );

      const chunkResults = await Promise.all(chunkPromises);
      results.push(
        ...chunkResults.filter(
          (result): result is AIProcessingResult => result !== null
        )
      );
    }

    return results;
  }

  /**
   * Get AI pipeline health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    pipeline: any;
    queue: {
      size: number;
      maxSize: number;
    };
  }> {
    const pipelineHealth = await aiPipeline.getHealth();
    const queueSize = this.processingQueue.size;
    const maxQueueSize = 50; // Reasonable limit

    let status: 'healthy' | 'degraded' | 'unhealthy' = pipelineHealth.status;

    // Degrade status if queue is getting full
    if (queueSize > maxQueueSize * 0.8) {
      status = status === 'healthy' ? 'degraded' : status;
    }

    if (queueSize >= maxQueueSize) {
      status = 'unhealthy';
    }

    return {
      status,
      pipeline: pipelineHealth,
      queue: {
        size: queueSize,
        maxSize: maxQueueSize,
      },
    };
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen to AI pipeline events
    aiPipeline.on('messageProcessed', data => {
      this.emit('aiProcessed', data);
    });

    aiPipeline.on('processingError', data => {
      this.emit('aiError', data);
    });

    aiPipeline.on('cacheHit', data => {
      this.emit('cacheHit', data);
    });
  }

  /**
   * Get processing statistics
   */
  getStats(): {
    queueSize: number;
    pipelineMetrics: any;
    totalProcessed: number;
  } {
    return {
      queueSize: this.processingQueue.size,
      pipelineMetrics: aiPipeline.getMetrics(),
      totalProcessed: 0, // Would track this in real implementation
    };
  }

  /**
   * Shutdown the AI service
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down AI Service...');

    // Wait for queue to empty
    while (this.processingQueue.size > 0) {
      console.log(
        `Waiting for ${this.processingQueue.size} processing operations to complete...`
      );
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Shutdown AI pipeline
    await aiPipeline.shutdown();

    console.log('AI Service shutdown complete');
    this.emit('shutdown');
  }
}

// Export singleton instance
export const aiService = new AIService();
