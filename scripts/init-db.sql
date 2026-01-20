-- ARUS (Marine Predictive Maintenance & Scheduling) Database Initialization
-- This script initializes the PostgreSQL database for ARUS

-- Create database and user (these may already exist in Docker)
-- CREATE DATABASE arus;
-- CREATE USER arus_user WITH PASSWORD 'arus_secure_password';
-- GRANT ALL PRIVILEGES ON DATABASE arus TO arus_user;

-- Connect to ARUS database
\c arus;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO arus_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO arus_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO arus_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO arus_user;

-- Create indexes for performance (these will be created by Drizzle, but documented here)
-- Note: Actual table creation will be handled by Drizzle migrations

-- Performance optimization settings
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET track_activity_query_size = 2048;
ALTER SYSTEM SET pg_stat_statements.track = 'all';

-- Configure for ARUS workload
ALTER SYSTEM SET effective_cache_size = '256MB';
ALTER SYSTEM SET shared_buffers = '64MB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '16MB';

-- Logging configuration for debugging
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log slow queries (>1s)
ALTER SYSTEM SET log_statement = 'mod';  -- Log data modification statements

-- Reload configuration
SELECT pg_reload_conf();

-- Create a simple health check function
CREATE OR REPLACE FUNCTION health_check()
RETURNS TABLE(status text, version text, uptime interval) AS $$
BEGIN
    RETURN QUERY SELECT 
        'healthy'::text as status,
        version()::text as version,
        now() - pg_postmaster_start_time() as uptime;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on health check
GRANT EXECUTE ON FUNCTION health_check() TO arus_user;