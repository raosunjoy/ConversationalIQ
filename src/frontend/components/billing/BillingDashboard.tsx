/**
 * Billing Dashboard Component
 * Comprehensive billing and subscription management interface
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@zendeskgarden/react-buttons';
import { Badge } from '@zendeskgarden/react-badges';
import { Alert } from '@zendeskgarden/react-notifications';
import { Field, Input, Label, Select } from '@zendeskgarden/react-forms';
import { Tabs, TabList, Tab, TabPanel } from '@zendeskgarden/react-tabs';
import { Table, Head, HeaderRow, HeaderCell, Body, Row, Cell } from '@zendeskgarden/react-tables';
import { Progress } from '@zendeskgarden/react-loaders';
import { Modal, Header, Body as ModalBody, Footer, FooterItem } from '@zendeskgarden/react-modals';

interface Subscription {
  id: string;
  planId: string;
  planName: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  agentCount: number;
  billingCycle: 'monthly' | 'yearly';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  billing: {
    amount: number;
    currency: string;
    nextPaymentDate: Date;
  };
  usage: {
    conversationsThisMonth: number;
    apiCallsThisMonth: number;
    storageUsedMB: number;
  };
  limits: {
    maxAgents: number;
    conversationsPerMonth: number;
    apiCallsPerMonth: number;
  };
}

interface Plan {
  id: string;
  name: string;
  tier: 'starter' | 'professional' | 'enterprise';
  pricePerAgent: number;
  billingCycle: 'monthly' | 'yearly';
  features: {
    maxAgents: number;
    conversationsPerMonth: number;
    advancedFeatures: string[];
    supportLevel: string;
  };
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'overdue';
  dueDate: Date;
  paidAt?: Date;
  downloadUrl?: string;
}

interface PaymentMethod {
  id: string;
  type: 'card';
  card: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
}

interface BillingDashboardProps {
  organizationId: string;
  onNavigate?: (path: string) => void;
}

const BillingDashboard: React.FC<BillingDashboardProps> = ({
  organizationId,
  onNavigate
}) => {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [newAgentCount, setNewAgentCount] = useState(1);

  useEffect(() => {
    loadBillingData();
  }, [organizationId]);

  const loadBillingData = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Load subscription data
      const subscriptionData = await fetchSubscription(organizationId);
      setSubscription(subscriptionData);
      
      // Load available plans
      const plansData = await fetchAvailablePlans();
      setAvailablePlans(plansData);
      
      // Load invoices and payment methods
      if (subscriptionData) {
        const [invoicesData, paymentMethodsData] = await Promise.all([
          fetchInvoices(subscriptionData.id),
          fetchPaymentMethods(subscriptionData.id)
        ]);
        setInvoices(invoicesData);
        setPaymentMethods(paymentMethodsData);
      }
    } catch (error) {
      console.error('Failed to load billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscription = async (orgId: string): Promise<Subscription> => {
    // Simulate API call
    return {
      id: 'sub_12345',
      planId: 'professional_monthly',
      planName: 'Professional Monthly',
      status: 'active',
      agentCount: 15,
      billingCycle: 'monthly',
      currentPeriodStart: new Date(2024, 0, 1),
      currentPeriodEnd: new Date(2024, 1, 1),
      billing: {
        amount: 585, // $5.85 for 15 agents at $39/agent
        currency: 'usd',
        nextPaymentDate: new Date(2024, 1, 1)
      },
      usage: {
        conversationsThisMonth: 18500,
        apiCallsThisMonth: 45000,
        storageUsedMB: 2400
      },
      limits: {
        maxAgents: 100,
        conversationsPerMonth: 25000,
        apiCallsPerMonth: 100000
      }
    };
  };

  const fetchAvailablePlans = async (): Promise<Plan[]> => {
    // Simulate API call
    return [
      {
        id: 'starter_monthly',
        name: 'Starter',
        tier: 'starter',
        pricePerAgent: 19,
        billingCycle: 'monthly',
        features: {
          maxAgents: 25,
          conversationsPerMonth: 5000,
          advancedFeatures: ['Basic Analytics', 'Email Support'],
          supportLevel: 'Email'
        }
      },
      {
        id: 'professional_monthly',
        name: 'Professional',
        tier: 'professional',
        pricePerAgent: 39,
        billingCycle: 'monthly',
        features: {
          maxAgents: 100,
          conversationsPerMonth: 25000,
          advancedFeatures: ['Advanced Analytics', 'Escalation Prevention', 'API Access'],
          supportLevel: 'Priority'
        }
      },
      {
        id: 'enterprise_monthly',
        name: 'Enterprise',
        tier: 'enterprise',
        pricePerAgent: 59,
        billingCycle: 'monthly',
        features: {
          maxAgents: -1, // unlimited
          conversationsPerMonth: -1, // unlimited
          advancedFeatures: ['Custom Models', 'White Labeling', 'Dedicated Support'],
          supportLevel: 'Dedicated'
        }
      }
    ];
  };

  const fetchInvoices = async (subscriptionId: string): Promise<Invoice[]> => {
    // Simulate API call
    return [
      {
        id: 'inv_001',
        amount: 585,
        currency: 'usd',
        status: 'paid',
        dueDate: new Date(2024, 0, 1),
        paidAt: new Date(2024, 0, 1),
        downloadUrl: '/api/invoices/inv_001/download'
      },
      {
        id: 'inv_002',
        amount: 585,
        currency: 'usd',
        status: 'open',
        dueDate: new Date(2024, 1, 1)
      }
    ];
  };

  const fetchPaymentMethods = async (subscriptionId: string): Promise<PaymentMethod[]> => {
    // Simulate API call
    return [
      {
        id: 'pm_001',
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242',
          expMonth: 12,
          expYear: 2025
        },
        isDefault: true
      }
    ];
  };

  const handlePlanChange = async (planId: string, agentCount: number): Promise<void> => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update subscription
      if (subscription) {
        const plan = availablePlans.find(p => p.id === planId);
        if (plan) {
          setSubscription({
            ...subscription,
            planId,
            planName: plan.name,
            agentCount,
            billing: {
              ...subscription.billing,
              amount: plan.pricePerAgent * agentCount
            }
          });
        }
      }
      
      setShowPlanModal(false);
      alert('Subscription updated successfully!');
    } catch (error) {
      console.error('Failed to update subscription:', error);
      alert('Failed to update subscription. Please try again.');
    }
  };

  const handleCancelSubscription = async (): Promise<void> => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (subscription) {
        setSubscription({
          ...subscription,
          status: 'canceled'
        });
      }
      
      setShowCancelModal(false);
      alert('Subscription canceled successfully.');
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      alert('Failed to cancel subscription. Please try again.');
    }
  };

  const handleInvoiceDownload = (invoiceId: string): void => {
    // Simulate download
    window.open(`/api/invoices/${invoiceId}/download`, '_blank');
  };

  const getStatusBadgeType = (status: string): 'positive' | 'warning' | 'danger' | 'neutral' => {
    switch (status) {
      case 'active': case 'paid': return 'positive';
      case 'trialing': case 'open': return 'warning';
      case 'past_due': case 'overdue': return 'danger';
      default: return 'neutral';
    }
  };

  const getTierBadgeType = (tier: string): 'positive' | 'warning' | 'danger' => {
    switch (tier) {
      case 'starter': return 'positive';
      case 'professional': return 'warning';
      case 'enterprise': return 'danger';
      default: return 'positive';
    }
  };

  const formatCurrency = (amount: number, currency: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <Progress size="large" />
          <p className="mt-4 text-gray-600">Loading billing information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="text-gray-600 mt-1">Manage your subscription, usage, and billing</p>
        </div>
        <div className="flex space-x-3">
          <Button onClick={() => setShowPlanModal(true)}>
            Change Plan
          </Button>
        </div>
      </div>

      {/* Current Subscription Overview */}
      {subscription && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <h2 className="text-xl font-semibold">Current Subscription</h2>
                <Badge type={getStatusBadgeType(subscription.status)}>
                  {subscription.status}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-gray-600">Plan</p>
                  <p className="font-semibold">{subscription.planName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Agents</p>
                  <p className="font-semibold">{subscription.agentCount}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Monthly Cost</p>
                  <p className="font-semibold">{formatCurrency(subscription.billing.amount, subscription.billing.currency)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Next Billing</p>
                  <p className="font-semibold">{subscription.billing.nextPaymentDate.toLocaleDateString()}</p>
                </div>
              </div>
              {subscription.trialEnd && (
                <div className="mt-4">
                  <Alert type="warning">
                    Trial ends on {subscription.trialEnd.toLocaleDateString()}. 
                    Add a payment method to continue service.
                  </Alert>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Usage Overview */}
      {subscription && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4">Current Usage</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Conversations</span>
                <span className="text-sm font-medium">
                  {subscription.usage.conversationsThisMonth.toLocaleString()} / {subscription.limits.conversationsPerMonth.toLocaleString()}
                </span>
              </div>
              <Progress value={(subscription.usage.conversationsThisMonth / subscription.limits.conversationsPerMonth) * 100} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">API Calls</span>
                <span className="text-sm font-medium">
                  {subscription.usage.apiCallsThisMonth.toLocaleString()} / {subscription.limits.apiCallsPerMonth.toLocaleString()}
                </span>
              </div>
              <Progress value={(subscription.usage.apiCallsThisMonth / subscription.limits.apiCallsPerMonth) * 100} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Storage</span>
                <span className="text-sm font-medium">
                  {subscription.usage.storageUsedMB} MB
                </span>
              </div>
              <Progress value={Math.min((subscription.usage.storageUsedMB / 5000) * 100, 100)} />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs selectedItem={selectedTab} onChange={setSelectedTab}>
        <TabList>
          <Tab item="overview">Overview</Tab>
          <Tab item="plans">Plans & Pricing</Tab>
          <Tab item="invoices">Invoices</Tab>
          <Tab item="payment-methods">Payment Methods</Tab>
        </TabList>

        <TabPanel item="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Account Status */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-semibold mb-4">Account Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Subscription Status:</span>
                  <Badge type={getStatusBadgeType(subscription?.status || '')}>
                    {subscription?.status || 'Unknown'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Current Plan:</span>
                  <span className="font-medium">{subscription?.planName || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Billing Cycle:</span>
                  <span className="font-medium">{subscription?.billingCycle || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Next Payment:</span>
                  <span className="font-medium">{subscription?.billing.nextPaymentDate.toLocaleDateString() || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button isPrimary onClick={() => setShowPlanModal(true)}>
                  Change Plan
                </Button>
                <Button onClick={() => onNavigate?.('/billing/usage')}>
                  View Usage Details
                </Button>
                <Button onClick={() => handleInvoiceDownload('latest')}>
                  Download Latest Invoice
                </Button>
                <Button 
                  isDanger 
                  onClick={() => setShowCancelModal(true)}
                  disabled={subscription?.status === 'canceled'}
                >
                  Cancel Subscription
                </Button>
              </div>
            </div>
          </div>
        </TabPanel>

        <TabPanel item="plans">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {availablePlans.map(plan => (
              <div 
                key={plan.id} 
                className={`bg-white p-6 rounded-lg border-2 ${
                  subscription?.planId === plan.id ? 'border-blue-500' : 'border-gray-200'
                }`}
              >
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center mb-2">
                    <h3 className="text-xl font-semibold">{plan.name}</h3>
                    <Badge type={getTierBadgeType(plan.tier)} className="ml-2">
                      {plan.tier}
                    </Badge>
                  </div>
                  <div className="text-3xl font-bold">
                    ${plan.pricePerAgent}
                    <span className="text-sm font-normal text-gray-600">/agent/month</span>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span>Max Agents:</span>
                    <span className="font-medium">
                      {plan.features.maxAgents === -1 ? 'Unlimited' : plan.features.maxAgents}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Conversations/Month:</span>
                    <span className="font-medium">
                      {plan.features.conversationsPerMonth === -1 ? 'Unlimited' : plan.features.conversationsPerMonth.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="block text-gray-600 mb-1">Features:</span>
                    <ul className="space-y-1">
                      {plan.features.advancedFeatures.map((feature, index) => (
                        <li key={index} className="text-xs">• {feature}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <Button 
                  isPrimary={subscription?.planId === plan.id}
                  onClick={() => {
                    setSelectedPlan(plan);
                    setNewAgentCount(subscription?.agentCount || 1);
                    setShowPlanModal(true);
                  }}
                  disabled={subscription?.planId === plan.id}
                >
                  {subscription?.planId === plan.id ? 'Current Plan' : 'Select Plan'}
                </Button>
              </div>
            ))}
          </div>
        </TabPanel>

        <TabPanel item="invoices">
          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <Table>
              <Head>
                <HeaderRow>
                  <HeaderCell>Invoice ID</HeaderCell>
                  <HeaderCell>Amount</HeaderCell>
                  <HeaderCell>Status</HeaderCell>
                  <HeaderCell>Due Date</HeaderCell>
                  <HeaderCell>Actions</HeaderCell>
                </HeaderRow>
              </Head>
              <Body>
                {invoices.map(invoice => (
                  <Row key={invoice.id}>
                    <Cell>{invoice.id}</Cell>
                    <Cell>{formatCurrency(invoice.amount, invoice.currency)}</Cell>
                    <Cell>
                      <Badge type={getStatusBadgeType(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </Cell>
                    <Cell>{invoice.dueDate.toLocaleDateString()}</Cell>
                    <Cell>
                      <Button 
                        size="small" 
                        onClick={() => handleInvoiceDownload(invoice.id)}
                        disabled={!invoice.downloadUrl}
                      >
                        Download
                      </Button>
                    </Cell>
                  </Row>
                ))}
              </Body>
            </Table>
            
            {invoices.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-600">No invoices available</p>
              </div>
            )}
          </div>
        </TabPanel>

        <TabPanel item="payment-methods">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Payment Methods</h3>
              <Button onClick={() => alert('Add payment method functionality')}>
                Add Payment Method
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paymentMethods.map(method => (
                <div key={method.id} className="bg-white p-4 rounded-lg border">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center">
                        <span className="text-xs font-bold uppercase">{method.card.brand}</span>
                      </div>
                      <div>
                        <p className="font-medium">•••• •••• •••• {method.card.last4}</p>
                        <p className="text-sm text-gray-600">
                          Expires {method.card.expMonth}/{method.card.expYear}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {method.isDefault && (
                        <Badge type="positive">Default</Badge>
                      )}
                      <Button size="small" onClick={() => alert('Edit payment method')}>
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {paymentMethods.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-600">No payment methods on file</p>
                <Button className="mt-4" onClick={() => alert('Add payment method functionality')}>
                  Add Your First Payment Method
                </Button>
              </div>
            )}
          </div>
        </TabPanel>
      </Tabs>

      {/* Plan Change Modal */}
      {showPlanModal && (
        <Modal onClose={() => setShowPlanModal(false)}>
          <Header>Change Subscription Plan</Header>
          <ModalBody>
            <div className="space-y-4">
              <Field>
                <Label>Select Plan</Label>
                <Select
                  value={selectedPlan?.id || subscription?.planId || ''}
                  onChange={(e) => {
                    const plan = availablePlans.find(p => p.id === e.target.value);
                    setSelectedPlan(plan || null);
                  }}
                >
                  {availablePlans.map(plan => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - ${plan.pricePerAgent}/agent/month
                    </option>
                  ))}
                </Select>
              </Field>
              
              <Field>
                <Label>Number of Agents</Label>
                <Input
                  type="number"
                  min="1"
                  max={selectedPlan?.features.maxAgents === -1 ? 1000 : selectedPlan?.features.maxAgents}
                  value={newAgentCount}
                  onChange={(e) => setNewAgentCount(parseInt(e.target.value) || 1)}
                />
              </Field>
              
              {selectedPlan && (
                <div className="p-4 bg-gray-50 rounded">
                  <p className="font-medium">
                    New Monthly Total: {formatCurrency((selectedPlan.pricePerAgent * newAgentCount) * 100, 'usd')}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Changes will take effect at the next billing cycle
                  </p>
                </div>
              )}
            </div>
          </ModalBody>
          <Footer>
            <FooterItem>
              <Button onClick={() => setShowPlanModal(false)}>
                Cancel
              </Button>
            </FooterItem>
            <FooterItem>
              <Button 
                isPrimary 
                onClick={() => selectedPlan && handlePlanChange(selectedPlan.id, newAgentCount)}
                disabled={!selectedPlan}
              >
                Update Plan
              </Button>
            </FooterItem>
          </Footer>
        </Modal>
      )}

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <Modal onClose={() => setShowCancelModal(false)}>
          <Header>Cancel Subscription</Header>
          <ModalBody>
            <div className="space-y-4">
              <Alert type="warning">
                Are you sure you want to cancel your subscription? This action cannot be undone.
              </Alert>
              <p>
                Your subscription will remain active until {subscription?.currentPeriodEnd.toLocaleDateString()}, 
                after which you will lose access to all ConversationIQ features.
              </p>
            </div>
          </ModalBody>
          <Footer>
            <FooterItem>
              <Button onClick={() => setShowCancelModal(false)}>
                Keep Subscription
              </Button>
            </FooterItem>
            <FooterItem>
              <Button isDanger onClick={handleCancelSubscription}>
                Cancel Subscription
              </Button>
            </FooterItem>
          </Footer>
        </Modal>
      )}
    </div>
  );
};

export default BillingDashboard;