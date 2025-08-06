/**
 * App State Slice
 * Global application state management
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ZendeskUser, ZendeskTicket, AppError } from '../../types';

interface AppState {
  // Authentication & User
  user: ZendeskUser | null;
  ticket: ZendeskTicket | null;
  isAuthenticated: boolean;

  // Connection Status
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastActivity: Date | null;

  // Loading & Errors
  isLoading: boolean;
  error: AppError | null;

  // UI State
  activeTab: 'sentiment' | 'suggestions' | 'analytics';
  sidebarExpanded: boolean;
  notificationsEnabled: boolean;

  // App Settings
  settings: {
    autoRefresh: boolean;
    refreshInterval: number; // seconds
    theme: 'light' | 'dark' | 'auto';
    compactMode: boolean;
    escalationThreshold: number;
  };

  // Real-time Status
  subscriptionsActive: string[]; // List of active subscription IDs
  websocketConnected: boolean;
}

const initialState: AppState = {
  user: null,
  ticket: null,
  isAuthenticated: false,

  connectionStatus: 'connecting',
  lastActivity: null,

  isLoading: false,
  error: null,

  activeTab: 'sentiment',
  sidebarExpanded: true,
  notificationsEnabled: true,

  settings: {
    autoRefresh: true,
    refreshInterval: 30,
    theme: 'light',
    compactMode: false,
    escalationThreshold: 0.7,
  },

  subscriptionsActive: [],
  websocketConnected: false,
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    // Authentication & User Actions
    setUser: (state, action: PayloadAction<ZendeskUser | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },

    setTicket: (state, action: PayloadAction<ZendeskTicket | null>) => {
      state.ticket = action.payload;
    },

    setAuthenticated: (state, action: PayloadAction<boolean>) => {
      state.isAuthenticated = action.payload;
      if (!action.payload) {
        state.user = null;
      }
    },

    // Connection Status
    setConnectionStatus: (
      state,
      action: PayloadAction<
        'connecting' | 'connected' | 'disconnected' | 'error'
      >
    ) => {
      state.connectionStatus = action.payload;
      if (action.payload === 'connected') {
        state.lastActivity = new Date();
        state.websocketConnected = true;
      } else {
        state.websocketConnected = false;
      }
    },

    updateLastActivity: state => {
      state.lastActivity = new Date();
    },

    // Loading & Error Management
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setError: (state, action: PayloadAction<AppError | null>) => {
      state.error = action.payload;
      if (action.payload) {
        state.isLoading = false;
      }
    },

    clearError: state => {
      state.error = null;
    },

    // UI State Management
    setActiveTab: (
      state,
      action: PayloadAction<'sentiment' | 'suggestions' | 'analytics'>
    ) => {
      state.activeTab = action.payload;
    },

    toggleSidebar: state => {
      state.sidebarExpanded = !state.sidebarExpanded;
    },

    setSidebarExpanded: (state, action: PayloadAction<boolean>) => {
      state.sidebarExpanded = action.payload;
    },

    setNotificationsEnabled: (state, action: PayloadAction<boolean>) => {
      state.notificationsEnabled = action.payload;
    },

    // Settings Management
    updateSettings: (
      state,
      action: PayloadAction<Partial<AppState['settings']>>
    ) => {
      state.settings = { ...state.settings, ...action.payload };
    },

    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'auto'>) => {
      state.settings.theme = action.payload;
    },

    setCompactMode: (state, action: PayloadAction<boolean>) => {
      state.settings.compactMode = action.payload;
    },

    setAutoRefresh: (state, action: PayloadAction<boolean>) => {
      state.settings.autoRefresh = action.payload;
    },

    setRefreshInterval: (state, action: PayloadAction<number>) => {
      state.settings.refreshInterval = action.payload;
    },

    setEscalationThreshold: (state, action: PayloadAction<number>) => {
      state.settings.escalationThreshold = Math.max(
        0,
        Math.min(1, action.payload)
      );
    },

    // Subscription Management
    addActiveSubscription: (state, action: PayloadAction<string>) => {
      if (!state.subscriptionsActive.includes(action.payload)) {
        state.subscriptionsActive.push(action.payload);
      }
    },

    removeActiveSubscription: (state, action: PayloadAction<string>) => {
      state.subscriptionsActive = state.subscriptionsActive.filter(
        id => id !== action.payload
      );
    },

    clearActiveSubscriptions: state => {
      state.subscriptionsActive = [];
    },

    setWebsocketConnected: (state, action: PayloadAction<boolean>) => {
      state.websocketConnected = action.payload;
    },

    // Reset State
    resetAppState: state => {
      return { ...initialState, settings: state.settings }; // Preserve settings
    },
  },
});

export const {
  setUser,
  setTicket,
  setAuthenticated,
  setConnectionStatus,
  updateLastActivity,
  setLoading,
  setError,
  clearError,
  setActiveTab,
  toggleSidebar,
  setSidebarExpanded,
  setNotificationsEnabled,
  updateSettings,
  setTheme,
  setCompactMode,
  setAutoRefresh,
  setRefreshInterval,
  setEscalationThreshold,
  addActiveSubscription,
  removeActiveSubscription,
  clearActiveSubscriptions,
  setWebsocketConnected,
  resetAppState,
} = appSlice.actions;

export default appSlice.reducer;

// Selectors
export const selectUser = (state: { app: AppState }) => state.app.user;
export const selectTicket = (state: { app: AppState }) => state.app.ticket;
export const selectIsAuthenticated = (state: { app: AppState }) =>
  state.app.isAuthenticated;
export const selectConnectionStatus = (state: { app: AppState }) =>
  state.app.connectionStatus;
export const selectIsLoading = (state: { app: AppState }) =>
  state.app.isLoading;
export const selectError = (state: { app: AppState }) => state.app.error;
export const selectActiveTab = (state: { app: AppState }) =>
  state.app.activeTab;
export const selectSettings = (state: { app: AppState }) => state.app.settings;
export const selectWebsocketConnected = (state: { app: AppState }) =>
  state.app.websocketConnected;
