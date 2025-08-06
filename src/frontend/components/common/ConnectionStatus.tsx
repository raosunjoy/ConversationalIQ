/**
 * Connection Status Component
 * Shows real-time connection status with WebSocket and API
 */

import React, { useEffect } from 'react';
import { useAppSelector } from '../../store/hooks';
import {
  selectConnectionStatus,
  selectWebsocketConnected,
} from '../../store/slices/app-slice';

const ConnectionStatus: React.FC = () => {
  const connectionStatus = useAppSelector(selectConnectionStatus);
  const websocketConnected = useAppSelector(selectWebsocketConnected);

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'disconnected':
        return '🔴';
      case 'error':
        return '❌';
      default:
        return '⚪';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Connection Error';
      default:
        return 'Unknown';
    }
  };

  const getStatusClass = (status: string): string => {
    switch (status) {
      case 'connected':
        return 'connected';
      case 'connecting':
        return 'connecting';
      case 'disconnected':
        return 'disconnected';
      case 'error':
        return 'error';
      default:
        return 'unknown';
    }
  };

  // Don't show connection status if everything is working normally
  if (connectionStatus === 'connected' && websocketConnected) {
    return null;
  }

  return (
    <div className={`connection-status ${getStatusClass(connectionStatus)}`}>
      <div className="status-content">
        <span className="status-icon">{getStatusIcon(connectionStatus)}</span>
        <span className="status-text">{getStatusText(connectionStatus)}</span>
        {websocketConnected === false && connectionStatus === 'connected' && (
          <span className="websocket-status">(Real-time updates disabled)</span>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatus;
