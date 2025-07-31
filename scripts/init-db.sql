-- Database initialization script for ConversationIQ development
-- This script sets up the basic database structure

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE conversationiq_dev'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'conversationiq_dev')\gexec

-- Connect to the database
\c conversationiq_dev;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create basic health check table
CREATE TABLE IF NOT EXISTS health_check (
    id SERIAL PRIMARY KEY,
    status VARCHAR(50) NOT NULL DEFAULT 'healthy',
    last_check TIMESTAMP DEFAULT NOW()
);

-- Insert initial health check record
INSERT INTO health_check (status) VALUES ('healthy') ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE conversationiq_dev TO dev_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dev_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dev_user;