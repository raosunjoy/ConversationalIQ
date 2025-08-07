/**
 * Beta Program Service Tests
 * Comprehensive test suite for beta user management and feature flags
 */

import { betaProgramService } from './beta-program-service';
import { featureFlagService } from './feature-flag-service';
import { DatabaseService } from './database';

// Mock DatabaseService
jest.mock('./database', () => ({
  DatabaseService: jest.fn().mockImplementation(() => ({
    createRecord: jest.fn(),
    findRecord: jest.fn(),
    findRecords: jest.fn(),
    updateRecord: jest.fn(),
    deleteRecord: jest.fn(),
  })),
}));

// Mock FeatureFlagService
jest.mock('./feature-flag-service', () => ({
  featureFlagService: {
    addBetaUser: jest.fn(),
    getBetaUsers: jest.fn(),
  },
}));

describe('BetaProgramService', () => {
  let mockDatabase: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase = new DatabaseService() as jest.Mocked<DatabaseService>;
    (betaProgramService as any).database = mockDatabase;
  });

  describe('Beta Invitation Management', () => {
    it('should create beta invitation successfully', async () => {
      const email = 'test@example.com';
      const invitedBy = 'admin@conversationiq.com';
      const metadata = { source: 'manual_invite' };

      mockDatabase.findRecord.mockResolvedValueOnce(null); // No existing user
      mockDatabase.findRecord.mockResolvedValueOnce(null); // No existing invitation
      mockDatabase.createRecord.mockResolvedValueOnce({});

      const invitation = await betaProgramService.inviteUser(email, invitedBy, metadata);

      expect(invitation).toMatchObject({
        email,
        invitedBy,
        metadata,
        status: 'pending',
      });
      expect(invitation.id).toBeDefined();
      expect(invitation.invitationToken).toBeDefined();
      expect(invitation.expiresAt).toBeInstanceOf(Date);
    });

    it('should reject invitation for existing beta user', async () => {
      const email = 'existing@example.com';
      
      mockDatabase.findRecord.mockResolvedValueOnce({ 
        id: 'existing-user', 
        email 
      }); // Existing user

      await expect(
        betaProgramService.inviteUser(email, 'admin@conversationiq.com')
      ).rejects.toThrow('User is already in the beta program');
    });

    it('should reject duplicate pending invitation', async () => {
      const email = 'duplicate@example.com';
      
      mockDatabase.findRecord.mockResolvedValueOnce(null); // No existing user
      mockDatabase.findRecord.mockResolvedValueOnce({ 
        id: 'existing-invite', 
        email,
        status: 'pending' 
      }); // Existing invitation

      await expect(
        betaProgramService.inviteUser(email, 'admin@conversationiq.com')
      ).rejects.toThrow('User already has a pending invitation');
    });

    it('should accept valid invitation', async () => {
      const token = 'valid-token-123';
      const mockInvitation = {
        id: 'invite-123',
        email: 'newuser@example.com',
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      };

      (betaProgramService as any).invitationTokens.set(token, mockInvitation);
      
      const mockBetaUser = {
        id: 'beta-user-123',
        email: 'newuser@example.com',
        accountType: 'beta',
        onboardingStatus: 'active',
      };

      (featureFlagService.addBetaUser as jest.Mock).mockResolvedValueOnce(mockBetaUser);
      mockDatabase.updateRecord.mockResolvedValueOnce({});
      mockDatabase.createRecord.mockResolvedValueOnce({}); // For onboarding

      const betaUser = await betaProgramService.acceptInvitation(token, {
        zendeskAccountId: 'zendesk-123',
      });

      expect(betaUser).toMatchObject({
        email: 'newuser@example.com',
        accountType: 'beta',
        onboardingStatus: 'active',
      });
      expect(featureFlagService.addBetaUser).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should reject expired invitation', async () => {
      const token = 'expired-token-123';
      const mockInvitation = {
        id: 'invite-123',
        email: 'expired@example.com',
        status: 'pending',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired 24 hours ago
      };

      mockDatabase.findRecord.mockResolvedValueOnce(mockInvitation);

      await expect(
        betaProgramService.acceptInvitation(token, {})
      ).rejects.toThrow('Invitation has expired');
    });
  });

  describe('Beta Onboarding', () => {
    it('should start onboarding process', async () => {
      const userId = 'beta-user-123';
      mockDatabase.createRecord.mockResolvedValueOnce({});

      const onboarding = await betaProgramService.startOnboarding(userId);

      expect(onboarding).toMatchObject({
        userId,
        currentStep: 0,
        totalSteps: 6, // Expected number of onboarding steps
        completedSteps: [],
      });
      expect(onboarding.startedAt).toBeInstanceOf(Date);
    });

    it('should complete onboarding step', async () => {
      const userId = 'beta-user-123';
      const stepName = 'welcome_tour';
      
      const mockOnboarding = {
        id: 'onboarding-123',
        userId,
        currentStep: 0,
        totalSteps: 6,
        completedSteps: [],
        startedAt: new Date(),
      };

      mockDatabase.findRecord.mockResolvedValueOnce(mockOnboarding);
      mockDatabase.updateRecord.mockResolvedValueOnce({
        ...mockOnboarding,
        completedSteps: [stepName],
        currentStep: 1,
      });

      const result = await betaProgramService.completeOnboardingStep(userId, stepName);

      expect(result.completedSteps).toContain(stepName);
      expect(result.currentStep).toBe(1);
    });

    it('should mark onboarding as completed when all steps done', async () => {
      const userId = 'beta-user-123';
      const stepName = 'support_resources'; // Last step
      
      const mockOnboarding = {
        id: 'onboarding-123',
        userId,
        currentStep: 5,
        totalSteps: 6,
        completedSteps: ['step1', 'step2', 'step3', 'step4', 'step5'],
        startedAt: new Date(),
      };

      mockDatabase.findRecord.mockResolvedValueOnce(mockOnboarding);
      mockDatabase.updateRecord.mockResolvedValueOnce({
        ...mockOnboarding,
        completedSteps: [...mockOnboarding.completedSteps, stepName],
        currentStep: 6,
        completedAt: expect.any(Date),
      });

      const result = await betaProgramService.completeOnboardingStep(userId, stepName);

      expect(result.completedAt).toBeDefined();
      expect(result.currentStep).toBe(6);
    });
  });

  describe('Feedback Collection', () => {
    it('should submit feedback successfully', async () => {
      const feedbackData = {
        userId: 'beta-user-123',
        type: 'feature_request' as const,
        content: 'I would like to see export functionality',
        urgency: 'medium' as const,
        status: 'open' as const,
        metadata: {},
      };

      mockDatabase.createRecord.mockResolvedValueOnce({
        ...feedbackData,
        id: 'feedback-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const feedback = await betaProgramService.submitFeedback(feedbackData);

      expect(feedback).toMatchObject(feedbackData);
      expect(feedback.id).toBeDefined();
      expect(feedback.createdAt).toBeInstanceOf(Date);
    });

    it('should escalate critical feedback', async () => {
      const criticalFeedback = {
        userId: 'beta-user-123',
        type: 'bug_report' as const,
        content: 'Application crashes when opening analytics',
        urgency: 'critical' as const,
        status: 'open' as const,
        metadata: {},
      };

      mockDatabase.createRecord.mockResolvedValueOnce({
        ...criticalFeedback,
        id: 'feedback-critical-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Spy on console.log to verify escalation
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await betaProgramService.submitFeedback(criticalFeedback);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚨 Escalating critical feedback')
      );

      consoleSpy.mockRestore();
    });

    it('should filter feedback by criteria', async () => {
      const mockFeedback = [
        {
          id: 'feedback-1',
          type: 'feature_request',
          urgency: 'high',
          status: 'open',
          createdAt: new Date(),
        },
        {
          id: 'feedback-2',
          type: 'bug_report',
          urgency: 'critical',
          status: 'in_review',
          createdAt: new Date(),
        },
      ];

      mockDatabase.findRecords.mockResolvedValueOnce(mockFeedback);

      const feedback = await betaProgramService.getAllFeedback({
        type: 'feature_request',
        urgency: 'high',
      });

      expect(mockDatabase.findRecords).toHaveBeenCalledWith(
        'beta_feedback',
        expect.objectContaining({
          type: 'feature_request',
          urgency: 'high',
        })
      );
    });
  });

  describe('Beta Metrics', () => {
    it('should calculate beta program metrics', async () => {
      const mockBetaUsers = [
        {
          id: 'user-1',
          onboardingStatus: 'active',
          lastActiveAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        },
        {
          id: 'user-2', 
          onboardingStatus: 'active',
          lastActiveAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        },
        {
          id: 'user-3',
          onboardingStatus: 'churned',
          lastActiveAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        },
      ];

      const mockFeedback = [
        {
          type: 'satisfaction_score',
          rating: 5,
          createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        },
        {
          type: 'satisfaction_score',
          rating: 4,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
      ];

      (featureFlagService.getBetaUsers as jest.Mock).mockResolvedValueOnce(mockBetaUsers);
      mockDatabase.findRecords.mockResolvedValueOnce(mockFeedback);

      const metrics = await betaProgramService.getMetrics('7d');

      expect(metrics).toMatchObject({
        totalUsers: 3,
        activeUsers: 2, // Users active within last 7 days
        churnedUsers: 1,
        feedbackCount: 2,
        averageSatisfactionScore: 4.5, // (5 + 4) / 2
      });
      expect(metrics.featureAdoptionRates).toBeDefined();
      expect(metrics.conversionRate).toBeDefined();
    });
  });

  describe('Service Initialization', () => {
    it('should initialize successfully', async () => {
      mockDatabase.findRecords.mockResolvedValueOnce([]); // No pending invitations
      
      await expect(betaProgramService.initialize()).resolves.not.toThrow();
    });

    it('should load pending invitations on init', async () => {
      const mockInvitations = [
        {
          id: 'invite-1',
          invitationToken: 'token-1',
          status: 'pending',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        {
          id: 'invite-2',
          invitationToken: 'token-2',
          status: 'pending',
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      ];

      mockDatabase.findRecords.mockResolvedValueOnce(mockInvitations);

      await betaProgramService.initialize();

      // Verify tokens are loaded into memory
      expect((betaProgramService as any).invitationTokens.size).toBe(2);
      expect((betaProgramService as any).invitationTokens.has('token-1')).toBe(true);
      expect((betaProgramService as any).invitationTokens.has('token-2')).toBe(true);
    });
  });
});

describe('FeatureFlagService', () => {
  let mockDatabase: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase = new DatabaseService() as jest.Mocked<DatabaseService>;
    (featureFlagService as any).database = mockDatabase;
  });

  describe('Feature Flag Management', () => {
    it('should create feature flag successfully', async () => {
      const flagData = {
        name: 'new_analytics_panel',
        description: 'New analytics panel for beta users',
        enabled: true,
        rolloutPercentage: 50,
        targetAudience: 'beta' as const,
        userSegments: [],
        conditions: [],
        createdBy: 'admin@conversationiq.com',
        metadata: {},
      };

      mockDatabase.createRecord.mockResolvedValueOnce({});

      const flag = await featureFlagService.createFeatureFlag(flagData);

      expect(flag).toMatchObject(flagData);
      expect(flag.id).toBeDefined();
      expect(flag.createdAt).toBeInstanceOf(Date);
      expect(flag.updatedAt).toBeInstanceOf(Date);
    });

    it('should evaluate flag for beta user correctly', async () => {
      const flagId = 'test-flag-123';
      const userId = 'beta-user-456';
      
      const mockFlag = {
        id: flagId,
        name: 'test_feature',
        enabled: true,
        rolloutPercentage: 100,
        targetAudience: 'beta',
        conditions: [],
        userSegments: [],
      };

      const mockUser = {
        id: userId,
        accountType: 'beta',
      };

      (featureFlagService as any).flagCache.set(flagId, mockFlag);
      mockDatabase.findRecord.mockResolvedValueOnce(mockUser);

      const evaluation = await featureFlagService.evaluateFlag(flagId, userId);

      expect(evaluation).toMatchObject({
        flagId,
        userId,
        enabled: true,
        reason: 'All conditions met',
      });
    });

    it('should reject flag for non-beta user when target is beta', async () => {
      const flagId = 'beta-only-flag';
      const userId = 'regular-user-789';
      
      const mockFlag = {
        id: flagId,
        enabled: true,
        rolloutPercentage: 100,
        targetAudience: 'beta',
        conditions: [],
        userSegments: [],
      };

      const mockUser = {
        id: userId,
        accountType: 'regular',
      };

      (featureFlagService as any).flagCache.set(flagId, mockFlag);
      mockDatabase.findRecord.mockResolvedValueOnValue(mockUser);

      const evaluation = await featureFlagService.evaluateFlag(flagId, userId);

      expect(evaluation).toMatchObject({
        enabled: false,
        reason: 'User not in target audience',
      });
    });

    it('should respect rollout percentage', async () => {
      const flagId = 'partial-rollout-flag';
      const userId = 'test-user-consistent-hash';
      
      const mockFlag = {
        id: flagId,
        enabled: true,
        rolloutPercentage: 0, // 0% rollout
        targetAudience: 'all',
        conditions: [],
        userSegments: [],
      };

      (featureFlagService as any).flagCache.set(flagId, mockFlag);
      mockDatabase.findRecord.mockResolvedValue({});

      const evaluation = await featureFlagService.evaluateFlag(flagId, userId);

      expect(evaluation.enabled).toBe(false);
      expect(evaluation.reason).toBe('Not in rollout percentage');
    });
  });

  describe('Analytics', () => {
    it('should provide feature flag analytics', async () => {
      const mockFlags = [
        { id: 'flag-1', enabled: true, name: 'Feature 1' },
        { id: 'flag-2', enabled: false, name: 'Feature 2' },
        { id: 'flag-3', enabled: true, name: 'Feature 3' },
      ];

      const mockBetaUsers = [
        { id: 'user-1' },
        { id: 'user-2' },
      ];

      // Mock flag cache
      mockFlags.forEach(flag => {
        (featureFlagService as any).flagCache.set(flag.id, flag);
      });

      mockDatabase.findRecords.mockResolvedValueOnce(mockBetaUsers);

      const analytics = await featureFlagService.getAnalytics('7d');

      expect(analytics).toMatchObject({
        totalFlags: 3,
        activeFlags: 2, // flags with enabled: true
        betaUsers: 2,
      });
      expect(analytics.topFlags).toBeDefined();
    });
  });
});