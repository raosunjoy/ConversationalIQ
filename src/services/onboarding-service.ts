/**
 * Customer Onboarding Service
 * Automated onboarding flow for new ConversationIQ customers
 */

import { DatabaseService } from './database';
import { EventProcessor } from '../events/event-processor';
import { MarketplaceAnalyticsService } from './marketplace-analytics-service';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'action' | 'verification' | 'setup' | 'tutorial';
  order: number;
  isRequired: boolean;
  estimatedTime: number; // in minutes
  dependencies: string[]; // step IDs that must be completed first
  content: {
    instructions?: string;
    videoUrl?: string;
    documentationUrl?: string;
    checklistItems?: string[];
    actionRequired?: {
      type: 'api_call' | 'ui_interaction' | 'configuration' | 'integration';
      endpoint?: string;
      parameters?: any;
    };
  };
  completionCriteria: {
    type: 'manual' | 'automatic' | 'api_verification';
    verificationEndpoint?: string;
    expectedResult?: any;
  };
}

export interface OnboardingJourney {
  id: string;
  name: string;
  description: string;
  targetAudience: 'admin' | 'agent' | 'manager' | 'developer';
  steps: OnboardingStep[];
  estimatedDuration: number; // in minutes
  successCriteria: {
    minimumStepsCompleted: number;
    requiredSteps: string[];
    timeToComplete?: number; // in hours
  };
}

export interface OnboardingSession {
  id: string;
  organizationId: string;
  userId: string;
  journeyId: string;
  status: 'not_started' | 'in_progress' | 'paused' | 'completed' | 'abandoned';
  currentStepId?: string;
  startedAt: Date;
  completedAt?: Date;
  lastActivityAt: Date;
  progress: {
    stepsCompleted: string[];
    stepsSkipped: string[];
    currentStepProgress: number; // 0-100
    overallProgress: number; // 0-100
  };
  metadata: {
    userRole: string;
    zendeskPlan: string;
    teamSize: number;
    industry?: string;
    useCase?: string;
    previousExperience?: string;
  };
  analytics: {
    timeSpentByStep: { [stepId: string]: number }; // in seconds
    helpRequestsByStep: { [stepId: string]: number };
    dropoffPoints: string[];
    completionTime?: number; // in seconds
  };
}

export interface OnboardingTrigger {
  id: string;
  name: string;
  description: string;
  triggerType: 'time_based' | 'behavior_based' | 'milestone_based' | 'support_request';
  conditions: {
    timeDelay?: number; // in hours
    behaviorEvents?: string[];
    milestones?: string[];
    supportCategories?: string[];
  };
  targetAudience: string[];
  action: {
    type: 'email' | 'in_app_notification' | 'journey_start' | 'resource_recommendation';
    content: any;
    journeyId?: string;
  };
  isActive: boolean;
}

export interface OnboardingResource {
  id: string;
  title: string;
  type: 'video' | 'article' | 'tutorial' | 'webinar' | 'documentation';
  url: string;
  description: string;
  audience: string[];
  topics: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number; // in minutes
  featured: boolean;
  analytics: {
    views: number;
    completions: number;
    averageRating: number;
    helpfulVotes: number;
  };
}

export class OnboardingService {
  private db: DatabaseService;
  private eventProcessor: EventProcessor;
  private analyticsService: MarketplaceAnalyticsService;
  private journeys: Map<string, OnboardingJourney>;

  constructor() {
    this.db = new DatabaseService();
    this.eventProcessor = new EventProcessor();
    this.analyticsService = new MarketplaceAnalyticsService();
    this.journeys = new Map();
    
    this.initializeJourneys();
    this.setupEventListeners();
    this.startTriggerEngine();
  }

  private setupEventListeners(): void {
    this.eventProcessor.on('organization.created', this.handleNewOrganization.bind(this));
    this.eventProcessor.on('user.invited', this.handleUserInvited.bind(this));
    this.eventProcessor.on('app.installed', this.handleAppInstalled.bind(this));
    this.eventProcessor.on('feature.used', this.handleFeatureUsed.bind(this));
    this.eventProcessor.on('support.ticket.created', this.handleSupportTicket.bind(this));
    this.eventProcessor.on('onboarding.step.completed', this.handleStepCompleted.bind(this));
  }

