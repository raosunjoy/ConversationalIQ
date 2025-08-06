/**
 * Escalation Prevention System
 * Proactive detection and prevention of customer escalations
 */

import { EventEmitter } from 'events';
import {
  ConversationContext,
  Message,
  SentimentResult,
  IntentResult,
  AIProcessingError,
} from '../models';
import { conversationContextService, CustomerProfile, ConversationMemory } from '../context/conversation-context';
import { DatabaseService } from '../../services/database';

export interface EscalationPrediction {
  conversationId: string;
  riskScore: number; // 0-1
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: EscalationRiskFactor[];
  prediction: {
    timeToEscalation: number; // minutes
    escalationProbability: number; // 0-1
    confidence: number; // 0-1
  };
  preventionActions: PreventionAction[];
  managerAlert: boolean;
}

export interface EscalationRiskFactor {
  type: 'sentiment_decline' | 'repeat_issue' | 'response_delay' | 'complexity' | 'customer_history' | 'agent_performance';
  severity: number; // 0-1
  description: string;
  weight: number;
  mitigable: boolean;
}

export interface PreventionAction {
  type: 'proactive_contact' | 'escalate_now' | 'offer_compensation' | 'change_tone' | 'provide_update' | 'transfer_agent';
  priority: 'immediate' | 'urgent' | 'normal';
  description: string;
  estimatedImpact: number; // 0-1
  costEstimate?: number;
  requiresApproval: boolean;
  suggestedResponse?: string;
}

export interface EscalationPlaybook {
  id: string;
  name: string;
  triggerConditions: {
    riskScore: number;
    riskFactors: string[];
    customerSegments: string[];
  };
  actions: PreventionAction[];
  successRate: number;
  lastUpdated: Date;
}

export class EscalationPreventionService extends EventEmitter {
  private databaseService: DatabaseService;
  private escalationModels: Map<string, any>;
  private playbooks: Map<string, EscalationPlaybook>;
  private activeMonitoring: Map<string, NodeJS.Timeout>;
  private preventionStats: {
    predictionsGenerated: number;
    escalationsPrevented: number;
    accuracyScore: number;
    averageRiskScore: number;
  };
  private initialized = false;

  constructor() {
    super();
    this.databaseService = new DatabaseService();
    this.escalationModels = new Map();
    this.playbooks = new Map();
    this.activeMonitoring = new Map();
    this.preventionStats = {
      predictionsGenerated: 0,
      escalationsPrevented: 0,
      accuracyScore: 0,
      averageRiskScore: 0,
    };
  }

  /**
   * Initialize the escalation prevention service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('Initializing Escalation Prevention Service...');

      // Initialize prediction models
      await this.initializePredictionModels();

      // Load escalation playbooks
      await this.loadEscalationPlaybooks();

      // Start background monitoring
      this.startBackgroundMonitoring();

      this.initialized = true;
      console.log('Escalation Prevention Service initialized successfully');
      this.emit('initialized');

    } catch (error) {
      console.error('Failed to initialize Escalation Prevention Service:', error);
      throw new AIProcessingError(
        'Escalation prevention service initialization failed',
        'ESCALATION_INIT_ERROR',
        'pipeline',
        false
      );
    }
  }

  /**
   * Predict escalation risk for a conversation
   */
  async predictEscalationRisk(
    conversationId: string,
    currentMessage?: Message
  ): Promise<EscalationPrediction> {
    if (!this.initialized) {
      throw new AIProcessingError(
        'Escalation prevention service not initialized',
        'SERVICE_NOT_INITIALIZED',
        'pipeline',
        false
      );
    }

    const memory = await conversationContextService.getConversationMemory(conversationId);
    const customerProfile = await conversationContextService.getCustomerProfile(conversationId);

    // Analyze risk factors
    const riskFactors = await this.analyzeRiskFactors(memory, customerProfile, currentMessage);

    // Calculate overall risk score
    const riskScore = this.calculateOverallRiskScore(riskFactors);

    // Generate prediction
    const prediction = await this.generateEscalationPrediction(riskScore, riskFactors, memory);

    // Determine prevention actions
    const preventionActions = await this.generatePreventionActions(
      riskScore,
      riskFactors,
      customerProfile,
      memory
    );

    // Check if manager alert is needed
    const managerAlert = riskScore >= 0.8 || riskFactors.some(f => f.severity >= 0.9);

    const escalationPrediction: EscalationPrediction = {
      conversationId,
      riskScore,
      riskLevel: this.getRiskLevel(riskScore),
      riskFactors,
      prediction,
      preventionActions,
      managerAlert,
    };

    // Update stats
    this.preventionStats.predictionsGenerated++;
    this.preventionStats.averageRiskScore = 
      (this.preventionStats.averageRiskScore * (this.preventionStats.predictionsGenerated - 1) + riskScore) / 
      this.preventionStats.predictionsGenerated;

    // Emit prediction event
    this.emit('escalationPredicted', escalationPrediction);

    // Start monitoring if risk is high
    if (riskScore >= 0.6) {
      this.startConversationMonitoring(conversationId);
    }

    return escalationPrediction;
  }

