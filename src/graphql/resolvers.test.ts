/**
 * Tests for GraphQL resolvers
 * Following TDD approach - tests written first
 */

import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { resolvers } from './resolvers';
import { DatabaseService } from '../services/database';

// Mock the database service
jest.mock('../services/database');
const mockDatabaseService = jest.mocked(DatabaseService);

describe('GraphQL Resolvers', () => {
  let mockDb: jest.Mocked<DatabaseService>;
  let context: any;

  beforeEach(() => {
    mockDb = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      healthCheck: jest.fn(),
      createConversation: jest.fn(),
      findConversationById: jest.fn(),
      findConversationsByAgent: jest.fn(),
      updateConversation: jest.fn(),
      createMessage: jest.fn(),
      findMessageById: jest.fn(),
      findMessagesByConversation: jest.fn(),
      addAIAnalysis: jest.fn(),
      createResponseSuggestions: jest.fn(),
      findSuggestionsByMessage: jest.fn(),
    } as any;

    context = {
      db: mockDb,
      user: {
        userId: 'agent_123',
        email: 'agent@company.com',
        role: 'agent',
        zendeskId: 'zd_agent_456',
        subdomain: 'company',
      },
    };

    jest.clearAllMocks();
  });

  describe('Query Resolvers', () => {
    describe('conversation', () => {
      it('should fetch conversation by ID', async () => {
        const mockConversation = {
          id: 'conv_123',
          ticketId: 'ticket_456',
          agentId: 'agent_123',
          customerId: 'customer_789',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDb.findConversationById.mockResolvedValue(mockConversation);

        const result = await resolvers.Query.conversation(
          null,
          { id: 'conv_123' },
          context
        );

        expect(mockDb.findConversationById).toHaveBeenCalledWith('conv_123');
        expect(result).toEqual(mockConversation);
      });

      it('should return null for non-existent conversation', async () => {
        mockDb.findConversationById.mockResolvedValue(null);

        const result = await resolvers.Query.conversation(
          null,
          { id: 'non_existent' },
          context
        );

        expect(result).toBeNull();
      });

      it('should throw error for unauthorized access', async () => {
        const unauthorizedContext = { ...context, user: null };

        await expect(
          resolvers.Query.conversation(
            null,
            { id: 'conv_123' },
            unauthorizedContext
          )
        ).rejects.toThrow('Authentication required');
      });
    });

    describe('conversations', () => {
      it('should fetch conversations with filters', async () => {
        const mockConversations = [
          {
            id: 'conv_123',
            ticketId: 'ticket_456',
            agentId: 'agent_123',
            status: 'OPEN',
          },
          {
            id: 'conv_124',
            ticketId: 'ticket_457',
            agentId: 'agent_123',
            status: 'PENDING',
          },
        ];

        mockDb.findConversationsByAgent.mockResolvedValue(mockConversations);

        const result = await resolvers.Query.conversations(
          null,
          {
            filter: { agentId: 'agent_123', status: 'OPEN' },
            pagination: { limit: 10, offset: 0 },
          },
          context
        );

        expect(mockDb.findConversationsByAgent).toHaveBeenCalledWith(
          'agent_123',
          expect.objectContaining({
            status: 'OPEN',
            limit: 10,
            offset: 0,
          })
        );
        expect(result).toEqual(mockConversations);
      });
    });

    describe('message', () => {
      it('should fetch message by ID', async () => {
        const mockMessage = {
          id: 'msg_123',
          conversationId: 'conv_123',
          content: 'Hello, how can I help?',
          sender: 'AGENT',
          createdAt: new Date(),
        };

        mockDb.findMessageById.mockResolvedValue(mockMessage);

        const result = await resolvers.Query.message(
          null,
          { id: 'msg_123' },
          context
        );

        expect(mockDb.findMessageById).toHaveBeenCalledWith('msg_123');
        expect(result).toEqual(mockMessage);
      });
    });

    describe('messages', () => {
      it('should fetch messages for conversation', async () => {
        const mockMessages = [
          {
            id: 'msg_123',
            conversationId: 'conv_123',
            content: 'Customer message',
            sender: 'CUSTOMER',
          },
          {
            id: 'msg_124',
            conversationId: 'conv_123',
            content: 'Agent response',
            sender: 'AGENT',
          },
        ];

        mockDb.findMessagesByConversation.mockResolvedValue(mockMessages);

        const result = await resolvers.Query.messages(
          null,
          {
            conversationId: 'conv_123',
            pagination: { limit: 20, offset: 0 },
          },
          context
        );

        expect(mockDb.findMessagesByConversation).toHaveBeenCalledWith(
          'conv_123',
          expect.objectContaining({ limit: 20, offset: 0 })
        );
        expect(result).toEqual(mockMessages);
      });
    });

    describe('responseSuggestions', () => {
      it('should fetch suggestions for message', async () => {
        const mockSuggestions = [
          {
            id: 'sugg_123',
            messageId: 'msg_123',
            suggestedResponse: 'Thank you for contacting us!',
            confidence: 0.85,
            type: 'RESPONSE',
          },
          {
            id: 'sugg_124',
            messageId: 'msg_123',
            suggestedResponse: 'I understand your concern.',
            confidence: 0.78,
            type: 'RESPONSE',
          },
        ];

        mockDb.findSuggestionsByMessage.mockResolvedValue(mockSuggestions);

        const result = await resolvers.Query.responseSuggestions(
          null,
          { messageId: 'msg_123' },
          context
        );

        expect(mockDb.findSuggestionsByMessage).toHaveBeenCalledWith('msg_123');
        expect(result).toEqual(mockSuggestions);
      });
    });
  });

  describe('Mutation Resolvers', () => {
    describe('createConversation', () => {
      it('should create a new conversation', async () => {
        const input = {
          ticketId: 'ticket_456',
          agentId: 'agent_123',
          customerId: 'customer_789',
          status: 'OPEN' as const,
        };

        const mockConversation = {
          id: 'conv_123',
          ...input,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDb.createConversation.mockResolvedValue(mockConversation);

        const result = await resolvers.Mutation.createConversation(
          null,
          { input },
          context
        );

        expect(mockDb.createConversation).toHaveBeenCalledWith(input);
        expect(result).toEqual(mockConversation);
      });

      it('should validate required fields', async () => {
        const invalidInput = {
          ticketId: '',
          agentId: 'agent_123',
          customerId: 'customer_789',
          status: 'OPEN' as const,
        };

        await expect(
          resolvers.Mutation.createConversation(
            null,
            { input: invalidInput },
            context
          )
        ).rejects.toThrow('Ticket ID is required');
      });
    });

    describe('createMessage', () => {
      it('should create a new message', async () => {
        const input = {
          conversationId: 'conv_123',
          content: 'Hello, I need help with my order.',
          sender: 'CUSTOMER' as const,
        };

        const mockMessage = {
          id: 'msg_123',
          ...input,
          sentimentScore: null,
          detectedIntent: null,
          isProcessed: false,
          createdAt: new Date(),
        };

        mockDb.createMessage.mockResolvedValue(mockMessage);

        const result = await resolvers.Mutation.createMessage(
          null,
          { input },
          context
        );

        expect(mockDb.createMessage).toHaveBeenCalledWith({
          ...input,
          isProcessed: false,
        });
        expect(result).toEqual(mockMessage);
      });

      it('should validate message content', async () => {
        const invalidInput = {
          conversationId: 'conv_123',
          content: '',
          sender: 'CUSTOMER' as const,
        };

        await expect(
          resolvers.Mutation.createMessage(
            null,
            { input: invalidInput },
            context
          )
        ).rejects.toThrow('Message content cannot be empty');
      });
    });

    describe('generateResponseSuggestions', () => {
      it('should generate suggestions for message', async () => {
        const mockSuggestions = [
          {
            id: 'sugg_123',
            messageId: 'msg_123',
            suggestedResponse: 'I can help you with that!',
            confidence: 0.92,
            type: 'RESPONSE',
            createdAt: new Date(),
          },
        ];

        mockDb.createResponseSuggestions.mockResolvedValue(mockSuggestions);

        const result = await resolvers.Mutation.generateResponseSuggestions(
          null,
          { messageId: 'msg_123' },
          context
        );

        expect(mockDb.createResponseSuggestions).toHaveBeenCalledWith(
          'msg_123'
        );
        expect(result).toEqual(mockSuggestions);
      });
    });
  });

  describe('Type Resolvers', () => {
    describe('Conversation', () => {
      it('should resolve messages field', async () => {
        const conversation = { id: 'conv_123' };
        const mockMessages = [
          { id: 'msg_123', conversationId: 'conv_123' },
          { id: 'msg_124', conversationId: 'conv_123' },
        ];

        mockDb.findMessagesByConversation.mockResolvedValue(mockMessages);

        const result = await resolvers.Conversation.messages(
          conversation,
          {},
          context
        );

        expect(mockDb.findMessagesByConversation).toHaveBeenCalledWith(
          'conv_123',
          {}
        );
        expect(result).toEqual(mockMessages);
      });
    });

    describe('Message', () => {
      it('should resolve conversation field', async () => {
        const message = { id: 'msg_123', conversationId: 'conv_123' };
        const mockConversation = { id: 'conv_123', ticketId: 'ticket_456' };

        mockDb.findConversationById.mockResolvedValue(mockConversation);

        const result = await resolvers.Message.conversation(
          message,
          {},
          context
        );

        expect(mockDb.findConversationById).toHaveBeenCalledWith('conv_123');
        expect(result).toEqual(mockConversation);
      });

      it('should resolve responseSuggestions field', async () => {
        const message = { id: 'msg_123' };
        const mockSuggestions = [{ id: 'sugg_123', messageId: 'msg_123' }];

        mockDb.findSuggestionsByMessage.mockResolvedValue(mockSuggestions);

        const result = await resolvers.Message.responseSuggestions(
          message,
          {},
          context
        );

        expect(mockDb.findSuggestionsByMessage).toHaveBeenCalledWith('msg_123');
        expect(result).toEqual(mockSuggestions);
      });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for protected queries', async () => {
      const unauthenticatedContext = { db: mockDb, user: null };

      await expect(
        resolvers.Query.conversations(null, {}, unauthenticatedContext)
      ).rejects.toThrow('Authentication required');
    });

    it('should enforce agent role for agent-specific queries', async () => {
      const customerContext = {
        ...context,
        user: { ...context.user, role: 'customer' },
      };

      await expect(
        resolvers.Query.agentAnalytics(
          null,
          { agentId: 'agent_123', filter: {} },
          customerContext
        )
      ).rejects.toThrow('agent or manager or admin role required');
    });

    it('should allow agents to access their own data', async () => {
      const expectedAnalytics = {
        totalConversations: 45,
        averageSentiment: 0.72,
        responseTime: 125.5,
        resolutionRate: 0.83,
        escalationRate: 0.07,
        customerSatisfaction: 4.1,
        agentPerformance: 0.85,
        intentDistribution: {},
        sentimentDistribution: {},
        timeRangeStats: {},
      };

      const result = await resolvers.Query.agentAnalytics(
        null,
        { agentId: 'agent_123', filter: {} },
        context
      );

      expect(result).toEqual(expectedAnalytics);
    });
  });
});
