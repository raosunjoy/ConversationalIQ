# ConversationIQ API Documentation

Complete API reference for ConversationIQ's RESTful APIs, GraphQL endpoints, and WebSocket subscriptions.

## Table of Contents

1. [Authentication](#authentication)
2. [REST API Reference](#rest-api-reference)
3. [GraphQL API](#graphql-api)
4. [WebSocket Subscriptions](#websocket-subscriptions)
5. [Beta Program API](#beta-program-api)
6. [Webhook Integrations](#webhook-integrations)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)
9. [SDK & Libraries](#sdk--libraries)
10. [Examples & Use Cases](#examples--use-cases)

---

## Authentication

ConversationIQ uses JWT-based authentication with Zendesk OAuth integration.

### Authentication Flow

1. **Zendesk OAuth**: Users authenticate through Zendesk
2. **JWT Token**: ConversationIQ issues JWT tokens for API access
3. **Token Refresh**: Tokens are automatically refreshed when near expiration

### Headers Required

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### JWT Token Structure

```json
{
  "userId": "user_123",
  "email": "agent@company.com",
  "role": "agent",
  "permissions": ["read:conversations", "write:responses"],
  "zendeskId": "zendesk_456",
  "subdomain": "company",
  "iat": 1640995200,
  "exp": 1641081600
}
```

---

## REST API Reference

Base URL: `https://api.conversationiq.com/v1`

### Health Check

#### GET /health

Check API status and service health.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "version": "1.2.0",
  "services": {
    "database": "healthy",
    "ai_pipeline": "healthy",
    "message_queue": "healthy"
  }
}
```

### Conversations

#### GET /conversations

Retrieve conversations for the authenticated user.

**Query Parameters:**
- `limit` (integer, default: 50) - Number of conversations to return
- `offset` (integer, default: 0) - Pagination offset
- `status` (string) - Filter by conversation status
- `date_from` (string) - ISO date string for filtering
- `date_to` (string) - ISO date string for filtering

**Example Request:**
```bash
curl -H "Authorization: Bearer <token>" \
  "https://api.conversationiq.com/v1/conversations?limit=10&status=active"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "conv_123",
      "ticketId": "ticket_456",
      "zendeskTicketId": "789",
      "customerId": "customer_101",
      "agentId": "agent_202",
      "subject": "Login Issues",
      "status": "active",
      "priority": "medium",
      "tags": ["technical", "login"],
      "createdAt": "2025-01-15T08:00:00Z",
      "updatedAt": "2025-01-15T10:30:00Z",
      "sentiment": {
        "current": "negative",
        "confidence": 0.85,
        "trend": "improving"
      },
      "metrics": {
        "messageCount": 12,
        "responseTime": 180,
        "escalationRisk": 0.25
      }
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

#### GET /conversations/{id}

Retrieve a specific conversation with detailed analytics.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "conv_123",
    "details": {
      "ticketId": "ticket_456",
      "subject": "Login Issues",
      "status": "active",
      "priority": "medium"
    },
    "participants": {
      "customer": {
        "id": "customer_101",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "agent": {
        "id": "agent_202",
        "name": "Sarah Wilson",
        "email": "sarah@company.com"
      }
    },
    "messages": [
      {
        "id": "msg_789",
        "content": "I can't log into my account",
        "senderType": "customer",
        "senderId": "customer_101",
        "timestamp": "2025-01-15T08:00:00Z",
        "aiAnalysis": {
          "sentiment": {
            "polarity": "negative",
            "confidence": 0.82,
            "emotions": ["frustration", "urgency"]
          },
          "intent": {
            "primary": "technical_support",
            "confidence": 0.91,
            "category": "authentication"
          },
          "escalationRisk": 0.35
        }
      }
    ],
    "analytics": {
      "sentimentTrend": [
        {"timestamp": "2025-01-15T08:00:00Z", "sentiment": -0.6},
        {"timestamp": "2025-01-15T08:15:00Z", "sentiment": -0.3},
        {"timestamp": "2025-01-15T08:30:00Z", "sentiment": 0.2}
      ],
      "responseMetrics": {
        "averageResponseTime": 120,
        "firstResponseTime": 45,
        "totalInteractions": 8
      },
      "resolutionPrediction": {
        "likelihood": 0.78,
        "estimatedTime": 15,
        "confidence": "medium"
      }
    }
  }
}
```

### Messages

#### POST /conversations/{id}/messages

Add a new message to a conversation.

**Request Body:**
```json
{
  "content": "Thank you for contacting support. I'll help you with your login issue.",
  "senderType": "agent",
  "senderId": "agent_202",
  "metadata": {
    "responseTime": 45,
    "suggestedResponse": true,
    "suggestionId": "sugg_456"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "msg_890",
    "conversationId": "conv_123",
    "content": "Thank you for contacting support. I'll help you with your login issue.",
    "senderType": "agent",
    "senderId": "agent_202",
    "timestamp": "2025-01-15T10:35:00Z",
    "aiAnalysis": {
      "sentiment": {
        "polarity": "positive",
        "confidence": 0.89
      },
      "responseQuality": {
        "empathy": 0.75,
        "clarity": 0.85,
        "helpfulness": 0.80
      }
    }
  }
}
```

### Response Suggestions

#### GET /conversations/{id}/suggestions

Get AI-generated response suggestions for a conversation.

**Query Parameters:**
- `count` (integer, default: 3) - Number of suggestions to return
- `type` (string) - Filter by suggestion type (`empathy`, `solution`, `information`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sugg_123",
      "type": "empathy",
      "content": "I understand how frustrating it must be when you can't access your account. Let me help you resolve this right away.",
      "confidence": 0.92,
      "reasoning": "Customer expressing frustration about login issues - empathy response recommended",
      "metadata": {
        "sentiment_context": "negative",
        "intent_match": "technical_support",
        "urgency_level": "medium"
      }
    },
    {
      "id": "sugg_124",
      "type": "solution",
      "content": "I can see you're having trouble logging in. Let's try resetting your password first. I'll send you a secure reset link to your registered email address.",
      "confidence": 0.88,
      "reasoning": "Login issue identified - password reset is common first step solution",
      "zendeskMacroId": "macro_password_reset_001"
    },
    {
      "id": "sugg_125",
      "type": "information",
      "content": "To better assist you, could you please let me know what error message you're seeing when you try to log in?",
      "confidence": 0.85,
      "reasoning": "Need more specific information to provide targeted solution"
    }
  ],
  "contextAnalysis": {
    "conversationStage": "problem_identification",
    "customerMood": "frustrated",
    "suggestedTone": "empathetic_professional",
    "urgencyLevel": "medium"
  }
}
```

#### POST /suggestions/{id}/feedback

Provide feedback on suggestion quality.

**Request Body:**
```json
{
  "rating": 5,
  "used": true,
  "helpful": true,
  "comments": "Perfect suggestion, resolved the issue quickly"
}
```

### Analytics

#### GET /analytics/agent/{id}

Get agent performance analytics.

**Query Parameters:**
- `period` (string) - Time period (`day`, `week`, `month`)
- `date_from` (string) - Start date (ISO format)
- `date_to` (string) - End date (ISO format)

**Response:**
```json
{
  "success": true,
  "data": {
    "agentId": "agent_202",
    "period": {
      "from": "2025-01-01T00:00:00Z",
      "to": "2025-01-15T23:59:59Z"
    },
    "metrics": {
      "conversations": {
        "total": 87,
        "resolved": 78,
        "escalated": 5,
        "ongoing": 4
      },
      "performance": {
        "averageResponseTime": 125,
        "firstResponseTime": 42,
        "resolutionRate": 0.896,
        "customerSatisfaction": 4.6
      },
      "sentiment": {
        "averageImprovement": 0.34,
        "successfulDeescalations": 12,
        "positiveOutcomes": 0.73
      },
      "aiUtilization": {
        "suggestionAcceptanceRate": 0.68,
        "averageSuggestionsPerConversation": 2.4,
        "topSuggestionTypes": ["empathy", "solution", "information"]
      }
    },
    "trends": {
      "daily": [
        {
          "date": "2025-01-14",
          "conversations": 6,
          "avgResponseTime": 118,
          "csat": 4.5
        }
      ]
    },
    "insights": [
      "Response time improved 15% compared to last period",
      "Suggestion acceptance rate above team average",
      "Strong performance in de-escalation scenarios"
    ]
  }
}
```

#### GET /analytics/team/{id}

Get team performance analytics (manager access required).

**Response:**
```json
{
  "success": true,
  "data": {
    "teamId": "team_456",
    "period": {
      "from": "2025-01-01T00:00:00Z",
      "to": "2025-01-15T23:59:59Z"
    },
    "summary": {
      "totalAgents": 12,
      "totalConversations": 1247,
      "averageCsat": 4.3,
      "escalationRate": 0.08
    },
    "agents": [
      {
        "id": "agent_202",
        "name": "Sarah Wilson",
        "metrics": {
          "conversations": 87,
          "csat": 4.6,
          "responseTime": 125,
          "resolutionRate": 0.896
        },
        "ranking": 2,
        "improvement": "+5%"
      }
    ],
    "insights": {
      "topPerformers": ["agent_202", "agent_303"],
      "improvementAreas": ["response_time", "first_contact_resolution"],
      "recommendations": [
        "Focus training on complex technical issues",
        "Increase AI suggestion adoption"
      ]
    }
  }
}
```

---

## GraphQL API

Endpoint: `https://api.conversationiq.com/graphql`

### Schema Overview

```graphql
type Query {
  conversation(id: ID!): Conversation
  conversations(filter: ConversationFilter, limit: Int, offset: Int): ConversationConnection
  suggestions(conversationId: ID!, type: SuggestionType): [ResponseSuggestion]
  analytics(agentId: ID, teamId: ID, period: Period): AnalyticsData
}

type Mutation {
  sendMessage(input: SendMessageInput!): Message
  acceptSuggestion(suggestionId: ID!, customizations: String): AcceptSuggestionResult
  updateConversationStatus(id: ID!, status: ConversationStatus!): Conversation
}

type Subscription {
  conversationUpdates(conversationId: ID!): ConversationUpdate
  newSuggestions(agentId: ID!): ResponseSuggestion
  analyticsUpdates(agentId: ID!): AnalyticsUpdate
}
```

### Example Queries

#### Get Conversation with Messages

```graphql
query GetConversation($id: ID!) {
  conversation(id: $id) {
    id
    subject
    status
    sentiment {
      current
      confidence
      trend
    }
    messages {
      id
      content
      senderType
      timestamp
      aiAnalysis {
        sentiment {
          polarity
          confidence
          emotions
        }
        intent {
          primary
          confidence
          category
        }
      }
    }
    analytics {
      sentimentTrend {
        timestamp
        sentiment
      }
      responseMetrics {
        averageResponseTime
        totalInteractions
      }
    }
  }
}
```

#### Get Response Suggestions

```graphql
query GetSuggestions($conversationId: ID!, $type: SuggestionType) {
  suggestions(conversationId: $conversationId, type: $type) {
    id
    type
    content
    confidence
    reasoning
    zendeskMacroId
    metadata {
      sentimentContext
      intentMatch
      urgencyLevel
    }
  }
}
```

#### Send Message Mutation

```graphql
mutation SendMessage($input: SendMessageInput!) {
  sendMessage(input: $input) {
    id
    conversationId
    content
    timestamp
    aiAnalysis {
      sentiment {
        polarity
        confidence
      }
      responseQuality {
        empathy
        clarity
        helpfulness
      }
    }
  }
}
```

### Subscription Examples

#### Real-time Conversation Updates

```graphql
subscription ConversationUpdates($conversationId: ID!) {
  conversationUpdates(conversationId: $conversationId) {
    type
    conversation {
      id
      status
      sentiment {
        current
        confidence
      }
    }
    newMessage {
      id
      content
      senderType
      aiAnalysis {
        sentiment {
          polarity
          confidence
        }
      }
    }
  }
}
```

#### New Suggestions Subscription

```graphql
subscription NewSuggestions($agentId: ID!) {
  newSuggestions(agentId: $agentId) {
    id
    conversationId
    type
    content
    confidence
    reasoning
  }
}
```

---

## WebSocket Subscriptions

WebSocket URL: `wss://api.conversationiq.com/subscriptions`

### Connection

```javascript
import { Client } from 'graphql-ws';

const client = new Client({
  url: 'wss://api.conversationiq.com/subscriptions',
  connectionParams: {
    authorization: `Bearer ${jwtToken}`,
  },
});
```

### Available Subscriptions

1. **Conversation Updates** - Real-time conversation changes
2. **New Suggestions** - AI-generated response suggestions
3. **Analytics Updates** - Performance metrics updates
4. **Escalation Alerts** - Critical situation notifications

---

## Beta Program API

Base URL: `https://api.conversationiq.com/v1/beta-program`

### Feature Flags

#### GET /feature-flags

Get all feature flags and their status.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalFlags": 15,
    "activeFlags": 12,
    "flags": [
      {
        "id": "flag_advanced_analytics",
        "name": "Advanced Analytics Dashboard",
        "description": "Enhanced analytics with predictive insights",
        "enabled": true,
        "rolloutPercentage": 75,
        "targetAudience": "beta",
        "userInRollout": true
      }
    ]
  }
}
```

#### GET /feature-flags/{flagId}/evaluate

Evaluate if a feature flag is enabled for the current user.

**Response:**
```json
{
  "success": true,
  "data": {
    "flagId": "flag_advanced_analytics",
    "userId": "user_123",
    "enabled": true,
    "variant": "treatment",
    "reason": "User in beta program rollout",
    "evaluatedAt": "2025-01-15T10:30:00Z"
  }
}
```

### Beta Feedback

#### POST /feedback

Submit beta feedback.

**Request Body:**
```json
{
  "type": "feature_request",
  "content": "Would love to see export functionality for analytics data",
  "urgency": "medium",
  "rating": 4,
  "featureContext": "analytics_dashboard"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "feedback_789",
    "type": "feature_request",
    "status": "open",
    "createdAt": "2025-01-15T10:30:00Z",
    "estimatedResponse": "2-3 business days"
  },
  "message": "Thank you for your feedback! We'll review and respond soon."
}
```

#### GET /feedback

Get all feedback submitted by the user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "feedback_789",
      "type": "feature_request",
      "content": "Would love to see export functionality for analytics data",
      "urgency": "medium",
      "status": "in_review",
      "createdAt": "2025-01-15T10:30:00Z",
      "response": "Thanks for the suggestion! We're evaluating this for our next release."
    }
  ]
}
```

### Beta Metrics

#### GET /metrics

Get beta program participation metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "participation": {
      "totalUsers": 127,
      "activeUsers": 98,
      "averageSessionTime": 45
    },
    "feedback": {
      "totalSubmissions": 234,
      "averageRating": 4.2,
      "responseRate": 0.89
    },
    "featureAdoption": {
      "advanced_analytics": 0.76,
      "custom_templates": 0.58,
      "predictive_insights": 0.34
    }
  }
}
```

---

## Webhook Integrations

ConversationIQ can send webhooks to notify your systems of important events.

### Webhook Setup

1. Configure webhook URL in ConversationIQ settings
2. Choose events to subscribe to
3. Verify webhook signature for security

### Available Events

- `conversation.created`
- `conversation.updated`
- `message.sent`
- `suggestion.accepted`
- `escalation.detected`
- `analytics.updated`

### Webhook Payload

```json
{
  "event": "escalation.detected",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "conversationId": "conv_123",
    "agentId": "agent_202",
    "customerId": "customer_101",
    "escalationRisk": 0.85,
    "triggers": ["negative_sentiment", "repeated_issues"],
    "recommendations": [
      "Involve supervisor",
      "Offer compensation",
      "Schedule callback"
    ]
  },
  "signature": "sha256=abc123def456..."
}
```

### Signature Verification

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return `sha256=${hash}` === signature;
}
```

