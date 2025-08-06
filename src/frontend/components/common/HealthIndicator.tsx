/**
 * Health Indicator Component
 * Visual indicator for conversation health status
 */

import React from 'react';

interface HealthIndicatorProps {
  health: 'excellent' | 'good' | 'concerning' | 'critical';
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
}

const HealthIndicator: React.FC<HealthIndicatorProps> = ({
  health,
  size = 'medium',
  showDetails = false,
}) => {
  const getHealthConfig = (health: string) => {
    switch (health) {
      case 'excellent':
        return {
          color: '#228f67',
          icon: '💚',
          label: 'Excellent',
          description: 'Conversation is proceeding very well',
        };
      case 'good':
        return {
          color: '#87c442',
          icon: '💛',
          label: 'Good',
          description: 'Conversation is on track',
        };
      case 'concerning':
        return {
          color: '#f79a3e',
          icon: '🧡',
          label: 'Concerning',
          description: 'Some issues detected',
        };
      case 'critical':
        return {
          color: '#d93954',
          icon: '❤️',
          label: 'Critical',
          description: 'Immediate attention required',
        };
      default:
        return {
          color: '#68737d',
          icon: '⚪',
          label: 'Unknown',
          description: 'Status unknown',
        };
    }
  };

  const config = getHealthConfig(health);

  return (
    <div className={`health-indicator ${size} ${health}`}>
      <div className="health-icon">{config.icon}</div>

      <div className="health-content">
        <div className="health-label" style={{ color: config.color }}>
          {config.label}
        </div>

        {showDetails && (
          <div className="health-description">{config.description}</div>
        )}
      </div>

      <div className="health-bar" style={{ backgroundColor: config.color }} />
    </div>
  );
};

export default HealthIndicator;