  private initializeJourneys(): void {
    const journeys: OnboardingJourney[] = [
      {
        id: 'admin_setup',
        name: 'Administrator Setup',
        description: 'Complete setup guide for ConversationIQ administrators',
        targetAudience: 'admin',
        estimatedDuration: 45,
        successCriteria: {
          minimumStepsCompleted: 6,
          requiredSteps: ['zendesk_integration', 'team_setup', 'first_conversation']
        },
        steps: [
          {
            id: 'welcome',
            title: 'Welcome to ConversationIQ',
            description: 'Get introduced to the platform and its capabilities',
            type: 'info',
            order: 1,
            isRequired: true,
            estimatedTime: 5,
            dependencies: [],
            content: {
              instructions: 'Welcome to ConversationIQ! This onboarding will help you set up your account and get the most value from our AI-powered conversation intelligence platform.',
              videoUrl: 'https://assets.conversationiq.com/videos/welcome-intro.mp4',
              checklistItems: [
                'Understand ConversationIQ\'s core capabilities',
                'Learn about sentiment analysis and response suggestions',
                'Review the dashboard overview'
              ]
            },
            completionCriteria: {
              type: 'manual'
            }
          },
          {
            id: 'zendesk_integration',
            title: 'Connect Zendesk Integration',
            description: 'Establish secure connection between ConversationIQ and your Zendesk instance',
            type: 'setup',
            order: 2,
            isRequired: true,
            estimatedTime: 10,
            dependencies: ['welcome'],
            content: {
              instructions: 'Connect your Zendesk account to enable real-time conversation analysis and response suggestions.',
              documentationUrl: 'https://docs.conversationiq.com/integrations/zendesk',
              actionRequired: {
                type: 'integration',
                endpoint: '/api/integrations/zendesk/connect',
                parameters: {
                  subdomain: 'user_input',
                  permissions: ['read:tickets', 'read:users', 'write:ticket_comments']
                }
              }
            },
            completionCriteria: {
              type: 'api_verification',
              verificationEndpoint: '/api/integrations/zendesk/status',
              expectedResult: { connected: true, permissions_valid: true }
            }
          },
          {
            id: 'team_setup',
            title: 'Set Up Your Team',
            description: 'Invite team members and configure roles',
            type: 'setup',
            order: 3,
            isRequired: true,
            estimatedTime: 15,
            dependencies: ['zendesk_integration'],
            content: {
              instructions: 'Add your team members to ConversationIQ and assign appropriate roles.',
              checklistItems: [
                'Invite agents who will use ConversationIQ',
                'Assign manager roles to team leads',
                'Configure notification preferences',
                'Set up agent groups if needed'
              ]
            },
            completionCriteria: {
              type: 'api_verification',
              verificationEndpoint: '/api/organizations/team/status',
              expectedResult: { invited_users: { min: 1 }, active_users: { min: 1 } }
            }
          },
          {
            id: 'sentiment_setup',
            title: 'Configure Sentiment Analysis',
            description: 'Customize sentiment analysis settings for your use case',
            type: 'setup',
            order: 4,
            isRequired: false,
            estimatedTime: 8,
            dependencies: ['team_setup'],
            content: {
              instructions: 'Fine-tune sentiment analysis to match your customer communication style and industry.',
              checklistItems: [
                'Review default sentiment categories',
                'Set custom sentiment thresholds',
                'Configure escalation triggers',
                'Test sentiment analysis with sample conversations'
              ]
            },
            completionCriteria: {
              type: 'manual'
            }
          },
          {
            id: 'response_templates',
            title: 'Create Response Templates',
            description: 'Set up AI response suggestions with your brand voice',
            type: 'setup',
            order: 5,
            isRequired: false,
            estimatedTime: 12,
            dependencies: ['sentiment_setup'],
            content: {
              instructions: 'Create custom response templates that match your brand voice and common customer scenarios.',
              checklistItems: [
                'Review default response templates',
                'Create templates for common scenarios',
                'Set brand voice guidelines',
                'Test response suggestions'
              ]
            },
            completionCriteria: {
              type: 'api_verification',
              verificationEndpoint: '/api/templates/status',
              expectedResult: { custom_templates: { min: 3 } }
            }
          },
          {
            id: 'first_conversation',
            title: 'Process Your First Conversation',
            description: 'See ConversationIQ in action with a real conversation',
            type: 'verification',
            order: 6,
            isRequired: true,
            estimatedTime: 5,
            dependencies: ['response_templates'],
            content: {
              instructions: 'Open a ticket in Zendesk and see how ConversationIQ provides real-time insights and suggestions.',
              videoUrl: 'https://assets.conversationiq.com/videos/first-conversation.mp4'
            },
            completionCriteria: {
              type: 'api_verification',
              verificationEndpoint: '/api/conversations/processed/count',
              expectedResult: { count: { min: 1 } }
            }
          },
          {
            id: 'dashboard_tutorial',
            title: 'Explore Analytics Dashboard',
            description: 'Learn to use the analytics and reporting features',
            type: 'tutorial',
            order: 7,
            isRequired: false,
            estimatedTime: 10,
            dependencies: ['first_conversation'],
            content: {
              instructions: 'Explore the analytics dashboard to understand your team\'s performance metrics.',
              checklistItems: [
                'View team performance overview',
                'Understand sentiment trends',
                'Review escalation patterns',
                'Set up custom reports'
              ]
            },
            completionCriteria: {
              type: 'manual'
            }
          },
          {
            id: 'success_celebration',
            title: 'Setup Complete!',
            description: 'Congratulations on completing your ConversationIQ setup',
            type: 'info',
            order: 8,
            isRequired: false,
            estimatedTime: 2,
            dependencies: ['dashboard_tutorial'],
            content: {
              instructions: 'Your ConversationIQ setup is complete! Your team can now benefit from AI-powered conversation insights.',
              checklistItems: [
                'Share setup completion with your team',
                'Schedule regular analytics reviews',
                'Explore advanced features when ready',
                'Contact support if you need assistance'
              ]
            },
            completionCriteria: {
              type: 'manual'
            }
          }
        ]
      },
      {
        id: 'agent_quickstart',
        name: 'Agent Quick Start',
        description: 'Essential onboarding for customer service agents',
        targetAudience: 'agent',
        estimatedDuration: 20,
        successCriteria: {
          minimumStepsCompleted: 4,
          requiredSteps: ['interface_tour', 'sentiment_understanding', 'response_suggestions']
        },
        steps: [
          {
            id: 'interface_tour',
            title: 'ConversationIQ Interface Tour',
            description: 'Learn where to find AI insights in your Zendesk interface',
            type: 'tutorial',
            order: 1,
            isRequired: true,
            estimatedTime: 5,
            dependencies: [],
            content: {
              instructions: 'Discover how ConversationIQ integrates seamlessly into your existing Zendesk workflow.',
              videoUrl: 'https://assets.conversationiq.com/videos/agent-interface-tour.mp4'
            },
            completionCriteria: {
              type: 'manual'
            }
          },
          {
            id: 'sentiment_understanding',
            title: 'Understanding Sentiment Indicators',
            description: 'Learn to read and act on sentiment analysis',
            type: 'tutorial',
            order: 2,
            isRequired: true,
            estimatedTime: 7,
            dependencies: ['interface_tour'],
            content: {
              instructions: 'Understand how sentiment analysis helps you provide better customer service.',
              checklistItems: [
                'Recognize different sentiment indicators',
                'Understand confidence scores',
                'Learn when to escalate based on sentiment',
                'See sentiment changes during conversations'
              ]
            },
            completionCriteria: {
              type: 'manual'
            }
          },
          {
            id: 'response_suggestions',
            title: 'Using AI Response Suggestions',
            description: 'Make the most of AI-powered response recommendations',
            type: 'tutorial',
            order: 3,
            isRequired: true,
            estimatedTime: 8,
            dependencies: ['sentiment_understanding'],
            content: {
              instructions: 'Learn how to use and customize AI response suggestions to improve your efficiency.',
              checklistItems: [
                'Review suggested responses',
                'Customize suggestions to your voice',
                'Provide feedback to improve AI accuracy',
                'Use shortcuts for common responses'
              ]
            },
            completionCriteria: {
              type: 'api_verification',
              verificationEndpoint: '/api/users/suggestions/usage',
              expectedResult: { suggestions_used: { min: 3 } }
            }
          },
          {
            id: 'escalation_prevention',
            title: 'Preventing Escalations',
            description: 'Recognize and prevent customer escalations proactively',
            type: 'tutorial',
            order: 4,
            isRequired: false,
            estimatedTime: 10,
            dependencies: ['response_suggestions'],
            content: {
              instructions: 'Learn to identify escalation risks and take proactive steps to resolve issues.',
              checklistItems: [
                'Recognize escalation warning signs',
                'Use de-escalation techniques',
                'When to involve a manager',
                'Document escalation prevention actions'
              ]
            },
            completionCriteria: {
              type: 'manual'
            }
          }
        ]
      }
    ];

    journeys.forEach(journey => this.journeys.set(journey.id, journey));
  }

