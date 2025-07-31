/**
 * GraphQL resolvers for ConversationIQ
 * Implements query, mutation, and subscription resolvers
 */

import { GraphQLError } from 'graphql';
import { DatabaseService } from '../services/database';
import { subscriptionResolvers, publishEvent } from './subscriptions';

// Context type definition
interface Context {
  db: DatabaseService;
  user?: {
    userId: string;
    email: string;
    role: string;
    zendeskId?: string;
    subdomain?: string;
    permissions?: string[];
  };
}

// Helper function to ensure authentication
function requireAuth(
  context: Context
): asserts context is Context & { user: NonNullable<Context['user']> } {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
}

// Helper function to ensure specific role
function requireRole(context: Context, allowedRoles: string[]): void {
  requireAuth(context);
  if (!allowedRoles.includes(context.user.role)) {
    throw new GraphQLError(`${allowedRoles.join(' or ')} role required`, {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}

// Helper function to validate input
function validateInput(
  input: any,
  rules: Record<string, (value: any) => string | null>
): void {
  for (const [field, validator] of Object.entries(rules)) {
    const error = validator(input[field]);
    if (error) {
      throw new GraphQLError(error, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
  }
}

export const resolvers = {
  // Query resolvers
  Query: {
    // Conversation queries
    async conversation(_: any, { id }: { id: string }, context: Context) {
      requireAuth(context);
      return await context.db.findConversationById(id);
    },

    async conversations(
      _: any,
      {
        filter = {},
        pagination = { limit: 20, offset: 0 },
      }: {
        filter?: any;
        pagination?: { limit: number; offset: number };
      },
      context: Context
    ) {
      requireAuth(context);

      // If no agentId in filter, use current user's ID for agents
      if (!filter.agentId && context.user.role === 'agent') {
        filter.agentId = context.user.userId;
      }

      return await context.db.findConversationsByAgent(
        filter.agentId || context.user.userId,
        { ...filter, ...pagination }
      );
    },

    // Message queries
    async message(_: any, { id }: { id: string }, context: Context) {
      requireAuth(context);
      return await context.db.findMessageById(id);
    },

    async messages(
      _: any,
      {
        conversationId,
        pagination = { limit: 20, offset: 0 },
      }: {
        conversationId: string;
        pagination?: { limit: number; offset: number };
      },
      context: Context
    ) {
      requireAuth(context);
      return await context.db.findMessagesByConversation(
        conversationId,
        pagination
      );
    },

    // Response suggestion queries
    async responseSuggestions(
      _: any,
      { messageId }: { messageId: string },
      context: Context
    ) {
      requireAuth(context);
      return await context.db.findSuggestionsByMessage(messageId);
    },

    async suggestion(_: any, { id }: { id: string }, context: Context) {
      requireAuth(context);
      // Will implement when we add suggestion-specific database methods
      throw new GraphQLError('Not implemented yet');
    },

    // Analytics queries
    async agentAnalytics(
      _: any,
      { agentId, filter = {} }: { agentId: string; filter?: any },
      context: Context
    ) {
      requireRole(context, ['agent', 'manager', 'admin']);

      // Agents can only access their own analytics unless they're managers/admins
      if (context.user.role === 'agent' && agentId !== context.user.userId) {
        throw new GraphQLError(
          'Access denied: Can only view your own analytics',
          {
            extensions: { code: 'FORBIDDEN' },
          }
        );
      }

      // Mock analytics data for now - will implement actual analytics service later
      return {
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
    },

    async conversationAnalytics(
      _: any,
      { conversationId }: { conversationId: string },
      context: Context
    ) {
      requireAuth(context);
      // Will implement when we add conversation analytics
      throw new GraphQLError('Not implemented yet');
    },

    async teamAnalytics(
      _: any,
      { filter = {} }: { filter?: any },
      context: Context
    ) {
      requireRole(context, ['manager', 'admin']);
      // Will implement team analytics
      throw new GraphQLError('Not implemented yet');
    },

    // Agent queries
    async agent(_: any, { id }: { id: string }, context: Context) {
      requireAuth(context);
      // Will implement when we add agent-specific database methods
      throw new GraphQLError('Not implemented yet');
    },

    async agents(
      _: any,
      { isActive }: { isActive?: boolean },
      context: Context
    ) {
      requireRole(context, ['manager', 'admin']);
      // Will implement agents query
      throw new GraphQLError('Not implemented yet');
    },

    async agentPerformance(
      _: any,
      {
        agentId,
        dateFrom,
        dateTo,
      }: {
        agentId: string;
        dateFrom?: Date;
        dateTo?: Date;
      },
      context: Context
    ) {
      requireRole(context, ['agent', 'manager', 'admin']);

      // Agents can only view their own performance
      if (context.user.role === 'agent' && agentId !== context.user.userId) {
        throw new GraphQLError(
          'Access denied: Can only view your own performance'
        );
      }

      // Will implement performance tracking
      throw new GraphQLError('Not implemented yet');
    },

    // Customer queries
    async customer(_: any, { id }: { id: string }, context: Context) {
      requireAuth(context);
      // Will implement customer queries
      throw new GraphQLError('Not implemented yet');
    },

    async customers(
      _: any,
      { pagination = { limit: 20, offset: 0 } }: { pagination?: any },
      context: Context
    ) {
      requireRole(context, ['agent', 'manager', 'admin']);
      // Will implement customers query
      throw new GraphQLError('Not implemented yet');
    },
  },

  // Mutation resolvers
  Mutation: {
    // Conversation mutations
    async createConversation(
      _: any,
      { input }: { input: any },
      context: Context
    ) {
      requireAuth(context);

      // Validate input
      validateInput(input, {
        ticketId: value => (!value ? 'Ticket ID is required' : null),
        agentId: value => (!value ? 'Agent ID is required' : null),
        customerId: value => (!value ? 'Customer ID is required' : null),
        status: value => (!value ? 'Status is required' : null),
      });

      return await context.db.createConversation(input);
    },

    async updateConversation(
      _: any,
      { id, input }: { id: string; input: any },
      context: Context
    ) {
      requireAuth(context);
      const conversation = await context.db.updateConversation(id, input);

      // Publish real-time event
      publishEvent.conversationUpdated({
        id: conversation.id,
        ticketId: conversation.ticketId,
        status: conversation.status,
        agentId: conversation.agentId,
        customerId: conversation.customerId,
        updatedAt: conversation.updatedAt,
      });

      return conversation;
    },

    async closeConversation(_: any, { id }: { id: string }, context: Context) {
      requireAuth(context);
      return await context.db.updateConversation(id, { status: 'CLOSED' });
    },

    // Message mutations
    async createMessage(_: any, { input }: { input: any }, context: Context) {
      requireAuth(context);

      // Validate input
      validateInput(input, {
        conversationId: value =>
          !value ? 'Conversation ID is required' : null,
        content: value =>
          !value || value.trim() === ''
            ? 'Message content cannot be empty'
            : null,
        sender: value => (!value ? 'Sender is required' : null),
      });

      // Add default processing status
      const messageData = {
        ...input,
        isProcessed: false,
      };

      const message = await context.db.createMessage(messageData);

      // Publish real-time event
      publishEvent.messageAdded({
        id: message.id,
        conversationId: message.conversationId,
        content: message.content,
        sender: message.sender,
        sentimentScore: message.sentimentScore,
        detectedIntent: message.detectedIntent,
        createdAt: message.createdAt,
      });

      return message;
    },

    async analyzeMessage(
      _: any,
      { messageId }: { messageId: string },
      context: Context
    ) {
      requireAuth(context);

      // Will implement AI analysis integration
      throw new GraphQLError('Message analysis not implemented yet');
    },

    // Response suggestion mutations
    async generateResponseSuggestions(
      _: any,
      { messageId }: { messageId: string },
      context: Context
    ) {
      requireAuth(context);
      return await context.db.createResponseSuggestions(messageId);
    },

    async acceptSuggestion(
      _: any,
      { suggestionId }: { suggestionId: string },
      context: Context
    ) {
      requireAuth(context);

      // Will implement suggestion acceptance tracking
      throw new GraphQLError('Suggestion acceptance not implemented yet');
    },

    async rejectSuggestion(
      _: any,
      { suggestionId }: { suggestionId: string },
      context: Context
    ) {
      requireAuth(context);

      // Will implement suggestion rejection tracking
      throw new GraphQLError('Suggestion rejection not implemented yet');
    },

    // Agent mutations
    async updateAgentStatus(
      _: any,
      { agentId, isActive }: { agentId: string; isActive: boolean },
      context: Context
    ) {
      requireRole(context, ['agent', 'manager', 'admin']);

      // Agents can only update their own status
      if (context.user.role === 'agent' && agentId !== context.user.userId) {
        throw new GraphQLError(
          'Access denied: Can only update your own status'
        );
      }

      // Will implement agent status updates
      throw new GraphQLError('Agent status update not implemented yet');
    },

    async recordAgentActivity(
      _: any,
      { agentId }: { agentId: string },
      context: Context
    ) {
      requireAuth(context);

      // Will implement activity recording
      throw new GraphQLError('Activity recording not implemented yet');
    },
  },

  // Type resolvers for nested fields
  Conversation: {
    async messages(parent: any, _: any, context: Context) {
      return await context.db.findMessagesByConversation(parent.id, {});
    },

    async analytics(parent: any, _: any, context: Context) {
      // Will implement conversation analytics
      return null;
    },

    async agent(parent: any, _: any, context: Context) {
      // Will implement agent resolution
      return null;
    },

    async customer(parent: any, _: any, context: Context) {
      // Will implement customer resolution
      return null;
    },
  },

  Message: {
    async conversation(parent: any, _: any, context: Context) {
      return await context.db.findConversationById(parent.conversationId);
    },

    async responseSuggestions(parent: any, _: any, context: Context) {
      return await context.db.findSuggestionsByMessage(parent.id);
    },

    async analysis(parent: any, _: any, context: Context) {
      // Will implement message analysis resolution
      return null;
    },
  },

  ResponseSuggestion: {
    async message(parent: any, _: any, context: Context) {
      return await context.db.findMessageById(parent.messageId);
    },
  },

  MessageAnalysis: {
    async message(parent: any, _: any, context: Context) {
      return await context.db.findMessageById(parent.messageId);
    },
  },

  ConversationAnalytics: {
    async conversation(parent: any, _: any, context: Context) {
      return await context.db.findConversationById(parent.conversationId);
    },
  },

  Agent: {
    async conversations(parent: any, _: any, context: Context) {
      return await context.db.findConversationsByAgent(parent.id, {});
    },

    async performance(parent: any, _: any, context: Context) {
      // Will implement performance resolution
      return null;
    },
  },

  Customer: {
    async conversations(parent: any, _: any, context: Context) {
      // Will implement customer conversations
      return [];
    },
  },

  AgentPerformance: {
    async agent(parent: any, _: any, context: Context) {
      // Will implement agent resolution
      return null;
    },
  },

  // Custom scalar resolvers
  DateTime: {
    serialize: (date: Date) => date.toISOString(),
    parseValue: (value: string) => new Date(value),
    parseLiteral: (ast: any) => new Date(ast.value),
  },

  JSON: {
    serialize: (value: any) => value,
    parseValue: (value: any) => value,
    parseLiteral: (ast: any) => JSON.parse(ast.value),
  },

  // Include subscription resolvers
  ...subscriptionResolvers,
};
