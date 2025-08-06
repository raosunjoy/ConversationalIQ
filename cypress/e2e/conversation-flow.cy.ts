/**
 * End-to-End Tests for ConversationIQ - Main Conversation Flow
 * Tests complete user workflows in browser environment
 */

describe('ConversationIQ - Main Conversation Flow', () => {
  beforeEach(() => {
    // Setup test environment
    cy.task('resetTestDatabase');
    cy.task('seedTestData');
    
    // Mock external services for E2E testing
    cy.intercept('POST', '/api/zendesk/auth', { fixture: 'zendesk-auth.json' }).as('zendeskAuth');
    cy.intercept('GET', '/api/zendesk/tickets/*', { fixture: 'zendesk-ticket.json' }).as('zendeskTicket');
    cy.intercept('POST', '/api/ai/analyze', { fixture: 'ai-analysis.json' }).as('aiAnalysis');
    
    // Visit the application (would be running in test mode)
    cy.visit('/');
  });

  describe('Agent Dashboard - Conversation Management', () => {
    it('should display agent dashboard with active conversations', () => {
      // Login as test agent
      cy.get('[data-testid="login-form"]').should('be.visible');
      cy.get('[data-testid="email-input"]').type('test-agent@example.com');
      cy.get('[data-testid="password-input"]').type('testpassword');
      cy.get('[data-testid="login-button"]').click();

      cy.wait('@zendeskAuth');
      
      // Should redirect to dashboard
      cy.url().should('include', '/dashboard');
      cy.get('[data-testid="agent-dashboard"]').should('be.visible');
      
      // Should show conversation list
      cy.get('[data-testid="conversation-list"]').should('be.visible');
      cy.get('[data-testid="conversation-item"]').should('have.length.greaterThan', 0);
    });

    it('should open conversation and display real-time updates', () => {
      cy.loginAsAgent();
      
      // Click on first conversation
      cy.get('[data-testid="conversation-item"]').first().click();
      
      // Should display conversation details
      cy.get('[data-testid="conversation-view"]').should('be.visible');
      cy.get('[data-testid="message-list"]').should('be.visible');
      cy.get('[data-testid="message-item"]').should('have.length.greaterThan', 0);
      
      // Should show real-time sentiment analysis
      cy.get('[data-testid="sentiment-indicator"]').should('be.visible');
      cy.get('[data-testid="sentiment-score"]').should('contain.text', '%');
      
      // Should display AI-powered response suggestions
      cy.get('[data-testid="response-suggestions"]').should('be.visible');
      cy.get('[data-testid="suggestion-item"]').should('have.length.greaterThan', 0);
    });

    it('should handle new messages with real-time AI analysis', () => {
      cy.loginAsAgent();
      cy.openFirstConversation();
      
      // Simulate receiving a new message
      cy.window().its('socketConnection').invoke('emit', 'new_message', {
        conversationId: 'test-conversation-1',
        content: 'I am very frustrated with this service!',
        senderType: 'CUSTOMER',
        timestamp: new Date().toISOString()
      });
      
      // Should update message list
      cy.get('[data-testid="message-list"]').should('contain.text', 'I am very frustrated');
      
      // Should trigger AI analysis
      cy.wait('@aiAnalysis');
      
      // Should update sentiment indicator
      cy.get('[data-testid="sentiment-indicator"]')
        .should('have.class', 'negative')
        .and('be.visible');
      
      // Should show escalation warning if high risk
      cy.get('[data-testid="escalation-warning"]').should('be.visible');
      
      // Should update response suggestions
      cy.get('[data-testid="suggestion-item"]').first()
        .should('contain.text', 'understand your frustration');
    });

    it('should use response suggestions effectively', () => {
      cy.loginAsAgent();
      cy.openFirstConversation();
      
      // Click on a response suggestion
      cy.get('[data-testid="suggestion-item"]').first().click();
      
      // Should populate the response input
      cy.get('[data-testid="response-input"]')
        .should('have.value')
        .and('not.be.empty');
      
      // Agent can modify the suggested response
      cy.get('[data-testid="response-input"]')
        .type(' I will help you resolve this immediately.');
      
      // Send the response
      cy.get('[data-testid="send-response-button"]').click();
      
      // Should update conversation
      cy.get('[data-testid="message-list"]')
        .should('contain.text', 'I will help you resolve this immediately');
      
      // Should record suggestion usage for analytics
      cy.get('[data-testid="suggestion-feedback"]').should('be.visible');
    });

    it('should handle escalation prevention workflow', () => {
      cy.loginAsAgent();
      cy.openFirstConversation();
      
      // Simulate high escalation risk scenario
      cy.window().its('socketConnection').invoke('emit', 'escalation_risk_detected', {
        conversationId: 'test-conversation-1',
        riskLevel: 'high',
        riskScore: 0.85,
        preventionActions: ['offer_supervisor', 'provide_discount', 'expedite_resolution']
      });
      
      // Should show escalation prevention panel
      cy.get('[data-testid="escalation-prevention"]').should('be.visible');
      cy.get('[data-testid="risk-score"]').should('contain.text', '85%');
      
      // Should display prevention action buttons
      cy.get('[data-testid="prevention-action"]').should('have.length', 3);
      
      // Agent clicks on "Offer Supervisor" action
      cy.get('[data-testid="prevention-action"]')
        .contains('Offer Supervisor')
        .click();
      
      // Should execute prevention action
      cy.get('[data-testid="action-confirmation"]')
        .should('be.visible')
        .and('contain.text', 'Supervisor notification sent');
      
      // Should update risk level
      cy.get('[data-testid="risk-score"]').should('not.contain.text', '85%');
    });

    it('should display conversation analytics', () => {
      cy.loginAsAgent();
      cy.openFirstConversation();
      
      // Open analytics panel
      cy.get('[data-testid="analytics-toggle"]').click();
      cy.get('[data-testid="conversation-analytics"]').should('be.visible');
      
      // Should show sentiment trend
      cy.get('[data-testid="sentiment-chart"]').should('be.visible');
      cy.get('[data-testid="sentiment-trend"]').should('contain.text', 'trend');
      
      // Should show conversation health metrics
      cy.get('[data-testid="health-score"]').should('be.visible');
      cy.get('[data-testid="response-time"]').should('contain.text', 'min');
      
      // Should show customer satisfaction prediction
      cy.get('[data-testid="satisfaction-prediction"]').should('be.visible');
      cy.get('[data-testid="satisfaction-score"]').should('contain.text', '%');
    });
  });

  describe('Manager Dashboard - Team Analytics', () => {
    it('should display team performance overview', () => {
      cy.loginAsManager();
      
      // Should show manager dashboard
      cy.get('[data-testid="manager-dashboard"]').should('be.visible');
      
      // Should display team metrics
      cy.get('[data-testid="team-metrics"]').should('be.visible');
      cy.get('[data-testid="active-conversations"]').should('contain.text', 'Active');
      cy.get('[data-testid="average-response-time"]').should('contain.text', 'min');
      cy.get('[data-testid="customer-satisfaction"]').should('contain.text', '%');
      
      // Should show agent performance comparison
      cy.get('[data-testid="agent-performance"]').should('be.visible');
      cy.get('[data-testid="agent-card"]').should('have.length.greaterThan', 0);
    });

    it('should provide real-time team alerts', () => {
      cy.loginAsManager();
      
      // Simulate team alert
      cy.window().its('socketConnection').invoke('emit', 'team_alert', {
        type: 'high_escalation_rate',
        severity: 'warning',
        message: 'Escalation rate increased by 25% in last hour',
        affectedAgents: ['agent-1', 'agent-2'],
        recommendedActions: ['Additional coaching', 'Review escalated cases']
      });
      
      // Should show alert notification
      cy.get('[data-testid="alert-notification"]')
        .should('be.visible')
        .and('contain.text', 'Escalation rate increased');
      
      // Click to view alert details
      cy.get('[data-testid="alert-notification"]').click();
      cy.get('[data-testid="alert-details"]').should('be.visible');
      cy.get('[data-testid="affected-agents"]').should('contain.text', 'agent-1');
      cy.get('[data-testid="recommended-actions"]').should('contain.text', 'coaching');
    });

    it('should generate and export reports', () => {
      cy.loginAsManager();
      
      // Navigate to reports section
      cy.get('[data-testid="reports-tab"]').click();
      cy.get('[data-testid="reports-section"]').should('be.visible');
      
      // Configure report parameters
      cy.get('[data-testid="date-range-picker"]').click();
      cy.get('[data-testid="last-7-days"]').click();
      
      cy.get('[data-testid="report-type-select"]').select('Team Performance');
      cy.get('[data-testid="generate-report-button"]').click();
      
      // Should generate report
      cy.get('[data-testid="report-results"]').should('be.visible');
      cy.get('[data-testid="report-chart"]').should('be.visible');
      
      // Should allow export
      cy.get('[data-testid="export-report-button"]').click();
      cy.get('[data-testid="export-format-select"]').select('PDF');
      cy.get('[data-testid="confirm-export-button"]').click();
      
      // Should initiate download
      cy.get('[data-testid="download-notification"]')
        .should('be.visible')
        .and('contain.text', 'Report exported successfully');
    });
  });

  describe('Real-time Features and WebSocket Integration', () => {
    it('should handle WebSocket connection and real-time updates', () => {
      cy.loginAsAgent();
      
      // Verify WebSocket connection established
      cy.window().should('have.property', 'socketConnection');
      cy.window().its('socketConnection.connected').should('be.true');
      
      // Test real-time conversation updates
      cy.openFirstConversation();
      
      // Simulate real-time message from another agent/customer
      cy.window().its('socketConnection').invoke('emit', 'conversation_updated', {
        conversationId: 'test-conversation-1',
        updates: {
          status: 'PENDING',
          lastMessage: {
            content: 'Thank you for your patience',
            senderType: 'AGENT',
            timestamp: new Date().toISOString()
          }
        }
      });
      
      // Should update UI immediately
      cy.get('[data-testid="conversation-status"]').should('contain.text', 'Pending');
      cy.get('[data-testid="message-list"]').should('contain.text', 'Thank you for your patience');
    });

    it('should handle WebSocket disconnection gracefully', () => {
      cy.loginAsAgent();
      
      // Simulate connection loss
      cy.window().its('socketConnection').invoke('disconnect');
      
      // Should show connection status warning
      cy.get('[data-testid="connection-status"]')
        .should('be.visible')
        .and('have.class', 'disconnected');
      
      // Should attempt to reconnect
      cy.wait(5000);
      cy.window().its('socketConnection').invoke('connect');
      
      // Should restore connection
      cy.get('[data-testid="connection-status"]')
        .should('have.class', 'connected');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent conversations', () => {
      cy.loginAsAgent();
      
      // Open multiple conversations in tabs
      for (let i = 0; i < 5; i++) {
        cy.get(`[data-testid="conversation-item"]:nth-child(${i + 1})`).rightclick();
        cy.get('[data-testid="open-in-new-tab"]').click();
      }
      
      // Switch between tabs and verify each loads correctly
      cy.window().then((win) => {
        cy.wrap(win).invoke('focus');
        cy.get('[data-testid="conversation-view"]').should('be.visible');
        cy.get('[data-testid="sentiment-indicator"]').should('be.visible');
      });
    });

    it('should maintain performance with high message volume', () => {
      cy.loginAsAgent();
      cy.openFirstConversation();
      
      // Simulate receiving many messages quickly
      for (let i = 0; i < 50; i++) {
        cy.window().its('socketConnection').invoke('emit', 'new_message', {
          conversationId: 'test-conversation-1',
          content: `Message ${i + 1} - Testing high volume`,
          senderType: 'CUSTOMER',
          timestamp: new Date(Date.now() + i * 1000).toISOString()
        });
      }
      
      // Should handle all messages without performance degradation
      cy.get('[data-testid="message-list"] [data-testid="message-item"]')
        .should('have.length', 50);
      
      // UI should remain responsive
      cy.get('[data-testid="response-input"]').should('be.visible').type('Test response');
      cy.get('[data-testid="send-response-button"]').should('not.be.disabled');
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should meet accessibility standards', () => {
      cy.loginAsAgent();
      
      // Check for proper ARIA labels and roles
      cy.get('[data-testid="conversation-list"]')
        .should('have.attr', 'role', 'list');
      
      cy.get('[data-testid="conversation-item"]')
        .should('have.attr', 'role', 'listitem');
      
      // Check keyboard navigation
      cy.get('[data-testid="conversation-item"]').first().focus();
      cy.focused().type('{enter}');
      cy.get('[data-testid="conversation-view"]').should('be.visible');
      
      // Check screen reader compatibility
      cy.get('[data-testid="sentiment-indicator"]')
        .should('have.attr', 'aria-label')
        .and('contain', 'sentiment');
    });

    it('should provide helpful tooltips and guidance', () => {
      cy.loginAsAgent();
      cy.openFirstConversation();
      
      // Hover over sentiment indicator
      cy.get('[data-testid="sentiment-indicator"]').trigger('mouseover');
      cy.get('[data-testid="sentiment-tooltip"]')
        .should('be.visible')
        .and('contain.text', 'confidence');
      
      // Check help button functionality
      cy.get('[data-testid="help-button"]').click();
      cy.get('[data-testid="help-panel"]').should('be.visible');
      cy.get('[data-testid="feature-tour-button"]').should('be.visible');
    });

    it('should work on different screen sizes', () => {
      // Test desktop view
      cy.viewport(1200, 800);
      cy.loginAsAgent();
      cy.get('[data-testid="sidebar"]').should('be.visible');
      cy.get('[data-testid="main-content"]').should('be.visible');
      
      // Test tablet view
      cy.viewport(768, 1024);
      cy.get('[data-testid="mobile-menu-toggle"]').should('be.visible');
      cy.get('[data-testid="sidebar"]').should('not.be.visible');
      
      // Test mobile view
      cy.viewport(375, 667);
      cy.get('[data-testid="conversation-list"]').should('be.visible');
      cy.get('[data-testid="conversation-item"]').first().click();
      cy.get('[data-testid="conversation-view"]').should('be.visible');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle API errors gracefully', () => {
      // Mock API failure
      cy.intercept('GET', '/api/conversations', { statusCode: 500 }).as('conversationsError');
      
      cy.loginAsAgent();
      cy.wait('@conversationsError');
      
      // Should show error message
      cy.get('[data-testid="error-message"]')
        .should('be.visible')
        .and('contain.text', 'Unable to load conversations');
      
      // Should provide retry option
      cy.get('[data-testid="retry-button"]').should('be.visible').click();
    });

    it('should handle malformed data gracefully', () => {
      cy.loginAsAgent();
      
      // Simulate receiving malformed message data
      cy.window().its('socketConnection').invoke('emit', 'new_message', {
        // Missing required fields
        content: null,
        senderType: 'INVALID',
      });
      
      // Should not crash the application
      cy.get('[data-testid="conversation-list"]').should('be.visible');
      cy.get('[data-testid="error-notification"]')
        .should('be.visible')
        .and('contain.text', 'message format');
    });

    it('should maintain state during browser refresh', () => {
      cy.loginAsAgent();
      cy.openFirstConversation();
      
      // Store current conversation ID
      cy.url().then((currentUrl) => {
        // Refresh the page
        cy.reload();
        
        // Should restore to the same conversation
        cy.url().should('eq', currentUrl);
        cy.get('[data-testid="conversation-view"]').should('be.visible');
      });
    });
  });
});

