# Enhancement: Batch Auto-Optimization Endpoint

## Objective

Create a new endpoint that automatically loads historical usage data from the database, eliminating the need for clients to provide usage history in the request payload.

---

## Risk Assessment: **LOW** ✅

**Why Low Risk**:

- Additive feature (existing `/optimize` endpoint unchanged)
- Reuses existing inventory calculation logic
- Read-only database operations
- Can be rate-limited to prevent abuse

**Rollback Strategy**:

- Remove route registration
- No data migration needed
- Zero impact on existing functionality

---

## User Experience Improvement

### Before (Current)

```javascript
// Client must manually aggregate 12 months of usage data
const usageHistory = await fetch('/api/telemetry/usage/PUMP-100?months=12');
const historicalData = processUsageData(usageHistory);

// Then send to optimization endpoint
const result = await fetch('/api/inventory/optimize', {
  method: 'POST',
  body: JSON.stringify({
    partNumbers: ['PUMP-100'],
    usageHistory: historicalData, // Large payload
    costs: {...},
    currentStock: {...}
  })
});
```

### After (Improved)

```javascript
// Server automatically loads usage from database
const result = await fetch("/api/inventory/optimize/auto", {
  method: "POST",
  body: JSON.stringify({
    partNumbers: ["PUMP-100"],
    daysHistory: 365, // Optional, defaults to 365
    // Server fetches everything else automatically
  }),
});
```

**Benefits**:

- 90% smaller request payloads
- Simpler client integration
- Consistent usage calculation logic
- Easier to schedule automated optimization runs

---

## Implementation

### Step 1: Database Query for Historical Usage (30 min)

