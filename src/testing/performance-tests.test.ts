/**
 * Performance Testing Suite for ConversationIQ
 * Benchmarks system performance, scalability, and resource usage
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { TestFramework, testConfigs } from './test-framework';
import { DatabaseService } from '../services/database';
import { monitoringService } from '../monitoring/monitoring-service';
import { createServer } from '../api/server';
import request from 'supertest';
import { Application } from 'express';
import { Server } from 'http';

// Test framework and application instances
const testFramework = new TestFramework(testConfigs.integration);
let app: Application;
let server: Server;
let stopServer: () => Promise<void>;

beforeAll(async () => {
  console.log('🚀 Setting up performance test environment...');
  
  const serverSetup = await createServer();
  app = serverSetup.app;
  server = await serverSetup.startServer(0);
  stopServer = serverSetup.stopServer;
}, 30000);

afterAll(async () => {
  await stopServer();
}, 10000);

describe('Performance Tests - API Response Times', () => {
  beforeEach(async () => {
    await testFramework.setupTest('performance-api');
  });

  afterEach(async () => {
    await testFramework.cleanupTest('performance-api');
  });

  test('should meet response time benchmarks for core endpoints', async () => {
    const endpoints = [
      { path: '/health', maxTime: 100 },
      { path: '/monitoring/dashboard', maxTime: 500 },
      { path: '/monitoring/performance', maxTime: 300 },
      { path: '/privacy/policy', maxTime: 200 },
    ];

    for (const endpoint of endpoints) {
      const benchmark = await testFramework.benchmarkOperation('api_response', async () => {
        const response = await request(app)
          .get(endpoint.path)
          .expect(200);
        return response.body;
      });

      expect(benchmark.passed).toBe(true);
      expect(benchmark.metrics.responseTime).toBeLessThan(endpoint.maxTime);
      
      console.log(`✅ ${endpoint.path}: ${benchmark.metrics.responseTime}ms (limit: ${endpoint.maxTime}ms)`);
    }
  });

  test('should handle concurrent API requests efficiently', async () => {
    const concurrentRequests = 50;
    const startTime = Date.now();
    
    const requests = Array.from({ length: concurrentRequests }, () =>
      request(app).get('/health').expect(200)
    );

    const responses = await Promise.all(requests);
    const totalTime = Date.now() - startTime;
    const averageTime = totalTime / concurrentRequests;

    expect(responses.length).toBe(concurrentRequests);
    expect(averageTime).toBeLessThan(100); // Average under 100ms
    expect(totalTime).toBeLessThan(5000); // Total under 5 seconds
    
    console.log(`✅ Concurrent requests: ${concurrentRequests} in ${totalTime}ms (avg: ${averageTime}ms)`);
  });

  test('should maintain performance under sustained load', async () => {
    const loadTest = await testFramework.runLoadTest(
      'sustained_api_load',
      async () => {
        const endpoints = ['/health', '/monitoring/performance', '/privacy/policy'];
        const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
        const response = await request(app).get(endpoint).expect(200);
        return response.body;
      },
      {
        concurrentUsers: 20,
        duration: 30, // 30 seconds
        rampUpTime: 5,
      }
    );

    expect(loadTest.passed).toBe(true);
    expect(loadTest.metrics.averageResponseTime).toBeLessThan(500);
    expect(loadTest.metrics.errorRate).toBeLessThan(1);
    expect(loadTest.metrics.requestsPerSecond).toBeGreaterThan(30);
    
    console.log('✅ Sustained Load Test Results:', loadTest.metrics);
  });

  test('should handle memory efficiently under load', async () => {
    const initialMemory = process.memoryUsage();
    
    // Generate high request volume
    const heavyLoad = await testFramework.runLoadTest(
      'memory_efficiency_test',
      async () => {
        const response = await request(app)
          .get('/monitoring/dashboard')
          .expect(200);
        return response.body;
      },
      {
        concurrentUsers: 30,
        duration: 15,
        rampUpTime: 3,
      }
    );

    const finalMemory = process.memoryUsage();
    const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB

    expect(heavyLoad.passed).toBe(true);
    expect(memoryIncrease).toBeLessThan(100); // Memory increase should be under 100MB
    
    console.log(`✅ Memory usage increase: ${memoryIncrease.toFixed(2)}MB`);
  });

  test('should recover quickly from error conditions', async () => {
    // Simulate error conditions and measure recovery time
    let errorResponseTime = 0;
    let recoveryTime = 0;
    
    // Test error response
    const errorStart = Date.now();
    try {
      await request(app).get('/nonexistent-endpoint').expect(404);
      errorResponseTime = Date.now() - errorStart;
    } catch (error) {
      errorResponseTime = Date.now() - errorStart;
    }

    // Test recovery with valid request
    const recoveryStart = Date.now();
    await request(app).get('/health').expect(200);
    recoveryTime = Date.now() - recoveryStart;

    expect(errorResponseTime).toBeLessThan(200); // Error handling should be fast
    expect(recoveryTime).toBeLessThan(100); // Recovery should be immediate
    
    console.log(`✅ Error response: ${errorResponseTime}ms, Recovery: ${recoveryTime}ms`);
  });
});

describe('Performance Tests - Database Operations', () => {
  let database: DatabaseService;

  beforeEach(async () => {
    await testFramework.setupTest('performance-database');
    database = new DatabaseService();
    await database.connect();
  });

  afterEach(async () => {
    await database.disconnect();
    await testFramework.cleanupTest('performance-database');
  });

  test('should meet database query performance benchmarks', async () => {
    const testData = TestFramework.createTestData();
    
    // Test conversation creation performance
    const createBenchmark = await testFramework.benchmarkOperation('database_query', async () => {
      return await database.createConversation(testData.conversation());
    });

    expect(createBenchmark.passed).toBe(true);
    expect(createBenchmark.metrics.responseTime).toBeLessThan(50);
    
    // Test message creation performance
    const conversation = await database.createConversation(testData.conversation());
    
    const messageBenchmark = await testFramework.benchmarkOperation('database_query', async () => {
      return await database.createMessage(testData.message(conversation.id));
    });

    expect(messageBenchmark.passed).toBe(true);
    expect(messageBenchmark.metrics.responseTime).toBeLessThan(30);
    
    console.log(`✅ DB Create Conversation: ${createBenchmark.metrics.responseTime}ms`);
    console.log(`✅ DB Create Message: ${messageBenchmark.metrics.responseTime}ms`);
  });

  test('should handle high-volume database operations', async () => {
    const testData = TestFramework.createTestData();
    const batchSize = 100;
    const startTime = Date.now();
    
    // Create many conversations concurrently
    const operations = Array.from({ length: batchSize }, (_, i) =>
      database.createConversation(testData.conversation({
        ticketId: `performance-test-${i}`,
      }))
    );

    const results = await Promise.allSettled(operations);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const totalTime = Date.now() - startTime;
    const avgTime = totalTime / batchSize;

    expect(successCount).toBe(batchSize);
    expect(avgTime).toBeLessThan(100); // Average under 100ms per operation
    expect(totalTime).toBeLessThan(10000); // Total under 10 seconds
    
    console.log(`✅ DB Batch Operations: ${batchSize} operations in ${totalTime}ms (avg: ${avgTime}ms)`);
  });

  test('should maintain performance with large datasets', async () => {
    const testData = TestFramework.createTestData();
    
    // Create a conversation with many messages
    const conversation = await database.createConversation(testData.conversation());
    
    // Add many messages to test query performance with large datasets
    const messageCount = 500;
    const messageOperations = Array.from({ length: messageCount }, (_, i) =>
      database.createMessage(testData.message(conversation.id, {
        content: `Performance test message ${i + 1}`,
      }))
    );

    const startTime = Date.now();
    await Promise.all(messageOperations);
    const insertTime = Date.now() - startTime;
    
    // Test retrieval performance
    const retrievalStart = Date.now();
    const retrievedConversation = await database.findConversationById(conversation.id);
    const retrievalTime = Date.now() - retrievalStart;

    expect(retrievedConversation).toBeDefined();
    expect(retrievedConversation?.messages.length).toBe(messageCount);
    expect(retrievalTime).toBeLessThan(200); // Retrieval should be under 200ms
    
    console.log(`✅ Large Dataset: ${messageCount} messages inserted in ${insertTime}ms, retrieved in ${retrievalTime}ms`);
  });

  test('should handle concurrent database connections efficiently', async () => {
    const connectionCount = 20;
    const databases = Array.from({ length: connectionCount }, () => new DatabaseService());
    
    // Connect all databases concurrently
    const connectStart = Date.now();
    await Promise.all(databases.map(db => db.connect()));
    const connectTime = Date.now() - connectStart;
    
    // Perform operations on all connections
    const testData = TestFramework.createTestData();
    const operationStart = Date.now();
    
    const operations = databases.map(db => 
      db.createConversation(testData.conversation({
        ticketId: `concurrent-${Math.random()}`,
      }))
    );
    
    const results = await Promise.allSettled(operations);
    const operationTime = Date.now() - operationStart;
    
    // Disconnect all databases
    await Promise.all(databases.map(db => db.disconnect()));
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    
    expect(successCount).toBe(connectionCount);
    expect(connectTime).toBeLessThan(5000); // Connection time under 5 seconds
    expect(operationTime).toBeLessThan(3000); // Operations under 3 seconds
    
    console.log(`✅ Concurrent Connections: ${connectionCount} connections, operations completed in ${operationTime}ms`);
  });

  test('should handle GDPR operations efficiently', async () => {
    const testEmail = `performance-gdpr-${Date.now()}@example.com`;
    const testData = TestFramework.createTestData();
    
    // Create test data
    const conversation = await database.createConversation(
      testData.conversation({
        customerId: testEmail,
        metadata: { customerEmail: testEmail },
      })
    );

    await Promise.all([
      database.createMessage(testData.message(conversation.id, { content: 'Message 1' })),
      database.createMessage(testData.message(conversation.id, { content: 'Message 2' })),
      database.createMessage(testData.message(conversation.id, { content: 'Message 3' })),
    ]);

    // Test data access request performance
    const accessBenchmark = await testFramework.benchmarkOperation('database_query', async () => {
      return await database.handleDataSubjectAccessRequest(testEmail);
    });

    // Test data deletion request performance
    const deletionBenchmark = await testFramework.benchmarkOperation('database_query', async () => {
      return await database.handleDataSubjectDeletionRequest(testEmail);
    });

    expect(accessBenchmark.passed).toBe(true);
    expect(deletionBenchmark.passed).toBe(true);
    expect(accessBenchmark.metrics.responseTime).toBeLessThan(500);
    expect(deletionBenchmark.metrics.responseTime).toBeLessThan(1000);
    
    console.log(`✅ GDPR Access: ${accessBenchmark.metrics.responseTime}ms`);
    console.log(`✅ GDPR Deletion: ${deletionBenchmark.metrics.responseTime}ms`);
  });
});

describe('Performance Tests - Monitoring and Analytics', () => {
  beforeEach(async () => {
    await testFramework.setupTest('performance-monitoring');
  });

  afterEach(async () => {
    await testFramework.cleanupTest('performance-monitoring');
  });

  test('should handle high-frequency metric recording', async () => {
    const metricCount = 10000;
    
    const benchmark = await testFramework.benchmarkOperation('api_response', async () => {
      for (let i = 0; i < metricCount; i++) {
        monitoringService.recordMetric(
          'performance_test_metric',
          Math.random() * 100,
          'gauge',
          { batch: Math.floor(i / 100).toString() }
        );
      }
    });

    expect(benchmark.passed).toBe(true);
    expect(benchmark.metrics.responseTime).toBeLessThan(2000); // Under 2 seconds for 10k metrics
    expect(benchmark.metrics.memoryUsage).toBeLessThan(50); // Under 50MB memory increase
    
    console.log(`✅ High-Frequency Metrics: ${metricCount} metrics in ${benchmark.metrics.responseTime}ms`);
  });

  test('should provide fast dashboard data aggregation', async () => {
    // Pre-populate with test metrics
    for (let i = 0; i < 1000; i++) {
      monitoringService.recordMetric('test_metric_' + (i % 10), Math.random() * 100, 'gauge');
      monitoringService.recordPerformanceMetric('test_operation', Math.random() * 500, true);
    }

    const benchmark = await testFramework.benchmarkOperation('api_response', async () => {
      return monitoringService.getDashboardData();
    });

    expect(benchmark.passed).toBe(true);
    expect(benchmark.metrics.responseTime).toBeLessThan(200); // Dashboard data under 200ms
    
    const dashboardData = monitoringService.getDashboardData();
    expect(Object.keys(dashboardData.metrics).length).toBeGreaterThan(0);
    
    console.log(`✅ Dashboard Aggregation: ${benchmark.metrics.responseTime}ms`);
  });

  test('should handle metric history queries efficiently', async () => {
    const metricName = 'performance_history_test';
    
    // Generate historical data
    for (let i = 0; i < 500; i++) {
      monitoringService.recordMetric(metricName, Math.random() * 100, 'gauge');
    }

    const benchmark = await testFramework.benchmarkOperation('api_response', async () => {
      return monitoringService.getMetricHistory(metricName, 24);
    });

    expect(benchmark.passed).toBe(true);
    expect(benchmark.metrics.responseTime).toBeLessThan(100); // History query under 100ms
    
    const history = monitoringService.getMetricHistory(metricName, 24);
    expect(history.length).toBeGreaterThan(0);
    
    console.log(`✅ Metric History Query: ${benchmark.metrics.responseTime}ms for ${history.length} points`);
  });

  test('should efficiently manage memory for long-running metrics', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Simulate long-running application with continuous metrics
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute++) {
        monitoringService.recordMetric('hourly_metric', Math.random() * 100, 'gauge');
        
        // Simulate some processing time
        if (minute % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

    // Memory increase should be reasonable for 24 hours of metrics
    expect(memoryIncrease).toBeLessThan(200); // Under 200MB increase
    
    console.log(`✅ Long-running Memory Management: ${memoryIncrease.toFixed(2)}MB increase over 24h simulation`);
  });
});

describe('Performance Tests - End-to-End Workflows', () => {
  beforeEach(async () => {
    await testFramework.setupTest('performance-e2e');
  });

  afterEach(async () => {
    await testFramework.cleanupTest('performance-e2e');
  });

  test('should handle complete conversation workflow efficiently', async () => {
    const database = new DatabaseService();
    await database.connect();
    
    const testData = TestFramework.createTestData();
    
    const workflowBenchmark = await testFramework.benchmarkOperation('ai_processing', async () => {
      // 1. Create conversation
      const conversation = await database.createConversation(testData.conversation());
      
      // 2. Create message with PII
      const message = await database.createMessage(
        testData.message(conversation.id, {
          content: 'Hi, I need help. My email is customer@example.com',
        })
      );
      
      // 3. Add AI analysis
      await database.addAIAnalysis(message.id, testData.aiAnalysis({
        sentiment: { polarity: 'neutral', confidence: 0.85 },
        intent: { primary: 'support_request', confidence: 0.90 },
      }));
      
      // 4. Record metrics
      monitoringService.recordMetric('conversation_completed', 1, 'count');
      monitoringService.recordPerformanceMetric('conversation_workflow', Date.now() - workflowBenchmark.benchmark.maxResponseTime, true);
      
      return conversation;
    });

    expect(workflowBenchmark.passed).toBe(true);
    expect(workflowBenchmark.metrics.responseTime).toBeLessThan(1000); // Complete workflow under 1 second
    
    console.log(`✅ E2E Conversation Workflow: ${workflowBenchmark.metrics.responseTime}ms`);
    
    await database.disconnect();
  });

  test('should handle bulk conversation processing', async () => {
    const database = new DatabaseService();
    await database.connect();
    
    const conversationCount = 50;
    const testData = TestFramework.createTestData();
    
    const bulkBenchmark = await testFramework.benchmarkOperation('api_response', async () => {
      const operations = Array.from({ length: conversationCount }, async (_, i) => {
        const conversation = await database.createConversation(
          testData.conversation({ ticketId: `bulk-${i}` })
        );
        
        const message = await database.createMessage(
          testData.message(conversation.id, { content: `Bulk message ${i}` })
        );
        
        await database.addAIAnalysis(message.id, testData.aiAnalysis());
        
        return conversation;
      });

      return await Promise.all(operations);
    });

    expect(bulkBenchmark.passed).toBe(true);
    expect(bulkBenchmark.metrics.responseTime).toBeLessThan(10000); // Bulk processing under 10 seconds
    
    console.log(`✅ Bulk Processing: ${conversationCount} conversations in ${bulkBenchmark.metrics.responseTime}ms`);
    
    await database.disconnect();
  });

  test('should maintain API performance during peak load simulation', async () => {
    // Simulate peak load with mixed API operations
    const peakLoadTest = await testFramework.runLoadTest(
      'peak_load_simulation',
      async () => {
        const operations = [
          () => request(app).get('/health').expect(200),
          () => request(app).get('/monitoring/dashboard').expect(200),
          () => request(app).get('/monitoring/performance').expect(200),
          () => request(app).get('/privacy/policy').expect(200),
          () => request(app).post('/privacy/consent')
            .send({
              userId: '12345678-1234-1234-1234-123456789012',
              consentType: 'analytics',
              granted: true,
            })
            .expect(200),
        ];

        const randomOp = operations[Math.floor(Math.random() * operations.length)];
        const response = await randomOp();
        return response.body;
      },
      {
        concurrentUsers: 100, // High concurrent load
        duration: 60, // 1 minute sustained load
        rampUpTime: 15, // 15 second ramp up
      }
    );

    expect(peakLoadTest.passed).toBe(true);
    expect(peakLoadTest.metrics.averageResponseTime).toBeLessThan(1000); // Under 1 second average
    expect(peakLoadTest.metrics.errorRate).toBeLessThan(2); // Under 2% error rate
    expect(peakLoadTest.metrics.requestsPerSecond).toBeGreaterThan(80); // At least 80 RPS
    
    console.log('✅ Peak Load Simulation Results:');
    console.log(`   • Average Response Time: ${peakLoadTest.metrics.averageResponseTime}ms`);
    console.log(`   • Error Rate: ${peakLoadTest.metrics.errorRate}%`);
    console.log(`   • Requests per Second: ${peakLoadTest.metrics.requestsPerSecond}`);
    console.log(`   • Total Requests: ${peakLoadTest.metrics.totalRequests}`);
  });
});

describe('Performance Tests - Resource Usage and Scalability', () => {
  test('should demonstrate horizontal scaling characteristics', async () => {
    // Test that performance scales linearly with increased resources
    const singleInstanceResults = await testFramework.runLoadTest(
      'single_instance_baseline',
      async () => {
        const response = await request(app).get('/health').expect(200);
        return response.body;
      },
      { concurrentUsers: 25, duration: 10, rampUpTime: 2 }
    );

    const doubleInstanceResults = await testFramework.runLoadTest(
      'double_instance_simulation',
      async () => {
        // Simulate double capacity by running requests in parallel
        const responses = await Promise.all([
          request(app).get('/health').expect(200),
          request(app).get('/health').expect(200),
        ]);
        return responses[0].body;
      },
      { concurrentUsers: 50, duration: 10, rampUpTime: 2 }
    );

    // Double capacity should handle roughly double the load
    const scalingEfficiency = doubleInstanceResults.metrics.requestsPerSecond / singleInstanceResults.metrics.requestsPerSecond;
    
    expect(scalingEfficiency).toBeGreaterThan(1.5); // At least 1.5x improvement
    expect(doubleInstanceResults.metrics.errorRate).toBeLessThan(singleInstanceResults.metrics.errorRate + 1);
    
    console.log(`✅ Scaling Efficiency: ${scalingEfficiency.toFixed(2)}x improvement`);
  });

  test('should demonstrate efficient resource cleanup', async () => {
    const initialMemory = process.memoryUsage();
    
    // Generate temporary load
    await testFramework.runLoadTest(
      'resource_cleanup_test',
      async () => {
        const response = await request(app).get('/monitoring/dashboard').expect(200);
        // Create temporary objects that should be cleaned up
        const tempData = new Array(1000).fill(0).map(() => Math.random());
        return { ...response.body, tempData };
      },
      { concurrentUsers: 20, duration: 15, rampUpTime: 3 }
    );

    // Allow time for garbage collection
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage();
    const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

    // Memory should return close to baseline
    expect(memoryIncrease).toBeLessThan(50); // Under 50MB permanent increase
    
    console.log(`✅ Resource Cleanup: ${memoryIncrease.toFixed(2)}MB permanent memory increase`);
  });
});

// Generate final performance report
afterAll(async () => {
  console.log('\n📊 Generating Performance Test Report...');
  
  const report = testFramework.generateTestReport();
  
  console.log('\n🏆 Performance Test Summary:');
  console.log(`   • Total Tests: ${report.summary.totalTests}`);
  console.log(`   • Passed Tests: ${report.summary.passedTests}`);
  console.log(`   • Failed Tests: ${report.summary.failedTests}`);
  console.log(`   • Success Rate: ${((report.summary.passedTests / report.summary.totalTests) * 100).toFixed(1)}%`);
  console.log(`   • Total Duration: ${(report.summary.duration / 1000).toFixed(1)}s`);
  
  if (report.recommendations.length > 0) {
    console.log('\n⚠️ Performance Recommendations:');
    report.recommendations.forEach(rec => console.log(`   • ${rec}`));
  }
  
  if (report.summary.failedTests === 0) {
    console.log('\n✅ All performance benchmarks passed! System is production-ready.');
  } else {
    console.log('\n❌ Some performance benchmarks failed. Review results before production deployment.');
  }
});