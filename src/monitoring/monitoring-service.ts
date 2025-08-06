/**
 * Comprehensive Monitoring and Observability Service
 * Implements application performance monitoring, business metrics tracking,
 * and SLA monitoring for production readiness
 */

import { EventEmitter } from 'events';
import { DatabaseService } from '../services/database';

// Metric types
interface Metric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  labels: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
}

interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // seconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  channels: string[]; // notification channels
  enabled: boolean;
}

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  timestamp: Date;
  details?: any;
  error?: string;
}

// SLA definitions
interface SLA {
  name: string;
  target: number; // percentage (99.9 = 99.9%)
  metric: string;
  window: string; // '24h', '7d', '30d'
  currentValue: number;
  status: 'meeting' | 'at_risk' | 'violated';
}

// Business metrics
interface BusinessMetric {
  name: string;
  value: number;
  change: number; // percentage change
  period: string;
  goal?: number;
  status: 'good' | 'warning' | 'critical';
}

export class MonitoringService extends EventEmitter {
  private database: DatabaseService;
  private metrics: Map<string, Metric[]>;
  private alertRules: Map<string, AlertRule>;
  private healthChecks: Map<string, HealthCheck>;
  private slas: Map<string, SLA>;
  private businessMetrics: Map<string, BusinessMetric>;
  private alertHistory: Array<{ rule: AlertRule; triggered: Date; resolved?: Date }>;
  
  constructor() {
    super();
    this.database = new DatabaseService();
    this.metrics = new Map();
    this.alertRules = new Map();
    this.healthChecks = new Map();
    this.slas = new Map();
    this.businessMetrics = new Map();
    this.alertHistory = [];
    
    this.initializeDefaultAlerts();
    this.initializeSLAs();
    this.startMonitoring();
  }

  /**
   * Record a metric value
   */
  recordMetric(
    name: string,
    value: number,
    unit: string = 'count',
    labels: Record<string, string> = {},
    type: 'counter' | 'gauge' | 'histogram' | 'summary' = 'gauge'
  ): void {
    const metric: Metric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      labels,
      type,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricHistory = this.metrics.get(name)!;
    metricHistory.push(metric);

    // Keep only last 1000 data points per metric
    if (metricHistory.length > 1000) {
      metricHistory.shift();
    }

    // Check alert rules
    this.checkAlertRules(name, value);

    // Emit metric event for real-time processing
    this.emit('metric', metric);
  }

  /**
   * Record application performance metrics
   */
  recordPerformanceMetric(
    operation: string,
    duration: number,
    success: boolean,
    metadata: Record<string, string> = {}
  ): void {
    this.recordMetric(
      'operation_duration',
      duration,
      'ms',
      { operation, success: success.toString(), ...metadata },
      'histogram'
    );

    this.recordMetric(
      'operation_count',
      1,
      'count',
      { operation, success: success.toString(), ...metadata },
      'counter'
    );

    // Calculate success rate
    const successRate = this.calculateSuccessRate(operation);
    this.recordMetric(
      'operation_success_rate',
      successRate,
      'percentage',
      { operation },
      'gauge'
    );
  }

  /**
   * Record business metrics
   */
  recordBusinessMetric(
    name: string,
    value: number,
    goal?: number,
    period: string = '24h'
  ): void {
    const previousValue = this.businessMetrics.get(name)?.value || 0;
    const change = previousValue > 0 ? ((value - previousValue) / previousValue) * 100 : 0;
    
    let status: 'good' | 'warning' | 'critical' = 'good';
    if (goal) {
      const percentage = (value / goal) * 100;
      if (percentage < 50) status = 'critical';
      else if (percentage < 80) status = 'warning';
    }

    const businessMetric: BusinessMetric = {
      name,
      value,
      change,
      period,
      goal,
      status,
    };

    this.businessMetrics.set(name, businessMetric);
    this.emit('businessMetric', businessMetric);
  }