```typescript
// server/inventory.ts

interface UsageHistoryRecord {
  partNo: string;
  month: string; // YYYY-MM format
  quantityUsed: number;
}

/**
 * Loads historical part usage from work orders and maintenance records
 * @param orgId Organization ID
 * @param partNumbers Array of part numbers to analyze
 * @param daysHistory Number of days to look back (default 365)
 * @returns Monthly usage data for each part
 */
export async function loadPartUsageHistory(
  orgId: string,
  partNumbers: string[],
  daysHistory: number = 365
): Promise<Record<string, number[]>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysHistory);

  // Query 1: Usage from completed work orders
  const workOrderUsage = await db
    .select({
      partNo: parts.partNo,
      month: sql<string>`TO_CHAR(${workOrders.completedDate}, 'YYYY-MM')`,
      quantityUsed: sql<number>`SUM(${workOrderItems.quantityUsed})`,
    })
    .from(workOrderItems)
    .innerJoin(workOrders, eq(workOrders.id, workOrderItems.workOrderId))
    .innerJoin(parts, eq(parts.id, workOrderItems.partId))
    .where(
      and(
        eq(workOrders.orgId, orgId),
        inArray(parts.partNo, partNumbers),
        eq(workOrders.status, 'completed'),
        gte(workOrders.completedDate, startDate)
      )
    )
    .groupBy(parts.partNo, sql`TO_CHAR(${workOrders.completedDate}, 'YYYY-MM')`)
    .orderBy(parts.partNo, sql`TO_CHAR(${workOrders.completedDate}, 'YYYY-MM')`);

  // Query 2: Usage from stock adjustments (consumption)
  const stockUsage = await db
    .select({
      partNo: parts.partNo,
      month: sql<string>`TO_CHAR(${stockAdjustments.createdAt}, 'YYYY-MM')`,
      quantityUsed: sql<number>`ABS(SUM(${stockAdjustments.quantityChange}))`,
    })
    .from(stockAdjustments)
    .innerJoin(stock, eq(stock.id, stockAdjustments.stockId))
    .innerJoin(parts, eq(parts.id, stock.partId))
    .where(
      and(
        eq(stock.orgId, orgId),
        inArray(parts.partNo, partNumbers),
        eq(stockAdjustments.type, 'consumption'),
        gte(stockAdjustments.createdAt, startDate)
      )
    )
    .groupBy(parts.partNo, sql`TO_CHAR(${stockAdjustments.createdAt}, 'YYYY-MM')`)
    .orderBy(parts.partNo, sql`TO_CHAR(${stockAdjustments.createdAt, 'YYYY-MM')`);

  // Merge data from both sources
  const combined = [...workOrderUsage, ...stockUsage];

  // Convert to monthly arrays (last 12 months)
  const result: Record<string, number[]> = {};
  const now = new Date();

  for (const partNo of partNumbers) {
    const monthlyData: number[] = [];

    // Generate last 12 months
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now);
      monthDate.setMonth(monthDate.getMonth() - i);
      const monthKey = monthDate.toISOString().substring(0, 7); // YYYY-MM

      // Sum usage from all sources for this month
      const usage = combined
        .filter(r => r.partNo === partNo && r.month === monthKey)
        .reduce((sum, r) => sum + r.quantityUsed, 0);

      monthlyData.push(Math.round(usage));
    }

    result[partNo] = monthlyData;
  }

  return result;
}

/**
 * Loads current costs from parts and suppliers tables
 */
export async function loadPartCosts(
  orgId: string,
  partNumbers: string[]
): Promise<Record<string, { orderingCost: number; holdingCostRate: number }>> {
  const partsData = await db
    .select({
      partNo: parts.partNo,
      standardCost: parts.standardCost,
      supplierLeadTime: suppliers.leadTimeDays,
    })
    .from(parts)
    .leftJoin(suppliers, eq(suppliers.id, parts.primarySupplierId))
    .where(
      and(
        eq(parts.orgId, orgId),
        inArray(parts.partNo, partNumbers)
      )
    );

  const costs: Record<string, { orderingCost: number; holdingCostRate: number }> = {};

  for (const part of partsData) {
    // Estimate ordering cost based on lead time and standard cost
    const baseOrderingCost = 50; // $50 base administrative cost
    const shippingEstimate = (part.supplierLeadTime || 7) > 14 ? 100 : 25;

    costs[part.partNo] = {
      orderingCost: baseOrderingCost + shippingEstimate,
      holdingCostRate: 0.20, // 20% annual holding cost (industry standard)
    };
  }

  return costs;
}

/**
 * Loads current stock levels
 */
export async function loadCurrentStock(
  orgId: string,
  partNumbers: string[]
): Promise<Record<string, number>> {
  const stockData = await db
    .select({
      partNo: parts.partNo,
      totalQuantity: sql<number>`SUM(${stock.quantityOnHand})`,
    })
    .from(stock)
    .innerJoin(parts, eq(parts.id, stock.partId))
    .where(
      and(
        eq(stock.orgId, orgId),
        inArray(parts.partNo, partNumbers)
      )
    )
    .groupBy(parts.partNo);

  const currentStock: Record<string, number> = {};
  for (const item of stockData) {
    currentStock[item.partNo] = item.totalQuantity || 0;
  }

  return currentStock;
}
```

### Step 2: New Auto-Optimization Endpoint (20 min)

```typescript
// server/routes.ts

/**
 * POST /api/inventory/optimize/auto
 * Automatically loads historical data and optimizes inventory levels
 */
app.post("/api/inventory/optimize/auto", requireOrgId, async (req: Request, res: Response) => {
  const orgId = (req as AuthRequest).orgId;

  try {
    // Validate request
    const schema = z.object({
      partNumbers: z.array(z.string()).min(1).max(100),
      daysHistory: z.number().int().min(30).max(730).optional().default(365),
      includeForecasting: z.boolean().optional().default(false),
    });

    const validated = schema.parse(req.body);

    // Load historical data from database
    const [usageHistory, costs, currentStock] = await Promise.all([
      loadPartUsageHistory(orgId, validated.partNumbers, validated.daysHistory),
      loadPartCosts(orgId, validated.partNumbers),
      loadCurrentStock(orgId, validated.partNumbers),
    ]);

    // Filter parts with insufficient data
    const partsWithData = validated.partNumbers.filter((partNo) => {
      const hasUsage = usageHistory[partNo]?.some((qty) => qty > 0);
      return hasUsage;
    });

    if (partsWithData.length === 0) {
      return res.status(400).json({
        error: "Insufficient usage data for optimization",
        details: {
          message: "No parts have usage history in the specified period",
          daysHistory: validated.daysHistory,
          suggestion: "Try increasing daysHistory or verify parts are being used",
        },
      });
    }

    // Call existing optimization function
    const results = await optimizeInventoryLevels(
      orgId,
      partsWithData,
      usageHistory,
      costs,
      currentStock
    );

    // Enrich with additional metadata
    const enrichedResults = results.map((result) => ({
      ...result,
      metadata: {
        dataQuality: {
          monthsOfData: usageHistory[result.partNo]?.filter((q) => q > 0).length || 0,
          totalHistoricalUsage: usageHistory[result.partNo]?.reduce((a, b) => a + b, 0) || 0,
        },
        autoLoaded: {
          usageHistory: true,
          costs: true,
          currentStock: true,
        },
        calculatedAt: new Date().toISOString(),
      },
    }));

    // Track metrics
    inventoryMetrics.optimizationRuns.inc({ type: "auto", orgId });

    res.json(enrichedResults);
  } catch (error) {
    console.error("[Inventory Auto-Optimization] Error:", error);
    inventoryMetrics.errors.inc({ operation: "auto_optimize", orgId });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }

    res.status(500).json({
      error: "Auto-optimization failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
```

### Step 3: Background Job for Scheduled Optimization (30 min)

```typescript
// server/jobs/scheduled-inventory-optimization.ts
import cron from "node-cron";
import { db } from "../db";
import {
  loadPartUsageHistory,
  loadPartCosts,
  loadCurrentStock,
  optimizeInventoryLevels,
} from "../inventory";

interface OptimizationJob {
  id: string;
  orgId: string;
  partCategories: string[];
  schedule: string; // cron expression
  notifyOnCritical: boolean;
  lastRunAt?: Date;
}

// Store optimization results for historical tracking
async function saveOptimizationResults(orgId: string, jobId: string, results: any[]) {
  await db.insert(inventoryOptimizationRuns).values({
    id: randomUUID(),
    orgId,
    jobId,
    runAt: new Date(),
    resultsJson: JSON.stringify(results),
    criticalPartsCount: results.filter((r) => r.recommendation === "critical_reorder").length,
    totalSavingsPotential: results.reduce((sum, r) => sum + (r.potentialSavings || 0), 0),
  });
}

// Scheduled optimization runner
export function startScheduledOptimization() {
  // Run daily at 3 AM
  cron.schedule("0 3 * * *", async () => {
    console.log("[Scheduled Optimization] Starting daily inventory optimization...");

    try {
      // Get all active optimization jobs
      const jobs = await db
        .select()
        .from(scheduledOptimizationJobs)
        .where(eq(scheduledOptimizationJobs.isActive, true));

      for (const job of jobs) {
        try {
          // Get all parts in specified categories
          const parts = await db
            .select({ partNo: parts.partNo })
            .from(parts)
            .where(and(eq(parts.orgId, job.orgId), inArray(parts.category, job.partCategories)));

          const partNumbers = parts.map((p) => p.partNo);

          if (partNumbers.length === 0) {
            console.log(`[Scheduled Optimization] No parts found for job ${job.id}`);
            continue;
          }

          // Load data and optimize
          const [usageHistory, costs, currentStock] = await Promise.all([
            loadPartUsageHistory(job.orgId, partNumbers, 365),
            loadPartCosts(job.orgId, partNumbers),
            loadCurrentStock(job.orgId, partNumbers),
          ]);

          const results = await optimizeInventoryLevels(
            job.orgId,
            partNumbers,
            usageHistory,
            costs,
            currentStock
          );

          // Save results
          await saveOptimizationResults(job.orgId, job.id, results);

          // Send notifications for critical items
          if (job.notifyOnCritical) {
            const criticalItems = results.filter((r) => r.recommendation === "critical_reorder");

            if (criticalItems.length > 0) {
              await sendCriticalInventoryAlert(job.orgId, criticalItems);
            }
          }

          console.log(
            `[Scheduled Optimization] Completed job ${job.id}: ${results.length} parts optimized`
          );
        } catch (error) {
          console.error(`[Scheduled Optimization] Error in job ${job.id}:`, error);
        }
      }
    } catch (error) {
      console.error("[Scheduled Optimization] Fatal error:", error);
    }
  });

  console.log("[Scheduled Optimization] Job scheduler started (runs daily at 3 AM)");
}
```

---

## API Documentation

### Request Schema

```typescript
{
  "partNumbers": string[],        // Required, 1-100 part numbers
  "daysHistory": number,           // Optional, 30-730 days (default: 365)
  "includeForecasting": boolean    // Optional, future enhancement (default: false)
}
```

### Response Schema

```typescript
[
  {
    partNo: "PUMP-100",
    currentStock: 3,
    averageUsagePerMonth: 2.5,
    economicOrderQuantity: 5,
    reorderPoint: 3,
    recommendation: "increase",
    potentialSavings: 75.0,
    rationale: "Current stock below optimal level",
    metadata: {
      dataQuality: {
        monthsOfData: 12,
        totalHistoricalUsage: 30,
      },
      autoLoaded: {
        usageHistory: true,
        costs: true,
        currentStock: true,
      },
      calculatedAt: "2025-11-06T12:00:00Z",
    },
  },
];
```

---

## Testing

### Unit Tests

```typescript
describe("loadPartUsageHistory", () => {
  test("should aggregate work order and stock consumption data", async () => {
    const usage = await loadPartUsageHistory("org-1", ["PUMP-100"], 365);
    expect(usage["PUMP-100"]).toHaveLength(12);
    expect(usage["PUMP-100"].every((q) => q >= 0)).toBe(true);
  });

  test("should return 12 months even with sparse data", async () => {
    const usage = await loadPartUsageHistory("org-1", ["RARE-PART"], 365);
    expect(usage["RARE-PART"]).toHaveLength(12);
  });

  test("should handle parts with no usage history", async () => {
    const usage = await loadPartUsageHistory("org-1", ["NEW-PART"], 365);
    expect(usage["NEW-PART"]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
});
```

### Integration Tests

```typescript
describe("POST /api/inventory/optimize/auto", () => {
  test("should optimize parts with historical data", async () => {
    const res = await request(app)
      .post("/api/inventory/optimize/auto")
      .set("x-org-id", "test-org")
      .send({ partNumbers: ["PUMP-100", "FILTER-500"] });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].metadata.autoLoaded.usageHistory).toBe(true);
  });

  test("should return 400 when no parts have usage data", async () => {
    const res = await request(app)
      .post("/api/inventory/optimize/auto")
      .set("x-org-id", "test-org")
      .send({ partNumbers: ["NEVER-USED-PART"] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Insufficient usage data");
  });
});
```

---

## Performance Considerations

**Database Queries**:

- 3 parallel queries (usage, costs, stock) = ~200ms total
- Indexes required:
  - `work_orders(org_id, status, completed_date)`
  - `work_order_items(work_order_id, part_id)`
  - `stock_adjustments(stock_id, type, created_at)`

**Caching Strategy**:

- Usage history: 1-hour cache (infrequent updates)
- Costs: 15-minute cache (semi-static)
- Current stock: Real-time (no cache)

**Rate Limiting**:

- 10 requests per minute per organization
- Prevents abuse of expensive aggregation queries

---

## Rollout Plan

**Day 1**: Deploy endpoint (disabled via feature flag)
**Day 2-3**: Test with internal data, verify accuracy
**Day 4**: Enable for 10% of organizations
**Day 5-7**: Gradual rollout to 100%
**Week 2**: Add scheduled optimization jobs

**Success Metrics**:

- 80%+ of optimization requests use auto endpoint
- Average request size reduced by 90%
- Client integration time reduced from 2 hours to 15 minutes

---

## Future Enhancements

1. **Machine Learning Forecasting**: Predict future usage based on vessel schedules
2. **What-If Scenarios**: Compare optimization results with different parameters
3. **Multi-Part Bundling**: Optimize related parts together (e.g., pump + seals)
4. **Cost-Benefit Analysis**: Show ROI of implementing recommendations
