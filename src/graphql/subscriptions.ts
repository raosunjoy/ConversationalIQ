/**
 * GraphQL subscription resolvers for real-time events
 * Handles WebSocket connections and event streaming
 */

import { PubSub, withFilter } from 'graphql-subscriptions';
import { GraphQLContext } from './server';

// Create PubSub instance for managing subscriptions
export const pubsub = new PubSub();

// Subscription event types
export const SUBSCRIPTION_EVENTS = {
  MESSAGE_ADDED: 'MESSAGE_ADDED',
  CONVERSATION_UPDATED: 'CONVERSATION_UPDATED', 
  SENTIMENT_ANALYZED: 'SENTIMENT_ANALYZED',
  RESPONSE_SUGGESTED: 'RESPONSE_SUGGESTED',
  AGENT_STATUS_CHANGED: 'AGENT_STATUS_CHANGED',
  CONVERSATION_ASSIGNED: 'CONVERSATION_ASSIGNED',
} as const;

// Type definitions for subscription payloads
export interface MessageAddedPayload {
  messageAdded: {
    id: string;
    conversationId: string;
    content: string;
    sender: 'AGENT' | 'CUSTOMER';
    sentimentScore?: number;
    detectedIntent?: string;
    createdAt: Date;
  };
}

export interface ConversationUpdatedPayload {
  conversationUpdated: {
    id: string;
    ticketId: string;
    status: 'OPEN' | 'PENDING' | 'SOLVED' | 'CLOSED';
    agentId?: string;
    customerId: string;
    updatedAt: Date;
  };
}

export interface SentimentAnalyzedPayload {
  sentimentAnalyzed: {
    messageId: string;
    conversationId: string;
    score: number;
    confidence: number;
    emotions: string[];
  };
}

export interface ResponseSuggestedPayload {
  responseSuggested: {
    conversationId: string;
    suggestions: Array<{
      id: string;
      content: string;
      confidence: number;
      category: string;
    }>;
  };
}

export interface AgentStatusChangedPayload {
  agentStatusChanged: {
    agentId: string;
    status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY';
    timestamp: Date;
  };
}

export interface ConversationAssignedPayload {
  conversationAssigned: {
    conversationId: string;
    agentId: string;
    assignedAt: Date;
  };
}

// Helper functions for authentication in subscriptions
function requireAuth(context: GraphQLContext) {
  if (!context.user) {
    throw new Error('Authentication required for subscription');
  }
}

function requireRole(context: GraphQLContext, allowedRoles: string[]) {
  requireAuth(context);
  if (!context.user || !allowedRoles.includes(context.user.role)) {
    throw new Error(`Subscription requires one of: ${allowedRoles.join(', ')}`);
  }
}

// Subscription resolvers
export const subscriptionResolvers = {
  Subscription: {
    messageAdded: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([SUBSCRIPTION_EVENTS.MESSAGE_ADDED]),
        (payload: MessageAddedPayload, variables: { conversationId?: string }, context: GraphQLContext) => {
          // Require authentication
          requireAuth(context);
          
          // Filter by conversation ID if specified
          if (variables.conversationId) {
            return payload.messageAdded.conversationId === variables.conversationId;
          }
          
          // For agents/managers, return all messages they have access to
          // TODO: Implement proper access control based on assigned conversations
          return true;
        }
      ),
    },

    conversationUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([SUBSCRIPTION_EVENTS.CONVERSATION_UPDATED]),
        (payload: ConversationUpdatedPayload, variables: { conversationId?: string }, context: GraphQLContext) => {
          requireAuth(context);
          
          // Filter by conversation ID if specified
          if (variables.conversationId) {
            return payload.conversationUpdated.id === variables.conversationId;
          }
          
          // For agents, only show conversations they're assigned to or have access to
          if (context.user?.role === 'agent') {
            return payload.conversationUpdated.agentId === context.user.userId;
          }
          
          // Managers and admins can see all conversations
          return ['manager', 'admin'].includes(context.user?.role || '');
        }
      ),
    },

    sentimentAnalyzed: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([SUBSCRIPTION_EVENTS.SENTIMENT_ANALYZED]),
        (payload: SentimentAnalyzedPayload, variables: { conversationId?: string }, context: GraphQLContext) => {
          requireAuth(context);
          
          // Filter by conversation ID if specified
          if (variables.conversationId) {
            return payload.sentimentAnalyzed.conversationId === variables.conversationId;
          }
          
          return true;
        }
      ),
    },

    responseSuggested: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([SUBSCRIPTION_EVENTS.RESPONSE_SUGGESTED]),
        (payload: ResponseSuggestedPayload, variables: { conversationId?: string }, context: GraphQLContext) => {
          requireRole(context, ['agent', 'manager', 'admin']);
          
          // Filter by conversation ID if specified
          if (variables.conversationId) {
            return payload.responseSuggested.conversationId === variables.conversationId;
          }
          
          return true;
        }
      ),
    },

    agentStatusChanged: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([SUBSCRIPTION_EVENTS.AGENT_STATUS_CHANGED]),
        (payload: AgentStatusChangedPayload, variables: { agentId?: string }, context: GraphQLContext) => {
          requireRole(context, ['agent', 'manager', 'admin']);
          
          // Filter by agent ID if specified
          if (variables.agentId) {
            return payload.agentStatusChanged.agentId === variables.agentId;
          }
          
          return true;
        }
      ),
    },

    conversationAssigned: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([SUBSCRIPTION_EVENTS.CONVERSATION_ASSIGNED]),
        (payload: ConversationAssignedPayload, variables: { agentId?: string }, context: GraphQLContext) => {
          requireAuth(context);
          
          // Agents only see assignments to themselves
          if (context.user?.role === 'agent') {
            return payload.conversationAssigned.agentId === context.user.userId;
          }
          
          // Filter by agent ID if specified and user is manager/admin
          if (variables.agentId && ['manager', 'admin'].includes(context.user?.role || '')) {
            return payload.conversationAssigned.agentId === variables.agentId;
          }
          
          // Managers and admins can see all assignments
          return ['manager', 'admin'].includes(context.user?.role || '');
        }
      ),
    },
  },
};

// Utility functions for publishing events
export const publishEvent = {
  messageAdded: (message: MessageAddedPayload['messageAdded']) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.MESSAGE_ADDED, { messageAdded: message });
  },

  conversationUpdated: (conversation: ConversationUpdatedPayload['conversationUpdated']) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.CONVERSATION_UPDATED, { conversationUpdated: conversation });
  },

  sentimentAnalyzed: (analysis: SentimentAnalyzedPayload['sentimentAnalyzed']) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.SENTIMENT_ANALYZED, { sentimentAnalyzed: analysis });
  },

  responseSuggested: (suggestion: ResponseSuggestedPayload['responseSuggested']) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.RESPONSE_SUGGESTED, { responseSuggested: suggestion });
  },

  agentStatusChanged: (status: AgentStatusChangedPayload['agentStatusChanged']) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.AGENT_STATUS_CHANGED, { agentStatusChanged: status });
  },

  conversationAssigned: (assignment: ConversationAssignedPayload['conversationAssigned']) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.CONVERSATION_ASSIGNED, { conversationAssigned: assignment });
  },
};