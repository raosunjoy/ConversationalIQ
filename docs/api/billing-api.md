# Billing API Documentation

## Overview

The ConversationIQ Billing API provides comprehensive subscription management, trial handling, usage tracking, and payment processing capabilities for marketplace customers.

## Base URL

```
https://api.conversationiq.com/v1/billing
```

## Authentication

All API endpoints require authentication using JWT tokens:

```
Authorization: Bearer <your-jwt-token>
```

## Subscription Plans

### Get Available Plans

```http
GET /billing/plans
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "starter_monthly",
      "name": "Starter",
      "tier": "starter",
      "pricePerAgent": 1900,
      "billingCycle": "monthly",
      "features": {
        "maxAgents": 25,
        "conversationsPerMonth": 5000,
        "analyticsRetention": 90,
        "advancedFeatures": ["sentiment-analysis", "response-suggestions"],
        "supportLevel": "email"
      }
    }
  ]
}
```

## Trial Management

### Start Trial

```http
POST /billing/trial
```

**Request Body:**
```json
{
  "zendeskSubdomain": "yourcompany",
  "zendeskAccountId": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "sub_trial_123",
    "status": "trialing",
    "trialStart": "2024-01-01T00:00:00Z",
    "trialEnd": "2024-01-31T23:59:59Z",
    "planId": "trial"
  },
  "message": "Trial subscription created successfully"
}
```

### Extend Trial

```http
POST /billing/trial/extend
```

**Request Body:**
```json
{
  "days": 7
}
```

### Convert Trial to Paid Subscription

```http
POST /billing/subscription/convert
```

**Request Body:**
```json
{
  "planId": "professional_monthly",
  "agentCount": 10,
  "paymentMethodId": "pm_1234567890"
}
```

## Subscription Management

### Get Current Subscription

```http
GET /billing/subscription
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "sub_123456",
    "organizationId": "org_123",
    "planId": "professional_monthly",
    "status": "active",
    "agentCount": 15,
    "currentPeriodStart": "2024-01-01T00:00:00Z",
    "currentPeriodEnd": "2024-02-01T00:00:00Z",
    "billing": {
      "amount": 58500,
      "currency": "usd",
      "nextPaymentDate": "2024-02-01T00:00:00Z"
    },
    "usage": {
      "conversationsThisMonth": 18500,
      "apiCallsThisMonth": 45000,
      "storageUsedMB": 2400
    },
    "analytics": {
      "dailyUsage": [...],
      "totalUsage": {...}
    }
  }
}
```

### Create New Subscription

```http
POST /billing/subscription
```

**Request Body:**
```json
{
  "planId": "professional_monthly",
  "agentCount": 10,
  "paymentMethodId": "pm_1234567890",
  "zendeskSubdomain": "yourcompany",
  "zendeskAccountId": "123456"
}
```

### Update Subscription

```http
PUT /billing/subscription
```

**Request Body:**
```json
{
  "planId": "enterprise_monthly",
  "agentCount": 25
}
```

### Cancel Subscription

```http
DELETE /billing/subscription
```

**Request Body:**
```json
{
  "cancelAtPeriodEnd": true
}
```

## Invoice Management

### Get Invoices

```http
GET /billing/invoices
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "inv_123456",
      "amount": 58500,
      "currency": "usd",
      "status": "paid",
      "dueDate": "2024-01-01T00:00:00Z",
      "paidAt": "2024-01-01T12:00:00Z",
      "downloadUrl": "/api/invoices/inv_123456/download"
    }
  ]
}
```

### Generate Invoice

```http
POST /billing/invoices/generate
```

### Download Invoice

```http
GET /billing/invoices/{invoiceId}/download
```

**Response:**
```json
{
  "success": true,
  "data": {
    "downloadUrl": "/api/files/invoices/inv_123456.pdf",
    "expiresAt": "2024-01-01T12:15:00Z"
  }
}
```

## Usage Tracking

### Track Usage

```http
POST /billing/usage
```

**Request Body:**
```json
{
  "type": "conversation",
  "count": 100
}
```

