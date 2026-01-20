# Environment Variables Reference

## Critical Security Requirements

### ⚠️ REQUIRED FOR PRODUCTION

#### `SESSION_SECRET`

**Purpose**: Secures user sessions and prevents session hijacking

**Requirements**:

- Minimum 32 characters
- Must NOT be default values: 'dev-secret-key', 'development', 'change-me', 'insecure'
- Application will **FAIL TO START** in production without proper secret

**Generate**:

```bash
openssl rand -base64 48
```

**Example**:

```bash
SESSION_SECRET="7vX9mK2pL4nQ8rY3wZ6cB1dF5gH0jM9"
```

#### `DATABASE_URL` (Cloud Mode)

**Purpose**: PostgreSQL database connection string

**Format**:

```bash
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"
```

**Required**: When `LOCAL_MODE != true`  
**Application Behavior**: Will **FAIL TO START** if missing in cloud mode

---

## Environment Variable Categories

### 1. Deployment Mode

#### `NODE_ENV`

**Values**: `development` | `production`  
**Default**: `development`

**Impact**:

- **Production**: Strict validation, no default secrets, fail-fast on errors
- **Development**: Relaxed validation, warnings instead of errors

#### `LOCAL_MODE`

**Values**: `true` | `false`  
**Default**: `false`

**When `true`**:

- DATABASE_URL becomes optional
- Uses local SQLite database
- Enables Turso cloud sync (if configured)
- Designed for vessel/offline deployments

### 2. Database Configuration

#### Cloud Mode (Default)

```bash
DATABASE_URL="postgresql://user:pass@host:port/db?sslmode=require"
```

#### Local/Vessel Mode

```bash
LOCAL_MODE="true"
TURSO_SYNC_URL="libsql://your-database.turso.io"  # Optional
TURSO_AUTH_TOKEN="your-token"                      # Optional
```

### 3. Security

#### `SESSION_SECRET` (REQUIRED for production)

- **Validation**: Minimum 32 characters, no default values
- **Failure Mode**: Application exits on startup if invalid

#### `ADMIN_TOKEN` (Optional)

- Enables admin mode access
- Should be strong and unique
- Not validated at startup (feature-specific)

### 4. AI & External Services

#### `OPENAI_API_KEY` (Optional)

**Purpose**: Enables AI-powered features

- LLM report generation
- Anomaly detection
- Predictive insights

**Without it**: AI features gracefully disabled

#### `OPENWEATHER_API_KEY` (Optional)

**Purpose**: Weather-aware predictions

- Context-aware alert adjustments
- Environmental factor analysis

### 5. Replit Platform (Auto-configured)

These are automatically set in Replit environment:

```bash
REPL_ID="..."
REPL_SLUG="..."
REPLIT_DB_URL="..."
```

**Purpose**: Enable Replit-specific features (object storage, deployment)

---

## Validation Behavior

### Startup Validation Flow

1. **Environment Detection**

   ```
   Check: NODE_ENV, LOCAL_MODE, REPL_ID
   Output: Deployment mode (cloud/local/replit, dev/prod)
   ```

2. **Critical Variable Validation**

   ```
   - If CLOUD MODE + !DATABASE_URL → FAIL
   - If PRODUCTION + !SESSION_SECRET → FAIL
   - If SESSION_SECRET is weak → FAIL
   ```

3. **Optional Variable Check**

   ```
   - Check OPENAI_API_KEY → Warn if missing
   - Check TURSO_* in LOCAL_MODE → Warn if missing
   ```

4. **Startup Decision**
   ```
   - If ANY critical errors → EXIT(1)
   - If warnings only → START with logged warnings
   ```

### Error Messages

**Missing SESSION_SECRET (Production)**:

```
❌ CRITICAL CONFIGURATION ERRORS:
  - SESSION_SECRET not set (REQUIRED for production)

🛑 Application cannot start with invalid configuration.
Please set the required environment variables and try again.
```

**Weak SESSION_SECRET**:

```
❌ CRITICAL CONFIGURATION ERRORS:
  - SESSION_SECRET is set to a known default value - SECURITY RISK!

🛑 Application cannot start with invalid configuration.
```

**Missing DATABASE_URL (Cloud Mode)**:

