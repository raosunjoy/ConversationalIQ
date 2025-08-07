/**
 * Beta Program Dashboard Component
 * Displays beta program metrics, user management, and feature flag controls
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@zendeskgarden/react-cards';
import { Button } from '@zendeskgarden/react-buttons';
import { Field, Input, Label, Textarea, Select } from '@zendeskgarden/react-forms';
import { Modal, Header, Body, Footer, Close } from '@zendeskgarden/react-modals';
import { Badge } from '@zendeskgarden/react-badges';
import { Tabs, TabList, Tab, TabPanel } from '@zendeskgarden/react-tabs';
import { Alert, Paragraph } from '@zendeskgarden/react-notifications';
import { Table, Head, HeaderRow, HeaderCell, Body as TableBody, Row, Cell } from '@zendeskgarden/react-tables';

interface BetaMetrics {
  totalUsers: number;
  activeUsers: number;
  churnedUsers: number;
  averageSessionTime: number;
  feedbackCount: number;
  averageSatisfactionScore: number;
  featureAdoptionRates: Record<string, number>;
  conversionRate: number;
}

interface BetaUser {
  id: string;
  email: string;
  zendeskAccountId: string;
  accountType: string;
  onboardingStatus: string;
  joinedAt: string;
  lastActiveAt?: string;
}

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetAudience: string;
}

interface BetaFeedback {
  id: string;
  userId: string;
  type: string;
  content: string;
  rating?: number;
  urgency: string;
  status: string;
  createdAt: string;
}

const BetaProgramDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<BetaMetrics | null>(null);
  const [betaUsers, setBetaUsers] = useState<BetaUser[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [feedback, setFeedback] = useState<BetaFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview');
  
  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  
  // Form states
  const [inviteEmail, setInviteEmail] = useState('');
  const [newFlag, setNewFlag] = useState({
    name: '',
    description: '',
    enabled: false,
    rolloutPercentage: 0,
    targetAudience: 'beta',
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Load all dashboard data in parallel
      const [metricsRes, usersRes, flagsRes, feedbackRes] = await Promise.all([
        fetch('/api/beta-program/metrics'),
        fetch('/api/beta-program/users'),
        fetch('/api/beta-program/analytics/feature-flags'),
        fetch('/api/beta-program/feedback'),
      ]);

      const [metricsData, usersData, flagsData, feedbackData] = await Promise.all([
        metricsRes.json(),
        usersRes.json(),
        flagsRes.json(),
        feedbackRes.json(),
      ]);

      setMetrics(metricsData.data);
      setBetaUsers(usersData.data);
      setFeatureFlags(flagsData.data || []); // Placeholder for actual flag data
      setFeedback(feedbackData.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async (): Promise<void> => {
    try {
      const response = await fetch('/api/beta-program/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          invitedBy: 'admin', // Would come from auth context
          metadata: {},
        }),
      });

      if (response.ok) {
        setInviteEmail('');
        setShowInviteModal(false);
        await loadDashboardData();
      }
    } catch (error) {
      console.error('Failed to invite user:', error);
    }
  };

  const handleCreateFlag = async (): Promise<void> => {
    try {
      const response = await fetch('/api/beta-program/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newFlag,
          createdBy: 'admin', // Would come from auth context
          userSegments: [],
          conditions: [],
          metadata: {},
        }),
      });

      if (response.ok) {
        setNewFlag({
          name: '',
          description: '',
          enabled: false,
          rolloutPercentage: 0,
          targetAudience: 'beta',
        });
        setShowFlagModal(false);
        await loadDashboardData();
      }
    } catch (error) {
      console.error('Failed to create feature flag:', error);
    }
  };

  const getStatusBadge = (status: string): React.ReactElement => {
    const statusColors: Record<string, 'positive' | 'warning' | 'danger' | 'neutral'> = {
      active: 'positive',
      invited: 'warning',
      churned: 'danger',
    };
    return <Badge type={statusColors[status] || 'neutral'}>{status}</Badge>;
  };

  const getUrgencyBadge = (urgency: string): React.ReactElement => {
    const urgencyColors: Record<string, 'positive' | 'warning' | 'danger' | 'neutral'> = {
      low: 'neutral',
      medium: 'warning',
      high: 'warning',
      critical: 'danger',
    };
    return <Badge type={urgencyColors[urgency] || 'neutral'}>{urgency}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2">Loading beta program dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Beta Program Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage beta users, feature flags, and collect feedback</p>
        </div>
        <div className="space-x-2">
          <Button onClick={() => setShowInviteModal(true)}>
            Invite Beta User
          </Button>
          <Button onClick={() => setShowFlagModal(true)}>
            Create Feature Flag
          </Button>
        </div>
      </div>

      <Tabs selectedItem={selectedTab} onChange={setSelectedTab}>
        <TabList>
          <Tab item="overview">Overview</Tab>
          <Tab item="users">Beta Users</Tab>
          <Tab item="flags">Feature Flags</Tab>
          <Tab item="feedback">Feedback</Tab>
        </TabList>

        <TabPanel item="overview">
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle>Total Beta Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">{metrics.totalUsers}</div>
                  <p className="text-sm text-gray-500">Active: {metrics.activeUsers}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Avg. Session Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{metrics.averageSessionTime}min</div>
                  <p className="text-sm text-gray-500">Per user session</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Feedback Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">{metrics.averageSatisfactionScore.toFixed(1)}/5</div>
                  <p className="text-sm text-gray-500">{metrics.feedbackCount} responses</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Conversion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">{metrics.conversionRate}%</div>
                  <p className="text-sm text-gray-500">Beta to paid</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Feature Adoption Rates */}
          {metrics && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Feature Adoption Rates</CardTitle>
                <CardDescription>How beta users are engaging with different features</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(metrics.featureAdoptionRates).map(([feature, rate]) => (
                    <div key={feature} className="flex items-center justify-between">
                      <span className="font-medium capitalize">{feature.replace('_', ' ')}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{rate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabPanel>

        <TabPanel item="users">
          <Card>
            <CardHeader>
              <CardTitle>Beta Users ({betaUsers.length})</CardTitle>
              <CardDescription>Manage beta program participants</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <Head>
                  <HeaderRow>
                    <HeaderCell>Email</HeaderCell>
                    <HeaderCell>Status</HeaderCell>
                    <HeaderCell>Account Type</HeaderCell>
                    <HeaderCell>Joined</HeaderCell>
                    <HeaderCell>Last Active</HeaderCell>
                  </HeaderRow>
                </Head>
                <TableBody>
                  {betaUsers.map((user) => (
                    <Row key={user.id}>
                      <Cell>{user.email}</Cell>
                      <Cell>{getStatusBadge(user.onboardingStatus)}</Cell>
                      <Cell>{user.accountType}</Cell>
                      <Cell>{new Date(user.joinedAt).toLocaleDateString()}</Cell>
                      <Cell>
                        {user.lastActiveAt
                          ? new Date(user.lastActiveAt).toLocaleDateString()
                          : 'Never'}
                      </Cell>
                    </Row>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel item="flags">
          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
              <CardDescription>Control feature rollouts and A/B testing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {featureFlags.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No feature flags created yet.</p>
                    <Button onClick={() => setShowFlagModal(true)} className="mt-2">
                      Create Your First Flag
                    </Button>
                  </div>
                ) : (
                  featureFlags.map((flag) => (
                    <div key={flag.id} className="border rounded p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{flag.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">{flag.description}</p>
                          <div className="mt-2 space-x-2">
                            <Badge type={flag.enabled ? 'positive' : 'neutral'}>
                              {flag.enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                            <Badge type="neutral">{flag.rolloutPercentage}% Rollout</Badge>
                            <Badge type="neutral">{flag.targetAudience}</Badge>
                          </div>
                        </div>
                        <div className="space-x-2">
                          <Button size="small">Edit</Button>
                          <Button size="small" isDanger>Toggle</Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel item="feedback">
          <Card>
            <CardHeader>
              <CardTitle>Beta Feedback ({feedback.length})</CardTitle>
              <CardDescription>Feedback and suggestions from beta users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {feedback.map((item) => (
                  <div key={item.id} className="border rounded p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="space-x-2">
                        <Badge type="neutral">{item.type.replace('_', ' ')}</Badge>
                        {getUrgencyBadge(item.urgency)}
                        <Badge type="neutral">{item.status}</Badge>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm">{item.content}</p>
                    {item.rating && (
                      <div className="mt-2">
                        <span className="text-sm font-medium">Rating: {item.rating}/5</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabPanel>
      </Tabs>

      {/* Invite User Modal */}
      <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)}>
        <Header>
          <h2>Invite Beta User</h2>
          <Close aria-label="Close modal" />
        </Header>
        <Body>
          <Field>
            <Label>Email Address</Label>
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Enter email address"
            />
          </Field>
        </Body>
        <Footer>
          <Button onClick={() => setShowInviteModal(false)}>Cancel</Button>
          <Button isPrimary onClick={handleInviteUser} disabled={!inviteEmail}>
            Send Invitation
          </Button>
        </Footer>
      </Modal>

      {/* Create Feature Flag Modal */}
      <Modal isOpen={showFlagModal} onClose={() => setShowFlagModal(false)}>
        <Header>
          <h2>Create Feature Flag</h2>
          <Close aria-label="Close modal" />
        </Header>
        <Body>
          <div className="space-y-4">
            <Field>
              <Label>Flag Name</Label>
              <Input
                value={newFlag.name}
                onChange={(e) => setNewFlag({ ...newFlag, name: e.target.value })}
                placeholder="e.g., new_analytics_panel"
              />
            </Field>
            <Field>
              <Label>Description</Label>
              <Textarea
                value={newFlag.description}
                onChange={(e) => setNewFlag({ ...newFlag, description: e.target.value })}
                placeholder="Describe what this flag controls"
              />
            </Field>
            <Field>
              <Label>Rollout Percentage</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={newFlag.rolloutPercentage}
                onChange={(e) =>
                  setNewFlag({ ...newFlag, rolloutPercentage: parseInt(e.target.value) || 0 })
                }
              />
            </Field>
            <Field>
              <Label>Target Audience</Label>
              <Select
                value={newFlag.targetAudience}
                onChange={(e) => setNewFlag({ ...newFlag, targetAudience: e.target.value })}
              >
                <option value="beta">Beta Users</option>
                <option value="internal">Internal Team</option>
                <option value="all">All Users</option>
                <option value="specific">Specific Users</option>
              </Select>
            </Field>
          </div>
        </Body>
        <Footer>
          <Button onClick={() => setShowFlagModal(false)}>Cancel</Button>
          <Button isPrimary onClick={handleCreateFlag} disabled={!newFlag.name}>
            Create Flag
          </Button>
        </Footer>
      </Modal>
    </div>
  );
};

export default BetaProgramDashboard;