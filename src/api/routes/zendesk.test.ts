/**
 * Tests for Zendesk API Routes
 */

import request from 'supertest';
import express from 'express';
import { zendeskRoutes } from './zendesk';

// Mock dependencies
jest.mock('../../zendesk/auth-service');
jest.mock('../../messaging/kafka');
jest.mock('../../services/database');

describe('Zendesk API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/zendesk', zendeskRoutes);
    jest.clearAllMocks();
  });

  describe('OAuth Endpoints', () => {
    describe('GET /zendesk/auth/authorize', () => {
      it('should handle authorization request', async () => {
        const { zendeskAuthService } = require('../../zendesk/auth-service');
        zendeskAuthService.handleAuthorize = jest
          .fn()
          .mockImplementation((req, res) => {
            res.redirect(
              'https://test-company.zendesk.com/api/v2/oauth/callback?code=test-code&state=test-state'
            );
          });

        const response = await request(app)
          .get('/zendesk/auth/authorize')
          .query({
            state: 'test-state',
            subdomain: 'test-company',
            user_id: '12345',
            app_id: 'app-67890',
          });

        expect(response.status).toBe(302);
        expect(zendeskAuthService.handleAuthorize).toHaveBeenCalled();
      });
    });

    describe('POST /zendesk/auth/token', () => {
      it('should handle token exchange', async () => {
        const { zendeskAuthService } = require('../../zendesk/auth-service');
        zendeskAuthService.handleTokenExchange = jest
          .fn()
          .mockImplementation((req, res) => {
            res.json({
              access_token: 'test-access-token',
              refresh_token: 'test-refresh-token',
              token_type: 'Bearer',
              scope: 'read write',
              expires_in: 3600,
            });
          });

        const response = await request(app).post('/zendesk/auth/token').send({
          code: 'test-auth-code',
          grant_type: 'authorization_code',
        });

        expect(response.status).toBe(200);
        expect(response.body.access_token).toBe('test-access-token');
        expect(zendeskAuthService.handleTokenExchange).toHaveBeenCalled();
      });
    });
  });

  describe('App Lifecycle Endpoints', () => {
    describe('POST /zendesk/app/install', () => {
      it('should handle app installation', async () => {
        const { zendeskAuthService } = require('../../zendesk/auth-service');
        zendeskAuthService.handleAppInstallation = jest
          .fn()
          .mockImplementation((req, res) => {
            res.status(201).json({
              status: 'installed',
              installation_id: 'test-installation-id',
              webhook_url:
                'https://api.conversationiq.com/webhooks/zendesk/test-installation-id',
              webhook_secret: 'test-webhook-secret',
            });
          });

        const response = await request(app)
          .post('/zendesk/app/install')
          .send({
            subdomain: 'test-company',
            app_id: 'app-12345',
            user_id: 'user-67890',
            settings: {
              api_url: 'https://api.conversationiq.com',
              enable_sentiment: true,
            },
          });

        expect(response.status).toBe(201);
        expect(response.body.status).toBe('installed');
        expect(zendeskAuthService.handleAppInstallation).toHaveBeenCalled();
      });
    });

    describe('DELETE /zendesk/app/uninstall/:installation_id', () => {
      it('should handle app uninstallation', async () => {
        const { zendeskAuthService } = require('../../zendesk/auth-service');
        zendeskAuthService.handleAppUninstallation = jest
          .fn()
          .mockImplementation((req, res) => {
            res.json({
              status: 'uninstalled',
              installation_id: req.params.installation_id,
            });
          });

        const response = await request(app).delete(
          '/zendesk/app/uninstall/test-installation-id'
        );

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('uninstalled');
        expect(zendeskAuthService.handleAppUninstallation).toHaveBeenCalled();
      });
    });
  });

  describe('Protected API Endpoints', () => {
    const mockInstallation = {
      id: 'test-installation',
      subdomain: 'test-company',
      userId: '12345',
      appId: 'app-67890',
      settings: {
        enable_sentiment_analysis: true,
        enable_response_suggestions: true,
      },
    };

    beforeEach(() => {
      // Mock authentication middleware
      const { zendeskAuthService } = require('../../zendesk/auth-service');
      zendeskAuthService.validateAccessToken = jest
        .fn()
        .mockResolvedValue(mockInstallation);
    });

    describe('GET /zendesk/api/v1/sentiment/:conversationId', () => {
      it('should return sentiment analysis for valid conversation', async () => {
        const { DatabaseService } = require('../../services/database');
        const mockDbService = {
          findConversationById: jest.fn().mockResolvedValue({
            id: 'conv-123',
            ticketId: 'ticket-456',
            status: 'OPEN',
          }),
          findMessagesByConversationId: jest.fn().mockResolvedValue([
            {
              id: 'msg-1',
              content: 'Hello, I need help',
              sender: 'CUSTOMER',
              sentimentScore: -0.3,
              detectedIntent: 'support_request',
              createdAt: new Date(),
            },
            {
              id: 'msg-2',
              content: 'I can help you with that',
              sender: 'AGENT',
              sentimentScore: 0.7,
              detectedIntent: 'assistance',
              createdAt: new Date(),
            },
          ]),
        };
        DatabaseService.mockImplementation(() => mockDbService);

        const response = await request(app)
          .get('/zendesk/api/v1/sentiment/conv-123')
          .set('Authorization', 'Bearer test-token');

        expect(response.status).toBe(200);
        expect(response.body.conversationId).toBe('conv-123');
        expect(response.body.sentimentScore).toBeDefined();
        expect(response.body.messages).toHaveLength(2);
        expect(mockDbService.findConversationById).toHaveBeenCalledWith(
          'conv-123'
        );
      });

      it('should return 404 for non-existent conversation', async () => {
        const { DatabaseService } = require('../../services/database');
        const mockDbService = {
          findConversationById: jest.fn().mockResolvedValue(null),
        };
        DatabaseService.mockImplementation(() => mockDbService);

        const response = await request(app)
          .get('/zendesk/api/v1/sentiment/conv-404')
          .set('Authorization', 'Bearer test-token');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Conversation not found');
      });

      it('should require authentication', async () => {
        const { zendeskAuthService } = require('../../zendesk/auth-service');
        zendeskAuthService.validateAccessToken = jest
          .fn()
          .mockResolvedValue(null);

        const response = await request(app).get(
          '/zendesk/api/v1/sentiment/conv-123'
        );

        expect(response.status).toBe(401);
        expect(response.body.error).toBe(
          'Missing or invalid authorization header'
        );
      });
    });

    describe('GET /zendesk/api/v1/suggestions/:conversationId', () => {
      it('should return response suggestions for valid conversation', async () => {
        const { DatabaseService } = require('../../services/database');
        const mockDbService = {
          findConversationById: jest.fn().mockResolvedValue({
            id: 'conv-123',
            ticketId: 'ticket-456',
            status: 'OPEN',
          }),
          findMessagesByConversationId: jest.fn().mockResolvedValue([
            {
              id: 'msg-1',
              content: 'I have a billing issue',
              sender: 'CUSTOMER',
              sentimentScore: -0.2,
              createdAt: new Date(),
            },
          ]),
        };
        DatabaseService.mockImplementation(() => mockDbService);

        const response = await request(app)
          .get('/zendesk/api/v1/suggestions/conv-123')
          .set('Authorization', 'Bearer test-token');

        expect(response.status).toBe(200);
        expect(response.body.conversationId).toBe('conv-123');
        expect(response.body.suggestions).toBeDefined();
        expect(Array.isArray(response.body.suggestions)).toBe(true);
      });

      it('should handle refresh parameter', async () => {
        const { DatabaseService } = require('../../services/database');
        const mockDbService = {
          findConversationById: jest.fn().mockResolvedValue({
            id: 'conv-123',
            ticketId: 'ticket-456',
            status: 'OPEN',
          }),
          findMessagesByConversationId: jest.fn().mockResolvedValue([]),
        };
        DatabaseService.mockImplementation(() => mockDbService);

        const response = await request(app)
          .get('/zendesk/api/v1/suggestions/conv-123?refresh=true')
          .set('Authorization', 'Bearer test-token');

        expect(response.status).toBe(200);
        expect(response.body.suggestions).toBeDefined();
      });
    });

    describe('GET /zendesk/api/v1/analytics/:conversationId', () => {
      it('should return analytics for valid conversation', async () => {
        const { DatabaseService } = require('../../services/database');
        const mockDbService = {
          findConversationById: jest.fn().mockResolvedValue({
            id: 'conv-123',
            ticketId: 'ticket-456',
            status: 'OPEN',
            createdAt: new Date(Date.now() - 3600000), // 1 hour ago
          }),
          findMessagesByConversationId: jest.fn().mockResolvedValue([
            {
              id: 'msg-1',
              content: 'Help me',
              sender: 'CUSTOMER',
              sentimentScore: -0.1,
              createdAt: new Date(Date.now() - 3600000),
            },
            {
              id: 'msg-2',
              content: 'I can help',
              sender: 'AGENT',
              sentimentScore: 0.5,
              createdAt: new Date(Date.now() - 3500000),
            },
          ]),
        };
        DatabaseService.mockImplementation(() => mockDbService);

        const response = await request(app)
          .get('/zendesk/api/v1/analytics/conv-123')
          .set('Authorization', 'Bearer test-token');

        expect(response.status).toBe(200);
        expect(response.body.conversationId).toBe('conv-123');
        expect(response.body.averageResponseTime).toBeDefined();
        expect(response.body.sentimentTrend).toBeDefined();
        expect(response.body.escalationRisk).toBeDefined();
        expect(response.body.insights).toBeDefined();
      });
    });

    describe('POST /zendesk/api/v1/events', () => {
      it('should publish message events to Kafka', async () => {
        const { getKafkaService } = require('../../messaging/kafka');
        const mockKafkaService = {
          publishMessageEvent: jest.fn().mockResolvedValue(undefined),
        };
        getKafkaService.mockReturnValue(mockKafkaService);

        const response = await request(app)
          .post('/zendesk/api/v1/events')
          .set('Authorization', 'Bearer test-token')
          .send({
            type: 'message',
            data: {
              messageId: 'msg-123',
              conversationId: 'conv-456',
              content: 'Test message',
              sender: 'CUSTOMER',
            },
          });

        expect(response.status).toBe(201);
        expect(response.body.status).toBe('event_published');
        expect(mockKafkaService.publishMessageEvent).toHaveBeenCalledWith({
          type: 'MESSAGE_CREATED',
          messageId: 'msg-123',
          conversationId: 'conv-456',
          content: 'Test message',
          sender: 'CUSTOMER',
          timestamp: expect.any(String),
        });
      });

      it('should publish conversation events to Kafka', async () => {
        const { getKafkaService } = require('../../messaging/kafka');
        const mockKafkaService = {
          publishConversationEvent: jest.fn().mockResolvedValue(undefined),
        };
        getKafkaService.mockReturnValue(mockKafkaService);

        const response = await request(app)
          .post('/zendesk/api/v1/events')
          .set('Authorization', 'Bearer test-token')
          .send({
            type: 'conversation',
            data: {
              eventType: 'CONVERSATION_UPDATED',
              conversationId: 'conv-123',
              ticketId: 'ticket-456',
              customerId: 'customer-789',
              agentId: 'agent-101',
              status: 'IN_PROGRESS',
            },
          });

        expect(response.status).toBe(201);
        expect(mockKafkaService.publishConversationEvent).toHaveBeenCalledWith({
          type: 'CONVERSATION_UPDATED',
          conversationId: 'conv-123',
          ticketId: 'ticket-456',
          customerId: 'customer-789',
          agentId: 'agent-101',
          status: 'IN_PROGRESS',
          timestamp: expect.any(String),
        });
      });

      it('should reject unsupported event types', async () => {
        const response = await request(app)
          .post('/zendesk/api/v1/events')
          .set('Authorization', 'Bearer test-token')
          .send({
            type: 'unsupported',
            data: {},
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Unsupported event type');
        expect(response.body.supportedTypes).toEqual([
          'message',
          'conversation',
        ]);
      });

      it('should reject events with missing data', async () => {
        const response = await request(app)
          .post('/zendesk/api/v1/events')
          .set('Authorization', 'Bearer test-token')
          .send({
            type: 'message',
            // Missing data field
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Missing required fields');
        expect(response.body.required).toEqual(['type', 'data']);
      });
    });
  });

  describe('Health Check', () => {
    describe('GET /zendesk/health', () => {
      it('should return health status', async () => {
        const response = await request(app).get('/zendesk/health');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
        expect(response.body.service).toBe('ConversationIQ Zendesk App');
        expect(response.body.version).toBe('1.0.0');
        expect(response.body.timestamp).toBeDefined();
      });
    });
  });

  describe('Authentication Middleware', () => {
    it('should reject requests without authorization header', async () => {
      const response = await request(app).get(
        '/zendesk/api/v1/sentiment/conv-123'
      );

      expect(response.status).toBe(401);
      expect(response.body.error).toBe(
        'Missing or invalid authorization header'
      );
    });

    it('should reject requests with invalid authorization format', async () => {
      const response = await request(app)
        .get('/zendesk/api/v1/sentiment/conv-123')
        .set('Authorization', 'Invalid token-format');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe(
        'Missing or invalid authorization header'
      );
    });

    it('should reject requests with invalid token', async () => {
      const { zendeskAuthService } = require('../../zendesk/auth-service');
      zendeskAuthService.validateAccessToken = jest
        .fn()
        .mockResolvedValue(null);

      const response = await request(app)
        .get('/zendesk/api/v1/sentiment/conv-123')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid or expired access token');
    });

    it('should handle authentication validation errors', async () => {
      const { zendeskAuthService } = require('../../zendesk/auth-service');
      zendeskAuthService.validateAccessToken = jest
        .fn()
        .mockRejectedValue(new Error('Validation failed'));

      const response = await request(app)
        .get('/zendesk/api/v1/sentiment/conv-123')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Authentication validation failed');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const { zendeskAuthService } = require('../../zendesk/auth-service');
      zendeskAuthService.validateAccessToken = jest.fn().mockResolvedValue({
        id: 'test-installation',
      });

      const { DatabaseService } = require('../../services/database');
      const mockDbService = {
        findConversationById: jest
          .fn()
          .mockRejectedValue(new Error('Database connection failed')),
      };
      DatabaseService.mockImplementation(() => mockDbService);

      const response = await request(app)
        .get('/zendesk/api/v1/sentiment/conv-123')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch sentiment analysis');
      expect(response.body.message).toBe('Database connection failed');
    });

    it('should handle Kafka publishing errors', async () => {
      const { zendeskAuthService } = require('../../zendesk/auth-service');
      zendeskAuthService.validateAccessToken = jest.fn().mockResolvedValue({
        id: 'test-installation',
      });

      const { getKafkaService } = require('../../messaging/kafka');
      const mockKafkaService = {
        publishMessageEvent: jest
          .fn()
          .mockRejectedValue(new Error('Kafka unavailable')),
      };
      getKafkaService.mockReturnValue(mockKafkaService);

      const response = await request(app)
        .post('/zendesk/api/v1/events')
        .set('Authorization', 'Bearer test-token')
        .send({
          type: 'message',
          data: {
            messageId: 'msg-123',
            conversationId: 'conv-456',
            content: 'Test message',
            sender: 'CUSTOMER',
          },
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to publish event');
      expect(response.body.message).toBe('Kafka unavailable');
    });
  });
});