```
❌ CRITICAL CONFIGURATION ERRORS:
  - DATABASE_URL not set (REQUIRED for cloud mode)

🛑 Application cannot start with invalid configuration.
```

---

## Environment-Specific Configurations

### Development (Local)

```bash
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/arus_dev
# SESSION_SECRET can be omitted (uses insecure default with warning)
OPENAI_API_KEY=sk-...  # Optional
```

**Behavior**: Warnings logged, application starts

### Staging

```bash
NODE_ENV=production
DATABASE_URL=postgresql://...staging-db
SESSION_SECRET="$(openssl rand -base64 48)"
OPENAI_API_KEY=sk-...
```

**Behavior**: Production validation, fail-fast on errors

### Production

```bash
NODE_ENV=production
DATABASE_URL=postgresql://...production-db?sslmode=require
SESSION_SECRET="$(openssl rand -base64 48)"
OPENAI_API_KEY=sk-...
OPENWEATHER_API_KEY=...
```

**Behavior**: Strict validation, maximum security

### Vessel Deployment (Offline-First)

```bash
NODE_ENV=production
LOCAL_MODE=true
SESSION_SECRET="$(openssl rand -base64 48)"
# DATABASE_URL not required
TURSO_SYNC_URL="libsql://arus-vessel.turso.io"
TURSO_AUTH_TOKEN="..."
```

**Behavior**: Local SQLite + optional cloud sync

---

## Security Best Practices

### ✅ DO

- Generate SESSION_SECRET with cryptographically secure random generator
- Use different secrets for dev/staging/production
- Store secrets in deployment platform (Replit Secrets, AWS Secrets Manager, etc.)
- Rotate SESSION_SECRET periodically (invalidates all sessions)
- Use SSL/TLS for DATABASE_URL (`sslmode=require`)

### ❌ DON'T

- Commit `.env` files to version control
- Use predictable or short SESSION_SECRET
- Share production secrets across environments
- Use default/example secrets in production
- Store secrets in code or config files

---

## Testing Environment Validation

```bash
# Test production validation (should fail without secrets)
NODE_ENV=production npm start
# Expected: Exit with error about missing SESSION_SECRET

# Test with weak secret (should fail)
NODE_ENV=production SESSION_SECRET="dev-secret-key" npm start
# Expected: Exit with error about default value

# Test with valid config (should start)
NODE_ENV=production \
SESSION_SECRET="$(openssl rand -base64 48)" \
DATABASE_URL="postgresql://localhost:5432/test" \
npm start
# Expected: Application starts successfully
```

---

## Troubleshooting

### "SESSION_SECRET is too short"

**Problem**: SESSION_SECRET has fewer than 32 characters  
**Fix**: Generate new secret with `openssl rand -base64 48`

### "SESSION_SECRET is set to a known default value"

**Problem**: Using insecure default like 'dev-secret-key'  
**Fix**: Generate unique secret and update environment

### "DATABASE_URL not set (REQUIRED for cloud mode)"

**Problem**: DATABASE_URL missing and not in local mode  
**Fix**: Either set DATABASE_URL or enable LOCAL_MODE=true

### "Application starts but warnings appear"

**Problem**: Optional variables missing (development only)  
**Action**: Review warnings, add missing variables if features needed

---

## Environment Variable Checklist

### Pre-Production Deployment

- [ ] `SESSION_SECRET` set to 32+ character random string
- [ ] `SESSION_SECRET` is NOT a default value
- [ ] `DATABASE_URL` configured with SSL enabled
- [ ] `NODE_ENV=production` set
- [ ] `OPENAI_API_KEY` set (if AI features needed)
- [ ] `OPENWEATHER_API_KEY` set (if weather features needed)
- [ ] No secrets committed to repository
- [ ] Secrets stored in secure deployment platform
- [ ] Different secrets for staging vs production

### Post-Deployment Verification

- [ ] Application starts without errors
- [ ] No security warnings in startup logs
- [ ] Database connection successful
- [ ] AI features working (if configured)
- [ ] Multi-tenant isolation enforced (check logs for security events)

---

**Last Updated**: 2025-10-27  
**Maintained By**: Platform Engineering Team
