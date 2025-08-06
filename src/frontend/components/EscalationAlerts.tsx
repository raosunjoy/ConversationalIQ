/**
 * Escalation Alerts Component
 * Displays real-time escalation risk warnings and prevention actions
 */

import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useMutation, useQuery } from '@apollo/client';
import { gql } from 'graphql-tag';
import { RootState } from '../store';
import { Badge } from '@zendeskgarden/react-tags';
import { Button } from '@zendeskgarden/react-buttons';
import { Tooltip } from '@zendeskgarden/react-tooltips';
import { Alert, Close } from '@zendeskgarden/react-notifications';
import './EscalationAlerts.css';

interface EscalationRisk {
  conversationId: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timeToEscalation: number;
  escalationProbability: number;
  riskFactors: Array<{
    type: string;
    severity: number;
    description: string;
  }>;
  preventionActions: Array<{
    type: string;
    priority: string;
    description: string;
    estimatedImpact: number;
  }>;
  managerAlert: boolean;
}

interface EscalationRisksOverview {
  highRiskConversations: EscalationRisk[];
  mediumRiskConversations: EscalationRisk[];
  totalAtRisk: number;
}

// GraphQL Queries and Mutations
const GET_ACTIVE_ESCALATION_RISKS = gql`
  query GetActiveEscalationRisks {
    getActiveEscalationRisks {
      highRiskConversations {
        conversationId
        riskScore
        riskLevel
        timeToEscalation
        escalationProbability
        riskFactors {
          type
          severity
          description
        }
        preventionActions {
          type
          priority
          description
          estimatedImpact
        }
        managerAlert
      }
      mediumRiskConversations {
        conversationId
        riskScore
        riskLevel
        timeToEscalation
        escalationProbability
        riskFactors {
          type
          severity
          description
        }
        preventionActions {
          type
          priority
          description
          estimatedImpact
        }
        managerAlert
      }
      totalAtRisk
    }
  }
`;

const EXECUTE_PREVENTION_ACTION = gql`
  mutation ExecutePreventionAction(
    $conversationId: ID!
    $actionType: String!
    $agentId: ID
  ) {
    executePreventionAction(
      conversationId: $conversationId
      actionType: $actionType
      agentId: $agentId
    ) {
      success
      message
      result
    }
  }
`;

