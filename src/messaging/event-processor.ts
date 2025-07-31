/**
 * Event processor for handling Kafka events and triggering appropriate actions
 * Implements event-driven processing with GraphQL subscriptions integration
 */

import { getKafkaService, KafkaEvent, KAFKA_TOPICS } from './kafka';
import { pubsub, SUBSCRIPTION_EVENTS } from '../graphql/subscriptions';
import { DatabaseService } from '../services/database';

/**
 * Event processor service that handles different types of Kafka events
 */
export class EventProcessor {
  private kafkaService = getKafkaService();
  private dbService = new DatabaseService();
  private isRunning = false;

  /**
   * Start all event processors
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Event processor already running');
      return;
    }

    console.log('🚀 Starting event processors...');

    // Start conversation event processor
    await this.startConversationProcessor();

    // Start message event processor
    await this.startMessageProcessor();

    // Start sentiment event processor
    await this.startSentimentProcessor();

    // Start agent event processor
    await this.startAgentProcessor();

    // Start webhook event processor
    await this.startWebhookProcessor();

    // Start analytics event processor
    await this.startAnalyticsProcessor();

    this.isRunning = true;
    console.log('✅ All event processors started successfully');
  }

  /**
   * Stop all event processors
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ Event processor not running');
      return;
    }

    console.log('📴 Stopping event processors...');
    // Kafka service handles consumer disconnection
    this.isRunning = false;
    console.log('✅ Event processors stopped');
  }

  /**
   * Process conversation events and update database + GraphQL subscriptions
   */
  private async startConversationProcessor(): Promise<void> {
    await this.kafkaService.subscribe(
      KAFKA_TOPICS.CONVERSATION_EVENTS,
      'conversation-processor',
      async (event, metadata) => {
        try {
          console.log(`🔄 Processing conversation event: ${event.type}`);

          if (event.type === 'CONVERSATION_CREATED' || event.type === 'CONVERSATION_UPDATED') {
            const conversationEvent = event as any; // Type assertion for conversation events

            // Update database
            const conversation = await this.dbService.findConversationById(conversationEvent.conversationId);
            
            if (conversation) {
              // Publish to GraphQL subscriptions
              await pubsub.publish(SUBSCRIPTION_EVENTS.CONVERSATION_UPDATED, {
                conversationUpdated: {
                  id: conversationEvent.conversationId,
                  ticketId: conversationEvent.ticketId,
                  status: conversationEvent.status,
                  agentId: conversationEvent.agentId,
                  customerId: conversationEvent.customerId,
                  updatedAt: new Date().toISOString(),
                },
              });

              console.log(`📡 Published conversation update to GraphQL: ${conversationEvent.conversationId}`);
            }
          }
        } catch (error) {
          console.error('❌ Error processing conversation event:', error);
          throw error;
        }
      },
      { fromBeginning: false }
    );
  }

  /**
   * Process message events and trigger real-time updates
   */
  private async startMessageProcessor(): Promise<void> {
    await this.kafkaService.subscribe(
      KAFKA_TOPICS.MESSAGE_EVENTS,
      'message-processor',
      async (event, metadata) => {
        try {
          console.log(`🔄 Processing message event: ${event.type}`);

          if (event.type === 'MESSAGE_CREATED') {
            const messageEvent = event as any; // Type assertion for message events

            // Publish to GraphQL subscriptions for real-time updates
            await pubsub.publish(SUBSCRIPTION_EVENTS.MESSAGE_ADDED, {
              messageAdded: {
                id: messageEvent.messageId,
                conversationId: messageEvent.conversationId,
                content: messageEvent.content,
                sender: messageEvent.sender,
                sentimentScore: messageEvent.sentimentScore,
                detectedIntent: messageEvent.detectedIntent,
                createdAt: new Date().toISOString(),
              },
            });

            console.log(`📡 Published message to GraphQL: ${messageEvent.messageId}`);

            // If sentiment analysis is available, trigger AI processing
            if (messageEvent.sentimentScore && messageEvent.sentimentScore < -0.5) {
              // Trigger escalation alert
              await this.kafkaService.publishSentimentEvent({
                type: 'SENTIMENT_ALERT',
                conversationId: messageEvent.conversationId,
                messageId: messageEvent.messageId,
                sentimentScore: messageEvent.sentimentScore,
                sentiment: 'NEGATIVE',
                confidence: 0.8,
                escalationRisk: 0.9,
                timestamp: new Date().toISOString(),
              });
            }
          }
        } catch (error) {
          console.error('❌ Error processing message event:', error);
          throw error;
        }
      },
      { fromBeginning: false }
    );
  }

