/**
 * Metric Card Component
 * Displays a key metric with trend indicator
 */

import React from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'positive' | 'negative' | 'neutral';
  icon?: string;
  color?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  color,
}) => {
  const getTrendIcon = (trend?: string): string => {
    switch (trend) {
      case 'positive': return '📈';
      case 'negative': return '📉';
      default: return '📊';
    }
  };

  const getTrendColor = (trend?: string): string => {
    switch (trend) {
      case 'positive': return '#228f67';
      case 'negative': return '#d93954';
      default: return '#68737d';
    }
  };

  return (
    <div className={`metric-card ${trend || ''}`}>
      <div className="metric-header">
        {icon && <span className="metric-icon">{icon}</span>}
        <span className="metric-title">{title}</span>
        {trend && (
          <span 
            className="trend-indicator"
            style={{ color: getTrendColor(trend) }}
          >
            {getTrendIcon(trend)}
          </span>
        )}
      </div>
      
      <div className="metric-body">
        <div 
          className="metric-value"
          style={{ color: color || (trend ? getTrendColor(trend) : undefined) }}
        >
          {value}
        </div>
        {subtitle && (
          <div className="metric-subtitle">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;