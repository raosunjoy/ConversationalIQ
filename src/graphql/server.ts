/**
 * Apollo GraphQL server setup for ConversationIQ
 * Configures server with schema, resolvers, and context
 */

import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { GraphQLScalarType } from 'graphql';
import { Kind } from 'graphql/language';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { DatabaseService } from '../services/database';
import { JWTService } from '../auth/jwt';

// Context interface
export interface GraphQLContext {
  db: DatabaseService;
  user?:
    | {
        userId: string;
        email: string;
        role: string;
        zendeskId?: string | undefined;
        subdomain?: string | undefined;
        permissions?: string[] | undefined;
      }
    | undefined;
}

// Custom scalar implementations
const scalarResolvers = {
  DateTime: new GraphQLScalarType({
    name: 'DateTime',
    description: 'DateTime custom scalar type',
    serialize(value: any) {
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (typeof value === 'string') {
        return new Date(value).toISOString();
      }
      throw new Error('Value must be a Date object or ISO string');
    },
    parseValue(value: any) {
      if (typeof value === 'string') {
        return new Date(value);
      }
      throw new Error('Value must be a valid ISO date string');
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) {
        return new Date(ast.value);
      }
      throw new Error('Value must be a valid ISO date string');
    },
  }),

  JSON: new GraphQLScalarType({
    name: 'JSON',
    description: 'JSON custom scalar type',
    serialize(value: any) {
      return value;
    },
    parseValue(value: any) {
      return value;
    },
    parseLiteral(ast) {
      switch (ast.kind) {
        case Kind.STRING:
          try {
            return JSON.parse(ast.value);
          } catch {
            return ast.value;
          }
        case Kind.OBJECT:
          return ast;
        case Kind.LIST:
          return ast;
        default:
          return null;
      }
    },
  }),
};

// Merge resolvers with custom scalars
const mergedResolvers = {
  ...resolvers,
  ...scalarResolvers,
};

// Create executable schema
export const schema = makeExecutableSchema({
  typeDefs,
  resolvers: mergedResolvers,
});

// Context creation function
export async function createContext({
  req,
}: {
  req: any;
}): Promise<GraphQLContext> {
  const db = new DatabaseService();

  let user: GraphQLContext['user'] | undefined;

  try {
    // Extract token from authorization header
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const jwtService = new JWTService();
      const token = jwtService.extractTokenFromHeader(authHeader);

      if (token) {
        try {
          const decoded = await jwtService.verifyToken(token);
          user = {
            userId: decoded.userId,
            email: decoded.email || '',
            role: decoded.role || 'user',
            zendeskId: decoded.zendeskId,
            subdomain: decoded.subdomain,
            permissions: decoded.permissions,
          };
        } catch (error) {
          // Token is invalid, continue without user
          console.warn(
            'Invalid JWT token:',
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }
    }
  } catch (error) {
    // Authentication failed, continue without user
    console.warn(
      'Authentication failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }

  return {
    db,
    user,
  };
}

// Create Apollo Server
export function createApolloServer(): ApolloServer<GraphQLContext> {
  return new ApolloServer<GraphQLContext>({
    schema,
    formatError: (formattedError, error) => {
      // Log errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error('GraphQL Error:', error);
      }

      // Don't expose internal error details in production
      if (process.env.NODE_ENV === 'production') {
        // Remove stack traces and internal details
        return {
          message: formattedError.message,
          extensions: {
            code: formattedError.extensions?.code || 'INTERNAL_ERROR',
          },
        };
      }

      return formattedError;
    },
    introspection: process.env.NODE_ENV !== 'production',
    plugins: [
      // Custom plugin for logging and metrics
      {
        async requestDidStart() {
          return {
            async didResolveOperation(requestContext) {
              // Log operation name and variables in development
              if (process.env.NODE_ENV === 'development') {
                console.log('GraphQL Operation:', {
                  operationName: requestContext.request.operationName,
                  query: requestContext.request.query?.slice(0, 200) + '...',
                });
              }
            },
            async didEncounterErrors(requestContext) {
              // Log errors
              requestContext.errors.forEach(error => {
                console.error('GraphQL Error:', {
                  error: error.message,
                  operation: requestContext.request.operationName,
                  variables: requestContext.request.variables,
                });
              });
            },
            async willSendResponse(requestContext) {
              // Add custom headers
              if (requestContext.response.http) {
                requestContext.response.http.headers.set(
                  'X-GraphQL-Server',
                  'ConversationIQ'
                );
              }
            },
          };
        },
      },
    ],
  });
}

// Start standalone server function
export async function startGraphQLServer(
  port: number = 4000
): Promise<{ url: string; server: ApolloServer<GraphQLContext> }> {
  const server = createApolloServer();

  const { url } = await startStandaloneServer(server, {
    listen: { port },
    context: createContext,
  });

  console.log(`🚀 GraphQL Server ready at: ${url}`);

  return { url, server };
}

// Export server instance for integration
export const apolloServer = createApolloServer();
