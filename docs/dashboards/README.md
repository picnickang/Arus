# ARUS Grafana Dashboards

This directory contains Grafana dashboard definitions for monitoring the ARUS platform.

## Available Dashboards

### 1. grafana-arus-overview.json

**Purpose**: Overall platform health and performance monitoring

**Key Metrics**:

- API request rate and error rate
- HTTP latency (p50, p95, p99)
- Memory usage and event loop lag
- Background job queue depth
- Top 10 slowest endpoints
- Database connections
- Active alerts

**Refresh**: 30 seconds  
**Time Range**: Last 6 hours (configurable)

**Use Cases**:

- Daily operational monitoring
- Incident detection and triage
- Performance regression identification
- Capacity planning

---

### 2. grafana-ml-performance.json

**Purpose**: ML model performance and governance monitoring

**Key Metrics**:

- Prediction rate and count
- ML inference latency by model (LSTM, XGBoost, Random Forest)
- Model accuracy scores
- Circuit breaker trips
- Model cache hit rate
- Model drift detection
- Feature engineering duration
- Training events
- Provenance chain integrity
- Lineage record count

**Refresh**: 1 minute  
**Time Range**: Last 6 hours (configurable)

**Use Cases**:

- ML model performance monitoring
- Governance compliance verification
- Model drift detection
- Training pipeline monitoring

---

## Installation

### Prerequisites

- Grafana 9.0+ installed
- Prometheus data source configured
- ARUS `/api/metrics` endpoint accessible

### Import Dashboards

#### Option 1: Grafana UI

1. Open Grafana
2. Navigate to Dashboards → Import
3. Upload the JSON file or paste the content
4. Select your Prometheus data source
5. Click "Import"

#### Option 2: Provisioning

Add to your Grafana provisioning configuration:

```yaml
# /etc/grafana/provisioning/dashboards/arus.yaml
apiVersion: 1

providers:
  - name: "ARUS Dashboards"
    orgId: 1
    folder: "ARUS"
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /path/to/docs/dashboards
```

#### Option 3: API

```bash
# Import overview dashboard
curl -X POST http://localhost:3000/api/dashboards/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d @grafana-arus-overview.json

# Import ML dashboard
curl -X POST http://localhost:3000/api/dashboards/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d @grafana-ml-performance.json
```

---

## Prometheus Configuration

### Required Metrics

The dashboards expect the following Prometheus metrics from `/api/metrics`:

#### Standard HTTP Metrics

- `http_requests_total` - Total HTTP requests (labels: status, route, method)
- `http_request_duration_seconds_bucket` - Request duration histogram

#### Node.js Metrics

- `nodejs_heap_size_total_bytes` - Total heap size
- `nodejs_heap_size_used_bytes` - Used heap size
- `nodejs_eventloop_lag_seconds` - Event loop lag
- `nodejs_active_handles_total` - Active handles
- `process_resident_memory_bytes` - RSS memory

#### ML Custom Metrics

- `ml_predictions_total` - Total predictions (label: model)
- `ml_inference_duration_seconds_bucket` - Inference latency histogram
- `ml_model_accuracy_score` - Model accuracy
- `ml_circuit_breaker_trips_total` - Circuit breaker trips
- `ml_model_cache_size` - Models in cache
- `ml_model_cache_hits_total` - Cache hits
- `ml_model_cache_misses_total` - Cache misses
- `ml_model_training_total` - Training events
- `ml_model_drift_score` - Drift detection score
- `ml_feature_engineering_duration_seconds_bucket` - Feature eng latency
- `ml_provenance_chain_verified` - Chain integrity (1=verified, 0=failed)
- `ml_model_lineage_records_total` - Lineage records count

#### Background Job Metrics

- `background_job_queue_depth` - Job queue depth

#### Security & Tenant Isolation Metrics

- `arus_tenant_isolation_denied_total` - Cross-tenant access attempts blocked (labels: org_requested, user_org)
- `arus_auth_failure_total` - Authentication failures (labels: reason - missing_org_id, invalid_org_id_format, unauthenticated)
- `arus_cross_org_access_blocked_total` - Cross-organization access attempts blocked
- `arus_suspicious_orgid_rejected_total` - Suspicious org ID patterns rejected (blank/invalid format, SQL injection)
- `arus_forbidden_orgid_blocked_total` - Forbidden org IDs blocked (default-org-id, test-org-id, etc.)

### Prometheus Scrape Config

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: "arus"
    scrape_interval: 15s
    static_configs:
      - targets: ["localhost:5000"]
    metrics_path: "/api/metrics"
