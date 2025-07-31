/**
 * WebSocket server setup for GraphQL subscriptions
 * Handles real-time communication using WebSocket protocol
 */

import { Server as HttpServer } from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { ApolloServer } from '@apollo/server';
import { schema } from './server';
import { createContext, GraphQLContext } from './server';
import { JWTService } from '../auth/jwt';

/**
 * WebSocket connection context interface
 */
interface WebSocketContext {
  db: import('./server').GraphQLContext['db'];
  user?: import('./server').GraphQLContext['user'];
  connectionParams?: Record<string, any>;
  connectionId: string;
}

/**
 * Create WebSocket server for GraphQL subscriptions
 * @param httpServer HTTP server instance
 * @param apolloServer Apollo Server instance
 * @returns WebSocket server instance
 */
export function createWebSocketServer(
  httpServer: HttpServer,
  apolloServer: ApolloServer<GraphQLContext>
): WebSocketServer {
  // Create WebSocket server
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  // Use the server instance with graphql-ws
  const serverCleanup = useServer(
    {
      schema,
      
      // Handle connection initialization
      onConnect: async (ctx) => {
        console.log('WebSocket connection established');
        
        // Extract connection parameters
        const connectionParams = ctx.connectionParams;
        
        // Log connection info in development
        if (process.env.NODE_ENV === 'development') {
          console.log('Connection params:', connectionParams);
        }
        
        return true; // Accept connection
      },

      // Handle connection close
      onDisconnect: (ctx, code, reason) => {
        console.log('WebSocket connection closed:', { code, reason: reason.toString() });
      },

      // Create context for subscriptions
      context: async (ctx, msg, args) => {
        try {
          // Generate unique connection ID
          const connectionId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Extract authentication from connection params or message
          const authToken = ctx.connectionParams?.authorization || 
                           ctx.connectionParams?.token ||
                           args.contextValue?.authorization;

          let user: GraphQLContext['user'] | undefined;

          if (authToken) {
            try {
              const jwtService = new JWTService();
              const token = typeof authToken === 'string' && authToken.startsWith('Bearer ')
                ? authToken.slice(7)
                : authToken;
              
              if (token) {
                const decoded = await jwtService.verifyToken(token);
                user = {
                  userId: decoded.userId,
                  email: decoded.email || '',
                  role: decoded.role || 'user',
                  zendeskId: decoded.zendeskId,
                  subdomain: decoded.subdomain,
                  permissions: decoded.permissions,
                };
              }
            } catch (error) {
              console.warn('WebSocket authentication failed:', error instanceof Error ? error.message : 'Unknown error');
              // Continue without user - some subscriptions may allow anonymous access
            }
          }

          // Create base context similar to HTTP context
          const baseContext = await createContext({ 
            req: { 
              headers: { 
                authorization: authToken 
              } 
            } 
          });

          // Return enhanced context with WebSocket-specific properties
          const wsContext: WebSocketContext = {
            ...baseContext,
            user: user || baseContext.user,
            connectionParams: ctx.connectionParams,
            connectionId,
          };

          return wsContext;
        } catch (error) {
          console.error('WebSocket context creation failed:', error);
          
          // Return minimal context
          return {
            db: undefined as any,
            user: undefined,
            connectionParams: ctx.connectionParams,
            connectionId: `ws_error_${Date.now()}`,
          } as WebSocketContext;
        }
      },

      // Handle subscription start
      onSubscribe: async (ctx, msg) => {
        // Log subscription start in development
        if (process.env.NODE_ENV === 'development') {
          console.log('Subscription started:', {
            operationName: msg.payload.operationName,
            query: msg.payload.query?.slice(0, 100) + '...',
          });
        }

        // Return execution args
        return {
          schema,
          operationName: msg.payload.operationName,
          document: msg.payload.query,
          variableValues: msg.payload.variables,
          contextValue: ctx.extra?.context,
        };
      },

      // Handle operation complete
      onComplete: (ctx, msg) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('Subscription completed:', msg.id);
        }
      },

      // Handle errors
      onError: (ctx, msg, errors) => {
        console.error('WebSocket subscription error:', {
          id: msg.id,
          errors: errors.map(e => e.message),
        });
      },

      // Keep alive configuration
      keepAlive: 30000, // 30 seconds
    },
    wsServer
  );

  // Store cleanup function on server for graceful shutdown
  (wsServer as any).cleanup = serverCleanup;

  console.log('🔌 WebSocket server ready for subscriptions at /graphql');
  
  return wsServer;
}

/**
 * WebSocket server utilities
 */
export const websocketUtils = {
  /**
   * Get connected client count
   */
  getConnectionCount: (wsServer: WebSocketServer): number => {
    return wsServer.clients.size;
  },

  /**
   * Broadcast message to all connected clients
   */
  broadcast: (wsServer: WebSocketServer, message: any): void => {
    wsServer.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  },

  /**
   * Get connection statistics
   */
  getStats: (wsServer: WebSocketServer) => {
    return {
      totalConnections: wsServer.clients.size,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  },

  /**
   * Gracefully close WebSocket server
   */
  closeServer: async (wsServer: WebSocketServer): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Call cleanup function if available
      if ((wsServer as any).cleanup) {
        (wsServer as any).cleanup();
      }

      // Close all connections
      wsServer.clients.forEach((client) => {
        client.close(1000, 'Server shutting down');
      });

      // Close server
      wsServer.close((error) => {
        if (error) {
          reject(error);
        } else {
          console.log('WebSocket server closed gracefully');
          resolve();
        }
      });
    });
  },
};

/**
 * WebSocket middleware for Express integration
 */
export function createWebSocketMiddleware(wsServer: WebSocketServer) {
  return {
    /**
     * Add WebSocket info to Express requests
     */
    addWebSocketInfo: (req: any, res: any, next: any) => {
      req.websocket = {
        connectionCount: websocketUtils.getConnectionCount(wsServer),
        stats: websocketUtils.getStats(wsServer),
      };
      next();
    },

    /**
     * WebSocket health check endpoint
     */
    healthCheck: (req: any, res: any) => {
      const stats = websocketUtils.getStats(wsServer);
      res.json({
        status: 'healthy',
        service: 'WebSocket',
        ...stats,
      });
    },
  };
}