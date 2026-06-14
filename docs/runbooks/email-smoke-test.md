# Runbook: Email System Smoke Test (dev-mode)

Manually exercise the email subsystem end-to-end without sending any real mail.
All steps run against a local dev server with the SendGrid sender in **dev-mode**
(no `SENDGRID_API_KEY` → logs only, no network) and no per-org provider
configured. Use this to confirm the endpoints are wired, requests validate, and
the queue transitions correctly after a change.

## Background: two email stacks

- **Stack A — multi-provider** (`server/services/email-provider-service.ts`):
  SendGrid/SMTP/SES, configured per-org in the `alert_settings` table. Drives the
  alert-settings test endpoints and purchasing→supplier mail (`email_queue` +
  the 30s worker).
- **Stack B — notification queue** (`server/services/email-notification/*`):
  SendGrid-only, configured by env (`SENDGRID_API_KEY` / `EMAIL_FROM`). Drives
  compliance/logbook/alert/crew notifications via the `notification_queue` table.

`notification_queue` and `email_queue` are **cloud-only** tables, so the queue
steps below are meaningful only when the dev server runs in CLOUD mode (with
`DATABASE_URL` set). In pure SQLite/VESSEL dev, rely on the dev-mode log line
instead of the DB row.

## 1. Boot the server in dev-mode

```bash
# dev-login ON so requests authenticate; no SENDGRID_API_KEY so Stack B is in
# dev-mode (logs only). Keep the purchasing worker off so it doesn't expire rows.
ARUS_DEV_LOGIN=1 DISABLE_EMAIL_WORKER=true npm run dev
```

Reusable headers (single-tenant requires `x-org-id: default-org-id` exactly — any
other value returns 403):

```bash
BASE=http://localhost:5000
H=(-H "Content-Type: application/json" -H "x-org-id: default-org-id" \
   -H "x-user-role: admin" -H "x-user-id: smoke-user")
```

## 2. Status — expect development mode

```bash
curl -s "${H[@]}" $BASE/api/notifications/email/status
# => {"enabled":false,"provider":"development"}
```

## 3. Stack B test send (covers the Fix #1 regression)

```bash
curl -s "${H[@]}" -X POST $BASE/api/notifications/email/test \
  -d '{"email":"smoke@example.test","subject":"Smoke","message":"hello"}'
# => {"success":true,"queued":true,"emailEnabled":false,
#     "message":"Test notification queued and processed (email not configured - check logs)"}
```

In the server console, confirm the dev-mode line (proves the row was _processed_,
not just queued — the bug was that it was never attempted):

```
[EmailNotification] DEV MODE - Would send email recipients=1 subject=Smoke
```

Validation guard (no DB needed):

```bash
curl -s -o /dev/null -w "%{http_code}\n" "${H[@]}" \
  -X POST $BASE/api/notifications/email/test -d '{"subject":"no email"}'
# => 400
```

## 4. Verify the queue row reached "sent" (CLOUD mode only)

```bash
curl -s "${H[@]}" "$BASE/api/notifications/queue?notificationType=test"
# Expect a row for smoke@example.test with "status":"sent".
# Pre-fix it stayed "pending" forever.
```

Or directly:

```bash
psql "$DATABASE_URL" -c \
  "select notification_type, status, sent_at from notification_queue order by created_at desc limit 5;"
```

## 5. Digest processing (the path the scheduler runs)

```bash
curl -s "${H[@]}" -X POST $BASE/api/notifications/email/process-digest
# => {"success":true,"processedCount":0}   (0 when nothing is due)
```

The scheduler (`setupEmailDigestSchedule` in `server/bootstrap/schedulers.ts`)
runs this automatically every `EMAIL_DIGEST_INTERVAL_MS` (default 15 min) in
CLOUD mode, unless `DISABLE_EMAIL_WORKER` or `DISABLE_EMAIL_DIGEST_SCHEDULER` is
set. To watch it fire quickly, restart dev with `EMAIL_DIGEST_INTERVAL_MS=5000`
and (no `DISABLE_EMAIL_WORKER`).

## 6. Stack A (multi-provider) endpoints

With no `alert_settings` row for the org, both report "not configured":

```bash
curl -s "${H[@]}" -X POST $BASE/api/alert-settings/test-connection
curl -s "${H[@]}" -X POST $BASE/api/alert-settings/send-test -d '{"email":"smoke@example.test"}'
# => {"success":false,"error":"Email settings not configured"}
```

Audit log of Stack A sends:

```bash
curl -s "${H[@]}" "$BASE/api/alert-settings/email-logs?limit=20"
```

## Where to look

| Table                | Stack | What it holds                                                                                 |
| -------------------- | ----- | --------------------------------------------------------------------------------------------- |
| `notification_queue` | B     | compliance/logbook/alert/crew rows; `status` pending→sent/failed; `scheduled_for` for digests |
| `email_queue`        | A     | purchasing→supplier mail; drained by the 30s worker                                           |
| `alert_email_log`    | A     | audit trail of alert-settings sends (written even on failure)                                 |

## Automated coverage

- Unit: `tests/unit/email-*.test.ts` (transports, queue state machine, service
  orchestration incl. the Fix #1 `sendTestNotification` pending→sent regression,
  and the digest scheduler).
- Integration: `tests/integration/email-notifications-api.test.ts` (server lane;
  status + validation contract).

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/email-*.test.ts --forceExit
npm run test:integration:server
```
