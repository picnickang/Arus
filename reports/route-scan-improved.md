# Improved Route Scan Report

**Generated:** 2025-11-07T07:10:02.627Z

## Summary

- **Total Routes:** 660
- **With Authentication:** 1 (0.2%)
- **With Org Scoping:** 80 (12.1%)
- **With Validation:** 3 (0.5%)
- **With Rate Limiting:** 317 (48.0%)
- **With Inherited Middleware:** 1 (0.2%)

### By HTTP Method

- GET: 307
- POST: 222
- DELETE: 66
- PUT: 50
- PATCH: 15

### Security Coverage

🚨 **Low authentication coverage** (0.2%) - Review public endpoints

⚠️ **Review multi-tenant isolation** (12.1%) - Many routes may be public

## Critical Security Findings

### Unprotected Write Operations

Found 347 write operations (POST/PUT/PATCH/DELETE) without authentication:

- POST /api/sync/reconcile (routes.ts:931)
- POST /api/sync/process-events (routes.ts:980)
- POST /api/sync/reconcile/comprehensive (routes.ts:1041)
- POST /api/sync/check-conflicts (routes.ts:1072)
- POST /api/sync/resolve-conflict (routes.ts:1157)
- POST /api/sync/auto-resolve (routes.ts:1192)
- POST /api/edge/heartbeat (routes.ts:1451)
- POST /api/pdm/scores (routes.ts:1497)
- POST /api/pdm/baseline/update (routes.ts:1529)
- POST /api/pdm/analyze/bearing (routes.ts:1566)
- ... and 337 more

## Route Details

