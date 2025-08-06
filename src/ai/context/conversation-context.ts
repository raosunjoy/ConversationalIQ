/**
 * Advanced Conversation Context System
 * Maintains customer history, conversation memory, and contextual understanding
 */

import { EventEmitter } from 'events';
import {
  ConversationContext,
  Message,
  SentimentResult,
  IntentResult,
  AIProcessingError,
} from '../models';
import { DatabaseService } from '../../services/database';

export interface CustomerProfile {
  id: string;
  email: string;
  name?: string;
  tier: 'basic' | 'premium' | 'enterprise';
  totalTickets: number;
  totalSpent: number;
  satisfaction: number; // 0-1
  language: string;
  timezone: string;
  preferences: {
    communicationStyle: 'formal' | 'casual' | 'technical';
    responseTime: 'immediate' | 'business_hours' | 'flexible';
    channelPreference: string[];
    topics: string[];
  };
  history: {
    previousIssues: string[];
    resolutionSuccess: number; // 0-1
    escalationCount: number;
    averageResponseTime: number;
    lastInteraction: Date;
  };
  segments: string[]; // ['high_value', 'tech_savvy', 'frequent_user']
}

export interface ConversationMemory {
  conversationId: string;
  startTime: Date;
  context: {
    previousConversations: string[]; // Related conversation IDs
    products: string[];
    issues: string[];
    resolutions: string[];
    keywords: string[];
    entities: Array<{
      type: 'person' | 'product' | 'location' | 'organization';
      value: string;
      confidence: number;
    }>;
  };
  timeline: Array<{
    timestamp: Date;
    event: 'message' | 'status_change' | 'escalation' | 'resolution';
    details: any;
    sentiment?: number;
  }>;
  summary: {
    mainIssue: string;
    resolution: string | null;
    outcome: 'resolved' | 'escalated' | 'pending' | 'abandoned';
    satisfactionPredicted: number;
  };
}

export interface ContextualInsight {
  type:
    | 'customer_history'
    | 'product_knowledge'
    | 'similar_cases'
    | 'escalation_risk';
  confidence: number;
  insight: string;
  actionable: boolean;
  suggestedActions: string[];
  relevantData: any;
}

export class ConversationContextService extends EventEmitter {
  private databaseService: DatabaseService;
  private customerProfiles: Map<string, CustomerProfile>;
  private conversationMemories: Map<string, ConversationMemory>;
  private knowledgeBase: Map<string, any>;
  private initialized = false;

  constructor() {
    super();
    this.databaseService = new DatabaseService();
    this.customerProfiles = new Map();
    this.conversationMemories = new Map();
    this.knowledgeBase = new Map();
  }

  /**
   * Initialize the context service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('Initializing Conversation Context Service...');

      // Load existing customer profiles and conversation memories
      await this.loadCustomerProfiles();
      await this.loadConversationMemories();
      await this.initializeKnowledgeBase();

      this.initialized = true;
      console.log('Conversation Context Service initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error(
        'Failed to initialize Conversation Context Service:',
        error
      );
      throw new AIProcessingError(
        'Context service initialization failed',
        'CONTEXT_INIT_ERROR',
        'pipeline',
        false
      );
    }
  }

  /**
   * Get or create customer profile
   */
  async getCustomerProfile(
    customerId: string,
    email?: string
  ): Promise<CustomerProfile> {
    let profile = this.customerProfiles.get(customerId);

    if (!profile) {
      profile = await this.createCustomerProfile(customerId, email);
    }

    return profile;
  }

  /**
   * Get conversation memory with context
   */
  async getConversationMemory(
    conversationId: string
  ): Promise<ConversationMemory> {
    let memory = this.conversationMemories.get(conversationId);

    if (!memory) {
      memory = await this.createConversationMemory(conversationId);
    }

    return memory;
  }

