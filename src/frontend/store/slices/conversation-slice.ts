/**
 * Conversation State Slice
 * Manages current conversation data and sentiment analysis
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type {
  RealtimeConversationData,
  SentimentAnalysis,
  MessageTimelineItem,
  ConversationAnalytics,
} from '../../types';

interface ConversationState {
  // Current Conversation
  currentConversationId: string | null;
  conversationData: RealtimeConversationData | null;

  // Messages & Timeline
  messages: MessageTimelineItem[];
  filteredMessages: MessageTimelineItem[];
  messageFilter: 'all' | 'negative' | 'alerts';

  // Sentiment Analysis
  overallSentiment: SentimentAnalysis | null;
  sentimentHistory: Array<{
    timestamp: Date;
    sentiment: SentimentAnalysis;
  }>;

  // Analytics
  analytics: ConversationAnalytics | null;

  // Loading States
  loadingConversation: boolean;
  loadingSentiment: boolean;
  loadingAnalytics: boolean;

  // Last Updated
  lastUpdated: Date | null;

  // Error States
  conversationError: string | null;
  sentimentError: string | null;
  analyticsError: string | null;
}

const initialState: ConversationState = {
  currentConversationId: null,
  conversationData: null,

  messages: [],
  filteredMessages: [],
  messageFilter: 'all',

  overallSentiment: null,
  sentimentHistory: [],

  analytics: null,

  loadingConversation: false,
  loadingSentiment: false,
  loadingAnalytics: false,

  lastUpdated: null,

  conversationError: null,
  sentimentError: null,
  analyticsError: null,
};

const conversationSlice = createSlice({
  name: 'conversation',
  initialState,
  reducers: {
    // Conversation Management
    setCurrentConversationId: (state, action: PayloadAction<string | null>) => {
      state.currentConversationId = action.payload;
      if (!action.payload) {
        // Clear data when conversation changes
        state.conversationData = null;
        state.messages = [];
        state.filteredMessages = [];
        state.overallSentiment = null;
        state.analytics = null;
      }
    },

    setConversationData: (
      state,
      action: PayloadAction<RealtimeConversationData>
    ) => {
      state.conversationData = action.payload;
      state.lastUpdated = new Date();
      state.conversationError = null;
    },

    updateConversationData: (
      state,
      action: PayloadAction<Partial<RealtimeConversationData>>
    ) => {
      if (state.conversationData) {
        state.conversationData = {
          ...state.conversationData,
          ...action.payload,
        };
        state.lastUpdated = new Date();
      }
    },

    // Messages Management
    setMessages: (state, action: PayloadAction<MessageTimelineItem[]>) => {
      state.messages = action.payload;
      state.filteredMessages = filterMessages(
        action.payload,
        state.messageFilter
      );
    },

    addMessage: (state, action: PayloadAction<MessageTimelineItem>) => {
      const existingIndex = state.messages.findIndex(
        msg => msg.id === action.payload.id
      );
      if (existingIndex >= 0) {
        state.messages[existingIndex] = action.payload;
      } else {
        state.messages.push(action.payload);
        // Keep messages sorted by timestamp
        state.messages.sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );
      }
      state.filteredMessages = filterMessages(
        state.messages,
        state.messageFilter
      );
    },

    updateMessage: (
      state,
      action: PayloadAction<{
        id: string;
        updates: Partial<MessageTimelineItem>;
      }>
    ) => {
      const { id, updates } = action.payload;
      const messageIndex = state.messages.findIndex(msg => msg.id === id);
      if (messageIndex >= 0) {
        state.messages[messageIndex] = {
          ...state.messages[messageIndex],
          ...updates,
        };
        state.filteredMessages = filterMessages(
          state.messages,
          state.messageFilter
        );
      }
    },

    setMessageFilter: (
      state,
      action: PayloadAction<'all' | 'negative' | 'alerts'>
    ) => {
      state.messageFilter = action.payload;
      state.filteredMessages = filterMessages(state.messages, action.payload);
    },

    // Sentiment Management
    setOverallSentiment: (state, action: PayloadAction<SentimentAnalysis>) => {
      state.overallSentiment = action.payload;

      // Add to sentiment history (keep last 50 entries)
      state.sentimentHistory.push({
        timestamp: new Date(),
        sentiment: action.payload,
      });

      if (state.sentimentHistory.length > 50) {
        state.sentimentHistory = state.sentimentHistory.slice(-50);
      }

      state.sentimentError = null;
    },

    updateSentimentForMessage: (
      state,
      action: PayloadAction<{ messageId: string; sentiment: SentimentAnalysis }>
    ) => {
      const { messageId, sentiment } = action.payload;
      const messageIndex = state.messages.findIndex(
        msg => msg.id === messageId
      );
      if (messageIndex >= 0) {
        state.messages[messageIndex].sentiment = sentiment;
        state.filteredMessages = filterMessages(
          state.messages,
          state.messageFilter
        );
      }
    },

    // Analytics Management
    setAnalytics: (state, action: PayloadAction<ConversationAnalytics>) => {
      state.analytics = action.payload;
      state.analyticsError = null;
    },

    updateAnalytics: (
      state,
      action: PayloadAction<Partial<ConversationAnalytics>>
    ) => {
      if (state.analytics) {
        state.analytics = { ...state.analytics, ...action.payload };
      }
    },

    // Loading States
    setLoadingConversation: (state, action: PayloadAction<boolean>) => {
      state.loadingConversation = action.payload;
    },

    setLoadingSentiment: (state, action: PayloadAction<boolean>) => {
      state.loadingSentiment = action.payload;
    },

    setLoadingAnalytics: (state, action: PayloadAction<boolean>) => {
      state.loadingAnalytics = action.payload;
    },

    // Error States
    setConversationError: (state, action: PayloadAction<string | null>) => {
      state.conversationError = action.payload;
      if (action.payload) {
        state.loadingConversation = false;
      }
    },

    setSentimentError: (state, action: PayloadAction<string | null>) => {
      state.sentimentError = action.payload;
      if (action.payload) {
        state.loadingSentiment = false;
      }
    },

    setAnalyticsError: (state, action: PayloadAction<string | null>) => {
      state.analyticsError = action.payload;
      if (action.payload) {
        state.loadingAnalytics = false;
      }
    },

    // Utility Actions
    setLastUpdated: state => {
      state.lastUpdated = new Date();
    },

    clearConversationData: state => {
      return { ...initialState };
    },
  },
});

// Helper function to filter messages
function filterMessages(
  messages: MessageTimelineItem[],
  filter: 'all' | 'negative' | 'alerts'
): MessageTimelineItem[] {
  switch (filter) {
    case 'negative':
      return messages.filter(
        msg => msg.sentiment.label === 'NEGATIVE' && msg.sentiment.score < -0.3
      );
    case 'alerts':
      return messages.filter(msg => msg.isAlert);
    default:
      return messages;
  }
}

export const {
  setCurrentConversationId,
  setConversationData,
  updateConversationData,
  setMessages,
  addMessage,
  updateMessage,
  setMessageFilter,
  setOverallSentiment,
  updateSentimentForMessage,
  setAnalytics,
  updateAnalytics,
  setLoadingConversation,
  setLoadingSentiment,
  setLoadingAnalytics,
  setConversationError,
  setSentimentError,
  setAnalyticsError,
  setLastUpdated,
  clearConversationData,
} = conversationSlice.actions;

export default conversationSlice.reducer;

// Selectors
export const selectCurrentConversationId = (state: {
  conversation: ConversationState;
}) => state.conversation.currentConversationId;

export const selectConversationData = (state: {
  conversation: ConversationState;
}) => state.conversation.conversationData;

export const selectMessages = (state: { conversation: ConversationState }) =>
  state.conversation.messages;

export const selectFilteredMessages = (state: {
  conversation: ConversationState;
}) => state.conversation.filteredMessages;

export const selectMessageFilter = (state: {
  conversation: ConversationState;
}) => state.conversation.messageFilter;

export const selectOverallSentiment = (state: {
  conversation: ConversationState;
}) => state.conversation.overallSentiment;

export const selectSentimentHistory = (state: {
  conversation: ConversationState;
}) => state.conversation.sentimentHistory;

export const selectAnalytics = (state: { conversation: ConversationState }) =>
  state.conversation.analytics;

export const selectIsLoadingConversation = (state: {
  conversation: ConversationState;
}) => state.conversation.loadingConversation;

export const selectIsLoadingSentiment = (state: {
  conversation: ConversationState;
}) => state.conversation.loadingSentiment;

export const selectIsLoadingAnalytics = (state: {
  conversation: ConversationState;
}) => state.conversation.loadingAnalytics;
