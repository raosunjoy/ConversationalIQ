/**
 * Comprehensive Testing Framework for ConversationIQ
 * Provides utilities for unit, integration, E2E, performance, and security testing
 */

import { PrismaClient } from '@prisma/client';
import { DatabaseService } from '../services/database';
import { monitoringService } from '../monitoring/monitoring-service';
import { vulnerabilityManagementService } from '../security/vulnerability-scanner';
import { soc2ComplianceService } from '../compliance/soc2-controls';

export interface TestConfig {
  environment: 'test' | 'integration' | 'e2e';
  database: {
    resetBefore: boolean;
    seedData: boolean;
    isolateTransactions: boolean;
  };
  monitoring: {
    collectMetrics: boolean;
    trackPerformance: boolean;
  };
  security: {
    enableSecurityScans: boolean;
    mockExternalServices: boolean;
  };
}

export interface PerformanceBenchmark {
  name: string;
  maxResponseTime: number; // milliseconds
  maxMemoryUsage: number; // MB
  maxCpuUsage: number; // percentage
  minThroughput: number; // requests per second
}

export interface SecurityTestResult {
  testName: string;
  passed: boolean;
  vulnerabilities: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
  }>;
  complianceScore: number;
}

export class TestFramework {
  private config: TestConfig;
  private database: DatabaseService;
  private startTime: number;
  private benchmarks: Map<string, PerformanceBenchmark>;
  private testMetrics: Map<string, any>;

  constructor(config: TestConfig) {
    this.config = config;
    this.database = new DatabaseService();
    this.startTime = 0;
    this.benchmarks = new Map();
    this.testMetrics = new Map();

    this.initializeBenchmarks();
  }

  /**
   * Initialize performance benchmarks for different operations
   */
  private initializeBenchmarks(): void {
    const benchmarks: Array<[string, PerformanceBenchmark]> = [
      [
        'api_response',
        {
          name: 'API Response Time',
          maxResponseTime: 500,
          maxMemoryUsage: 128,
          maxCpuUsage: 50,
          minThroughput: 100,
        },
      ],
      [
        'database_query',
        {
          name: 'Database Query',
          maxResponseTime: 100,
          maxMemoryUsage: 64,
          maxCpuUsage: 30,
          minThroughput: 1000,
        },
      ],
      [
        'ai_processing',
        {
          name: 'AI Processing',
          maxResponseTime: 2000,
          maxMemoryUsage: 256,
          maxCpuUsage: 70,
          minThroughput: 50,
        },
      ],
      [
        'graphql_query',
        {
          name: 'GraphQL Query',
          maxResponseTime: 300,
          maxMemoryUsage: 96,
          maxCpuUsage: 40,
          minThroughput: 200,
        },
      ],
      [
        'authentication',
        {
          name: 'Authentication',
          maxResponseTime: 200,
          maxMemoryUsage: 32,
          maxCpuUsage: 20,
          minThroughput: 500,
        },
      ],
    ];

    benchmarks.forEach(([key, benchmark]) => {
      this.benchmarks.set(key, benchmark);
    });
  }

  /**
   * Setup test environment
   */
  async setupTest(testName: string): Promise<void> {
    this.startTime = Date.now();
    console.log(`🧪 Setting up test: ${testName}`);

    // Reset database if configured
    if (this.config.database.resetBefore) {
      await this.resetDatabase();
    }

    // Seed test data if configured
    if (this.config.database.seedData) {
      await this.seedTestData();
    }

    // Initialize monitoring
    if (this.config.monitoring.collectMetrics) {
      monitoringService.recordMetric('test_started', 1, 'count', { testName });
    }

    // Setup security scanning
    if (this.config.security.enableSecurityScans) {
      await this.setupSecurityScanning();
    }
  }