  /**
   * Process sentiment analysis events and trigger alerts
   */
  private async startSentimentProcessor(): Promise<void> {
    await this.kafkaService.subscribe(
      KAFKA_TOPICS.SENTIMENT_EVENTS,
      'sentiment-processor',
      async (event, metadata) => {
        try {
          console.log(`🔄 Processing sentiment event: ${event.type}`);

          const sentimentEvent = event as any; // Type assertion for sentiment events

          // Publish to GraphQL subscriptions
          await pubsub.publish(SUBSCRIPTION_EVENTS.SENTIMENT_ANALYZED, {
            sentimentAnalyzed: {
              conversationId: sentimentEvent.conversationId,
              messageId: sentimentEvent.messageId,
              sentimentScore: sentimentEvent.sentimentScore,
              sentiment: sentimentEvent.sentiment,
              confidence: sentimentEvent.confidence,
              escalationRisk: sentimentEvent.escalationRisk,
              analyzedAt: new Date().toISOString(),
            },
          });

          // If this is an alert, also trigger agent notifications
          if (event.type === 'SENTIMENT_ALERT' && sentimentEvent.escalationRisk > 0.7) {
            console.log(`🚨 High escalation risk detected: ${sentimentEvent.conversationId}`);
            
            // Find assigned agent and send notification
            const conversation = await this.dbService.findConversationById(sentimentEvent.conversationId);
            if (conversation?.agentId) {
              // You could integrate with external notification services here
              // For now, we'll just log and rely on GraphQL subscriptions
              console.log(`📢 Alert sent to agent ${conversation.agentId}`);
            }
          }
        } catch (error) {
          console.error('❌ Error processing sentiment event:', error);
          throw error;
        }
      },
      { fromBeginning: false }
    );
  }

  /**
   * Process agent events and update status
   */
  private async startAgentProcessor(): Promise<void> {
    await this.kafkaService.subscribe(
      KAFKA_TOPICS.AGENT_EVENTS,
      'agent-processor',
      async (event, metadata) => {
        try {
          console.log(`🔄 Processing agent event: ${event.type}`);

          const agentEvent = event as any; // Type assertion for agent events

          if (event.type === 'AGENT_STATUS_CHANGED') {
            // Publish to GraphQL subscriptions for real-time status updates
            await pubsub.publish(SUBSCRIPTION_EVENTS.AGENT_STATUS_CHANGED, {
              agentStatusChanged: {
                agentId: agentEvent.agentId,
                status: agentEvent.status,
                changedAt: new Date().toISOString(),
              },
            });

            console.log(`📡 Published agent status change: ${agentEvent.agentId} -> ${agentEvent.status}`);
          }

          if (event.type === 'AGENT_PERFORMANCE_UPDATE') {
            // Update agent performance metrics in database
            // This would integrate with analytics storage
            console.log(`📊 Agent performance update: ${agentEvent.agentId}`);
          }
        } catch (error) {
          console.error('❌ Error processing agent event:', error);
          throw error;
        }
      },
      { fromBeginning: false }
    );
  }

  /**
   * Process webhook events from external systems
   */
  private async startWebhookProcessor(): Promise<void> {
    await this.kafkaService.subscribe(
      KAFKA_TOPICS.WEBHOOK_EVENTS,
      'webhook-processor',
      async (event, metadata) => {
        try {
          console.log(`🔄 Processing webhook event: ${event.type}`);

          const webhookEvent = event as any; // Type assertion for webhook events

          if (event.type === 'ZENDESK_WEBHOOK') {
            // Process Zendesk webhook events
            await this.processZendeskWebhook(webhookEvent);
          }

          if (event.type === 'WEBHOOK_RETRY') {
            console.log(`🔄 Retrying webhook processing: ${webhookEvent.source}`);
            // Implement retry logic here
          }

          if (event.type === 'WEBHOOK_FAILED') {
            console.error(`❌ Webhook processing failed: ${webhookEvent.source}`);
            // Implement failure handling (alerts, dead letter queue, etc.)
          }
        } catch (error) {
          console.error('❌ Error processing webhook event:', error);
          throw error;
        }
      },
      { fromBeginning: false }
    );
  }

