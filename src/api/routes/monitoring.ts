/**
 * Monitoring and Observability API Routes
 * Provides access to application metrics, health checks, and performance data
 */

import { Router, Request, Response, NextFunction } from 'express';
import { query, validationResult } from 'express-validator';
import { monitoringService } from '../../monitoring/monitoring-service';
import { soc2ComplianceService } from '../../compliance/soc2-controls';
import { encryptionService } from '../../security/encryption-service';
import { aiPipeline } from '../../ai/ai-pipeline';
import { handleValidationErrors, rateLimitConfigs } from '../../security/security-middleware';

const router = Router();

// Apply rate limiting for monitoring endpoints
router.use(rateLimitConfigs.general);

// Validation schemas
const metricsQueryValidation = [
  query('window')
    .optional()
    .isIn(['1h', '6h', '24h', '7d', '30d'])
    .withMessage('Window must be one of: 1h, 6h, 24h, 7d, 30d'),
  query('metric')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Metric name must be 1-100 characters'),
];

/**
 * Overall health check endpoint
 * GET /monitoring/health
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const overallHealth = monitoringService.getOverallHealth();
    const aiHealth = await aiPipeline.getHealth();
    const encryptionStats = encryptionService.getEncryptionStats();
    
    const systemHealth = {
      status: overallHealth.status,
      timestamp: new Date(),
      components: {
        monitoring: overallHealth,
        ai: aiHealth,
        encryption: {
          status: encryptionStats.totalKeysInCache > 0 ? 'healthy' : 'degraded',
          details: encryptionStats,
        },
      },
      summary: {
        healthyComponents: overallHealth.healthyChecks + (aiHealth.status === 'healthy' ? 1 : 0),
        totalComponents: overallHealth.totalChecks + 1,
      },
    };

    // Set appropriate HTTP status based on health
    const statusCode = systemHealth.status === 'healthy' ? 200 : 
                     systemHealth.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(systemHealth);
  } catch (error) {
    next(error);
  }
});

/**
 * Detailed metrics dashboard
 * GET /monitoring/dashboard
 */
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboardData = monitoringService.getDashboardData();
    const aiMetrics = aiPipeline.getMetrics();
    const complianceReport = soc2ComplianceService.generateComplianceReport();

    const dashboard = {
      ...dashboardData,
      ai: aiMetrics,
      compliance: {
        soc2Score: complianceReport.complianceScore,
        effectiveControls: complianceReport.summary.effectiveControls,
        totalControls: complianceReport.summary.totalControls,
        recentIncidents: complianceReport.incidents,
      },
      timestamp: new Date(),
    };

    res.json(dashboard);
  } catch (error) {
    next(error);
  }
});

/**
 * Specific metric history
 * GET /monitoring/metrics/:metricName
 */
router.get(
  '/metrics/:metricName',
  metricsQueryValidation,
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { metricName } = req.params;
      const { window = '24h' } = req.query;

      const windowHours = {
        '1h': 1,
        '6h': 6,
        '24h': 24,
        '7d': 168,
        '30d': 720,
      }[window as string] || 24;

      const metrics = monitoringService.getMetricHistory(metricName, windowHours);

      res.json({
        metric: metricName,
        window,
        dataPoints: metrics.length,
        data: metrics,
        summary: {
          min: Math.min(...metrics.map(m => m.value)),
          max: Math.max(...metrics.map(m => m.value)),
          avg: metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length || 0,
          latest: metrics[metrics.length - 1]?.value || 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Performance metrics
 * GET /monitoring/performance
 */
router.get('/performance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboardData = monitoringService.getDashboardData();
    const aiMetrics = aiPipeline.getMetrics();

    const performance = {
      api: {
        responseTime: {
          avg: dashboardData.metrics.operation_duration?.slice(-10).reduce((sum, m) => sum + m.value, 0) / 10 || 0,
          p95: dashboardData.metrics.operation_duration?.slice(-10).map(m => m.value).sort()[8] || 0,
        },
        successRate: dashboardData.metrics.operation_success_rate?.slice(-1)[0]?.value || 0,
        throughput: dashboardData.metrics.operation_count?.slice(-10).reduce((sum, m) => sum + m.value, 0) / 10 || 0,
      },
      ai: {
        processingTime: aiMetrics.averageLatency,
        p95Latency: aiMetrics.p95Latency,
        throughput: aiMetrics.throughput,
        errorRate: aiMetrics.errorRate,
        cacheHitRate: aiMetrics.cacheStats.hitRate,
      },
      system: {
        memoryUsage: dashboardData.metrics.memory_usage_percent?.slice(-1)[0]?.value || 0,
        cpuUsage: dashboardData.metrics.event_loop_lag?.slice(-1)[0]?.value || 0,
        uptime: dashboardData.metrics.uptime?.slice(-1)[0]?.value || 0,
      },
      timestamp: new Date(),
    };

    res.json(performance);
  } catch (error) {
    next(error);
  }
});

/**
 * SLA status
 * GET /monitoring/sla
 */
router.get('/sla', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboardData = monitoringService.getDashboardData();

    const slaStatus = {
      slas: dashboardData.slas,
      summary: {
        meeting: Object.values(dashboardData.slas).filter(sla => sla.status === 'meeting').length,
        atRisk: Object.values(dashboardData.slas).filter(sla => sla.status === 'at_risk').length,
        violated: Object.values(dashboardData.slas).filter(sla => sla.status === 'violated').length,
      },
      timestamp: new Date(),
    };

    res.json(slaStatus);
  } catch (error) {
    next(error);
  }
});

