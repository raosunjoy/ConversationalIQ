/**
 * GraphQL schema definitions for ConversationIQ
 * Defines types, queries, mutations, and subscriptions
 */

import gql from 'graphql-tag';

export const typeDefs = gql`
  # Scalar types
  scalar DateTime
  scalar JSON

  # Enums
  enum ConversationStatus {
    OPEN
    PENDING
    SOLVED
    CLOSED
  }

  enum MessageSender {
    AGENT
    CUSTOMER
    SYSTEM
  }

  enum SuggestionType {
    RESPONSE
    MACRO
    ESCALATION
    CLOSE
  }

  # Core types
  type Conversation {
    id: ID!
    ticketId: String!
    agentId: String!
    customerId: String!
    status: ConversationStatus!
    priority: String
    tags: [String!]
    createdAt: DateTime!
    updatedAt: DateTime!
    
    # Relations
    messages: [Message!]!
    analytics: ConversationAnalytics
    agent: Agent
    customer: Customer
  }

  type Message {
    id: ID!
    conversationId: ID!
    content: String!
    sender: MessageSender!
    sentimentScore: Float
    detectedIntent: String
    confidence: Float
    isProcessed: Boolean!
    metadata: JSON
    createdAt: DateTime!
    
    # Relations
    conversation: Conversation!
    responseSuggestions: [ResponseSuggestion!]!
    analysis: MessageAnalysis
  }

  type ResponseSuggestion {
    id: ID!
    messageId: ID!
    suggestedResponse: String!
    confidence: Float!
    type: SuggestionType!
    macroId: String
    reasoning: String
    isAccepted: Boolean
    isRejected: Boolean
    createdAt: DateTime!
    
    # Relations
    message: Message!
  }

  type MessageAnalysis {
    id: ID!
    messageId: ID!
    sentimentScore: Float!
    sentimentLabel: String!
    emotionScores: JSON
    detectedIntent: String!
    intentConfidence: Float!
    keyPhrases: [String!]!
    entities: JSON
    urgencyScore: Float
    escalationProbability: Float
    processingTime: Int!
    createdAt: DateTime!
    
    # Relations
    message: Message!
  }

  type ConversationAnalytics {
    id: ID!
    conversationId: ID!
    totalMessages: Int!
    averageSentiment: Float!
    sentimentTrend: [Float!]!
    responseTime: Float!
    resolutionTime: Float
    escalated: Boolean!
    customerSatisfaction: Float
    agentPerformance: Float
    updatedAt: DateTime!
    
    # Relations
    conversation: Conversation!
  }

  type Analytics {
    totalConversations: Int!
    averageSentiment: Float!
    responseTime: Float!
    resolutionRate: Float!
    escalationRate: Float!
    customerSatisfaction: Float!
    agentPerformance: Float!
    intentDistribution: JSON!
    sentimentDistribution: JSON!
    timeRangeStats: JSON!
  }

  type Agent {
    id: ID!
    email: String!
    name: String!
    role: String!
    zendeskId: String
    subdomain: String
    isActive: Boolean!
    lastActiveAt: DateTime
    createdAt: DateTime!
    
    # Relations
    conversations: [Conversation!]!
    performance: AgentPerformance
  }

  type Customer {
    id: ID!
    email: String!
    name: String
    zendeskId: String
    isVip: Boolean!
    createdAt: DateTime!
    
    # Relations
    conversations: [Conversation!]!
  }

  type AgentPerformance {
    id: ID!
    agentId: ID!
    date: DateTime!
    conversationsHandled: Int!
    averageResponseTime: Float!
    averageResolutionTime: Float!
    customerSatisfaction: Float!
    escalationRate: Float!
    suggestionAcceptanceRate: Float!
    efficiency: Float!
    
    # Relations
    agent: Agent!
  }

  # Input types
  input ConversationInput {
    ticketId: String!
    agentId: String!
    customerId: String!
    status: ConversationStatus!
    priority: String
    tags: [String!]
  }

  input MessageInput {
    conversationId: ID!
    content: String!
    sender: MessageSender!
    metadata: JSON
  }

  input ConversationUpdateInput {
    status: ConversationStatus
    priority: String
    tags: [String!]
  }

  input AnalyticsFilter {
    agentId: String
    dateFrom: DateTime
    dateTo: DateTime
    status: ConversationStatus
    sentiment: String
    intent: String
  }

  input PaginationInput {
    limit: Int = 20
    offset: Int = 0
    sortBy: String = "createdAt"
    sortOrder: String = "DESC"
  }

  # Query type
  type Query {
    # Conversation queries
    conversation(id: ID!): Conversation
    conversations(
      filter: AnalyticsFilter
      pagination: PaginationInput
    ): [Conversation!]!
    
    # Message queries
    message(id: ID!): Message
    messages(
      conversationId: ID!
      pagination: PaginationInput
    ): [Message!]!
    
    # Response suggestion queries
    responseSuggestions(messageId: ID!): [ResponseSuggestion!]!
    suggestion(id: ID!): ResponseSuggestion
    
    # Analytics queries
    agentAnalytics(
      agentId: String!
      filter: AnalyticsFilter
    ): Analytics!
    conversationAnalytics(
      conversationId: ID!
    ): ConversationAnalytics
    teamAnalytics(
      filter: AnalyticsFilter
    ): Analytics!
    
    # Agent queries
    agent(id: ID!): Agent
    agents(isActive: Boolean): [Agent!]!
    agentPerformance(
      agentId: ID!
      dateFrom: DateTime
      dateTo: DateTime
    ): [AgentPerformance!]!
    
    # Customer queries
    customer(id: ID!): Customer
    customers(pagination: PaginationInput): [Customer!]!
  }

  # Mutation type
  type Mutation {
    # Conversation mutations
    createConversation(input: ConversationInput!): Conversation!
    updateConversation(
      id: ID!
      input: ConversationUpdateInput!
    ): Conversation!
    closeConversation(id: ID!): Conversation!
    
    # Message mutations
    createMessage(input: MessageInput!): Message!
    analyzeMessage(messageId: ID!): MessageAnalysis!
    
    # Response suggestion mutations
    generateResponseSuggestions(messageId: ID!): [ResponseSuggestion!]!
    acceptSuggestion(suggestionId: ID!): ResponseSuggestion!
    rejectSuggestion(suggestionId: ID!): ResponseSuggestion!
    
    # Agent mutations
    updateAgentStatus(agentId: ID!, isActive: Boolean!): Agent!
    recordAgentActivity(agentId: ID!): Agent!
  }

  # Agent status enum
  enum AgentStatus {
    ONLINE
    OFFLINE
    BUSY
    AWAY
  }

  # Subscription payload types
  type SentimentAnalysis {
    messageId: ID!
    conversationId: ID!
    score: Float!
    confidence: Float!
    emotions: [String!]!
  }

  type ResponseSuggestionPayload {
    conversationId: ID!
    suggestions: [ResponseSuggestion!]!
  }

  type AgentStatusPayload {
    agentId: ID!
    status: AgentStatus!
    timestamp: DateTime!
  }

  type ConversationAssignment {
    conversationId: ID!
    agentId: ID!
    assignedAt: DateTime!
  }

  # Subscription type
  type Subscription {
    # Real-time message updates
    messageAdded(conversationId: ID): Message!
    
    # Real-time conversation updates
    conversationUpdated(conversationId: ID): Conversation!
    
    # Real-time sentiment analysis
    sentimentAnalyzed(conversationId: ID): SentimentAnalysis!
    
    # Real-time response suggestions
    responseSuggested(conversationId: ID): ResponseSuggestionPayload!
    
    # Agent status updates
    agentStatusChanged(agentId: ID): AgentStatusPayload!
    
    # Conversation assignments
    conversationAssigned(agentId: ID): ConversationAssignment!
  }
`;