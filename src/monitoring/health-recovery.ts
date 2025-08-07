/**
 * Automated Health Check and Recovery System
 * Implements automated detection and recovery for system failures
 */

import { EventEmitter } from 'events';
import { monitoringService } from './monitoring-service';
import { soc2ComplianceService } from '../compliance/soc2-controls';
import { DatabaseService } from '../services/database';

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  timestamp: Date;
  details?: any;
  error?: string;
}

export interface RecoveryAction {
  id: string;
  name: string;
  description: string;
  triggers: string[]; // Health check names that trigger this action
  severity: 'low' | 'medium' | 'high' | 'critical';
  automated: boolean;
  cooldownMinutes: number;
  maxRetries: number;
  executeFunction: () => Promise<{ success: boolean; message: string }>;
}

export interface RecoveryExecution {
  actionId: string;
  trigger: string;
  startTime: Date;
  endTime?: Date;
  success?: boolean;
  message?: string;
  retryCount: number;
}

export class HealthRecoveryService extends EventEmitter {
  private database: DatabaseService;
  private recoveryActions: Map<string, RecoveryAction>;
  private executionHistory: RecoveryExecution[];
  private cooldownTracker: Map<string, Date>;
  private retryTracker: Map<string, number>;
  private isShuttingDown: boolean;

  constructor() {
    super();
    this.database = new DatabaseService();
    this.recoveryActions = new Map();
    this.executionHistory = [];
    this.cooldownTracker = new Map();
    this.retryTracker = new Map();
    this.isShuttingDown = false;

    this.initializeRecoveryActions();
    this.startHealthMonitoring();
  }

  /**
   * Initialize recovery actions
   */
  private initializeRecoveryActions(): void {
    const actions: RecoveryAction[] = [
      {
        id: 'restart_database_connection',
        name: 'Restart Database Connection',
        description: 'Reconnect to database when connection is lost',
        triggers: ['database'],
        severity: 'critical',
        automated: true,
        cooldownMinutes: 5,
        maxRetries: 3,
        executeFunction: this.restartDatabaseConnection.bind(this),
      },
      {
        id: 'clear_memory_cache',
        name: 'Clear Memory Cache',
        description: 'Clear in-memory cache to free up memory',
        triggers: ['memory_usage'],
        severity: 'medium',
        automated: true,
        cooldownMinutes: 10,
        maxRetries: 1,
        executeFunction: this.clearMemoryCache.bind(this),
      },
      {
        id: 'restart_ai_pipeline',
        name: 'Restart AI Pipeline',
        description: 'Reinitialize AI processing pipeline',
        triggers: ['ai_pipeline'],
        severity: 'high',
        automated: false, // Manual approval required
        cooldownMinutes: 15,
        maxRetries: 2,
        executeFunction: this.restartAIPipeline.bind(this),
      },
      {
        id: 'scale_up_resources',
        name: 'Scale Up Resources',
        description: 'Automatically scale up system resources',
        triggers: ['high_cpu', 'high_memory', 'high_latency'],
        severity: 'high',
        automated: true,
        cooldownMinutes: 30,
        maxRetries: 1,
        executeFunction: this.scaleUpResources.bind(this),
      },
      {
        id: 'emergency_maintenance_mode',
        name: 'Emergency Maintenance Mode',
        description: 'Enable maintenance mode to prevent further damage',
        triggers: ['system_critical'],
        severity: 'critical',
        automated: false, // Manual approval required
        cooldownMinutes: 60,
        maxRetries: 1,
        executeFunction: this.enableMaintenanceMode.bind(this),
      },
    ];

    actions.forEach(action => {
      this.recoveryActions.set(action.id, action);
    });

    console.log(`Initialized ${actions.length} recovery actions`);
  }

  /**
   * Start continuous health monitoring
   */
  private startHealthMonitoring(): void {
    // Monitor health every 30 seconds
    const healthInterval = setInterval(async () => {
      if (this.isShuttingDown) {
        clearInterval(healthInterval);
        return;
      }

      await this.performHealthChecks();
    }, 30000);

    // Cleanup old execution history every hour
    const cleanupInterval = setInterval(
      () => {
        if (this.isShuttingDown) {
          clearInterval(cleanupInterval);
          return;
        }

        this.cleanupExecutionHistory();
      },
      60 * 60 * 1000
    );

    console.log('Health recovery monitoring started');
  }

