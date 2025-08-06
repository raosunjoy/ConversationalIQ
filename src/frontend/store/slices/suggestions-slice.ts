/**
 * Suggestions State Slice
 * Manages AI response suggestions and user interactions
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ResponseSuggestion } from '../../types';

interface SuggestionsState {
  suggestions: ResponseSuggestion[];
  loading: boolean;
  error: string | null;
  timestamp: Date | null;

  // User Interactions
  appliedSuggestions: string[]; // IDs of suggestions used
  feedbackGiven: Record<string, { rating: number; helpful: boolean }>;

  // Filters & Preferences
  categoryFilter: string[];
  minConfidence: number;
  showOnlyRelevant: boolean;
}

const initialState: SuggestionsState = {
  suggestions: [],
  loading: false,
  error: null,
  timestamp: null,

  appliedSuggestions: [],
  feedbackGiven: {},

  categoryFilter: [],
  minConfidence: 0.6,
  showOnlyRelevant: false,
};

const suggestionsSlice = createSlice({
  name: 'suggestions',
  initialState,
  reducers: {
    setSuggestions: (state, action: PayloadAction<ResponseSuggestion[]>) => {
      state.suggestions = action.payload;
      state.timestamp = new Date();
      state.error = null;
    },

    addSuggestion: (state, action: PayloadAction<ResponseSuggestion>) => {
      const existingIndex = state.suggestions.findIndex(
        s => s.id === action.payload.id
      );
      if (existingIndex >= 0) {
        state.suggestions[existingIndex] = action.payload;
      } else {
        state.suggestions.push(action.payload);
      }
      state.timestamp = new Date();
    },

    applySuggestion: (state, action: PayloadAction<string>) => {
      const suggestionId = action.payload;
      if (!state.appliedSuggestions.includes(suggestionId)) {
        state.appliedSuggestions.push(suggestionId);
      }
    },

    provideFeedback: (
      state,
      action: PayloadAction<{ id: string; rating: number; helpful: boolean }>
    ) => {
      const { id, rating, helpful } = action.payload;
      state.feedbackGiven[id] = { rating, helpful };
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      if (action.payload) {
        state.loading = false;
      }
    },

    setCategoryFilter: (state, action: PayloadAction<string[]>) => {
      state.categoryFilter = action.payload;
    },

    setMinConfidence: (state, action: PayloadAction<number>) => {
      state.minConfidence = Math.max(0, Math.min(1, action.payload));
    },

    setShowOnlyRelevant: (state, action: PayloadAction<boolean>) => {
      state.showOnlyRelevant = action.payload;
    },

    clearSuggestions: state => {
      state.suggestions = [];
      state.timestamp = null;
      state.error = null;
    },
  },
});

export const {
  setSuggestions,
  addSuggestion,
  applySuggestion,
  provideFeedback,
  setLoading,
  setError,
  setCategoryFilter,
  setMinConfidence,
  setShowOnlyRelevant,
  clearSuggestions,
} = suggestionsSlice.actions;

export default suggestionsSlice.reducer;
