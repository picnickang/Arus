# Enhancement: Prometheus Monitoring Dashboard

## Objective

Create comprehensive Grafana dashboards for real-time monitoring of inventory API performance, usage patterns, and business metrics.

---

## Risk Assessment: **ZERO RISK** ✅

**Why Zero Risk**:

- Read-only monitoring (no code changes)
- Existing Prometheus metrics already instrumented
- Can be disabled/removed without affecting functionality
- No database or API modifications

---

## Dashboard Structure

### Dashboard 1: Inventory API Performance

**Purpose**: Monitor API health, latency, and errors

```json
{
  "dashboard": {
    "title": "Inventory API Performance",
    "tags": ["inventory", "api", "performance"],
    "timezone": "browser",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_request_duration_seconds_count{path=~'/api/inventory.*'}[5m])) by (path)",
            "legendFormat": "{{path}}"
          }
        ],
        "yAxes": [
          {
            "format": "reqps",
            "label": "Requests/sec"
          }
        ]
      },
      {
        "title": "Latency P95/P99",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{path=~'/api/inventory.*'}[5m]))",
            "legendFormat": "P95 - {{path}}"
          },
          {
            "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{path=~'/api/inventory.*'}[5m]))",
            "legendFormat": "P99 - {{path}}"
          }
        ],
        "yAxes": [
          {
            "format": "s",
            "label": "Latency"
          }
        ],
        "alert": {
          "name": "High API Latency",
          "conditions": [
            {
              "evaluator": {
                "type": "gt",
                "params": [0.5]
              },
              "query": { "refId": "A", "from": "5m", "to": "now" }
            }
          ]
        }
      },
      {
        "title": "Error Rate by Endpoint",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~'5..', path=~'/api/inventory.*'}[5m])) by (path)",
            "legendFormat": "{{path}}"
          }
        ],
        "yAxes": [
          {
            "format": "reqps",
            "label": "Errors/sec"
          }
        ],
        "alert": {
          "name": "High Error Rate",
          "conditions": [
            {
              "evaluator": {
                "type": "gt",
                "params": [0.05]
              }
            }
          ]
        }
      },
      {
        "title": "Cache Hit Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))"
          }
        ],
        "format": "percentunit",
        "thresholds": "0.5,0.7",
        "colors": ["#d44a3a", "#e0b400", "#299c46"]
      },
      {
        "title": "Top Organizations by Request Volume",
        "type": "table",
        "targets": [
          {
            "expr": "topk(10, sum(rate(http_request_duration_seconds_count{path=~'/api/inventory.*'}[1h])) by (org_id))",
            "format": "table"
          }
        ]
      },
      {
        "title": "Database Query Performance",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(inventory_db_query_duration_seconds_bucket[5m]))",
            "legendFormat": "P95 - {{query_type}}"
          }
        ],
        "yAxes": [
          {
            "format": "s",
            "label": "Query Time"
          }
        ]
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "10s"
  }
}
```

---

### Dashboard 2: Inventory Business Metrics

**Purpose**: Track inventory optimization impact and supplier performance

```json
{
  "dashboard": {
    "title": "Inventory Business Metrics",
    "tags": ["inventory", "business", "kpi"],
    "panels": [
      {
        "title": "Total Potential Savings (Last 30 Days)",
        "type": "singlestat",
        "targets": [
          {
            "expr": "sum(increase(inventory_potential_savings_total[30d]))"
          }
        ],
        "format": "currencyUSD",
        "prefix": "$"
      },
      {
        "title": "Parts Optimized Over Time",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(inventory_optimizations_total[1h]))",
            "legendFormat": "Parts/hour"
          }
        ]
      },
      {
        "title": "Optimization Recommendations Breakdown",
        "type": "piechart",
        "targets": [
          {
            "expr": "sum(inventory_optimizations_total) by (recommendation)",
            "legendFormat": "{{recommendation}}"
          }
        ]
      },
      {
        "title": "Supplier Performance Score Distribution",
        "type": "heatmap",
        "targets": [
          {
            "expr": "sum(rate(inventory_supplier_score_bucket[5m])) by (le)",
            "format": "heatmap"
          }
        ]
      },
      {
        "title": "Critical Stock Alerts",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(inventory_stock_alerts_total{level='critical'}[1h]))",
            "legendFormat": "Critical Alerts/hour"
          }
        ],
        "alert": {
          "name": "Critical Stock Spike",
          "conditions": [
            {
              "evaluator": { "type": "gt", "params": [10] }
            }
          ]
        }
      },
      {
        "title": "Average EOQ by Part Category",
        "type": "bargauge",
        "targets": [
          {
            "expr": "avg(inventory_eoq_calculated) by (part_category)",
            "legendFormat": "{{part_category}}"
          }
        ]
      },
      {
        "title": "Substitution Usage Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(inventory_substitutions_found_total[1h]))",
            "legendFormat": "Substitutions Found/hour"
          },
          {
            "expr": "sum(rate(inventory_substitutions_applied_total[1h]))",
            "legendFormat": "Substitutions Used/hour"
          }
        ]
      },
      {
        "title": "Top Parts by Optimization Frequency",
        "type": "table",
        "targets": [
          {
            "expr": "topk(20, sum(increase(inventory_optimizations_total[7d])) by (part_no))",
            "format": "table"
          }
        ]
      }
    ]
  }
}
```

