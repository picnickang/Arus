# ARUS Grafana Dashboards

Production-ready Grafana dashboard configurations for monitoring ARUS Marine Predictive Maintenance system.

**Note**: These are simplified starter dashboards with core panels using existing Prometheus metrics. Teams can extend them with additional panels through the Grafana UI based on operational needs.

## Available Dashboards

### 1. Analytics & Telemetry Monitoring
**File**: `grafana-analytics-telemetry.json`

**Purpose**: Real-time monitoring of telemetry ingestion pipeline.

**Panels** (4 total):
- **Telemetry Message Processing Rate**: Messages/sec by org, sensor type, and source
  - Metric: `rate(arus_telemetry_messages_processed_total[5m])`
- **Processing Duration (p95)**: 95th percentile processing latency
  - Metric: `histogram_quantile(0.95, sum(rate(arus_telemetry_processing_duration_ms_bucket[5m])) by (le, org_id, source))`
- **Validation Error Rate**: Failed validations per second
  - Metric: `rate(arus_telemetry_validation_errors_total[5m])`
  - Threshold: 10 errors/sec (visual marker)
- **Buffer Depth**: Current telemetry buffer utilization
  - Metric: `arus_telemetry_buffer_depth`
  - Thresholds: Warning (1K), Critical (5K)

---

### 2. System Health & Performance
**File**: `grafana-system-health.json`

**Purpose**: Infrastructure-level monitoring for HTTP services and databases.

**Panels** (4 total):
- **HTTP Request Rate**: Requests/sec by method and endpoint
  - Metric: `sum(rate(arus_http_requests_total[5m])) by (method, path)`
- **HTTP Duration Percentiles**: p50, p95, p99 response times
  - Metrics: `histogram_quantile(0.50/0.95/0.99, sum(rate(arus_http_request_duration_seconds_bucket[5m])) by (le))`
- **HTTP Error Rate**: 4xx and 5xx errors per second
  - Metrics: `sum(rate(arus_http_requests_total{status_code=~"4.."}[5m])) by (path)` and `status_code=~"5.."`
  - Threshold: 5 errors/sec (visual marker)
- **Active Database Connections**: Current DB connection pool utilization
  - Metric: `arus_database_connections_active`
  - Thresholds: Warning (50), Critical (80)

---

### 3. Marine Predictive Maintenance
**File**: `grafana-marine-pdm.json`

**Purpose**: Equipment health and fleet analytics for marine operations.

**Panels** (5 total):
- **Fleet Health Score** (Gauge): Overall fleet health 0-100%
  - Metric: `arus_fleet_health_score`
  - Color thresholds: Red (0-50), Orange (50-70), Yellow (70-85), Green (85-100)
- **Equipment Health Distribution** (Pie Chart): Equipment by status
  - Metric: `sum(arus_equipment_health_status) by (status)`
- **Alert Generation Rate**: Alerts/sec by severity and type
  - Metric: `rate(arus_alerts_generated_total[5m])`
- **Equipment Telemetry Processing**: Readings/sec by equipment and sensor
  - Metric: `sum(rate(arus_telemetry_processed_total[5m])) by (equipment_id, sensor_type)`
- **Top Equipment Errors** (Table): Top 10 equipment with telemetry errors (1h)
  - Metric: `topk(10, sum by (equipment_id, error_type) (increase(arus_telemetry_errors_total[1h])))`

**Template Variables**: None (simplified version)

---

## Installation

### Step 1: Import Dashboards to Grafana

#### Option A: Manual Import (Grafana UI)
1. Log in to your Grafana instance
2. Navigate to **Dashboards** → **Import**
3. Click **Upload JSON file**
4. Select one of the dashboard files from this directory
5. Configure data source (select your Prometheus instance)
6. Click **Import**
7. Repeat for all three dashboards

#### Option B: Provisioning (Automated)
1. Copy dashboard files to Grafana provisioning directory:
   ```bash
   cp dashboards/*.json /etc/grafana/provisioning/dashboards/
   ```

2. Create provisioning config `/etc/grafana/provisioning/dashboards/arus.yaml`:
   ```yaml
   apiVersion: 1
   
   providers:
     - name: 'ARUS Dashboards'
       orgId: 1
       folder: 'ARUS'
       type: file
       disableDeletion: false
       updateIntervalSeconds: 10
       options:
         path: /etc/grafana/provisioning/dashboards
   ```

3. Restart Grafana:
   ```bash
   systemctl restart grafana-server
   ```

---

### Step 2: Configure Prometheus Data Source

