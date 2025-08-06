/**
 * SOC 2 Compliance Controls Framework
 * Implements security controls for SOC 2 Type II audit readiness
 */

import { EventEmitter } from 'events';
import { DatabaseService } from '../services/database';
import { monitoringService } from '../monitoring/monitoring-service';
import { encryptionService } from '../security/encryption-service';

// SOC 2 Trust Service Criteria
export enum TrustServiceCriteria {
  SECURITY = 'CC6', // Common Criteria 6 - Security
  AVAILABILITY = 'A1', // Availability
  PROCESSING_INTEGRITY = 'PI1', // Processing Integrity  
  CONFIDENTIALITY = 'C1', // Confidentiality
  PRIVACY = 'P1', // Privacy
}

// Control types
export enum ControlType {
  PREVENTIVE = 'preventive',
  DETECTIVE = 'detective',
  CORRECTIVE = 'corrective',
}

// Control effectiveness
export enum ControlEffectiveness {
  EFFECTIVE = 'effective',
  DEFICIENT = 'deficient',
  NOT_TESTED = 'not_tested',
}

export interface SOC2Control {
  id: string;
  name: string;
  description: string;
  criteria: TrustServiceCriteria;
  type: ControlType;
  owner: string;
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  evidence: string[];
  testProcedure: string;
  lastTested?: Date;
  nextTestDue: Date;
  effectiveness: ControlEffectiveness;
  findings?: string[];
  remediation?: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  outcome: 'success' | 'failure';
  ipAddress: string;
  userAgent: string;
  details: any;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  controlId?: string;
}

export interface IncidentRecord {
  id: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'security' | 'availability' | 'integrity' | 'confidentiality' | 'privacy';
  description: string;
  impact: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  assignee: string;
  resolution?: string;
  preventiveActions: string[];
}

export class SOC2ComplianceService extends EventEmitter {
  private database: DatabaseService;
  private controls: Map<string, SOC2Control>;
  private auditLog: AuditLogEntry[];
  private incidents: Map<string, IncidentRecord>;
  private controlTests: Map<string, Date>;

  constructor() {
    super();
    this.database = new DatabaseService();
    this.controls = new Map();
    this.auditLog = [];
    this.incidents = new Map();
    this.controlTests = new Map();
    
    this.initializeControls();
    this.startContinuousMonitoring();
  }

