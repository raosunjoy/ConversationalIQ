/**
 * Analytics State Slice
 * Manages conversation analytics and performance metrics
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AnalyticsState {
  // Conversation Analytics
  averageResponseTime: number;
  messageCount: number;
  escalationRisk: number;
  customerSatisfactionPredict: number;
  keyTopics: string[];
  conversationHealth: 'excellent' | 'good' | 'concerning' | 'critical';

  // Trends
  sentimentTrend: 'improving' | 'declining' | 'stable';
  responseTimeTrend: number[]; // Last 10 response times

  // Loading & Error States
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const initialState: AnalyticsState = {
  averageResponseTime: 0,
  messageCount: 0,
  escalationRisk: 0,
  customerSatisfactionPredict: 0,
  keyTopics: [],
  conversationHealth: 'good',

  sentimentTrend: 'stable',
  responseTimeTrend: [],

  loading: false,
  error: null,
  lastUpdated: null,
};

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    setAnalytics: (state, action: PayloadAction<Partial<AnalyticsState>>) => {
      Object.assign(state, action.payload);
      state.lastUpdated = new Date();
      state.error = null;
    },

    updateResponseTime: (state, action: PayloadAction<number>) => {
      state.responseTimeTrend.push(action.payload);
      if (state.responseTimeTrend.length > 10) {
        state.responseTimeTrend = state.responseTimeTrend.slice(-10);
      }

      // Calculate average
      state.averageResponseTime =
        state.responseTimeTrend.reduce((sum, time) => sum + time, 0) /
        state.responseTimeTrend.length;
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { setAnalytics, updateResponseTime, setLoading, setError } =
  analyticsSlice.actions;
export default analyticsSlice.reducer;
