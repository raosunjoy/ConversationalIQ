/**
 * Database migration script for ConversationIQ
 * Handles database setup and migrations
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function runMigrations(): Promise<void> {
  try {
    console.log('🚀 Starting database migrations...');

    // Check if database is accessible
    await prisma.$connect();
    console.log('✅ Database connection established');

    // Run Prisma migrations
    console.log('📋 Running Prisma migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });

    // Generate Prisma client
    console.log('🔧 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // Initialize health check
    console.log('🏥 Initializing health check...');
    await prisma.healthCheck.upsert({
      where: { id: 1 },
      update: {
        status: 'healthy',
        lastCheck: new Date(),
        metadata: { migratedAt: new Date() },
      },
      create: {
        id: 1,
        status: 'healthy',
        lastCheck: new Date(),
        metadata: { migratedAt: new Date() },
      },
    });

    console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function resetDatabase(): Promise<void> {
  try {
    console.log('🧹 Resetting database...');

    await prisma.$connect();

    // Reset database
    execSync('npx prisma migrate reset --force', { stdio: 'inherit' });

    console.log('✅ Database reset completed');
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function seedDatabase(): Promise<void> {
  try {
    console.log('🌱 Seeding database...');

    await prisma.$connect();

    // Create sample data for development
    if (process.env.NODE_ENV === 'development') {
      // Sample conversation
      const conversation = await prisma.conversation.create({
        data: {
          customerId: 'customer_demo',
          agentId: 'agent_demo',
          status: 'active',
          zendeskTicketId: 'demo_ticket_123',
          metadata: {
            source: 'demo',
            priority: 'medium',
          },
        },
      });

      // Sample message
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content: 'Hello, I need help with my order',
          senderType: 'customer',
          senderId: 'customer_demo',
          aiAnalysis: {
            sentiment: { polarity: 'neutral', confidence: 0.75 },
            intent: { primary: 'request_help', confidence: 0.85 },
            escalationRisk: 0.2,
          },
        },
      });

      console.log('✅ Development seed data created');
    }

    console.log('✅ Database seeding completed');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle command line arguments
const command = process.argv[2];

switch (command) {
  case 'migrate':
    runMigrations();
    break;
  case 'reset':
    resetDatabase();
    break;
  case 'seed':
    seedDatabase();
    break;
  default:
    console.log('Usage: tsx scripts/migrate.ts [migrate|reset|seed]');
    console.log('  migrate  - Run database migrations');
    console.log('  reset    - Reset database (destructive)');
    console.log('  seed     - Seed database with sample data');
    process.exit(1);
}
