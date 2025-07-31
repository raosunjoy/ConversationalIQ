/**
 * Tests for database service layer
 * Following TDD approach - tests written first
 */

import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { DatabaseService } from './database';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
jest.mock('@prisma/client');

describe('DatabaseService', () => {
  let databaseService: DatabaseService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    mockPrisma = {
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      conversation: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      message: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      responseSuggestion: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      agentPerformanceDaily: {
        findMany: jest.fn(),
      },
      healthCheck: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
    } as any;

    databaseService = new DatabaseService(mockPrisma);
  });

  describe('Connection Management', () => {
    it('should connect to database', async () => {
      await databaseService.connect();
      expect(mockPrisma.$connect).toHaveBeenCalledTimes(1);
    });

    it('should disconnect from database', async () => {
      await databaseService.disconnect();
      expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
    });

    it('should check database health', async () => {
      const mockHealthData = {
        id: 1,
        status: 'healthy',
        lastCheck: new Date(),
        metadata: null,
      };

      mockPrisma.healthCheck.findFirst.mockResolvedValue(mockHealthData);

      const health = await databaseService.checkHealth();

      expect(health).toEqual(mockHealthData);
      expect(mockPrisma.healthCheck.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe('Conversation Operations', () => {
    it('should create a new conversation', async () => {
      const conversationData = {
        zendeskTicketId: 'ticket_123',
        customerId: 'customer_456',
        agentId: 'agent_789',
        status: 'active' as const,
      };

      const mockConversation = {
        id: 'conv_123',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...conversationData,
      };

      mockPrisma.conversation.create.mockResolvedValue(mockConversation);

      const result = await databaseService.createConversation(conversationData);

      expect(result).toEqual(mockConversation);
      expect(mockPrisma.conversation.create).toHaveBeenCalledWith({
        data: conversationData,
      });
    });

    it('should find conversation by ID', async () => {
      const conversationId = 'conv_123';
      const mockConversation = {
        id: conversationId,
        customerId: 'customer_456',
        agentId: 'agent_789',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await databaseService.findConversationById(conversationId);

      expect(result).toEqual(mockConversation);
      expect(mockPrisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: conversationId },
        include: { messages: true },
      });
    });

    it('should find conversations by agent', async () => {
      const agentId = 'agent_123';
      const mockConversations = [
        {
          id: 'conv_1',
          agentId,
          status: 'active',
          createdAt: new Date(),
        },
        {
          id: 'conv_2',
          agentId,
          status: 'resolved',
          createdAt: new Date(),
        },
      ];

      mockPrisma.conversation.findMany.mockResolvedValue(mockConversations);

      const result = await databaseService.findConversationsByAgent(agentId);

      expect(result).toEqual(mockConversations);
      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith({
        where: { agentId },
        include: { messages: true },
        orderBy: { updatedAt: 'desc' },
      });
    });
  });

  describe('Message Operations', () => {
    it('should create a new message', async () => {
      const messageData = {
        conversationId: 'conv_123',
        content: 'Hello, I need help',
        senderType: 'customer' as const,
        senderId: 'customer_456',
      };

      const mockMessage = {
        id: 'msg_123',
        timestamp: new Date(),
        createdAt: new Date(),
        ...messageData,
      };

      mockPrisma.message.create.mockResolvedValue(mockMessage);

      const result = await databaseService.createMessage(messageData);

      expect(result).toEqual(mockMessage);
      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: messageData,
      });
    });

    it('should add AI analysis to message', async () => {
      const messageId = 'msg_123';
      const aiAnalysis = {
        sentiment: { polarity: 'positive', confidence: 0.9 },
        intent: { primary: 'greeting', confidence: 0.85 },
        escalationRisk: 0.1,
      };

      const mockUpdatedMessage = {
        id: messageId,
        aiAnalysis,
        updatedAt: new Date(),
      };

      mockPrisma.message.update.mockResolvedValue(mockUpdatedMessage);

      const result = await databaseService.addAIAnalysis(messageId, aiAnalysis);

      expect(result).toEqual(mockUpdatedMessage);
      expect(mockPrisma.message.update).toHaveBeenCalledWith({
        where: { id: messageId },
        data: { aiAnalysis },
      });
    });
  });

  describe('Response Suggestion Operations', () => {
    it('should create response suggestions', async () => {
      const suggestionData = {
        messageId: 'msg_123',
        suggestionText: 'Thank you for contacting us!',
        suggestionType: 'template' as const,
        confidence: 0.95,
        reasoning: 'Standard greeting response',
      };

      const mockSuggestion = {
        id: 'sug_123',
        createdAt: new Date(),
        accepted: false,
        ...suggestionData,
      };

      mockPrisma.responseSuggestion.create.mockResolvedValue(mockSuggestion);

      const result =
        await databaseService.createResponseSuggestion(suggestionData);

      expect(result).toEqual(mockSuggestion);
      expect(mockPrisma.responseSuggestion.create).toHaveBeenCalledWith({
        data: suggestionData,
      });
    });

    it('should find suggestions for message', async () => {
      const messageId = 'msg_123';
      const mockSuggestions = [
        {
          id: 'sug_1',
          messageId,
          suggestionText: 'Response 1',
          confidence: 0.9,
        },
        {
          id: 'sug_2',
          messageId,
          suggestionText: 'Response 2',
          confidence: 0.8,
        },
      ];

      mockPrisma.responseSuggestion.findMany.mockResolvedValue(mockSuggestions);

      const result = await databaseService.findSuggestionsByMessage(messageId);

      expect(result).toEqual(mockSuggestions);
      expect(mockPrisma.responseSuggestion.findMany).toHaveBeenCalledWith({
        where: { messageId },
        orderBy: { confidence: 'desc' },
      });
    });
  });
});
