/**
 * Beta Program Management Service
 * Handles beta user recruitment, onboarding, and program management
 */

import { EventEmitter } from 'events';
import { DatabaseService } from './database';
import { featureFlagService, BetaUser } from './feature-flag-service';
import { monitoringService } from '../monitoring/monitoring-service';

export interface BetaInvitation {
  id: string;
  email: string;
  zendeskAccountId?: string;
  invitedBy: string;
  invitationToken: string;
  status: 'pending' | 'accepted' | 'expired';
  invitedAt: Date;
  acceptedAt?: Date;
  expiresAt: Date;
  metadata: Record<string, any>;
}

export interface BetaFeedback {
  id: string;
  userId: string;
  type:
    | 'feature_request'
    | 'bug_report'
    | 'general_feedback'
    | 'satisfaction_score';
  content: string;
  rating?: number; // 1-5 scale
  featureContext?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_review' | 'planned' | 'completed' | 'declined';
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export interface BetaMetrics {
  totalUsers: number;
  activeUsers: number;
  churnedUsers: number;
  averageSessionTime: number;
  feedbackCount: number;
  averageSatisfactionScore: number;
  featureAdoptionRates: Record<string, number>;
  conversionRate: number; // beta to paid
}

export interface BetaOnboarding {
  userId: string;
  currentStep: number;
  totalSteps: number;
  completedSteps: string[];
  startedAt: Date;
  completedAt?: Date;
  abandonedAt?: Date;
  metadata: Record<string, any>;
}

export class BetaProgramService extends EventEmitter {
  private database: DatabaseService;
  private invitationTokens: Map<string, BetaInvitation>;

  constructor() {
    super();
    this.database = new DatabaseService();
    this.invitationTokens = new Map();
  }

