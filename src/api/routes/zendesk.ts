/**
 * Zendesk App API Routes
 * Handles OAuth, installation, and app-specific endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { zendeskAuthService } from '../../zendesk/auth-service';
import { getKafkaService } from '../../messaging/kafka';
import { DatabaseService } from '../../services/database';

export const zendeskRoutes = Router();

/**
 * Middleware to validate Zendesk app authentication
 */
async function validateZendeskAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res
        .status(401)
        .json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.slice(7);
    const installation = await zendeskAuthService.validateAccessToken(token);

    if (!installation) {
      res.status(401).json({ error: 'Invalid or expired access token' });
      return;
    }

    // Add installation context to request
    (req as any).zendeskInstallation = installation;
    next();
  } catch (error) {
    console.error('Zendesk auth validation error:', error);
    res.status(500).json({ error: 'Authentication validation failed' });
  }
}

// OAuth Endpoints
zendeskRoutes.get('/auth/authorize', (req: Request, res: Response) => {
  zendeskAuthService.handleAuthorize(req, res);
});

zendeskRoutes.post('/auth/token', (req: Request, res: Response) => {
  zendeskAuthService.handleTokenExchange(req, res);
});

// App Lifecycle Endpoints
zendeskRoutes.post('/app/install', (req: Request, res: Response) => {
  zendeskAuthService.handleAppInstallation(req, res);
});

zendeskRoutes.delete(
  '/app/uninstall/:installation_id',
  (req: Request, res: Response) => {
    zendeskAuthService.handleAppUninstallation(req, res);
  }
);

// Protected App API Endpoints (require authentication)

/**
 * Get sentiment analysis for a conversation
 */
