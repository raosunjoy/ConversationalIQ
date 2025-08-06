/**
 * Database service layer for ConversationIQ
 * Provides abstraction over Prisma client with type safety
 */

import {
  PrismaClient,
  Conversation,
  Message,
  ResponseSuggestion,
  HealthCheck,
} from '@prisma/client';
import type {
  ConversationStatus,
  SenderType,
  SuggestionType,
  Prisma,
} from '@prisma/client';
import { encryptionService, privacyService } from '../security/encryption-service';
import { monitoringService } from '../monitoring/monitoring-service';

export interface CreateConversationData {
  ticketId?: string;
  zendeskTicketId?: string;
  zendeskChatId?: string;
  customerId: string;
  agentId: string;
  subject?: string;
  priority?: string;
  tags?: string[];
  source?: string;
  status: ConversationStatus;
  metadata?: Prisma.InputJsonValue;
}

export interface CreateMessageData {
  conversationId: string;
  content: string;
  senderType: SenderType;
  senderId: string;
  source?: string;
  aiAnalysis?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

export interface CreateResponseSuggestionData {
  messageId: string;
  suggestionText: string;
  suggestionType: SuggestionType;
  confidence: number;
  reasoning?: string;
  zendeskMacroId?: string;
}

export interface AIAnalysisData {
  [key: string]: unknown;
  sentiment?: {
    polarity: string;
    confidence: number;
    emotions?: string[];
    trend?: string;
  };
  intent?: {
    primary: string;
    confidence: number;
    secondary?: Array<{ intent: string; confidence: number }>;
    category?: string;
  };
  escalationRisk?: number;
  processingTime?: number;
}

export class DatabaseService {
  private prisma: PrismaClient;
  private encryptSensitiveData: boolean;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient ?? new PrismaClient();
    this.encryptSensitiveData = process.env.NODE_ENV === 'production';
  }