  /**
   * Register health check
   */
  registerHealthCheck(name: string, checkFunction: () => Promise<HealthCheck>): void {
    // Store health check function for periodic execution
    setInterval(async () => {
      try {
        const result = await checkFunction();
        this.healthChecks.set(name, result);
        this.emit('healthCheck', result);
        
        // Record as metric
        this.recordMetric(
          'health_check_status',
          result.status === 'healthy' ? 1 : 0,
          'boolean',
          { check: name }
        );
        
        this.recordMetric(
          'health_check_latency',
          result.latency,
          'ms',
          { check: name }
        );
      } catch (error) {
        const failedCheck: HealthCheck = {
          name,
          status: 'unhealthy',
          latency: 0,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : String(error),
        };
        
        this.healthChecks.set(name, failedCheck);
        this.emit('healthCheck', failedCheck);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  /**
   * Check alert rules for a metric
   */
  private checkAlertRules(metricName: string, value: number): void {
    for (const [ruleId, rule] of this.alertRules.entries()) {
      if (rule.metric !== metricName || !rule.enabled) continue;

      let triggered = false;
      switch (rule.condition) {
        case 'gt':
          triggered = value > rule.threshold;
          break;
        case 'lt':
          triggered = value < rule.threshold;
          break;
        case 'gte':
          triggered = value >= rule.threshold;
          break;
        case 'lte':
          triggered = value <= rule.threshold;
          break;
        case 'eq':
          triggered = value === rule.threshold;
          break;
      }

      if (triggered) {
        this.triggerAlert(rule, value);
      }
    }
  }

  /**
   * Trigger alert
   */
  private triggerAlert(rule: AlertRule, currentValue: number): void {
    const alert = {
      rule,
      currentValue,
      timestamp: new Date(),
    };

    this.alertHistory.push({
      rule,
      triggered: new Date(),
    });

    this.emit('alert', alert);
    
    // Send notifications
    this.sendNotifications(alert);
  }

  /**
   * Send alert notifications
   */
  private sendNotifications(alert: any): void {
    console.log('ALERT TRIGGERED:', {
      rule: alert.rule.name,
      severity: alert.rule.severity,
      metric: alert.rule.metric,
      threshold: alert.rule.threshold,
      currentValue: alert.currentValue,
      channels: alert.rule.channels,
    });

    // In production, this would integrate with:
    // - Slack/Teams for chat notifications
    // - PagerDuty for incident management
    // - Email/SMS for critical alerts
    // - Webhook endpoints for custom integrations
  }

  /**
   * Calculate success rate for an operation
   */
  private calculateSuccessRate(operation: string): number {
    const recentMetrics = this.getRecentMetrics('operation_count', { operation });
    
    if (recentMetrics.length === 0) return 100;

    const successCount = recentMetrics
      .filter(m => m.labels.success === 'true')
      .reduce((sum, m) => sum + m.value, 0);
    
    const totalCount = recentMetrics.reduce((sum, m) => sum + m.value, 0);
    
    return totalCount > 0 ? (successCount / totalCount) * 100 : 100;
  }

  /**
   * Get recent metrics matching criteria
   */
  private getRecentMetrics(
    metricName: string, 
    labels: Record<string, string> = {},
    windowMinutes: number = 60
  ): Metric[] {
    const metrics = this.metrics.get(metricName) || [];
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    
    return metrics.filter(metric => {
      if (metric.timestamp < cutoff) return false;
      
      // Check if all required labels match
      for (const [key, value] of Object.entries(labels)) {
        if (metric.labels[key] !== value) return false;
      }
      
      return true;
    });
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlerts(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        metric: 'operation_success_rate',
        condition: 'lt',
        threshold: 95,
        duration: 300, // 5 minutes
        severity: 'critical',
        channels: ['slack', 'pagerduty'],
        enabled: true,
      },
      {
        id: 'high_latency',
        name: 'High API Latency',
        metric: 'operation_duration',
        condition: 'gt',
        threshold: 2000, // 2 seconds
        duration: 300,
        severity: 'high',
        channels: ['slack'],
        enabled: true,
      },
      {
        id: 'database_connections',
        name: 'High Database Connection Usage',
        metric: 'db_connections_active',
        condition: 'gt',
        threshold: 80,
        duration: 180,
        severity: 'medium',
        channels: ['slack'],
        enabled: true,
      },
      {
        id: 'memory_usage',
        name: 'High Memory Usage',
        metric: 'memory_usage_percent',
        condition: 'gt',
        threshold: 85,
        duration: 600, // 10 minutes
        severity: 'high',
        channels: ['slack', 'email'],
        enabled: true,
      },
      {
        id: 'disk_usage',
        name: 'High Disk Usage',
        metric: 'disk_usage_percent',
        condition: 'gt',
        threshold: 90,
        duration: 300,
        severity: 'critical',
        channels: ['slack', 'pagerduty', 'email'],
        enabled: true,
      },
    ];

    defaultRules.forEach(rule => this.addAlertRule(rule));
  }

  /**
   * Initialize SLA definitions
   */
  private initializeSLAs(): void {
    const slaDefinitions: SLA[] = [
      {
        name: 'API Availability',
        target: 99.9,
        metric: 'operation_success_rate',
        window: '30d',
        currentValue: 99.95,
        status: 'meeting',
      },
      {
        name: 'Response Time',
        target: 95, // 95% of requests under 500ms
        metric: 'response_time_p95',
        window: '24h',
        currentValue: 92,
        status: 'at_risk',
      },
      {
        name: 'AI Processing',
        target: 99.5,
        metric: 'ai_processing_success_rate',
        window: '7d',
        currentValue: 99.8,
        status: 'meeting',
      },
    ];

    slaDefinitions.forEach(sla => this.slas.set(sla.name, sla));
  }

  /**
   * Update SLA status
   */
  private updateSLAStatus(): void {
    for (const [name, sla] of this.slas.entries()) {
      // Calculate current value based on recent metrics
      const currentValue = this.calculateSLAValue(sla);
      
      let status: 'meeting' | 'at_risk' | 'violated';
      if (currentValue >= sla.target) {
        status = 'meeting';
      } else if (currentValue >= sla.target * 0.95) {
        status = 'at_risk';
      } else {
        status = 'violated';
      }

      const updatedSLA: SLA = {
        ...sla,
        currentValue,
        status,
      };

      this.slas.set(name, updatedSLA);
      
      // Emit SLA update
      this.emit('slaUpdate', updatedSLA);
      
      // Trigger alerts for SLA violations
      if (status === 'violated') {
        this.triggerAlert({
          id: `sla_${name}`,
          name: `SLA Violation: ${name}`,
          metric: sla.metric,
          condition: 'lt',
          threshold: sla.target,
          duration: 0,
          severity: 'critical',
          channels: ['slack', 'pagerduty', 'email'],
          enabled: true,
        }, currentValue);
      }
    }
  }

  /**
   * Calculate current SLA value
   */
  private calculateSLAValue(sla: SLA): number {
    // This would calculate the actual SLA value based on recent metrics
    // For now, return a simulated value
    return sla.currentValue + (Math.random() - 0.5) * 2;
  }

  /**
   * Start periodic monitoring tasks
   */
  private startMonitoring(): void {
    // Update SLAs every minute
    setInterval(() => {
      this.updateSLAStatus();
    }, 60000);

    // Cleanup old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000);

    // Record system metrics every 30 seconds
    setInterval(() => {
      this.recordSystemMetrics();
    }, 30000);
  }

  /**
   * Record system metrics
   */
  private recordSystemMetrics(): void {
    // Memory usage
    const memoryUsage = process.memoryUsage();
    this.recordMetric(
      'memory_usage_mb',
      Math.round(memoryUsage.heapUsed / 1024 / 1024),
      'MB'
    );

    this.recordMetric(
      'memory_usage_percent',
      Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      'percentage'
    );

    // Event loop lag
    const start = Date.now();
    setImmediate(() => {
      const lag = Date.now() - start;
      this.recordMetric('event_loop_lag', lag, 'ms');
    });

    // Uptime
    this.recordMetric('uptime', process.uptime(), 'seconds');
  }

  /**
   * Cleanup old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [name, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(m => m.timestamp > cutoff);
      this.metrics.set(name, filteredMetrics);
    }
  }

  /**
   * Get dashboard data
   */
  getDashboardData(): {
    metrics: Record<string, Metric[]>;
    healthChecks: Record<string, HealthCheck>;
    slas: Record<string, SLA>;
    businessMetrics: Record<string, BusinessMetric>;
    recentAlerts: Array<any>;
  } {
    return {
      metrics: Object.fromEntries(this.metrics.entries()),
      healthChecks: Object.fromEntries(this.healthChecks.entries()),
      slas: Object.fromEntries(this.slas.entries()),
      businessMetrics: Object.fromEntries(this.businessMetrics.entries()),
      recentAlerts: this.alertHistory.slice(-10), // Last 10 alerts
    };
  }

  /**
   * Get specific metric history
   */
  getMetricHistory(name: string, windowHours: number = 24): Metric[] {
    const metrics = this.metrics.get(name) || [];
    const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    
    return metrics.filter(m => m.timestamp > cutoff);
  }

  /**
   * Health check status
   */
  getOverallHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    healthyChecks: number;
    totalChecks: number;
    details: Record<string, HealthCheck>;
  } {
    const checks = Array.from(this.healthChecks.values());
    const healthyChecks = checks.filter(c => c.status === 'healthy').length;
    const degradedChecks = checks.filter(c => c.status === 'degraded').length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyChecks === checks.length) {
      status = 'healthy';
    } else if (healthyChecks + degradedChecks === checks.length) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      healthyChecks,
      totalChecks: checks.length,
      details: Object.fromEntries(this.healthChecks.entries()),
    };
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();