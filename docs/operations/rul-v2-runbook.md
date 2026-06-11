# RUL Engine v2.0 Production Runbook

**Version:** 2.0  
**Last Updated:** November 4, 2025  
**Owner:** ARUS Platform Engineering

---

## Executive Summary

RUL (Remaining Useful Life) Engine v2.0 introduces four major enhancements to achieve 10-15% better prediction accuracy and reduce false alarms by 20%:

1. **Mode-Aware Predictions**: Operating mode detection with context-specific thresholds
2. **Data Quality Scoring**: 4-factor quality assessment with confidence adjustment
3. **Repair Censoring**: Right-censoring degradation data by last successful repair
4. **Calibrated Probabilities**: Isotonic calibration toward equipment-type base failure rates

All enhancements are protected by feature flags for safe production rollback.

---

## Feature Flags

### Environment Variables

Add these to your `.env` file to control v2.0 features:

```bash
# Mode-Aware Predictions (default: true)
RUL_MODE_AWARE=true

# Data Quality Scoring (default: true)
RUL_QUALITY_SCORING=true

# Repair Censoring (default: true)
RUL_REPAIR_CENSORING=true

# Probability Calibration (default: true)
RUL_CALIBRATION=true

# Dashboard Cache TTL in milliseconds (default: 60000 = 60 seconds)
DASHBOARD_TTL_MS=60000
```

### Toggling Features

**To disable a feature:**

1. Set environment variable to `false` in `.env`
2. Restart application: `npm run dev` or restart production workflow
3. Verify in logs: Look for `[RUL v2.0 Feature Flags]` log entry
4. Monitor metrics: Specific feature metrics will stop incrementing

**To re-enable a feature:**

1. Set environment variable to `true` in `.env`
2. Restart application
3. Verify feature is active via logs and metrics

### Feature Dependencies

- **RUL_QUALITY_SCORING**: Affects confidence scores; safe to disable independently
- **RUL_MODE_AWARE**: Affects threshold multipliers; safe to disable independently
- **RUL_REPAIR_CENSORING**: Affects historical data filtering; safe to disable independently
- **RUL_CALIBRATION**: Affects failure probability; safe to disable independently

**No dependencies between features** - each can be toggled independently without breaking others.

---

## Rollback Procedures

### Full Rollback to v1.0 Behavior

If v2.0 shows unexpected behavior, disable all enhancements:

```bash
# In .env file
RUL_MODE_AWARE=false
RUL_QUALITY_SCORING=false
RUL_REPAIR_CENSORING=false
RUL_CALIBRATION=false
```

**Expected behavior after rollback:**

- RUL predictions revert to v1.0 logic (simple degradation slope calculation)
- Confidence scores remain at 0.85 (no quality adjustment)
- No mode-aware threshold adjustments
- No repair censoring applied
- No probability calibration

**Verification:**

```bash
# Check metrics endpoint - v2.0 metrics should stop incrementing
curl http://localhost:5000/api/metrics | grep rul_

# Check logs for fallback behavior
grep "RUL v2.0 Feature Flags" /tmp/logs/Start_application_*.log
```

### Partial Rollback (Individual Features)

**Scenario: Mode detection causing issues**

```bash
RUL_MODE_AWARE=false  # Disable only mode-aware predictions
# Keep other features enabled
```

**Scenario: Calibration too aggressive**

```bash
RUL_CALIBRATION=false  # Disable probability calibration
# Keep quality scoring, mode awareness, repair censoring
```

**Scenario: Data quality scoring too strict**

```bash
RUL_QUALITY_SCORING=false  # Disable quality-based confidence adjustment
# Keep mode awareness, repair censoring, calibration
```

---

## Migration Guide

### Database Schema Changes

RUL v2.0 adds three new columns to `failure_history` table:

```sql
ALTER TABLE failure_history
ADD COLUMN status TEXT,  -- 'open', 'in_progress', 'resolved', 'verified'
ADD COLUMN resolved_at TIMESTAMP,  -- When failure was fixed
ADD COLUMN repair_type TEXT;  -- 'preventive', 'corrective', 'emergency'
```

**Migration Steps:**

1. **Backup database** (CRITICAL - do not skip):

   ```bash
   pg_dump $DATABASE_URL > rul_v2_backup_$(date +%Y%m%d).sql
   ```

2. **Push schema changes**:

   ```bash
   npm run db:push
   # If data-loss warning appears, review carefully before using --force
   ```

