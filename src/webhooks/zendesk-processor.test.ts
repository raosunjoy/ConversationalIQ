/**
 * Tests for Zendesk Webhook Processor
 */

import { Request, Response } from 'express';
import { ZendeskWebhookProcessor } from './zendesk-processor';

// Mock dependencies
jest.mock('../zendesk/auth-service');
jest.mock('../messaging/kafka');
jest.mock('../services/database');

describe('ZendeskWebhookProcessor', () => {
  let processor: ZendeskWebhookProcessor;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    processor = new ZendeskWebhookProcessor();

    mockRequest = {
      params: { installationId: 'test-installation' },
      headers: { 'x-zendesk-webhook-signature': 'test-signature' },
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
  });

  describe('processWebhook', () => {
    beforeEach(() => {
      // Mock installation validation
      const { zendeskAuthService } = require('../zendesk/auth-service');
      zendeskAuthService.getInstallationByWebhookEndpoint = jest
        .fn()
        .mockResolvedValue({
          id: 'test-installation',
          webhookSecret: 'test-secret',
        });
      zendeskAuthService.verifyWebhookSignature = jest
        .fn()
        .mockReturnValue(true);

      // Mock Kafka service
      const { getKafkaService } = require('../messaging/kafka');
      const mockKafka = {
        publishConversationEvent: jest.fn().mockResolvedValue(undefined),
        publishMessageEvent: jest.fn().mockResolvedValue(undefined),
        publishWebhookEvent: jest.fn().mockResolvedValue(undefined),
        publishAnalyticsEvent: jest.fn().mockResolvedValue(undefined),
      };
      getKafkaService.mockReturnValue(mockKafka);

      // Mock database service
      const { DatabaseService } = require('../services/database');
      const mockDb = {
        createConversation: jest.fn().mockResolvedValue(undefined),
        updateConversation: jest.fn().mockResolvedValue(undefined),
        createMessage: jest.fn().mockResolvedValue(undefined),
        updateMessage: jest.fn().mockResolvedValue(undefined),
      };
      DatabaseService.mockImplementation(() => mockDb);
    });

    it('should process valid ticket.created webhook', async () => {
      mockRequest.body = {
        id: 'webhook-123',
        event_type: 'ticket.created',
        event_timestamp: '2024-01-01T12:00:00Z',
        zendesk_event_version: '1.0',
        subject: '123',
        account: {
          subdomain: 'test-company',
          id: 12345,
        },
        body: {
          current: {
            id: 123,
            subject: 'Test ticket',
            description: 'This is a test ticket',
            status: 'new',
            priority: 'normal',
            requester_id: 456,
            assignee_id: 789,
            tags: ['test', 'webhook'],
            created_at: '2024-01-01T12:00:00Z',
            updated_at: '2024-01-01T12:00:00Z',
          },
        },
      };

      await processor.processWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'processed',
        eventId: 'webhook-123',
        eventType: 'ticket.created',
        timestamp: expect.any(String),
      });

      // Verify Kafka events were published
      const { getKafkaService } = require('../messaging/kafka');
      const kafka = getKafkaService();
      expect(kafka.publishConversationEvent).toHaveBeenCalledWith({
        type: 'CONVERSATION_CREATED',
        conversationId: 'zendesk-123',
        ticketId: '123',
        customerId: '456',
        agentId: '789',
        status: 'OPEN',
        metadata: expect.objectContaining({
          subject: 'Test ticket',
          priority: 'normal',
          tags: ['test', 'webhook'],
        }),
        timestamp: '2024-01-01T12:00:00Z',
      });
    });

    it('should process valid comment.created webhook', async () => {
      mockRequest.body = {
        id: 'webhook-456',
        event_type: 'comment.created',
        event_timestamp: '2024-01-01T12:30:00Z',
        zendesk_event_version: '1.0',
        subject: '123',
        account: {
          subdomain: 'test-company',
          id: 12345,
        },
        body: {
          current: {
            id: 789,
            type: 'Comment',
            author_id: 456,
            body: 'This is a customer comment',
            plain_body: 'This is a customer comment',
            public: true,
            created_at: '2024-01-01T12:30:00Z',
            via: {
              channel: 'web',
            },
          },
        },
      };

      await processor.processWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);

      // Verify message event was published
      const { getKafkaService } = require('../messaging/kafka');
      const kafka = getKafkaService();
      expect(kafka.publishMessageEvent).toHaveBeenCalledWith({
        type: 'MESSAGE_CREATED',
        messageId: 'zendesk-comment-789',
        conversationId: 'zendesk-123',
        content: 'This is a customer comment',
        sender: 'AGENT',
        metadata: expect.objectContaining({
          zendeskCommentId: 789,
          authorId: '456',
          isPublic: true,
        }),
        timestamp: '2024-01-01T12:30:00Z',
      });
    });

    it('should handle ticket.updated webhook with status change', async () => {
      mockRequest.body = {
        id: 'webhook-789',
        event_type: 'ticket.updated',
        event_timestamp: '2024-01-01T13:00:00Z',
        zendesk_event_version: '1.0',
        subject: '123',
        account: {
          subdomain: 'test-company',
          id: 12345,
        },
        body: {
          current: {
            id: 123,
            subject: 'Test ticket - Updated',
            status: 'solved',
            priority: 'high',
            requester_id: 456,
            assignee_id: 789,
            updated_at: '2024-01-01T13:00:00Z',
          },
          previous: {
            id: 123,
            subject: 'Test ticket',
            status: 'open',
            priority: 'normal',
            requester_id: 456,
            assignee_id: 789,
            updated_at: '2024-01-01T12:00:00Z',
          },
        },
      };

      await processor.processWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);

      // Verify conversation update was published
      const { getKafkaService } = require('../messaging/kafka');
      const kafka = getKafkaService();
      expect(kafka.publishConversationEvent).toHaveBeenCalledWith({
        type: 'CONVERSATION_UPDATED',
        conversationId: 'zendesk-123',
        ticketId: '123',
        customerId: '456',
        agentId: '789',
        status: 'RESOLVED',
        metadata: expect.objectContaining({
          changes: expect.objectContaining({
            status: { from: 'open', to: 'solved' },
            priority: { from: 'normal', to: 'high' },
            subject: { from: 'Test ticket', to: 'Test ticket - Updated' },
          }),
        }),
        timestamp: '2024-01-01T13:00:00Z',
      });
    });

    it('should reject webhook with invalid installation', async () => {
      const { zendeskAuthService } = require('../zendesk/auth-service');
      zendeskAuthService.getInstallationByWebhookEndpoint = jest
        .fn()
        .mockResolvedValue(null);

      mockRequest.body = {
        id: 'webhook-123',
        event_type: 'ticket.created',
        event_timestamp: '2024-01-01T12:00:00Z',
      };

      await processor.processWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Installation not found',
        installationId: 'test-installation',
      });
    });

    it('should reject webhook with invalid signature', async () => {
      const { zendeskAuthService } = require('../zendesk/auth-service');
      zendeskAuthService.verifyWebhookSignature = jest
        .fn()
        .mockReturnValue(false);

      mockRequest.body = {
        id: 'webhook-123',
        event_type: 'ticket.created',
        event_timestamp: '2024-01-01T12:00:00Z',
        account: { subdomain: 'test' },
      };

      await processor.processWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid webhook signature',
      });
    });

    it('should reject webhook with invalid event structure', async () => {
      mockRequest.body = {
        // Missing required fields
        id: 'webhook-123',
      };

      await processor.processWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid webhook event structure',
      });
    });

    it('should handle unknown event types', async () => {
      mockRequest.body = {
        id: 'webhook-unknown',
        event_type: 'unknown.event',
        event_timestamp: '2024-01-01T12:00:00Z',
        zendesk_event_version: '1.0',
        subject: '123',
        account: {
          subdomain: 'test-company',
          id: 12345,
        },
        body: {
          some: 'data',
        },
      };

      await processor.processWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);

      // Should publish generic webhook event
      const { getKafkaService } = require('../messaging/kafka');
      const kafka = getKafkaService();
      expect(kafka.publishWebhookEvent).toHaveBeenCalledWith({
        type: 'ZENDESK_WEBHOOK',
        source: 'zendesk',
        eventType: 'unknown.event',
        payload: { some: 'data' },
        timestamp: '2024-01-01T12:00:00Z',
      });
    });

    it('should handle processing errors gracefully', async () => {
      const { getKafkaService } = require('../messaging/kafka');
      const mockKafka = {
        publishConversationEvent: jest
          .fn()
          .mockRejectedValue(new Error('Kafka unavailable')),
      };
      getKafkaService.mockReturnValue(mockKafka);

      mockRequest.body = {
        id: 'webhook-error',
        event_type: 'ticket.created',
        event_timestamp: '2024-01-01T12:00:00Z',
        zendesk_event_version: '1.0',
        subject: '123',
        account: {
          subdomain: 'test-company',
          id: 12345,
        },
        body: {
          current: {
            id: 123,
            status: 'new',
            requester_id: 456,
            created_at: '2024-01-01T12:00:00Z',
            updated_at: '2024-01-01T12:00:00Z',
          },
        },
      };

      await processor.processWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Webhook processing failed',
        message: 'Kafka unavailable',
      });
    });
  });

  describe('status mapping', () => {
    it('should map Zendesk statuses to internal statuses', () => {
      const mapStatus = (processor as any).mapZendeskStatusToInternal.bind(
        processor
      );

      expect(mapStatus('new')).toBe('OPEN');
      expect(mapStatus('open')).toBe('OPEN');
      expect(mapStatus('pending')).toBe('WAITING');
      expect(mapStatus('hold')).toBe('ON_HOLD');
      expect(mapStatus('solved')).toBe('RESOLVED');
      expect(mapStatus('closed')).toBe('CLOSED');
      expect(mapStatus('unknown')).toBe('OPEN'); // Default fallback
    });
  });

  describe('change detection', () => {
    it('should detect ticket changes between current and previous', () => {
      const current = {
        id: 123,
        status: 'solved',
        priority: 'high',
        assignee_id: 789,
        subject: 'Updated ticket',
        tags: ['urgent', 'billing'],
      };

      const previous = {
        id: 123,
        status: 'open',
        priority: 'normal',
        assignee_id: 456,
        subject: 'Original ticket',
        tags: ['normal'],
      };

      const changes = (processor as any).detectTicketChanges(current, previous);

      expect(changes).toEqual({
        status: { from: 'open', to: 'solved' },
        priority: { from: 'normal', to: 'high' },
        assignee: { from: 456, to: 789 },
        subject: { from: 'Original ticket', to: 'Updated ticket' },
        tags: { from: ['normal'], to: ['urgent', 'billing'] },
      });
    });

    it('should return empty changes when no previous ticket', () => {
      const current = { id: 123, status: 'new' };
      const changes = (processor as any).detectTicketChanges(current);

      expect(changes).toEqual({});
    });
  });

  describe('event validation', () => {
    it('should validate correct webhook event structure', () => {
      const validEvent = {
        id: 'webhook-123',
        event_type: 'ticket.created',
        event_timestamp: '2024-01-01T12:00:00Z',
        zendesk_event_version: '1.0',
        subject: '123',
        account: {
          subdomain: 'test-company',
          id: 12345,
        },
        body: {},
      };

      const isValid = (processor as any).validateWebhookEvent(validEvent);
      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook event structure', () => {
      const invalidEvents = [
        null,
        {},
        { id: 'test' }, // Missing required fields
        { id: 'test', event_type: 'test' }, // Missing account
        { id: 'test', event_type: 'test', account: {} }, // Missing subdomain
      ];

      invalidEvents.forEach(event => {
        const isValid = (processor as any).validateWebhookEvent(event);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('sender detection', () => {
    it('should correctly identify sender based on comment properties', async () => {
      // Mock setup
      const { zendeskAuthService } = require('../zendesk/auth-service');
      zendeskAuthService.getInstallationByWebhookEndpoint = jest
        .fn()
        .mockResolvedValue({
          id: 'test-installation',
          webhookSecret: 'test-secret',
          settings: {},
        });
      zendeskAuthService.verifyWebhookSignature = jest
        .fn()
        .mockReturnValue(true);

      const { getKafkaService } = require('../messaging/kafka');
      const mockKafka = {
        publishMessageEvent: jest.fn().mockResolvedValue(undefined),
      };
      getKafkaService.mockReturnValue(mockKafka);

      // Test public comment (should be AGENT)
      mockRequest.body = {
        id: 'webhook-public',
        event_type: 'comment.created',
        event_timestamp: '2024-01-01T12:00:00Z',
        zendesk_event_version: '1.0',
        subject: '123',
        account: { subdomain: 'test', id: 123 },
        body: {
          current: {
            id: 1,
            author_id: 456,
            body: 'Public comment',
            public: true,
            created_at: '2024-01-01T12:00:00Z',
          },
        },
      };

      await processor.processWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockKafka.publishMessageEvent).toHaveBeenCalledWith(
        expect.objectContaining({ sender: 'AGENT' })
      );

      // Test private comment (should be CUSTOMER)
      mockRequest.body.body.current.public = false;
      await processor.processWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockKafka.publishMessageEvent).toHaveBeenCalledWith(
        expect.objectContaining({ sender: 'CUSTOMER' })
      );
    });
  });

  describe('getStats', () => {
    it('should return processing statistics', () => {
      const stats = processor.getStats();

      expect(stats).toEqual({
        processed: expect.any(Number),
        errors: expect.any(Number),
        types: expect.any(Object),
      });
    });
  });
});

describe('ZendeskWebhookProcessor Integration', () => {
  let processor: ZendeskWebhookProcessor;

  beforeEach(() => {
    processor = new ZendeskWebhookProcessor();
  });

  it('should handle complete ticket lifecycle', async () => {
    // This would be an integration test covering ticket creation,
    // updates, comments, and closure

    const mockInstallation = {
      id: 'test-installation',
      webhookSecret: 'test-secret',
      settings: {
        enable_sentiment_analysis: true,
        enable_response_suggestions: true,
      },
    };

    // Mock dependencies
    const { zendeskAuthService } = require('../zendesk/auth-service');
    zendeskAuthService.getInstallationByWebhookEndpoint = jest
      .fn()
      .mockResolvedValue(mockInstallation);
    zendeskAuthService.verifyWebhookSignature = jest.fn().mockReturnValue(true);

    const { getKafkaService } = require('../messaging/kafka');
    const mockKafka = {
      publishConversationEvent: jest.fn().mockResolvedValue(undefined),
      publishMessageEvent: jest.fn().mockResolvedValue(undefined),
      publishWebhookEvent: jest.fn().mockResolvedValue(undefined),
      publishAnalyticsEvent: jest.fn().mockResolvedValue(undefined),
    };
    getKafkaService.mockReturnValue(mockKafka);

    // Simulate ticket creation
    const createRequest = {
      params: { installationId: 'test-installation' },
      headers: { 'x-zendesk-webhook-signature': 'valid-signature' },
      body: {
        id: 'create-webhook',
        event_type: 'ticket.created',
        event_timestamp: '2024-01-01T12:00:00Z',
        zendesk_event_version: '1.0',
        subject: '123',
        account: { subdomain: 'test', id: 123 },
        body: {
          current: {
            id: 123,
            subject: 'Test ticket',
            description: 'Initial description',
            status: 'new',
            requester_id: 456,
            created_at: '2024-01-01T12:00:00Z',
            updated_at: '2024-01-01T12:00:00Z',
          },
        },
      },
    } as Request;

    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any as Response;

    await processor.processWebhook(createRequest, mockResponse);

    // Verify conversation was created
    expect(mockKafka.publishConversationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CONVERSATION_CREATED',
        conversationId: 'zendesk-123',
      })
    );

    // Verify initial message was created
    expect(mockKafka.publishMessageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MESSAGE_CREATED',
        messageId: 'zendesk-ticket-123-description',
        content: 'Initial description',
      })
    );
  });
});
