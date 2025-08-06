/**
 * Loading Spinner Component
 * Reusable loading indicator with different sizes and styles
 */

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  overlay?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  message = '', 
  overlay = false 
}) => {
  const spinnerClass = `loading-spinner ${size}`;
  const containerClass = `loading-container ${overlay ? 'overlay' : ''}`;

  return (
    <div className={containerClass}>
      <div className={spinnerClass}>
        <div className="spinner-circle"></div>
        <div className="spinner-circle"></div>
        <div className="spinner-circle"></div>
      </div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;