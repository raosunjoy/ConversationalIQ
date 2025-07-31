/**
 * Apache Kafka integration for ConversationIQ
 * Handles event-driven messaging and real-time event processing
 */

import { Kafka, KafkaConfig, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';

// Kafka topic configuration
export const KAFKA_TOPICS = {
  CONVERSATION_EVENTS: 'conversation-events',
  MESSAGE_EVENTS: 'message-events',
  SENTIMENT_EVENTS: 'sentiment-events',
  AGENT_EVENTS: 'agent-events',
  WEBHOOK_EVENTS: 'webhook-events',
  ANALYTICS_EVENTS: 'analytics-events',
} as const;

// Event types for different message categories
export interface ConversationEvent {
  type: 'CONVERSATION_CREATED' | 'CONVERSATION_UPDATED' | 'CONVERSATION_CLOSED';
  conversationId: string;
  ticketId: string;
  agentId?: string;
  customerId: string;
  status: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface MessageEvent {
  type: 'MESSAGE_CREATED' | 'MESSAGE_UPDATED';
  messageId: string;
  conversationId: string;
  content: string;
  sender: 'AGENT' | 'CUSTOMER';
  sentimentScore?: number;
  detectedIntent?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface SentimentEvent {
  type: 'SENTIMENT_ANALYZED' | 'SENTIMENT_ALERT';
  conversationId: string;
  messageId: string;
  sentimentScore: number;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  confidence: number;
  escalationRisk?: number;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface AgentEvent {
  type: 'AGENT_STATUS_CHANGED' | 'AGENT_PERFORMANCE_UPDATE';
  agentId: string;
  status?: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY';
  performanceMetrics?: Record<string, number>;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface WebhookEvent {
  type: 'ZENDESK_WEBHOOK' | 'WEBHOOK_RETRY' | 'WEBHOOK_FAILED';
  source: string;
  eventType: string;
  payload: Record<string, any>;
  retryCount?: number;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface AnalyticsEvent {
  type: 'ANALYTICS_COMPUTED' | 'METRICS_UPDATED';
  agentId?: string;
  conversationId?: string;
  metricType: string;
  value: number;
  aggregationType: 'SUM' | 'AVG' | 'COUNT' | 'MAX' | 'MIN';
  timeWindow: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

// Union type for all event types
export type KafkaEvent = 
  | ConversationEvent 
  | MessageEvent 
  | SentimentEvent 
  | AgentEvent 
  | WebhookEvent 
  | AnalyticsEvent;

/**
 * Kafka service for managing message production and consumption
 */
export class KafkaService {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumers: Map<string, Consumer> = new Map();
  private isConnected = false;

  constructor(config?: Partial<KafkaConfig>) {
    // Default Kafka configuration
    const defaultConfig: any = {
      clientId: 'conversationiq',
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      ssl: process.env.KAFKA_SSL === 'true',
      sasl: process.env.KAFKA_SASL_MECHANISM ? {
        mechanism: process.env.KAFKA_SASL_MECHANISM as any,
        username: process.env.KAFKA_SASL_USERNAME!,
        password: process.env.KAFKA_SASL_PASSWORD!,
      } : undefined,
      connectionTimeout: 30000,
      requestTimeout: 30000,
      retry: {
        initialRetryTime: 300,
        retries: 8,
      },
    };

    this.kafka = new Kafka({ ...defaultConfig, ...config });
  }

  /**
   * Initialize Kafka producer and create topics
   */
  async initialize(): Promise<void> {
    try {
      // Create producer
      this.producer = this.kafka.producer({
        maxInFlightRequests: 1,
        idempotent: true,
        transactionTimeout: 30000,
        retry: {
          initialRetryTime: 300,
          retries: 8,
        },
      });

      await this.producer.connect();

      // Create admin client to manage topics
      const admin = this.kafka.admin();
      await admin.connect();

      // Create topics if they don't exist
      const topicConfigs = Object.values(KAFKA_TOPICS).map(topic => ({
        topic,
        numPartitions: parseInt(process.env.KAFKA_PARTITIONS || '3'),
        replicationFactor: parseInt(process.env.KAFKA_REPLICATION_FACTOR || '1'),
        configEntries: [
          { name: 'cleanup.policy', value: 'delete' },
          { name: 'retention.ms', value: '604800000' }, // 7 days
          { name: 'segment.ms', value: '86400000' }, // 1 day
        ],
      }));

      try {
        await admin.createTopics({
          topics: topicConfigs,
          waitForLeaders: true,
          timeout: 10000,
        });
        console.log('✅ Kafka topics created successfully');
      } catch (error: any) {
        // Topics might already exist, which is fine
        if (!error.message.includes('already exists')) {
          throw error;
        }
        console.log('📝 Kafka topics already exist');
      }

      await admin.disconnect();

      this.isConnected = true;
      console.log('🚀 Kafka service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Kafka service:', error);
      throw error;
    }
  }

  /**
   * Publish an event to a Kafka topic
   */
  async publishEvent(topic: string, event: KafkaEvent, key?: string): Promise<void> {
    if (!this.producer || !this.isConnected) {
      throw new Error('Kafka service not initialized. Call initialize() first.');
    }

    try {
      const messageKey = key || (event as any).conversationId || (event as any).messageId || uuidv4();
      
      await this.producer.send({
        topic,
        messages: [{
          key: messageKey,
          value: JSON.stringify(event),
          timestamp: Date.now().toString(),
          headers: {
            'event-type': event.type,
            'event-id': uuidv4(),
            'source': 'conversationiq',
          },
        }],
      });

      console.log(`📨 Event published to ${topic}:`, event.type);
    } catch (error) {
      console.error(`❌ Failed to publish event to ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to a Kafka topic and process messages
   */
  async subscribe(
    topic: string,
    groupId: string,
    handler: (event: KafkaEvent, metadata: { partition: number; offset: string }) => Promise<void>,
    options?: {
      fromBeginning?: boolean;
      sessionTimeout?: number;
      heartbeatInterval?: number;
    }
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka service not initialized. Call initialize() first.');
    }

    const consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: options?.sessionTimeout || 30000,
      heartbeatInterval: options?.heartbeatInterval || 3000,
      maxWaitTimeInMs: 5000,
      retry: {
        initialRetryTime: 300,
        retries: 8,
      },
    });

    await consumer.connect();
    await consumer.subscribe({ 
      topic, 
      fromBeginning: options?.fromBeginning || false 
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
        try {
          if (!message.value) {
            console.warn('⚠️ Received empty message, skipping');
            return;
          }

          const event = JSON.parse(message.value.toString()) as KafkaEvent;
          const metadata = {
            partition,
            offset: message.offset,
          };

          await handler(event, metadata);
        } catch (error) {
          console.error(`❌ Error processing message from ${topic}:`, error);
          // Could implement dead letter queue here
          throw error;
        }
      },
    });

    this.consumers.set(`${topic}-${groupId}`, consumer);
    console.log(`🔔 Subscribed to topic ${topic} with group ${groupId}`);
  }

  /**
   * Publish conversation-related events
   */
  async publishConversationEvent(event: ConversationEvent): Promise<void> {
    await this.publishEvent(KAFKA_TOPICS.CONVERSATION_EVENTS, event, event.conversationId);
  }

  /**
   * Publish message-related events
   */
  async publishMessageEvent(event: MessageEvent): Promise<void> {
    await this.publishEvent(KAFKA_TOPICS.MESSAGE_EVENTS, event, event.conversationId);
  }

  /**
   * Publish sentiment analysis events
   */
  async publishSentimentEvent(event: SentimentEvent): Promise<void> {
    await this.publishEvent(KAFKA_TOPICS.SENTIMENT_EVENTS, event, event.conversationId);
  }

  /**
   * Publish agent-related events
   */
  async publishAgentEvent(event: AgentEvent): Promise<void> {
    await this.publishEvent(KAFKA_TOPICS.AGENT_EVENTS, event, event.agentId);
  }

  /**
   * Publish webhook events
   */
  async publishWebhookEvent(event: WebhookEvent): Promise<void> {
    await this.publishEvent(KAFKA_TOPICS.WEBHOOK_EVENTS, event);
  }

  /**
   * Publish analytics events
   */
  async publishAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
    await this.publishEvent(KAFKA_TOPICS.ANALYTICS_EVENTS, event, event.agentId || event.conversationId);
  }

  /**
   * Health check for Kafka connectivity
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      if (!this.isConnected) {
        return { status: 'unhealthy', details: { error: 'Not connected' } };
      }

      // Test admin connection
      const admin = this.kafka.admin();
      await admin.connect();
      const metadata = await admin.fetchTopicMetadata({ topics: Object.values(KAFKA_TOPICS) });
      await admin.disconnect();

      return {
        status: 'healthy',
        details: {
          connected: true,
          topics: metadata.topics.length,
          producer: this.producer ? 'connected' : 'disconnected',
          consumers: this.consumers.size,
        },
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        details: { error: error instanceof Error ? error.message : 'Unknown error' } 
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('📴 Shutting down Kafka service...');

    try {
      // Disconnect all consumers
      for (const [name, consumer] of this.consumers) {
        await consumer.disconnect();
        console.log(`🔌 Disconnected consumer: ${name}`);
      }
      this.consumers.clear();

      // Disconnect producer
      if (this.producer) {
        await this.producer.disconnect();
        console.log('🔌 Disconnected producer');
      }

      this.isConnected = false;
      console.log('✅ Kafka service shutdown complete');
    } catch (error) {
      console.error('❌ Error during Kafka shutdown:', error);
      throw error;
    }
  }

  /**
   * Get service statistics
   */
  getStats(): { connected: boolean; consumers: number; topics: string[] } {
    return {
      connected: this.isConnected,
      consumers: this.consumers.size,
      topics: Object.values(KAFKA_TOPICS),
    };
  }
}

// Singleton instance for application-wide use
let kafkaInstance: KafkaService | null = null;

/**
 * Get or create the Kafka service instance
 */
export function getKafkaService(): KafkaService {
  if (!kafkaInstance) {
    kafkaInstance = new KafkaService();
  }
  return kafkaInstance;
}

/**
 * Initialize the global Kafka service
 */
export async function initializeKafka(): Promise<KafkaService> {
  const kafka = getKafkaService();
  await kafka.initialize();
  return kafka;
}

/**
 * Shutdown the global Kafka service
 */
export async function shutdownKafka(): Promise<void> {
  if (kafkaInstance) {
    await kafkaInstance.shutdown();
    kafkaInstance = null;
  }
}