  /**
   * Generate contextual insights for a conversation
   */
  async generateContextualInsights(
    conversationId: string,
    message: Message
  ): Promise<ContextualInsight[]> {
    const insights: ContextualInsight[] = [];
    const memory = await this.getConversationMemory(conversationId);
    const customerProfile = await this.getCustomerProfile(
      message.conversationId || ''
    );

    // Customer history insights
    const historyInsight = await this.generateCustomerHistoryInsight(
      customerProfile,
      message
    );
    if (historyInsight) insights.push(historyInsight);

    // Product knowledge insights
    const productInsight = await this.generateProductKnowledgeInsight(
      memory,
      message
    );
    if (productInsight) insights.push(productInsight);

    // Similar cases insight
    const similarCasesInsight = await this.generateSimilarCasesInsight(
      memory,
      message
    );
    if (similarCasesInsight) insights.push(similarCasesInsight);

    // Escalation risk insight
    const escalationInsight = await this.generateEscalationRiskInsight(
      customerProfile,
      memory
    );
    if (escalationInsight) insights.push(escalationInsight);

    return insights.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Update conversation memory with new information
   */
  async updateConversationMemory(
    conversationId: string,
    event: {
      type: 'message' | 'status_change' | 'escalation' | 'resolution';
      details: any;
      sentiment?: SentimentResult;
      intent?: IntentResult;
    }
  ): Promise<void> {
    const memory = await this.getConversationMemory(conversationId);

    // Add to timeline
    const timelineEvent: any = {
      timestamp: new Date(),
      event: event.type,
      details: event.details,
    };
    if (event.sentiment?.score !== undefined) {
      timelineEvent.sentiment = event.sentiment.score;
    }
    memory.timeline.push(timelineEvent);

    // Update context based on new information
    if (event.type === 'message') {
      await this.extractAndUpdateContext(memory, event.details, event.intent);
    }

    // Update conversation summary
    await this.updateConversationSummary(memory, event);

    // Save updated memory
    this.conversationMemories.set(conversationId, memory);

    this.emit('memoryUpdated', { conversationId, memory });
  }

  /**
   * Get personalized response suggestions based on context
   */
  async getContextAwareResponseSuggestions(
    conversationId: string,
    message: Message,
    baselineResponses: any[]
  ): Promise<any[]> {
    const memory = await this.getConversationMemory(conversationId);
    const customerProfile = await this.getCustomerProfile(
      message.conversationId || ''
    );
    const insights = await this.generateContextualInsights(
      conversationId,
      message
    );

    // Enhance responses with context
    const contextualResponses = baselineResponses.map(response => {
      return this.enhanceResponseWithContext(
        response,
        customerProfile,
        memory,
        insights
      );
    });

    // Add context-specific responses
    const contextSpecificResponses =
      await this.generateContextSpecificResponses(
        customerProfile,
        memory,
        insights,
        message
      );

    // Combine and rank by contextual relevance
    const allResponses = [...contextualResponses, ...contextSpecificResponses];
    return this.rankResponsesByContext(allResponses, customerProfile, memory);
  }

  /**
   * Private Methods
   */

  private async loadCustomerProfiles(): Promise<void> {
    // In a real implementation, this would load from database
    // For now, we'll initialize empty
    console.log('Loading customer profiles...');
  }

  private async loadConversationMemories(): Promise<void> {
    // In a real implementation, this would load from database
    console.log('Loading conversation memories...');
  }

  private async initializeKnowledgeBase(): Promise<void> {
    // Initialize with sample knowledge base entries
    const sampleKnowledge = {
      billing_issues: {
        commonCauses: ['payment_failure', 'plan_confusion', 'billing_cycle'],
        solutions: ['verify_payment_method', 'explain_billing', 'adjust_plan'],
        escalationTriggers: ['disputed_charges', 'recurring_issues'],
      },
      technical_issues: {
        commonCauses: ['user_error', 'software_bug', 'integration_problem'],
        solutions: ['troubleshooting_steps', 'bug_report', 'technical_support'],
        escalationTriggers: ['critical_system_down', 'data_loss'],
      },
      account_issues: {
        commonCauses: ['locked_account', 'password_reset', 'permissions'],
        solutions: [
          'unlock_account',
          'reset_credentials',
          'adjust_permissions',
        ],
        escalationTriggers: ['security_breach', 'unauthorized_access'],
      },
    };

    Object.entries(sampleKnowledge).forEach(([key, value]) => {
      this.knowledgeBase.set(key, value);
    });

    console.log('Knowledge base initialized with sample data');
  }

  private async createCustomerProfile(
    customerId: string,
    email: string = `customer-${customerId}@example.com`
  ): Promise<CustomerProfile> {
    // Create basic profile - in production, this would query customer database
    const profile: CustomerProfile = {
      id: customerId,
      email: email,
      tier: 'basic',
      totalTickets: 0,
      totalSpent: 0,
      satisfaction: 0.8, // Default satisfaction
      language: 'en',
      timezone: 'UTC',
      preferences: {
        communicationStyle: 'formal',
        responseTime: 'business_hours',
        channelPreference: ['email', 'chat'],
        topics: [],
      },
      history: {
        previousIssues: [],
        resolutionSuccess: 0.8,
        escalationCount: 0,
        averageResponseTime: 24, // hours
        lastInteraction: new Date(),
      },
      segments: [],
    };

    this.customerProfiles.set(customerId, profile);
    return profile;
  }

  private async createConversationMemory(
    conversationId: string
  ): Promise<ConversationMemory> {
    const memory: ConversationMemory = {
      conversationId,
      startTime: new Date(),
      context: {
        previousConversations: [],
        products: [],
        issues: [],
        resolutions: [],
        keywords: [],
        entities: [],
      },
      timeline: [],
      summary: {
        mainIssue: '',
        resolution: null,
        outcome: 'pending',
        satisfactionPredicted: 0.7,
      },
    };

    this.conversationMemories.set(conversationId, memory);
    return memory;
  }

  private async generateCustomerHistoryInsight(
    profile: CustomerProfile,
    message: Message
  ): Promise<ContextualInsight | null> {
    if (profile.history.previousIssues.length === 0) return null;

    const relevantHistory = profile.history.previousIssues.filter(issue =>
      message.content.toLowerCase().includes(issue.toLowerCase())
    );

    if (relevantHistory.length === 0) return null;

    return {
      type: 'customer_history',
      confidence: 0.8,
      insight: `Customer has previously reported similar issues: ${relevantHistory.join(', ')}`,
      actionable: true,
      suggestedActions: [
        'Reference previous resolution',
        'Check if this is a recurring issue',
        'Offer priority support for repeat issues',
      ],
      relevantData: { previousIssues: relevantHistory, profile },
    };
  }

  private async generateProductKnowledgeInsight(
    memory: ConversationMemory,
    message: Message
  ): Promise<ContextualInsight | null> {
    // Detect product/service mentions in message
    const detectedProducts = this.extractProductMentions(message.content);
    if (detectedProducts.length === 0) return null;

    const product = detectedProducts[0];
    if (!product) return null;
    const knowledge = this.knowledgeBase.get(product);
    if (!knowledge) return null;

    return {
      type: 'product_knowledge',
      confidence: 0.75,
      insight: `This appears to be a ${product} related inquiry. Common solutions include: ${knowledge.solutions.join(', ')}`,
      actionable: true,
      suggestedActions: knowledge.solutions,
      relevantData: { product, knowledge },
    };
  }

  private async generateSimilarCasesInsight(
    memory: ConversationMemory,
    message: Message
  ): Promise<ContextualInsight | null> {
    // This would query a database of similar cases
    // For now, simulate finding similar cases
    const similarCases = await this.findSimilarConversations(message.content);

    if (similarCases.length === 0) return null;

    return {
      type: 'similar_cases',
      confidence: 0.7,
      insight: `Found ${similarCases.length} similar cases with average resolution time of 2.5 hours`,
      actionable: true,
      suggestedActions: [
        'Apply solutions from similar cases',
        'Set expectations based on typical resolution time',
      ],
      relevantData: { similarCases },
    };
  }

  private async generateEscalationRiskInsight(
    profile: CustomerProfile,
    memory: ConversationMemory
  ): Promise<ContextualInsight | null> {
    let riskScore = 0;

    // Calculate escalation risk based on various factors
    if (profile.history.escalationCount > 2) riskScore += 0.3;
    if (profile.satisfaction < 0.6) riskScore += 0.2;
    if (memory.timeline.length > 10) riskScore += 0.2; // Long conversation

    const recentNegativeSentiment = memory.timeline
      .slice(-3)
      .filter(event => event.sentiment && event.sentiment < -0.3).length;

    if (recentNegativeSentiment >= 2) riskScore += 0.3;

    if (riskScore < 0.5) return null;

    return {
      type: 'escalation_risk',
      confidence: Math.min(riskScore, 1),
      insight: `High escalation risk detected (${Math.round(riskScore * 100)}%). Customer shows signs of frustration.`,
      actionable: true,
      suggestedActions: [
        'Consider proactive escalation',
        'Offer compensation or gesture of goodwill',
        'Switch to more empathetic tone',
        'Provide direct contact information',
      ],
      relevantData: {
        riskScore,
        factors: { profile, timeline: memory.timeline },
      },
    };
  }

  private async extractAndUpdateContext(
    memory: ConversationMemory,
    messageDetails: any,
    intent?: IntentResult
  ): Promise<void> {
    const content = messageDetails.content || '';

    // Extract keywords
    const keywords = this.extractKeywords(content);
    memory.context.keywords.push(...keywords);

    // Extract entities
    const entities = this.extractEntities(content);
    const typedEntities = entities.map(entity => ({
      type: entity.type as 'person' | 'product' | 'location' | 'organization',
      value: entity.value,
      confidence: entity.confidence,
    }));
    memory.context.entities.push(...typedEntities);

    // Update issues based on intent
    if (intent) {
      if (!memory.context.issues.includes(intent.primaryIntent.category)) {
        memory.context.issues.push(intent.primaryIntent.category);
      }
    }

    // Extract product mentions
    const products = this.extractProductMentions(content);
    memory.context.products.push(...products);

    // Remove duplicates and keep recent items
    memory.context.keywords = [...new Set(memory.context.keywords)].slice(-20);
    memory.context.products = [...new Set(memory.context.products)];
    memory.context.issues = [...new Set(memory.context.issues)];
  }

  private async updateConversationSummary(
    memory: ConversationMemory,
    event: any
  ): Promise<void> {
    // Update main issue if not set
    if (!memory.summary.mainIssue && memory.context.issues.length > 0) {
      memory.summary.mainIssue = memory.context.issues[0] || '';
    }

    // Update outcome based on event type
    if (event.type === 'resolution') {
      memory.summary.outcome = 'resolved';
      memory.summary.resolution = event.details.resolution;
    } else if (event.type === 'escalation') {
      memory.summary.outcome = 'escalated';
    }

    // Update satisfaction prediction based on sentiment trend
    const recentSentiments = memory.timeline
      .slice(-5)
      .map(e => e.sentiment)
      .filter(s => s !== undefined) as number[];

    if (recentSentiments.length > 0) {
      const avgSentiment =
        recentSentiments.reduce((sum, s) => sum + s, 0) /
        recentSentiments.length;
      memory.summary.satisfactionPredicted = Math.max(
        0,
        Math.min(1, (avgSentiment + 1) / 2)
      );
    }
  }

  private enhanceResponseWithContext(
    response: any,
    profile: CustomerProfile,
    memory: ConversationMemory,
    insights: ContextualInsight[]
  ): any {
    const enhanced = { ...response };

    // Adjust tone based on customer preference
    if (profile.preferences.communicationStyle === 'casual') {
      enhanced.tone = 'friendly';
    } else if (profile.preferences.communicationStyle === 'technical') {
      enhanced.tone = 'professional';
    }

    // Add context-specific confidence boost
    const contextRelevance = this.calculateContextRelevance(response, insights);
    enhanced.confidence = Math.min(
      1,
      enhanced.confidence + contextRelevance * 0.1
    );

    // Add context reasoning
    if (contextRelevance > 0.5) {
      enhanced.reasoning = `${enhanced.reasoning || ''} [Enhanced based on customer context and history]`;
    }

    return enhanced;
  }

  private async generateContextSpecificResponses(
    profile: CustomerProfile,
    memory: ConversationMemory,
    insights: ContextualInsight[],
    message: Message
  ): Promise<any[]> {
    const contextResponses: any[] = [];

    // Generate responses based on high-confidence insights
    insights
      .filter(insight => insight.confidence > 0.7 && insight.actionable)
      .forEach(insight => {
        insight.suggestedActions.forEach(action => {
          contextResponses.push({
            id: `context_${insight.type}_${Date.now()}`,
            content: this.generateActionResponse(action, insight, profile),
            confidence: insight.confidence * 0.9,
            category: 'context_aware',
            tone:
              profile.preferences.communicationStyle === 'formal'
                ? 'professional'
                : 'friendly',
            tags: ['context_aware', insight.type],
            reasoning: `Context-aware suggestion based on ${insight.type}: ${insight.insight}`,
            contextInsight: insight,
          });
        });
      });

    return contextResponses.slice(0, 3); // Limit to top 3 context-specific responses
  }

  private rankResponsesByContext(
    responses: any[],
    profile: CustomerProfile,
    memory: ConversationMemory
  ): any[] {
    return responses.sort((a, b) => {
      let scoreA = a.confidence;
      let scoreB = b.confidence;

      // Boost context-aware responses
      if (a.category === 'context_aware') scoreA += 0.1;
      if (b.category === 'context_aware') scoreB += 0.1;

      // Boost responses that match customer communication style
      const preferredTone =
        profile.preferences.communicationStyle === 'formal'
          ? 'professional'
          : 'friendly';
      if (a.tone === preferredTone) scoreA += 0.05;
      if (b.tone === preferredTone) scoreB += 0.05;

      return scoreB - scoreA;
    });
  }

  // Utility methods
  private extractKeywords(content: string): string[] {
    // Simple keyword extraction - in production, use NLP libraries
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    return [...new Set(words)];
  }

  private extractEntities(
    content: string
  ): Array<{ type: string; value: string; confidence: number }> {
    // Simple entity extraction - in production, use NER models
    const entities: Array<{ type: string; value: string; confidence: number }> =
      [];

    // Email pattern
    const emails = content.match(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
    );
    if (emails) {
      emails.forEach(email =>
        entities.push({ type: 'email', value: email, confidence: 0.9 })
      );
    }

    return entities;
  }

  private extractProductMentions(content: string): string[] {
    const products = ['billing_issues', 'technical_issues', 'account_issues'];
    return products.filter(product =>
      content.toLowerCase().includes(product.replace('_', ' '))
    );
  }

  private async findSimilarConversations(content: string): Promise<any[]> {
    // Simulate finding similar conversations
    // In production, this would use vector similarity search
    return [
      { id: 'conv_1', similarity: 0.85, resolution: 'password_reset' },
      { id: 'conv_2', similarity: 0.78, resolution: 'account_unlock' },
    ];
  }

  private calculateContextRelevance(
    response: any,
    insights: ContextualInsight[]
  ): number {
    // Calculate how relevant the response is based on available insights
    let relevance = 0;

    insights.forEach(insight => {
      if (response.tags?.some((tag: string) => insight.type.includes(tag))) {
        relevance += insight.confidence * 0.3;
      }
    });

    return Math.min(1, relevance);
  }

  private generateActionResponse(
    action: string,
    insight: ContextualInsight,
    profile: CustomerProfile
  ): string {
    const templates = {
      reference_previous_resolution: `I see you've had a similar issue before. Based on your previous case, let me apply the same solution that worked for you.`,
      verify_payment_method: `Let me help you verify your payment method. I'll check your account details to ensure everything is up to date.`,
      consider_proactive_escalation: `I want to make sure we resolve this quickly for you. Let me connect you with a specialist who can provide immediate assistance.`,
      offer_compensation: `I apologize for the inconvenience. As a valued customer, I'd like to discuss how we can make this right for you.`,
    };

    const actionKey = action.replace(/\s+/g, '_').toLowerCase();
    return (
      templates[actionKey as keyof typeof templates] ||
      `Let me help you with ${action.replace('_', ' ')}.`
    );
  }

  /**
   * Get service health status
   */
  async isHealthy(): Promise<boolean> {
    return this.initialized;
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      initialized: this.initialized,
      customerProfiles: this.customerProfiles.size,
      conversationMemories: this.conversationMemories.size,
      knowledgeBaseEntries: this.knowledgeBase.size,
    };
  }
}

// Export singleton instance
export const conversationContextService = new ConversationContextService();