3. **Verify schema**:

   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'failure_history'
   AND column_name IN ('status', 'resolved_at', 'repair_type');
   ```

4. **Populate historical data** (optional):
   ```sql
   -- Mark all historical failures as 'resolved' if repaired
   UPDATE failure_history
   SET status = 'resolved',
       resolved_at = occurred_at + INTERVAL '7 days',  -- Estimate
       repair_type = 'corrective'
   WHERE status IS NULL AND occurred_at < NOW() - INTERVAL '30 days';
   ```

### Backward Compatibility

**Application handles missing schema gracefully:**

- If schema not pushed, RUL engine uses fallback values
- `status` defaults to `'open'`
- `resolved_at` defaults to `null`
- `repair_type` defaults to `null`
- No errors or crashes

**Safe deployment order:**

1. Deploy code first (with fallback logic)
2. Push schema changes second
3. Populate historical data third

---

## Performance Optimization

### Caching Strategy

**Dashboard Cache:**

- **TTL**: 60 seconds (configurable via `DASHBOARD_TTL_MS`)
- **Impact**: 98% latency reduction (826ms → 18ms)
- **Cache Key**: `dashboard-aggregation`
- **Trade-off**: Dashboard data may be up to 60 seconds stale

**Base Failure Rate Cache:**

- **TTL**: 30 minutes
- **Impact**: Reduces DB queries by 90%+
- **Cache Key**: `base-failure-rate-${equipmentType}-${orgId}`
- **Trade-off**: New equipment types take 30min to see accurate base rates

### Performance Benchmarks

**Expected Latencies (p95):**

| Operation             | v1.0 (ms) | v2.0 (ms) | Change               |
| --------------------- | --------- | --------- | -------------------- |
| Single RUL prediction | 150       | 180       | +20% (4 new queries) |
| Dashboard aggregation | 826       | 18        | -98% (caching)       |
| Batched query fetch   | N/A       | 50        | New (Phase 3)        |

**Query Optimization:**

- **Before Phase 3**: 4 sequential DB queries (telemetry, repairs, failures, base rate)
- **After Phase 3**: 1 batched parallel query using `Promise.allSettled`
- **Performance gain**: ~75% reduction in RUL calculation time

### Monitoring Thresholds

Set alerts on these Prometheus metrics:

```yaml
# High RUL prediction latency (p95 > 500ms)
- alert: RulPredictionSlowP95
  expr: histogram_quantile(0.95, rate(rul_prediction_duration_seconds_bucket[5m])) > 0.5
  for: 5m
  labels:
    severity: warning

# Low cache hit rate (< 80%)
- alert: RulCacheHitRateLow
  expr: |
    sum(rate(rul_base_rate_cache_hits_total[5m]))
    /
    (sum(rate(rul_base_rate_cache_hits_total[5m])) + sum(rate(rul_base_rate_cache_misses_total[5m])))
    < 0.8
  for: 10m
  labels:
    severity: warning

# Low data quality scores (p50 < 0.5)
- alert: RulDataQualityPoor
  expr: |
    sum(rate(rul_data_quality_score_sum[5m]))
    /
    sum(rate(rul_data_quality_score_count[5m]))
    < 0.5
  for: 15m
  labels:
    severity: info

# High calibration delta (mean > 0.3)
- alert: RulCalibrationDivergence
  expr: |
    sum(rate(rul_calibration_delta_sum[5m]))
    /
    sum(rate(rul_calibration_delta_count[5m]))
    > 0.3
  for: 10m
  labels:
    severity: info
```

---

## Observability

### Grafana Dashboard

**Location:** `docs/dashboards/grafana-rul-v2.json`

**Import to Grafana:**

1. Open Grafana → Dashboards → Import
2. Upload `grafana-rul-v2.json`
3. Select Prometheus data source
4. Click "Import"

**Dashboard Panels (13 total):**

1. **RUL Predictions (Last Hour)** - Total prediction volume
2. **Average Data Quality Score** - Mean quality across predictions
3. **Repair Censoring Applied** - How often censoring was used
4. **Base Rate Cache Hit Rate** - Caching effectiveness
5. **RUL Prediction Latency (p95)** - End-to-end performance by equipment type
6. **Batched Query Latency (p95)** - Batch fetch performance
7. **Data Quality Score Distribution** - Heatmap of quality spread
8. **Mode Multiplier Distribution** - Heatmap of mode adjustments
9. **Calibration Delta by Equipment Type** - Calibration impact per type
10. **Confidence Score Distribution** - p50/p95 confidence levels
11. **Remaining Useful Life (Days) by Risk Level** - RUL predictions segmented by risk
12. **RUL Predictions by Operating Mode** - Breakdown by vessel mode
13. **Cache Performance by Equipment Type** - Cache hits/misses per type

### Prometheus Metrics

**Metrics Endpoint:** `http://localhost:5000/api/metrics`