---

## Error Handling

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address"
      }
    ]
  },
  "requestId": "req_abc123def456"
}
```

### Common Error Codes

- `INVALID_TOKEN` - JWT token is invalid or expired
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `VALIDATION_ERROR` - Request data failed validation
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `SERVICE_UNAVAILABLE` - Temporary service issue

---

## Rate Limiting

ConversationIQ implements rate limiting to ensure fair usage and system stability.

### Rate Limits

| Endpoint Category | Rate Limit | Window |
|-------------------|------------|---------|
| Authentication | 5 requests | 1 minute |
| General API | 1000 requests | 1 hour |
| Analytics | 100 requests | 1 hour |
| Webhook delivery | 50 requests | 1 minute |
| Beta feedback | 10 requests | 1 hour |

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640998800
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "retryAfter": 3600
  }
}
```

---

## SDK & Libraries

### JavaScript/TypeScript SDK

```bash
npm install @conversationiq/sdk
```

```typescript
import { ConversationIQ } from '@conversationiq/sdk';

const client = new ConversationIQ({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.conversationiq.com/v1'
});

// Get conversations
const conversations = await client.conversations.list({
  limit: 10,
  status: 'active'
});

// Get suggestions
const suggestions = await client.suggestions.get('conv_123');

// Send message
const message = await client.messages.send('conv_123', {
  content: 'Hello, how can I help you?',
  senderType: 'agent'
});
```