/**
 * Alert history
 * GET /monitoring/alerts
 */
router.get('/alerts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboardData = monitoringService.getDashboardData();

    const alerts = {
      recent: dashboardData.recentAlerts,
      summary: {
        total: dashboardData.recentAlerts.length,
        critical: dashboardData.recentAlerts.filter(a => a.rule.severity === 'critical').length,
        high: dashboardData.recentAlerts.filter(a => a.rule.severity === 'high').length,
        medium: dashboardData.recentAlerts.filter(a => a.rule.severity === 'medium').length,
        low: dashboardData.recentAlerts.filter(a => a.rule.severity === 'low').length,
      },
      timestamp: new Date(),
    };

    res.json(alerts);
  } catch (error) {
    next(error);
  }
});

/**
 * Security monitoring
 * GET /monitoring/security
 */
router.get('/security', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const complianceReport = soc2ComplianceService.generateComplianceReport();
    const auditTrail = soc2ComplianceService.getAuditTrail(
      new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      new Date()
    );
    const incidents = soc2ComplianceService.getIncidents();

    const security = {
      compliance: {
        soc2Score: complianceReport.complianceScore,
        controls: complianceReport.summary,
        recentTests: complianceReport.controls
          .filter(c => c.lastTested)
          .sort((a, b) => (b.lastTested?.getTime() || 0) - (a.lastTested?.getTime() || 0))
          .slice(0, 5),
      },
      auditEvents: {
        total: auditTrail.length,
        byRisk: {
          critical: auditTrail.filter(e => e.riskLevel === 'critical').length,
          high: auditTrail.filter(e => e.riskLevel === 'high').length,
          medium: auditTrail.filter(e => e.riskLevel === 'medium').length,
          low: auditTrail.filter(e => e.riskLevel === 'low').length,
        },
        recent: auditTrail.slice(-10),
      },
      incidents: {
        total: incidents.length,
        open: incidents.filter(i => i.status === 'open' || i.status === 'investigating').length,
        bySeverity: {
          critical: incidents.filter(i => i.severity === 'critical').length,
          high: incidents.filter(i => i.severity === 'high').length,
          medium: incidents.filter(i => i.severity === 'medium').length,
          low: incidents.filter(i => i.severity === 'low').length,
        },
      },
      timestamp: new Date(),
    };

    res.json(security);
  } catch (error) {
    next(error);
  }
});

/**
 * Business metrics
 * GET /monitoring/business
 */
router.get('/business', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboardData = monitoringService.getDashboardData();

    const business = {
      metrics: dashboardData.businessMetrics,
      kpis: {
        customerSatisfaction: 4.2, // Would come from actual data
        agentProductivity: 85, // Would come from actual data
        escalationRate: 12, // Would come from actual data
        resolutionTime: 24, // Hours - would come from actual data
      },
      growth: {
        monthlyActiveUsers: 1250, // Would come from actual data
        conversationsProcessed: 15400, // Would come from actual data
        aiAccuracy: 87.5, // Would come from AI metrics
        apiUptime: 99.95, // Would come from SLA data
      },
      timestamp: new Date(),
    };

    res.json(business);
  } catch (error) {
    next(error);
  }
});

/**
 * System resource usage
 * GET /monitoring/resources
 */
router.get('/resources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboardData = monitoringService.getDashboardData();

    const resources = {
      memory: {
        current: dashboardData.metrics.memory_usage_mb?.slice(-1)[0]?.value || 0,
        percentage: dashboardData.metrics.memory_usage_percent?.slice(-1)[0]?.value || 0,
        trend: 'stable', // Would calculate from historical data
      },
      cpu: {
        eventLoopLag: dashboardData.metrics.event_loop_lag?.slice(-1)[0]?.value || 0,
        trend: 'stable',
      },
      cache: {
        hitRate: dashboardData.metrics.operation_success_rate?.slice(-1)[0]?.value || 0,
        size: 1024, // Would come from cache service
        memoryUsage: 256, // MB - would come from cache service
      },
      database: {
        connections: 15, // Would come from database metrics
        queryTime: 45, // ms - would come from database metrics
        slowQueries: 3, // Would come from database metrics
      },
      timestamp: new Date(),
    };

    res.json(resources);
  } catch (error) {
    next(error);
  }
});

/**
 * Export metrics for external monitoring systems
 * GET /monitoring/export
 */
router.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = req.query.format as string || 'json';
    const dashboardData = monitoringService.getDashboardData();

    if (format === 'prometheus') {
      // Convert to Prometheus format
      let prometheusMetrics = '';
      
      for (const [name, metrics] of Object.entries(dashboardData.metrics)) {
        if (Array.isArray(metrics) && metrics.length > 0) {
          const latest = metrics[metrics.length - 1];
          prometheusMetrics += `# HELP ${name} ${name} metric\n`;
          prometheusMetrics += `# TYPE ${name} gauge\n`;
          prometheusMetrics += `${name}`;
          
          if (latest.labels && Object.keys(latest.labels).length > 0) {
            const labels = Object.entries(latest.labels)
              .map(([k, v]) => `${k}="${v}"`)
              .join(',');
            prometheusMetrics += `{${labels}}`;
          }
          
          prometheusMetrics += ` ${latest.value}\n`;
        }
      }

      res.setHeader('Content-Type', 'text/plain');
      res.send(prometheusMetrics);
    } else {
      // Default JSON format
      res.json({
        ...dashboardData,
        exportFormat: format,
        exportedAt: new Date(),
      });
    }
  } catch (error) {
    next(error);
  }
});

export { router as monitoringRoutes };