// Custom Cypress commands for common operations
declare global {
  namespace Cypress {
    interface Chainable {
      loginAsAgent(): Chainable<void>;
      loginAsManager(): Chainable<void>;
      openFirstConversation(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('loginAsAgent', () => {
  cy.visit('/');
  cy.get('[data-testid="login-form"]').should('be.visible');
  cy.get('[data-testid="email-input"]').type('test-agent@example.com');
  cy.get('[data-testid="password-input"]').type('testpassword');
  cy.get('[data-testid="login-button"]').click();
  cy.wait('@zendeskAuth');
  cy.url().should('include', '/dashboard');
});

Cypress.Commands.add('loginAsManager', () => {
  cy.visit('/');
  cy.get('[data-testid="login-form"]').should('be.visible');
  cy.get('[data-testid="email-input"]').type('test-manager@example.com');
  cy.get('[data-testid="password-input"]').type('testpassword');
  cy.get('[data-testid="login-button"]').click();
  cy.wait('@zendeskAuth');
  cy.url().should('include', '/manager-dashboard');
});

Cypress.Commands.add('openFirstConversation', () => {
  cy.get('[data-testid="conversation-list"]').should('be.visible');
  cy.get('[data-testid="conversation-item"]').first().click();
  cy.get('[data-testid="conversation-view"]').should('be.visible');
});