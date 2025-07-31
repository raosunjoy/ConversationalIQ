/**
 * Tests for WebSocket server and GraphQL subscription integration
 * Following TDD approach - comprehensive WebSocket testing
 */

import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { Server as HttpServer } from 'http';
import { WebSocketServer } from 'ws';
import { ApolloServer } from '@apollo/server';
import {
  createWebSocketServer,
  websocketUtils,
  createWebSocketMiddleware,
} from './websocket';
import { GraphQLContext } from './server';

// Mock dependencies
jest.mock('ws');
jest.mock('graphql-ws/lib/use/ws');
jest.mock('../auth/jwt');

const MockWebSocketServer = jest.mocked(WebSocketServer);
const mockUseServer = jest.fn();

// Mock graphql-ws useServer
jest.mock('graphql-ws/lib/use/ws', () => ({
  useServer: mockUseServer,
}));

describe('WebSocket Server Integration', () => {
  let mockHttpServer: jest.Mocked<HttpServer>;
  let mockApolloServer: jest.Mocked<ApolloServer<GraphQLContext>>;
  let mockWsServer: jest.Mocked<WebSocketServer>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock HTTP server
    mockHttpServer = {
      listen: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
    } as any;

    // Mock Apollo server
    mockApolloServer = {
      start: jest.fn(),
      stop: jest.fn(),
      executeOperation: jest.fn(),
    } as any;

    // Mock WebSocket server
    mockWsServer = {
      clients: new Set(),
      close: jest.fn(callback => callback && callback()),
      on: jest.fn(),
    } as any;

    MockWebSocketServer.mockImplementation(() => mockWsServer);
    mockUseServer.mockReturnValue(jest.fn());
  });

  describe('createWebSocketServer', () => {
    it('should create WebSocket server with correct configuration', () => {
      const wsServer = createWebSocketServer(mockHttpServer, mockApolloServer);

      expect(MockWebSocketServer).toHaveBeenCalledWith({
        server: mockHttpServer,
        path: '/graphql',
      });

      expect(wsServer).toBe(mockWsServer);
    });

    it('should configure graphql-ws server with schema and handlers', () => {
      createWebSocketServer(mockHttpServer, mockApolloServer);

      expect(mockUseServer).toHaveBeenCalledWith(
        expect.objectContaining({
          schema: expect.any(Object),
          onConnect: expect.any(Function),
          onDisconnect: expect.any(Function),
          context: expect.any(Function),
          onSubscribe: expect.any(Function),
          onComplete: expect.any(Function),
          onError: expect.any(Function),
          keepAlive: 30000,
        }),
        mockWsServer
      );
    });

    it('should store cleanup function on WebSocket server', () => {
      const mockCleanup = jest.fn();
      mockUseServer.mockReturnValue(mockCleanup);

      const wsServer = createWebSocketServer(mockHttpServer, mockApolloServer);

      expect((wsServer as any).cleanup).toBe(mockCleanup);
    });
  });

  describe('WebSocket Event Handlers', () => {
    let onConnectHandler: Function;
    let onDisconnectHandler: Function;
    let contextHandler: Function;
    let onSubscribeHandler: Function;
    let onCompleteHandler: Function;
    let onErrorHandler: Function;

    beforeEach(() => {
      createWebSocketServer(mockHttpServer, mockApolloServer);

      const useServerCall = mockUseServer.mock.calls[0];
      const config = useServerCall[0];

      onConnectHandler = config.onConnect;
      onDisconnectHandler = config.onDisconnect;
      contextHandler = config.context;
      onSubscribeHandler = config.onSubscribe;
      onCompleteHandler = config.onComplete;
      onErrorHandler = config.onError;
    });

    describe('onConnect', () => {
      it('should accept connection and log in development', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const mockCtx = {
          connectionParams: { authorization: 'Bearer token123' },
        };

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        const result = await onConnectHandler(mockCtx);

        expect(result).toBe(true);
        expect(consoleSpy).toHaveBeenCalledWith(
          'WebSocket connection established'
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          'Connection params:',
          mockCtx.connectionParams
        );

        consoleSpy.mockRestore();
        process.env.NODE_ENV = originalEnv;
      });

      it('should not log connection params in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const mockCtx = {
          connectionParams: { authorization: 'Bearer token123' },
        };

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        const result = await onConnectHandler(mockCtx);

        expect(result).toBe(true);
        expect(consoleSpy).toHaveBeenCalledWith(
          'WebSocket connection established'
        );
        expect(consoleSpy).not.toHaveBeenCalledWith(
          'Connection params:',
          expect.any(Object)
        );

        consoleSpy.mockRestore();
        process.env.NODE_ENV = originalEnv;
      });
    });

    describe('onDisconnect', () => {
      it('should log disconnection details', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const mockCtx = {};
        const code = 1000;
        const reason = Buffer.from('Normal closure');

        onDisconnectHandler(mockCtx, code, reason);

        expect(consoleSpy).toHaveBeenCalledWith(
          'WebSocket connection closed:',
          {
            code,
            reason: 'Normal closure',
          }
        );

        consoleSpy.mockRestore();
      });
    });

    describe('context', () => {
      it('should create context with connection ID', async () => {
        const mockCtx = {
          connectionParams: { authorization: 'Bearer token123' },
        };
        const mockMsg = {};
        const mockArgs = {};

        const context = await contextHandler(mockCtx, mockMsg, mockArgs);

        expect(context).toHaveProperty('connectionId');
        expect(context.connectionId).toMatch(/^ws_\d+_[a-z0-9]+$/);
        expect(context).toHaveProperty(
          'connectionParams',
          mockCtx.connectionParams
        );
      });

      it('should handle authentication from connection params', async () => {
        const mockCtx = {
          connectionParams: { authorization: 'Bearer valid.token' },
        };

        const context = await contextHandler(mockCtx, {}, {});

        expect(context).toHaveProperty('connectionParams');
        expect(context.connectionParams.authorization).toBe(
          'Bearer valid.token'
        );
      });

      it('should handle authentication errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const mockCtx = {
          connectionParams: { authorization: 'Bearer invalid.token' },
        };

        const context = await contextHandler(mockCtx, {}, {});

        expect(context).toHaveProperty('user', undefined);
        expect(consoleSpy).toHaveBeenCalledWith(
          'WebSocket authentication failed:',
          expect.any(String)
        );

        consoleSpy.mockRestore();
      });

      it('should handle context creation errors', async () => {
        const consoleErrorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation();

        // Force an error by passing invalid context
        const mockCtx = null as any;

        const context = await contextHandler(mockCtx, {}, {});

        expect(context).toHaveProperty('db', undefined);
        expect(context).toHaveProperty('user', undefined);
        expect(context.connectionId).toMatch(/^ws_error_\d+$/);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'WebSocket context creation failed:',
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });
    });

    describe('onSubscribe', () => {
      it('should log subscription start in development', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const mockCtx = {};
        const mockMsg = {
          payload: {
            operationName: 'MessageAdded',
            query: 'subscription { messageAdded { id content } }',
          },
        };

        const result = await onSubscribeHandler(mockCtx, mockMsg);

        expect(consoleSpy).toHaveBeenCalledWith('Subscription started:', {
          operationName: 'MessageAdded',
          query: 'subscription { messageAdded { id content } }...',
        });

        expect(result).toHaveProperty('schema');
        expect(result).toHaveProperty('operationName', 'MessageAdded');
        expect(result).toHaveProperty('document', mockMsg.payload.query);

        consoleSpy.mockRestore();
        process.env.NODE_ENV = originalEnv;
      });

      it('should return execution arguments', async () => {
        const mockCtx = { extra: { context: { user: { id: '123' } } } };
        const mockMsg = {
          payload: {
            operationName: 'MessageAdded',
            query: 'subscription { messageAdded { id } }',
            variables: { conversationId: 'conv_123' },
          },
        };

        const result = await onSubscribeHandler(mockCtx, mockMsg);

        expect(result).toEqual({
          schema: expect.any(Object),
          operationName: 'MessageAdded',
          document: 'subscription { messageAdded { id } }',
          variableValues: { conversationId: 'conv_123' },
          contextValue: { user: { id: '123' } },
        });
      });
    });

    describe('onComplete', () => {
      it('should log subscription completion in development', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const mockCtx = {};
        const mockMsg = { id: 'sub_123' };

        onCompleteHandler(mockCtx, mockMsg);

        expect(consoleSpy).toHaveBeenCalledWith(
          'Subscription completed:',
          'sub_123'
        );

        consoleSpy.mockRestore();
        process.env.NODE_ENV = originalEnv;
      });
    });

    describe('onError', () => {
      it('should log subscription errors', () => {
        const consoleErrorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation();
        const mockCtx = {};
        const mockMsg = { id: 'sub_123' };
        const mockErrors = [
          new Error('Subscription error 1'),
          new Error('Subscription error 2'),
        ];

        onErrorHandler(mockCtx, mockMsg, mockErrors);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'WebSocket subscription error:',
          {
            id: 'sub_123',
            errors: ['Subscription error 1', 'Subscription error 2'],
          }
        );

        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('WebSocket Utils', () => {
    beforeEach(() => {
      // Reset the clients set
      mockWsServer.clients = new Set();
    });

    describe('getConnectionCount', () => {
      it('should return correct connection count', () => {
        mockWsServer.clients.add({} as any);
        mockWsServer.clients.add({} as any);

        const count = websocketUtils.getConnectionCount(mockWsServer);
        expect(count).toBe(2);
      });

      it('should return zero for no connections', () => {
        const count = websocketUtils.getConnectionCount(mockWsServer);
        expect(count).toBe(0);
      });
    });

    describe('broadcast', () => {
      it('should send message to all open connections', () => {
        const mockClient1 = { readyState: 1, send: jest.fn(), OPEN: 1 };
        const mockClient2 = { readyState: 1, send: jest.fn(), OPEN: 1 };
        const mockClient3 = { readyState: 0, send: jest.fn(), OPEN: 1 }; // Closed connection

        mockWsServer.clients.add(mockClient1 as any);
        mockWsServer.clients.add(mockClient2 as any);
        mockWsServer.clients.add(mockClient3 as any);

        const message = { type: 'test', data: 'hello' };
        websocketUtils.broadcast(mockWsServer, message);

        expect(mockClient1.send).toHaveBeenCalledWith(JSON.stringify(message));
        expect(mockClient2.send).toHaveBeenCalledWith(JSON.stringify(message));
        expect(mockClient3.send).not.toHaveBeenCalled(); // Closed connection
      });
    });

    describe('getStats', () => {
      it('should return connection statistics', () => {
        mockWsServer.clients.add({} as any);
        mockWsServer.clients.add({} as any);

        const stats = websocketUtils.getStats(mockWsServer);

        expect(stats).toHaveProperty('totalConnections', 2);
        expect(stats).toHaveProperty('timestamp');
        expect(stats).toHaveProperty('uptime');
        expect(typeof stats.timestamp).toBe('string');
        expect(typeof stats.uptime).toBe('number');
      });
    });

    describe('closeServer', () => {
      it('should close all connections and server', async () => {
        const mockClient1 = { close: jest.fn() };
        const mockClient2 = { close: jest.fn() };

        mockWsServer.clients.add(mockClient1 as any);
        mockWsServer.clients.add(mockClient2 as any);

        const mockCleanup = jest.fn();
        (mockWsServer as any).cleanup = mockCleanup;

        mockWsServer.close.mockImplementation(callback => {
          callback && callback();
        });

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        await websocketUtils.closeServer(mockWsServer);

        expect(mockCleanup).toHaveBeenCalled();
        expect(mockClient1.close).toHaveBeenCalledWith(
          1000,
          'Server shutting down'
        );
        expect(mockClient2.close).toHaveBeenCalledWith(
          1000,
          'Server shutting down'
        );
        expect(mockWsServer.close).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
          'WebSocket server closed gracefully'
        );

        consoleSpy.mockRestore();
      });

      it('should reject on server close error', async () => {
        const error = new Error('Close failed');
        mockWsServer.close.mockImplementation(callback => {
          callback && callback(error);
        });

        await expect(websocketUtils.closeServer(mockWsServer)).rejects.toThrow(
          'Close failed'
        );
      });
    });
  });

  describe('WebSocket Middleware', () => {
    it('should create middleware with correct functions', () => {
      const middleware = createWebSocketMiddleware(mockWsServer);

      expect(middleware).toHaveProperty('addWebSocketInfo');
      expect(middleware).toHaveProperty('healthCheck');
      expect(typeof middleware.addWebSocketInfo).toBe('function');
      expect(typeof middleware.healthCheck).toBe('function');
    });

    describe('addWebSocketInfo', () => {
      it('should add WebSocket info to request', () => {
        const middleware = createWebSocketMiddleware(mockWsServer);
        const mockReq = {};
        const mockRes = {};
        const mockNext = jest.fn();

        mockWsServer.clients.add({} as any);

        middleware.addWebSocketInfo(mockReq, mockRes, mockNext);

        expect(mockReq).toHaveProperty('websocket');
        expect((mockReq as any).websocket).toHaveProperty('connectionCount', 1);
        expect((mockReq as any).websocket).toHaveProperty('stats');
        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('healthCheck', () => {
      it('should return WebSocket health status', () => {
        const middleware = createWebSocketMiddleware(mockWsServer);
        const mockReq = {};
        const mockRes = { json: jest.fn() };

        mockWsServer.clients.add({} as any);
        mockWsServer.clients.add({} as any);

        middleware.healthCheck(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          status: 'healthy',
          service: 'WebSocket',
          totalConnections: 2,
          timestamp: expect.any(String),
          uptime: expect.any(Number),
        });
      });
    });
  });
});
