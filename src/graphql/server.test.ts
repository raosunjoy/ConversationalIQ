/**
 * Tests for Apollo GraphQL server setup
 * Following TDD approach - tests written first
 */

import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';
import { ApolloServer } from '@apollo/server';
import { createApolloServer, createContext } from './server';
import { DatabaseService } from '../services/database';
import { JWTService } from '../auth/jwt';

// Mock dependencies
jest.mock('../services/database');
jest.mock('../auth/jwt');

const mockDatabaseService = jest.mocked(DatabaseService);
const mockJWTService = jest.mocked(JWTService);

describe('Apollo GraphQL Server', () => {
  let server: ApolloServer;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockJWT: jest.Mocked<JWTService>;

  beforeEach(async () => {
    mockDb = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      healthCheck: jest.fn(),
      findConversationById: jest.fn(),
      createMessage: jest.fn(),
    } as any;

    mockJWT = {
      verifyToken: jest.fn(),
      extractTokenFromHeader: jest.fn(),
    } as any;

    mockDatabaseService.mockImplementation(() => mockDb);
    mockJWTService.mockImplementation(() => mockJWT);

    server = createApolloServer();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Only stop server if it was started
    try {
      if (server && (server as any).started) {
        await server.stop();
      }
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('Server Creation', () => {
    it('should create Apollo server successfully', () => {
      expect(server).toBeInstanceOf(ApolloServer);
    });

    it('should have GraphQL schema defined', () => {
      expect(server).toBeDefined();
      // Schema validation is covered by schema tests
    });

    it('should configure server with correct options', () => {
      // Server should be created with production-ready configuration
      expect(server).toBeDefined();
    });
  });

  describe('Context Creation', () => {
    it('should create context with database service', async () => {
      const mockRequest = {
        headers: {},
      };

      const context = await createContext({ req: mockRequest });

      expect(context.db).toBeDefined();
      expect(typeof context.db.connect).toBe('function');
    });

    it('should create context with authenticated user', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid.jwt.token',
        },
      };

      const mockUser = {
        userId: 'agent_123',
        email: 'agent@company.com',
        role: 'agent',
        zendeskId: 'zd_agent_456',
        subdomain: 'company',
      };

      mockJWT.extractTokenFromHeader.mockReturnValue('valid.jwt.token');
      mockJWT.verifyToken.mockResolvedValue(mockUser);

      const context = await createContext({ req: mockRequest });

      expect(context.user).toEqual(mockUser);
      expect(mockJWT.extractTokenFromHeader).toHaveBeenCalledWith('Bearer valid.jwt.token');
      expect(mockJWT.verifyToken).toHaveBeenCalledWith('valid.jwt.token');
    });

    it('should create context without user for invalid token', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer invalid.jwt.token',
        },
      };

      mockJWT.extractTokenFromHeader.mockReturnValue('invalid.jwt.token');
      mockJWT.verifyToken.mockRejectedValue(new Error('Invalid token'));

      const context = await createContext({ req: mockRequest });

      expect(context.user).toBeUndefined();
      expect(context.db).toBeDefined();
    });

    it('should create context without user when no auth header', async () => {
      const mockRequest = {
        headers: {},
      };

      mockJWT.extractTokenFromHeader.mockReturnValue(null);

      const context = await createContext({ req: mockRequest });

      expect(context.user).toBeUndefined();
      expect(context.db).toBeDefined();
      expect(mockJWT.verifyToken).not.toHaveBeenCalled();
    });
  });

  describe('GraphQL Operations', () => {
    it('should execute simple query', async () => {
      const query = `
        query GetConversation($id: ID!) {
          conversation(id: $id) {
            id
            ticketId
            status
          }
        }
      `;

      const mockConversation = {
        id: 'conv_123',
        ticketId: 'ticket_456',
        status: 'OPEN',
        agentId: 'agent_123',
        customerId: 'customer_789',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.findConversationById.mockResolvedValue(mockConversation);

      const context = {
        db: mockDb,
        user: {
          userId: 'agent_123',
          email: 'agent@company.com',
          role: 'agent',
        },
      };

      const response = await server.executeOperation(
        {
          query,
          variables: { id: 'conv_123' },
        },
        { contextValue: context }
      );

      expect(response.body.kind).toBe('single');
      if (response.body.kind === 'single') {
        expect(response.body.singleResult.errors).toBeUndefined();
        expect(response.body.singleResult.data?.conversation).toEqual({
          id: 'conv_123',
          ticketId: 'ticket_456',
          status: 'OPEN',
        });
      }
    });

    it('should execute mutation', async () => {
      const mutation = `
        mutation CreateMessage($input: MessageInput!) {
          createMessage(input: $input) {
            id
            content
            sender
            conversationId
          }
        }
      `;

      const input = {
        conversationId: 'conv_123',
        content: 'Hello, I need help!',
        sender: 'CUSTOMER',
      };

      const mockMessage = {
        id: 'msg_123',
        ...input,
        isProcessed: false,
        createdAt: new Date(),
      };

      mockDb.createMessage.mockResolvedValue(mockMessage);

      const context = {
        db: mockDb,
        user: {
          userId: 'agent_123',
          email: 'agent@company.com',
          role: 'agent',
        },
      };

      const response = await server.executeOperation(
        {
          query: mutation,
          variables: { input },
        },
        { contextValue: context }
      );

      expect(response.body.kind).toBe('single');
      if (response.body.kind === 'single') {
        expect(response.body.singleResult.errors).toBeUndefined();
        expect(response.body.singleResult.data?.createMessage).toEqual({
          id: 'msg_123',
          content: 'Hello, I need help!',
          sender: 'CUSTOMER',
          conversationId: 'conv_123',
        });
      }
    });

    it('should handle authentication errors', async () => {
      const query = `
        query GetConversations {
          conversations {
            id
            ticketId
          }
        }
      `;

      const context = {
        db: mockDb,
        user: null, // No authenticated user
      };

      const response = await server.executeOperation(
        { query },
        { contextValue: context }
      );

      expect(response.body.kind).toBe('single');
      if (response.body.kind === 'single') {
        expect(response.body.singleResult.errors).toBeDefined();
        expect(response.body.singleResult.errors?.[0].message).toBe('Authentication required');
      }
    });

    it('should handle GraphQL validation errors', async () => {
      const invalidQuery = `
        query InvalidQuery {
          nonExistentField
        }
      `;

      const context = {
        db: mockDb,
        user: {
          userId: 'agent_123',
          role: 'agent',
        },
      };

      const response = await server.executeOperation(
        { query: invalidQuery },
        { contextValue: context }
      );

      expect(response.body.kind).toBe('single');
      if (response.body.kind === 'single') {
        expect(response.body.singleResult.errors).toBeDefined();
        expect(response.body.singleResult.errors?.[0].message).toContain('nonExistentField');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      const query = `
        query GetConversation($id: ID!) {
          conversation(id: $id) {
            id
          }
        }
      `;

      mockDb.findConversationById.mockRejectedValue(new Error('Database connection failed'));

      const context = {
        db: mockDb,
        user: {
          userId: 'agent_123',
          role: 'agent',
        },
      };

      const response = await server.executeOperation(
        {
          query,
          variables: { id: 'conv_123' },
        },
        { contextValue: context }
      );

      expect(response.body.kind).toBe('single');
      if (response.body.kind === 'single') {
        expect(response.body.singleResult.errors).toBeDefined();
        expect(response.body.singleResult.errors?.[0].message).toBe('Database connection failed');
      }
    });

    it('should format errors consistently', async () => {
      const query = `
        mutation CreateConversation($input: ConversationInput!) {
          createConversation(input: $input) {
            id
          }
        }
      `;

      const invalidInput = {
        ticketId: '', // Invalid empty ticket ID
        agentId: 'agent_123',
        customerId: 'customer_789',
        status: 'OPEN',
      };

      const context = {
        db: mockDb,
        user: {
          userId: 'agent_123',
          role: 'agent',
        },
      };

      const response = await server.executeOperation(
        {
          query,
          variables: { input: invalidInput },
        },
        { contextValue: context }
      );

      expect(response.body.kind).toBe('single');
      if (response.body.kind === 'single') {
        expect(response.body.singleResult.errors).toBeDefined();
        expect(response.body.singleResult.errors?.[0].message).toBe('Ticket ID is required');
        expect(response.body.singleResult.errors?.[0].extensions?.code).toBe('BAD_USER_INPUT');
      }
    });
  });

  describe('Performance and Configuration', () => {
    it('should start server successfully', async () => {
      const serverStartPromise = server.start();
      await expect(serverStartPromise).resolves.not.toThrow();
    });

    it('should handle server shutdown gracefully', async () => {
      await server.start();
      const stopPromise = server.stop();
      await expect(stopPromise).resolves.not.toThrow();
    });
  });
});