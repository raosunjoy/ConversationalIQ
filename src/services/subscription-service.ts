/**
 * Subscription Service
 * Handles billing, subscription management, and trial management for marketplace customers
 */

import { DatabaseService } from './database';
import { EventProcessor } from '../events/event-processor';
import Stripe from 'stripe';

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'trial' | 'starter' | 'professional' | 'enterprise';
  pricePerAgent: number; // in cents
  billingCycle: 'monthly' | 'yearly';
  features: {
    maxAgents: number;
    conversationsPerMonth: number;
    analyticsRetention: number; // in days
    advancedFeatures: string[];
    supportLevel: 'email' | 'priority' | 'dedicated';
    customIntegrations: boolean;
    apiAccess: boolean;
    whiteLabeling: boolean;
  };
  trialDuration?: number; // in days
  stripeProductId?: string;
  stripePriceId?: string;
}

export interface Subscription {
  id: string;
  organizationId: string;
  customerId: string;
  planId: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  billingCycle: 'monthly' | 'yearly';
  agentCount: number;
  usage: {
    conversationsThisMonth: number;
    apiCallsThisMonth: number;
    storageUsedMB: number;
  };
  billing: {
    amount: number;
    currency: string;
    lastPaymentDate?: Date;
    nextPaymentDate: Date;
    paymentMethodId?: string;
  };
  metadata: {
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
    zendesk: {
      subdomain: string;
      accountId: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethod {
  id: string;
  customerId: string;
  type: 'card' | 'bank_account';
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
  stripePaymentMethodId: string;
  createdAt: Date;
}

export interface Invoice {
  id: string;
  subscriptionId: string;
  customerId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  paidAt?: Date;
  stripeInvoiceId?: string;
  downloadUrl?: string;
  createdAt: Date;
}

export interface UsageMetrics {
  subscriptionId: string;
  date: Date;
  conversations: number;
  apiCalls: number;
  agentsActive: number;
  storageUsedMB: number;
  sentimentAnalyses: number;
  responsesSuggested: number;
  escalationsPrevented: number;
}

export class SubscriptionService {
  private db: DatabaseService;
  private eventProcessor: EventProcessor;
  private stripe: Stripe;
  private plans: Map<string, SubscriptionPlan>;

  constructor() {
    this.db = new DatabaseService();
    this.eventProcessor = new EventProcessor();
    
    // Initialize Stripe
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }
    
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16'
    });

    this.plans = new Map();
    this.initializePlans();
    this.setupEventListeners();
  }

  private initializePlans(): void {
    const plans: SubscriptionPlan[] = [
      {
        id: 'trial',
        name: 'Free Trial',
        tier: 'trial',
        pricePerAgent: 0,
        billingCycle: 'monthly',
        trialDuration: 30,
        features: {
          maxAgents: 5,
          conversationsPerMonth: 1000,
          analyticsRetention: 30,
          advancedFeatures: ['sentiment-analysis', 'response-suggestions'],
          supportLevel: 'email',
          customIntegrations: false,
          apiAccess: false,
          whiteLabeling: false
        }
      },
      {
        id: 'starter_monthly',
        name: 'Starter Monthly',
        tier: 'starter',
        pricePerAgent: 1900, // $19.00
        billingCycle: 'monthly',
        features: {
          maxAgents: 25,
          conversationsPerMonth: 5000,
          analyticsRetention: 90,
          advancedFeatures: ['sentiment-analysis', 'response-suggestions', 'basic-analytics'],
          supportLevel: 'email',
          customIntegrations: false,
          apiAccess: false,
          whiteLabeling: false
        }
      },
      {
        id: 'professional_monthly',
        name: 'Professional Monthly',
        tier: 'professional',
        pricePerAgent: 3900, // $39.00
        billingCycle: 'monthly',
        features: {
          maxAgents: 100,
          conversationsPerMonth: 25000,
          analyticsRetention: 180,
          advancedFeatures: ['sentiment-analysis', 'response-suggestions', 'advanced-analytics', 'escalation-prevention'],
          supportLevel: 'priority',
          customIntegrations: true,
          apiAccess: true,
          whiteLabeling: false
        }
      },
      {
        id: 'enterprise_monthly',
        name: 'Enterprise Monthly',
        tier: 'enterprise',
        pricePerAgent: 5900, // $59.00
        billingCycle: 'monthly',
        features: {
          maxAgents: -1, // unlimited
          conversationsPerMonth: -1, // unlimited
          analyticsRetention: 365,
          advancedFeatures: ['sentiment-analysis', 'response-suggestions', 'advanced-analytics', 'escalation-prevention', 'custom-models', 'advanced-security'],
          supportLevel: 'dedicated',
          customIntegrations: true,
          apiAccess: true,
          whiteLabeling: true
        }
      }
    ];

    plans.forEach(plan => this.plans.set(plan.id, plan));
  }

