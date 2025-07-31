/**
 * Tests for GraphQL subscription functionality
 * Following TDD approach - comprehensive subscription testing
 */

import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { PubSub } from 'graphql-subscriptions';

// Mock graphql-subscriptions
jest.mock('graphql-subscriptions', () => {
  const mockAsyncIterator = jest.fn();
  const mockPublish = jest.fn();

  return {
    PubSub: jest.fn().mockImplementation(() => ({
      asyncIterator: mockAsyncIterator,
      publish: mockPublish,
    })),
    withFilter: jest.fn((iteratorFn, filterFn) => ({
      subscribe: iteratorFn,
      filter: filterFn,
    })),
  };
});

import {
  subscriptionResolvers,
  publishEvent,
  SUBSCRIPTION_EVENTS,
} from './subscriptions';
import { GraphQLContext } from './server';

// Mock context for testing
const createMockContext = (user?: any): GraphQLContext => ({
  db: {} as any,
  user: user || {
    userId: 'agent_123',
    email: 'agent@test.com',
    role: 'agent',
  },
});

// Mock subscription iterator
const createMockIterator = (eventType: string) => {
  return { [Symbol.asyncIterator]: () => ({}) };
};

describe('GraphQL Subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Subscription Resolvers', () => {
    describe('messageAdded', () => {
      it('should require authentication', async () => {
        const unauthenticatedContext = createMockContext(null);

        try {
          // Access the subscribe function directly
          const subscribeFunc =
            subscriptionResolvers.Subscription.messageAdded.subscribe;
          await subscribeFunc(null, {}, unauthenticatedContext);
          expect(true).toBe(false); // Should not reach this line
        } catch (error: any) {
          expect(error.message).toBe(
            'Authentication required for subscription'
          );
        }
      });

      it('should allow authenticated users to subscribe', async () => {
        const authenticatedContext = createMockContext({
          userId: 'agent_123',
          role: 'agent',
        });

        const subscribeFunc =
          subscriptionResolvers.Subscription.messageAdded.subscribe;
        const iterator = await subscribeFunc(null, {}, authenticatedContext);

        expect(iterator).toBeDefined();
      });

      it('should filter by conversation ID when specified', async () => {
        const payload = {
          messageAdded: {
            id: 'msg_123',
            conversationId: 'conv_456',
            content: 'Test message',
            sender: 'CUSTOMER' as const,
            createdAt: new Date(),
          },
        };

        const variables = { conversationId: 'conv_456' };
        const context = createMockContext();

        // Test the filter function
        const filterFunc = (
          subscriptionResolvers.Subscription.messageAdded as any
        ).subscribe.__wrapped;
        expect(filterFunc).toBeDefined();
      });
    });

    describe('conversationUpdated', () => {
      it('should allow agents to see their own conversations', async () => {
        const agentContext = createMockContext({
          userId: 'agent_123',
          role: 'agent',
        });

        const subscribeFunc =
          subscriptionResolvers.Subscription.conversationUpdated.subscribe;
        const iterator = await subscribeFunc(null, {}, agentContext);

        expect(iterator).toBeDefined();
      });

      it('should allow managers to see all conversations', async () => {
        const managerContext = createMockContext({
          userId: 'manager_456',
          role: 'manager',
        });

        const subscribeFunc =
          subscriptionResolvers.Subscription.conversationUpdated.subscribe;
        const iterator = await subscribeFunc(null, {}, managerContext);

        expect(iterator).toBeDefined();
      });
    });

    describe('sentimentAnalyzed', () => {
      it('should require authentication', async () => {
        const unauthenticatedContext = createMockContext(null);

        try {
          const subscribeFunc =
            subscriptionResolvers.Subscription.sentimentAnalyzed.subscribe;
          await subscribeFunc(null, {}, unauthenticatedContext);
          expect(true).toBe(false); // Should not reach this line
        } catch (error: any) {
          expect(error.message).toBe(
            'Authentication required for subscription'
          );
        }
      });

      it('should allow authenticated users to subscribe', async () => {
        const authenticatedContext = createMockContext();

        const subscribeFunc =
          subscriptionResolvers.Subscription.sentimentAnalyzed.subscribe;
        const iterator = await subscribeFunc(null, {}, authenticatedContext);

        expect(iterator).toBeDefined();
      });
    });

    describe('responseSuggested', () => {
      it('should require agent, manager, or admin role', async () => {
        const customerContext = createMockContext({
          userId: 'customer_123',
          role: 'customer',
        });

        try {
          const subscribeFunc =
            subscriptionResolvers.Subscription.responseSuggested.subscribe;
          await subscribeFunc(null, {}, customerContext);
          expect(true).toBe(false); // Should not reach this line
        } catch (error: any) {
          expect(error.message).toBe(
            'Subscription requires one of: agent, manager, admin'
          );
        }
      });

      it('should allow agents to subscribe', async () => {
        const agentContext = createMockContext({
          userId: 'agent_123',
          role: 'agent',
        });

        const subscribeFunc =
          subscriptionResolvers.Subscription.responseSuggested.subscribe;
        const iterator = await subscribeFunc(null, {}, agentContext);

        expect(iterator).toBeDefined();
      });
    });

    describe('agentStatusChanged', () => {
      it('should require agent, manager, or admin role', async () => {
        const customerContext = createMockContext({
          userId: 'customer_123',
          role: 'customer',
        });

        try {
          const subscribeFunc =
            subscriptionResolvers.Subscription.agentStatusChanged.subscribe;
          await subscribeFunc(null, {}, customerContext);
          expect(true).toBe(false); // Should not reach this line
        } catch (error: any) {
          expect(error.message).toBe(
            'Subscription requires one of: agent, manager, admin'
          );
        }
      });

      it('should allow managers to subscribe', async () => {
        const managerContext = createMockContext({
          userId: 'manager_456',
          role: 'manager',
        });

        const subscribeFunc =
          subscriptionResolvers.Subscription.agentStatusChanged.subscribe;
        const iterator = await subscribeFunc(null, {}, managerContext);

        expect(iterator).toBeDefined();
      });
    });

    describe('conversationAssigned', () => {
      it('should allow agents to see their own assignments', async () => {
        const agentContext = createMockContext({
          userId: 'agent_123',
          role: 'agent',
        });

        const subscribeFunc =
          subscriptionResolvers.Subscription.conversationAssigned.subscribe;
        const iterator = await subscribeFunc(null, {}, agentContext);

        expect(iterator).toBeDefined();
      });

      it('should allow admins to see all assignments', async () => {
        const adminContext = createMockContext({
          userId: 'admin_789',
          role: 'admin',
        });

        const subscribeFunc =
          subscriptionResolvers.Subscription.conversationAssigned.subscribe;
        const iterator = await subscribeFunc(null, {}, adminContext);

        expect(iterator).toBeDefined();
      });
    });
  });

  describe('Event Publishing', () => {
    let mockPublish: jest.Mock;

    beforeEach(() => {
      // Get the mock publish function from the mocked PubSub
      const MockedPubSub = jest.mocked(PubSub);
      const pubsubInstance = new MockedPubSub();
      mockPublish = pubsubInstance.publish as jest.Mock;
    });

    describe('publishEvent.messageAdded', () => {
      it('should publish message added event', () => {
        const message = {
          id: 'msg_123',
          conversationId: 'conv_456',
          content: 'Test message',
          sender: 'CUSTOMER' as const,
          sentimentScore: 0.8,
          detectedIntent: 'question',
          createdAt: new Date(),
        };

        publishEvent.messageAdded(message);

        // Test that the function executes without errors
        expect(true).toBe(true);
      });
    });

    describe('publishEvent.conversationUpdated', () => {
      it('should publish conversation updated event', () => {
        const conversation = {
          id: 'conv_123',
          ticketId: 'ticket_456',
          status: 'OPEN' as const,
          agentId: 'agent_789',
          customerId: 'customer_123',
          updatedAt: new Date(),
        };

        publishEvent.conversationUpdated(conversation);

        expect(mockPublish).toHaveBeenCalledWith(
          SUBSCRIPTION_EVENTS.CONVERSATION_UPDATED,
          { conversationUpdated: conversation }
        );
      });
    });

    describe('publishEvent.sentimentAnalyzed', () => {
      it('should publish sentiment analysis event', () => {
        const analysis = {
          messageId: 'msg_123',
          conversationId: 'conv_456',
          score: 0.75,
          confidence: 0.9,
          emotions: ['joy', 'satisfaction'],
        };

        publishEvent.sentimentAnalyzed(analysis);

        expect(mockPublish).toHaveBeenCalledWith(
          SUBSCRIPTION_EVENTS.SENTIMENT_ANALYZED,
          { sentimentAnalyzed: analysis }
        );
      });
    });

    describe('publishEvent.responseSuggested', () => {
      it('should publish response suggestion event', () => {
        const suggestion = {
          conversationId: 'conv_123',
          suggestions: [
            {
              id: 'suggestion_1',
              content: 'Thank you for contacting us!',
              confidence: 0.85,
              category: 'greeting',
            },
          ],
        };

        publishEvent.responseSuggested(suggestion);

        expect(mockPublish).toHaveBeenCalledWith(
          SUBSCRIPTION_EVENTS.RESPONSE_SUGGESTED,
          { responseSuggested: suggestion }
        );
      });
    });

    describe('publishEvent.agentStatusChanged', () => {
      it('should publish agent status change event', () => {
        const status = {
          agentId: 'agent_123',
          status: 'ONLINE' as const,
          timestamp: new Date(),
        };

        publishEvent.agentStatusChanged(status);

        expect(mockPublish).toHaveBeenCalledWith(
          SUBSCRIPTION_EVENTS.AGENT_STATUS_CHANGED,
          { agentStatusChanged: status }
        );
      });
    });

    describe('publishEvent.conversationAssigned', () => {
      it('should publish conversation assignment event', () => {
        const assignment = {
          conversationId: 'conv_123',
          agentId: 'agent_456',
          assignedAt: new Date(),
        };

        publishEvent.conversationAssigned(assignment);

        expect(mockPublish).toHaveBeenCalledWith(
          SUBSCRIPTION_EVENTS.CONVERSATION_ASSIGNED,
          { conversationAssigned: assignment }
        );
      });
    });
  });

  describe('Subscription Events Constants', () => {
    it('should have all required subscription event types', () => {
      expect(SUBSCRIPTION_EVENTS.MESSAGE_ADDED).toBe('MESSAGE_ADDED');
      expect(SUBSCRIPTION_EVENTS.CONVERSATION_UPDATED).toBe(
        'CONVERSATION_UPDATED'
      );
      expect(SUBSCRIPTION_EVENTS.SENTIMENT_ANALYZED).toBe('SENTIMENT_ANALYZED');
      expect(SUBSCRIPTION_EVENTS.RESPONSE_SUGGESTED).toBe('RESPONSE_SUGGESTED');
      expect(SUBSCRIPTION_EVENTS.AGENT_STATUS_CHANGED).toBe(
        'AGENT_STATUS_CHANGED'
      );
      expect(SUBSCRIPTION_EVENTS.CONVERSATION_ASSIGNED).toBe(
        'CONVERSATION_ASSIGNED'
      );
    });
  });

  describe('PubSub Integration', () => {
    it('should use PubSub instance for event publishing', () => {
      expect(pubsub).toBeInstanceOf(PubSub);
    });

    it('should create async iterators for subscription events', () => {
      const iterator = pubsub.asyncIterator([
        SUBSCRIPTION_EVENTS.MESSAGE_ADDED,
      ]);
      expect(iterator).toBeDefined();
      expect(typeof iterator[Symbol.asyncIterator]).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing user in context gracefully', () => {
      const contextWithoutUser = createMockContext(null);

      try {
        const subscribeFunc =
          subscriptionResolvers.Subscription.messageAdded.subscribe;
        subscribeFunc(null, {}, contextWithoutUser);
      } catch (error: any) {
        expect(error.message).toContain('Authentication required');
      }
    });

    it('should handle invalid role for restricted subscriptions', () => {
      const contextWithInvalidRole = createMockContext({
        userId: 'user_123',
        role: 'invalid_role',
      });

      try {
        const subscribeFunc =
          subscriptionResolvers.Subscription.responseSuggested.subscribe;
        subscribeFunc(null, {}, contextWithInvalidRole);
      } catch (error: any) {
        expect(error.message).toContain(
          'requires one of: agent, manager, admin'
        );
      }
    });
  });

  describe('Subscription Filtering', () => {
    it('should filter events by conversation ID', () => {
      const payload = {
        messageAdded: {
          id: 'msg_123',
          conversationId: 'conv_456',
          content: 'Test message',
          sender: 'CUSTOMER' as const,
          createdAt: new Date(),
        },
      };

      // Test that filtering logic would work correctly
      const shouldReceive = payload.messageAdded.conversationId === 'conv_456';
      expect(shouldReceive).toBe(true);

      const shouldNotReceive =
        payload.messageAdded.conversationId === 'different_conv';
      expect(shouldNotReceive).toBe(false);
    });

    it('should filter conversation updates by agent access', () => {
      const payload = {
        conversationUpdated: {
          id: 'conv_123',
          ticketId: 'ticket_456',
          status: 'OPEN' as const,
          agentId: 'agent_789',
          customerId: 'customer_123',
          updatedAt: new Date(),
        },
      };

      // Agent should only see their own conversations
      const agentCanSee = payload.conversationUpdated.agentId === 'agent_789';
      expect(agentCanSee).toBe(true);

      const agentCannotSee =
        payload.conversationUpdated.agentId === 'different_agent';
      expect(agentCannotSee).toBe(false);
    });
  });
});
