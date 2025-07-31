/**
 * Tests for GraphQL schema
 * Following TDD approach - tests written first
 */

import { describe, expect, it, beforeEach } from '@jest/globals';
import { buildSchema, print } from 'graphql';
import { typeDefs } from './schema';

describe('GraphQL Schema', () => {
  let schema: any;

  beforeEach(() => {
    // Convert AST to string and build schema
    const schemaString = print(typeDefs);
    schema = buildSchema(schemaString);
  });

  describe('Type Definitions', () => {
    it('should create a valid GraphQL schema', () => {
      expect(schema).toBeDefined();
      expect(schema.getQueryType()).toBeDefined();
      expect(schema.getMutationType()).toBeDefined();
      expect(schema.getSubscriptionType()).toBeDefined();
    });

    it('should define Conversation type', () => {
      const conversationType = schema.getType('Conversation');
      expect(conversationType).toBeDefined();
      expect(conversationType.name).toBe('Conversation');

      const fields = conversationType.getFields();
      expect(fields.id).toBeDefined();
      expect(fields.ticketId).toBeDefined();
      expect(fields.agentId).toBeDefined();
      expect(fields.customerId).toBeDefined();
      expect(fields.status).toBeDefined();
      expect(fields.createdAt).toBeDefined();
      expect(fields.updatedAt).toBeDefined();
    });

    it('should define Message type', () => {
      const messageType = schema.getType('Message');
      expect(messageType).toBeDefined();
      expect(messageType.name).toBe('Message');

      const fields = messageType.getFields();
      expect(fields.id).toBeDefined();
      expect(fields.conversationId).toBeDefined();
      expect(fields.content).toBeDefined();
      expect(fields.sender).toBeDefined();
      expect(fields.sentimentScore).toBeDefined();
      expect(fields.detectedIntent).toBeDefined();
      expect(fields.createdAt).toBeDefined();
    });

    it('should define ResponseSuggestion type', () => {
      const suggestionType = schema.getType('ResponseSuggestion');
      expect(suggestionType).toBeDefined();
      expect(suggestionType.name).toBe('ResponseSuggestion');

      const fields = suggestionType.getFields();
      expect(fields.id).toBeDefined();
      expect(fields.messageId).toBeDefined();
      expect(fields.suggestedResponse).toBeDefined();
      expect(fields.confidence).toBeDefined();
      expect(fields.macroId).toBeDefined();
      expect(fields.createdAt).toBeDefined();
    });

    it('should define Analytics type', () => {
      const analyticsType = schema.getType('Analytics');
      expect(analyticsType).toBeDefined();
      expect(analyticsType.name).toBe('Analytics');

      const fields = analyticsType.getFields();
      expect(fields.totalConversations).toBeDefined();
      expect(fields.averageSentiment).toBeDefined();
      expect(fields.responseTime).toBeDefined();
      expect(fields.resolutionRate).toBeDefined();
    });

    it('should define Query operations', () => {
      const queryType = schema.getQueryType();
      const fields = queryType.getFields();

      expect(fields.conversation).toBeDefined();
      expect(fields.conversations).toBeDefined();
      expect(fields.message).toBeDefined();
      expect(fields.messages).toBeDefined();
      expect(fields.responseSuggestions).toBeDefined();
      expect(fields.agentAnalytics).toBeDefined();
      expect(fields.conversationAnalytics).toBeDefined();
    });

    it('should define Mutation operations', () => {
      const mutationType = schema.getMutationType();
      const fields = mutationType.getFields();

      expect(fields.createConversation).toBeDefined();
      expect(fields.updateConversation).toBeDefined();
      expect(fields.createMessage).toBeDefined();
      expect(fields.generateResponseSuggestions).toBeDefined();
      expect(fields.acceptSuggestion).toBeDefined();
      expect(fields.rejectSuggestion).toBeDefined();
    });

    it('should define Subscription operations', () => {
      const subscriptionType = schema.getSubscriptionType();
      const fields = subscriptionType.getFields();

      expect(fields.conversationUpdated).toBeDefined();
      expect(fields.messageAdded).toBeDefined();
      expect(fields.responseSuggested).toBeDefined();
      expect(fields.sentimentAnalyzed).toBeDefined();
      expect(fields.agentStatusChanged).toBeDefined();
      expect(fields.conversationAssigned).toBeDefined();
    });
  });

  describe('Enum Types', () => {
    it('should define ConversationStatus enum', () => {
      const statusEnum = schema.getType('ConversationStatus');
      expect(statusEnum).toBeDefined();
      expect(statusEnum.name).toBe('ConversationStatus');

      const values = statusEnum.getValues();
      expect(values.find((v: any) => v.name === 'OPEN')).toBeDefined();
      expect(values.find((v: any) => v.name === 'PENDING')).toBeDefined();
      expect(values.find((v: any) => v.name === 'SOLVED')).toBeDefined();
      expect(values.find((v: any) => v.name === 'CLOSED')).toBeDefined();
    });

    it('should define MessageSender enum', () => {
      const senderEnum = schema.getType('MessageSender');
      expect(senderEnum).toBeDefined();
      expect(senderEnum.name).toBe('MessageSender');

      const values = senderEnum.getValues();
      expect(values.find((v: any) => v.name === 'AGENT')).toBeDefined();
      expect(values.find((v: any) => v.name === 'CUSTOMER')).toBeDefined();
      expect(values.find((v: any) => v.name === 'SYSTEM')).toBeDefined();
    });
  });

  describe('Input Types', () => {
    it('should define ConversationInput type', () => {
      const inputType = schema.getType('ConversationInput');
      expect(inputType).toBeDefined();
      expect(inputType.name).toBe('ConversationInput');

      const fields = inputType.getFields();
      expect(fields.ticketId).toBeDefined();
      expect(fields.agentId).toBeDefined();
      expect(fields.customerId).toBeDefined();
      expect(fields.status).toBeDefined();
    });

    it('should define MessageInput type', () => {
      const inputType = schema.getType('MessageInput');
      expect(inputType).toBeDefined();
      expect(inputType.name).toBe('MessageInput');

      const fields = inputType.getFields();
      expect(fields.conversationId).toBeDefined();
      expect(fields.content).toBeDefined();
      expect(fields.sender).toBeDefined();
    });

    it('should define AnalyticsFilter type', () => {
      const filterType = schema.getType('AnalyticsFilter');
      expect(filterType).toBeDefined();
      expect(filterType.name).toBe('AnalyticsFilter');

      const fields = filterType.getFields();
      expect(fields.agentId).toBeDefined();
      expect(fields.dateFrom).toBeDefined();
      expect(fields.dateTo).toBeDefined();
      expect(fields.status).toBeDefined();
    });
  });
});