  /**
   * Initialize SOC 2 security controls
   */
  private initializeControls(): void {
    const controls: SOC2Control[] = [
      // Security Controls
      {
        id: 'CC6.1',
        name: 'Logical and Physical Access Controls',
        description: 'Entity implements logical and physical access controls to restrict unauthorized access',
        criteria: TrustServiceCriteria.SECURITY,
        type: ControlType.PREVENTIVE,
        owner: 'Security Team',
        frequency: 'continuous',
        evidence: ['Authentication logs', 'Access control configurations', 'Physical security measures'],
        testProcedure: 'Review authentication mechanisms and test access controls',
        nextTestDue: this.calculateNextTestDate('monthly'),
        effectiveness: ControlEffectiveness.NOT_TESTED,
      },
      {
        id: 'CC6.2',
        name: 'Transmission and Disposal of Information',
        description: 'Entity implements controls over transmission and disposal of information',
        criteria: TrustServiceCriteria.SECURITY,
        type: ControlType.PREVENTIVE,
        owner: 'Security Team',
        frequency: 'quarterly',
        evidence: ['Encryption configurations', 'Data disposal procedures', 'Transmission logs'],
        testProcedure: 'Test encryption in transit and data disposal processes',
        nextTestDue: this.calculateNextTestDate('quarterly'),
        effectiveness: ControlEffectiveness.NOT_TESTED,
      },
      {
        id: 'CC6.3',
        name: 'Protection Against Unauthorized Access',
        description: 'Entity implements controls to protect against unauthorized access',
        criteria: TrustServiceCriteria.SECURITY,
        type: ControlType.DETECTIVE,
        owner: 'Security Team',
        frequency: 'continuous',
        evidence: ['Security monitoring logs', 'Intrusion detection alerts', 'Vulnerability scans'],
        testProcedure: 'Review security monitoring and incident response procedures',
        nextTestDue: this.calculateNextTestDate('monthly'),
        effectiveness: ControlEffectiveness.NOT_TESTED,
      },
      
      // Availability Controls
      {
        id: 'A1.1',
        name: 'System Availability Monitoring',
        description: 'Entity monitors system availability and performance',
        criteria: TrustServiceCriteria.AVAILABILITY,
        type: ControlType.DETECTIVE,
        owner: 'Operations Team',
        frequency: 'continuous',
        evidence: ['Uptime reports', 'Performance metrics', 'Monitoring dashboards'],
        testProcedure: 'Review availability metrics and incident response times',
        nextTestDue: this.calculateNextTestDate('monthly'),
        effectiveness: ControlEffectiveness.NOT_TESTED,
      },
      {
        id: 'A1.2',
        name: 'Capacity Management',
        description: 'Entity implements capacity management to maintain system availability',
        criteria: TrustServiceCriteria.AVAILABILITY,
        type: ControlType.PREVENTIVE,
        owner: 'Operations Team',
        frequency: 'monthly',
        evidence: ['Capacity planning reports', 'Resource utilization metrics', 'Scaling procedures'],
        testProcedure: 'Review capacity planning and auto-scaling configurations',
        nextTestDue: this.calculateNextTestDate('monthly'),
        effectiveness: ControlEffectiveness.NOT_TESTED,
      },

      // Processing Integrity Controls
      {
        id: 'PI1.1',
        name: 'Data Processing Accuracy',
        description: 'Entity implements controls to ensure data processing accuracy',
        criteria: TrustServiceCriteria.PROCESSING_INTEGRITY,
        type: ControlType.PREVENTIVE,
        owner: 'Engineering Team',
        frequency: 'monthly',
        evidence: ['Data validation logs', 'Error handling procedures', 'Testing results'],
        testProcedure: 'Test data validation and error handling mechanisms',
        nextTestDue: this.calculateNextTestDate('monthly'),
        effectiveness: ControlEffectiveness.NOT_TESTED,
      },

      // Confidentiality Controls
      {
        id: 'C1.1',
        name: 'Data Encryption',
        description: 'Entity implements encryption controls to protect confidential information',
        criteria: TrustServiceCriteria.CONFIDENTIALITY,
        type: ControlType.PREVENTIVE,
        owner: 'Security Team',
        frequency: 'quarterly',
        evidence: ['Encryption configurations', 'Key management procedures', 'Encrypted data samples'],
        testProcedure: 'Test encryption effectiveness and key rotation',
        nextTestDue: this.calculateNextTestDate('quarterly'),
        effectiveness: ControlEffectiveness.NOT_TESTED,
      },

      // Privacy Controls
      {
        id: 'P1.1',
        name: 'Privacy Notice and Consent',
        description: 'Entity provides privacy notices and obtains consent for data collection',
        criteria: TrustServiceCriteria.PRIVACY,
        type: ControlType.PREVENTIVE,
        owner: 'Privacy Team',
        frequency: 'quarterly',
        evidence: ['Privacy policies', 'Consent records', 'Data processing agreements'],
        testProcedure: 'Review privacy notices and consent management processes',
        nextTestDue: this.calculateNextTestDate('quarterly'),
        effectiveness: ControlEffectiveness.NOT_TESTED,
      },
      {
        id: 'P1.2',
        name: 'Data Subject Rights',
        description: 'Entity implements processes to handle data subject rights requests',
        criteria: TrustServiceCriteria.PRIVACY,
        type: ControlType.CORRECTIVE,
        owner: 'Privacy Team',
        frequency: 'monthly',
        evidence: ['Data subject request logs', 'Response procedures', 'Fulfillment records'],
        testProcedure: 'Test data subject rights request handling',
        nextTestDue: this.calculateNextTestDate('monthly'),
        effectiveness: ControlEffectiveness.NOT_TESTED,
      },
    ];

    controls.forEach(control => {
      this.controls.set(control.id, control);
    });

    console.log(`Initialized ${controls.length} SOC 2 controls`);
  }

