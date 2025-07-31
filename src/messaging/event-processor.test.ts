/**
 * Tests for Event Processor service
 */

import { EventProcessor, getEventProcessor } from './event-processor';
import { KafkaService, KAFKA_TOPICS } from './kafka';
import { pubsub, SUBSCRIPTION_EVENTS } from '../graphql/subscriptions';
import { DatabaseService } from '../services/database';

// Mock dependencies
jest.mock('./kafka');
jest.mock('../graphql/subscriptions');
jest.mock('../services/database');

describe('EventProcessor', () => {
  let eventProcessor: EventProcessor;
  let mockKafkaService: jest.Mocked<KafkaService>;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockPubsub: jest.Mocked<typeof pubsub>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock services
    mockKafkaService = {
      subscribe: jest.fn().mockResolvedValue(undefined),
      publishSentimentEvent: jest.fn().mockResolvedValue(undefined),
      publishConversationEvent: jest.fn().mockResolvedValue(undefined),
      publishMessageEvent: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockReturnValue({ connected: true, consumers: 0, topics: [] }),
    } as any;

    mockDatabaseService = {
      findConversationById: jest.fn().mockResolvedValue({
        id: 'conv-123',
        ticketId: 'ticket-456',
        agentId: 'agent-789',
        customerId: 'customer-101',
        status: 'OPEN',
      }),
    } as any;

    mockPubsub = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Mock the imports
    const kafkaModule = require('./kafka');
    kafkaModule.getKafkaService.mockReturnValue(mockKafkaService);

    const subscriptionsModule = require('../graphql/subscriptions');
    subscriptionsModule.pubsub = mockPubsub;

    const databaseModule = require('../services/database');
    databaseModule.DatabaseService.mockImplementation(() => mockDatabaseService);

    eventProcessor = new EventProcessor();
  });

  describe('startup and shutdown', () => {
    it('should start all event processors successfully', async () => {
      await expect(eventProcessor.start()).resolves.not.toThrow();

      // Verify all topic subscriptions were created
      expect(mockKafkaService.subscribe).toHaveBeenCalledTimes(6);
      expect(mockKafkaService.subscribe).toHaveBeenCalledWith(
        KAFKA_TOPICS.CONVERSATION_EVENTS,
        'conversation-processor',
        expect.any(Function),
        { fromBeginning: false }
      );
      expect(mockKafkaService.subscribe).toHaveBeenCalledWith(
        KAFKA_TOPICS.MESSAGE_EVENTS,
        'message-processor',
        expect.any(Function),
        { fromBeginning: false }
      );
    });

    it('should not start if already running', async () => {
      await eventProcessor.start();
      
      // Clear the mock calls from first start
      mockKafkaService.subscribe.mockClear();
      
      // Try to start again
      await eventProcessor.start();
      
      // Should not call subscribe again
      expect(mockKafkaService.subscribe).not.toHaveBeenCalled();
    });

    it('should stop processors gracefully', async () => {
      await eventProcessor.start();
      await expect(eventProcessor.stop()).resolves.not.toThrow();

      const health = eventProcessor.getHealth();
      expect(health.status).toBe('unhealthy');
      expect(health.details.running).toBe(false);
    });

    it('should handle stop when not running', async () => {
      await expect(eventProcessor.stop()).resolves.not.toThrow();
    });
  });

  describe('conversation event processing', () => {
    let conversationHandler: Function;

    beforeEach(async () => {
      await eventProcessor.start();
      
      // Extract the conversation handler
      const conversationSubscribeCall = mockKafkaService.subscribe.mock.calls
        .find(call => call[0] === KAFKA_TOPICS.CONVERSATION_EVENTS);
      conversationHandler = conversationSubscribeCall![2];
    });

    it('should process conversation created events', async () => {
      const event = {
        type: 'CONVERSATION_CREATED',
        conversationId: 'conv-123',
        ticketId: 'ticket-456',
        customerId: 'customer-789',
        status: 'OPEN',
        timestamp: new Date().toISOString(),
      };

      await conversationHandler(event, { partition: 0, offset: '0' });

      expect(mockDatabaseService.findConversationById).toHaveBeenCalledWith('conv-123');
      expect(mockPubsub.publish).toHaveBeenCalledWith(
        SUBSCRIPTION_EVENTS.CONVERSATION_UPDATED,
        {
          conversationUpdated: {
            id: 'conv-123',
            ticketId: 'ticket-456',
            status: 'OPEN',
            agentId: 'agent-789',
            customerId: 'customer-101',
            updatedAt: expect.any(String),
          },
        }
      );
    });

    it('should process conversation updated events', async () => {
      const event = {
        type: 'CONVERSATION_UPDATED',
        conversationId: 'conv-123',
        ticketId: 'ticket-456',
        customerId: 'customer-789',
        agentId: 'agent-new',
        status: 'IN_PROGRESS',
        timestamp: new Date().toISOString(),
      };

      await conversationHandler(event, { partition: 0, offset: '0' });

      expect(mockDatabaseService.findConversationById).toHaveBeenCalledWith('conv-123');
      expect(mockPubsub.publish).toHaveBeenCalledWith(
        SUBSCRIPTION_EVENTS.CONVERSATION_UPDATED,
        expect.objectContaining({
          conversationUpdated: expect.objectContaining({
            id: 'conv-123',
            status: 'IN_PROGRESS',
          }),
        })
      );
    });

    it('should handle conversation not found', async () => {
      mockDatabaseService.findConversationById.mockResolvedValue(null);

      const event = {
        type: 'CONVERSATION_CREATED',
        conversationId: 'conv-404',
        ticketId: 'ticket-456',
        customerId: 'customer-789',
        status: 'OPEN',
        timestamp: new Date().toISOString(),
      };

      await conversationHandler(event, { partition: 0, offset: '0' });

      expect(mockDatabaseService.findConversationById).toHaveBeenCalledWith('conv-404');
      expect(mockPubsub.publish).not.toHaveBeenCalled();
    });

    it('should handle processing errors', async () => {
      mockDatabaseService.findConversationById.mockRejectedValue(new Error('Database error'));

      const event = {
        type: 'CONVERSATION_CREATED',
        conversationId: 'conv-123',
        ticketId: 'ticket-456',
        customerId: 'customer-789',
        status: 'OPEN',
        timestamp: new Date().toISOString(),
      };

      await expect(conversationHandler(event, { partition: 0, offset: '0' }))
        .rejects.toThrow('Database error');
    });
  });

  describe('message event processing', () => {
    let messageHandler: Function;

    beforeEach(async () => {
      await eventProcessor.start();
      
      // Extract the message handler
      const messageSubscribeCall = mockKafkaService.subscribe.mock.calls
        .find(call => call[0] === KAFKA_TOPICS.MESSAGE_EVENTS);
      messageHandler = messageSubscribeCall![2];
    });

    it('should process message created events', async () => {
      const event = {
        type: 'MESSAGE_CREATED',
        messageId: 'msg-123',
        conversationId: 'conv-456',
        content: 'Hello, how can I help you?',
        sender: 'AGENT',
        sentimentScore: 0.8,
        detectedIntent: 'greeting',
        timestamp: new Date().toISOString(),
      };

      await messageHandler(event, { partition: 0, offset: '0' });

      expect(mockPubsub.publish).toHaveBeenCalledWith(
        SUBSCRIPTION_EVENTS.MESSAGE_ADDED,
        {
          messageAdded: {
            id: 'msg-123',
            conversationId: 'conv-456',
            content: 'Hello, how can I help you?',
            sender: 'AGENT',
            sentimentScore: 0.8,
            detectedIntent: 'greeting',
            createdAt: expect.any(String),
          },
        }
      );
    });

    it('should trigger sentiment alert for negative messages', async () => {
      const event = {
        type: 'MESSAGE_CREATED',
        messageId: 'msg-123',
        conversationId: 'conv-456',
        content: 'This is terrible service!',
        sender: 'CUSTOMER',
        sentimentScore: -0.7,
        detectedIntent: 'complaint',
        timestamp: new Date().toISOString(),
      };

      await messageHandler(event, { partition: 0, offset: '0' });

      expect(mockKafkaService.publishSentimentEvent).toHaveBeenCalledWith({
        type: 'SENTIMENT_ALERT',
        conversationId: 'conv-456',
        messageId: 'msg-123',
        sentimentScore: -0.7,
        sentiment: 'NEGATIVE',
        confidence: 0.8,
        escalationRisk: 0.9,
        timestamp: expect.any(String),
      });
    });

    it('should not trigger sentiment alert for positive messages', async () => {
      const event = {
        type: 'MESSAGE_CREATED',
        messageId: 'msg-123',
        conversationId: 'conv-456',
        content: 'Thank you for your help!',
        sender: 'CUSTOMER',
        sentimentScore: 0.8,
        detectedIntent: 'gratitude',
        timestamp: new Date().toISOString(),
      };

      await messageHandler(event, { partition: 0, offset: '0' });

      expect(mockKafkaService.publishSentimentEvent).not.toHaveBeenCalled();
    });
  });

  describe('sentiment event processing', () => {
    let sentimentHandler: Function;

    beforeEach(async () => {
      await eventProcessor.start();
      
      // Extract the sentiment handler
      const sentimentSubscribeCall = mockKafkaService.subscribe.mock.calls
        .find(call => call[0] === KAFKA_TOPICS.SENTIMENT_EVENTS);
      sentimentHandler = sentimentSubscribeCall![2];
    });

    it('should process sentiment analyzed events', async () => {
      const event = {
        type: 'SENTIMENT_ANALYZED',
        conversationId: 'conv-123',
        messageId: 'msg-456',
        sentimentScore: -0.6,
        sentiment: 'NEGATIVE',
        confidence: 0.9,
        escalationRisk: 0.7,
        timestamp: new Date().toISOString(),
      };

      await sentimentHandler(event, { partition: 0, offset: '0' });

      expect(mockPubsub.publish).toHaveBeenCalledWith(
        SUBSCRIPTION_EVENTS.SENTIMENT_ANALYZED,
        {
          sentimentAnalyzed: {
            conversationId: 'conv-123',
            messageId: 'msg-456',
            sentimentScore: -0.6,
            sentiment: 'NEGATIVE',
            confidence: 0.9,
            escalationRisk: 0.7,
            analyzedAt: expect.any(String),
          },
        }
      );
    });

    it('should handle high escalation risk alerts', async () => {
      const event = {
        type: 'SENTIMENT_ALERT',
        conversationId: 'conv-123',
        messageId: 'msg-456',
        sentimentScore: -0.9,
        sentiment: 'NEGATIVE',
        confidence: 0.95,
        escalationRisk: 0.8,
        timestamp: new Date().toISOString(),
      };

      await sentimentHandler(event, { partition: 0, offset: '0' });

      expect(mockDatabaseService.findConversationById).toHaveBeenCalledWith('conv-123');
      expect(mockPubsub.publish).toHaveBeenCalled();
    });
  });

  describe('agent event processing', () => {
    let agentHandler: Function;

    beforeEach(async () => {
      await eventProcessor.start();
      
      // Extract the agent handler
      const agentSubscribeCall = mockKafkaService.subscribe.mock.calls
        .find(call => call[0] === KAFKA_TOPICS.AGENT_EVENTS);
      agentHandler = agentSubscribeCall![2];
    });

    it('should process agent status changes', async () => {
      const event = {
        type: 'AGENT_STATUS_CHANGED',
        agentId: 'agent-123',
        status: 'ONLINE',
        timestamp: new Date().toISOString(),
      };

      await agentHandler(event, { partition: 0, offset: '0' });

      expect(mockPubsub.publish).toHaveBeenCalledWith(
        SUBSCRIPTION_EVENTS.AGENT_STATUS_CHANGED,
        {
          agentStatusChanged: {
            agentId: 'agent-123',
            status: 'ONLINE',
            changedAt: expect.any(String),
          },
        }
      );
    });

    it('should process agent performance updates', async () => {
      const event = {
        type: 'AGENT_PERFORMANCE_UPDATE',
        agentId: 'agent-123',
        performanceMetrics: {
          averageResponseTime: 120,
          customerSatisfaction: 4.5,
          resolutionRate: 0.85,
        },
        timestamp: new Date().toISOString(),
      };

      await agentHandler(event, { partition: 0, offset: '0' });

      // Should not publish to GraphQL subscriptions for performance updates
      expect(mockPubsub.publish).not.toHaveBeenCalled();
    });
  });

  describe('health check', () => {
    it('should return healthy when running', async () => {
      await eventProcessor.start();
      
      const health = eventProcessor.getHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.details.running).toBe(true);
      expect(health.details.kafkaStats).toEqual({ connected: true, consumers: 0, topics: [] });
    });

    it('should return unhealthy when not running', () => {
      const health = eventProcessor.getHealth();
      
      expect(health.status).toBe('unhealthy');
      expect(health.details.running).toBe(false);
    });
  });

  describe('Zendesk webhook processing', () => {
    let webhookHandler: Function;

    beforeEach(async () => {
      await eventProcessor.start();
      
      // Extract the webhook handler
      const webhookSubscribeCall = mockKafkaService.subscribe.mock.calls
        .find(call => call[0] === KAFKA_TOPICS.WEBHOOK_EVENTS);
      webhookHandler = webhookSubscribeCall![2];
    });

    it('should process Zendesk ticket creation webhooks', async () => {
      const event = {
        type: 'ZENDESK_WEBHOOK',
        source: 'zendesk',
        eventType: 'ticket.created',
        payload: {
          id: 12345,
          subject: 'Need help with billing',
          requester_id: 67890,
          priority: 'normal',
          tags: ['billing', 'support'],
        },
        timestamp: new Date().toISOString(),
      };

      await webhookHandler(event, { partition: 0, offset: '0' });

      expect(mockKafkaService.publishConversationEvent).toHaveBeenCalledWith({
        type: 'CONVERSATION_CREATED',
        conversationId: 'zendesk-12345',
        ticketId: '12345',
        customerId: '67890',
        status: 'OPEN',
        metadata: {
          subject: 'Need help with billing',
          priority: 'normal',
          tags: ['billing', 'support'],
        },
        timestamp: expect.any(String),
      });
    });

    it('should process Zendesk comment creation webhooks', async () => {
      const event = {
        type: 'ZENDESK_WEBHOOK',
        source: 'zendesk',
        eventType: 'comment.created',
        payload: {
          id: 54321,
          ticket_id: 12345,
          body: 'Hello, I need help with my billing issue.',
          author_id: 67890,
          public: true,
        },
        timestamp: new Date().toISOString(),
      };

      await webhookHandler(event, { partition: 0, offset: '0' });

      expect(mockKafkaService.publishMessageEvent).toHaveBeenCalledWith({
        type: 'MESSAGE_CREATED',
        messageId: 'zendesk-comment-54321',
        conversationId: 'zendesk-12345',
        content: 'Hello, I need help with my billing issue.',
        sender: 'AGENT',
        metadata: {
          commentId: 54321,
          ticketId: 12345,
          authorId: 67890,
          public: true,
        },
        timestamp: expect.any(String),
      });
    });

    it('should handle unknown Zendesk event types', async () => {
      const event = {
        type: 'ZENDESK_WEBHOOK',
        source: 'zendesk',
        eventType: 'unknown.event',
        payload: {},
        timestamp: new Date().toISOString(),
      };

      await expect(webhookHandler(event, { partition: 0, offset: '0' }))
        .resolves.not.toThrow();

      // Should not publish any events for unknown types
      expect(mockKafkaService.publishConversationEvent).not.toHaveBeenCalled();
      expect(mockKafkaService.publishMessageEvent).not.toHaveBeenCalled();
    });
  });
});

describe('EventProcessor utility functions', () => {
  it('should provide singleton access', () => {
    const processor1 = getEventProcessor();
    const processor2 = getEventProcessor();
    
    expect(processor1).toBe(processor2);
    expect(processor1).toBeInstanceOf(EventProcessor);
  });
});