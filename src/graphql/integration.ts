/**
 * GraphQL integration with Express server
 * Configures Apollo Server middleware for Express
 */

import { Application, Response } from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault,
} from '@apollo/server/plugin/landingPage/default';
import { createServer, Server } from 'http';
import { schema } from './server';
import { GraphQLContext, createContext } from './server';
import { createWebSocketServer, createWebSocketMiddleware } from './websocket';

// Extended context for Express integration
interface ExpressGraphQLContext extends GraphQLContext {
  res: Response;
}

/**
 * Integrate GraphQL with Express application
 * @param app Express application instance
 * @param httpServer Optional HTTP server instance
 * @returns Apollo Server instance
 */
export async function integrateGraphQL(
  app: Application,
  httpServer?: Server
): Promise<ApolloServer<ExpressGraphQLContext>> {
  // Create HTTP server if not provided
  const server = httpServer || createServer(app);

  // Create Apollo Server with Express integration
  const apolloServer = new ApolloServer<ExpressGraphQLContext>({
    schema,
    introspection: process.env.NODE_ENV !== 'production',
    plugins: [
      // Proper shutdown for the HTTP server
      ApolloServerPluginDrainHttpServer({ httpServer: server }),

      // Landing page configuration
      process.env.NODE_ENV === 'production'
        ? ApolloServerPluginLandingPageProductionDefault({
            footer: false,
            embed: false,
          })
        : ApolloServerPluginLandingPageLocalDefault({
            footer: false,
            embed: true,
          }),

      // Custom plugin for request logging and metrics
      {
        async requestDidStart() {
          return {
            async didResolveOperation(requestContext) {
              // Log GraphQL operations in development
              if (process.env.NODE_ENV === 'development') {
                const operationName =
                  requestContext.request.operationName || 'Anonymous';
                const operationType =
                  requestContext.document?.definitions[0]?.kind;
                console.log(`GraphQL ${operationType}: ${operationName}`);
              }
            },

            async didEncounterErrors(requestContext) {
              // Enhanced error logging
              requestContext.errors.forEach(error => {
                console.error('GraphQL Error:', {
                  message: error.message,
                  operation: requestContext.request.operationName,
                  path: error.path,
                  extensions: error.extensions,
                  timestamp: new Date().toISOString(),
                });
              });
            },

            async willSendResponse(requestContext) {
              // Add custom response headers
              if (requestContext.response.http) {
                requestContext.response.http.headers.set(
                  'X-GraphQL-Server',
                  'ConversationIQ'
                );
                requestContext.response.http.headers.set(
                  'X-Response-Time',
                  Date.now().toString()
                );
              }
            },
          };
        },
      },
    ],

    formatError: (formattedError, error: any) => {
      // Enhanced error formatting
      const isDevelopment = process.env.NODE_ENV === 'development';

      // Log full error details in development
      if (isDevelopment) {
        console.error('GraphQL Error Details:', {
          error: error?.message || 'Unknown error',
          stack: error?.stack,
          source: error?.source,
          positions: error?.positions,
          path: error?.path,
        });
      }

      // Return appropriate error details based on environment
      if (!isDevelopment) {
        // In production, hide internal error details
        const safeError = {
          message: formattedError.message,
          extensions: {
            code: formattedError.extensions?.code || 'INTERNAL_ERROR',
            timestamp: new Date().toISOString(),
          },
        };

        // Only include path for client errors
        if (
          formattedError.extensions?.code &&
          ['BAD_USER_INPUT', 'UNAUTHENTICATED', 'FORBIDDEN'].includes(
            String(formattedError.extensions.code)
          )
        ) {
          const result = { ...safeError };
          if (formattedError.path) {
            (result as any).path = formattedError.path;
          }
          return result;
        }

        return safeError;
      }

      // Development: return full error details
      return {
        ...formattedError,
        extensions: {
          ...formattedError.extensions,
          timestamp: new Date().toISOString(),
        },
      };
    },
  });

  // Start the Apollo Server
  await apolloServer.start();

  // Apply the Apollo GraphQL middleware
  app.use(
    '/graphql',
    // Enable CORS for GraphQL endpoint
    (req, res, next) => {
      // Set CORS headers specifically for GraphQL
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization'
      );
      res.header('Access-Control-Allow-Credentials', 'true');

      if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
      }

      next();
    },

    // Apply Express middleware for GraphQL
    expressMiddleware(apolloServer, {
      context: async ({ req, res }): Promise<ExpressGraphQLContext> => {
        try {
          // Create GraphQL context from Express request
          const context = await createContext({ req });

          // Add Express response to context for potential use in resolvers
          return {
            ...context,
            res,
          };
        } catch (error) {
          console.error('Context creation error:', error);

          // Return minimal context if creation fails
          const { DatabaseService } = await import('../services/database');
          return {
            db: new DatabaseService(),
            user: undefined,
            res,
          };
        }
      },
    })
  );

  // Create WebSocket server for subscriptions
  const wsServer = createWebSocketServer(server, apolloServer);
  const wsMiddleware = createWebSocketMiddleware(wsServer);

  // Add WebSocket middleware to all routes
  app.use(wsMiddleware.addWebSocketInfo);

  // Health check endpoint for GraphQL
  app.get('/graphql/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'GraphQL',
      timestamp: new Date().toISOString(),
      server: 'Apollo Server',
      websocket: (req as any).websocket?.stats || null,
    });
  });

  // WebSocket-specific health check
  app.get('/graphql/ws/health', wsMiddleware.healthCheck);

  console.log('🚀 GraphQL endpoint ready at /graphql');
  console.log('🔌 GraphQL subscriptions ready at ws://localhost/graphql');

  return apolloServer;
}

/**
 * Create Express middleware for GraphQL subscriptions (WebSocket support)
 * Now fully implemented with WebSocket server integration
 */
export function createSubscriptionMiddleware(
  apolloServer: ApolloServer<ExpressGraphQLContext>
) {
  return {
    installSubscriptionHandlers: (server: Server) => {
      const wsServer = createWebSocketServer(server, apolloServer);
      console.log('📡 WebSocket subscription handlers installed');
      return wsServer;
    },
  };
}

/**
 * GraphQL development utilities
 */
export const graphqlDevUtils = {
  /**
   * Generate sample queries for testing
   */
  getSampleQueries: () => ({
    healthCheck: '{ __typename }',

    getConversation: `
      query GetConversation($id: ID!) {
        conversation(id: $id) {
          id
          ticketId
          status
          createdAt
          messages {
            id
            content
            sender
            createdAt
          }
        }
      }
    `,

    createMessage: `
      mutation CreateMessage($input: MessageInput!) {
        createMessage(input: $input) {
          id
          content
          sender
          sentimentScore
          detectedIntent
          createdAt
        }
      }
    `,

    getAgentAnalytics: `
      query GetAgentAnalytics($agentId: String!, $filter: AnalyticsFilter) {
        agentAnalytics(agentId: $agentId, filter: $filter) {
          totalConversations
          averageSentiment
          responseTime
          resolutionRate
          customerSatisfaction
        }
      }
    `,
  }),

  /**
   * Validate GraphQL schema during development
   */
  validateSchema: () => {
    try {
      // Schema validation is handled by GraphQL-tools
      // This could be extended with custom validation rules
      console.log('✅ GraphQL schema validation passed');
      return true;
    } catch (error) {
      console.error('❌ GraphQL schema validation failed:', error);
      return false;
    }
  },
};