export const EscalationAlerts: React.FC = () => {
  const dispatch = useDispatch();
  const { activeConversationId } = useSelector(
    (state: RootState) => state.conversation
  );
  const { user } = useSelector((state: RootState) => state.app);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(
    new Set()
  );
  const [executingActions, setExecutingActions] = useState<Set<string>>(
    new Set()
  );

  // Query for escalation risks
  const {
    data: risksData,
    loading: risksLoading,
    refetch,
  } = useQuery<{
    getActiveEscalationRisks: EscalationRisksOverview;
  }>(GET_ACTIVE_ESCALATION_RISKS, {
    pollInterval: 30000, // Poll every 30 seconds
  });

  // Mutation for executing prevention actions
  const [executePreventionAction] = useMutation(EXECUTE_PREVENTION_ACTION, {
    onCompleted: data => {
      if (data.executePreventionAction.success) {
        // Refresh the risks data
        refetch();
      }
    },
    onError: error => {
      console.error('Failed to execute prevention action:', error);
    },
  });

  const handleExecuteAction = async (
    conversationId: string,
    actionType: string
  ) => {
    const actionKey = `${conversationId}:${actionType}`;
    setExecutingActions(prev => new Set(prev).add(actionKey));

    try {
      await executePreventionAction({
        variables: {
          conversationId,
          actionType,
          agentId: user?.userId,
        },
      });
    } finally {
      setExecutingActions(prev => {
        const next = new Set(prev);
        next.delete(actionKey);
        return next;
      });
    }
  };

  const handleDismissAlert = (conversationId: string) => {
    setDismissedAlerts(prev => new Set(prev).add(conversationId));
  };

  const getRiskLevelColor = (
    level: string
  ): 'grey' | 'yellow' | 'red' | 'red' => {
    switch (level) {
      case 'LOW':
        return 'grey';
      case 'MEDIUM':
        return 'yellow';
      case 'HIGH':
        return 'red';
      case 'CRITICAL':
        return 'red';
      default:
        return 'grey';
    }
  };

  const getPriorityColor = (priority: string): 'grey' | 'yellow' | 'red' => {
    switch (priority) {
      case 'NORMAL':
        return 'grey';
      case 'URGENT':
        return 'yellow';
      case 'IMMEDIATE':
        return 'red';
      default:
        return 'grey';
    }
  };

  const formatTimeToEscalation = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
  };

  if (risksLoading) {
    return (
      <div className="escalation-alerts loading">
        <div className="loading-indicator">Loading escalation data...</div>
      </div>
    );
  }

  const risks = risksData?.getActiveEscalationRisks;
  if (
    !risks ||
    (risks.highRiskConversations.length === 0 &&
      risks.mediumRiskConversations.length === 0)
  ) {
    return (
      <div className="escalation-alerts empty">
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <div className="empty-message">No escalation risks detected</div>
        </div>
      </div>
    );
  }

  const allRisks = [
    ...risks.highRiskConversations,
    ...risks.mediumRiskConversations,
  ];
  const visibleRisks = allRisks.filter(
    risk => !dismissedAlerts.has(risk.conversationId)
  );

  return (
    <div className="escalation-alerts">
      <div className="alerts-header">
        <h3>Escalation Alerts</h3>
        <Badge hue={risks.totalAtRisk > 0 ? 'red' : 'green'}>
          {risks.totalAtRisk} at risk
        </Badge>
      </div>

      <div className="alerts-list">
        {visibleRisks.map(risk => (
          <Alert
            key={risk.conversationId}
            type={risk.riskLevel === 'CRITICAL' ? 'error' : 'warning'}
            className="escalation-alert"
          >
            <div className="alert-header">
              <div className="alert-title">
                <Badge hue={getRiskLevelColor(risk.riskLevel)}>
                  {risk.riskLevel}
                </Badge>
                <span className="conversation-id">
                  Conversation {risk.conversationId}
                </span>
                <span className="risk-score">
                  Risk: {Math.round(risk.riskScore * 100)}%
                </span>
              </div>
              <Close
                onClick={() => handleDismissAlert(risk.conversationId)}
                aria-label="Dismiss alert"
              />
            </div>

            <div className="alert-details">
              <div className="risk-info">
                <div className="prediction">
                  <Tooltip content="Estimated time until escalation">
                    <span className="time-to-escalation">
                      ⏱️ {formatTimeToEscalation(risk.timeToEscalation)}
                    </span>
                  </Tooltip>
                  <Tooltip content="Probability of escalation">
                    <span className="escalation-probability">
                      📈 {Math.round(risk.escalationProbability * 100)}%
                    </span>
                  </Tooltip>
                </div>

                <div className="risk-factors">
                  <h4>Risk Factors:</h4>
                  {risk.riskFactors.slice(0, 2).map((factor, index) => (
                    <div key={index} className="risk-factor">
                      <Badge hue="yellow" size="small">
                        {Math.round(factor.severity * 100)}%
                      </Badge>
                      <span>{factor.description}</span>
                    </div>
                  ))}
                  {risk.riskFactors.length > 2 && (
                    <div className="more-factors">
                      +{risk.riskFactors.length - 2} more factors
                    </div>
                  )}
                </div>
              </div>

              <div className="prevention-actions">
                <h4>Suggested Actions:</h4>
                {risk.preventionActions.slice(0, 2).map((action, index) => (
                  <div key={index} className="prevention-action">
                    <div className="action-info">
                      <Badge
                        hue={getPriorityColor(action.priority)}
                        size="small"
                      >
                        {action.priority}
                      </Badge>
                      <span className="action-description">
                        {action.description}
                      </span>
                      <span className="impact-score">
                        Impact: {Math.round(action.estimatedImpact * 100)}%
                      </span>
                    </div>
                    <Button
                      size="small"
                      onClick={() =>
                        handleExecuteAction(risk.conversationId, action.type)
                      }
                      disabled={executingActions.has(
                        `${risk.conversationId}:${action.type}`
                      )}
                    >
                      {executingActions.has(
                        `${risk.conversationId}:${action.type}`
                      )
                        ? 'Executing...'
                        : 'Execute'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {risk.managerAlert && (
              <div className="manager-alert">
                <Badge hue="red" size="small">
                  Manager Alert
                </Badge>
                <span>
                  This conversation requires immediate manager attention
                </span>
              </div>
            )}
          </Alert>
        ))}
      </div>

      {risks.totalAtRisk > visibleRisks.length && (
        <div className="alerts-footer">
          <Button isLink onClick={() => setDismissedAlerts(new Set())}>
            Show all alerts ({risks.totalAtRisk})
          </Button>
        </div>
      )}
    </div>
  );
};
