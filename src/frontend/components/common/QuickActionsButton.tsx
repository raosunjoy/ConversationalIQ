/**
 * Quick Actions Button Component
 * Floating action button for quick operations
 */

import React, { useState } from 'react';
import { Button } from '@zendeskgarden/react-buttons';

interface QuickActionsButtonProps {
  conversationId: string | null;
  escalationRisk: number;
}

const QuickActionsButton: React.FC<QuickActionsButtonProps> = ({
  conversationId,
  escalationRisk,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = (action: string) => {
    console.log('Quick action:', action);
    setIsOpen(false);

    // Handle different actions
    switch (action) {
      case 'escalate':
        // Trigger escalation workflow
        break;
      case 'tag':
        // Open tag dialog
        break;
      case 'note':
        // Open internal note dialog
        break;
      default:
        break;
    }
  };

  if (!conversationId) return null;

  return (
    <div className="quick-actions-fab">
      <div className={`fab-container ${isOpen ? 'open' : ''}`}>
        {/* Main FAB */}
        <button
          className="fab main"
          onClick={() => setIsOpen(!isOpen)}
          title="Quick Actions"
        >
          <span className="fab-icon">⚡</span>
        </button>

        {/* Action Menu */}
        {isOpen && (
          <div className="fab-menu">
            {escalationRisk > 0.7 && (
              <button
                className="fab-menu-item escalate"
                onClick={() => handleAction('escalate')}
                title="Escalate Conversation"
              >
                <span className="menu-icon">🚨</span>
                <span className="menu-label">Escalate</span>
              </button>
            )}

            <button
              className="fab-menu-item tag"
              onClick={() => handleAction('tag')}
              title="Add Tag"
            >
              <span className="menu-icon">🏷️</span>
              <span className="menu-label">Tag</span>
            </button>

            <button
              className="fab-menu-item note"
              onClick={() => handleAction('note')}
              title="Add Internal Note"
            >
              <span className="menu-icon">📝</span>
              <span className="menu-label">Note</span>
            </button>
          </div>
        )}
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div className="fab-backdrop" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
};

export default QuickActionsButton;
