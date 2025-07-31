/**
 * ConversationIQ Zendesk App Client-Side JavaScript
 * Handles communication with Zendesk Apps Framework and ConversationIQ API
 */

(function () {
  'use strict';

  // App state management
  const AppState = {
    client: null,
    settings: {},
    context: {},
    connectionStatus: 'connecting',
    currentTicket: null,
    sentimentData: null,
    suggestions: [],
    analytics: {},
    isInitialized: false,
  };

  // API configuration
  const API_CONFIG = {
    baseUrl: null, // Will be set from app settings
    endpoints: {
      sentiment: '/api/v1/sentiment',
      suggestions: '/api/v1/suggestions',
      analytics: '/api/v1/analytics',
      events: '/api/v1/events',
    },
  };

  // WebSocket connection for real-time updates
  let wsConnection = null;

  /**
   * Initialize the Zendesk App
   */
  function initializeApp() {
    showLoadingState();

    // Initialize Zendesk Apps Framework client
    ZAFClient.init()
      .then(function (client) {
        AppState.client = client;
        console.log('ConversationIQ: Zendesk client initialized');

        // Get app settings and context
        return Promise.all([
          client.metadata(),
          client.context(),
          client.get('currentUser'),
          client.get('ticket'),
        ]);
      })
      .then(function ([metadata, context, currentUser, ticket]) {
        AppState.settings = metadata.settings;
        AppState.context = context;
        AppState.currentUser = currentUser.currentUser;
        AppState.currentTicket = ticket.ticket;

        // Validate required settings
        if (!AppState.settings.api_url || !AppState.settings.api_key) {
          throw new Error(
            'Missing required app configuration. Please configure API URL and API Key in app settings.'
          );
        }

        API_CONFIG.baseUrl = AppState.settings.api_url;

        console.log('ConversationIQ: App context loaded', {
          ticketId: AppState.currentTicket?.id,
          userId: AppState.currentUser?.id,
        });

        // Initialize API connection
        return initializeApiConnection();
      })
      .then(function () {
        // Initialize UI components
        initializeUI();

        // Setup event listeners
        setupEventListeners();

        // Load initial data
        return loadInitialData();
      })
      .then(function () {
        AppState.isInitialized = true;
        hideLoadingState();
        showApp();
        updateConnectionStatus('connected');

        console.log('ConversationIQ: App fully initialized');
      })
      .catch(function (error) {
        console.error('ConversationIQ: Initialization error:', error);
        showError(error.message || 'Failed to initialize ConversationIQ');
      });
  }

  /**
   * Initialize API connection and authentication
   */
  function initializeApiConnection() {
    return new Promise(function (resolve, reject) {
      // Test API connection
      makeApiRequest('GET', '/health')
        .then(function (response) {
          console.log('ConversationIQ: API connection established');

          // Initialize WebSocket connection for real-time updates
          if (AppState.settings.enable_realtime !== false) {
            initializeWebSocket();
          }

          resolve();
        })
        .catch(function (error) {
          console.error('ConversationIQ: API connection failed:', error);
          reject(new Error('Unable to connect to ConversationIQ API'));
        });
    });
  }

  /**
   * Initialize WebSocket connection for real-time updates
   */
  function initializeWebSocket() {
    if (!API_CONFIG.baseUrl) return;

    const wsUrl = API_CONFIG.baseUrl.replace(/^http/, 'ws') + '/graphql';

    try {
      wsConnection = new WebSocket(wsUrl, 'graphql-ws');

      wsConnection.onopen = function () {
        console.log('ConversationIQ: WebSocket connected');

        // Send connection init message
        wsConnection.send(
          JSON.stringify({
            type: 'connection_init',
            payload: {
              authorization: 'Bearer ' + AppState.settings.api_key,
            },
          })
        );
      };

      wsConnection.onmessage = function (event) {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      };

      wsConnection.onerror = function (error) {
        console.error('ConversationIQ: WebSocket error:', error);
      };

      wsConnection.onclose = function () {
        console.log('ConversationIQ: WebSocket disconnected');
        // Attempt reconnection after 5 seconds
        setTimeout(initializeWebSocket, 5000);
      };
    } catch (error) {
      console.error('ConversationIQ: WebSocket initialization failed:', error);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  function handleWebSocketMessage(message) {
    switch (message.type) {
      case 'connection_ack':
        console.log('ConversationIQ: WebSocket connection acknowledged');
        subscribeToRealTimeUpdates();
        break;

      case 'data':
        if (message.payload && message.payload.data) {
          handleRealTimeUpdate(message.payload.data);
        }
        break;

      case 'error':
        console.error('ConversationIQ: WebSocket error:', message.payload);
        break;
    }
  }

  /**
   * Subscribe to real-time updates for current conversation
   */
  function subscribeToRealTimeUpdates() {
    if (!wsConnection || !AppState.currentTicket) return;

    const subscription = {
      id: 'sentiment-updates',
      type: 'start',
      payload: {
        query: `
          subscription SentimentUpdates($conversationId: String!) {
            sentimentAnalyzed(conversationId: $conversationId) {
              conversationId
              messageId
              sentimentScore
              sentiment
              confidence
              escalationRisk
              analyzedAt
            }
          }
        `,
        variables: {
          conversationId: `zendesk-${AppState.currentTicket.id}`,
        },
      },
    };

    wsConnection.send(JSON.stringify(subscription));
  }

  /**
   * Handle real-time updates from WebSocket
   */
  function handleRealTimeUpdate(data) {
    if (data.sentimentAnalyzed) {
      updateSentimentDisplay(data.sentimentAnalyzed);
    }

    if (data.messageAdded) {
      addMessageToTimeline(data.messageAdded);
    }

    if (data.responseSuggested) {
      updateSuggestions([data.responseSuggested]);
    }
  }

  /**
   * Initialize UI components and event handlers
   */
  function initializeUI() {
    // Tab navigation
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        const targetTab = this.dataset.tab;

        // Update active tab button
        tabButtons.forEach(function (btn) {
          btn.classList.remove('active');
        });
        this.classList.add('active');

        // Update active tab content
        tabContents.forEach(function (content) {
          content.classList.remove('active');
        });
        document.getElementById(targetTab + '-tab').classList.add('active');

        // Load tab-specific data
        loadTabData(targetTab);
      });
    });

    // Filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        const filter = this.dataset.filter;

        filterButtons.forEach(function (btn) {
          btn.classList.remove('active');
        });
        this.classList.add('active');

        applyTimelineFilter(filter);
      });
    });

    // Refresh suggestions button
    const refreshBtn = document.getElementById('refresh-suggestions');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        loadSuggestions(true);
      });
    }

    // FAB menu
    const fab = document.getElementById('quick-action-fab');
    const fabMenu = document.getElementById('fab-menu');

    if (fab && fabMenu) {
      fab.addEventListener('click', function () {
        fabMenu.classList.toggle('hidden');
      });

      // FAB menu items
      const fabMenuItems = document.querySelectorAll('.fab-menu-item');
      fabMenuItems.forEach(function (item) {
        item.addEventListener('click', function () {
          const action = this.dataset.action;
          handleQuickAction(action);
          fabMenu.classList.add('hidden');
        });
      });
    }

    // Retry button
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        location.reload();
      });
    }
  }

  /**
   * Setup Zendesk Apps Framework event listeners
   */
  function setupEventListeners() {
    if (!AppState.client) return;

    // Listen for ticket updates
    AppState.client.on('ticket.updated', function (data) {
      console.log('ConversationIQ: Ticket updated', data);
      handleTicketUpdate(data);
    });

    // Listen for ticket comments (new messages)
    AppState.client.on('ticket.comments.created', function (data) {
      console.log('ConversationIQ: New comment created', data);
      handleNewComment(data);
    });

    // Listen for app resize events
    AppState.client.on('app.resize', function (data) {
      handleAppResize(data);
    });
  }

  /**
   * Load initial data for the app
   */
  function loadInitialData() {
    const promises = [];

    // Load sentiment analysis for current conversation
    if (AppState.settings.enable_sentiment_analysis !== false) {
      promises.push(loadSentimentData());
    }

    // Load response suggestions
    if (AppState.settings.enable_response_suggestions !== false) {
      promises.push(loadSuggestions());
    }

    // Load analytics data
    promises.push(loadAnalytics());

    return Promise.all(promises).catch(function (error) {
      console.error('ConversationIQ: Error loading initial data:', error);
      // Don't fail completely, just log the error
    });
  }

  /**
   * Load sentiment analysis data
   */
  function loadSentimentData() {
    if (!AppState.currentTicket) return Promise.resolve();

    const conversationId = `zendesk-${AppState.currentTicket.id}`;

    return makeApiRequest('GET', `/api/v1/sentiment/${conversationId}`)
      .then(function (data) {
        AppState.sentimentData = data;
        updateSentimentDisplay(data);
        updateMessageTimeline(data.messages || []);
      })
      .catch(function (error) {
        console.error('ConversationIQ: Error loading sentiment data:', error);
      });
  }

  /**
   * Load response suggestions
   */
  function loadSuggestions(forceRefresh = false) {
    if (!AppState.currentTicket) return Promise.resolve();

    const conversationId = `zendesk-${AppState.currentTicket.id}`;
    const url = `/api/v1/suggestions/${conversationId}${forceRefresh ? '?refresh=true' : ''}`;

    return makeApiRequest('GET', url)
      .then(function (data) {
        AppState.suggestions = data.suggestions || [];
        updateSuggestionsDisplay(AppState.suggestions);
      })
      .catch(function (error) {
        console.error('ConversationIQ: Error loading suggestions:', error);
      });
  }

  /**
   * Load analytics data
   */
  function loadAnalytics() {
    if (!AppState.currentTicket) return Promise.resolve();

    const conversationId = `zendesk-${AppState.currentTicket.id}`;

    return makeApiRequest('GET', `/api/v1/analytics/${conversationId}`)
      .then(function (data) {
        AppState.analytics = data;
        updateAnalyticsDisplay(data);
      })
      .catch(function (error) {
        console.error('ConversationIQ: Error loading analytics:', error);
      });
  }

  /**
   * Update sentiment display
   */
  function updateSentimentDisplay(data) {
    const scoreElement = document.getElementById('sentiment-score');
    const indicatorElement = document.getElementById('sentiment-indicator');

    if (scoreElement && data.sentimentScore !== undefined) {
      const score = Math.round(data.sentimentScore * 100);
      scoreElement.textContent = score > 0 ? `+${score}` : score.toString();

      // Update indicator class based on sentiment
      indicatorElement.className = 'sentiment-indicator';
      if (score > 20) {
        indicatorElement.classList.add('positive');
      } else if (score < -20) {
        indicatorElement.classList.add('negative');
      } else {
        indicatorElement.classList.add('neutral');
      }
    }
  }

  /**
   * Update message timeline
   */
  function updateMessageTimeline(messages) {
    const timelineList = document.getElementById('message-timeline');
    if (!timelineList) return;

    timelineList.innerHTML = '';

    messages.forEach(function (message) {
      const item = createTimelineItem(message);
      timelineList.appendChild(item);
    });
  }

  /**
   * Create timeline item element
   */
  function createTimelineItem(message) {
    const item = document.createElement('div');
    item.className = 'timeline-item';

    const sentimentClass =
      message.sentimentScore > 0.2
        ? 'positive'
        : message.sentimentScore < -0.2
          ? 'negative'
          : 'neutral';

    const sentimentIcon =
      sentimentClass === 'positive'
        ? '😊'
        : sentimentClass === 'negative'
          ? '😞'
          : '😐';

    item.innerHTML = `
      <div class="timeline-sentiment ${sentimentClass}">
        ${sentimentIcon}
      </div>
      <div class="timeline-content">
        <div class="timeline-message">${escapeHtml(message.content.substring(0, 100))}${message.content.length > 100 ? '...' : ''}</div>
        <div class="timeline-meta">
          <span>Score: ${Math.round(message.sentimentScore * 100)}</span>
          <span>${message.sender}</span>
          <span>${formatTimestamp(message.createdAt)}</span>
        </div>
      </div>
    `;

    return item;
  }

  /**
   * Update suggestions display
   */
  function updateSuggestionsDisplay(suggestions) {
    const suggestionsContainer = document.getElementById('suggestions-list');
    if (!suggestionsContainer) return;

    suggestionsContainer.innerHTML = '';

    if (!suggestions || suggestions.length === 0) {
      suggestionsContainer.innerHTML =
        '<p class="text-center" style="color: #68737d; padding: 20px;">No suggestions available</p>';
      return;
    }

    suggestions.forEach(function (suggestion) {
      const card = createSuggestionCard(suggestion);
      suggestionsContainer.appendChild(card);
    });
  }

  /**
   * Create suggestion card element
   */
  function createSuggestionCard(suggestion) {
    const card = document.createElement('div');
    card.className = 'suggestion-card';

    const confidence = Math.round(suggestion.confidence * 100);

    card.innerHTML = `
      <div class="suggestion-header">
        <div class="suggestion-type">${suggestion.type || 'Response'}</div>
        <div class="suggestion-confidence">${confidence}% confidence</div>
      </div>
      <div class="suggestion-text">${escapeHtml(suggestion.text)}</div>
      <div class="suggestion-actions">
        <button class="btn btn-sm btn-primary" onclick="applySuggestion('${escapeHtml(suggestion.text)}')">
          Use Response
        </button>
        <button class="btn btn-sm" onclick="copySuggestion('${escapeHtml(suggestion.text)}')">
          Copy
        </button>
      </div>
    `;

    return card;
  }

  /**
   * Update analytics display
   */
  function updateAnalyticsDisplay(data) {
    // Update metric cards
    const avgResponseTime = document.getElementById('avg-response-time');
    const sentimentTrend = document.getElementById('sentiment-trend');
    const escalationRisk = document.getElementById('escalation-risk');

    if (avgResponseTime && data.averageResponseTime) {
      avgResponseTime.textContent = formatDuration(data.averageResponseTime);
    }

    if (sentimentTrend && data.sentimentTrend) {
      const trend =
        data.sentimentTrend > 0 ? '↗️' : data.sentimentTrend < 0 ? '↘️' : '→';
      sentimentTrend.textContent = trend;
    }

    if (escalationRisk && data.escalationRisk !== undefined) {
      const risk = Math.round(data.escalationRisk * 100);
      escalationRisk.textContent = `${risk}%`;
      escalationRisk.style.color =
        risk > 70 ? '#d93651' : risk > 40 ? '#ffd93d' : '#30aabc';
    }

    // Update insights
    updateInsightsDisplay(data.insights || []);
  }

  /**
   * Update insights display
   */
  function updateInsightsDisplay(insights) {
    const insightsContainer = document.getElementById('insights-list');
    if (!insightsContainer) return;

    insightsContainer.innerHTML = '';

    insights.forEach(function (insight) {
      const item = document.createElement('div');
      item.className = 'insight-item';

      const icon = getInsightIcon(insight.type);

      item.innerHTML = `
        <span class="insight-icon">${icon}</span>
        <span>${escapeHtml(insight.message)}</span>
      `;

      insightsContainer.appendChild(item);
    });
  }

  /**
   * Load tab-specific data
   */
  function loadTabData(tabName) {
    switch (tabName) {
      case 'sentiment':
        if (!AppState.sentimentData) {
          loadSentimentData();
        }
        break;
      case 'suggestions':
        if (AppState.suggestions.length === 0) {
          loadSuggestions();
        }
        break;
      case 'analytics':
        if (
          !AppState.analytics ||
          Object.keys(AppState.analytics).length === 0
        ) {
          loadAnalytics();
        }
        break;
    }
  }

  /**
   * Handle quick actions from FAB menu
   */
  function handleQuickAction(action) {
    switch (action) {
      case 'escalate':
        escalateTicket();
        break;
      case 'tag':
        addTicketTag();
        break;
      case 'note':
        addPrivateNote();
        break;
    }
  }

  /**
   * Apply suggestion to Zendesk comment
   */
  window.applySuggestion = function (text) {
    if (!AppState.client) return;

    AppState.client
      .invoke('comment.text', text)
      .then(function () {
        console.log('ConversationIQ: Suggestion applied');
      })
      .catch(function (error) {
        console.error('ConversationIQ: Error applying suggestion:', error);
      });
  };

  /**
   * Copy suggestion to clipboard
   */
  window.copySuggestion = function (text) {
    navigator.clipboard
      .writeText(text)
      .then(function () {
        console.log('ConversationIQ: Suggestion copied to clipboard');
        // Could show a toast notification here
      })
      .catch(function (error) {
        console.error('ConversationIQ: Error copying to clipboard:', error);
      });
  };

  /**
   * Make API request with authentication
   */
  function makeApiRequest(method, endpoint, data = null) {
    const url = API_CONFIG.baseUrl + endpoint;

    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + AppState.settings.api_key,
        'X-Zendesk-User-Id': AppState.currentUser?.id,
        'X-Zendesk-Ticket-Id': AppState.currentTicket?.id,
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    return fetch(url, options).then(function (response) {
      if (!response.ok) {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`
        );
      }
      return response.json();
    });
  }

  /**
   * Update connection status indicator
   */
  function updateConnectionStatus(status) {
    AppState.connectionStatus = status;

    const indicator = document.getElementById('connection-indicator');
    const text = document.getElementById('connection-text');

    if (indicator && text) {
      indicator.className = `status-indicator ${status}`;

      switch (status) {
        case 'connected':
          text.textContent = 'Connected';
          break;
        case 'connecting':
          text.textContent = 'Connecting...';
          break;
        case 'error':
          text.textContent = 'Connection Error';
          break;
      }
    }
  }

  /**
   * Show loading state
   */
  function showLoadingState() {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('error').classList.add('hidden');
  }

  /**
   * Hide loading state
   */
  function hideLoadingState() {
    document.getElementById('loading').classList.add('hidden');
  }

  /**
   * Show app
   */
  function showApp() {
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('error').classList.add('hidden');
  }

  /**
   * Show error state
   */
  function showError(message) {
    document.getElementById('error-message').textContent = message;
    document.getElementById('error').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('loading').classList.add('hidden');
    updateConnectionStatus('error');
  }

  // Utility functions
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  }

  function getInsightIcon(type) {
    const icons = {
      positive: '✅',
      negative: '⚠️',
      neutral: 'ℹ️',
      escalation: '🚨',
      trend: '📈',
    };
    return icons[type] || 'ℹ️';
  }

  function applyTimelineFilter(filter) {
    const items = document.querySelectorAll('.timeline-item');

    items.forEach(function (item) {
      const sentimentElement = item.querySelector('.timeline-sentiment');
      const shouldShow =
        filter === 'all' ||
        (filter === 'negative' &&
          sentimentElement.classList.contains('negative')) ||
        (filter === 'alerts' &&
          sentimentElement.classList.contains('negative'));

      item.style.display = shouldShow ? 'flex' : 'none';
    });
  }

  // Event handlers for Zendesk events
  function handleTicketUpdate(data) {
    AppState.currentTicket = data.ticket;
    // Reload relevant data
    loadInitialData();
  }

  function handleNewComment(data) {
    // Process new comment for sentiment analysis
    if (AppState.settings.enable_sentiment_analysis !== false) {
      // This would trigger sentiment analysis on the new comment
      loadSentimentData();
    }
  }

  function handleAppResize(data) {
    // Handle app resize if needed
    console.log('ConversationIQ: App resized', data);
  }

  // Quick action implementations (placeholder functions)
  function escalateTicket() {
    if (!AppState.client) return;

    AppState.client
      .invoke('ticket.tags.add', ['escalated', 'conversationiq-escalation'])
      .then(function () {
        console.log('ConversationIQ: Ticket escalated');
      })
      .catch(function (error) {
        console.error('ConversationIQ: Error escalating ticket:', error);
      });
  }

  function addTicketTag() {
    const tag = prompt('Enter tag to add:');
    if (tag && AppState.client) {
      AppState.client
        .invoke('ticket.tags.add', [tag])
        .then(function () {
          console.log('ConversationIQ: Tag added');
        })
        .catch(function (error) {
          console.error('ConversationIQ: Error adding tag:', error);
        });
    }
  }

  function addPrivateNote() {
    const note = prompt('Enter private note:');
    if (note && AppState.client) {
      AppState.client
        .invoke(
          'comment.appendText',
          `\n\n--- ConversationIQ Note ---\n${note}`
        )
        .then(function () {
          console.log('ConversationIQ: Private note added');
        })
        .catch(function (error) {
          console.error('ConversationIQ: Error adding note:', error);
        });
    }
  }

  // Initialize app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }
})();