---

### Dashboard 3: Inventory Data Quality

**Purpose**: Monitor data completeness and quality issues

```json
{
  "dashboard": {
    "title": "Inventory Data Quality",
    "tags": ["inventory", "data-quality", "monitoring"],
    "panels": [
      {
        "title": "Parts Without Usage History",
        "type": "singlestat",
        "targets": [
          {
            "expr": "inventory_parts_without_usage_total"
          }
        ],
        "thresholds": "100,500",
        "colors": ["#299c46", "#e0b400", "#d44a3a"]
      },
      {
        "title": "Parts Missing Cost Data",
        "type": "graph",
        "targets": [
          {
            "expr": "inventory_parts_missing_cost_data",
            "legendFormat": "Missing Costs"
          }
        ]
      },
      {
        "title": "Suppliers Without Performance Data",
        "type": "singlestat",
        "targets": [
          {
            "expr": "inventory_suppliers_no_delivery_history"
          }
        ]
      },
      {
        "title": "Data Completeness Score",
        "type": "gauge",
        "targets": [
          {
            "expr": "(inventory_parts_with_complete_data / inventory_parts_total) * 100"
          }
        ],
        "thresholds": "80,90",
        "format": "percent"
      },
      {
        "title": "NaN Score Incidents",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(inventory_nan_scores_total[5m])) by (metric_type)",
            "legendFormat": "{{metric_type}}"
          }
        ],
        "alert": {
          "name": "High NaN Rate",
          "conditions": [
            {
              "evaluator": { "type": "gt", "params": [0.1] }
            }
          ]
        }
      }
    ]
  }
}
```

---

## Alert Rules Configuration

```yaml
# prometheus/alerts/inventory.yml
groups:
  - name: inventory_api_alerts
    interval: 30s
    rules:
      - alert: InventoryAPIHighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{path=~"/api/inventory.*"}[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
          component: inventory-api
        annotations:
          summary: "Inventory API P95 latency > 500ms"
          description: "P95 latency is {{ $value }}s on {{ $labels.path }}"

      - alert: InventoryAPIErrorRate
        expr: sum(rate(http_requests_total{status=~"5..", path=~"/api/inventory.*"}[5m])) / sum(rate(http_requests_total{path=~"/api/inventory.*"}[5m])) > 0.05
        for: 3m
        labels:
          severity: critical
          component: inventory-api
        annotations:
          summary: "Inventory API error rate > 5%"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: CacheLowHitRate
        expr: sum(rate(cache_hits_total[15m])) / (sum(rate(cache_hits_total[15m])) + sum(rate(cache_misses_total[15m]))) < 0.5
        for: 30m
        labels:
          severity: warning
          component: cache
        annotations:
          summary: "Cache hit rate below 50%"
          description: "Hit rate is {{ $value | humanizePercentage }}"

      - alert: CriticalStockAlertsSpike
        expr: sum(rate(inventory_stock_alerts_total{level="critical"}[1h])) > 20
        for: 15m
        labels:
          severity: warning
          component: inventory
        annotations:
          summary: "Spike in critical stock alerts"
          description: "{{ $value }} critical alerts/hour detected"

      - alert: SupplierPerformanceDegradation
        expr: avg(inventory_supplier_score) by (supplier_id) < 60
        for: 1h
        labels:
          severity: warning
          component: supplier-mgmt
        annotations:
          summary: "Supplier performance below threshold"
          description: "Supplier {{ $labels.supplier_id }} score is {{ $value }}"
```

