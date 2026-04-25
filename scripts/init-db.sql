-- ARUS (Marine Predictive Maintenance & Scheduling) Database Initialization
-- Initializes a local PostgreSQL database for development/Replit/Docker.
-- Table creation is still handled by Drizzle migrations.

\c arus;

-- Create the application role if it does not already exist.
-- docker-compose starts Postgres as the postgres superuser; this role is used by
-- app DATABASE_URLs such as postgresql://arus_user:arus_secure_password@...
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arus_user') THEN
    CREATE ROLE arus_user LOGIN PASSWORD 'arus_secure_password';
  END IF;
END
$$;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Single-tenant default context for optional RLS policies.
-- This avoids failing all RLS-protected queries before app middleware has set a
-- context while preserving the canonical single-tenant org ID.
ALTER DATABASE arus SET app.current_org_id = 'default-org-id';

-- Grant schema permissions
GRANT CONNECT ON DATABASE arus TO arus_user;
GRANT USAGE, CREATE ON SCHEMA public TO arus_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO arus_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO arus_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO arus_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO arus_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO arus_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO arus_user;

-- Performance optimization settings. Some ALTER SYSTEM changes require a DB
-- restart to take full effect; the script remains idempotent.
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET track_activity_query_size = 2048;
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET effective_cache_size = '256MB';
ALTER SYSTEM SET shared_buffers = '64MB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '16MB';
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET log_statement = 'mod';
SELECT pg_reload_conf();

-- Health check function
CREATE OR REPLACE FUNCTION health_check()
RETURNS TABLE(status text, version text, uptime interval) AS $$
BEGIN
    RETURN QUERY SELECT
        'healthy'::text as status,
        version()::text as version,
        now() - pg_postmaster_start_time() as uptime;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION health_check() TO arus_user;