  /**
   * Execute prevention action
   */
  async executePreventionAction(
    conversationId: string,
    action: PreventionAction,
    agentId?: string
  ): Promise<{success: boolean; result: any}> {
    try {
      let result: any = null;

      switch (action.type) {
        case 'proactive_contact':
          result = await this.executeProactiveContact(conversationId, action);
          break;
        case 'escalate_now':
          result = await this.executeImmediateEscalation(conversationId, action);
          break;
        case 'offer_compensation':
          result = await this.executeCompensationOffer(conversationId, action);
          break;
        case 'change_tone':
          result = await this.executeToneChange(conversationId, action);
          break;
        case 'provide_update':
          result = await this.executeStatusUpdate(conversationId, action);
          break;
        case 'transfer_agent':
          result = await this.executeAgentTransfer(conversationId, action);
          break;
        default:
          throw new Error(`Unknown prevention action type: ${action.type}`);
      }

      // Log successful action
      this.emit('preventionActionExecuted', {
        conversationId,
        action,
        result,
        success: true,
      });

      return { success: true, result };

    } catch (error) {
      console.error(`Failed to execute prevention action ${action.type}:`, error);
      
      this.emit('preventionActionFailed', {
        conversationId,
        action,
        error: error instanceof Error ? error.message : String(error),
      });

      return { success: false, result: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Report escalation outcome for learning
   */
  async reportEscalationOutcome(
    conversationId: string,
    escalated: boolean,
    actualOutcome: 'resolved' | 'escalated' | 'abandoned',
    preventionActionsUsed: string[]
  ): Promise<void> {
    // Update model accuracy
    const wasPreventionSuccessful = !escalated && actualOutcome === 'resolved';
    
    if (wasPreventionSuccessful) {
      this.preventionStats.escalationsPrevented++;
    }

    // Calculate accuracy (simplified)
    const totalPredictions = this.preventionStats.predictionsGenerated;
    const successfulPreventions = this.preventionStats.escalationsPrevented;
    this.preventionStats.accuracyScore = totalPredictions > 0 ? successfulPreventions / totalPredictions : 0;

    // Learn from the outcome to improve future predictions
    await this.updatePredictionModels(conversationId, escalated, actualOutcome, preventionActionsUsed);

    this.emit('escalationOutcomeReported', {
      conversationId,
      escalated,
      actualOutcome,
      preventionActionsUsed,
      stats: this.preventionStats,
    });
  }

  /**
   * Get active escalation risks across all conversations
   */
  async getActiveEscalationRisks(): Promise<{
    high: EscalationPrediction[];
    medium: EscalationPrediction[];
    total: number;
  }> {
    // In production, this would query active conversations
    const activeRisks = {
      high: [] as EscalationPrediction[],
      medium: [] as EscalationPrediction[],
      total: 0,
    };

    // Simulate some active risks for demonstration
    const sampleHighRisk: EscalationPrediction = {
      conversationId: 'conv_123',
      riskScore: 0.85,
      riskLevel: 'high',
      riskFactors: [
        {
          type: 'sentiment_decline',
          severity: 0.9,
          description: 'Customer sentiment declining rapidly',
          weight: 0.3,
          mitigable: true,
        },
        {
          type: 'repeat_issue',
          severity: 0.8,
          description: 'Third occurrence of the same issue',
          weight: 0.25,
          mitigable: false,
        },
      ],
      prediction: {
        timeToEscalation: 15, // 15 minutes
        escalationProbability: 0.85,
        confidence: 0.88,
      },
      preventionActions: [
        {
          type: 'escalate_now',
          priority: 'immediate',
          description: 'Immediately escalate to senior agent',
          estimatedImpact: 0.9,
          requiresApproval: false,
        },
      ],
      managerAlert: true,
    };

    activeRisks.high.push(sampleHighRisk);
    activeRisks.total = 1;

    return activeRisks;
  }

  /**
   * Private Methods
   */

  private async initializePredictionModels(): Promise<void> {
    // Initialize ML models for escalation prediction
    // In production, this would load trained models
    
    const baseModel = {
      version: '1.0.0',
      accuracy: 0.85,
      features: [
        'sentiment_trend',
        'response_time',
        'issue_complexity',
        'customer_tier',
        'agent_performance',
        'time_of_day',
        'interaction_count',
      ],
      weights: {
        sentiment_decline: 0.3,
        repeat_issue: 0.25,
        response_delay: 0.2,
        complexity: 0.15,
        customer_history: 0.1,
      },
    };

    this.escalationModels.set('primary', baseModel);
    console.log('Escalation prediction models initialized');
  }

  private async loadEscalationPlaybooks(): Promise<void> {
    // Load predefined escalation prevention playbooks
    const playbooks: EscalationPlaybook[] = [
      {
        id: 'high_value_customer',
        name: 'High Value Customer Protection',
        triggerConditions: {
          riskScore: 0.6,
          riskFactors: ['sentiment_decline'],
          customerSegments: ['enterprise', 'premium'],
        },
        actions: [
          {
            type: 'proactive_contact',
            priority: 'urgent',
            description: 'Proactive outreach by senior support',
            estimatedImpact: 0.8,
            requiresApproval: false,
          },
          {
            type: 'offer_compensation',
            priority: 'normal',
            description: 'Offer service credit or upgrade',
            estimatedImpact: 0.7,
            costEstimate: 50,
            requiresApproval: true,
          },
        ],
        successRate: 0.78,
        lastUpdated: new Date(),
      },
      {
        id: 'repeat_issue',
        name: 'Repeat Issue Management',
        triggerConditions: {
          riskScore: 0.5,
          riskFactors: ['repeat_issue'],
          customerSegments: [],
        },
        actions: [
          {
            type: 'escalate_now',
            priority: 'urgent',
            description: 'Escalate to technical specialist',
            estimatedImpact: 0.85,
            requiresApproval: false,
          },
          {
            type: 'provide_update',
            priority: 'immediate',
            description: 'Provide detailed status update',
            estimatedImpact: 0.6,
            requiresApproval: false,
          },
        ],
        successRate: 0.82,
        lastUpdated: new Date(),
      },
    ];

    playbooks.forEach(playbook => {
      this.playbooks.set(playbook.id, playbook);
    });

    console.log(`Loaded ${playbooks.length} escalation prevention playbooks`);
  }

  private startBackgroundMonitoring(): void {
    // Start background process to monitor all conversations
    setInterval(() => {
      this.monitorActiveConversations();
    }, 60000); // Check every minute

    console.log('Background escalation monitoring started');
  }

  private async monitorActiveConversations(): Promise<void> {
    // Monitor all active conversations for escalation risk
    // In production, this would query active conversation IDs
    console.log('Monitoring active conversations for escalation risk...');
  }

  private startConversationMonitoring(conversationId: string): void {
    // Clear existing monitoring
    if (this.activeMonitoring.has(conversationId)) {
      clearInterval(this.activeMonitoring.get(conversationId)!);
    }

    // Start intensive monitoring for high-risk conversation
    const monitor = setInterval(async () => {
      try {
        const prediction = await this.predictEscalationRisk(conversationId);
        
        if (prediction.riskScore < 0.5) {
          // Risk has decreased, stop intensive monitoring
          clearInterval(monitor);
          this.activeMonitoring.delete(conversationId);
          return;
        }

        // Check if immediate action is needed
        if (prediction.riskLevel === 'critical' && prediction.managerAlert) {
          this.emit('immediateActionRequired', prediction);
        }

      } catch (error) {
        console.error(`Error monitoring conversation ${conversationId}:`, error);
      }
    }, 30000); // Check every 30 seconds for high-risk conversations

    this.activeMonitoring.set(conversationId, monitor);
  }

  private async analyzeRiskFactors(
    memory: ConversationMemory,
    profile: CustomerProfile,
    currentMessage?: Message
  ): Promise<EscalationRiskFactor[]> {
    const riskFactors: EscalationRiskFactor[] = [];

    // Analyze sentiment decline
    const sentimentFactor = this.analyzeSentimentRisk(memory);
    if (sentimentFactor) riskFactors.push(sentimentFactor);

    // Analyze repeat issues
    const repeatIssueFactor = this.analyzeRepeatIssueRisk(profile, memory);
    if (repeatIssueFactor) riskFactors.push(repeatIssueFactor);

    // Analyze response delays
    const delayFactor = this.analyzeResponseDelayRisk(memory);
    if (delayFactor) riskFactors.push(delayFactor);

    // Analyze issue complexity
    const complexityFactor = this.analyzeComplexityRisk(memory);
    if (complexityFactor) riskFactors.push(complexityFactor);

    // Analyze customer history
    const historyFactor = this.analyzeCustomerHistoryRisk(profile);
    if (historyFactor) riskFactors.push(historyFactor);

    return riskFactors;
  }

  private analyzeSentimentRisk(memory: ConversationMemory): EscalationRiskFactor | null {
    const recentSentiments = memory.timeline
      .slice(-5)
      .map(event => event.sentiment)
      .filter(s => s !== undefined) as number[];

    if (recentSentiments.length < 3) return null;

    // Calculate sentiment trend
    const trend = (recentSentiments[recentSentiments.length - 1] || 0) - (recentSentiments[0] || 0);
    const avgSentiment = recentSentiments.reduce((sum, s) => sum + s, 0) / recentSentiments.length;

    if (trend < -0.3 || avgSentiment < -0.5) {
      return {
        type: 'sentiment_decline',
        severity: Math.min(1, Math.abs(trend) + Math.abs(avgSentiment)),
        description: `Customer sentiment declining (trend: ${trend.toFixed(2)}, avg: ${avgSentiment.toFixed(2)})`,
        weight: 0.3,
        mitigable: true,
      };
    }

    return null;
  }

  private analyzeRepeatIssueRisk(profile: CustomerProfile, memory: ConversationMemory): EscalationRiskFactor | null {
    const currentIssues = memory.context.issues;
    const repeatCount = currentIssues.filter(issue => 
      profile.history.previousIssues.includes(issue)
    ).length;

    if (repeatCount > 0) {
      return {
        type: 'repeat_issue',
        severity: Math.min(1, repeatCount * 0.3),
        description: `Customer experiencing repeat issues (${repeatCount} recurring problems)`,
        weight: 0.25,
        mitigable: false,
      };
    }

    return null;
  }

  private analyzeResponseDelayRisk(memory: ConversationMemory): EscalationRiskFactor | null {
    // Analyze time gaps between customer messages and agent responses
    const timeline = memory.timeline.filter(event => event.event === 'message');
    
    if (timeline.length < 2) return null;

    let totalDelay = 0;
    let delayCount = 0;

    for (let i = 1; i < timeline.length; i++) {
      const timeDiff = (timeline[i]?.timestamp.getTime() || 0) - (timeline[i - 1]?.timestamp.getTime() || 0);
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff > 2) { // Consider delays > 2 hours
        totalDelay += hoursDiff;
        delayCount++;
      }
    }

    if (delayCount > 0) {
      const avgDelay = totalDelay / delayCount;
      return {
        type: 'response_delay',
        severity: Math.min(1, avgDelay / 24), // Normalize to 0-1 over 24 hours
        description: `Response delays detected (average: ${avgDelay.toFixed(1)} hours)`,
        weight: 0.2,
        mitigable: true,
      };
    }

    return null;
  }

  private analyzeComplexityRisk(memory: ConversationMemory): EscalationRiskFactor | null {
    const messageCount = memory.timeline.filter(event => event.event === 'message').length;
    const issueCount = memory.context.issues.length;
    
    // Complex conversations have many messages or multiple issues
    const complexityScore = (messageCount * 0.1) + (issueCount * 0.3);
    
    if (complexityScore > 0.5) {
      return {
        type: 'complexity',
        severity: Math.min(1, complexityScore),
        description: `Complex conversation (${messageCount} messages, ${issueCount} issues)`,
        weight: 0.15,
        mitigable: true,
      };
    }

    return null;
  }

  private analyzeCustomerHistoryRisk(profile: CustomerProfile): EscalationRiskFactor | null {
    if (profile.history.escalationCount > 0 || profile.satisfaction < 0.6) {
      const historySeverity = (profile.history.escalationCount * 0.2) + (1 - profile.satisfaction);
      
      return {
        type: 'customer_history',
        severity: Math.min(1, historySeverity),
        description: `Customer history indicates risk (${profile.history.escalationCount} past escalations, ${Math.round(profile.satisfaction * 100)}% satisfaction)`,
        weight: 0.1,
        mitigable: false,
      };
    }

    return null;
  }

  private calculateOverallRiskScore(riskFactors: EscalationRiskFactor[]): number {
    if (riskFactors.length === 0) return 0;

    const weightedSum = riskFactors.reduce((sum, factor) => {
      return sum + (factor.severity * factor.weight);
    }, 0);

    const totalWeight = riskFactors.reduce((sum, factor) => sum + factor.weight, 0);
    
    return totalWeight > 0 ? Math.min(1, weightedSum / totalWeight) : 0;
  }

  private async generateEscalationPrediction(
    riskScore: number,
    riskFactors: EscalationRiskFactor[],
    memory: ConversationMemory
  ): Promise<EscalationPrediction['prediction']> {
    // Predict time to escalation based on risk factors
    let baseTimeToEscalation = 240; // 4 hours baseline
    
    riskFactors.forEach(factor => {
      if (factor.type === 'sentiment_decline') baseTimeToEscalation *= (1 - factor.severity * 0.5);
      if (factor.type === 'repeat_issue') baseTimeToEscalation *= (1 - factor.severity * 0.3);
      if (factor.type === 'response_delay') baseTimeToEscalation *= (1 + factor.severity * 0.5);
    });

    const timeToEscalation = Math.max(5, baseTimeToEscalation); // Minimum 5 minutes
    const escalationProbability = riskScore;
    const confidence = Math.min(0.95, 0.6 + (riskFactors.length * 0.1));

    return {
      timeToEscalation: Math.round(timeToEscalation),
      escalationProbability,
      confidence,
    };
  }

  private async generatePreventionActions(
    riskScore: number,
    riskFactors: EscalationRiskFactor[],
    profile: CustomerProfile,
    memory: ConversationMemory
  ): Promise<PreventionAction[]> {
    const actions: PreventionAction[] = [];

    // Find applicable playbooks
    const applicablePlaybooks = Array.from(this.playbooks.values()).filter(playbook => {
      return riskScore >= playbook.triggerConditions.riskScore &&
             playbook.triggerConditions.riskFactors.some(factor =>
               riskFactors.some(rf => rf.type.includes(factor))
             );
    });

    // Add playbook actions
    applicablePlaybooks.forEach(playbook => {
      actions.push(...playbook.actions);
    });

    // Add risk-factor specific actions
    riskFactors.forEach(factor => {
      if (factor.mitigable && factor.severity > 0.5) {
        const factorAction = this.generateFactorSpecificAction(factor);
        if (factorAction) actions.push(factorAction);
      }
    });

    // Add emergency actions for critical risk
    if (riskScore >= 0.9) {
      actions.push({
        type: 'escalate_now',
        priority: 'immediate',
        description: 'Critical risk detected - immediate escalation required',
        estimatedImpact: 0.95,
        requiresApproval: false,
      });
    }

    // Sort by priority and impact
    return actions.sort((a, b) => {
      const priorityOrder = { immediate: 3, urgent: 2, normal: 1 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) return bPriority - aPriority;
      return b.estimatedImpact - a.estimatedImpact;
    }).slice(0, 5); // Limit to top 5 actions
  }

  private generateFactorSpecificAction(factor: EscalationRiskFactor): PreventionAction | null {
    switch (factor.type) {
      case 'sentiment_decline':
        return {
          type: 'change_tone',
          priority: 'urgent',
          description: 'Switch to more empathetic communication style',
          estimatedImpact: 0.7,
          requiresApproval: false,
          suggestedResponse: 'I understand your frustration, and I want to make sure we resolve this properly for you.',
        };
      case 'response_delay':
        return {
          type: 'provide_update',
          priority: 'urgent',
          description: 'Provide immediate status update to address delays',
          estimatedImpact: 0.6,
          requiresApproval: false,
          suggestedResponse: 'I apologize for the delay. Let me give you an immediate update on where we stand.',
        };
      default:
        return null;
    }
  }

  private getRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= 0.8) return 'critical';
    if (riskScore >= 0.6) return 'high';
    if (riskScore >= 0.3) return 'medium';
    return 'low';
  }