  // Session Management
  async startOnboardingJourney(
    organizationId: string,
    userId: string,
    journeyId: string,
    metadata: Partial<OnboardingSession['metadata']>
  ): Promise<string> {
    const journey = this.journeys.get(journeyId);
    if (!journey) {
      throw new Error('Invalid journey ID');
    }

    // Check if user already has an active session for this journey
    const existingSession = await this.db.findByFields('onboarding_sessions', {
      organizationId,
      userId,
      journeyId,
      status: 'in_progress'
    });

    if (existingSession) {
      return existingSession.id;
    }

    const session: OnboardingSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      organizationId,
      userId,
      journeyId,
      status: 'in_progress',
      currentStepId: journey.steps[0]?.id,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      progress: {
        stepsCompleted: [],
        stepsSkipped: [],
        currentStepProgress: 0,
        overallProgress: 0
      },
      metadata: {
        userRole: 'agent',
        zendeskPlan: 'professional',
        teamSize: 10,
        ...metadata
      },
      analytics: {
        timeSpentByStep: {},
        helpRequestsByStep: {},
        dropoffPoints: []
      }
    };

    const sessionId = await this.db.createRecord('onboarding_sessions', session);

    await this.eventProcessor.publish('onboarding.journey.started', {
      sessionId,
      organizationId,
      userId,
      journeyId
    });

