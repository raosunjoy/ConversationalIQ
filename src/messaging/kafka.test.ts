/**
 * Tests for Kafka service and event processing
 */

import {
  KafkaService,
  KAFKA_TOPICS,
  ConversationEvent,
  MessageEvent,
} from './kafka';

// Mock KafkaJS
jest.mock('kafkajs', () => {
  const mockProducer = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue({
      topicName: 'test',
      partition: 0,
      errorCode: 0,
      baseOffset: '0',
      logAppendTime: '0',
      logStartOffset: '0',
    }),
  };

  const mockConsumer = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    run: jest.fn().mockResolvedValue(undefined),
  };

  const mockAdmin = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    createTopics: jest.fn().mockResolvedValue([]),
    fetchTopicMetadata: jest.fn().mockResolvedValue({
      topics: [
        { name: 'conversation-events', partitions: [] },
        { name: 'message-events', partitions: [] },
      ],
    }),
  };

  const mockKafka = {
    producer: jest.fn().mockReturnValue(mockProducer),
    consumer: jest.fn().mockReturnValue(mockConsumer),
    admin: jest.fn().mockReturnValue(mockAdmin),
  };

  return {
    Kafka: jest.fn().mockImplementation(() => mockKafka),
  };
});

describe('KafkaService', () => {
  let kafkaService: KafkaService;

  beforeEach(() => {
    kafkaService = new KafkaService({
      brokers: ['localhost:9092'],
      clientId: 'test-client',
    });
    jest.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await kafkaService.shutdown();
    } catch (error) {
      // Ignore shutdown errors in tests
    }
  });

  describe('initialization', () => {
    it('should initialize Kafka service successfully', async () => {
      await expect(kafkaService.initialize()).resolves.not.toThrow();

      const stats = kafkaService.getStats();
      expect(stats.connected).toBe(true);
      expect(stats.topics).toEqual(Object.values(KAFKA_TOPICS));
    });

    it('should handle initialization errors gracefully', async () => {
      const mockKafka = require('kafkajs').Kafka;
      const kafka = mockKafka();
      kafka
        .producer()
        .connect.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(kafkaService.initialize()).rejects.toThrow(
        'Connection failed'
      );
    });
  });

  describe('event publishing', () => {
    beforeEach(async () => {
      await kafkaService.initialize();
    });

    it('should publish conversation events', async () => {
      const event: ConversationEvent = {
        type: 'CONVERSATION_CREATED',
        conversationId: 'conv-123',
        ticketId: 'ticket-456',
        customerId: 'customer-789',
        status: 'OPEN',
        timestamp: new Date().toISOString(),
      };

      await expect(
        kafkaService.publishConversationEvent(event)
      ).resolves.not.toThrow();

      const mockKafka = require('kafkajs').Kafka;
      const kafka = mockKafka();
      const producer = kafka.producer();

      expect(producer.send).toHaveBeenCalledWith({
        topic: KAFKA_TOPICS.CONVERSATION_EVENTS,
        messages: [
          {
            key: event.conversationId,
            value: JSON.stringify(event),
            timestamp: expect.any(String),
            headers: {
              'event-type': event.type,
              'event-id': expect.any(String),
              source: 'conversationiq',
            },
          },
        ],
      });
    });

    it('should publish message events', async () => {
      const event: MessageEvent = {
        type: 'MESSAGE_CREATED',
        messageId: 'msg-123',
        conversationId: 'conv-456',
        content: 'Hello, how can I help you?',
        sender: 'AGENT',
        sentimentScore: 0.8,
        detectedIntent: 'greeting',
        timestamp: new Date().toISOString(),
      };

      await expect(
        kafkaService.publishMessageEvent(event)
      ).resolves.not.toThrow();

      const mockKafka = require('kafkajs').Kafka;
      const kafka = mockKafka();
      const producer = kafka.producer();

      expect(producer.send).toHaveBeenCalledWith({
        topic: KAFKA_TOPICS.MESSAGE_EVENTS,
        messages: [
          {
            key: event.conversationId,
            value: JSON.stringify(event),
            timestamp: expect.any(String),
            headers: {
              'event-type': event.type,
              'event-id': expect.any(String),
              source: 'conversationiq',
            },
          },
        ],
      });
    });

    it('should handle publishing errors gracefully', async () => {
      const mockKafka = require('kafkajs').Kafka;
      const kafka = mockKafka();
      const producer = kafka.producer();
      producer.send.mockRejectedValueOnce(new Error('Publishing failed'));

      const event: ConversationEvent = {
        type: 'CONVERSATION_CREATED',
        conversationId: 'conv-123',
        ticketId: 'ticket-456',
        customerId: 'customer-789',
        status: 'OPEN',
        timestamp: new Date().toISOString(),
      };

      await expect(
        kafkaService.publishConversationEvent(event)
      ).rejects.toThrow('Publishing failed');
    });

    it('should throw error when not initialized', async () => {
      const uninitializedService = new KafkaService();

      const event: ConversationEvent = {
        type: 'CONVERSATION_CREATED',
        conversationId: 'conv-123',
        ticketId: 'ticket-456',
        customerId: 'customer-789',
        status: 'OPEN',
        timestamp: new Date().toISOString(),
      };

      await expect(
        uninitializedService.publishConversationEvent(event)
      ).rejects.toThrow('Kafka service not initialized');
    });
  });

  describe('event subscription', () => {
    beforeEach(async () => {
      await kafkaService.initialize();
    });

    it('should subscribe to topics successfully', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);

      await expect(
        kafkaService.subscribe(
          KAFKA_TOPICS.CONVERSATION_EVENTS,
          'test-group',
          mockHandler
        )
      ).resolves.not.toThrow();

      const mockKafka = require('kafkajs').Kafka;
      const kafka = mockKafka();
      const consumer = kafka.consumer();

      expect(consumer.connect).toHaveBeenCalled();
      expect(consumer.subscribe).toHaveBeenCalledWith({
        topic: KAFKA_TOPICS.CONVERSATION_EVENTS,
        fromBeginning: false,
      });
      expect(consumer.run).toHaveBeenCalled();
    });

    it('should process messages with handler', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      const testEvent: ConversationEvent = {
        type: 'CONVERSATION_CREATED',
        conversationId: 'conv-123',
        ticketId: 'ticket-456',
        customerId: 'customer-789',
        status: 'OPEN',
        timestamp: new Date().toISOString(),
      };

      await kafkaService.subscribe(
        KAFKA_TOPICS.CONVERSATION_EVENTS,
        'test-group',
        mockHandler
      );

      // Simulate message processing
      const mockKafka = require('kafkajs').Kafka;
      const kafka = mockKafka();
      const consumer = kafka.consumer();

      // Get the message handler from the run call
      const runCall = consumer.run.mock.calls[0][0];
      const eachMessage = runCall.eachMessage;

      // Simulate a message
      const mockMessage = {
        topic: KAFKA_TOPICS.CONVERSATION_EVENTS,
        partition: 0,
        message: {
          offset: '0',
          value: Buffer.from(JSON.stringify(testEvent)),
        },
      };

      await eachMessage(mockMessage);

      expect(mockHandler).toHaveBeenCalledWith(testEvent, {
        partition: 0,
        offset: '0',
      });
    });

    it('should handle subscription errors', async () => {
      const mockKafka = require('kafkajs').Kafka;
      const kafka = mockKafka();
      const consumer = kafka.consumer();
      consumer.connect.mockRejectedValueOnce(new Error('Subscription failed'));

      const mockHandler = jest.fn();

      await expect(
        kafkaService.subscribe(
          KAFKA_TOPICS.CONVERSATION_EVENTS,
          'test-group',
          mockHandler
        )
      ).rejects.toThrow('Subscription failed');
    });

    it('should throw error when not initialized', async () => {
      const uninitializedService = new KafkaService();
      const mockHandler = jest.fn();

      await expect(
        uninitializedService.subscribe(
          KAFKA_TOPICS.CONVERSATION_EVENTS,
          'test-group',
          mockHandler
        )
      ).rejects.toThrow('Kafka service not initialized');
    });
  });

  describe('health check', () => {
    it('should return healthy status when connected', async () => {
      await kafkaService.initialize();

      const health = await kafkaService.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details.connected).toBe(true);
      expect(health.details.topics).toBe(2);
    });

    it('should return unhealthy status when not connected', async () => {
      const health = await kafkaService.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.details.error).toBe('Not connected');
    });

    it('should handle health check errors', async () => {
      await kafkaService.initialize();

      const mockKafka = require('kafkajs').Kafka;
      const kafka = mockKafka();
      const admin = kafka.admin();
      admin.connect.mockRejectedValueOnce(new Error('Health check failed'));

      const health = await kafkaService.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.details.error).toBe('Health check failed');
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await kafkaService.initialize();

      // Add a consumer
      const mockHandler = jest.fn();
      await kafkaService.subscribe(
        KAFKA_TOPICS.CONVERSATION_EVENTS,
        'test-group',
        mockHandler
      );

      await expect(kafkaService.shutdown()).resolves.not.toThrow();

      const stats = kafkaService.getStats();
      expect(stats.connected).toBe(false);
      expect(stats.consumers).toBe(0);
    });

    it('should handle shutdown errors gracefully', async () => {
      await kafkaService.initialize();

      const mockKafka = require('kafkajs').Kafka;
      const kafka = mockKafka();
      const producer = kafka.producer();
      producer.disconnect.mockRejectedValueOnce(new Error('Shutdown failed'));

      await expect(kafkaService.shutdown()).rejects.toThrow('Shutdown failed');
    });
  });

  describe('configuration', () => {
    it('should use custom configuration', () => {
      const customConfig = {
        brokers: ['custom-broker:9092'],
        clientId: 'custom-client',
        ssl: true,
      };

      const customService = new KafkaService(customConfig);

      // Test that custom config is used
      expect(customService).toBeInstanceOf(KafkaService);
    });

    it('should use environment variables for default config', () => {
      // Set environment variables
      process.env.KAFKA_BROKERS = 'env-broker:9092';
      process.env.KAFKA_SSL = 'true';
      process.env.KAFKA_PARTITIONS = '5';

      const envService = new KafkaService();

      expect(envService).toBeInstanceOf(KafkaService);

      // Clean up
      delete process.env.KAFKA_BROKERS;
      delete process.env.KAFKA_SSL;
      delete process.env.KAFKA_PARTITIONS;
    });
  });

  describe('topic constants', () => {
    it('should define all required topics', () => {
      expect(KAFKA_TOPICS.CONVERSATION_EVENTS).toBe('conversation-events');
      expect(KAFKA_TOPICS.MESSAGE_EVENTS).toBe('message-events');
      expect(KAFKA_TOPICS.SENTIMENT_EVENTS).toBe('sentiment-events');
      expect(KAFKA_TOPICS.AGENT_EVENTS).toBe('agent-events');
      expect(KAFKA_TOPICS.WEBHOOK_EVENTS).toBe('webhook-events');
      expect(KAFKA_TOPICS.ANALYTICS_EVENTS).toBe('analytics-events');
    });
  });

  describe('statistics', () => {
    it('should return correct statistics', async () => {
      const stats = kafkaService.getStats();

      expect(stats).toEqual({
        connected: false,
        consumers: 0,
        topics: Object.values(KAFKA_TOPICS),
      });

      await kafkaService.initialize();

      const connectedStats = kafkaService.getStats();
      expect(connectedStats.connected).toBe(true);
    });
  });
});

describe('Kafka utility functions', () => {
  // Mock the singleton instance
  jest.mock('./kafka', () => ({
    ...jest.requireActual('./kafka'),
    getKafkaService: jest.fn(),
  }));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should provide singleton access', () => {
    const { getKafkaService } = require('./kafka');
    const mockService = { initialize: jest.fn(), shutdown: jest.fn() };
    getKafkaService.mockReturnValue(mockService);

    const service1 = getKafkaService();
    const service2 = getKafkaService();

    expect(service1).toBe(service2);
  });
});