---

## Metric Collection Enhancements

```typescript
// server/observability/inventory-metrics.ts

// Add new metrics for business KPIs
export const inventoryMetrics = {
  // Existing metrics...

  // Business metrics
  totalSavingsPotential: new Gauge({
    name: "inventory_total_savings_potential_usd",
    help: "Total potential savings from optimization recommendations",
    labelNames: ["org_id"],
  }),

  partsWithoutUsage: new Gauge({
    name: "inventory_parts_without_usage_total",
    help: "Number of parts with no usage history",
    labelNames: ["org_id"],
  }),

  supplierScoreDistribution: new Histogram({
    name: "inventory_supplier_score",
    help: "Supplier performance score distribution",
    labelNames: ["org_id", "supplier_id"],
    buckets: [0, 20, 40, 60, 80, 100],
  }),

  eoqCalculated: new Histogram({
    name: "inventory_eoq_calculated",
    help: "Economic Order Quantity calculated values",
    labelNames: ["org_id", "part_category"],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500],
  }),

  substitutionsFound: new Counter({
    name: "inventory_substitutions_found_total",
    help: "Total number of part substitutions found",
    labelNames: ["org_id", "part_no"],
  }),

  dataQualityScore: new Gauge({
    name: "inventory_data_quality_score",
    help: "Overall data completeness percentage",
    labelNames: ["org_id", "metric_type"],
  }),
};

// Background job to update data quality metrics
export async function updateDataQualityMetrics(orgId: string) {
  const stats = await db
    .select({
      totalParts: sql<number>`COUNT(DISTINCT ${parts.id})`,
      partsWithUsage: sql<number>`COUNT(DISTINCT CASE WHEN EXISTS(
        SELECT 1 FROM ${workOrderItems} WHERE ${workOrderItems.partId} = ${parts.id}
      ) THEN ${parts.id} END)`,
      partsWithCosts: sql<number>`COUNT(DISTINCT CASE WHEN ${parts.standardCost} IS NOT NULL THEN ${parts.id} END)`,
    })
    .from(parts)
    .where(eq(parts.orgId, orgId))
    .then((r) => r[0]);

  // Update gauges
  inventoryMetrics.partsWithoutUsage.set(
    { org_id: orgId },
    stats.totalParts - stats.partsWithUsage
  );

  inventoryMetrics.dataQualityScore.set(
    { org_id: orgId, metric_type: "usage_coverage" },
    (stats.partsWithUsage / stats.totalParts) * 100
  );

  inventoryMetrics.dataQualityScore.set(
    { org_id: orgId, metric_type: "cost_coverage" },
    (stats.partsWithCosts / stats.totalParts) * 100
  );
}
```

---

## Implementation Steps

### Phase 1: Metric Enhancement (Day 1)

1. Add new business metrics to `inventory-metrics.ts`
2. Update endpoints to record new metrics
3. Deploy to staging, verify metrics appear in Prometheus

### Phase 2: Dashboard Creation (Day 2)

1. Import dashboard JSONs into Grafana
2. Configure data sources
3. Test all panels with real data
4. Adjust thresholds based on baseline

### Phase 3: Alert Configuration (Day 3)

1. Add alert rules to Prometheus
2. Configure notification channels (Slack, PagerDuty, email)
3. Test alerts with synthetic load
4. Document runbook for each alert

### Phase 4: Documentation & Training (Day 4-5)

1. Create dashboard user guide
2. Train operations team on interpreting metrics
3. Establish SLOs and review cadence
4. Set up weekly metric review meetings

---

## Expected Outcomes

**Visibility**:

- Real-time performance monitoring
- Business impact tracking
- Data quality insights

**Proactive Issue Detection**:

- Catch performance degradation before users complain
- Identify data quality issues automatically
- Track supplier performance trends

**Business Value**:

- Quantify cost savings from optimization
- Demonstrate ROI of inventory management system
- Identify most valuable features

---

## Future Enhancements

1. **Custom Dashboards**: Per-organization customizable views
2. **Anomaly Detection**: ML-based alerting for unusual patterns
3. **Cost Attribution**: Track cost savings per team/vessel
4. **Predictive Dashboards**: Show forecasted metrics based on trends