    // Track in marketplace analytics
    await this.analyticsService.trackEvent({
      organizationId,
      userId,
      eventType: 'onboarding_started',
      eventCategory: 'activation',
      properties: {
        journeyId,
        userRole: session.metadata.userRole
      }
    });

    return sessionId;
  }

  async getOnboardingSession(sessionId: string): Promise<OnboardingSession | null> {
    return await this.db.findByField('onboarding_sessions', 'id', sessionId);
  }

  async getUserCurrentSession(organizationId: string, userId: string): Promise<OnboardingSession | null> {
    const sessions = await this.db.findByFields('onboarding_sessions', {
      organizationId,
      userId,
      status: 'in_progress'
    });

    return sessions.length > 0 ? sessions[0] : null;
  }

  async updateSessionProgress(sessionId: string, updates: Partial<OnboardingSession>): Promise<void> {
    await this.db.updateRecord('onboarding_sessions', sessionId, {
      ...updates,
      lastActivityAt: new Date()
    });
  }

  // Step Management
  async completeStep(
    sessionId: string,
    stepId: string,
    timeSpent?: number,
    feedback?: any
  ): Promise<{ nextStepId?: string; journeyCompleted: boolean }> {
    const session = await this.getOnboardingSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const journey = this.journeys.get(session.journeyId);
    if (!journey) {
      throw new Error('Journey not found');
    }

    const step = journey.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error('Step not found');
    }

    // Update session progress
    const updatedStepsCompleted = [...session.progress.stepsCompleted];
    if (!updatedStepsCompleted.includes(stepId)) {
      updatedStepsCompleted.push(stepId);
    }

    const updatedAnalytics = { ...session.analytics };
    if (timeSpent) {
      updatedAnalytics.timeSpentByStep[stepId] = (updatedAnalytics.timeSpentByStep[stepId] || 0) + timeSpent;
    }

    // Calculate overall progress
    const overallProgress = (updatedStepsCompleted.length / journey.steps.length) * 100;

    // Find next step
    const currentStepIndex = journey.steps.findIndex(s => s.id === stepId);
    let nextStepId: string | undefined;
    
    for (let i = currentStepIndex + 1; i < journey.steps.length; i++) {
      const nextStep = journey.steps[i];
      const dependenciesMet = nextStep.dependencies.every(depId => 
        updatedStepsCompleted.includes(depId)
      );
      
      if (dependenciesMet) {
        nextStepId = nextStep.id;
        break;
      }
    }

    // Check if journey is completed
    const journeyCompleted = this.isJourneyCompleted(journey, updatedStepsCompleted);
    const sessionStatus = journeyCompleted ? 'completed' : 'in_progress';

    await this.updateSessionProgress(sessionId, {
      currentStepId: nextStepId,
      status: sessionStatus,
      completedAt: journeyCompleted ? new Date() : undefined,
      progress: {
        ...session.progress,
        stepsCompleted: updatedStepsCompleted,
        overallProgress
      },
      analytics: updatedAnalytics
    });

    // Publish events
    await this.eventProcessor.publish('onboarding.step.completed', {
      sessionId,
      stepId,
      organizationId: session.organizationId,
      userId: session.userId,
      timeSpent,
      feedback
    });

    if (journeyCompleted) {
      await this.eventProcessor.publish('onboarding.journey.completed', {
        sessionId,
        organizationId: session.organizationId,
        userId: session.userId,
        journeyId: session.journeyId,
        totalTime: updatedAnalytics.completionTime
      });

      // Track successful onboarding completion
      await this.analyticsService.trackEvent({
        organizationId: session.organizationId,
        userId: session.userId,
        eventType: 'onboarding_completed',
        eventCategory: 'activation',
        properties: {
          journeyId: session.journeyId,
          completionTime: updatedAnalytics.completionTime,
          stepsCompleted: updatedStepsCompleted.length,
          totalSteps: journey.steps.length
        }
      });
    }

    return { nextStepId, journeyCompleted };
  }

  async skipStep(sessionId: string, stepId: string, reason?: string): Promise<void> {
    const session = await this.getOnboardingSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const updatedStepsSkipped = [...session.progress.stepsSkipped];
    if (!updatedStepsSkipped.includes(stepId)) {
      updatedStepsSkipped.push(stepId);
    }

    await this.updateSessionProgress(sessionId, {
      progress: {
        ...session.progress,
        stepsSkipped: updatedStepsSkipped
      }
    });

    await this.eventProcessor.publish('onboarding.step.skipped', {
      sessionId,
      stepId,
      reason
    });
  }

  async requestHelp(sessionId: string, stepId: string, message: string): Promise<void> {
    const session = await this.getOnboardingSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const updatedAnalytics = { ...session.analytics };
    updatedAnalytics.helpRequestsByStep[stepId] = (updatedAnalytics.helpRequestsByStep[stepId] || 0) + 1;

    await this.updateSessionProgress(sessionId, {
      analytics: updatedAnalytics
    });

    await this.eventProcessor.publish('onboarding.help.requested', {
      sessionId,
      stepId,
      message,
      organizationId: session.organizationId,
      userId: session.userId
    });
  }

  // Journey Management
  getJourney(journeyId: string): OnboardingJourney | undefined {
    return this.journeys.get(journeyId);
  }

  getAvailableJourneys(userRole?: string): OnboardingJourney[] {
    const journeys = Array.from(this.journeys.values());
    
    if (userRole) {
      return journeys.filter(journey => 
        journey.targetAudience === userRole || journey.targetAudience === 'admin'
      );
    }
    
    return journeys;
  }

  private isJourneyCompleted(journey: OnboardingJourney, completedSteps: string[]): boolean {
    // Check if minimum steps completed
    if (completedSteps.length < journey.successCriteria.minimumStepsCompleted) {
      return false;
    }

    // Check if all required steps completed
    const requiredStepsCompleted = journey.successCriteria.requiredSteps.every(stepId =>
      completedSteps.includes(stepId)
    );

    return requiredStepsCompleted;
  }

  // Analytics and Reporting
  async getOnboardingAnalytics(organizationId?: string): Promise<any> {
    const query = organizationId 
      ? { organizationId }
      : {};

    const sessions = await this.db.findByFields('onboarding_sessions', query);
    
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    const abandonedSessions = sessions.filter(s => s.status === 'abandoned').length;
    const inProgressSessions = sessions.filter(s => s.status === 'in_progress').length;

    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;
    const abandonmentRate = totalSessions > 0 ? (abandonedSessions / totalSessions) * 100 : 0;

    // Calculate average completion time
    const completedSessionsWithTime = sessions.filter(s => 
      s.status === 'completed' && s.completedAt && s.startedAt
    );
    
    const avgCompletionTime = completedSessionsWithTime.length > 0
      ? completedSessionsWithTime.reduce((sum, session) => {
          const duration = session.completedAt!.getTime() - session.startedAt.getTime();
          return sum + (duration / (1000 * 60 * 60)); // Convert to hours
        }, 0) / completedSessionsWithTime.length
      : 0;

    // Analyze step completion rates
    const stepAnalytics = this.analyzeStepPerformance(sessions);

    // Journey performance
    const journeyPerformance = this.analyzeJourneyPerformance(sessions);

    return {
      overall: {
        totalSessions,
        completedSessions,
        inProgressSessions,
        abandonedSessions,
        completionRate,
        abandonmentRate,
        avgCompletionTime
      },
      steps: stepAnalytics,
      journeys: journeyPerformance,
      trends: await this.calculateOnboardingTrends(sessions)
    };
  }

  private analyzeStepPerformance(sessions: OnboardingSession[]): any {
    const stepStats: { [stepId: string]: any } = {};

    sessions.forEach(session => {
      const journey = this.journeys.get(session.journeyId);
      if (!journey) return;

      journey.steps.forEach(step => {
        if (!stepStats[step.id]) {
          stepStats[step.id] = {
            stepId: step.id,
            title: step.title,
            type: step.type,
            isRequired: step.isRequired,
            attempted: 0,
            completed: 0,
            skipped: 0,
            helpRequests: 0,
            avgTimeSpent: 0,
            dropoffRate: 0
          };
        }

        const stats = stepStats[step.id];
        
        // Check if step was attempted (user reached this step)
        const stepIndex = journey.steps.findIndex(s => s.id === step.id);
        const reachedStep = session.progress.stepsCompleted.length > stepIndex ||
                           session.progress.stepsSkipped.includes(step.id) ||
                           session.currentStepId === step.id;
        
        if (reachedStep) {
          stats.attempted++;
        }

        if (session.progress.stepsCompleted.includes(step.id)) {
          stats.completed++;
        }

        if (session.progress.stepsSkipped.includes(step.id)) {
          stats.skipped++;
        }

        stats.helpRequests += session.analytics.helpRequestsByStep[step.id] || 0;
        
        const timeSpent = session.analytics.timeSpentByStep[step.id] || 0;
        if (timeSpent > 0) {
          stats.avgTimeSpent = (stats.avgTimeSpent + timeSpent) / 2;
        }
      });
    });

    // Calculate completion rates and dropoff rates
    Object.values(stepStats).forEach((stats: any) => {
      if (stats.attempted > 0) {
        stats.completionRate = (stats.completed / stats.attempted) * 100;
        stats.dropoffRate = ((stats.attempted - stats.completed - stats.skipped) / stats.attempted) * 100;
      }
    });

    return Object.values(stepStats);
  }

  private analyzeJourneyPerformance(sessions: OnboardingSession[]): any {
    const journeyStats: { [journeyId: string]: any } = {};

    sessions.forEach(session => {
      const journey = this.journeys.get(session.journeyId);
      if (!journey) return;

      if (!journeyStats[session.journeyId]) {
        journeyStats[session.journeyId] = {
          journeyId: session.journeyId,
          name: journey.name,
          targetAudience: journey.targetAudience,
          started: 0,
          completed: 0,
          abandoned: 0,
          avgCompletionTime: 0,
          avgStepsCompleted: 0,
          completionTimes: []
        };
      }

      const stats = journeyStats[session.journeyId];
      stats.started++;

      if (session.status === 'completed') {
        stats.completed++;
        if (session.completedAt && session.startedAt) {
          const completionTime = session.completedAt.getTime() - session.startedAt.getTime();
          stats.completionTimes.push(completionTime / (1000 * 60 * 60)); // hours
        }
      } else if (session.status === 'abandoned') {
        stats.abandoned++;
      }

      stats.avgStepsCompleted += session.progress.stepsCompleted.length;
    });

    // Calculate averages
    Object.values(journeyStats).forEach((stats: any) => {
      if (stats.started > 0) {
        stats.completionRate = (stats.completed / stats.started) * 100;
        stats.abandonmentRate = (stats.abandoned / stats.started) * 100;
        stats.avgStepsCompleted = stats.avgStepsCompleted / stats.started;
      }

      if (stats.completionTimes.length > 0) {
        stats.avgCompletionTime = stats.completionTimes.reduce((sum: number, time: number) => sum + time, 0) / stats.completionTimes.length;
      }

      delete stats.completionTimes; // Remove temporary array
    });

    return Object.values(journeyStats);
  }

  private async calculateOnboardingTrends(sessions: OnboardingSession[]): Promise<any> {
    // Group sessions by month
    const monthlyData: { [month: string]: any } = {};

    sessions.forEach(session => {
      const month = session.startedAt.toISOString().slice(0, 7); // YYYY-MM
      
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          started: 0,
          completed: 0,
          abandoned: 0
        };
      }

      monthlyData[month].started++;
      if (session.status === 'completed') monthlyData[month].completed++;
      if (session.status === 'abandoned') monthlyData[month].abandoned++;
    });

    // Calculate completion rates for each month
    Object.values(monthlyData).forEach((data: any) => {
      data.completionRate = data.started > 0 ? (data.completed / data.started) * 100 : 0;
    });

    return Object.values(monthlyData).sort((a: any, b: any) => a.month.localeCompare(b.month));
  }

  // Trigger Engine
  private async startTriggerEngine(): Promise<void> {
    // Run trigger checks every hour
    setInterval(async () => {
      await this.processTriggers();
    }, 60 * 60 * 1000);

    // Initial run
    await this.processTriggers();
  }

  private async processTriggers(): Promise<void> {
    const triggers = await this.db.findByField('onboarding_triggers', 'isActive', true);
    
    for (const trigger of triggers) {
      try {
        await this.evaluateTrigger(trigger);
      } catch (error) {
        console.error('Error processing trigger:', trigger.id, error);
      }
    }
  }

  private async evaluateTrigger(trigger: OnboardingTrigger): Promise<void> {
    switch (trigger.triggerType) {
      case 'time_based':
        await this.evaluateTimeBased(trigger);
        break;
      case 'behavior_based':
        await this.evaluateBehaviorBased(trigger);
        break;
      case 'milestone_based':
        await this.evaluateMilestoneBased(trigger);
        break;
      case 'support_request':
        await this.evaluateSupportBased(trigger);
        break;
    }
  }

  private async evaluateTimeBased(trigger: OnboardingTrigger): Promise<void> {
    if (!trigger.conditions.timeDelay) return;

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - trigger.conditions.timeDelay);

    // Find users who installed the app within the time window
    const recentInstalls = await this.db.findByDateRange(
      'marketplace_events',
      'timestamp',
      cutoffTime,
      new Date()
    );

    const installEvents = recentInstalls.filter(e => e.eventType === 'app_installed');

    for (const event of installEvents) {
      await this.executeTriggerAction(trigger, event.organizationId, event.userId || 'system');
    }
  }

  private async evaluateBehaviorBased(trigger: OnboardingTrigger): Promise<void> {
    // Implementation for behavior-based triggers
    // This would analyze user behavior patterns and trigger actions accordingly
  }

  private async evaluateMilestoneBased(trigger: OnboardingTrigger): Promise<void> {
    // Implementation for milestone-based triggers
    // This would check for achievement of specific milestones
  }

  private async evaluateSupportBased(trigger: OnboardingTrigger): Promise<void> {
    // Implementation for support-based triggers
    // This would trigger onboarding based on support ticket patterns
  }

  private async executeTriggerAction(
    trigger: OnboardingTrigger,
    organizationId: string,
    userId: string
  ): Promise<void> {
    switch (trigger.action.type) {
      case 'journey_start':
        if (trigger.action.journeyId) {
          await this.startOnboardingJourney(
            organizationId,
            userId,
            trigger.action.journeyId,
            {}
          );
        }
        break;
      case 'email':
        await this.eventProcessor.publish('notification.email.send', {
          organizationId,
          userId,
          template: trigger.action.content.template,
          data: trigger.action.content.data
        });
        break;
      case 'in_app_notification':
        await this.eventProcessor.publish('notification.in_app.send', {
          organizationId,
          userId,
          message: trigger.action.content.message,
          type: trigger.action.content.type || 'info'
        });
        break;
    }
  }

  // Event Handlers
  private async handleNewOrganization(event: any): Promise<void> {
    const { organizationId, primaryUserId } = event.data;
    
    // Start admin onboarding journey
    await this.startOnboardingJourney(
      organizationId,
      primaryUserId,
      'admin_setup',
      {
        userRole: 'admin',
        zendeskPlan: event.data.zendeskPlan || 'professional',
        teamSize: 1
      }
    );
  }

  private async handleUserInvited(event: any): Promise<void> {
    const { organizationId, userId, role } = event.data;
    
    if (role === 'agent') {
      // Start agent onboarding after a delay
      setTimeout(async () => {
        await this.startOnboardingJourney(
          organizationId,
          userId,
          'agent_quickstart',
          { userRole: 'agent' }
        );
      }, 2 * 60 * 60 * 1000); // 2 hours delay
    }
  }

  private async handleAppInstalled(event: any): Promise<void> {
    // This is handled by the time-based trigger engine
  }

  private async handleFeatureUsed(event: any): Promise<void> {
    // Update any behavior-based triggers
    const { organizationId, userId, feature } = event.data;
    
    // Check if this completes any onboarding step verification
    const sessions = await this.db.findByFields('onboarding_sessions', {
      organizationId,
      status: 'in_progress'
    });

    for (const session of sessions) {
      const journey = this.journeys.get(session.journeyId);
      if (!journey || !session.currentStepId) continue;

      const currentStep = journey.steps.find(s => s.id === session.currentStepId);
      if (!currentStep) continue;

      // Check if this feature usage completes the current step
      if (currentStep.completionCriteria.type === 'api_verification') {
        // Trigger step verification
        await this.verifyStepCompletion(session.id, session.currentStepId);
      }
    }
  }

  private async handleSupportTicket(event: any): Promise<void> {
    const { organizationId, ticketType } = event.data;
    
    // Trigger support-based onboarding assistance
    await this.eventProcessor.publish('onboarding.support.assistance', {
      organizationId,
      ticketType,
      suggestedResources: await this.getRelevantResources(ticketType)
    });
  }

  private async handleStepCompleted(event: any): Promise<void> {
    // This is handled internally by the completeStep method
  }

  // Utility Methods
  private async verifyStepCompletion(sessionId: string, stepId: string): Promise<boolean> {
    const session = await this.getOnboardingSession(sessionId);
    if (!session) return false;

    const journey = this.journeys.get(session.journeyId);
    if (!journey) return false;

    const step = journey.steps.find(s => s.id === stepId);
    if (!step || step.completionCriteria.type !== 'api_verification') return false;

    // Perform API verification
    try {
      // This would make an actual API call to verify completion
      // For now, we'll simulate it
      const verificationResult = { verified: true };
      
      if (verificationResult.verified) {
        await this.completeStep(sessionId, stepId);
        return true;
      }
    } catch (error) {
      console.error('Step verification failed:', error);
    }

    return false;
  }

  private async getRelevantResources(ticketType: string): Promise<OnboardingResource[]> {
    const resources = await this.db.findByField('onboarding_resources', 'topics', ticketType);
    return resources
      .sort((a, b) => b.analytics.helpfulVotes - a.analytics.helpfulVotes)
      .slice(0, 3);
  }
}

export default OnboardingService;