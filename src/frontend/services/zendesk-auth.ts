/**
 * Zendesk Authentication Service
 * Handles authentication with Zendesk App Framework and ConversationIQ API
 */

import { ZendeskUser, ZendeskTicket, AppError } from '../types';

// Zendesk App Framework client
let zafClient: any = null;

// Authentication state
interface AuthState {
  token: string | null;
  user: ZendeskUser | null;
  subdomain: string | null;
  isAuthenticated: boolean;
  lastRefresh: Date | null;
}

let authState: AuthState = {
  token: null,
  user: null,
  subdomain: null,
  isAuthenticated: false,
  lastRefresh: null,
};

/**
 * Initialize Zendesk App Framework client
 */
export const initializeZendeskClient = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.ZAFClient) {
      reject(new Error('Zendesk App Framework not available'));
      return;
    }

    try {
      zafClient = window.ZAFClient.init();

      // Wait for client to be ready
      zafClient.on('app.registered', () => {
        console.log('Zendesk App Framework initialized');
        resolve(zafClient);
      });

      // Handle errors
      zafClient.on('app.error', (error: any) => {
        console.error('Zendesk App Framework error:', error);
        reject(new Error(`Zendesk initialization failed: ${error.message}`));
      });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Get current Zendesk user information
 */
export const getCurrentUser = async (): Promise<ZendeskUser | null> => {
  if (!zafClient) {
    await initializeZendeskClient();
  }

  try {
    const userData = await zafClient.get('currentUser');
    const user = userData.currentUser;

    const zendeskUser: ZendeskUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as 'admin' | 'agent' | 'end_user',
      locale: user.locale,
      timezone: user.timeZone?.ianaName || 'UTC',
    };

    authState.user = zendeskUser;
    return zendeskUser;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
};

/**
 * Get current ticket information
 */
export const getCurrentTicket = async (): Promise<ZendeskTicket | null> => {
  if (!zafClient) {
    await initializeZendeskClient();
  }

  try {
    const ticketData = await zafClient.get('ticket');
    const ticket = ticketData.ticket;

    const zendeskTicket: ZendeskTicket = {
      id: ticket.id,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      type: ticket.type,
      requester: {
        id: ticket.requester.id,
        name: ticket.requester.name,
        email: ticket.requester.email,
      },
      assignee: ticket.assignee
        ? {
            id: ticket.assignee.id,
            name: ticket.assignee.name,
          }
        : undefined,
      tags: ticket.tags || [],
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };

    return zendeskTicket;
  } catch (error) {
    console.error('Failed to get current ticket:', error);
    return null;
  }
};

/**
 * Get Zendesk subdomain
 */
export const getSubdomain = async (): Promise<string | null> => {
  if (!zafClient) {
    await initializeZendeskClient();
  }

  try {
    const contextData = await zafClient.context();
    const subdomain = contextData.account?.subdomain;
    authState.subdomain = subdomain || null;
    return subdomain || null;
  } catch (error) {
    console.error('Failed to get subdomain:', error);
    return null;
  }
};

/**
 * Authenticate with ConversationIQ API using Zendesk OAuth
 */
export const authenticateWithAPI = async (): Promise<string | null> => {
  try {
    const user = await getCurrentUser();
    const subdomain = await getSubdomain();

    if (!user || !subdomain) {
      throw new Error('Missing user or subdomain information');
    }

    // Request OAuth token from ConversationIQ API
    const response = await fetch(`${getAPIUrl()}/auth/zendesk/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Zendesk-Subdomain': subdomain,
      },
      body: JSON.stringify({
        userId: user.id,
        userEmail: user.email,
        subdomain: subdomain,
        timestamp: Date.now(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const data = await response.json();
    const token = data.token;

    if (!token) {
      throw new Error('No token received from API');
    }

    // Update auth state
    authState.token = token;
    authState.isAuthenticated = true;
    authState.lastRefresh = new Date();

    return token;
  } catch (error) {
    console.error('API authentication failed:', error);
    authState.isAuthenticated = false;
    authState.token = null;
    throw error;
  }
};

/**
 * Get current authentication state
 */
export const getZendeskAuth = async () => {
  // Check if we need to refresh authentication
  const now = new Date();
  const shouldRefresh =
    !authState.token ||
    !authState.lastRefresh ||
    now.getTime() - authState.lastRefresh.getTime() > 55 * 60 * 1000; // 55 minutes

  if (shouldRefresh) {
    try {
      await authenticateWithAPI();
      await getCurrentUser();
      await getSubdomain();
    } catch (error) {
      console.error('Failed to refresh authentication:', error);
    }
  }

  return {
    token: authState.token,
    user: authState.user,
    subdomain: authState.subdomain,
    isAuthenticated: authState.isAuthenticated,
  };
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return authState.isAuthenticated && !!authState.token;
};

/**
 * Logout and clear authentication state
 */
export const logout = (): void => {
  authState = {
    token: null,
    user: null,
    subdomain: null,
    isAuthenticated: false,
    lastRefresh: null,
  };
};

/**
 * Get API URL from app settings or environment
 */
const getAPIUrl = (): string => {
  return window.__ZENDESK_APP_SETTINGS__?.api_url || 'http://localhost:3000';
};

/**
 * Make authenticated request to ConversationIQ API
 */
export const makeAuthenticatedRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const auth = await getZendeskAuth();

  if (!auth.isAuthenticated || !auth.token) {
    throw new Error('Not authenticated');
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${auth.token}`,
    'X-Zendesk-Subdomain': auth.subdomain || '',
    ...options.headers,
  };

  return fetch(`${getAPIUrl()}${endpoint}`, {
    ...options,
    headers,
  });
};

/**
 * Listen for ticket changes
 */
export const onTicketChange = (
  callback: (ticket: ZendeskTicket) => void
): void => {
  if (!zafClient) return;

  zafClient.on('ticket.save', async () => {
    const ticket = await getCurrentTicket();
    if (ticket) {
      callback(ticket);
    }
  });

  zafClient.on('ticket.status.changed', async () => {
    const ticket = await getCurrentTicket();
    if (ticket) {
      callback(ticket);
    }
  });
};

/**
 * Listen for comment changes
 */
export const onCommentAdded = (callback: (comment: any) => void): void => {
  if (!zafClient) return;

  zafClient.on('comment.save', (data: any) => {
    callback(data);
  });
};

/**
 * Resize the app iframe
 */
export const resizeApp = (height?: number): void => {
  if (!zafClient) return;

  if (height) {
    zafClient.invoke('resize', { width: '100%', height: `${height}px` });
  } else {
    // Auto-resize based on content
    zafClient.invoke('resize', { width: '100%', height: 'auto' });
  }
};

/**
 * Show notification in Zendesk
 */
export const showNotification = (
  message: string,
  type: 'notice' | 'alert' | 'error' = 'notice'
): void => {
  if (!zafClient) return;

  zafClient.invoke('notify', message, type);
};

/**
 * Insert text into the comment box
 */
export const insertTextIntoComment = (text: string): void => {
  if (!zafClient) return;

  zafClient.invoke('comment.appendText', text);
};

// Global error handler for auth errors
window.addEventListener('auth-error', (event: any) => {
  console.error('Authentication error:', event.detail);
  logout();
  showNotification('Authentication expired. Please refresh the page.', 'error');
});

// Declare global types
declare global {
  interface Window {
    ZAFClient: any;
  }
}
