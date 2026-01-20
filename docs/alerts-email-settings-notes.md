# Email & Alerts Settings Architecture Notes

## Existing Infrastructure Analysis

### 1. Email Sending Infrastructure

**Location:** `server/services/email-notification-service.ts`

**Current Capabilities:**
- SendGrid integration via API key from `SENDGRID_API_KEY` environment variable
- Email queue with retry logic (exponential backoff, max 3 retries)
- Digest mode support for batching notifications
- Development mode (logs only when no API key)
- Notification types: `compliance`, `alert`, `logbook`, `maintenance`

**Key Functions:**
- `sendComplianceNotification()` - Compliance findings
- `sendLogbookReminderNotification()` - Unsigned log reminders
- `sendAlertNotification()` - Equipment/telemetry alerts
- `processDigestQueue()` - Batch digest processing
- `retryFailedNotifications()` - Retry failed sends

### 2. Notification Settings Table

**Location:** `shared/schema.ts` (line ~8460)

**Schema: `notification_settings`**
- `id`, `orgId`, `vesselId` (nullable for org-wide)
- `notificationType` (compliance, alert, logbook, maintenance)
- `enabled`, `minSeverity`
- `recipientEmails`, `recipientRoles`, `recipientUserIds` (JSONB arrays)
- `deliveryMethod` (email, webhook, in_app)
- `digestMode`, `digestSchedule`
- Timestamps

### 3. Notification Queue Table

**Location:** `shared/schema.ts` (line ~8507)

**Schema: `notification_queue`**
- Queue for pending notifications with offline-first support
- Status tracking: pending, processing, sent, failed
- Retry count and error tracking
- Related entity tracking

### 4. Alert Domain

**Location:** `server/domains/alerts/`

**Components:**
- `service.ts` - Business logic, event publishing
- `repository.ts` - Data access
- `routes.ts` - HTTP endpoints

**Features:**
- Alert configurations (per equipment/sensor type)
- Alert notifications with WebSocket broadcast
- Alert suppressions for temporary silencing
- Alert comments
- Escalation to work orders
- MQTT publishing for reliable sync

### 5. Crew Management Tables

**Schema Location:** `shared/schema.ts`

**Existing Tables:**
- `crew` - Crew members with roles, ranks, vessel assignment
- `crew_cert` (crewCertification) - Certifications with expiry dates
- `crew_documents` - Passport, visa, medical, endorsements with expiry
- `crew_rest_sheet` - STCW Hours of Rest tracking per crew per month
- `crew_rest_day` - Daily rest hours data
- `crew_assignment` - Watch/shift assignments
- `crew_leave` - Leave periods

## What We Need to Add

### A. Alert Settings Enhancement (Email & Alerts Settings System)

**New Tables:**

1. **`alert_settings`** - Enhanced org-level configuration
   - Email transport config (provider, SMTP settings, API keys)
   - Global defaults (enabled, timezone, default recipients)
   - Test status tracking

2. **`alert_settings_vessel`** - Per-vessel overrides
   - Override recipients
   - Toggle critical/warning alerts
   - Vessel-specific thresholds

3. **`alert_thresholds`** - Configurable alert categories
   - Category (machinery, telemetry, compliance, crew)
   - Key (specific alert type)
   - Severity, threshold values
   - Enabled toggle

4. **`alert_email_log`** - Email audit trail
   - All sent emails with status
   - Recipients, subject, payload preview
   - Error tracking for failed sends

### B. Crew Alert System

**New Components:**

1. **Crew Alert Evaluators:**
   - Certificate expiry evaluator (30/60/90 day thresholds)
   - Hours-of-rest violation evaluator (MLC/STCW rules)
   - Missing signature evaluator
   - Manning shortage evaluator
   - Crew change reminder evaluator

2. **Crew Alert Settings:**
   - Extend `notification_settings` or create `crew_alert_settings`
   - Per-org and per-vessel toggles for each alert type
   - Configurable thresholds (days before expiry, etc.)
   - Cooldown/deduplication settings

3. **Email Templates:**
   - Certificate expiry template
   - Hours-of-rest violation template
   - Missing signature template
   - Manning shortage template
   - Crew change reminder template

## Integration Strategy

### Non-Conflicting Design Principles:

1. **Extend existing email service** - Add SMTP provider support alongside SendGrid
2. **Reuse notification settings pattern** - Same table structure for crew alerts
3. **Use alert domain patterns** - Follow service/repository/routes structure
4. **Respect multi-tenant isolation** - All queries scoped by orgId
5. **Support dual databases** - Schema compatible with PostgreSQL and SQLite

### API Endpoints to Add:

```
GET  /api/settings/alerts           - Get org-level alert/email config
PUT  /api/settings/alerts           - Update org-level config
GET  /api/settings/alerts/vessels   - Get per-vessel configs
PUT  /api/settings/alerts/vessels/:vesselId - Update vessel config
GET  /api/settings/alerts/thresholds - Get alert thresholds
PUT  /api/settings/alerts/thresholds - Bulk update thresholds
POST /api/settings/alerts/test-email - Send test email
GET  /api/settings/alerts/email-logs - Get email audit log

GET  /api/settings/crew-alerts      - Get crew alert settings
PUT  /api/settings/crew-alerts      - Update crew alert settings
POST /api/crew-alerts/evaluate      - Trigger crew alert evaluation
```

### Frontend Pages:

1. **Settings > Email & Alerts** (`/settings/alerts`)
   - Global Settings Panel
   - Per-Vessel Settings Panel
   - Alert Categories & Thresholds Panel
   - Email Logs Panel

2. **Settings > Crew Alerts** (`/settings/crew-alerts`)
   - Certificate Expiry Settings
   - Hours-of-Rest Violation Settings
   - Manning & Scheduling Settings
   - Recipients Configuration

## Security Considerations

1. **Secret Encryption:**
   - Use Node crypto for encrypting SMTP passwords and API keys
   - Store encrypted values in database
   - Decrypt only when sending emails
   - Never log plaintext secrets

2. **Tenant Isolation:**
   - All endpoints require orgId middleware
   - All queries scoped by orgId
   - No cross-org data access

3. **Rate Limiting:**
   - Test email endpoint rate limited
   - Cooldown mechanism for repeated alerts
   - Deduplication to prevent spam