  /**
   * Process analytics events for performance tracking
   */
  private async startAnalyticsProcessor(): Promise<void> {
    await this.kafkaService.subscribe(
      KAFKA_TOPICS.ANALYTICS_EVENTS,
      'analytics-processor',
      async (event, metadata) => {
        try {
          console.log(`🔄 Processing analytics event: ${event.type}`);

          const analyticsEvent = event as any; // Type assertion for analytics events

          // Store analytics data in time-series database or analytics store
          // For now, we'll just log the metrics
          console.log(`📊 Analytics metric: ${analyticsEvent.metricType} = ${analyticsEvent.value}`);

          // You could integrate with analytics services like DataDog, New Relic, etc.
          // or store in a specialized analytics database
        } catch (error) {
          console.error('❌ Error processing analytics event:', error);
          throw error;
        }
      },
      { fromBeginning: false }
    );
  }

  /**
   * Process Zendesk webhook events
   */
  private async processZendeskWebhook(webhookEvent: any): Promise<void> {
    const { eventType, payload } = webhookEvent;

    switch (eventType) {
      case 'ticket.created':
        await this.handleTicketCreated(payload);
        break;
      case 'ticket.updated':
        await this.handleTicketUpdated(payload);
        break;
      case 'comment.created':
        await this.handleCommentCreated(payload);
        break;
      default:
        console.log(`📝 Unhandled Zendesk event type: ${eventType}`);
    }
  }

  /**
   * Handle Zendesk ticket creation
   */
  private async handleTicketCreated(payload: any): Promise<void> {
    console.log(`🎫 New Zendesk ticket created: ${payload.id}`);

    // Create conversation event
    await this.kafkaService.publishConversationEvent({
      type: 'CONVERSATION_CREATED',
      conversationId: `zendesk-${payload.id}`,
      ticketId: payload.id.toString(),
      customerId: payload.requester_id?.toString() || 'unknown',
      status: 'OPEN',
      metadata: {
        subject: payload.subject,
        priority: payload.priority,
        tags: payload.tags,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle Zendesk ticket updates
   */
  private async handleTicketUpdated(payload: any): Promise<void> {
    console.log(`🔄 Zendesk ticket updated: ${payload.id}`);

    // Create conversation update event
    await this.kafkaService.publishConversationEvent({
      type: 'CONVERSATION_UPDATED',
      conversationId: `zendesk-${payload.id}`,
      ticketId: payload.id.toString(),
      customerId: payload.requester_id?.toString() || 'unknown',
      agentId: payload.assignee_id?.toString(),
      status: payload.status?.toUpperCase() || 'OPEN',
      metadata: {
        subject: payload.subject,
        priority: payload.priority,
        tags: payload.tags,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle Zendesk comment creation (new messages)
   */
  private async handleCommentCreated(payload: any): Promise<void> {
    console.log(`💬 New Zendesk comment created: ${payload.id}`);

    // Create message event
    await this.kafkaService.publishMessageEvent({
      type: 'MESSAGE_CREATED',
      messageId: `zendesk-comment-${payload.id}`,
      conversationId: `zendesk-${payload.ticket_id}`,
      content: payload.body || payload.html_body || '',
      sender: payload.public ? 'AGENT' : 'CUSTOMER',
      metadata: {
        commentId: payload.id,
        ticketId: payload.ticket_id,
        authorId: payload.author_id,
        public: payload.public,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get processor health status
   */
  getHealth(): { status: 'healthy' | 'unhealthy'; details: any } {
    return {
      status: this.isRunning ? 'healthy' : 'unhealthy',
      details: {
        running: this.isRunning,
        kafkaStats: this.kafkaService.getStats(),
      },
    };
  }
}

// Singleton instance
let processorInstance: EventProcessor | null = null;

/**
 * Get or create the event processor instance
 */
export function getEventProcessor(): EventProcessor {
  if (!processorInstance) {
    processorInstance = new EventProcessor();
  }
  return processorInstance;
}

/**
 * Start the global event processor
 */
export async function startEventProcessor(): Promise<EventProcessor> {
  const processor = getEventProcessor();
  await processor.start();
  return processor;
}

/**
 * Stop the global event processor
 */
export async function stopEventProcessor(): Promise<void> {
  if (processorInstance) {
    await processorInstance.stop();
  }
}