  private setupEventListeners(): void {
    this.eventProcessor.on('billing.subscription.created', this.handleSubscriptionCreated.bind(this));
    this.eventProcessor.on('billing.subscription.updated', this.handleSubscriptionUpdated.bind(this));
    this.eventProcessor.on('billing.subscription.canceled', this.handleSubscriptionCanceled.bind(this));
    this.eventProcessor.on('billing.payment.succeeded', this.handlePaymentSucceeded.bind(this));
    this.eventProcessor.on('billing.payment.failed', this.handlePaymentFailed.bind(this));
    this.eventProcessor.on('usage.conversation.processed', this.handleUsageTracking.bind(this));
  }

  // Plan Management
  getAvailablePlans(): SubscriptionPlan[] {
    return Array.from(this.plans.values()).filter(plan => plan.tier !== 'trial');
  }

  getPlan(planId: string): SubscriptionPlan | undefined {
    return this.plans.get(planId);
  }

  // Trial Management
  async startTrial(organizationId: string, zendesk: { subdomain: string; accountId: string }): Promise<string> {
    const trialPlan = this.plans.get('trial');
    if (!trialPlan) {
      throw new Error('Trial plan not found');
    }

    const trialStart = new Date();
    const trialEnd = new Date(trialStart.getTime() + (trialPlan.trialDuration! * 24 * 60 * 60 * 1000));

    const subscription: Subscription = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      organizationId,
      customerId: `customer_${organizationId}`,
      planId: 'trial',
      status: 'trialing',
      currentPeriodStart: trialStart,
      currentPeriodEnd: trialEnd,
      trialStart,
      trialEnd,
      cancelAtPeriodEnd: false,
      billingCycle: 'monthly',
      agentCount: 1,
      usage: {
        conversationsThisMonth: 0,
        apiCallsThisMonth: 0,
        storageUsedMB: 0
      },
      billing: {
        amount: 0,
        currency: 'usd',
        nextPaymentDate: trialEnd
      },
      metadata: {
        zendesk
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const subscriptionId = await this.db.createRecord('subscriptions', subscription);
    
    await this.eventProcessor.publish('billing.trial.started', {
      subscriptionId,
      organizationId,
      trialEnd
    });

    return subscriptionId;
  }

  async extendTrial(subscriptionId: string, days: number): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription || subscription.status !== 'trialing') {
      throw new Error('Invalid trial subscription');
    }

    const newTrialEnd = new Date(subscription.trialEnd!.getTime() + (days * 24 * 60 * 60 * 1000));
    
    await this.db.updateRecord('subscriptions', subscriptionId, {
      trialEnd: newTrialEnd,
      currentPeriodEnd: newTrialEnd,
      updatedAt: new Date()
    });

