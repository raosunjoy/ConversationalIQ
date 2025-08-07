/**
 * Feature Flag Service for Beta User Program
 * Enables controlled feature rollouts, A/B testing, and beta program management
 */

import { EventEmitter } from 'events';
import { DatabaseService } from './database';
import { monitoringService } from '../monitoring/monitoring-service';

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetAudience: 'all' | 'beta' | 'internal' | 'specific';
  userSegments: string[];
  conditions: FeatureFlagCondition[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface FeatureFlagCondition {
  type: 'user_id' | 'email_domain' | 'account_type' | 'zendesk_plan' | 'custom';
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'in'
    | 'not_in'
    | 'greater_than'
    | 'less_than';
  value: string | number | string[];
}

export interface FeatureFlagEvaluation {
  flagId: string;
  userId: string;
  enabled: boolean;
  variant?: string;
  reason: string;
  evaluatedAt: Date;
}

export interface BetaUser {
  id: string;
  email: string;
  zendeskAccountId: string;
  accountType: 'beta' | 'trial' | 'paid';
  betaFeatures: string[];
  onboardingStatus: 'invited' | 'active' | 'churned';
  feedbackScore?: number;
  joinedAt: Date;
  lastActiveAt?: Date;
}

export class FeatureFlagService extends EventEmitter {
  private database: DatabaseService;
  private flagCache: Map<string, FeatureFlag>;
  private evaluationHistory: FeatureFlagEvaluation[];
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.database = new DatabaseService();
    this.flagCache = new Map();
    this.evaluationHistory = [];
    this.startCacheRefresh();
  }

  /**
   * Initialize feature flag cache from database
   */
  async initialize(): Promise<void> {
    try {
      await this.refreshCache();
      console.log('✅ Feature Flag Service initialized');
    } catch (error) {
      console.error('❌ Feature Flag Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create a new feature flag
   */
  async createFeatureFlag(
    flag: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<FeatureFlag> {
    try {
      const newFlag: FeatureFlag = {
        ...flag,
        id: `flag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in database
      await this.database.createRecord('feature_flags', newFlag);

      // Update cache
      this.flagCache.set(newFlag.id, newFlag);

      // Record metrics
      monitoringService.recordMetric('feature_flag_created', 1, 'count', {
        flag_name: newFlag.name,
        target_audience: newFlag.targetAudience,
        rollout_percentage: newFlag.rolloutPercentage.toString(),
      });

      this.emit('flagCreated', newFlag);
      return newFlag;
    } catch (error) {
      console.error('Failed to create feature flag:', error);
      throw error;
    }
  }

  /**
   * Update an existing feature flag
   */
  async updateFeatureFlag(
    flagId: string,
    updates: Partial<FeatureFlag>
  ): Promise<FeatureFlag> {
    try {
      const existingFlag = this.flagCache.get(flagId);
      if (!existingFlag) {
        throw new Error(`Feature flag ${flagId} not found`);
      }

      const updatedFlag: FeatureFlag = {
        ...existingFlag,
        ...updates,
        id: flagId, // Ensure ID doesn't change
        updatedAt: new Date(),
      };

      // Store in database
      await this.database.updateRecord('feature_flags', flagId, updatedFlag);

      // Update cache
      this.flagCache.set(flagId, updatedFlag);

      // Record metrics
      monitoringService.recordMetric('feature_flag_updated', 1, 'count', {
        flag_name: updatedFlag.name,
        enabled: updatedFlag.enabled.toString(),
      });

      this.emit('flagUpdated', updatedFlag);
      return updatedFlag;
    } catch (error) {
      console.error('Failed to update feature flag:', error);
      throw error;
    }
  }

  /**
   * Evaluate if a feature flag is enabled for a specific user
   */
  async evaluateFlag(
    flagId: string,
    userId: string,
    context: Record<string, any> = {}
  ): Promise<FeatureFlagEvaluation> {
    try {
      const flag = this.flagCache.get(flagId);
      if (!flag) {
        return this.createEvaluation(flagId, userId, false, 'Flag not found');
      }

      // Check if flag is globally disabled
      if (!flag.enabled) {
        return this.createEvaluation(
          flagId,
          userId,
          false,
          'Flag globally disabled'
        );
      }

      // Get user information
      const user = await this.getUserContext(userId, context);

      // Check target audience
      if (!this.matchesTargetAudience(flag, user)) {
        return this.createEvaluation(
          flagId,
          userId,
          false,
          'User not in target audience'
        );
      }

      // Check conditions
      if (!this.evaluateConditions(flag.conditions, user, context)) {
        return this.createEvaluation(
          flagId,
          userId,
          false,
          'Conditions not met'
        );
      }

      // Check rollout percentage
      if (!this.isInRolloutPercentage(flag.rolloutPercentage, userId)) {
        return this.createEvaluation(
          flagId,
          userId,
          false,
          'Not in rollout percentage'
        );
      }

      const evaluation = this.createEvaluation(
        flagId,
        userId,
        true,
        'All conditions met'
      );

      // Record successful evaluation
      monitoringService.recordMetric('feature_flag_evaluation', 1, 'count', {
        flag_name: flag.name,
        enabled: 'true',
        user_segment: user.accountType || 'unknown',
      });

      return evaluation;
    } catch (error) {
      console.error('Failed to evaluate feature flag:', error);
      return this.createEvaluation(
        flagId,
        userId,
        false,
        `Evaluation error: ${error instanceof Error ? error.message : 'unknown'}`
      );
    }
  }

  /**
   * Get all active beta users
   */
  async getBetaUsers(): Promise<BetaUser[]> {
    try {
      const betaUsers = await this.database.findRecords('beta_users', {
        onboardingStatus: { in: ['invited', 'active'] },
      });
      return betaUsers as BetaUser[];
    } catch (error) {
      console.error('Failed to get beta users:', error);
      return [];
    }
  }

  /**
   * Add a user to the beta program
   */
  async addBetaUser(
    user: Omit<BetaUser, 'id' | 'joinedAt'>
  ): Promise<BetaUser> {
    try {
      const betaUser: BetaUser = {
        ...user,
        id: `beta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        joinedAt: new Date(),
      };

      await this.database.createRecord('beta_users', betaUser);

      // Record metrics
      monitoringService.recordBusinessMetric(
        'beta_users_added',
        1,
        undefined,
        '24h'
      );

      this.emit('betaUserAdded', betaUser);
      return betaUser;
    } catch (error) {
      console.error('Failed to add beta user:', error);
      throw error;
    }
  }

  /**
   * Get feature flag analytics
   */
  async getAnalytics(timeRange: '24h' | '7d' | '30d' = '7d'): Promise<{
    totalFlags: number;
    activeFlags: number;
    evaluations: number;
    betaUsers: number;
    topFlags: Array<{ name: string; evaluations: number; successRate: number }>;
  }> {
    try {
      const totalFlags = this.flagCache.size;
      const activeFlags = Array.from(this.flagCache.values()).filter(
        f => f.enabled
      ).length;

      const recentEvaluations = this.evaluationHistory.filter(e => {
        const hoursAgo =
          timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
        return e.evaluatedAt > new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
      });

      const betaUsers = await this.getBetaUsers();

      // Calculate top flags by usage
      const flagStats = new Map<
        string,
        { evaluations: number; successes: number }
      >();
      recentEvaluations.forEach(e => {
        const stats = flagStats.get(e.flagId) || {
          evaluations: 0,
          successes: 0,
        };
        stats.evaluations++;
        if (e.enabled) stats.successes++;
        flagStats.set(e.flagId, stats);
      });

      const topFlags = Array.from(flagStats.entries())
        .map(([flagId, stats]) => {
          const flag = this.flagCache.get(flagId);
          return {
            name: flag?.name || flagId,
            evaluations: stats.evaluations,
            successRate:
              stats.evaluations > 0
                ? (stats.successes / stats.evaluations) * 100
                : 0,
          };
        })
        .sort((a, b) => b.evaluations - a.evaluations)
        .slice(0, 10);

      return {
        totalFlags,
        activeFlags,
        evaluations: recentEvaluations.length,
        betaUsers: betaUsers.length,
        topFlags,
      };
    } catch (error) {
      console.error('Failed to get analytics:', error);
      throw error;
    }
  }

  private createEvaluation(
    flagId: string,
    userId: string,
    enabled: boolean,
    reason: string
  ): FeatureFlagEvaluation {
    const evaluation: FeatureFlagEvaluation = {
      flagId,
      userId,
      enabled,
      reason,
      evaluatedAt: new Date(),
    };

    // Store in history (keep last 10000 evaluations)
    this.evaluationHistory.push(evaluation);
    if (this.evaluationHistory.length > 10000) {
      this.evaluationHistory = this.evaluationHistory.slice(-10000);
    }

    return evaluation;
  }

  private async getUserContext(
    userId: string,
    context: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      // Get user from database or beta users
      const user =
        (await this.database.findRecord('users', userId)) ||
        (await this.database.findRecord('beta_users', userId));

      return {
        ...user,
        ...context,
      };
    } catch {
      return context;
    }
  }

  private matchesTargetAudience(
    flag: FeatureFlag,
    user: Record<string, any>
  ): boolean {
    switch (flag.targetAudience) {
      case 'all':
        return true;
      case 'beta':
        return (
          user.accountType === 'beta' || flag.userSegments.includes(user.id)
        );
      case 'internal':
        return user.email?.endsWith('@conversationiq.com') || false;
      case 'specific':
        return (
          flag.userSegments.includes(user.id) ||
          flag.userSegments.includes(user.email)
        );
      default:
        return false;
    }
  }

  private evaluateConditions(
    conditions: FeatureFlagCondition[],
    user: Record<string, any>,
    context: Record<string, any>
  ): boolean {
    if (conditions.length === 0) return true;

    return conditions.every(condition => {
      const value = user[condition.type] || context[condition.type];

      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'not_equals':
          return value !== condition.value;
        case 'contains':
          return String(value).includes(String(condition.value));
        case 'in':
          return (
            Array.isArray(condition.value) && condition.value.includes(value)
          );
        case 'not_in':
          return (
            Array.isArray(condition.value) && !condition.value.includes(value)
          );
        case 'greater_than':
          return Number(value) > Number(condition.value);
        case 'less_than':
          return Number(value) < Number(condition.value);
        default:
          return false;
      }
    });
  }

  private isInRolloutPercentage(percentage: number, userId: string): boolean {
    if (percentage === 100) return true;
    if (percentage === 0) return false;

    // Consistent hash-based rollout
    const hash = this.hashString(userId);
    return hash % 100 < percentage;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private async refreshCache(): Promise<void> {
    try {
      const flags = await this.database.findRecords('feature_flags', {});
      this.flagCache.clear();

      (flags as FeatureFlag[]).forEach(flag => {
        this.flagCache.set(flag.id, flag);
      });

      console.log(
        `🔄 Feature flag cache refreshed: ${this.flagCache.size} flags loaded`
      );
    } catch (error) {
      console.error('Failed to refresh feature flag cache:', error);
    }
  }

  private startCacheRefresh(): void {
    // Refresh cache every 5 minutes
    this.refreshInterval = setInterval(
      () => {
        this.refreshCache();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.removeAllListeners();
  }
}

// Export singleton instance
export const featureFlagService = new FeatureFlagService();