  /**
   * Perform comprehensive health checks
   */
  private async performHealthChecks(): Promise<void> {
    const healthChecks: HealthCheck[] = [];

    try {
      // Database health check
      const dbStartTime = Date.now();
      const dbHealthy = this.database.isConnected();
      healthChecks.push({
        name: 'database',
        status: dbHealthy ? 'healthy' : 'unhealthy',
        latency: Date.now() - dbStartTime,
        timestamp: new Date(),
        details: { connected: dbHealthy },
      });

      // Memory usage check
      const memoryUsage = process.memoryUsage();
      const memoryPercent =
        (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      healthChecks.push({
        name: 'memory_usage',
        status:
          memoryPercent > 85
            ? 'unhealthy'
            : memoryPercent > 70
              ? 'degraded'
              : 'healthy',
        latency: 0,
        timestamp: new Date(),
        details: {
          heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          percentage: Math.round(memoryPercent),
        },
      });

      // Event loop lag check
      const lagStartTime = Date.now();
      setImmediate(() => {
        const lag = Date.now() - lagStartTime;
        healthChecks.push({
          name: 'event_loop_lag',
          status: lag > 100 ? 'unhealthy' : lag > 50 ? 'degraded' : 'healthy',
          latency: lag,
          timestamp: new Date(),
          details: { lagMs: lag },
        });
      });

      // System uptime check
      const uptime = process.uptime();
      healthChecks.push({
        name: 'system_uptime',
        status: 'healthy', // Uptime is informational
        latency: 0,
        timestamp: new Date(),
        details: { uptimeSeconds: Math.round(uptime) },
      });
    } catch (error) {
      console.error('Health check failed:', error);
      healthChecks.push({
        name: 'health_check_system',
        status: 'unhealthy',
        latency: 0,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Process health check results
    for (const healthCheck of healthChecks) {
      await this.processHealthCheckResult(healthCheck);
    }
  }

  /**
   * Process individual health check result
   */
  private async processHealthCheckResult(
    healthCheck: HealthCheck
  ): Promise<void> {
    // Record metrics
    monitoringService.recordMetric(
      `health_check_${healthCheck.name}`,
      healthCheck.status === 'healthy' ? 1 : 0,
      'boolean',
      { status: healthCheck.status }
    );

    monitoringService.recordMetric(
      `health_check_latency_${healthCheck.name}`,
      healthCheck.latency,
      'ms'
    );

    // Trigger recovery actions for unhealthy checks
    if (healthCheck.status === 'unhealthy') {
      await this.triggerRecoveryActions(healthCheck.name);

      // Create incident record for critical failures
      await soc2ComplianceService.createIncident({
        severity: 'high',
        category: 'availability',
        description: `Health check failed: ${healthCheck.name}`,
        impact: `System component ${healthCheck.name} is unhealthy`,
        status: 'open',
        assignee: 'operations-team',
        preventiveActions: [],
      });

      // Emit event for external monitoring
      this.emit('healthCheckFailed', healthCheck);
    }
  }

  /**
   * Trigger recovery actions for a failed health check
   */
  private async triggerRecoveryActions(trigger: string): Promise<void> {
    for (const [actionId, action] of this.recoveryActions.entries()) {
      if (action.triggers.includes(trigger)) {
        await this.executeRecoveryAction(actionId, trigger);
      }
    }
  }

  /**
   * Execute a specific recovery action
   */
  private async executeRecoveryAction(
    actionId: string,
    trigger: string
  ): Promise<boolean> {
    const action = this.recoveryActions.get(actionId);
    if (!action) {
      console.error(`Recovery action ${actionId} not found`);
      return false;
    }

    // Check cooldown
    const lastExecution = this.cooldownTracker.get(actionId);
    if (lastExecution) {
      const cooldownEnd = new Date(
        lastExecution.getTime() + action.cooldownMinutes * 60 * 1000
      );
      if (new Date() < cooldownEnd) {
        console.log(
          `Recovery action ${actionId} is in cooldown until ${cooldownEnd}`
        );
        return false;
      }
    }

    // Check retry count
    const retryCount = this.retryTracker.get(actionId) || 0;
    if (retryCount >= action.maxRetries) {
      console.log(
        `Recovery action ${actionId} has exceeded max retries (${action.maxRetries})`
      );
      return false;
    }

    // Check if action is automated or needs approval
    if (!action.automated) {
      console.log(`Recovery action ${actionId} requires manual approval`);
      this.emit('recoveryActionPending', { actionId, trigger, action });
      return false;
    }

    const execution: RecoveryExecution = {
      actionId,
      trigger,
      startTime: new Date(),
      retryCount,
    };

    try {
      console.log(
        `Executing recovery action: ${action.name} (trigger: ${trigger})`
      );

      const result = await action.executeFunction();

      execution.endTime = new Date();
      execution.success = result.success;
      execution.message = result.message;

      if (result.success) {
        // Reset retry counter on success
        this.retryTracker.delete(actionId);
        console.log(
          `Recovery action ${actionId} completed successfully: ${result.message}`
        );
      } else {
        // Increment retry counter on failure
        this.retryTracker.set(actionId, retryCount + 1);
        console.error(`Recovery action ${actionId} failed: ${result.message}`);
      }

      // Set cooldown regardless of success/failure
      this.cooldownTracker.set(actionId, new Date());

      // Record execution
      this.executionHistory.push(execution);

      // Record metrics
      monitoringService.recordMetric('recovery_action_executions', 1, 'count', {
        actionId,
        trigger,
        success: result.success.toString(),
        severity: action.severity,
      });

      // Log audit event
      await soc2ComplianceService.logAuditEvent({
        action: 'recovery_action_executed',
        resource: actionId,
        outcome: result.success ? 'success' : 'failure',
        ipAddress: 'system',
        userAgent: 'health-recovery-service',
        details: { trigger, execution },
        riskLevel: action.severity === 'critical' ? 'high' : 'medium',
      });

      this.emit('recoveryActionExecuted', { execution, result });

      return result.success;
    } catch (error) {
      execution.endTime = new Date();
      execution.success = false;
      execution.message =
        error instanceof Error ? error.message : 'Unknown error';

      this.retryTracker.set(actionId, retryCount + 1);
      this.executionHistory.push(execution);

      console.error(`Recovery action ${actionId} threw exception:`, error);
      this.emit('recoveryActionError', { actionId, trigger, error });

      return false;
    }
  }

  /**
   * Recovery action implementations
   */
  private async restartDatabaseConnection(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      await this.database.disconnect();
      await this.database.connect();
      return {
        success: true,
        message: 'Database connection restarted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to restart database connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async clearMemoryCache(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Clear various caches (would clear actual cache services in production)
      const memoryBefore = Math.round(
        process.memoryUsage().heapUsed / 1024 / 1024
      );

      // Simulate cache clearing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const memoryAfter = Math.round(
        process.memoryUsage().heapUsed / 1024 / 1024
      );

      return {
        success: true,
        message: `Memory cache cleared. Memory usage: ${memoryBefore}MB -> ${memoryAfter}MB`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to clear memory cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async restartAIPipeline(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // This would restart the AI pipeline in production
      console.log('Restarting AI Pipeline (simulated)...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      return { success: true, message: 'AI Pipeline restarted successfully' };
    } catch (error) {
      return {
        success: false,
        message: `Failed to restart AI Pipeline: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async scaleUpResources(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // This would trigger auto-scaling in production
      console.log('Scaling up resources (simulated)...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      return { success: true, message: 'Resources scaled up successfully' };
    } catch (error) {
      return {
        success: false,
        message: `Failed to scale up resources: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async enableMaintenanceMode(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // This would enable maintenance mode in production
      console.log('Enabling maintenance mode (simulated)...');
      await new Promise(resolve => setTimeout(resolve, 500));

      return {
        success: true,
        message: 'Maintenance mode enabled successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to enable maintenance mode: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Manually approve and execute a pending recovery action
   */
  async approveRecoveryAction(
    actionId: string,
    trigger: string
  ): Promise<boolean> {
    const action = this.recoveryActions.get(actionId);
    if (!action) {
      throw new Error(`Recovery action ${actionId} not found`);
    }

    // Temporarily mark as automated for this execution
    const originalAutomated = action.automated;
    action.automated = true;

    try {
      const result = await this.executeRecoveryAction(actionId, trigger);
      return result;
    } finally {
      action.automated = originalAutomated;
    }
  }

  /**
   * Clean up old execution history
   */
  private cleanupExecutionHistory(): void {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.executionHistory = this.executionHistory.filter(
      execution => execution.startTime > oneDayAgo
    );
  }

  /**
   * Get recovery status
   */
  getRecoveryStatus(): {
    actions: RecoveryAction[];
    recentExecutions: RecoveryExecution[];
    cooldowns: Array<{ actionId: string; expiresAt: Date }>;
    retries: Array<{ actionId: string; count: number; maxRetries: number }>;
  } {
    const cooldowns = Array.from(this.cooldownTracker.entries()).map(
      ([actionId, lastExecution]) => {
        const action = this.recoveryActions.get(actionId)!;
        return {
          actionId,
          expiresAt: new Date(
            lastExecution.getTime() + action.cooldownMinutes * 60 * 1000
          ),
        };
      }
    );

    const retries = Array.from(this.retryTracker.entries()).map(
      ([actionId, count]) => {
        const action = this.recoveryActions.get(actionId)!;
        return {
          actionId,
          count,
          maxRetries: action.maxRetries,
        };
      }
    );

    return {
      actions: Array.from(this.recoveryActions.values()),
      recentExecutions: this.executionHistory.slice(-10),
      cooldowns,
      retries,
    };
  }

  /**
   * Shutdown the health recovery service
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    console.log('Health recovery service shutting down...');
  }
}

// Export singleton instance
export const healthRecoveryService = new HealthRecoveryService();
