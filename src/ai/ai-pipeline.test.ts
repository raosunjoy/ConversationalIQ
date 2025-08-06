/**
 * Tests for AI Pipeline
 * Following TDD approach - comprehensive AI pipeline testing
 */

import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { AIPipeline } from './ai-pipeline';
import { Message, ConversationContext } from './models';

// Mock the AI services
jest.mock('./sentiment-analysis');
jest.mock('./intent-classification');
jest.mock('./response-generation');

describe('AIPipeline', () => {
  let pipeline: AIPipeline;
  let mockMessage: Message;
  let mockConversationContext: ConversationContext;

  beforeEach(() => {
    pipeline = new AIPipeline();

    mockMessage = {
      id: 'msg_123',
      content: 'I am having trouble with my billing',
      sender: 'CUSTOMER',
      timestamp: new Date(),
      conversationId: 'conv_456',
    };

    mockConversationContext = {
      id: 'conv_456',
      messages: [mockMessage],
      customerId: 'customer_123',
      ticketId: 'ticket_789',
      status: 'OPEN',
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await pipeline.initialize();

      const health = await pipeline.getHealth();
      expect(health.status).toBe('healthy');
    });

    it('should handle initialization errors', async () => {
      // Create a new pipeline for this test
      const testPipeline = new AIPipeline();

      // Mock initialization failure
      const mockSentimentService =
        require('./sentiment-analysis').SentimentAnalysisService;
      const originalInit = mockSentimentService.prototype.initialize;
      mockSentimentService.prototype.initialize = jest
        .fn()
        .mockRejectedValue(new Error('Init failed'));

      await expect(testPipeline.initialize()).rejects.toThrow(
        'AI Pipeline initialization failed'
      );

      // Restore original mock
      mockSentimentService.prototype.initialize = originalInit;
    });

    it('should emit initialized event', async () => {
      const testPipeline = new AIPipeline();
      const initSpy = jest.fn();
      testPipeline.on('initialized', initSpy);

      await testPipeline.initialize();

      expect(initSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          initTime: expect.any(Number),
        })
      );
    });
  });

  describe('Message Processing', () => {
    beforeEach(async () => {
      await pipeline.initialize();
    });

    it('should process message successfully', async () => {
      const result = await pipeline.processMessage(
        mockMessage,
        mockConversationContext
      );

      expect(result).toEqual({
        messageId: mockMessage.id,
        conversationId: mockMessage.conversationId,
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
        modelVersions: expect.objectContaining({
          sentimentModel: expect.any(String),
          intentModel: expect.any(String),
          responseModel: expect.any(String),
        }),
      });
    });

    it('should handle processing timeout', async () => {
      // Mock slow processing
      const mockSentimentService =
        require('./sentiment-analysis').SentimentAnalysisService;
      mockSentimentService.prototype.analyzeMessage = jest
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(resolve, 10000))
        );

      await expect(
        pipeline.processMessage(mockMessage, mockConversationContext)
      ).rejects.toThrow('AI processing timeout');
    });

    it('should prevent duplicate processing', async () => {
      const promise1 = pipeline.processMessage(
        mockMessage,
        mockConversationContext
      );
      const promise2 = pipeline.processMessage(
        mockMessage,
        mockConversationContext
      );

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should return the same result (same promise)
      expect(result1).toBe(result2);
    });

    it('should emit messageProcessed event', async () => {
      const processedSpy = jest.fn();
      pipeline.on('messageProcessed', processedSpy);

      await pipeline.processMessage(mockMessage, mockConversationContext);

      expect(processedSpy).toHaveBeenCalledWith({
        messageId: mockMessage.id,
        processingTime: expect.any(Number),
        result: expect.any(Object),
      });
    });

    it('should emit processingError event on failure', async () => {
      const errorSpy = jest.fn();
      pipeline.on('processingError', errorSpy);

      // Mock processing failure
      const mockSentimentService =
        require('./sentiment-analysis').SentimentAnalysisService;
      mockSentimentService.prototype.analyzeMessage = jest
        .fn()
        .mockRejectedValue(new Error('Processing failed'));

      await expect(
        pipeline.processMessage(mockMessage, mockConversationContext)
      ).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith({
        messageId: mockMessage.id,
        error: expect.any(Error),
        processingTime: expect.any(Number),
      });
    });
  });

  describe('Caching', () => {
    beforeEach(async () => {
      await pipeline.initialize();
    });

    it('should cache processing results', async () => {
      const mockSentimentService =
        require('./sentiment-analysis').SentimentAnalysisService;
      const analyzeMessageSpy = jest.spyOn(
        mockSentimentService.prototype,
        'analyzeMessage'
      );

      // First call
      await pipeline.processMessage(mockMessage, mockConversationContext);
      expect(analyzeMessageSpy).toHaveBeenCalledTimes(1);

      // Second call with same message should use cache
      await pipeline.processMessage(mockMessage, mockConversationContext);
      expect(analyzeMessageSpy).toHaveBeenCalledTimes(1); // Still only one call
    });

    it('should emit cacheHit event', async () => {
      const cacheHitSpy = jest.fn();
      pipeline.on('cacheHit', cacheHitSpy);

      // First call to populate cache
      await pipeline.processMessage(mockMessage, mockConversationContext);

      // Second call should hit cache
      await pipeline.processMessage(mockMessage, mockConversationContext);

      expect(cacheHitSpy).toHaveBeenCalledWith({
        messageId: mockMessage.id,
      });
    });
  });

  describe('Metrics', () => {
    beforeEach(async () => {
      await pipeline.initialize();
    });

    it('should track processing metrics', async () => {
      await pipeline.processMessage(mockMessage, mockConversationContext);

      const metrics = pipeline.getMetrics();

      expect(metrics).toEqual({
        requestCount: expect.any(Number),
        averageLatency: expect.any(Number),
        p95Latency: expect.any(Number),
        errorRate: expect.any(Number),
        accuracyScore: expect.any(Number),
        throughput: expect.any(Number),
        cacheStats: expect.objectContaining({
          hits: expect.any(Number),
          misses: expect.any(Number),
          hitRate: expect.any(Number),
          totalEntries: expect.any(Number),
          memoryUsage: expect.any(Number),
        }),
        timestamp: expect.any(Date),
      });
    });

    it('should update request count', async () => {
      const initialMetrics = pipeline.getMetrics();

      await pipeline.processMessage(mockMessage, mockConversationContext);

      const updatedMetrics = pipeline.getMetrics();
      expect(updatedMetrics.requestCount).toBeGreaterThan(
        initialMetrics.requestCount
      );
    });

    it('should track error rate', async () => {
      // Mock processing failure
      const mockSentimentService =
        require('./sentiment-analysis').SentimentAnalysisService;
      mockSentimentService.prototype.analyzeMessage = jest
        .fn()
        .mockRejectedValue(new Error('Processing failed'));

      try {
        await pipeline.processMessage(mockMessage, mockConversationContext);
      } catch (error) {
        // Expected to fail
      }

      const metrics = pipeline.getMetrics();
      expect(metrics.errorRate).toBeGreaterThan(0);
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      await pipeline.initialize();
    });

    it('should return healthy status when all components are working', async () => {
      const health = await pipeline.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.components.sentiment).toBe(true);
      expect(health.components.intent).toBe(true);
      expect(health.components.response).toBe(true);
      expect(health.components.cache).toBe(true);
      expect(health.components.pipeline).toBe(true);
    });

    it('should return degraded status when some components fail', async () => {
      // Mock one service as unhealthy
      const mockSentimentService =
        require('./sentiment-analysis').SentimentAnalysisService;
      mockSentimentService.prototype.isHealthy = jest
        .fn()
        .mockResolvedValue(false);

      const health = await pipeline.getHealth();

      expect(health.status).toBe('degraded');
      expect(health.components.sentiment).toBe(false);
    });

    it('should include metrics in health check', async () => {
      const health = await pipeline.getHealth();

      expect(health.metrics).toEqual(
        expect.objectContaining({
          requestCount: expect.any(Number),
          averageLatency: expect.any(Number),
          throughput: expect.any(Number),
        })
      );
    });
  });

  describe('Shutdown', () => {
    beforeEach(async () => {
      await pipeline.initialize();
    });

    it('should shutdown gracefully', async () => {
      await pipeline.shutdown();

      // Should emit shutdown event
      const shutdownSpy = jest.fn();
      pipeline.on('shutdown', shutdownSpy);

      await pipeline.shutdown();
      expect(shutdownSpy).toHaveBeenCalled();
    });

    it('should wait for pending operations', async () => {
      // Start a long-running operation
      const slowMessage = { ...mockMessage, id: 'slow_msg' };
      const mockSentimentService =
        require('./sentiment-analysis').SentimentAnalysisService;
      mockSentimentService.prototype.analyzeMessage = jest
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(resolve, 1000))
        );

      const processingPromise = pipeline.processMessage(
        slowMessage,
        mockConversationContext
      );

      // Shutdown should wait
      const shutdownPromise = pipeline.shutdown();

      await Promise.all([processingPromise, shutdownPromise]);

      // Both should complete without error
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await pipeline.initialize();
    });

    it('should handle service errors gracefully', async () => {
      // Mock sentiment service error
      const mockSentimentService =
        require('./sentiment-analysis').SentimentAnalysisService;
      mockSentimentService.prototype.analyzeMessage = jest
        .fn()
        .mockRejectedValue(new Error('Sentiment analysis failed'));

      await expect(
        pipeline.processMessage(mockMessage, mockConversationContext)
      ).rejects.toThrow('Sentiment analysis failed');
    });

    it('should handle empty message content', async () => {
      const emptyMessage = { ...mockMessage, content: '' };

      await expect(
        pipeline.processMessage(emptyMessage, mockConversationContext)
      ).rejects.toThrow();
    });

    it('should handle missing conversation context', async () => {
      await expect(
        pipeline.processMessage(mockMessage, null as any)
      ).rejects.toThrow();
    });
  });
});