zendeskRoutes.get(
  '/api/v1/sentiment/:conversationId',
  validateZendeskAuth,
  async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      // Installation context available but not used in this endpoint
      // const installation = (req as any).zendeskInstallation;

      // Get conversation sentiment data from database
      const dbService = new DatabaseService();
      const conversation = await dbService.findConversationById(
        conversationId!
      );

      if (!conversation) {
        res.status(404).json({
          error: 'Conversation not found',
          conversationId,
        });
        return;
      }

      // Get messages with sentiment analysis
      const messages = await dbService.findMessagesByConversation(
        conversationId!
      );

      // Calculate overall sentiment
      const sentimentScores = messages
        .map((msg: any) => msg.sentimentScore)
        .filter((score: any) => score !== null && score !== undefined);

      const overallSentiment =
        sentimentScores.length > 0
          ? sentimentScores.reduce(
              (sum: number, score: number) => sum + score,
              0
            ) / sentimentScores.length
          : 0;

      res.json({
        conversationId,
        sentimentScore: overallSentiment,
        sentiment:
          overallSentiment > 0.2
            ? 'positive'
            : overallSentiment < -0.2
              ? 'negative'
              : 'neutral',
        messageCount: messages.length,
        messages: messages.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender,
          sentimentScore: msg.sentimentScore,
          detectedIntent: msg.detectedIntent,
          createdAt: msg.createdAt,
        })),
        analyzedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching sentiment analysis:', error);
      res.status(500).json({
        error: 'Failed to fetch sentiment analysis',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Get response suggestions for a conversation
 */
zendeskRoutes.get(
  '/api/v1/suggestions/:conversationId',
  validateZendeskAuth,
  async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { refresh = 'false' } = req.query;
      // Installation context available but not used in this endpoint
      // const installation = (req as any).zendeskInstallation;

      // Get conversation context
      const dbService = new DatabaseService();
      const conversation = await dbService.findConversationById(
        conversationId!
      );

      if (!conversation) {
        res.status(404).json({
          error: 'Conversation not found',
          conversationId,
        });
        return;
      }

      // Get recent messages for context
      const messages = await dbService.findMessagesByConversation(
        conversationId!
      );
      const recentMessages = messages.slice(-5); // Last 5 messages

      // Generate suggestions based on conversation context
      const suggestions = await generateResponseSuggestions(
        recentMessages,
        installation.settings
      );

      res.json({
        conversationId,
        suggestions,
        generatedAt: new Date().toISOString(),
        context: {
          messageCount: recentMessages.length,
          lastMessageSender:
            recentMessages[recentMessages.length - 1]?.senderType,
        },
      });
    } catch (error) {
      console.error('Error fetching response suggestions:', error);
      res.status(500).json({
        error: 'Failed to fetch response suggestions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Get analytics for a conversation
 */
zendeskRoutes.get(
  '/api/v1/analytics/:conversationId',
  validateZendeskAuth,
  async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      // Installation context available but not used in this endpoint
      // const installation = (req as any).zendeskInstallation;

      // Get conversation analytics
      const dbService = new DatabaseService();
      const conversation = await dbService.findConversationById(
        conversationId!
      );

      if (!conversation) {
        res.status(404).json({
          error: 'Conversation not found',
          conversationId,
        });
        return;
      }

      const messages = await dbService.findMessagesByConversation(
        conversationId!
      );

      // Calculate analytics
      const analytics = calculateConversationAnalytics(messages, conversation);

      res.json({
        conversationId,
        ...analytics,
        calculatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({
        error: 'Failed to fetch analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Send event to processing pipeline
 */
zendeskRoutes.post(
  '/api/v1/events',
  validateZendeskAuth,
  async (req: Request, res: Response) => {
    try {
      const { type, data } = req.body;
      // Installation context available but not used in this endpoint
      // const installation = (req as any).zendeskInstallation;

      if (!type || !data) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['type', 'data'],
        });
        return;
      }

      // Publish event to Kafka
      const kafkaService = getKafkaService();

      switch (type) {
        case 'message':
          await kafkaService.publishMessageEvent({
            type: 'MESSAGE_CREATED',
            messageId: data.messageId,
            conversationId: data.conversationId,
            content: data.content,
            sender: data.sender,
            timestamp: new Date().toISOString(),
          });
          break;

        case 'conversation':
          await kafkaService.publishConversationEvent({
            type: data.eventType || 'CONVERSATION_UPDATED',
            conversationId: data.conversationId,
            ticketId: data.ticketId,
            customerId: data.customerId,
            agentId: data.agentId,
            status: data.status,
            timestamp: new Date().toISOString(),
          });
          break;

        default:
          res.status(400).json({
            error: 'Unsupported event type',
            supportedTypes: ['message', 'conversation'],
          });
          return;
      }

      res.status(201).json({
        status: 'event_published',
        type,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error publishing event:', error);
      res.status(500).json({
        error: 'Failed to publish event',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Health check endpoint for Zendesk app
 */
zendeskRoutes.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'ConversationIQ Zendesk App',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Helper Functions

/**
 * Generate response suggestions based on conversation context
 */
async function generateResponseSuggestions(
  messages: any[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  settings: Record<string, any>
): Promise<any[]> {
  // Mock response suggestions - in real implementation, this would use AI/ML
  const suggestions = [
    {
      id: 'suggestion-1',
      type: 'response',
      text: 'Thank you for bringing this to our attention. Let me help you resolve this issue.',
      confidence: 0.85,
      category: 'acknowledgment',
    },
    {
      id: 'suggestion-2',
      type: 'response',
      text: 'I understand your frustration. Let me escalate this to our specialist team.',
      confidence: 0.78,
      category: 'empathy',
    },
    {
      id: 'suggestion-3',
      type: 'response',
      text: "Based on what you've described, I recommend trying the following steps...",
      confidence: 0.72,
      category: 'solution',
    },
  ];

  // Filter suggestions based on conversation context
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.sentimentScore && lastMessage.sentimentScore < -0.5) {
    // For negative sentiment, prioritize empathy responses
    return suggestions.filter(
      s => s.category === 'empathy' || s.category === 'acknowledgment'
    );
  }

  return suggestions;
}

/**
 * Calculate conversation analytics
 */
function calculateConversationAnalytics(
  messages: any[],
  conversation: any
): any {
  const now = new Date();
  const conversationStart = new Date(conversation.createdAt);
  const duration = (now.getTime() - conversationStart.getTime()) / 1000; // seconds

  // Calculate response times
  const agentMessages = messages.filter(msg => msg.sender === 'AGENT');
  const customerMessages = messages.filter(msg => msg.sender === 'CUSTOMER');

  let totalResponseTime = 0;
  let responseCount = 0;

  // Calculate average response time
  for (let i = 1; i < messages.length; i++) {
    const current = messages[i];
    const previous = messages[i - 1];

    if (current.sender === 'AGENT' && previous.sender === 'CUSTOMER') {
      const responseTime =
        (new Date(current.createdAt).getTime() -
          new Date(previous.createdAt).getTime()) /
        1000;
      totalResponseTime += responseTime;
      responseCount++;
    }
  }

  const averageResponseTime =
    responseCount > 0 ? totalResponseTime / responseCount : 0;

  // Calculate sentiment trend
  const sentimentScores = messages
    .map(msg => msg.sentimentScore)
    .filter(score => score !== null && score !== undefined);

  let sentimentTrend = 0;
  if (sentimentScores.length >= 2) {
    const firstHalf = sentimentScores.slice(
      0,
      Math.floor(sentimentScores.length / 2)
    );
    const secondHalf = sentimentScores.slice(
      Math.floor(sentimentScores.length / 2)
    );
    const firstAvg =
      firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
    sentimentTrend = secondAvg - firstAvg;
  }

  // Calculate escalation risk
  const negativeMessages = messages.filter(
    msg => msg.sentimentScore && msg.sentimentScore < -0.3
  );
  const escalationRisk = Math.min(
    negativeMessages.length / Math.max(messages.length, 1),
    1
  );

  return {
    averageResponseTime: Math.round(averageResponseTime),
    sentimentTrend: Math.round(sentimentTrend * 100) / 100,
    escalationRisk: Math.round(escalationRisk * 100) / 100,
    messageCount: messages.length,
    agentMessageCount: agentMessages.length,
    customerMessageCount: customerMessages.length,
    conversationDuration: Math.round(duration),
    insights: [
      {
        type: 'trend',
        message:
          sentimentTrend > 0.1
            ? 'Sentiment is improving'
            : sentimentTrend < -0.1
              ? 'Sentiment is declining'
              : 'Sentiment is stable',
      },
      {
        type: escalationRisk > 0.7 ? 'escalation' : 'positive',
        message:
          escalationRisk > 0.7
            ? 'High escalation risk detected'
            : escalationRisk > 0.4
              ? 'Moderate escalation risk'
              : 'Low escalation risk',
      },
    ],
  };
}