```

---

## Alert Rules (Optional)

Create alert rules for critical conditions:

```yaml
# /etc/prometheus/rules/arus_alerts.yml
groups:
  - name: arus_api
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API error rate (> 5%)"

      - alert: HighLatency
        expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 1.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API latency (p95 > 1.5s)"

      - alert: EventLoopLag
        expr: nodejs_eventloop_lag_seconds > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High event loop lag (> 100ms)"

  - name: arus_ml
    interval: 30s
    rules:
      - alert: MLCircuitBreakerTrips
        expr: increase(ml_circuit_breaker_trips_total[1h]) > 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "ML circuit breaker tripping frequently"

      - alert: MLModelDrift
        expr: ml_model_drift_score > 0.2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "ML model drift detected (> 20%)"

      - alert: LowModelAccuracy
        expr: ml_model_accuracy_score < 0.7
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "ML model accuracy below 70%"

  - name: arus_security
    interval: 30s
    rules:
      - alert: TenantIsolationViolationAttempt
        expr: increase(arus_tenant_isolation_denied_total[5m]) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Tenant isolation violation attempt detected"
          description: "Cross-tenant access attempt blocked. Review security logs immediately."

      - alert: HighUnauthenticatedAccessRate
        expr: rate(arus_auth_failure_total{reason=~"missing_org_id|unauthenticated"}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High rate of unauthenticated access attempts"
          description: "Authentication failures for missing org ID or unauthenticated requests"

      - alert: SuspiciousInputPatterns
        expr: increase(arus_forbidden_orgid_blocked_total[5m]) > 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Forbidden org ID patterns detected"
          description: "Hard-coded or test org IDs are being used in requests"

      - alert: CrossOrgAccessBlocked
        expr: increase(arus_cross_org_access_blocked_total[10m]) > 5
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Multiple cross-organization access attempts blocked"
          description: "{{ $value }} cross-org access attempts blocked in 10 minutes"

      - alert: SuspiciousOrgIdPattern
        expr: increase(arus_suspicious_orgid_rejected_total[5m]) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Suspicious org ID patterns detected (possible injection attack)"
```

---

## Customization

### Add Custom Panels

Both dashboards support customization:

1. Edit the JSON file
2. Add new panels to the `panels` array
3. Update panel IDs sequentially
4. Re-import to Grafana

### Variables

**Overview Dashboard**:

- `datasource` - Prometheus data source selector

**ML Dashboard**:

- `datasource` - Prometheus data source selector
- `model` - Filter by specific ML model (All, LSTM, XGBoost, Random Forest)

### Time Ranges

Default: Last 6 hours  
Customize in JSON: `"time": {"from": "now-24h", "to": "now"}`

### Refresh Rates

- Overview: 30 seconds
- ML Performance: 1 minute

Customize in JSON: `"refresh": "30s"`

---

## Troubleshooting

### No Data Showing

1. **Verify Prometheus is scraping**:

   ```bash
   curl http://localhost:9090/api/v1/targets
   # Check if ARUS target is "UP"
   ```

2. **Test metrics endpoint**:

   ```bash
   curl http://localhost:5000/api/metrics
   # Should return Prometheus format
   ```

3. **Check Grafana data source**:
   - Settings → Data Sources → Prometheus
   - Click "Save & Test"

### Missing Metrics

Some metrics only appear after certain events:

- `ml_predictions_total` - After first ML prediction
- `ml_model_training_total` - After first training run
- `ml_provenance_chain_verified` - After running verification script

### High Memory Usage in Grafana

Reduce time range or increase refresh interval:

```json
"time": {"from": "now-1h", "to": "now"},
"refresh": "1m"
```

---

## Related Documentation

- [Phase 1 Audit Report](../audit/PHASE1_AUDIT_REPORT_EVIDENCE_BASED.md)
- [Performance Benchmarking](../../server/scripts/perf-harness.ts)
- [Prometheus Metrics Endpoint](../../server/observability.ts)

---

**Created**: November 4, 2025  
**Last Updated**: November 27, 2025  
**Maintainer**: DevOps Team

## Changelog

### November 27, 2025

- Added `arus_security` alert group with tenant isolation monitoring
- Added security metrics documentation (auth failures, cross-org access, injection detection)
- New alerts: TenantIsolationViolationAttempt, HighUnauthenticatedAccessRate, CrossOrgAccessBlocked, SuspiciousOrgIdPattern
