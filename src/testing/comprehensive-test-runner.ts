#!/usr/bin/env tsx

/**
 * Comprehensive Test Runner CLI
 * Executes full test suite and generates production readiness report
 */

import { testRunner } from './test-runner';
import { monitoringService } from '../monitoring/monitoring-service';

async function main() {
  console.log('🚀 ConversationIQ - Comprehensive Test Suite');
  console.log('='.repeat(60));
  console.log('📋 Testing all aspects for production readiness...\n');

  try {
    // Record test execution start
    monitoringService.recordMetric('test_suite_started', 1, 'count', {
      timestamp: new Date().toISOString(),
    });

    // Execute comprehensive test suite
    const report = await testRunner.runAllTests();

    // Record results
    monitoringService.recordMetric('test_suite_completed', 1, 'count', {
      success: report.readinessAssessment.productionReady.toString(),
      qualityScore: report.summary.qualityScore.toString(),
      riskLevel: report.readinessAssessment.riskLevel,
    });

    // Save detailed report to file
    const fs = await import('fs');
    const reportPath = `test-reports/comprehensive-test-report-${Date.now()}.json`;
    await fs.promises.mkdir('test-reports', { recursive: true });
    await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    // Exit with appropriate code
    process.exit(report.readinessAssessment.productionReady ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Test suite execution failed:', error);

    // Record failure
    monitoringService.recordMetric('test_suite_failed', 1, 'count', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };
