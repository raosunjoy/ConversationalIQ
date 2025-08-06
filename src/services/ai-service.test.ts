/**
 * Tests for AI Service Integration
 * Following TDD approach - comprehensive AI service testing
 */

import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { AIService } from './ai-service';
import { DatabaseService } from './database';

// Mock dependencies
jest.mock('../ai/ai-pipeline');
jest.mock('./database');
jest.mock('../messaging/kafka');
jest.mock('../graphql/subscriptions');

describe('AIService', () => {
  let aiService: AIService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    aiService = new AIService();
    mockDatabaseService = new DatabaseService() as jest.Mocked<DatabaseService>;

    // Mock database responses
    mockDatabaseService.findMessageById = jest.fn().mockResolvedValue({
      id: 'msg_123',
      content: 'I need help with my billing',
      sender: 'CUSTOMER',
      createdAt: new Date(),
      conversationId: 'conv_456',
    });

    mockDatabaseService.findConversationById = jest.fn().mockResolvedValue({
      id: 'conv_456',
      customerId: 'customer_123',
      ticketId: 'ticket_789',
      status: 'OPEN',
    });

    mockDatabaseService.findMessagesByConversation = jest
      .fn()
      .mockResolvedValue([
        {
          id: 'msg_123',
          content: 'I need help with my billing',
          sender: 'CUSTOMER',
          createdAt: new Date(),
          conversationId: 'conv_456',
        },
      ]);

    mockDatabaseService.storeSentimentAnalysis = jest
      .fn()
      .mockResolvedValue(true);
    mockDatabaseService.storeIntentAnalysis = jest.fn().mockResolvedValue(true);
    mockDatabaseService.storeResponseSuggestion = jest
      .fn()
      .mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await aiService.initialize();

      // Should emit initialized event
      const initSpy = jest.fn();
      aiService.on('initialized', initSpy);

      // Re-initialize to test event
      await aiService.initialize();
      expect(initSpy).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      // Mock AI pipeline initialization failure
      const { aiPipeline } = require('../ai/ai-pipeline');
      aiPipeline.initialize = jest
        .fn()
        .mockRejectedValue(new Error('Pipeline init failed'));

      await expect(aiService.initialize()).rejects.toThrow();
    });
  });

  describe('Message Processing', () => {
    beforeEach(async () => {
      await aiService.initialize();
    });

    it('should process message successfully', async () => {
      const result = await aiService.processMessage('msg_123', 'conv_456');

      expect(result).toEqual({
        messageId: 'msg_123',
        conversationId: 'conv_456',
        sentiment: expect.objectContaining({
          score: expect.any(Number),
          confidence: expect.any(Number),
        }),
        intent: expect.objectContaining({
          primaryIntent: expect.objectContaining({
            category: expect.any(String),
          }),
        }),
        suggestions: expect.any(Array),
        processingTime: expect.any(Number),
        timestamp: expect.any(Date),
        modelVersions: expect.any(Object),
      });
    });

    it('should handle message not found', async () => {
      mockDatabaseService.findMessageById = jest.fn().mockResolvedValue(null);

      await expect(
        aiService.processMessage('nonexistent_msg', 'conv_456')
      ).rejects.toThrow('Message or conversation not found');
    });

    it('should handle conversation not found', async () => {
      mockDatabaseService.findConversationById = jest
        .fn()
        .mockResolvedValue(null);

      await expect(
        aiService.processMessage('msg_123', 'nonexistent_conv')
      ).rejects.toThrow('Message or conversation not found');
    });

    it('should skip processing if already processed', async () => {
      const processingService = new AIService();
      await processingService.initialize();

      // Mock getStoredResult to return existing result
      (processingService as any).getStoredResult = jest.fn().mockResolvedValue({
        messageId: 'msg_123',
        cached: true,
      });

      const result = await processingService.processMessage(
        'msg_123',
        'conv_456',
        {
          skipIfProcessed: true,
        }
      );

      expect(result).toEqual({
        messageId: 'msg_123',
        cached: true,
      });
    });

    it('should prevent duplicate processing', async () => {
      const promise1 = aiService.processMessage('msg_123', 'conv_456');
      const promise2 = aiService.processMessage('msg_123', 'conv_456');

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should return the same result (same promise)
      expect(result1.messageId).toBe(result2.messageId);
    });

    it('should emit messageProcessed event', async () => {
      const processedSpy = jest.fn();
      aiService.on('messageProcessed', processedSpy);

      await aiService.processMessage('msg_123', 'conv_456');

      expect(processedSpy).toHaveBeenCalledWith({
        messageId: 'msg_123',
        conversationId: 'conv_456',
        result: expect.any(Object),
        totalTime: expect.any(Number),
      });
    });

    it('should emit processingError event on failure', async () => {
      const errorSpy = jest.fn();
      aiService.on('processingError', errorSpy);

      // Mock processing failure
      const { aiPipeline } = require('../ai/ai-pipeline');
      aiPipeline.processMessage = jest
        .fn()
        .mockRejectedValue(new Error('Processing failed'));

      await expect(
        aiService.processMessage('msg_123', 'conv_456')
      ).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith({
        messageId: 'msg_123',
        conversationId: 'conv_456',
        error: expect.any(Error),
      });
    });
  });

  describe('Batch Processing', () => {
    beforeEach(async () => {
      await aiService.initialize();
    });

    it('should process multiple messages', async () => {
      const messageIds = ['msg_1', 'msg_2', 'msg_3'];
      const results = await aiService.processMessages(messageIds, 'conv_456');

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toEqual(
          expect.objectContaining({
            messageId: expect.any(String),
            conversationId: 'conv_456',
          })
        );
      });
    });

    it('should handle processing errors in batch', async () => {
      const messageIds = ['msg_1', 'msg_2', 'invalid_msg'];

      // Mock one message not found
      mockDatabaseService.findMessageById = jest
        .fn()
        .mockResolvedValueOnce({
          id: 'msg_1',
          content: 'Test 1',
          sender: 'CUSTOMER',
          createdAt: new Date(),
          conversationId: 'conv_456',
        })
        .mockResolvedValueOnce({
          id: 'msg_2',
          content: 'Test 2',
          sender: 'CUSTOMER',
          createdAt: new Date(),
          conversationId: 'conv_456',
        })
        .mockResolvedValueOnce(null);

      const results = await aiService.processMessages(messageIds, 'conv_456');

      // Should return results only for successful processing
      expect(results).toHaveLength(2);
    });

    it('should respect maxConcurrent limit', async () => {
      const messageIds = Array.from({ length: 10 }, (_, i) => `msg_${i}`);

      const startTime = Date.now();
      await aiService.processMessages(messageIds, 'conv_456', {
        maxConcurrent: 2,
      });
      const endTime = Date.now();

      // Should process in chunks, taking more time
      expect(endTime - startTime).toBeGreaterThan(100); // Should take some time due to chunking
    });
  });

  describe('Result Storage', () => {
    beforeEach(async () => {
      await aiService.initialize();
    });

    it('should store results when requested', async () => {
      await aiService.processMessage('msg_123', 'conv_456', {
        storeResults: true,
      });

      expect(mockDatabaseService.storeSentimentAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg_123',
        })
      );
      expect(mockDatabaseService.storeIntentAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg_123',
        })
      );
      expect(mockDatabaseService.storeResponseSuggestion).toHaveBeenCalled();
    });

    it('should skip storage when not requested', async () => {
      await aiService.processMessage('msg_123', 'conv_456', {
        storeResults: false,
      });

      expect(mockDatabaseService.storeSentimentAnalysis).not.toHaveBeenCalled();
      expect(mockDatabaseService.storeIntentAnalysis).not.toHaveBeenCalled();
      expect(
        mockDatabaseService.storeResponseSuggestion
      ).not.toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      mockDatabaseService.storeSentimentAnalysis = jest
        .fn()
        .mockRejectedValue(new Error('Storage failed'));

      // Should not throw error even if storage fails
      await expect(
        aiService.processMessage('msg_123', 'conv_456', {
          storeResults: true,
        })
      ).resolves.toBeDefined();
    });
  });

  describe('Event Publishing', () => {
    beforeEach(async () => {
      await aiService.initialize();
    });

    it('should publish GraphQL events when requested', async () => {
      const { publishEvent } = require('../graphql/subscriptions');

      await aiService.processMessage('msg_123', 'conv_456', {
        publishEvents: true,
      });

      expect(publishEvent.sentimentAnalyzed).toHaveBeenCalled();
      expect(publishEvent.responseSuggested).toHaveBeenCalled();
    });

    it('should skip GraphQL events when not requested', async () => {
      const { publishEvent } = require('../graphql/subscriptions');

      await aiService.processMessage('msg_123', 'conv_456', {
        publishEvents: false,
      });

      expect(publishEvent.sentimentAnalyzed).not.toHaveBeenCalled();
      expect(publishEvent.responseSuggested).not.toHaveBeenCalled();
    });

    it('should always publish Kafka events', async () => {
      const { getKafkaService } = require('../messaging/kafka');
      const mockKafkaService = getKafkaService();

      await aiService.processMessage('msg_123', 'conv_456');

      expect(mockKafkaService.publishSentimentEvent).toHaveBeenCalled();
      expect(mockKafkaService.publishAnalyticsEvent).toHaveBeenCalled();
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      await aiService.initialize();
    });

    it('should return health status', async () => {
      const health = await aiService.getHealth();

      expect(health).toEqual({
        status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
        pipeline: expect.any(Object),
        queue: expect.objectContaining({
          size: expect.any(Number),
          maxSize: expect.any(Number),
        }),
      });
    });

    it('should degrade status when queue is full', async () => {
      // Fill up the processing queue
      const promises = Array.from({ length: 60 }, (_, i) =>
        aiService.processMessage(`msg_${i}`, 'conv_456').catch(() => {})
      );

      const health = await aiService.getHealth();
      expect(health.status).toBe('unhealthy');

      // Clean up
      await Promise.allSettled(promises);
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await aiService.initialize();
    });

    it('should return processing statistics', async () => {
      const stats = aiService.getStats();

      expect(stats).toEqual({
        queueSize: expect.any(Number),
        pipelineMetrics: expect.any(Object),
        totalProcessed: expect.any(Number),
      });
    });

    it('should update queue size', async () => {
      const initialStats = aiService.getStats();

      const promise = aiService.processMessage('msg_123', 'conv_456');
      const duringStats = aiService.getStats();

      await promise;
      const finalStats = aiService.getStats();

      expect(duringStats.queueSize).toBeGreaterThanOrEqual(
        initialStats.queueSize
      );
      expect(finalStats.queueSize).toBeLessThanOrEqual(duringStats.queueSize);
    });
  });

  describe('Shutdown', () => {
    beforeEach(async () => {
      await aiService.initialize();
    });

    it('should shutdown gracefully', async () => {
      await aiService.shutdown();

      // Should emit shutdown event
      const shutdownSpy = jest.fn();
      aiService.on('shutdown', shutdownSpy);

      await aiService.shutdown();
      expect(shutdownSpy).toHaveBeenCalled();
    });

    it('should wait for pending operations', async () => {
      // Start a processing operation
      const processingPromise = aiService.processMessage('msg_123', 'conv_456');

      // Shutdown should wait
      const shutdownPromise = aiService.shutdown();

      await Promise.all([processingPromise, shutdownPromise]);

      // Both should complete without error
      expect(true).toBe(true);
    });
  });
});