1. In Grafana, go to **Configuration** → **Data Sources**
2. Click **Add data source**
3. Select **Prometheus**
4. Configure:
   - **Name**: `Prometheus`
   - **URL**: `http://localhost:9090` (or your Prometheus instance URL)
   - **Scrape interval**: `15s` (recommended)
   - **Query timeout**: `60s`
5. Click **Save & Test**

---

### Step 3: Verify Metrics Collection

Ensure ARUS is exposing Prometheus metrics at `/metrics` endpoint:

```bash
# Check metrics endpoint
curl http://localhost:5000/metrics

# Should return metrics like:
# arus_telemetry_messages_processed_total{org_id="...",sensor_type="temperature"} 1234
# arus_http_requests_total{method="POST",path="/api/telemetry"} 567
# arus_fleet_health_score 87.5
```

---

### Step 4: Configure Prometheus Scraping

Update your `prometheus.yml` configuration:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'arus'
    static_configs:
      - targets: ['localhost:5000']  # ARUS application server
    scrape_interval: 15s
    scrape_timeout: 10s
    metrics_path: '/metrics'
```

Reload Prometheus configuration:

```bash
# Using systemd
systemctl reload prometheus

# OR send SIGHUP
kill -HUP $(pidof prometheus)
```

---

## Extending the Dashboards

These starter dashboards can be extended with additional panels via the Grafana UI:

### Additional Panels to Consider:
- Data quality score distribution (uses: `arus_telemetry_data_quality_score_bucket`)
- Stream aggregation duration (uses: `arus_stream_aggregation_duration_ms_bucket`)
- MQTT message retries (uses: `arus_mqtt_message_retries_total`)
- Work orders by status (uses: `arus_work_orders_total`)
- WebSocket connections (uses: `arus_websocket_connections_active`)

### Adding Alerts:
Alerts can be configured directly in Grafana:
1. Edit a panel
2. Click **Alert** tab
3. Create alert rule with conditions (e.g., "when avg() > 10")
4. Configure notification channels (email, Slack, PagerDuty)

### Adding Template Variables:
To add vessel/equipment filtering:
1. Go to Dashboard settings → **Variables**
2. Add new variable:
   - Name: `vessel`
   - Type: Query
   - Query: `label_values(arus_equipment_health_status, vessel_id)`
3. Use in queries: `{vessel_id="$vessel"}`

---

## Troubleshooting

### Dashboard shows "No data"
1. Verify Prometheus is scraping ARUS metrics:
   ```bash
   curl http://prometheus:9090/api/v1/targets
   ```
2. Check metrics endpoint is accessible:
   ```bash
   curl http://arus:5000/metrics
   ```
3. Verify data source configuration in Grafana

### Metrics missing or incomplete
1. Check Prometheus scrape logs:
   ```bash
   journalctl -u prometheus -f
   ```
2. Verify ARUS is emitting metrics (check server logs)
3. Check for metric registration errors in ARUS logs

### Queries timing out
1. Reduce time range (use "Last 1 hour" instead of "Last 24 hours")
2. Simplify queries (remove unnecessary group_by labels)
3. Increase Prometheus query timeout in Grafana data source settings

---

## Metric Retention

Configure Prometheus retention in `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

# Storage retention
storage:
  tsdb:
    path: /var/lib/prometheus
    retention.time: 30d  # Keep 30 days of metrics
    retention.size: 50GB  # Or 50GB, whichever comes first
```

For longer retention, consider:
- **Thanos**: Long-term metric storage with S3/GCS backend
- **Cortex**: Horizontally scalable Prometheus with long-term storage
- **VictoriaMetrics**: High-performance Prometheus-compatible TSDB

---

## Future Enhancements

This starter pack provides core monitoring capabilities. Teams may want to add:

**Analytics Dashboard**:
- Dead letter queue message counts
- Kalman sensor fusion applications
- MQTT buffer evictions by equipment

**System Health Dashboard**:
- WebSocket connection metrics
- Idempotency cache hit rates
- Top/slowest API endpoints

**Marine PdM Dashboard**:
- PdM score distribution heatmap
- Alert acknowledgment rates
- Work order status/priority charts
- STCW compliance check pass/fail rates
- Template variables for vessel/equipment filtering

These can be added through the Grafana UI using the metrics listed above.

---

## Support

For dashboard issues or feature requests:
- Review existing metrics: `server/observability/*.ts`
- Check Prometheus metrics: `http://localhost:5000/metrics`
- Contact: Marine Operations Engineering Team
