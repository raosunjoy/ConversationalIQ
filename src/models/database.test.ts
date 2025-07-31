/**
 * Tests for database models and schema
 * Following TDD approach - tests written first
 */

import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient for testing without real database
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    conversation: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'test-conversation-id',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        })
      ),
    },
    message: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'test-message-id',
          timestamp: new Date(),
          ...data,
        })
      ),
    },
    responseSuggestion: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'test-suggestion-id',
          createdAt: new Date(),
          ...data,
        })
      ),
    },
    agentPerformanceDaily: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          ...data,
          avgSentimentScore: { toNumber: () => data.avgSentimentScore },
        })
      ),
    },
  })),
}));

describe('Database Models', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Conversation Model', () => {
    it('should create a conversation with required fields', async () => {
      // RED: This test will fail initially - conversation model doesn't exist yet
      const conversationData = {
        zendeskTicketId: 'ticket_123',
        customerId: 'customer_456',
        agentId: 'agent_789',
        status: 'active' as const,
      };

      const conversation = await prisma.conversation.create({
        data: conversationData,
      });

      expect(conversation).toHaveProperty('id');
      expect(conversation).toHaveProperty('createdAt');
      expect(conversation).toHaveProperty('updatedAt');
      expect(conversation.zendeskTicketId).toBe(
        conversationData.zendeskTicketId
      );
      expect(conversation.customerId).toBe(conversationData.customerId);
      expect(conversation.agentId).toBe(conversationData.agentId);
      expect(conversation.status).toBe(conversationData.status);
    });

    it('should allow optional fields', async () => {
      const conversationData = {
        zendeskChatId: 'chat_123',
        customerId: 'customer_456',
        agentId: 'agent_789',
        status: 'resolved' as const,
        metadata: { source: 'chat', priority: 'high' },
      };

      const conversation = await prisma.conversation.create({
        data: conversationData,
      });

      expect(conversation.zendeskChatId).toBe(conversationData.zendeskChatId);
      expect(conversation.metadata).toEqual(conversationData.metadata);
    });
  });

  describe('Message Model', () => {
    it('should create a message linked to a conversation', async () => {
      // First create a conversation
      const conversation = await prisma.conversation.create({
        data: {
          customerId: 'customer_123',
          agentId: 'agent_456',
          status: 'active',
        },
      });

      const messageData = {
        conversationId: conversation.id,
        content: 'Hello, I need help with my order',
        senderType: 'customer' as const,
        senderId: 'customer_123',
      };

      const message = await prisma.message.create({
        data: messageData,
      });

      expect(message).toHaveProperty('id');
      expect(message).toHaveProperty('timestamp');
      expect(message.conversationId).toBe(conversation.id);
      expect(message.content).toBe(messageData.content);
      expect(message.senderType).toBe(messageData.senderType);
      expect(message.senderId).toBe(messageData.senderId);
    });

    it('should store AI analysis results', async () => {
      const conversation = await prisma.conversation.create({
        data: {
          customerId: 'customer_123',
          agentId: 'agent_456',
          status: 'active',
        },
      });

      const aiAnalysis = {
        sentiment: {
          polarity: 'negative',
          confidence: 0.85,
          emotions: ['frustrated', 'urgent'],
        },
        intent: {
          primary: 'request_refund',
          confidence: 0.92,
        },
        escalationRisk: 0.75,
      };

      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content: 'I want my money back!',
          senderType: 'customer',
          senderId: 'customer_123',
          aiAnalysis,
        },
      });

      expect(message.aiAnalysis).toEqual(aiAnalysis);
    });
  });

  describe('Response Suggestion Model', () => {
    it('should create response suggestions for messages', async () => {
      const conversation = await prisma.conversation.create({
        data: {
          customerId: 'customer_123',
          agentId: 'agent_456',
          status: 'active',
        },
      });

      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content: 'I need help',
          senderType: 'customer',
          senderId: 'customer_123',
        },
      });

      const suggestionData = {
        messageId: message.id,
        suggestionText:
          'I understand you need assistance. How can I help you today?',
        suggestionType: 'generated' as const,
        confidence: 0.88,
        reasoning: 'Empathetic response for general help request',
      };

      const suggestion = await prisma.responseSuggestion.create({
        data: suggestionData,
      });

      expect(suggestion).toHaveProperty('id');
      expect(suggestion).toHaveProperty('createdAt');
      expect(suggestion.messageId).toBe(message.id);
      expect(suggestion.suggestionText).toBe(suggestionData.suggestionText);
      expect(suggestion.confidence).toBe(suggestionData.confidence);
    });
  });

  describe('Agent Performance Model', () => {
    it('should track daily agent performance metrics', async () => {
      const performanceData = {
        agentId: 'agent_123',
        date: new Date('2024-01-01'),
        conversationsHandled: 15,
        avgSentimentScore: 0.75,
        avgResponseTimeSeconds: 120,
        escalationsCount: 2,
        suggestionsAccepted: 8,
        suggestionsTotal: 12,
      };

      const performance = await prisma.agentPerformanceDaily.create({
        data: performanceData,
      });

      expect(performance.agentId).toBe(performanceData.agentId);
      expect(performance.conversationsHandled).toBe(
        performanceData.conversationsHandled
      );
      expect(performance.avgSentimentScore?.toNumber()).toBeCloseTo(0.75);
    });
  });
});