  /**
   * Calculate next test date based on frequency
   */
  private calculateNextTestDate(frequency: string): Date {
    const now = new Date();
    switch (frequency) {
      case 'daily': return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly': return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      case 'quarterly': return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      case 'annually': return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Log audit event
   */
  async logAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const auditEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...entry,
    };

    this.auditLog.push(auditEntry);

    // Keep only last 10,000 entries
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-10000);
    }

    // Record metrics
    monitoringService.recordMetric(
      'audit_events',
      1,
      'count',
      {
        action: entry.action,
        outcome: entry.outcome,
        riskLevel: entry.riskLevel,
      }
    );

    // Emit high-risk events
    if (entry.riskLevel === 'high' || entry.riskLevel === 'critical') {
      this.emit('highRiskAuditEvent', auditEntry);
    }

    console.log(`Audit event logged: ${entry.action} - ${entry.outcome}`);
  }

  /**
   * Create incident record
   */
  async createIncident(incident: Omit<IncidentRecord, 'id' | 'timestamp'>): Promise<string> {
    const incidentId = crypto.randomUUID();
    const incidentRecord: IncidentRecord = {
      id: incidentId,
      timestamp: new Date(),
      ...incident,
    };

    this.incidents.set(incidentId, incidentRecord);

    // Record metrics
    monitoringService.recordMetric(
      'security_incidents',
      1,
      'count',
      {
        severity: incident.severity,
        category: incident.category,
      }
    );

    // Emit critical incidents immediately
    if (incident.severity === 'critical') {
      this.emit('criticalIncident', incidentRecord);
    }

    console.log(`Incident created: ${incidentId} - ${incident.severity}`);
    return incidentId;
  }

  /**
   * Test control effectiveness
   */
  async testControl(controlId: string, testResults: {
    effectiveness: ControlEffectiveness;
    findings?: string[];
    evidence?: string[];
  }): Promise<void> {
    const control = this.controls.get(controlId);
    if (!control) {
      throw new Error(`Control ${controlId} not found`);
    }

    // Update control
    control.effectiveness = testResults.effectiveness;
    control.lastTested = new Date();
    control.nextTestDue = this.calculateNextTestDate(control.frequency);
    control.findings = testResults.findings || [];
    
    if (testResults.evidence) {
      control.evidence.push(...testResults.evidence);
    }

    this.controls.set(controlId, control);
    this.controlTests.set(controlId, new Date());

    // Record metrics
    monitoringService.recordMetric(
      'control_tests',
      1,
      'count',
      {
        controlId,
        effectiveness: testResults.effectiveness,
        criteria: control.criteria,
      }
    );

    // Log audit event
    await this.logAuditEvent({
      action: 'control_test',
      resource: controlId,
      outcome: testResults.effectiveness === ControlEffectiveness.EFFECTIVE ? 'success' : 'failure',
      ipAddress: 'system',
      userAgent: 'soc2-compliance-service',
      details: testResults,
      riskLevel: testResults.effectiveness === ControlEffectiveness.DEFICIENT ? 'high' : 'low',
      controlId,
    });

    console.log(`Control ${controlId} tested: ${testResults.effectiveness}`);
  }

  /**
   * Start continuous monitoring for automated controls
   */
  private startContinuousMonitoring(): void {
    // Monitor continuous controls every 5 minutes
    setInterval(async () => {
      for (const [controlId, control] of this.controls.entries()) {
        if (control.frequency === 'continuous') {
          await this.runAutomatedControlTest(controlId);
        }
      }
    }, 5 * 60 * 1000);

    // Check for overdue control tests daily
    setInterval(() => {
      this.checkOverdueControlTests();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Run automated control test
   */
  private async runAutomatedControlTest(controlId: string): Promise<void> {
    const control = this.controls.get(controlId);
    if (!control) return;

    try {
      let effectiveness: ControlEffectiveness;
      const findings: string[] = [];

      switch (controlId) {
        case 'CC6.1': // Access Controls
          effectiveness = await this.testAccessControls();
          break;
        case 'CC6.3': // Unauthorized Access Protection
          effectiveness = await this.testSecurityMonitoring();
          break;
        case 'A1.1': // Availability Monitoring
          effectiveness = await this.testAvailabilityMonitoring();
          break;
        default:
          return; // Skip non-automated tests
      }

      await this.testControl(controlId, { effectiveness, findings });
    } catch (error) {
      console.error(`Automated control test failed for ${controlId}:`, error);
      await this.testControl(controlId, {
        effectiveness: ControlEffectiveness.DEFICIENT,
        findings: [`Automated test failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      });
    }
  }

  /**
   * Test access controls effectiveness
   */
  private async testAccessControls(): Promise<ControlEffectiveness> {
    // Check if authentication and authorization are working
    const authMetrics = monitoringService.getMetricHistory('operation_success_rate', 1);
    const authSuccessRate = authMetrics
      .filter(m => m.labels.operation?.includes('auth'))
      .reduce((sum, m) => sum + m.value, 0) / Math.max(authMetrics.length, 1);

    return authSuccessRate >= 95 ? ControlEffectiveness.EFFECTIVE : ControlEffectiveness.DEFICIENT;
  }

  /**
   * Test security monitoring effectiveness
   */
  private async testSecurityMonitoring(): Promise<ControlEffectiveness> {
    // Check if security monitoring is operational
    const monitoringHealth = monitoringService.getOverallHealth();
    return monitoringHealth.status === 'healthy' ? 
      ControlEffectiveness.EFFECTIVE : 
      ControlEffectiveness.DEFICIENT;
  }

  /**
   * Test availability monitoring effectiveness
   */
  private async testAvailabilityMonitoring(): Promise<ControlEffectiveness> {
    // Check system availability
    const healthChecks = monitoringService.getOverallHealth();
    return healthChecks.healthyChecks === healthChecks.totalChecks ? 
      ControlEffectiveness.EFFECTIVE : 
      ControlEffectiveness.DEFICIENT;
  }

  /**
   * Check for overdue control tests
   */
  private checkOverdueControlTests(): void {
    const now = new Date();
    const overdueControls: string[] = [];

    for (const [controlId, control] of this.controls.entries()) {
      if (control.nextTestDue < now && control.effectiveness !== ControlEffectiveness.NOT_TESTED) {
        overdueControls.push(controlId);
      }
    }

    if (overdueControls.length > 0) {
      monitoringService.recordMetric(
        'overdue_control_tests',
        overdueControls.length,
        'count'
      );

      this.emit('overdueControls', overdueControls);
      console.warn(`${overdueControls.length} controls are overdue for testing:`, overdueControls);
    }
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport(): {
    summary: any;
    controls: SOC2Control[];
    auditEvents: number;
    incidents: number;
    complianceScore: number;
  } {
    const controls = Array.from(this.controls.values());
    const effectiveControls = controls.filter(c => c.effectiveness === ControlEffectiveness.EFFECTIVE).length;
    const totalControls = controls.length;
    const complianceScore = totalControls > 0 ? (effectiveControls / totalControls) * 100 : 0;

    const summary = {
      totalControls,
      effectiveControls,
      deficientControls: controls.filter(c => c.effectiveness === ControlEffectiveness.DEFICIENT).length,
      notTestedControls: controls.filter(c => c.effectiveness === ControlEffectiveness.NOT_TESTED).length,
      complianceScore: Math.round(complianceScore),
      lastUpdated: new Date(),
    };

    return {
      summary,
      controls,
      auditEvents: this.auditLog.length,
      incidents: this.incidents.size,
      complianceScore: Math.round(complianceScore),
    };
  }

  /**
   * Get audit trail for specific period
   */
  getAuditTrail(startDate: Date, endDate: Date): AuditLogEntry[] {
    return this.auditLog.filter(
      entry => entry.timestamp >= startDate && entry.timestamp <= endDate
    );
  }

  /**
   * Get incident history
   */
  getIncidents(): IncidentRecord[] {
    return Array.from(this.incidents.values());
  }
}

// Export singleton instance
export const soc2ComplianceService = new SOC2ComplianceService();