  // Prevention action execution methods
  private async executeProactiveContact(conversationId: string, action: PreventionAction): Promise<any> {
    // Simulate proactive contact execution
    return {
      type: 'proactive_contact',
      message: 'Proactive support contact initiated',
      timestamp: new Date(),
    };
  }

  private async executeImmediateEscalation(conversationId: string, action: PreventionAction): Promise<any> {
    // Execute immediate escalation
    return {
      type: 'escalation',
      escalatedTo: 'senior_support',
      timestamp: new Date(),
    };
  }

  private async executeCompensationOffer(conversationId: string, action: PreventionAction): Promise<any> {
    // Execute compensation offer
    return {
      type: 'compensation',
      offer: 'service_credit',
      amount: action.costEstimate || 25,
      timestamp: new Date(),
    };
  }

  private async executeToneChange(conversationId: string, action: PreventionAction): Promise<any> {
    // Signal tone change to agent interface
    return {
      type: 'tone_change',
      newTone: 'empathetic',
      suggestedResponse: action.suggestedResponse,
      timestamp: new Date(),
    };
  }

  private async executeStatusUpdate(conversationId: string, action: PreventionAction): Promise<any> {
    // Provide status update
    return {
      type: 'status_update',
      message: action.suggestedResponse || 'Status update provided',
      timestamp: new Date(),
    };
  }

  private async executeAgentTransfer(conversationId: string, action: PreventionAction): Promise<any> {
    // Execute agent transfer
    return {
      type: 'agent_transfer',
      transferredTo: 'specialist_agent',
      timestamp: new Date(),
    };
  }

  private async updatePredictionModels(
    conversationId: string,
    escalated: boolean,
    outcome: string,
    actionsUsed: string[]
  ): Promise<void> {
    // Update ML models based on actual outcomes
    console.log(`Learning from outcome: conversation ${conversationId}, escalated: ${escalated}, outcome: ${outcome}`);
    
    // In production, this would update model weights and retrain
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
      activeMonitoring: this.activeMonitoring.size,
      playbooks: this.playbooks.size,
      ...this.preventionStats,
    };
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down Escalation Prevention Service...');
    
    // Clear all monitoring intervals
    this.activeMonitoring.forEach((timer) => clearInterval(timer));
    this.activeMonitoring.clear();

    this.initialized = false;
    this.emit('shutdown');
  }
}

// Export singleton instance
export const escalationPreventionService = new EscalationPreventionService();