  /**
   * Connect to the database
   */
  async connect(): Promise<void> {
    await this.prisma.$connect();
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  /**
   * Check if database is connected
   */
  isConnected(): boolean {
    // Simple check - in production would use proper connection status
    return this.prisma !== null;
  }

  /**
   * Encrypt sensitive content before storage
   */
  private async encryptSensitiveContent(content: string, tableName: string, fieldName: string): Promise<string> {
    if (!this.encryptSensitiveData) {
      return content;
    }

    try {
      // Check for PII in content
      const piiResult = encryptionService.detectPII(content);
      
      // Log PII detection for compliance
      if (piiResult.hasPII) {
        monitoringService.recordMetric(
          'pii_detected',
          1,
          'count',
          { table: tableName, field: fieldName, types: piiResult.detectedTypes.join(',') }
        );
      }

      // Encrypt if contains PII or is sensitive field
      const sensitiveFields = ['content', 'subject', 'email', 'phone', 'address'];
      if (piiResult.hasPII || sensitiveFields.includes(fieldName)) {
        const encryptedField = await encryptionService.encryptField(tableName, fieldName, content);
        return JSON.stringify(encryptedField);
      }

      return content;
    } catch (error) {
      console.error('Encryption failed, storing unencrypted:', error);
      return content;
    }
  }

  /**
   * Decrypt sensitive content after retrieval
   */
  private async decryptSensitiveContent(content: string): Promise<string> {
    if (!this.encryptSensitiveData) {
      return content;
    }

    try {
      // Check if content is encrypted (JSON format)
      const parsed = JSON.parse(content);
      if (parsed.data && parsed.iv && parsed.authTag) {
        return await encryptionService.decryptData(parsed);
      }
      return content;
    } catch (error) {
      // Not encrypted or decryption failed, return as-is
      return content;
    }
  }

  /**
   * Process data subject access request (GDPR)
   */
  async handleDataSubjectAccessRequest(email: string): Promise<any> {
    monitoringService.recordMetric('gdpr_access_request', 1, 'count', { type: 'access' });
    
    try {
      // This would collect all data associated with the email
      const conversations = await this.prisma.conversation.findMany({
        where: {
          OR: [
            { customerId: email },
            { metadata: { path: ['customerEmail'], equals: email } }
          ]
        },
        include: {
          messages: true,
          responseSuggestions: true,
        }
      });

      // Return via privacy service for proper formatting
      return await privacyService.handleDataAccessRequest(email);
    } catch (error) {
      console.error('Data access request failed:', error);
      throw error;
    }
  }

  /**
   * Process data subject deletion request (GDPR)
   */
  async handleDataSubjectDeletionRequest(email: string): Promise<{ success: boolean; deletedRecords: number }> {
    monitoringService.recordMetric('gdpr_deletion_request', 1, 'count', { type: 'deletion' });
    
    try {
      let deletedRecords = 0;

      // Find all conversations associated with the email
      const conversations = await this.prisma.conversation.findMany({
        where: {
          OR: [
            { customerId: email },
            { metadata: { path: ['customerEmail'], equals: email } }
          ]
        }
      });

      // Delete associated data in proper order (respecting foreign key constraints)
      for (const conversation of conversations) {
        // Delete response suggestions
        await this.prisma.responseSuggestion.deleteMany({
          where: { messageId: { in: conversation.messages?.map(m => m.id) || [] } }
        });

        // Delete messages
        await this.prisma.message.deleteMany({
          where: { conversationId: conversation.id }
        });

        // Delete conversation
        await this.prisma.conversation.delete({
          where: { id: conversation.id }
        });

        deletedRecords++;
      }

      return await privacyService.handleDataDeletionRequest(email);
    } catch (error) {
      console.error('Data deletion request failed:', error);
      throw error;
    }
  }

  /**
   * Check database health
   * @returns Health check data
   */
  async checkHealth(): Promise<HealthCheck | null> {
    return await this.prisma.healthCheck.findFirst({
      orderBy: { lastCheck: 'desc' },
    });
  }

  /**
   * Update health check status
   * @param status - Health status
   * @param metadata - Additional metadata
   */
  async updateHealthCheck(
    status: string,
    metadata?: Prisma.InputJsonValue
  ): Promise<HealthCheck> {
    const updateData = {
      status,
      lastCheck: new Date(),
      ...(metadata !== undefined && { metadata }),
    };

    return await this.prisma.healthCheck.upsert({
      where: { id: 1 },
      update: updateData,
      create: {
        id: 1,
        ...updateData,
      },
    });
  }

  // Conversation Operations

  /**
   * Create a new conversation
   * @param data - Conversation data
   * @returns Created conversation
   */
  async createConversation(
    data: CreateConversationData
  ): Promise<Conversation> {
    return await this.prisma.conversation.create({
      data,
    });
  }

  /**
   * Find conversation by ID
   * @param id - Conversation ID
   * @returns Conversation with messages
   */
  async findConversationById(
    id: string
  ): Promise<(Conversation & { messages: Message[] }) | null> {
    return await this.prisma.conversation.findUnique({
      where: { id },
      include: { messages: true },
    });
  }

  /**
   * Find conversations by agent
   * @param agentId - Agent ID
   * @returns Agent's conversations
   */
  async findConversationsByAgent(
    agentId: string
  ): Promise<(Conversation & { messages: Message[] })[]> {
    return await this.prisma.conversation.findMany({
      where: { agentId },
      include: { messages: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Find conversation by Zendesk ticket ID
   * @param zendeskTicketId - Zendesk ticket ID
   * @returns Conversation
   */
  async findConversationByZendeskTicket(
    zendeskTicketId: string
  ): Promise<Conversation | null> {
    return await this.prisma.conversation.findUnique({
      where: { zendeskTicketId },
    });
  }

  /**
   * Update conversation
   * @param id - Conversation ID
   * @param data - Update data
   * @returns Updated conversation
   */
  async updateConversation(
    id: string,
    data: Partial<CreateConversationData>
  ): Promise<Conversation> {
    return await this.prisma.conversation.update({
      where: { id },
      data,
    });
  }

  /**
   * Update conversation status
   * @param id - Conversation ID
   * @param status - New status
   * @returns Updated conversation
   */
  async updateConversationStatus(
    id: string,
    status: ConversationStatus
  ): Promise<Conversation> {
    return await this.prisma.conversation.update({
      where: { id },
      data: { status },
    });
  }

  // Message Operations

  /**
   * Create a new message with encryption
   * @param data - Message data
   * @returns Created message
   */
  async createMessage(data: CreateMessageData): Promise<Message> {
    const startTime = Date.now();
    
    try {
      // Encrypt sensitive content
      const encryptedContent = await this.encryptSensitiveContent(
        data.content, 
        'message', 
        'content'
      );

      const message = await this.prisma.message.create({
        data: {
          ...data,
          content: encryptedContent,
        },
      });

      // Record performance metrics
      monitoringService.recordPerformanceMetric(
        'database_create_message',
        Date.now() - startTime,
        true,
        { encrypted: this.encryptSensitiveData.toString() }
      );

      return message;
    } catch (error) {
      monitoringService.recordPerformanceMetric(
        'database_create_message',
        Date.now() - startTime,
        false,
        { error: error instanceof Error ? error.message : 'unknown' }
      );
      throw error;
    }
  }

  /**
   * Add AI analysis to a message
   * @param messageId - Message ID
   * @param analysis - AI analysis data
   * @returns Updated message
   */
  async addAIAnalysis(
    messageId: string,
    analysis: AIAnalysisData
  ): Promise<Message> {
    return await this.prisma.message.update({
      where: { id: messageId },
      data: { aiAnalysis: analysis as Prisma.InputJsonValue },
    });
  }

  /**
   * Find a message by ID
   * @param messageId - Message ID
   * @returns Message or null
   */
  async findMessageById(messageId: string): Promise<Message | null> {
    return await this.prisma.message.findUnique({
      where: { id: messageId },
    });
  }

  /**
   * Find messages for a conversation
   * @param conversationId - Conversation ID
   * @returns Messages ordered by timestamp
   */
  async findMessagesByConversation(conversationId: string): Promise<Message[]> {
    return await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'asc' },
    });
  }

  // Response Suggestion Operations

  /**
   * Create a response suggestion
   * @param data - Suggestion data
   * @returns Created suggestion
   */
  async createResponseSuggestion(
    data: CreateResponseSuggestionData
  ): Promise<ResponseSuggestion> {
    return await this.prisma.responseSuggestion.create({
      data,
    });
  }

  /**
   * Find suggestions for a message
   * @param messageId - Message ID
   * @returns Suggestions ordered by confidence
   */
  async findSuggestionsByMessage(
    messageId: string
  ): Promise<ResponseSuggestion[]> {
    return await this.prisma.responseSuggestion.findMany({
      where: { messageId },
      orderBy: { confidence: 'desc' },
    });
  }

  /**
   * Mark suggestion as accepted
   * @param suggestionId - Suggestion ID
   * @returns Updated suggestion
   */
  async acceptSuggestion(suggestionId: string): Promise<ResponseSuggestion> {
    return await this.prisma.responseSuggestion.update({
      where: { id: suggestionId },
      data: { accepted: true },
    });
  }

  // Analytics Operations

  /**
   * Get conversation analytics
   * @param conversationId - Conversation ID
   * @returns Analytics data
   */
  async getConversationAnalytics(conversationId: string): Promise<any> {
    // This would typically compute analytics from messages
    // For now, return basic message count
    const messageCount = await this.prisma.message.count({
      where: { conversationId },
    });

    return {
      totalMessages: messageCount,
      // Additional analytics would be computed here
    };
  }

  /**
   * Get agent performance for a date range
   * @param agentId - Agent ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Performance metrics
   */
  async getAgentPerformance(
    agentId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    return await this.prisma.agentPerformanceDaily.findMany({
      where: {
        agentId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });
  }
}
