/**
 * Team State Slice
 * Manages team metrics and manager dashboard data
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type {
  TeamMetrics,
  AgentPerformance,
  ConversationInsight,
} from '../../types';

interface TeamState {
  metrics: TeamMetrics | null;
  agents: AgentPerformance[];
  insights: ConversationInsight[];

  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const initialState: TeamState = {
  metrics: null,
  agents: [],
  insights: [],

  loading: false,
  error: null,
  lastUpdated: null,
};

const teamSlice = createSlice({
  name: 'team',
  initialState,
  reducers: {
    setTeamMetrics: (state, action: PayloadAction<TeamMetrics>) => {
      state.metrics = action.payload;
      state.lastUpdated = new Date();
    },

    setAgents: (state, action: PayloadAction<AgentPerformance[]>) => {
      state.agents = action.payload;
    },

    setInsights: (state, action: PayloadAction<ConversationInsight[]>) => {
      state.insights = action.payload;
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { setTeamMetrics, setAgents, setInsights, setLoading, setError } =
  teamSlice.actions;
export default teamSlice.reducer;