**Key Metrics:**

```promql
# Total predictions
rul_predictions_total{organization_id, equipment_type, operating_mode, prediction_status}

# Prediction latency histogram
rul_prediction_duration_seconds_bucket{equipment_type, le}

# Data quality histogram
rul_data_quality_score_bucket{le}

# Mode multiplier histogram
rul_mode_multiplier_bucket{operating_mode, le}

# Repair censoring counter
rul_repair_censoring_total{organization_id, equipment_type}

# Calibration delta histogram
rul_calibration_delta_bucket{equipment_type, le}

# Cache performance counters
rul_base_rate_cache_hits_total{equipment_type}
rul_base_rate_cache_misses_total{equipment_type}

# Batched query latency histogram
rul_batched_query_duration_seconds_bucket{le}

# Confidence score histogram
rul_confidence_score_bucket{le}

# Remaining days histogram
rul_remaining_days_bucket{risk_level, le}
```

### Log Patterns

**Feature flag initialization:**

```
[RUL v2.0 Feature Flags] Mode-aware: true, Quality: true, Repair: true, Calibration: true
```

**Successful prediction:**

```
[DEBUG] RUL prediction for equipment_id={id} mode={mode} quality={score} rul={days}d confidence={conf}
```

**Repair censoring applied:**

```
[INFO] Repair censoring: Excluded {count} failure records before {date} for equipment {id}
```

**Base rate cache hit:**

```
[DEBUG] Base rate cache hit for {equipment_type}
```

**Calibration applied:**

```
[DEBUG] Calibrated probability: raw={raw} → calibrated={cal} (delta={delta})
```

---

## Troubleshooting

### Issue: RUL predictions unchanged after v2.0 upgrade

**Symptoms:**

- Metrics show predictions happening
- But RUL values identical to v1.0
- No calibration delta in metrics

**Diagnosis:**

```bash
# Check feature flags
grep "RUL v2.0 Feature Flags" /tmp/logs/Start_application_*.log

# Check if metrics are incrementing
curl http://localhost:5000/api/metrics | grep rul_predictions_total
```

**Solutions:**

1. Verify feature flags are `true` in `.env`
2. Restart application to pick up env changes
3. Check for errors in application logs
4. Verify schema was pushed: `npm run db:push`

---

### Issue: Low data quality scores

**Symptoms:**

- `rul_data_quality_score` consistently < 0.5
- Confidence scores very low
- Many predictions marked as uncertain

**Diagnosis:**

```promql
# Check quality score distribution
sum(rate(rul_data_quality_score_sum[5m])) / sum(rate(rul_data_quality_score_count[5m]))

# Check by equipment
sum(rate(rul_data_quality_score_sum[5m])) by (equipment_type)
/ sum(rate(rul_data_quality_score_count[5m])) by (equipment_type)
```

**Root Causes:**

1. **Insufficient telemetry data**: Equipment has < 10 data points
2. **Short time span**: Telemetry covers < 7 days
3. **High missing data rate**: > 20% NULL values
4. **Stale data**: No telemetry in past 24 hours

**Solutions:**

1. Increase telemetry collection frequency
2. Ensure devices are reporting consistently
3. Check for connectivity issues with edge devices
4. Validate telemetry ingestion pipeline

---

### Issue: High calibration delta divergence

**Symptoms:**

- `rul_calibration_delta` > 0.3 consistently
- Predictions being heavily adjusted
- User reports unexpected RUL changes

**Diagnosis:**

```promql
# Check calibration delta by equipment type
sum(rate(rul_calibration_delta_sum[5m])) by (equipment_type)
/ sum(rate(rul_calibration_delta_count[5m])) by (equipment_type)
```

**Root Causes:**

1. **Inaccurate base failure rates**: Equipment failure history incomplete
2. **Model drift**: ML model out of date with current fleet behavior
3. **Calibration too aggressive**: Isotonic regression over-correcting