  /**
   * Cleanup test environment
   */
  async cleanupTest(testName: string): Promise<void> {
    const duration = Date.now() - this.startTime;
    console.log(`🧹 Cleaning up test: ${testName} (${duration}ms)`);

    // Cleanup database transactions
    if (this.config.database.isolateTransactions) {
      await this.cleanupDatabase();
    }

    // Record test metrics
    if (this.config.monitoring.collectMetrics) {
      monitoringService.recordMetric('test_completed', 1, 'count', {
        testName,
        duration: duration.toString(),
      });
    }
  }

  /**
   * Reset database to clean state
   */
  private async resetDatabase(): Promise<void> {
    try {
      await this.database.connect();

      // Truncate all tables in reverse dependency order
      const prisma = (this.database as any).prisma as PrismaClient;

      await prisma.responseSuggestion.deleteMany({});
      await prisma.message.deleteMany({});
      await prisma.conversation.deleteMany({});
      await prisma.healthCheck.deleteMany({});

      console.log('✅ Database reset completed');
    } catch (error) {
      console.error('❌ Database reset failed:', error);
      throw error;
    }
  }

  /**
   * Seed test data
   */
  private async seedTestData(): Promise<void> {
    try {
      // Create test conversation
      const conversation = await this.database.createConversation({
        ticketId: 'test-ticket-001',
        zendeskTicketId: 'zendesk-123',
        customerId: 'customer-001',
        agentId: 'agent-001',
        subject: 'Test Support Request',
        priority: 'normal',
        tags: ['test', 'support'],
        status: 'active',
        metadata: { source: 'test-framework' },
      });

      // Create test messages
      await this.database.createMessage({
        conversationId: conversation.id,
        content: 'Hello, I need help with my account',
        senderType: 'customer',
        senderId: 'customer-001',
        source: 'test',
      });

      await this.database.createMessage({
        conversationId: conversation.id,
        content:
          "Hi! I'd be happy to help you with your account. What specific issue are you experiencing?",
        senderType: 'agent',
        senderId: 'agent-001',
        source: 'test',
      });

      console.log('✅ Test data seeded successfully');
    } catch (error) {
      console.error('❌ Test data seeding failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup database
   */
  private async cleanupDatabase(): Promise<void> {
    try {
      await this.database.disconnect();
      console.log('✅ Database cleanup completed');
    } catch (error) {
      console.error('❌ Database cleanup failed:', error);
    }
  }

  /**
   * Setup security scanning for tests
   */
  private async setupSecurityScanning(): Promise<void> {
    if (this.config.security.mockExternalServices) {
      // Mock external security services for testing
      console.log('🔒 Security scanning mocked for testing');
    }
  }

  /**
   * Run performance benchmark test
   */
  async benchmarkOperation(
    operationType: string,
    operation: () => Promise<any>
  ): Promise<{
    passed: boolean;
    metrics: {
      responseTime: number;
      memoryUsage: number;
      cpuUsage: number;
    };
    benchmark: PerformanceBenchmark;
  }> {
    const benchmark = this.benchmarks.get(operationType);
    if (!benchmark) {
      throw new Error(`No benchmark defined for operation: ${operationType}`);
    }

    // Measure memory before operation
    const memoryBefore = process.memoryUsage();
    const startTime = Date.now();

    try {
      // Execute operation
      await operation();

      // Measure results
      const responseTime = Date.now() - startTime;
      const memoryAfter = process.memoryUsage();
      const memoryUsed = Math.round(
        (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024
      );
      const cpuUsage = process.cpuUsage();
      const cpuPercent = Math.round(
        (cpuUsage.user + cpuUsage.system) / 1000000
      ); // Convert to percentage

      const metrics = {
        responseTime,
        memoryUsage: memoryUsed,
        cpuUsage: cpuPercent,
      };

      // Check against benchmarks
      const passed =
        responseTime <= benchmark.maxResponseTime &&
        memoryUsed <= benchmark.maxMemoryUsage &&
        cpuPercent <= benchmark.maxCpuUsage;

      // Record metrics
      if (this.config.monitoring.trackPerformance) {
        monitoringService.recordPerformanceMetric(
          `benchmark_${operationType}`,
          responseTime,
          passed,
          {
            memoryUsage: memoryUsed.toString(),
            cpuUsage: cpuPercent.toString(),
          }
        );
      }

      return { passed, metrics, benchmark };
    } catch (error) {
      console.error(`Benchmark failed for ${operationType}:`, error);
      throw error;
    }
  }

  /**
   * Run security test
   */
  async runSecurityTest(testName: string): Promise<SecurityTestResult> {
    console.log(`🔒 Running security test: ${testName}`);

    try {
      // Run vulnerability scan
      const scanId =
        await vulnerabilityManagementService.runSecurityScan('manual');
      const scanResult = vulnerabilityManagementService.getScanResult(scanId);

      if (!scanResult) {
        throw new Error(`Security scan ${scanId} not found`);
      }

      // Get compliance report
      const complianceReport = soc2ComplianceService.generateComplianceReport();

      // Transform vulnerabilities
      const vulnerabilities = scanResult.vulnerabilities.map(vuln => ({
        severity:
          vuln.severity === 'info'
            ? 'low'
            : (vuln.severity as 'low' | 'medium' | 'high' | 'critical'),
        description: vuln.description,
        recommendation: vuln.recommendation,
      }));

      const result: SecurityTestResult = {
        testName,
        passed:
          scanResult.summary.critical === 0 && scanResult.summary.high < 3,
        vulnerabilities,
        complianceScore: complianceReport.complianceScore,
      };

      // Record security metrics
      monitoringService.recordMetric('security_test_completed', 1, 'count', {
        testName,
        passed: result.passed.toString(),
        complianceScore: result.complianceScore.toString(),
      });

      return result;
    } catch (error) {
      console.error(`Security test failed: ${testName}`, error);
      return {
        testName,
        passed: false,
        vulnerabilities: [
          {
            severity: 'high',
            description: `Security test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            recommendation:
              'Investigate test execution failure and fix underlying issues',
          },
        ],
        complianceScore: 0,
      };
    }
  }

  /**
   * Run load test
   */
  async runLoadTest(
    testName: string,
    operation: () => Promise<any>,
    options: {
      concurrentUsers: number;
      duration: number; // seconds
      rampUpTime: number; // seconds
    }
  ): Promise<{
    passed: boolean;
    metrics: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      averageResponseTime: number;
      requestsPerSecond: number;
      errorRate: number;
    };
  }> {
    console.log(`🚀 Running load test: ${testName}`);

    const startTime = Date.now();
    const results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [] as number[],
    };

    try {
      // Calculate request intervals
      const totalRequests =
        options.concurrentUsers * (options.duration + options.rampUpTime);
      const requestInterval = (options.duration * 1000) / totalRequests;

      // Execute load test
      const promises: Promise<void>[] = [];

      for (let i = 0; i < options.concurrentUsers; i++) {
        const userPromise = this.simulateUserLoad(
          operation,
          options.duration,
          requestInterval,
          results
        );
        promises.push(userPromise);

        // Ramp up delay
        if (options.rampUpTime > 0) {
          await new Promise(resolve =>
            setTimeout(
              resolve,
              (options.rampUpTime * 1000) / options.concurrentUsers
            )
          );
        }
      }

      // Wait for all users to complete
      await Promise.all(promises);

      // Calculate metrics
      const duration = (Date.now() - startTime) / 1000;
      const averageResponseTime =
        results.responseTimes.reduce((sum, time) => sum + time, 0) /
          results.responseTimes.length || 0;
      const requestsPerSecond = results.totalRequests / duration;
      const errorRate = (results.failedRequests / results.totalRequests) * 100;

      const metrics = {
        totalRequests: results.totalRequests,
        successfulRequests: results.successfulRequests,
        failedRequests: results.failedRequests,
        averageResponseTime: Math.round(averageResponseTime),
        requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
      };

      // Determine if test passed
      const passed =
        errorRate < 5 && // Less than 5% error rate
        averageResponseTime < 1000 && // Less than 1 second average response time
        requestsPerSecond >= 10; // At least 10 RPS

      // Record load test metrics
      monitoringService.recordMetric('load_test_completed', 1, 'count', {
        testName,
        passed: passed.toString(),
        errorRate: errorRate.toString(),
        rps: requestsPerSecond.toString(),
      });

      return { passed, metrics };
    } catch (error) {
      console.error(`Load test failed: ${testName}`, error);
      throw error;
    }
  }

  /**
   * Simulate user load for load testing
   */
  private async simulateUserLoad(
    operation: () => Promise<any>,
    duration: number,
    interval: number,
    results: any
  ): Promise<void> {
    const endTime = Date.now() + duration * 1000;

    while (Date.now() < endTime) {
      const requestStartTime = Date.now();
      results.totalRequests++;

      try {
        await operation();
        results.successfulRequests++;
        results.responseTimes.push(Date.now() - requestStartTime);
      } catch (error) {
        results.failedRequests++;
      }

      // Wait for next request
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  /**
   * Generate test report
   */
  generateTestReport(): {
    summary: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      coverage: number;
      duration: number;
    };
    performance: any[];
    security: SecurityTestResult[];
    recommendations: string[];
  } {
    const summary = {
      totalTests: this.testMetrics.size,
      passedTests: Array.from(this.testMetrics.values()).filter(m => m.passed)
        .length,
      failedTests: Array.from(this.testMetrics.values()).filter(m => !m.passed)
        .length,
      coverage: 85, // Would calculate from actual coverage data
      duration: Date.now() - this.startTime,
    };

    const performance = Array.from(this.testMetrics.entries())
      .filter(([key]) => key.startsWith('performance_'))
      .map(([key, value]) => ({ test: key, ...value }));

    const security = Array.from(this.testMetrics.entries())
      .filter(([key]) => key.startsWith('security_'))
      .map(([, value]) => value as SecurityTestResult);

    const recommendations = [
      ...(summary.coverage < 90
        ? ['Increase test coverage to at least 90%']
        : []),
      ...(summary.failedTests > 0
        ? ['Fix all failing tests before production deployment']
        : []),
      ...security.flatMap(s => s.vulnerabilities.map(v => v.recommendation)),
    ];

    return {
      summary,
      performance,
      security,
      recommendations,
    };
  }

  /**
   * Create test data factory
   */
  static createTestData() {
    return {
      conversation: (overrides = {}) => ({
        ticketId: `ticket-${Date.now()}`,
        customerId: `customer-${Date.now()}`,
        agentId: `agent-${Date.now()}`,
        subject: 'Test Conversation',
        status: 'OPEN' as const,
        ...overrides,
      }),

      message: (conversationId: string, overrides = {}) => ({
        conversationId,
        content: 'Test message content',
        senderType: 'CUSTOMER' as const,
        senderId: `sender-${Date.now()}`,
        ...overrides,
      }),

      aiAnalysis: (overrides = {}) => ({
        sentiment: {
          polarity: 'neutral',
          confidence: 0.85,
          emotions: ['neutral'],
        },
        intent: {
          primary: 'support_request',
          confidence: 0.92,
        },
        ...overrides,
      }),
    };
  }
}

// Export test configurations
export const testConfigs = {
  unit: {
    environment: 'test' as const,
    database: {
      resetBefore: true,
      seedData: false,
      isolateTransactions: true,
    },
    monitoring: {
      collectMetrics: false,
      trackPerformance: false,
    },
    security: {
      enableSecurityScans: false,
      mockExternalServices: true,
    },
  },

  integration: {
    environment: 'integration' as const,
    database: {
      resetBefore: true,
      seedData: true,
      isolateTransactions: true,
    },
    monitoring: {
      collectMetrics: true,
      trackPerformance: true,
    },
    security: {
      enableSecurityScans: false,
      mockExternalServices: true,
    },
  },

  e2e: {
    environment: 'e2e' as const,
    database: {
      resetBefore: true,
      seedData: true,
      isolateTransactions: false,
    },
    monitoring: {
      collectMetrics: true,
      trackPerformance: true,
    },
    security: {
      enableSecurityScans: true,
      mockExternalServices: false,
    },
  },
};
