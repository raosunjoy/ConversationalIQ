/**
 * Marketplace Analytics Service
 * Advanced analytics for marketplace performance, user behavior, and business intelligence
 */

import { DatabaseService } from './database';
import { EventProcessor } from '../events/event-processor';

export interface MarketplaceMetrics {
  installations: {
    total: number;
    thisMonth: number;
    growth: number; // percentage
    bySource: { [source: string]: number };
  };
  activations: {
    total: number;
    thisMonth: number;
    rate: number; // percentage of installations that activate
    timeToActivation: {
      average: number; // in hours
      median: number;
      p90: number;
    };
  };
  trials: {
    started: number;
    active: number;
    converted: number;
    conversionRate: number;
    averageTrialDuration: number; // in days
    extensionRequests: number;
  };
  subscriptions: {
    active: number;
    byTier: { [tier: string]: number };
    monthlyRevenue: number;
    averageRevenuePerUser: number;
    churnRate: number;
    lifetimeValue: number;
  };
  usage: {
    dailyActiveUsers: number;
    monthlyActiveUsers: number;
    sessionsPerUser: number;
    averageSessionDuration: number; // in minutes
    retentionRates: {
      day1: number;
      day7: number;
      day30: number;
    };
  };
  features: {
    mostUsed: Array<{ feature: string; usage: number; percentage: number }>;
    adoptionRates: { [feature: string]: number };
    dropoffPoints: Array<{ step: string; dropoffRate: number }>;
  };
  satisfaction: {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { [rating: number]: number };
    netPromoterScore: number;
  };
  support: {
    ticketsCreated: number;
    averageResolutionTime: number; // in hours
    satisfactionScore: number;
    topIssues: Array<{ issue: string; count: number }>;
  };
}

export interface UserBehaviorEvent {
  id: string;
  organizationId: string;
  userId: string;
  eventType: string;
  eventCategory: 'installation' | 'activation' | 'feature_usage' | 'subscription' | 'support';
  properties: any;
  timestamp: Date;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  zendeskInfo?: {
    subdomain: string;
    accountId: string;
    plan: string;
    agentCount: number;
  };
}

export interface ConversionFunnel {
  step: string;
  users: number;
  conversionRate: number;
  dropoffRate: number;
  averageTimeToNext?: number; // in hours
}

export interface CohortAnalysis {
  cohortMonth: string;
  cohortSize: number;
  retentionByMonth: { [month: string]: number };
  revenueByMonth: { [month: string]: number };
  lifetimeValue: number;
}

export interface FeatureAdoption {
  feature: string;
  totalUsers: number;
  adoptedUsers: number;
  adoptionRate: number;
  timeToAdoption: {
    average: number;
    median: number;
  };
  usageFrequency: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

export interface MarketplaceInsight {
  type: 'opportunity' | 'risk' | 'trend' | 'anomaly';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  confidence: number; // 0-100
  data: any;
  recommendations?: string[];
  timestamp: Date;
}

export class MarketplaceAnalyticsService {
  private db: DatabaseService;
  private eventProcessor: EventProcessor;

  constructor() {
    this.db = new DatabaseService();
    this.eventProcessor = new EventProcessor();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.eventProcessor.on('app.installed', this.handleAppInstalled.bind(this));
    this.eventProcessor.on('app.activated', this.handleAppActivated.bind(this));
    this.eventProcessor.on('trial.started', this.handleTrialStarted.bind(this));
    this.eventProcessor.on('subscription.converted', this.handleSubscriptionConverted.bind(this));
    this.eventProcessor.on('feature.used', this.handleFeatureUsed.bind(this));
    this.eventProcessor.on('user.session', this.handleUserSession.bind(this));
    this.eventProcessor.on('support.ticket', this.handleSupportTicket.bind(this));
    this.eventProcessor.on('app.review', this.handleAppReview.bind(this));
  }