**Solutions:**

1. Review equipment failure history completeness
2. Re-train ML models with recent failure data
3. Temporarily disable calibration: `RUL_CALIBRATION=false`
4. Investigate specific equipment types with high delta

---

### Issue: Poor cache hit rate

**Symptoms:**

- `rul_base_rate_cache_hits_total / (hits + misses)` < 0.5
- High database load
- Slow RUL predictions

**Diagnosis:**

```promql
# Cache hit rate
sum(rate(rul_base_rate_cache_hits_total[5m]))
/
(sum(rate(rul_base_rate_cache_hits_total[5m])) + sum(rate(rul_base_rate_cache_misses_total[5m])))
```

**Root Causes:**

1. **Cache TTL too short**: 30min default may be too aggressive
2. **High equipment type diversity**: Many unique equipment types
3. **Memory pressure**: Cache being evicted prematurely

**Solutions:**

1. Monitor cache size and memory usage
2. Consider increasing TTL for stable equipment types
3. Optimize cache key structure
4. Pre-populate cache for common equipment types

---

### Issue: Mode detection failures

**Symptoms:**

- Most predictions show `operating_mode=UNKNOWN`
- Mode multipliers not being applied
- `rul_mode_multiplier` metrics empty

**Diagnosis:**

```bash
# Check mode distribution
curl http://localhost:5000/api/metrics | grep 'rul_predictions_total.*operating_mode'
```

**Root Causes:**

1. **Missing telemetry data**: Not enough recent telemetry for mode detection
2. **Sensor failures**: Speed, power, or position sensors offline
3. **Mode detector thresholds too strict**: Edge cases not handled

**Solutions:**

1. Verify telemetry data availability for equipment
2. Check sensor health in equipment monitoring dashboard
3. Review mode detection thresholds in `server/context/mode-detector.ts`
4. Temporarily disable mode awareness: `RUL_MODE_AWARE=false`

---

## Testing

### Unit Tests

```bash
# Run RUL utilities tests (80+ tests)
npm test -- server/tests/rul-utils.test.ts

# Run all tests
npm test
```

### Integration Tests

```bash
# Test RUL engine end-to-end
npm test -- server/tests/rul-engine.test.ts
```

### Performance Testing

```bash
# Run performance harness
npm run perf

# Expected results:
# - Dashboard aggregation: < 100ms p95
# - Single RUL prediction: < 500ms p95
# - Batched query: < 100ms p95
```

---

## Support

### Escalation Path

1. **L1 Support**: Check feature flags, verify schema, review logs
2. **L2 Engineering**: Investigate metrics, analyze data quality, debug mode detection
3. **L3 ML Team**: Model retraining, calibration tuning, threshold optimization

### Evidence Collection

When filing a support ticket, include:

1. **Feature flag configuration** from `.env`
2. **Grafana dashboard screenshot** of relevant panels
3. **Prometheus metrics snapshot**:
   ```bash
   curl http://localhost:5000/api/metrics | grep rul_ > rul_metrics_$(date +%Y%m%d_%H%M%S).txt
   ```
4. **Application logs** with RUL debug output
5. **Sample equipment ID** experiencing issues
6. **Expected vs actual RUL values**

---

## Appendix: Before/After Metrics

### Phase 3 Performance Optimization Results

**Dashboard API Latency:**

- Before: 826ms (p95)
- After: 18ms (p95)
- **Improvement: 98% faster**

**RUL Prediction Latency:**

- Before Phase 3: ~200ms (4 sequential queries)
- After Phase 3: ~50ms (1 batched parallel query)
- **Improvement: 75% faster**

### Expected Accuracy Improvements

**Target (from design specs):**

- Prediction accuracy: +10-15% improvement
- False alarm reduction: -20%

**Validation required:**

- Deploy to production fleet
- Collect 30 days of predictions
- Compare against actual failures
- Measure precision/recall metrics

---

## Change Log

| Version | Date       | Changes                                        |
| ------- | ---------- | ---------------------------------------------- |
| 2.0     | 2025-11-04 | Initial v2.0 release with 4 major enhancements |
| 1.0     | 2025-10-01 | Original RUL engine baseline                   |

---

**Document Owner:** ARUS Platform Engineering  
**Last Review:** 2025-11-04  
**Next Review:** 2025-12-04
