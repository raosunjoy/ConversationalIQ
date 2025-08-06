/**
 * GraphQL resolvers for ConversationIQ
 * Implements query, mutation, and subscription resolvers
 */

import { GraphQLError } from 'graphql';
import { DatabaseService } from '../services/database';
import { subscriptionResolvers, publishEvent } from './subscriptions';
import { aiService } from '../services/ai-service';
import { aiPipeline } from '../ai/ai-pipeline';

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
  context: Context | undefined
): asserts context is Context & { user: NonNullable<Context['user']> } {
  if (!context || !context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
}

// Helper function to ensure specific role
function requireRole(context: Context, allowedRoles: string[]): void {
  requireAuth(context);
  if (!allowedRoles.includes(context.user?.role || '')) {
    throw new GraphQLError(`${allowedRoles.join(' or ')} role required`, {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}

// Helper function to map database status to GraphQL status
function mapStatusToGraphQL(dbStatus: string): string {
  const statusMap: Record<string, string> = {
    active: 'OPEN',
    open: 'OPEN',
    pending: 'PENDING',
    closed: 'CLOSED',
    solved: 'SOLVED',
  };
  return statusMap[dbStatus.toLowerCase()] || 'OPEN';
}

// Helper function to map GraphQL status to database status
function mapStatusToDatabase(graphQLStatus: string): string {
  const statusMap: Record<string, string> = {
    OPEN: 'active',
    PENDING: 'pending',
    CLOSED: 'closed',
    SOLVED: 'solved',
  };
  return statusMap[graphQLStatus] || 'active';
}

// Helper function to extract sender info from message
function getMessageSender(message: any): 'AGENT' | 'CUSTOMER' {
  // Return the senderType as the GraphQL enum expects
  if (message.senderType === 'AGENT') {
    return 'AGENT';
  } else if (message.senderType === 'CUSTOMER') {
    return 'CUSTOMER';
  }
  return 'CUSTOMER'; // Default fallback
}

// Helper function to extract sentiment score from AI analysis
function getSentimentScore(message: any): number {
  if (message.aiAnalysis && typeof message.aiAnalysis === 'object') {
    const analysis = message.aiAnalysis as any;
    return analysis.sentimentScore || 0;
  }
  return 0;
}

// Helper function to extract detected intent from AI analysis
function getDetectedIntent(message: any): string | null {
  if (message.aiAnalysis && typeof message.aiAnalysis === 'object') {
    const analysis = message.aiAnalysis as any;
    return analysis.detectedIntent || null;
  }
  return null;
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
      if (!filter.agentId && context.user?.role === 'agent') {
        filter.agentId = context.user?.userId;
      }

      return await context.db.findConversationsByAgent(
        filter.agentId || context.user?.userId || ''
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
      return await context.db.findMessagesByConversation(conversationId);
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
      if (context.user?.role === 'agent' && agentId !== context.user?.userId) {
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
      if (context.user?.role === 'agent' && agentId !== context.user?.userId) {
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

    // Escalation Prevention queries
    async getActiveEscalationRisks(
      _: any,
      __: any,
      context: Context
    ) {
      requireRole(context, ['agent', 'manager', 'admin']);
      
      try {
        const risks = await aiPipeline.getActiveEscalationRisks();
        return {
          highRiskConversations: risks.high.map(risk => ({
            conversationId: risk.conversationId,
            riskScore: risk.riskScore,
            riskLevel: risk.riskLevel,
            timeToEscalation: risk.prediction.timeToEscalation,
            escalationProbability: risk.prediction.escalationProbability,
            riskFactors: risk.riskFactors.map(factor => ({
              type: factor.type,
              severity: factor.severity,
              description: factor.description,
            })),
            preventionActions: risk.preventionActions.map(action => ({
              type: action.type,
              priority: action.priority,
              description: action.description,
              estimatedImpact: action.estimatedImpact,
            })),
            managerAlert: risk.managerAlert,
          })),
          mediumRiskConversations: risks.medium,
          totalAtRisk: risks.total,
        };
      } catch (error) {
        console.error('Failed to get escalation risks:', error);
        throw new GraphQLError(
          `Failed to get escalation risks: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },

    async getConversationContext(
      _: any,
      { conversationId }: { conversationId: string },
      context: Context
    ) {
      requireAuth(context);
      
      try {
        // Get conversation memory and customer profile
        const { conversationContextService } = await import('../ai/context/conversation-context');
        const memory = await conversationContextService.getConversationMemory(conversationId);
        const profile = await conversationContextService.getCustomerProfile(conversationId);

        return {
          conversationId: memory.conversationId,
          customerProfile: {
            id: profile.id,
            email: profile.email,
            tier: profile.tier,
            totalTickets: profile.totalTickets,
            totalSpent: profile.totalSpent,
            satisfaction: profile.satisfaction,
            language: profile.language,
            timezone: profile.timezone,
            preferences: profile.preferences,
            history: profile.history,
            segments: profile.segments,
          },
          conversationMemory: {
            startTime: memory.startTime,
            context: memory.context,
            timeline: memory.timeline,
            summary: memory.summary,
          },
        };
      } catch (error) {
        console.error('Failed to get conversation context:', error);
        throw new GraphQLError(
          `Failed to get conversation context: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
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
        ticketId: conversation.zendeskTicketId || '',
        status: mapStatusToGraphQL(conversation.status) as any,
        agentId: conversation.agentId,
        customerId: conversation.customerId,
        updatedAt: conversation.updatedAt,
      });

      return conversation;
    },

    async closeConversation(_: any, { id }: { id: string }, context: Context) {
      requireAuth(context);
      return await context.db.updateConversation(id, {
        status: mapStatusToDatabase('CLOSED') as any,
      });
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

      // Trigger AI processing in the background (don't wait for completion)
      aiService
        .processMessage(message.id, message.conversationId, {
          publishEvents: true,
          storeResults: true,
          skipIfProcessed: false,
        })
        .catch(error => {
          console.error(
            `Background AI processing failed for message ${message.id}:`,
            error
          );
        });

      // Publish real-time event
      publishEvent.messageAdded({
        id: message.id,
        conversationId: message.conversationId,
        content: message.content,
        sender: getMessageSender(message),
        sentimentScore: getSentimentScore(message),
        detectedIntent: getDetectedIntent(message) || '',
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

      try {
        // Get message to find conversation ID
        const message = await context.db.findMessageById(messageId);
        if (!message) {
          throw new GraphQLError('Message not found');
        }

        // Process through AI pipeline
        const result = await aiService.processMessage(
          messageId,
          message.conversationId,
          {
            publishEvents: true,
            storeResults: true,
            skipIfProcessed: false, // Force re-analysis
          }
        );

        return {
          messageId: result.messageId,
          sentiment: {
            score: result.sentiment.score,
            label: result.sentiment.label,
            confidence: result.sentiment.confidence,
            emotions:
              result.sentiment.emotions?.map(e => e.emotion.toString()) || [],
          },
          intent: {
            category: result.intent.primaryIntent.category,
            confidence: result.intent.confidence,
            urgency: result.intent.primaryIntent.urgency,
            actionRequired: result.intent.primaryIntent.actionRequired,
          },
          suggestions: result.suggestions.map(s => ({
            id: s.id,
            content: s.content,
            confidence: s.confidence,
            category: s.category,
            tone: s.tone,
            tags: s.tags,
          })),
          processingTime: result.processingTime,
        };
      } catch (error) {
        console.error('Message analysis failed:', error);
        throw new GraphQLError(
          `Message analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },

    // Response suggestion mutations
    async generateResponseSuggestions(
      _: any,
      { messageId }: { messageId: string },
      context: Context
    ) {
      requireAuth(context);

      try {
        // Get message to find conversation ID
        const message = await context.db.findMessageById(messageId);
        if (!message) {
          throw new GraphQLError('Message not found');
        }

        // Process through AI pipeline to get suggestions
        const result = await aiService.processMessage(
          messageId,
          message.conversationId,
          {
            publishEvents: false, // Don't publish events for just suggestion generation
            storeResults: false, // Don't store full analysis results
            skipIfProcessed: true, // Use cached results if available
          }
        );

        // Return formatted suggestions
        return result.suggestions.map(s => ({
          id: s.id,
          messageId: result.messageId,
          content: s.content,
          confidence: s.confidence,
          category: s.category,
          tone: s.tone,
          tags: s.tags,
          reasoning: s.reasoning,
          estimatedSatisfaction: s.estimatedSatisfaction,
          createdAt: new Date(),
        }));
      } catch (error) {
        console.error('Response suggestion generation failed:', error);
        throw new GraphQLError(
          `Failed to generate suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
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
      if (context.user?.role === 'agent' && agentId !== context.user?.userId) {
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

    // Escalation Prevention mutations
    async executePreventionAction(
      _: any,
      { 
        conversationId, 
        actionType, 
        agentId 
      }: { 
        conversationId: string; 
        actionType: string; 
        agentId?: string; 
      },
      context: Context
    ) {
      requireAuth(context);
      
      try {
        const result = await aiPipeline.executePreventionAction(
          conversationId, 
          actionType, 
          agentId || context.user?.userId
        );

        // Publish real-time update would go here
        // TODO: Add prevention action event publisher
        if (result.success) {
          console.log('Prevention action executed:', { conversationId, actionType });
        }

        return {
          success: result.success,
          message: result.success 
            ? `Prevention action "${actionType}" executed successfully`
            : `Failed to execute prevention action: ${result.result}`,
          result: result.result,
        };
      } catch (error) {
        console.error('Failed to execute prevention action:', error);
        throw new GraphQLError(
          `Failed to execute prevention action: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },

    async reportEscalationOutcome(
      _: any,
      {
        conversationId,
        escalated,
        outcome,
        preventionActionsUsed = []
      }: {
        conversationId: string;
        escalated: boolean;
        outcome: 'resolved' | 'escalated' | 'abandoned';
        preventionActionsUsed?: string[];
      },
      context: Context
    ) {
      requireAuth(context);
      
      try {
        await aiPipeline.reportEscalationOutcome(
          conversationId,
          escalated,
          outcome,
          preventionActionsUsed
        );

        // Publish event for analytics and machine learning would go here
        // TODO: Add escalation outcome event publisher
        console.log('Escalation outcome reported:', { conversationId, escalated, outcome });

        return {
          success: true,
          message: 'Escalation outcome reported successfully',
        };
      } catch (error) {
        console.error('Failed to report escalation outcome:', error);
        throw new GraphQLError(
          `Failed to report escalation outcome: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
  },

  // Type resolvers for nested fields
  Conversation: {
    async messages(parent: any, _: any, context: Context) {
      return await context.db.findMessagesByConversation(parent.id);
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
      return await context.db.findConversationsByAgent(parent.id);
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