| Method | Path | Auth | Org | Validation | Rate Limit | Inherited | File |
|--------|------|------|-----|------------|------------|-----------|------|
| POST | /api/acoustic/analyze | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:10961 |
| POST | /api/acoustic/features | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:10984 |
| GET | /api/admin/audit | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:16894 |
| POST | /api/admin/audit | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:16909 |
| GET | /api/admin/audit/resource/:resourceType/:resourceId | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:16935 |
| GET | /api/admin/audit/user/:userId | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:16923 |
| POST | /api/admin/auth/change-password | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:16820 |
| POST | /api/admin/auth/verify | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:16741 |
| GET | /api/admin/backups | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17743 |
| POST | /api/admin/calibrate-threshold | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17025 |
| GET | /api/admin/config | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17452 |
| GET | /api/admin/config-audit | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17836 |
| GET | /api/admin/config/:key | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17477 |
| PUT | /api/admin/config/:key | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17505 |
| DELETE | /api/admin/config/:key | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:17544 |
| GET | /api/admin/config/audit | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17577 |
| POST | /api/admin/config/reload | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17413 |
| GET | /api/admin/database/health | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:15625 |
| POST | /api/admin/database/retention/apply | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:15736 |
| GET | /api/admin/database/retention/policy | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:15690 |
| POST | /api/admin/database/retention/policy | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:15709 |
| POST | /api/admin/database/timescale/compression | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:15677 |
| POST | /api/admin/database/timescale/continuous-aggregate | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:15664 |
| POST | /api/admin/database/timescale/enable | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:15638 |
| POST | /api/admin/database/timescale/hypertable | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:15651 |
| POST | /api/admin/factory-reset | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:15539 |
| GET | /api/admin/health-checks | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17855 |
| POST | /api/admin/health-checks | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17881 |
| GET | /api/admin/health-checks/:id | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17866 |
| PUT | /api/admin/health-checks/:id | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17895 |
| DELETE | /api/admin/health-checks/:id | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:17910 |
| PATCH | /api/admin/health-checks/:id/status | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17921 |
| GET | /api/admin/health-checks/failing | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17933 |
| GET | /api/admin/integrations | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17196 |
| POST | /api/admin/integrations | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17222 |
| GET | /api/admin/integrations/:id | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17207 |
| PUT | /api/admin/integrations/:id | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17236 |
| DELETE | /api/admin/integrations/:id | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:17251 |
| PATCH | /api/admin/integrations/:id/health | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17262 |
| GET | /api/admin/maintenance-windows | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17275 |
| POST | /api/admin/maintenance-windows | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17301 |
| GET | /api/admin/maintenance-windows/:id | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17286 |
| PUT | /api/admin/maintenance-windows/:id | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17315 |
| DELETE | /api/admin/maintenance-windows/:id | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:17330 |
| GET | /api/admin/maintenance-windows/active | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17341 |
| GET | /api/admin/patches | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17636 |
| POST | /api/admin/patches/:id/apply | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:17688 |
| POST | /api/admin/patches/:id/download | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17667 |
| GET | /api/admin/patches/history | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17651 |
| POST | /api/admin/patches/preview | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17792 |
| POST | /api/admin/patches/publish | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:17811 |
| POST | /api/admin/patches/rollback/:backupId | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:17721 |
| GET | /api/admin/performance-metrics | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17353 |
| POST | /api/admin/performance-metrics | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17368 |
| GET | /api/admin/performance-metrics/:orgId/:category/latest | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17382 |
| GET | /api/admin/performance-metrics/:orgId/:metricName/trends | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17393 |
| GET | /api/admin/settings | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:16948 |
| POST | /api/admin/settings | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:16973 |
| PUT | /api/admin/settings/:id | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:16987 |
| DELETE | /api/admin/settings/:id | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:17002 |
| GET | /api/admin/settings/:orgId/:category | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17013 |
| GET | /api/admin/settings/:orgId/:category/:key | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:16959 |
| POST | /api/admin/simulate-telemetry | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17119 |
| GET | /api/admin/system-health | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17945 |
| GET | /api/admin/update-settings | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17755 |
| PUT | /api/admin/update-settings | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17770 |
| POST | /api/admin/updates/check | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17603 |
| GET | /api/admin/vessel-types | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:17179 |
| DELETE | /api/alerts/all | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:7755 |
| DELETE | /api/alerts/all | ✗ | ✗ | ✗ | ✗ | ✗ | domains/alerts/routes.ts:324 |
| GET | /api/alerts/configurations | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:7486 |
| POST | /api/alerts/configurations | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:7496 |
| GET | /api/alerts/configurations | ✗ | ✗ | ✗ | ✓ | ✗ | domains/alerts/routes.ts:29 |
| POST | /api/alerts/configurations | ✗ | ✗ | ✗ | ✓ | ✗ | domains/alerts/routes.ts:41 |
| PUT | /api/alerts/configurations/:id | ✗ | ✗ | ✗ | ✓ | ✗ | routes.ts:7515 |
| DELETE | /api/alerts/configurations/:id | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:7528 |
| PUT | /api/alerts/configurations/:id | ✗ | ✗ | ✗ | ✓ | ✗ | domains/alerts/routes.ts:68 |
| DELETE | /api/alerts/configurations/:id | ✗ | ✗ | ✗ | ✗ | ✗ | domains/alerts/routes.ts:93 |
| GET | /api/alerts/notifications | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:7538 |
| POST | /api/alerts/notifications | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:7591 |
| GET | /api/alerts/notifications | ✗ | ✗ | ✗ | ✓ | ✗ | domains/alerts/routes.ts:109 |
| POST | /api/alerts/notifications | ✗ | ✗ | ✗ | ✓ | ✗ | domains/alerts/routes.ts:122 |
| PATCH | /api/alerts/notifications/:id/acknowledge | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:7616 |
| PATCH | /api/alerts/notifications/:id/acknowledge | ✗ | ✗ | ✗ | ✓ | ✗ | domains/alerts/routes.ts:147 |
| POST | /api/alerts/notifications/:id/comment | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:7641 |
| POST | /api/alerts/notifications/:id/comment | ✗ | ✗ | ✗ | ✓ | ✗ | domains/alerts/routes.ts:174 |
| GET | /api/alerts/notifications/:id/comments | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:7660 |
| GET | /api/alerts/notifications/:id/comments | ✗ | ✗ | ✗ | ✓ | ✗ | domains/alerts/routes.ts:200 |
| POST | /api/alerts/notifications/:id/escalate | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:7710 |
| POST | /api/alerts/notifications/:id/escalate | ✗ | ✗ | ✗ | ✓ | ✗ | domains/alerts/routes.ts:271 |
| POST | /api/alerts/suppress | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:7670 |
| POST | /api/alerts/suppress | ✗ | ✗ | ✗ | ✓ | ✗ | domains/alerts/routes.ts:216 |
| GET | /api/alerts/suppressions | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:7690 |
| GET | /api/alerts/suppressions | ✗ | ✗ | ✗ | ✓ | ✗ | domains/alerts/routes.ts:241 |
| DELETE | /api/alerts/suppressions/:id | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:7700 |
| DELETE | /api/alerts/suppressions/:id | ✗ | ✗ | ✗ | ✗ | ✗ | domains/alerts/routes.ts:255 |
| GET | /api/analytics/advanced-cost-trends | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:9907 |
| GET | /api/analytics/anomalies | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:9253 |
| GET | /api/analytics/anomalies | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:9868 |
| GET | /api/analytics/anomaly-detections | ✗ | ✗ | ✗ | ✗ | ✗ | routes.ts:3819 |

*Showing first 100 of 660 routes. See JSON for complete list.*