### Python SDK

```bash
pip install conversationiq
```

```python
from conversationiq import ConversationIQ

client = ConversationIQ(api_key='your-api-key')

# Get conversations
conversations = client.conversations.list(limit=10, status='active')

# Get suggestions
suggestions = client.suggestions.get('conv_123')

# Send message
message = client.messages.send('conv_123', {
    'content': 'Hello, how can I help you?',
    'sender_type': 'agent'
})
```

### cURL Examples

#### Get Conversations

```bash
curl -X GET \
  'https://api.conversationiq.com/v1/conversations?limit=10' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json'
```

#### Send Message

```bash
curl -X POST \
  'https://api.conversationiq.com/v1/conversations/conv_123/messages' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "Thank you for contacting support.",
    "senderType": "agent",
    "senderId": "agent_202"
  }'
```

---

## Examples & Use Cases

### Use Case 1: Real-time Sentiment Monitoring

```javascript
// Subscribe to conversation updates
const subscription = client.subscribe(`
  subscription ConversationUpdates($conversationId: ID!) {
    conversationUpdates(conversationId: $conversationId) {
      conversation {
        sentiment {
          current
          confidence
        }
      }
    }
  }
`, { conversationId: 'conv_123' });

subscription.on('data', ({ conversation }) => {
  if (conversation.sentiment.current === 'negative' && 
      conversation.sentiment.confidence > 0.8) {
    // Alert supervisor about potential escalation
    alertSupervisor(conversation.id);
  }
});
```

