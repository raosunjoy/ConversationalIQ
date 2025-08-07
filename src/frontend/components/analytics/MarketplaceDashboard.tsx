/**
 * Marketplace Analytics Dashboard
 * Comprehensive analytics dashboard for marketplace performance and business intelligence
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@zendeskgarden/react-buttons';
import { Badge } from '@zendeskgarden/react-badges';
import { Alert } from '@zendeskgarden/react-notifications';
import { Select, Field, Label } from '@zendeskgarden/react-forms';
import { Tabs, TabList, Tab, TabPanel } from '@zendeskgarden/react-tabs';
import { Progress } from '@zendeskgarden/react-loaders';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts';

interface MarketplaceMetrics {
  installations: {
    total: number;
    thisMonth: number;
    growth: number;
    bySource: { [source: string]: number };
  };
  activations: {
    total: number;
    thisMonth: number;
    rate: number;
    timeToActivation: {
      average: number;
      median: number;
      p90: number;
    };
  };
  trials: {
    started: number;
    active: number;
    converted: number;
    conversionRate: number;
    averageTrialDuration: number;
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
    averageSessionDuration: number;
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
    averageResolutionTime: number;
    satisfactionScore: number;
    topIssues: Array<{ issue: string; count: number }>;
  };
}

interface ConversionFunnel {
  step: string;
  users: number;
  conversionRate: number;
  dropoffRate: number;
}

interface CohortData {
  cohortMonth: string;
  cohortSize: number;
  retentionByMonth: { [month: string]: number };
  revenueByMonth: { [month: string]: number };
  lifetimeValue: number;
}

interface MarketplaceInsight {
  type: 'opportunity' | 'risk' | 'trend' | 'anomaly';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  confidence: number;
  recommendations?: string[];
}

interface MarketplaceDashboardProps {
  isAdmin: boolean;
}

const MarketplaceDashboard: React.FC<MarketplaceDashboardProps> = ({ isAdmin }) => {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [metrics, setMetrics] = useState<MarketplaceMetrics | null>(null);
  const [conversionFunnel, setConversionFunnel] = useState<ConversionFunnel[]>([]);
  const [cohortData, setCohortData] = useState<CohortData[]>([]);
  const [insights, setInsights] = useState<MarketplaceInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');

  useEffect(() => {
    if (isAdmin) {
      loadAnalyticsData();
    }
  }, [isAdmin, dateRange]);

  const loadAnalyticsData = async (): Promise<void> => {
    try {
      setLoading(true);
      
      const [metricsData, funnelData, cohortData, insightsData] = await Promise.all([
        fetchMarketplaceMetrics(),
        fetchConversionFunnel(),
        fetchCohortAnalysis(),
        fetchInsights()
      ]);

      setMetrics(metricsData);
      setConversionFunnel(funnelData);
      setCohortData(cohortData);
      setInsights(insightsData);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMarketplaceMetrics = async (): Promise<MarketplaceMetrics> => {
    // Simulate API call
    return {
      installations: {
        total: 12500,
        thisMonth: 1850,
        growth: 23.5,
        bySource: {
          'zendesk-marketplace': 8500,
          'direct': 2100,
          'referral': 1200,
          'other': 700
        }
      },
      activations: {
        total: 10200,
        thisMonth: 1520,
        rate: 81.6,
        timeToActivation: {
          average: 3.2,
          median: 1.8,
          p90: 8.5
        }
      },
      trials: {
        started: 9100,
        active: 420,
        converted: 6200,
        conversionRate: 68.1,
        averageTrialDuration: 22,
        extensionRequests: 1240
      },
      subscriptions: {
        active: 6200,
        byTier: {
          'starter': 2800,
          'professional': 2650,
          'enterprise': 750
        },
        monthlyRevenue: 2150000, // $21,500 in cents
        averageRevenuePerUser: 347,
        churnRate: 3.2,
        lifetimeValue: 8540
      },
      usage: {
        dailyActiveUsers: 4200,
        monthlyActiveUsers: 5800,
        sessionsPerUser: 12.3,
        averageSessionDuration: 18.7,
        retentionRates: {
          day1: 78.5,
          day7: 65.2,
          day30: 52.8
        }
      },
      features: {
        mostUsed: [
          { feature: 'Sentiment Analysis', usage: 45000, percentage: 32.1 },
          { feature: 'Response Suggestions', usage: 38000, percentage: 27.2 },
          { feature: 'Analytics Dashboard', usage: 28000, percentage: 20.0 },
          { feature: 'Escalation Prevention', usage: 18000, percentage: 12.9 },
          { feature: 'Custom Reports', usage: 11000, percentage: 7.8 }
        ],
        adoptionRates: {
          'Sentiment Analysis': 92.3,
          'Response Suggestions': 87.1,
          'Analytics Dashboard': 74.5,
          'Escalation Prevention': 58.2,
          'Custom Reports': 41.7,
          'API Access': 28.9
        },
        dropoffPoints: [
          { step: 'installation_to_activation', dropoffRate: 18.4 },
          { step: 'activation_to_first_feature', dropoffRate: 12.3 },
          { step: 'trial_to_subscription', dropoffRate: 31.9 },
          { step: 'first_month_retention', dropoffRate: 21.5 }
        ]
      },
      satisfaction: {
        averageRating: 4.6,
        totalReviews: 890,
        ratingDistribution: {
          5: 520,
          4: 280,
          3: 65,
          2: 15,
          1: 10
        },
        netPromoterScore: 72
      },
      support: {
        ticketsCreated: 1240,
        averageResolutionTime: 18.5,
        satisfactionScore: 4.3,
        topIssues: [
          { issue: 'Integration Setup', count: 280 },
          { issue: 'Billing Questions', count: 220 },
          { issue: 'Feature Requests', count: 180 },
          { issue: 'Bug Reports', count: 150 },
          { issue: 'Performance Issues', count: 120 }
        ]
      }
    };
  };

  const fetchConversionFunnel = async (): Promise<ConversionFunnel[]> => {
    return [
      { step: 'Installation', users: 12500, conversionRate: 100, dropoffRate: 0 },
      { step: 'Activation', users: 10200, conversionRate: 81.6, dropoffRate: 18.4 },
      { step: 'Trial Started', users: 9100, conversionRate: 89.2, dropoffRate: 10.8 },
      { step: 'Subscription', users: 6200, conversionRate: 68.1, dropoffRate: 31.9 }
    ];
  };

  const fetchCohortAnalysis = async (): Promise<CohortData[]> => {
    return [
      {
        cohortMonth: '2023-06',
        cohortSize: 120,
        retentionByMonth: { '2023-06': 100, '2023-07': 85, '2023-08': 78, '2023-09': 72 },
        revenueByMonth: { '2023-06': 12000, '2023-07': 18500, '2023-08': 22000, '2023-09': 24500 },
        lifetimeValue: 8200
      },
      {
        cohortMonth: '2023-07',
        cohortSize: 180,
        retentionByMonth: { '2023-07': 100, '2023-08': 88, '2023-09': 82, '2023-10': 78 },
        revenueByMonth: { '2023-07': 18000, '2023-08': 28000, '2023-09': 32000, '2023-10': 35000 },
        lifetimeValue: 8900
      }
    ];
  };

  const fetchInsights = async (): Promise<MarketplaceInsight[]> => {
    return [
      {
        type: 'opportunity',
        title: 'Strong Growth Momentum',
        description: 'Installation growth of 23.5% this month indicates strong market traction',
        impact: 'high',
        confidence: 85,
        recommendations: [
          'Scale marketing efforts to maintain momentum',
          'Ensure infrastructure can handle growth',
          'Focus on activation optimization'
        ]
      },
      {
        type: 'risk',
        title: 'API Feature Low Adoption',
        description: 'API Access feature has only 28.9% adoption rate among subscribers',
        impact: 'medium',
        confidence: 78,
        recommendations: [
          'Improve API documentation and examples',
          'Create developer-focused onboarding flow',
          'Consider feature placement and discoverability'
        ]
      },
      {
        type: 'trend',
        title: 'Enterprise Tier Growth',
        description: 'Enterprise subscriptions growing 45% faster than other tiers',
        impact: 'high',
        confidence: 92,
        recommendations: [
          'Expand enterprise sales team',
          'Develop more enterprise-specific features',
          'Create enterprise customer success program'
        ]
      }
    ];
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount / 100);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const getMetricTrend = (value: number): { color: string; icon: string } => {
    if (value > 0) return { color: 'text-green-600', icon: '↗' };
    if (value < 0) return { color: 'text-red-600', icon: '↘' };
    return { color: 'text-gray-600', icon: '→' };
  };

  const getInsightBadgeType = (type: string): 'positive' | 'warning' | 'danger' | 'neutral' => {
    switch (type) {
      case 'opportunity': case 'trend': return 'positive';
      case 'risk': return 'danger';
      case 'anomaly': return 'warning';
      default: return 'neutral';
    }
  };

  const getImpactBadgeType = (impact: string): 'positive' | 'warning' | 'danger' => {
    switch (impact) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'positive';
      default: return 'positive';
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert type="warning">
          Access denied. Administrator privileges required to view marketplace analytics.
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <Progress size="large" />
          <p className="mt-4 text-gray-600">Loading marketplace analytics...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert type="error">
          Failed to load analytics data. Please try again.
        </Alert>
      </div>
    );
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketplace Analytics</h1>
          <p className="text-gray-600 mt-1">Comprehensive performance metrics and business intelligence</p>
        </div>
        <div className="flex space-x-3">
          <Field>
            <Label isHidden>Date Range</Label>
            <Select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </Select>
          </Field>
          <Button onClick={loadAnalyticsData}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.subscriptions.monthlyRevenue)}</p>
            </div>
            <div className="text-blue-500">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <span className={`text-sm ${getMetricTrend(15.2).color}`}>
              {getMetricTrend(15.2).icon} 15.2% from last month
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Subscriptions</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.subscriptions.active.toLocaleString()}</p>
            </div>
            <div className="text-green-500">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <span className={`text-sm ${getMetricTrend(8.7).color}`}>
              {getMetricTrend(8.7).icon} 8.7% from last month
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Trial Conversion</p>
              <p className="text-2xl font-bold text-gray-900">{formatPercentage(metrics.trials.conversionRate)}</p>
            </div>
            <div className="text-purple-500">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <span className={`text-sm ${getMetricTrend(3.4).color}`}>
              {getMetricTrend(3.4).icon} 3.4% from last month
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Customer Satisfaction</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.satisfaction.averageRating.toFixed(1)}/5</p>
            </div>
            <div className="text-yellow-500">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-gray-600">
              Based on {metrics.satisfaction.totalReviews} reviews
            </span>
          </div>
        </div>
      </div>

      {/* Insights Panel */}
      {insights.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4">Key Insights</h3>
          <div className="space-y-4">
            {insights.slice(0, 3).map((insight, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge type={getInsightBadgeType(insight.type)}>
                        {insight.type}
                      </Badge>
                      <Badge type={getImpactBadgeType(insight.impact)}>
                        {insight.impact} impact
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {insight.confidence}% confidence
                      </span>
                    </div>
                    <h4 className="font-medium text-gray-900">{insight.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                    {insight.recommendations && insight.recommendations.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700">Recommendations:</p>
                        <ul className="text-sm text-gray-600 mt-1 space-y-1">
                          {insight.recommendations.slice(0, 2).map((rec, i) => (
                            <li key={i}>• {rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs selectedItem={selectedTab} onChange={setSelectedTab}>
        <TabList>
          <Tab item="overview">Overview</Tab>
          <Tab item="funnel">Conversion Funnel</Tab>
          <Tab item="features">Feature Analytics</Tab>
          <Tab item="cohorts">Cohort Analysis</Tab>
          <Tab item="satisfaction">Satisfaction</Tab>
        </TabList>

        <TabPanel item="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Installation Sources */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-semibold mb-4">Installation Sources</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Object.entries(metrics.installations.bySource).map(([source, count]) => ({
                      name: source,
                      value: count
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {Object.keys(metrics.installations.bySource).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Subscription Tiers */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-semibold mb-4">Subscription Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={Object.entries(metrics.subscriptions.byTier).map(([tier, count]) => ({
                    tier,
                    subscriptions: count
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tier" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="subscriptions" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Retention Rates */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-semibold mb-4">User Retention</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Day 1 Retention</span>
                    <span>{formatPercentage(metrics.usage.retentionRates.day1)}</span>
                  </div>
                  <Progress value={metrics.usage.retentionRates.day1} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Day 7 Retention</span>
                    <span>{formatPercentage(metrics.usage.retentionRates.day7)}</span>
                  </div>
                  <Progress value={metrics.usage.retentionRates.day7} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Day 30 Retention</span>
                    <span>{formatPercentage(metrics.usage.retentionRates.day30)}</span>
                  </div>
                  <Progress value={metrics.usage.retentionRates.day30} />
                </div>
              </div>
            </div>

            {/* Support Metrics */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-semibold mb-4">Support Performance</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Tickets Created:</span>
                  <span className="font-medium">{metrics.support.ticketsCreated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Avg Resolution Time:</span>
                  <span className="font-medium">{metrics.support.averageResolutionTime.toFixed(1)} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Satisfaction Score:</span>
                  <span className="font-medium">{metrics.support.satisfactionScore.toFixed(1)}/5</span>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Top Issues:</p>
                  <div className="space-y-1">
                    {metrics.support.topIssues.slice(0, 3).map((issue, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-gray-600">{issue.issue}:</span>
                        <span>{issue.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabPanel>

        <TabPanel item="funnel">
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold mb-6">Conversion Funnel</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={conversionFunnel}
                layout="horizontal"
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="step" type="category" width={100} />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'users' ? value.toLocaleString() : `${value}%`,
                    name === 'users' ? 'Users' : 'Conversion Rate'
                  ]}
                />
                <Bar dataKey="users" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              {conversionFunnel.map((step, index) => (
                <div key={index} className="text-center">
                  <p className="font-medium text-gray-900">{step.users.toLocaleString()}</p>
                  <p className="text-sm text-gray-600">{step.step}</p>
                  {index > 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      -{formatPercentage(step.dropoffRate)} dropoff
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TabPanel>

        <TabPanel item="features">
          <div className="space-y-6">
            {/* Feature Usage */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-semibold mb-4">Most Used Features</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.features.mostUsed}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="feature" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(value) => [value.toLocaleString(), 'Usage Count']} />
                  <Bar dataKey="usage" fill="#0088FE" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Feature Adoption */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-semibold mb-4">Feature Adoption Rates</h3>
              <div className="space-y-4">
                {Object.entries(metrics.features.adoptionRates)
                  .sort(([, a], [, b]) => b - a)
                  .map(([feature, rate]) => (
                    <div key={feature}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{feature}</span>
                        <span>{formatPercentage(rate)}</span>
                      </div>
                      <Progress value={rate} />
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </TabPanel>

        <TabPanel item="cohorts">
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold mb-6">Cohort Analysis</h3>
            <div className="space-y-6">
              {cohortData.map((cohort, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium">{cohort.cohortMonth} Cohort</h4>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Cohort Size: {cohort.cohortSize}</p>
                      <p className="text-sm text-gray-600">LTV: {formatCurrency(cohort.lifetimeValue * 100)}</p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart
                      data={Object.entries(cohort.retentionByMonth).map(([month, retention]) => ({
                        month,
                        retention
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value}%`, 'Retention']} />
                      <Line type="monotone" dataKey="retention" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          </div>
        </TabPanel>

        <TabPanel item="satisfaction">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rating Distribution */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-semibold mb-4">Rating Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={Object.entries(metrics.satisfaction.ratingDistribution).map(([rating, count]) => ({
                    rating: `${rating} stars`,
                    count
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="rating" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#FFD700" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* NPS and Summary */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-semibold mb-4">Satisfaction Summary</h3>
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">{metrics.satisfaction.averageRating.toFixed(1)}</p>
                  <p className="text-sm text-gray-600">Average Rating</p>
                  <div className="flex justify-center mt-2">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className={`w-5 h-5 ${i < Math.floor(metrics.satisfaction.averageRating) ? 'text-yellow-400' : 'text-gray-300'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    ))}
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{metrics.satisfaction.netPromoterScore}</p>
                  <p className="text-sm text-gray-600">Net Promoter Score</p>
                  <p className="text-xs text-gray-500 mt-1">Excellent (70+)</p>
                </div>

                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900">{metrics.satisfaction.totalReviews}</p>
                  <p className="text-sm text-gray-600">Total Reviews</p>
                </div>
              </div>
            </div>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
};

export default MarketplaceDashboard;