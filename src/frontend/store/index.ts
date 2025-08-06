/**
 * Redux Store Configuration
 * Central state management for ConversationIQ frontend
 */

import { configureStore } from '@reduxjs/toolkit';
import appSlice from './slices/app-slice';
import conversationSlice from './slices/conversation-slice';
import suggestionsSlice from './slices/suggestions-slice';
import analyticsSlice from './slices/analytics-slice';
import teamSlice from './slices/team-slice';

export const store = configureStore({
  reducer: {
    app: appSlice,
    conversation: conversationSlice,
    suggestions: suggestionsSlice,
    analytics: analyticsSlice,
    team: teamSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serialization
        ignoredActions: [
          'app/setConnectionStatus',
          'conversation/setLastUpdated',
          'suggestions/setTimestamp',
        ],
        // Ignore these paths in the state
        ignoredPaths: [
          'app.lastActivity',
          'conversation.lastUpdated',
          'suggestions.timestamp',
        ],
      },
    }),
  devTools: __DEV__,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export { useAppDispatch, useAppSelector } from './hooks';