### Use Case 2: Automated Response Suggestions

```javascript
// Get and apply suggestions
async function handleNewMessage(conversationId) {
  const suggestions = await client.suggestions.get(conversationId);
  
  // Auto-apply high-confidence suggestions
  const highConfidenceSuggestion = suggestions.find(
    s => s.confidence > 0.9 && s.type === 'solution'
  );
  
  if (highConfidenceSuggestion) {
    await client.suggestions.accept(highConfidenceSuggestion.id);
  }
}
```

### Use Case 3: Performance Analytics Dashboard

```javascript
// Build manager dashboard
async function loadDashboardData(teamId) {
  const [teamAnalytics, agentPerformance] = await Promise.all([
    client.analytics.team(teamId, { period: 'week' }),
    client.analytics.agents(teamId, { period: 'week' })
  ]);
  
  return {
    teamMetrics: teamAnalytics.summary,
    topPerformers: agentPerformance
      .sort((a, b) => b.csat - a.csat)
      .slice(0, 3),
    improvementAreas: teamAnalytics.insights.recommendations
  };
}
```

### Use Case 4: Beta Feature Management

```javascript
// Check feature flags and enable features
async function enableBetaFeatures(userId) {
  const flags = await client.betaProgram.featureFlags.list();
  const enabledFeatures = [];
  
  for (const flag of flags) {
    const evaluation = await client.betaProgram.featureFlags.evaluate(flag.id);
    if (evaluation.enabled) {
      enabledFeatures.push(flag.name);
    }
  }
  
  return enabledFeatures;
}
```