**Usage Types:**
- `conversation` - Processed conversations
- `api_call` - API calls made
- `response_suggestion` - AI response suggestions generated
- `escalation_prevention` - Escalations prevented

### Get Usage Analytics

```http
GET /billing/usage/analytics?period=month&startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dailyUsage": [
      {
        "date": "2024-01-01",
        "conversations": 120,
        "apiCalls": 300,
        "agentsActive": 8,
        "sentimentAnalyses": 120,
        "responsesSuggested": 200,
        "escalationsPrevented": 15
      }
    ],
    "totalUsage": {
      "conversations": 18500,
      "apiCalls": 45000,
      "sentimentAnalyses": 18500,
      "responsesSuggested": 25000,
      "escalationsPrevented": 450
    }
  }
}
```

## Administrative Endpoints

### Get Subscription Metrics (Admin Only)

```http
GET /billing/metrics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSubscriptions": 1250,
    "activeSubscriptions": 1180,
    "trialSubscriptions": 70,
    "monthlyRevenue": 2150000,
    "averageRevenuePerUser": 1822,
    "churnRate": 2.1,
    "conversionRate": 68.5
  }
}
```

## Webhook Endpoints

### Stripe Webhooks

```http
POST /billing/webhooks/stripe
```

**Headers:**
```
Content-Type: application/json
Stripe-Signature: <webhook-signature>
```

Handles the following Stripe events:
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Error Responses

### Standard Error Format

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information (development only)"
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| 400  | Bad Request - Invalid input parameters |
| 401  | Unauthorized - Invalid or missing authentication |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found - Resource not found |
| 409  | Conflict - Resource already exists |
| 429  | Too Many Requests - Rate limit exceeded |
| 500  | Internal Server Error - Server error |

## Rate Limiting

- **General endpoints**: 100 requests per minute per user
- **Usage tracking**: 1000 requests per minute per organization
- **Webhook endpoints**: 10 requests per second

## Data Models

### Subscription

```typescript
interface Subscription {
  id: string;
  organizationId: string;
  customerId: string;
  planId: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
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
```

### Plan

```typescript
interface SubscriptionPlan {
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
}
```

### Invoice

```typescript
interface Invoice {
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
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { ConversationIQAPI } from '@conversationiq/api';

const api = new ConversationIQAPI({
  baseURL: 'https://api.conversationiq.com/v1',
  token: 'your-jwt-token'
});

// Start trial
const trial = await api.billing.startTrial({
  zendeskSubdomain: 'yourcompany',
  zendeskAccountId: '123456'
});

// Get subscription
const subscription = await api.billing.getSubscription();

// Track usage
await api.billing.trackUsage({
  type: 'conversation',
  count: 100
});
```

### Python

```python
from conversationiq import ConversationIQAPI

api = ConversationIQAPI(
    base_url='https://api.conversationiq.com/v1',
    token='your-jwt-token'
)

# Start trial
trial = api.billing.start_trial(
    zendesk_subdomain='yourcompany',
    zendesk_account_id='123456'
)

# Get subscription
subscription = api.billing.get_subscription()

# Track usage
api.billing.track_usage(
    type='conversation',
    count=100
)
```

## Testing

### Test Environment

Use the sandbox environment for testing:

```
https://api-sandbox.conversationiq.com/v1/billing
```

### Test Data

- **Test Stripe Keys**: Use Stripe test keys for payment processing
- **Test Zendesk**: Use Zendesk sandbox environment
- **Mock Data**: All API responses include mock data for testing

### Sample Test Cases

```javascript
describe('Billing API', () => {
  test('should start trial subscription', async () => {
    const response = await fetch('/billing/trial', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        zendeskSubdomain: 'test',
        zendeskAccountId: '12345'
      })
    });
    
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.status).toBe('trialing');
  });
  
  test('should track usage correctly', async () => {
    const response = await fetch('/billing/usage', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'conversation',
        count: 50
      })
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

## Support

For API support and questions:
- **Email**: api-support@conversationiq.com  
- **Documentation**: https://docs.conversationiq.com/api
- **Status Page**: https://status.conversationiq.com
- **Developer Portal**: https://developers.conversationiq.com