  /**
   * Initialize beta program service
   */
  async initialize(): Promise<void> {
    try {
      await this.loadPendingInvitations();
      console.log('✅ Beta Program Service initialized');
    } catch (error) {
      console.error('❌ Beta Program Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Invite a user to the beta program
   */
  async inviteUser(
    email: string,
    invitedBy: string,
    metadata: Record<string, any> = {}
  ): Promise<BetaInvitation> {
    try {
      // Check if user is already invited or active
      const existingUser = await this.database.findRecord('beta_users', {
        email,
      });
      if (existingUser) {
        throw new Error('User is already in the beta program');
      }

      const existingInvitation = await this.database.findRecord(
        'beta_invitations',
        { email, status: 'pending' }
      );
      if (existingInvitation) {
        throw new Error('User already has a pending invitation');
      }

      // Create invitation
      const invitation: BetaInvitation = {
        id: `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email,
        invitedBy,
        invitationToken: this.generateInvitationToken(),
        status: 'pending',
        invitedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        metadata,
      };

      // Store in database
      await this.database.createRecord('beta_invitations', invitation);
      this.invitationTokens.set(invitation.invitationToken, invitation);

      // Send invitation email (would integrate with email service)
      await this.sendInvitationEmail(invitation);

      // Record metrics
      monitoringService.recordBusinessMetric(
        'beta_invitations_sent',
        1,
        undefined,
        '24h'
      );

      this.emit('invitationSent', invitation);
      return invitation;
    } catch (error) {
      console.error('Failed to invite user to beta program:', error);
      throw error;
    }
  }

  /**
   * Accept a beta invitation
   */
  async acceptInvitation(
    token: string,
    userInfo: Partial<BetaUser>
  ): Promise<BetaUser> {
    try {
      const invitation =
        this.invitationTokens.get(token) ||
        (await this.database.findRecord('beta_invitations', {
          invitationToken: token,
        }));

      if (!invitation || invitation.status !== 'pending') {
        throw new Error('Invalid or expired invitation token');
      }

      if (new Date() > invitation.expiresAt) {
        await this.expireInvitation(invitation.id);
        throw new Error('Invitation has expired');
      }

      // Create beta user
      const betaUser: BetaUser = {
        id: `beta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: invitation.email,
        zendeskAccountId: userInfo.zendeskAccountId || '',
        accountType: 'beta',
        betaFeatures: ['core_features'], // Start with core features
        onboardingStatus: 'active',
        joinedAt: new Date(),
        lastActiveAt: new Date(),
      };

      // Add to beta program
      await featureFlagService.addBetaUser(betaUser);

      // Update invitation status
      await this.database.updateRecord('beta_invitations', invitation.id, {
        status: 'accepted',
        acceptedAt: new Date(),
      });

      // Start onboarding process
      await this.startOnboarding(betaUser.id);

      // Record metrics
      monitoringService.recordBusinessMetric(
        'beta_invitations_accepted',
        1,
        undefined,
        '24h'
      );

      this.emit('invitationAccepted', { invitation, betaUser });
      return betaUser;
    } catch (error) {
      console.error('Failed to accept beta invitation:', error);
      throw error;
    }
  }

  /**
   * Start onboarding process for a beta user
   */
  async startOnboarding(userId: string): Promise<BetaOnboarding> {
    try {
      const onboardingSteps = [
        'welcome_tour',
        'feature_overview',
        'first_conversation_analysis',
        'feedback_system_intro',
        'feature_flag_explanation',
        'support_resources',
      ];

      const onboarding: BetaOnboarding = {
        userId,
        currentStep: 0,
        totalSteps: onboardingSteps.length,
        completedSteps: [],
        startedAt: new Date(),
        metadata: {
          steps: onboardingSteps,
        },
      };

      await this.database.createRecord('beta_onboarding', onboarding);

      // Record metrics
      monitoringService.recordBusinessMetric(
        'beta_onboarding_started',
        1,
        undefined,
        '24h'
      );

      this.emit('onboardingStarted', onboarding);
      return onboarding;
    } catch (error) {
      console.error('Failed to start onboarding:', error);
      throw error;
    }
  }

  /**
   * Complete an onboarding step
   */
  async completeOnboardingStep(
    userId: string,
    stepName: string
  ): Promise<BetaOnboarding> {
    try {
      const onboarding = await this.database.findRecord('beta_onboarding', {
        userId,
      });
      if (!onboarding) {
        throw new Error('Onboarding not found for user');
      }

      if (!onboarding.completedSteps.includes(stepName)) {
        onboarding.completedSteps.push(stepName);
        onboarding.currentStep = onboarding.completedSteps.length;

        // Check if onboarding is complete
        if (onboarding.currentStep >= onboarding.totalSteps) {
          onboarding.completedAt = new Date();

          // Record completion metrics
          monitoringService.recordBusinessMetric(
            'beta_onboarding_completed',
            1,
            undefined,
            '24h'
          );
        }

        await this.database.updateRecord(
          'beta_onboarding',
          onboarding.id,
          onboarding
        );
        this.emit('onboardingStepCompleted', { userId, stepName, onboarding });
      }

      return onboarding as BetaOnboarding;
    } catch (error) {
      console.error('Failed to complete onboarding step:', error);
      throw error;
    }
  }

  /**
   * Submit beta feedback
   */
  async submitFeedback(
    feedback: Omit<BetaFeedback, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<BetaFeedback> {
    try {
      const betaFeedback: BetaFeedback = {
        ...feedback,
        id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.database.createRecord('beta_feedback', betaFeedback);

      // Record metrics
      monitoringService.recordBusinessMetric(
        'beta_feedback_submitted',
        1,
        undefined,
        '24h'
      );

      // Auto-escalate critical feedback
      if (feedback.urgency === 'critical') {
        await this.escalateFeedback(betaFeedback);
      }

      this.emit('feedbackSubmitted', betaFeedback);
      return betaFeedback;
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      throw error;
    }
  }

  /**
   * Get beta program metrics
   */
  async getMetrics(
    timeRange: '24h' | '7d' | '30d' = '7d'
  ): Promise<BetaMetrics> {
    try {
      const betaUsers = await featureFlagService.getBetaUsers();
      const totalUsers = betaUsers.length;
      const activeUsers = betaUsers.filter(
        user =>
          user.lastActiveAt &&
          user.lastActiveAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length;
      const churnedUsers = betaUsers.filter(
        user => user.onboardingStatus === 'churned'
      ).length;

      // Get feedback metrics
      const timeRangeHours =
        timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
      const recentFeedback = (await this.database.findRecords('beta_feedback', {
        createdAt: {
          gte: new Date(Date.now() - timeRangeHours * 60 * 60 * 1000),
        },
      })) as BetaFeedback[];

      const satisfactionScores = recentFeedback
        .filter(f => f.type === 'satisfaction_score' && f.rating)
        .map(f => f.rating!);

      const averageSatisfactionScore =
        satisfactionScores.length > 0
          ? satisfactionScores.reduce((sum, score) => sum + score, 0) /
            satisfactionScores.length
          : 0;

      // Feature adoption rates (would be calculated from usage analytics)
      const featureAdoptionRates: Record<string, number> = {
        sentiment_analysis: 85.2,
        response_suggestions: 72.1,
        escalation_prevention: 56.8,
        analytics_dashboard: 91.3,
      };

      return {
        totalUsers,
        activeUsers,
        churnedUsers,
        averageSessionTime: 28.5, // minutes - would come from analytics
        feedbackCount: recentFeedback.length,
        averageSatisfactionScore,
        featureAdoptionRates,
        conversionRate: 23.5, // % - would be calculated from conversion tracking
      };
    } catch (error) {
      console.error('Failed to get beta metrics:', error);
      throw error;
    }
  }

  /**
   * Get all feedback for analysis
   */
  async getAllFeedback(
    filters: {
      type?: BetaFeedback['type'];
      urgency?: BetaFeedback['urgency'];
      status?: BetaFeedback['status'];
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ): Promise<BetaFeedback[]> {
    try {
      const query: Record<string, any> = {};

      if (filters.type) query.type = filters.type;
      if (filters.urgency) query.urgency = filters.urgency;
      if (filters.status) query.status = filters.status;
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.gte = filters.dateFrom;
        if (filters.dateTo) query.createdAt.lte = filters.dateTo;
      }

      return (await this.database.findRecords(
        'beta_feedback',
        query
      )) as BetaFeedback[];
    } catch (error) {
      console.error('Failed to get feedback:', error);
      return [];
    }
  }

  private generateInvitationToken(): string {
    return `beta_invite_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private async sendInvitationEmail(invitation: BetaInvitation): Promise<void> {
    // Integration point for email service
    console.log(
      `📧 Sending beta invitation to ${invitation.email} with token: ${invitation.invitationToken}`
    );

    // Record email sent metric
    monitoringService.recordMetric('beta_invitation_email_sent', 1, 'count', {
      email_domain: invitation.email.split('@')[1],
    });
  }

  private async expireInvitation(invitationId: string): Promise<void> {
    try {
      await this.database.updateRecord('beta_invitations', invitationId, {
        status: 'expired',
      });

      monitoringService.recordBusinessMetric(
        'beta_invitations_expired',
        1,
        undefined,
        '24h'
      );
    } catch (error) {
      console.error('Failed to expire invitation:', error);
    }
  }

  private async escalateFeedback(feedback: BetaFeedback): Promise<void> {
    // Integration point for escalation system
    console.log(`🚨 Escalating critical feedback: ${feedback.id}`);

    monitoringService.recordMetric('beta_feedback_escalated', 1, 'count', {
      feedback_type: feedback.type,
      urgency: feedback.urgency,
    });
  }

  private async loadPendingInvitations(): Promise<void> {
    try {
      const pendingInvitations = (await this.database.findRecords(
        'beta_invitations',
        {
          status: 'pending',
          expiresAt: { gt: new Date() },
        }
      )) as BetaInvitation[];

      pendingInvitations.forEach(invitation => {
        this.invitationTokens.set(invitation.invitationToken, invitation);
      });

      console.log(
        `📥 Loaded ${pendingInvitations.length} pending beta invitations`
      );
    } catch (error) {
      console.error('Failed to load pending invitations:', error);
    }
  }
}

// Export singleton instance
export const betaProgramService = new BetaProgramService();