### Use Case 5: Escalation Prevention

```javascript
// Monitor escalation risk and take proactive action
client.subscribe(`
  subscription EscalationAlerts($agentId: ID!) {
    escalationAlerts(agentId: $agentId) {
      conversationId
      escalationRisk
      triggers
      recommendations
    }
  }
`, { agentId: 'agent_202' });

subscription.on('data', async ({ escalationRisk, conversationId, recommendations }) => {
  if (escalationRisk > 0.7) {
    // Notify supervisor
    await notifySupervisor(conversationId, escalationRisk);
    
    // Provide immediate suggestions
    await showDeEscalationSuggestions(conversationId, recommendations);
  }
});
```

---

## Conclusion

The ConversationIQ API provides comprehensive access to conversation intelligence, AI-powered insights, and performance analytics. This documentation covers the core functionality, but the API continues to evolve with new features and improvements.

### Getting Help

- **API Status**: [https://status.conversationiq.com](https://status.conversationiq.com)
- **Support**: [support@conversationiq.com](mailto:support@conversationiq.com)
- **Community**: [https://community.conversationiq.com](https://community.conversationiq.com)
- **Slack**: [#conversationiq-api](https://slack.conversationiq.com)

### Changelog

Stay updated with API changes:
- **RSS Feed**: [https://api.conversationiq.com/changelog.rss](https://api.conversationiq.com/changelog.rss)
- **GitHub**: [https://github.com/conversationiq/api-changelog](https://github.com/conversationiq/api-changelog)

---

*Last updated: January 2025*  
*API Version: 1.2.0*