    await this.eventProcessor.publish('billing.trial.extended', {
      subscriptionId,
      originalEnd: subscription.trialEnd,
      newEnd: newTrialEnd,
      daysExtended: days
    });
  }

  async convertTrialToSubscription(subscriptionId: string, planId: string, paymentMethodId: string, agentCount: number): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    const plan = this.getPlan(planId);

    if (!subscription || !plan) {
      throw new Error('Invalid subscription or plan');
    }

    // Create Stripe customer and subscription
    const stripeCustomer = await this.stripe.customers.create({
      metadata: {
        organizationId: subscription.organizationId,
        zendeskSubdomain: subscription.metadata.zendesk.subdomain
      }
    });

    const monthlyAmount = (plan.pricePerAgent * agentCount);
    const stripeSubscription = await this.stripe.subscriptions.create({
      customer: stripeCustomer.id,
      items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${plan.name} - ${agentCount} agents`
          },
          unit_amount: plan.pricePerAgent,
          recurring: {
            interval: plan.billingCycle === 'yearly' ? 'year' : 'month'
          }
        },
        quantity: agentCount
      }],
      default_payment_method: paymentMethodId
    });

    const now = new Date();
    const nextBilling = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    await this.db.updateRecord('subscriptions', subscriptionId, {
      planId,
      status: 'active',
      agentCount,
      currentPeriodStart: now,
      currentPeriodEnd: nextBilling,
      billing: {
        amount: monthlyAmount,
        currency: 'usd',
        nextPaymentDate: nextBilling,
        paymentMethodId
      },
      metadata: {
        ...subscription.metadata,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeCustomer.id
      },
      updatedAt: now
    });

    await this.eventProcessor.publish('billing.subscription.converted', {
      subscriptionId,
      fromTrial: true,
      planId,
      agentCount,
      amount: monthlyAmount
    });
  }

  // Subscription Management
  async createSubscription(
    organizationId: string,
    planId: string,
    agentCount: number,
    paymentMethodId: string,
    zendesk: { subdomain: string; accountId: string }
  ): Promise<string> {
    const plan = this.getPlan(planId);
    if (!plan) {
      throw new Error('Invalid plan');
    }

    // Create Stripe customer and subscription
    const stripeCustomer = await this.stripe.customers.create({
      metadata: {
        organizationId,
        zendeskSubdomain: zendesk.subdomain
      }
    });

    const monthlyAmount = plan.pricePerAgent * agentCount;
    const stripeSubscription = await this.stripe.subscriptions.create({
      customer: stripeCustomer.id,
      items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${plan.name} - ${agentCount} agents`
          },
          unit_amount: plan.pricePerAgent,
          recurring: {
            interval: plan.billingCycle === 'yearly' ? 'year' : 'month'
          }
        },
        quantity: agentCount
      }],
      default_payment_method: paymentMethodId
    });

    const now = new Date();
    const nextBilling = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const subscription: Subscription = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      organizationId,
      customerId: `customer_${organizationId}`,
      planId,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: nextBilling,
      cancelAtPeriodEnd: false,
      billingCycle: plan.billingCycle,
      agentCount,
      usage: {
        conversationsThisMonth: 0,
        apiCallsThisMonth: 0,
        storageUsedMB: 0
      },
      billing: {
        amount: monthlyAmount,
        currency: 'usd',
        nextPaymentDate: nextBilling,
        paymentMethodId
      },
      metadata: {
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeCustomer.id,
        zendesk
      },
      createdAt: now,
      updatedAt: now
    };

    const subscriptionId = await this.db.createRecord('subscriptions', subscription);
    
    await this.eventProcessor.publish('billing.subscription.created', {
      subscriptionId,
      organizationId,
      planId,
      agentCount,
      amount: monthlyAmount
    });

    return subscriptionId;
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    return await this.db.findByField('subscriptions', 'id', subscriptionId);
  }

  async getOrganizationSubscription(organizationId: string): Promise<Subscription | null> {
    return await this.db.findByField('subscriptions', 'organizationId', organizationId);
  }

  async updateSubscription(subscriptionId: string, updates: Partial<Subscription>): Promise<void> {
    await this.db.updateRecord('subscriptions', subscriptionId, {
      ...updates,
      updatedAt: new Date()
    });

    await this.eventProcessor.publish('billing.subscription.updated', {
      subscriptionId,
      updates
    });
  }

  async changeSubscriptionPlan(subscriptionId: string, newPlanId: string, newAgentCount?: number): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    const newPlan = this.getPlan(newPlanId);

    if (!subscription || !newPlan) {
      throw new Error('Invalid subscription or plan');
    }

    const agentCount = newAgentCount || subscription.agentCount;
    const newAmount = newPlan.pricePerAgent * agentCount;

    // Update Stripe subscription if exists
    if (subscription.metadata.stripeSubscriptionId) {
      await this.stripe.subscriptions.update(subscription.metadata.stripeSubscriptionId, {
        items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${newPlan.name} - ${agentCount} agents`
            },
            unit_amount: newPlan.pricePerAgent,
            recurring: {
              interval: newPlan.billingCycle === 'yearly' ? 'year' : 'month'
            }
          },
          quantity: agentCount
        }]
      });
    }

    await this.updateSubscription(subscriptionId, {
      planId: newPlanId,
      agentCount,
      billingCycle: newPlan.billingCycle,
      billing: {
        ...subscription.billing,
        amount: newAmount
      }
    });

    await this.eventProcessor.publish('billing.subscription.plan_changed', {
      subscriptionId,
      oldPlanId: subscription.planId,
      newPlanId,
      oldAgentCount: subscription.agentCount,
      newAgentCount: agentCount,
      oldAmount: subscription.billing.amount,
      newAmount
    });
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Cancel Stripe subscription if exists
    if (subscription.metadata.stripeSubscriptionId) {
      await this.stripe.subscriptions.update(subscription.metadata.stripeSubscriptionId, {
        cancel_at_period_end: cancelAtPeriodEnd
      });
    }

    const updates: Partial<Subscription> = {
      cancelAtPeriodEnd,
      status: cancelAtPeriodEnd ? subscription.status : 'canceled'
    };

    await this.updateSubscription(subscriptionId, updates);

    await this.eventProcessor.publish('billing.subscription.canceled', {
      subscriptionId,
      cancelAtPeriodEnd,
      effectiveDate: cancelAtPeriodEnd ? subscription.currentPeriodEnd : new Date()
    });
  }

  // Payment Method Management
  async addPaymentMethod(customerId: string, stripePaymentMethodId: string): Promise<string> {
    const stripePaymentMethod = await this.stripe.paymentMethods.retrieve(stripePaymentMethodId);
    
    const paymentMethod: PaymentMethod = {
      id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customerId,
      type: stripePaymentMethod.type as 'card',
      card: stripePaymentMethod.card ? {
        brand: stripePaymentMethod.card.brand,
        last4: stripePaymentMethod.card.last4,
        expMonth: stripePaymentMethod.card.exp_month,
        expYear: stripePaymentMethod.card.exp_year
      } : undefined,
      isDefault: false,
      stripePaymentMethodId,
      createdAt: new Date()
    };

    const paymentMethodId = await this.db.createRecord('payment_methods', paymentMethod);
    
    await this.eventProcessor.publish('billing.payment_method.added', {
      paymentMethodId,
      customerId
    });

    return paymentMethodId;
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    // Unset current default
    const currentMethods = await this.db.findByField('payment_methods', 'customerId', customerId);
    for (const method of currentMethods) {
      if (method.isDefault) {
        await this.db.updateRecord('payment_methods', method.id, { isDefault: false });
      }
    }

    // Set new default
    await this.db.updateRecord('payment_methods', paymentMethodId, { isDefault: true });

    await this.eventProcessor.publish('billing.payment_method.default_changed', {
      customerId,
      paymentMethodId
    });
  }

  // Usage Tracking
  async trackUsage(subscriptionId: string, usage: Partial<UsageMetrics>): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) return;

    const usageRecord: UsageMetrics = {
      subscriptionId,
      date: new Date(),
      conversations: usage.conversations || 0,
      apiCalls: usage.apiCalls || 0,
      agentsActive: usage.agentsActive || 0,
      storageUsedMB: usage.storageUsedMB || 0,
      sentimentAnalyses: usage.sentimentAnalyses || 0,
      responsesSuggested: usage.responsesSuggested || 0,
      escalationsPrevented: usage.escalationsPrevented || 0
    };

    await this.db.createRecord('usage_metrics', usageRecord);

    // Update subscription usage totals
    const updatedUsage = {
      ...subscription.usage,
      conversationsThisMonth: subscription.usage.conversationsThisMonth + (usage.conversations || 0),
      apiCallsThisMonth: subscription.usage.apiCallsThisMonth + (usage.apiCalls || 0),
      storageUsedMB: Math.max(subscription.usage.storageUsedMB, usage.storageUsedMB || 0)
    };

    await this.updateSubscription(subscriptionId, { usage: updatedUsage });

    await this.checkUsageLimits(subscriptionId);
  }

  private async checkUsageLimits(subscriptionId: string): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    const plan = subscription ? this.getPlan(subscription.planId) : null;

    if (!subscription || !plan) return;

    const warnings = [];

    // Check conversation limits
    if (plan.features.conversationsPerMonth > 0 && 
        subscription.usage.conversationsThisMonth > plan.features.conversationsPerMonth * 0.8) {
      warnings.push({
        type: 'conversation_limit',
        current: subscription.usage.conversationsThisMonth,
        limit: plan.features.conversationsPerMonth,
        percentage: (subscription.usage.conversationsThisMonth / plan.features.conversationsPerMonth) * 100
      });
    }

    // Check agent limits
    if (plan.features.maxAgents > 0 && subscription.agentCount > plan.features.maxAgents) {
      warnings.push({
        type: 'agent_limit',
        current: subscription.agentCount,
        limit: plan.features.maxAgents
      });
    }

    if (warnings.length > 0) {
      await this.eventProcessor.publish('billing.usage.warning', {
        subscriptionId,
        warnings
      });
    }
  }

  // Invoice Management
  async getInvoices(subscriptionId: string): Promise<Invoice[]> {
    return await this.db.findByField('invoices', 'subscriptionId', subscriptionId);
  }

  async generateInvoice(subscriptionId: string): Promise<string> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const invoice: Invoice = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      subscriptionId,
      customerId: subscription.customerId,
      amount: subscription.billing.amount,
      currency: subscription.billing.currency,
      status: 'open',
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      dueDate: subscription.billing.nextPaymentDate,
      createdAt: new Date()
    };

    const invoiceId = await this.db.createRecord('invoices', invoice);

    await this.eventProcessor.publish('billing.invoice.generated', {
      invoiceId,
      subscriptionId,
      amount: invoice.amount
    });

    return invoiceId;
  }

  // Analytics and Reporting
  async getSubscriptionMetrics(): Promise<any> {
    const subscriptions = await this.db.findAll('subscriptions');
    
    const metrics = {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: subscriptions.filter(s => s.status === 'active').length,
      trialSubscriptions: subscriptions.filter(s => s.status === 'trialing').length,
      monthlyRevenue: subscriptions
        .filter(s => s.status === 'active' && s.billingCycle === 'monthly')
        .reduce((sum, s) => sum + s.billing.amount, 0),
      averageRevenuePerUser: 0,
      churnRate: 0,
      conversionRate: 0
    };

    if (metrics.activeSubscriptions > 0) {
      metrics.averageRevenuePerUser = metrics.monthlyRevenue / metrics.activeSubscriptions;
    }

    // Calculate churn and conversion rates (simplified)
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const lastMonth = new Date(thisMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const canceledThisMonth = subscriptions.filter(s => 
      s.status === 'canceled' && s.updatedAt >= thisMonth
    ).length;

    const startOfMonthActive = subscriptions.filter(s => 
      s.status === 'active' && s.createdAt < thisMonth
    ).length;

    metrics.churnRate = startOfMonthActive > 0 ? (canceledThisMonth / startOfMonthActive) * 100 : 0;

    const trialsThisMonth = subscriptions.filter(s => 
      s.status === 'trialing' && s.createdAt >= thisMonth
    ).length;

    const conversionsThisMonth = subscriptions.filter(s => 
      s.status === 'active' && s.createdAt >= thisMonth && s.trialStart
    ).length;

    metrics.conversionRate = trialsThisMonth > 0 ? (conversionsThisMonth / trialsThisMonth) * 100 : 0;

    return metrics;
  }

  async getUsageAnalytics(subscriptionId: string): Promise<any> {
    const usageRecords = await this.db.findByField('usage_metrics', 'subscriptionId', subscriptionId);
    
    // Group by date and calculate totals
    const dailyUsage = usageRecords.reduce((acc, record) => {
      const date = record.date.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          conversations: 0,
          apiCalls: 0,
          agentsActive: 0,
          sentimentAnalyses: 0,
          responsesSuggested: 0,
          escalationsPrevented: 0
        };
      }
      
      acc[date].conversations += record.conversations;
      acc[date].apiCalls += record.apiCalls;
      acc[date].agentsActive = Math.max(acc[date].agentsActive, record.agentsActive);
      acc[date].sentimentAnalyses += record.sentimentAnalyses;
      acc[date].responsesSuggested += record.responsesSuggested;
      acc[date].escalationsPrevented += record.escalationsPrevented;
      
      return acc;
    }, {} as any);

    return {
      dailyUsage: Object.values(dailyUsage),
      totalUsage: usageRecords.reduce((acc, record) => ({
        conversations: acc.conversations + record.conversations,
        apiCalls: acc.apiCalls + record.apiCalls,
        sentimentAnalyses: acc.sentimentAnalyses + record.sentimentAnalyses,
        responsesSuggested: acc.responsesSuggested + record.responsesSuggested,
        escalationsPrevented: acc.escalationsPrevented + record.escalationsPrevented
      }), {
        conversations: 0,
        apiCalls: 0,
        sentimentAnalyses: 0,
        responsesSuggested: 0,
        escalationsPrevented: 0
      })
    };
  }

  // Event Handlers
  private async handleSubscriptionCreated(event: any): Promise<void> {
    const { subscriptionId, organizationId } = event.data;
    
    // Send welcome email
    await this.eventProcessor.publish('notification.send', {
      type: 'subscription_created',
      organizationId,
      data: { subscriptionId }
    });
  }

  private async handleSubscriptionUpdated(event: any): Promise<void> {
    const { subscriptionId, updates } = event.data;
    
    // Log update for auditing
    await this.eventProcessor.publish('audit.log', {
      action: 'subscription_updated',
      subscriptionId,
      changes: updates,
      timestamp: new Date()
    });
  }

  private async handleSubscriptionCanceled(event: any): Promise<void> {
    const { subscriptionId, cancelAtPeriodEnd } = event.data;
    
    // Send cancellation confirmation
    await this.eventProcessor.publish('notification.send', {
      type: 'subscription_canceled',
      subscriptionId,
      data: { cancelAtPeriodEnd }
    });
  }

  private async handlePaymentSucceeded(event: any): Promise<void> {
    const { subscriptionId, amount } = event.data;
    
    // Update subscription status and extend period
    const subscription = await this.getSubscription(subscriptionId);
    if (subscription) {
      const nextPeriodEnd = new Date(subscription.currentPeriodEnd);
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
      
      await this.updateSubscription(subscriptionId, {
        status: 'active',
        currentPeriodStart: subscription.currentPeriodEnd,
        currentPeriodEnd: nextPeriodEnd,
        billing: {
          ...subscription.billing,
          lastPaymentDate: new Date(),
          nextPaymentDate: nextPeriodEnd
        }
      });
    }
  }

  private async handlePaymentFailed(event: any): Promise<void> {
    const { subscriptionId, error } = event.data;
    
    await this.updateSubscription(subscriptionId, {
      status: 'past_due'
    });

    // Send payment failed notification
    await this.eventProcessor.publish('notification.send', {
      type: 'payment_failed',
      subscriptionId,
      data: { error }
    });
  }

  private async handleUsageTracking(event: any): Promise<void> {
    const { subscriptionId, type, count } = event.data;
    
    const usageUpdate: Partial<UsageMetrics> = {};
    
    switch (type) {
      case 'conversation':
        usageUpdate.conversations = count;
        usageUpdate.sentimentAnalyses = count; // Assume each conversation gets sentiment analysis
        break;
      case 'api_call':
        usageUpdate.apiCalls = count;
        break;
      case 'response_suggestion':
        usageUpdate.responsesSuggested = count;
        break;
      case 'escalation_prevention':
        usageUpdate.escalationsPrevented = count;
        break;
    }

    await this.trackUsage(subscriptionId, usageUpdate);
  }
}

export default SubscriptionService;