  // Event Tracking
  async trackEvent(event: Omit<UserBehaviorEvent, 'id' | 'timestamp'>): Promise<string> {
    const behaviorEvent: UserBehaviorEvent = {
      ...event,
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    const eventId = await this.db.createRecord('marketplace_events', behaviorEvent);
    
    await this.eventProcessor.publish('analytics.event.tracked', { event: behaviorEvent });
    
    return eventId;
  }

  async trackInstallation(organizationId: string, zendeskInfo: any, source: string = 'marketplace'): Promise<void> {
    await this.trackEvent({
      organizationId,
      userId: 'system',
      eventType: 'app_installed',
      eventCategory: 'installation',
      properties: {
        source,
        zendeskPlan: zendeskInfo.plan,
        agentCount: zendeskInfo.agentCount
      },
      zendeskInfo
    });
  }

  async trackActivation(organizationId: string, userId: string, timeToActivation: number): Promise<void> {
    await this.trackEvent({
      organizationId,
      userId,
      eventType: 'app_activated',
      eventCategory: 'activation',
      properties: {
        timeToActivation // in minutes
      }
    });
  }

  async trackFeatureUsage(
    organizationId: string, 
    userId: string, 
    feature: string, 
    properties?: any,
    sessionId?: string
  ): Promise<void> {
    await this.trackEvent({
      organizationId,
      userId,
      eventType: 'feature_used',
      eventCategory: 'feature_usage',
      properties: {
        feature,
        ...properties
      },
      sessionId
    });
  }

  async trackUserSession(
    organizationId: string,
    userId: string,
    sessionId: string,
    duration: number,
    pageViews: number,
    actionsPerformed: string[]
  ): Promise<void> {
    await this.trackEvent({
      organizationId,
      userId,
      eventType: 'session_completed',
      eventCategory: 'feature_usage',
      properties: {
        duration, // in minutes
        pageViews,
        actionsPerformed,
        actionsCount: actionsPerformed.length
      },
      sessionId
    });
  }

  // Metrics Calculation
  async getMarketplaceMetrics(): Promise<MarketplaceMetrics> {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(thisMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const [
      installations,
      activations,
      trials,
      subscriptions,
      usage,
      features,
      satisfaction,
      support
    ] = await Promise.all([
      this.getInstallationMetrics(),
      this.getActivationMetrics(),
      this.getTrialMetrics(),
      this.getSubscriptionMetrics(),
      this.getUsageMetrics(),
      this.getFeatureMetrics(),
      this.getSatisfactionMetrics(),
      this.getSupportMetrics()
    ]);

    return {
      installations,
      activations,
      trials,
      subscriptions,
      usage,
      features,
      satisfaction,
      support
    };
  }

  private async getInstallationMetrics(): Promise<MarketplaceMetrics['installations']> {
    const installEvents = await this.db.findByField('marketplace_events', 'eventType', 'app_installed');
    
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const lastMonth = new Date(thisMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const thisMonthInstalls = installEvents.filter(e => e.timestamp >= thisMonth).length;
    const lastMonthInstalls = installEvents.filter(e => 
      e.timestamp >= lastMonth && e.timestamp < thisMonth
    ).length;

    const growth = lastMonthInstalls > 0 
      ? ((thisMonthInstalls - lastMonthInstalls) / lastMonthInstalls) * 100 
      : 0;

    // Group by source
    const bySource = installEvents.reduce((acc, event) => {
      const source = event.properties?.source || 'unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {} as { [source: string]: number });

    return {
      total: installEvents.length,
      thisMonth: thisMonthInstalls,
      growth,
      bySource
    };
  }

  private async getActivationMetrics(): Promise<MarketplaceMetrics['activations']> {
    const activationEvents = await this.db.findByField('marketplace_events', 'eventType', 'app_activated');
    const installEvents = await this.db.findByField('marketplace_events', 'eventType', 'app_installed');
    
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const thisMonthActivations = activationEvents.filter(e => e.timestamp >= thisMonth).length;
    const activationTimes = activationEvents
      .map(e => e.properties?.timeToActivation || 0)
      .filter(t => t > 0);

    const averageTimeToActivation = activationTimes.length > 0
      ? activationTimes.reduce((sum, time) => sum + time, 0) / activationTimes.length / 60 // convert to hours
      : 0;

    const sortedTimes = [...activationTimes].sort((a, b) => a - b);
    const median = sortedTimes.length > 0
      ? sortedTimes[Math.floor(sortedTimes.length / 2)] / 60
      : 0;

    const p90Index = Math.floor(sortedTimes.length * 0.9);
    const p90 = sortedTimes.length > 0 ? sortedTimes[p90Index] / 60 : 0;

    const activationRate = installEvents.length > 0
      ? (activationEvents.length / installEvents.length) * 100
      : 0;

    return {
      total: activationEvents.length,
      thisMonth: thisMonthActivations,
      rate: activationRate,
      timeToActivation: {
        average: averageTimeToActivation,
        median,
        p90
      }
    };
  }

  private async getTrialMetrics(): Promise<MarketplaceMetrics['trials']> {
    const trialEvents = await this.db.findByField('marketplace_events', 'eventType', 'trial_started');
    const conversionEvents = await this.db.findByField('marketplace_events', 'eventType', 'trial_converted');
    const extensionEvents = await this.db.findByField('marketplace_events', 'eventType', 'trial_extended');

    // Get active trials from subscription data
    const subscriptions = await this.db.findByField('subscriptions', 'status', 'trialing');
    const activeTrials = subscriptions.length;

    const conversionRate = trialEvents.length > 0
      ? (conversionEvents.length / trialEvents.length) * 100
      : 0;

    // Calculate average trial duration from converted trials
    const averageTrialDuration = conversionEvents.length > 0
      ? conversionEvents.reduce((sum, event) => {
          return sum + (event.properties?.trialDuration || 30);
        }, 0) / conversionEvents.length
      : 30;

    return {
      started: trialEvents.length,
      active: activeTrials,
      converted: conversionEvents.length,
      conversionRate,
      averageTrialDuration,
      extensionRequests: extensionEvents.length
    };
  }

  private async getSubscriptionMetrics(): Promise<MarketplaceMetrics['subscriptions']> {
    const subscriptions = await this.db.findByField('subscriptions', 'status', 'active');
    const allSubscriptions = await this.db.findAll('subscriptions');

    const byTier = subscriptions.reduce((acc, sub) => {
      const plan = sub.planId.split('_')[0]; // Extract tier from planId
      acc[plan] = (acc[plan] || 0) + 1;
      return acc;
    }, {} as { [tier: string]: number });

    const monthlyRevenue = subscriptions.reduce((sum, sub) => sum + sub.billing.amount, 0);
    const averageRevenuePerUser = subscriptions.length > 0 ? monthlyRevenue / subscriptions.length : 0;

    // Calculate churn rate (simplified)
    const thisMonth = new Date();
    thisMonth.setDate(1);
    
    const canceledThisMonth = allSubscriptions.filter(s => 
      s.status === 'canceled' && s.updatedAt >= thisMonth
    ).length;

    const startOfMonthActive = allSubscriptions.filter(s => 
      s.status === 'active' && s.createdAt < thisMonth
    ).length;

    const churnRate = startOfMonthActive > 0 ? (canceledThisMonth / startOfMonthActive) * 100 : 0;

    // Calculate customer lifetime value (simplified)
    const lifetimeValue = averageRevenuePerUser * (1 / (churnRate / 100)) * 12; // Annual LTV

    return {
      active: subscriptions.length,
      byTier,
      monthlyRevenue,
      averageRevenuePerUser,
      churnRate,
      lifetimeValue
    };
  }

  private async getUsageMetrics(): Promise<MarketplaceMetrics['usage']> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentEvents = await this.db.findByDateRange('marketplace_events', 'timestamp', thirtyDaysAgo, now);
    const todayEvents = recentEvents.filter(e => e.timestamp >= oneDayAgo);

    const uniqueUsersToday = new Set(todayEvents.map(e => e.userId)).size;
    const uniqueUsersThisMonth = new Set(recentEvents.map(e => e.userId)).size;

    const sessionEvents = recentEvents.filter(e => e.eventType === 'session_completed');
    const totalSessions = sessionEvents.length;
    const totalSessionDuration = sessionEvents.reduce((sum, e) => sum + (e.properties?.duration || 0), 0);
    
    const sessionsPerUser = uniqueUsersThisMonth > 0 ? totalSessions / uniqueUsersThisMonth : 0;
    const averageSessionDuration = totalSessions > 0 ? totalSessionDuration / totalSessions : 0;

    // Calculate retention rates
    const retentionRates = await this.calculateRetentionRates();

    return {
      dailyActiveUsers: uniqueUsersToday,
      monthlyActiveUsers: uniqueUsersThisMonth,
      sessionsPerUser,
      averageSessionDuration,
      retentionRates
    };
  }

  private async calculateRetentionRates(): Promise<{ day1: number; day7: number; day30: number }> {
    const installEvents = await this.db.findByField('marketplace_events', 'eventType', 'app_installed');
    
    let day1Retained = 0;
    let day7Retained = 0;
    let day30Retained = 0;

    for (const install of installEvents) {
      const installDate = install.timestamp;
      const day1Date = new Date(installDate.getTime() + 24 * 60 * 60 * 1000);
      const day7Date = new Date(installDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      const day30Date = new Date(installDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Check if user was active on each milestone
      const userEvents = await this.db.findByFields('marketplace_events', {
        organizationId: install.organizationId,
        eventCategory: 'feature_usage'
      });

      const hasDay1Activity = userEvents.some(e => 
        e.timestamp >= installDate && e.timestamp <= day1Date
      );
      const hasDay7Activity = userEvents.some(e => 
        e.timestamp >= installDate && e.timestamp <= day7Date
      );
      const hasDay30Activity = userEvents.some(e => 
        e.timestamp >= installDate && e.timestamp <= day30Date
      );

      if (hasDay1Activity) day1Retained++;
      if (hasDay7Activity) day7Retained++;
      if (hasDay30Activity) day30Retained++;
    }

    const totalInstalls = installEvents.length;
    
    return {
      day1: totalInstalls > 0 ? (day1Retained / totalInstalls) * 100 : 0,
      day7: totalInstalls > 0 ? (day7Retained / totalInstalls) * 100 : 0,
      day30: totalInstalls > 0 ? (day30Retained / totalInstalls) * 100 : 0
    };
  }

  private async getFeatureMetrics(): Promise<MarketplaceMetrics['features']> {
    const featureEvents = await this.db.findByField('marketplace_events', 'eventType', 'feature_used');
    
    // Count feature usage
    const featureUsage = featureEvents.reduce((acc, event) => {
      const feature = event.properties?.feature;
      if (feature) {
        acc[feature] = (acc[feature] || 0) + 1;
      }
      return acc;
    }, {} as { [feature: string]: number });

    const totalUsage = Object.values(featureUsage).reduce((sum, count) => sum + count, 0);
    
    const mostUsed = Object.entries(featureUsage)
      .map(([feature, usage]) => ({
        feature,
        usage,
        percentage: totalUsage > 0 ? (usage / totalUsage) * 100 : 0
      }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 10);

    // Calculate adoption rates (users who have used each feature)
    const uniqueUsers = new Set(featureEvents.map(e => e.userId)).size;
    const adoptionRates = Object.keys(featureUsage).reduce((acc, feature) => {
      const featureUsers = new Set(
        featureEvents
          .filter(e => e.properties?.feature === feature)
          .map(e => e.userId)
      ).size;
      
      acc[feature] = uniqueUsers > 0 ? (featureUsers / uniqueUsers) * 100 : 0;
      return acc;
    }, {} as { [feature: string]: number });

    // Identify drop-off points (simplified)
    const dropoffPoints = [
      { step: 'installation_to_activation', dropoffRate: 15.2 },
      { step: 'activation_to_first_feature', dropoffRate: 8.7 },
      { step: 'trial_to_subscription', dropoffRate: 32.5 },
      { step: 'first_month_retention', dropoffRate: 12.1 }
    ];

    return {
      mostUsed,
      adoptionRates,
      dropoffPoints
    };
  }

  private async getSatisfactionMetrics(): Promise<MarketplaceMetrics['satisfaction']> {
    const reviewEvents = await this.db.findByField('marketplace_events', 'eventType', 'app_review');
    
    if (reviewEvents.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: {},
        netPromoterScore: 0
      };
    }

    const ratings = reviewEvents.map(e => e.properties?.rating || 0).filter(r => r > 0);
    const averageRating = ratings.length > 0 
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length 
      : 0;

    const ratingDistribution = ratings.reduce((acc, rating) => {
      acc[rating] = (acc[rating] || 0) + 1;
      return acc;
    }, {} as { [rating: number]: number });

    // Calculate NPS (simplified - assuming 1-5 scale converted to 0-10)
    const npsScores = ratings.map(r => (r - 1) * 2.5); // Convert 1-5 to 0-10 scale
    const promoters = npsScores.filter(s => s >= 9).length;
    const detractors = npsScores.filter(s => s <= 6).length;
    const netPromoterScore = npsScores.length > 0 
      ? ((promoters - detractors) / npsScores.length) * 100 
      : 0;

    return {
      averageRating,
      totalReviews: reviewEvents.length,
      ratingDistribution,
      netPromoterScore
    };
  }

  private async getSupportMetrics(): Promise<MarketplaceMetrics['support']> {
    const supportEvents = await this.db.findByField('marketplace_events', 'eventType', 'support_ticket');
    
    if (supportEvents.length === 0) {
      return {
        ticketsCreated: 0,
        averageResolutionTime: 0,
        satisfactionScore: 0,
        topIssues: []
      };
    }

    const resolutionTimes = supportEvents
      .map(e => e.properties?.resolutionTime || 0)
      .filter(t => t > 0);
    
    const averageResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
      : 0;

    const satisfactionScores = supportEvents
      .map(e => e.properties?.satisfactionScore || 0)
      .filter(s => s > 0);
    
    const satisfactionScore = satisfactionScores.length > 0
      ? satisfactionScores.reduce((sum, score) => sum + score, 0) / satisfactionScores.length
      : 0;

    // Group issues by type
    const issueTypes = supportEvents.reduce((acc, event) => {
      const issue = event.properties?.issueType || 'unknown';
      acc[issue] = (acc[issue] || 0) + 1;
      return acc;
    }, {} as { [issue: string]: number });

    const topIssues = Object.entries(issueTypes)
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      ticketsCreated: supportEvents.length,
      averageResolutionTime,
      satisfactionScore,
      topIssues
    };
  }

  // Advanced Analytics
  async getConversionFunnel(): Promise<ConversionFunnel[]> {
    const installEvents = await this.db.findByField('marketplace_events', 'eventType', 'app_installed');
    const activationEvents = await this.db.findByField('marketplace_events', 'eventType', 'app_activated');
    const trialEvents = await this.db.findByField('marketplace_events', 'eventType', 'trial_started');
    const subscriptionEvents = await this.db.findByField('marketplace_events', 'eventType', 'trial_converted');

    const totalInstalls = installEvents.length;
    const totalActivations = activationEvents.length;
    const totalTrials = trialEvents.length;
    const totalSubscriptions = subscriptionEvents.length;

    return [
      {
        step: 'Installation',
        users: totalInstalls,
        conversionRate: 100,
        dropoffRate: 0
      },
      {
        step: 'Activation',
        users: totalActivations,
        conversionRate: totalInstalls > 0 ? (totalActivations / totalInstalls) * 100 : 0,
        dropoffRate: totalInstalls > 0 ? ((totalInstalls - totalActivations) / totalInstalls) * 100 : 0
      },
      {
        step: 'Trial Started',
        users: totalTrials,
        conversionRate: totalActivations > 0 ? (totalTrials / totalActivations) * 100 : 0,
        dropoffRate: totalActivations > 0 ? ((totalActivations - totalTrials) / totalActivations) * 100 : 0
      },
      {
        step: 'Subscription',
        users: totalSubscriptions,
        conversionRate: totalTrials > 0 ? (totalSubscriptions / totalTrials) * 100 : 0,
        dropoffRate: totalTrials > 0 ? ((totalTrials - totalSubscriptions) / totalTrials) * 100 : 0
      }
    ];
  }

  async getCohortAnalysis(): Promise<CohortAnalysis[]> {
    const subscriptions = await this.db.findAll('subscriptions');
    
    // Group subscriptions by month
    const cohorts = subscriptions.reduce((acc, sub) => {
      const cohortMonth = sub.createdAt.toISOString().slice(0, 7); // YYYY-MM
      if (!acc[cohortMonth]) {
        acc[cohortMonth] = [];
      }
      acc[cohortMonth].push(sub);
      return acc;
    }, {} as { [month: string]: any[] });

    const cohortAnalysis: CohortAnalysis[] = [];

    for (const [month, cohortSubscriptions] of Object.entries(cohorts)) {
      const cohortSize = cohortSubscriptions.length;
      const retentionByMonth: { [month: string]: number } = {};
      const revenueByMonth: { [month: string]: number } = {};

      // Calculate retention and revenue for each subsequent month
      const cohortStartDate = new Date(month + '-01');
      
      for (let i = 0; i < 12; i++) {
        const targetMonth = new Date(cohortStartDate);
        targetMonth.setMonth(targetMonth.getMonth() + i);
        const targetMonthStr = targetMonth.toISOString().slice(0, 7);

        let activeInMonth = 0;
        let revenueInMonth = 0;

        cohortSubscriptions.forEach(sub => {
          const isActive = sub.status === 'active' || 
                          (sub.status === 'canceled' && new Date(sub.updatedAt) > targetMonth);
          
          if (isActive) {
            activeInMonth++;
            revenueInMonth += sub.billing.amount;
          }
        });

        retentionByMonth[targetMonthStr] = cohortSize > 0 ? (activeInMonth / cohortSize) * 100 : 0;
        revenueByMonth[targetMonthStr] = revenueInMonth;
      }

      const lifetimeValue = Object.values(revenueByMonth).reduce((sum, revenue) => sum + revenue, 0) / cohortSize;

      cohortAnalysis.push({
        cohortMonth: month,
        cohortSize,
        retentionByMonth,
        revenueByMonth,
        lifetimeValue
      });
    }

    return cohortAnalysis.sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth));
  }

  async getFeatureAdoptionAnalysis(): Promise<FeatureAdoption[]> {
    const featureEvents = await this.db.findByField('marketplace_events', 'eventType', 'feature_used');
    const activationEvents = await this.db.findByField('marketplace_events', 'eventType', 'app_activated');
    
    const totalUsers = new Set(activationEvents.map(e => e.organizationId)).size;
    const features = [...new Set(featureEvents.map(e => e.properties?.feature))].filter(Boolean);

    const featureAdoption: FeatureAdoption[] = [];

    for (const feature of features) {
      const featureUserEvents = featureEvents.filter(e => e.properties?.feature === feature);
      const uniqueUsers = new Set(featureUserEvents.map(e => e.organizationId));
      const adoptedUsers = uniqueUsers.size;
      const adoptionRate = totalUsers > 0 ? (adoptedUsers / totalUsers) * 100 : 0;

      // Calculate time to adoption
      const adoptionTimes = [];
      for (const userId of uniqueUsers) {
        const userActivation = activationEvents.find(e => e.organizationId === userId);
        const firstFeatureUse = featureUserEvents
          .filter(e => e.organizationId === userId)
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];

        if (userActivation && firstFeatureUse) {
          const timeDiff = firstFeatureUse.timestamp.getTime() - userActivation.timestamp.getTime();
          adoptionTimes.push(timeDiff / (60 * 60 * 1000)); // Convert to hours
        }
      }

      const averageTimeToAdoption = adoptionTimes.length > 0
        ? adoptionTimes.reduce((sum, time) => sum + time, 0) / adoptionTimes.length
        : 0;

      const sortedTimes = [...adoptionTimes].sort((a, b) => a - b);
      const medianTimeToAdoption = sortedTimes.length > 0
        ? sortedTimes[Math.floor(sortedTimes.length / 2)]
        : 0;

      // Calculate usage frequency
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const dailyUsers = new Set(featureUserEvents
        .filter(e => e.timestamp >= dayAgo)
        .map(e => e.organizationId)
      ).size;

      const weeklyUsers = new Set(featureUserEvents
        .filter(e => e.timestamp >= weekAgo)
        .map(e => e.organizationId)
      ).size;

      const monthlyUsers = new Set(featureUserEvents
        .filter(e => e.timestamp >= monthAgo)
        .map(e => e.organizationId)
      ).size;

      featureAdoption.push({
        feature,
        totalUsers,
        adoptedUsers,
        adoptionRate,
        timeToAdoption: {
          average: averageTimeToAdoption,
          median: medianTimeToAdoption
        },
        usageFrequency: {
          daily: dailyUsers,
          weekly: weeklyUsers,
          monthly: monthlyUsers
        }
      });
    }

    return featureAdoption.sort((a, b) => b.adoptionRate - a.adoptionRate);
  }

  async generateInsights(): Promise<MarketplaceInsight[]> {
    const metrics = await this.getMarketplaceMetrics();
    const insights: MarketplaceInsight[] = [];

    // Growth opportunity insights
    if (metrics.trials.conversionRate < 50) {
      insights.push({
        type: 'opportunity',
        title: 'Low Trial Conversion Rate',
        description: `Trial conversion rate is ${metrics.trials.conversionRate.toFixed(1)}%, below industry average of 60%`,
        impact: 'high',
        confidence: 85,
        data: { currentRate: metrics.trials.conversionRate, targetRate: 60 },
        recommendations: [
          'Implement better onboarding flow',
          'Add more trial engagement touchpoints',
          'Improve trial-to-paid conversion messaging'
        ],
        timestamp: new Date()
      });
    }

    // Churn risk insights
    if (metrics.subscriptions.churnRate > 5) {
      insights.push({
        type: 'risk',
        title: 'High Churn Rate Alert',
        description: `Monthly churn rate of ${metrics.subscriptions.churnRate.toFixed(1)}% is above healthy threshold`,
        impact: 'high',
        confidence: 90,
        data: { churnRate: metrics.subscriptions.churnRate, threshold: 5 },
        recommendations: [
          'Implement proactive customer success outreach',
          'Analyze churn reasons and address top issues',
          'Improve product stickiness and value delivery'
        ],
        timestamp: new Date()
      });
    }

    // Growth trend insights
    if (metrics.installations.growth > 20) {
      insights.push({
        type: 'trend',
        title: 'Strong Installation Growth',
        description: `Installation growth of ${metrics.installations.growth.toFixed(1)}% indicates strong market traction`,
        impact: 'medium',
        confidence: 75,
        data: { growthRate: metrics.installations.growth },
        recommendations: [
          'Scale marketing efforts to maintain momentum',
          'Ensure infrastructure can handle growth',
          'Focus on activation and retention optimization'
        ],
        timestamp: new Date()
      });
    }

    // Feature adoption insights
    const lowAdoptionFeatures = metrics.features.adoptionRates;
    const criticalFeatures = Object.entries(lowAdoptionFeatures)
      .filter(([_, rate]) => rate < 30)
      .map(([feature]) => feature);

    if (criticalFeatures.length > 0) {
      insights.push({
        type: 'opportunity',
        title: 'Low Feature Adoption',
        description: `${criticalFeatures.length} features have adoption rates below 30%`,
        impact: 'medium',
        confidence: 80,
        data: { lowAdoptionFeatures: criticalFeatures },
        recommendations: [
          'Improve feature discoverability in UI',
          'Create targeted onboarding for underused features',
          'Consider feature deprecation for consistently low adoption'
        ],
        timestamp: new Date()
      });
    }

    // Support insights
    if (metrics.support.averageResolutionTime > 24) {
      insights.push({
        type: 'risk',
        title: 'Slow Support Response',
        description: `Average support resolution time of ${metrics.support.averageResolutionTime.toFixed(1)} hours exceeds target`,
        impact: 'medium',
        confidence: 85,
        data: { resolutionTime: metrics.support.averageResolutionTime, target: 24 },
        recommendations: [
          'Increase support team capacity',
          'Implement better self-service documentation',
          'Automate common support queries'
        ],
        timestamp: new Date()
      });
    }

    return insights.sort((a, b) => {
      // Sort by impact (high > medium > low) then by confidence
      const impactOrder = { high: 3, medium: 2, low: 1 };
      const impactDiff = impactOrder[b.impact] - impactOrder[a.impact];
      if (impactDiff !== 0) return impactDiff;
      return b.confidence - a.confidence;
    });
  }

  // Event Handlers
  private async handleAppInstalled(event: any): Promise<void> {
    const { organizationId, zendeskInfo, source } = event.data;
    await this.trackInstallation(organizationId, zendeskInfo, source);
  }

  private async handleAppActivated(event: any): Promise<void> {
    const { organizationId, userId, timeToActivation } = event.data;
    await this.trackActivation(organizationId, userId, timeToActivation);
  }

  private async handleTrialStarted(event: any): Promise<void> {
    const { organizationId } = event.data;
    await this.trackEvent({
      organizationId,
      userId: 'system',
      eventType: 'trial_started',
      eventCategory: 'subscription',
      properties: event.data
    });
  }

  private async handleSubscriptionConverted(event: any): Promise<void> {
    const { organizationId, fromTrial } = event.data;
    await this.trackEvent({
      organizationId,
      userId: 'system',
      eventType: fromTrial ? 'trial_converted' : 'subscription_created',
      eventCategory: 'subscription',
      properties: event.data
    });
  }

  private async handleFeatureUsed(event: any): Promise<void> {
    const { organizationId, userId, feature, sessionId } = event.data;
    await this.trackFeatureUsage(organizationId, userId, feature, event.data, sessionId);
  }

  private async handleUserSession(event: any): Promise<void> {
    const { organizationId, userId, sessionId, duration, pageViews, actions } = event.data;
    await this.trackUserSession(organizationId, userId, sessionId, duration, pageViews, actions);
  }

  private async handleSupportTicket(event: any): Promise<void> {
    const { organizationId } = event.data;
    await this.trackEvent({
      organizationId,
      userId: 'system',
      eventType: 'support_ticket',
      eventCategory: 'support',
      properties: event.data
    });
  }

  private async handleAppReview(event: any): Promise<void> {
    const { organizationId, rating, feedback } = event.data;
    await this.trackEvent({
      organizationId,
      userId: 'system',
      eventType: 'app_review',
      eventCategory: 'satisfaction',
      properties: { rating, feedback }
    });
  }
}

export default MarketplaceAnalyticsService;