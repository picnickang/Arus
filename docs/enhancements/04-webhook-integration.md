# Enhancement: Webhook Integration for Inventory Alerts

## Objective

Enable real-time notifications to external systems when critical inventory events occur, allowing automated workflows and third-party integrations.

---

## Risk Assessment: **LOW** ✅

**Why Low Risk**:

- Additive feature (no existing functionality changes)
- Async processing (doesn't block main flow)
- Failures don't affect core inventory operations
- Can be disabled per organization

**Rollback Strategy**:

- Disable webhook delivery service
- Events still logged for manual processing
- No data loss or corruption risk

---

## Architecture

```
┌─────────────────────────┐
│  Inventory Event        │
│  (critical stock alert) │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Webhook Queue          │
│  (Redis/Database)       │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Webhook Delivery       │
│  Service (Background)   │
└──────────┬──────────────┘
           │
           ├──▶ HTTP POST to webhook URL
           │
           ├──▶ Retry logic (exponential backoff)
           │
           └──▶ Dead letter queue for failures
```

**Event Types**:

1. `inventory.critical_stock` - Part below critical threshold
2. `inventory.reorder_point` - Part reached ROP
3. `inventory.optimization_complete` - Batch optimization finished
4. `supplier.performance_degraded` - Supplier score dropped
5. `parts.substitution_created` - New substitute approved

---

## Implementation

### Step 1: Webhook Configuration Schema (20 min)

```typescript
// shared/schema.ts

export const webhookConfigurations = pgTable(
  "webhook_configurations",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    url: text("url").notNull(),
    secret: text("secret").notNull(), // For HMAC signature
    events: text("events").array().notNull(), // ['inventory.critical_stock', ...]
    isActive: boolean("is_active").notNull().default(true),
    headers: jsonb("headers"), // Custom HTTP headers
    retryConfig: jsonb("retry_config").default({
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelayMs: 1000,
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }),
  },
  (table) => ({
    orgIdx: index("idx_webhooks_org").on(table.orgId, table.isActive),
  })
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    webhookId: varchar("webhook_id")
      .notNull()
      .references(() => webhookConfigurations.id),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull(), // 'pending', 'delivered', 'failed', 'dead_letter'
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { mode: "date" }),
    deliveredAt: timestamp("delivered_at", { mode: "date" }),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    statusIdx: index("idx_webhook_deliveries_status").on(table.status, table.createdAt),
    webhookIdx: index("idx_webhook_deliveries_webhook").on(table.webhookId),
  })
);
```

### Step 2: Webhook Delivery Service (45 min)

```typescript
// server/services/webhook-service.ts
import crypto from "crypto";
import { db } from "../db";
import { webhookConfigurations, webhookDeliveries } from "@shared/schema";

interface WebhookPayload {
  eventType: string;
  eventId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export class WebhookService {
  /**
   * Queue webhook event for delivery
   */
  async queueEvent(orgId: string, eventType: string, data: Record<string, unknown>): Promise<void> {
    // Find all active webhooks subscribed to this event type
    const webhooks = await db
      .select()
      .from(webhookConfigurations)
      .where(
        and(
          eq(webhookConfigurations.orgId, orgId),
          eq(webhookConfigurations.isActive, true),
          sql`${eventType} = ANY(${webhookConfigurations.events})`
        )
      );

    if (webhooks.length === 0) {
      console.log(`[Webhook] No active webhooks for event ${eventType}`);
      return;
    }

    // Create delivery records
    const eventId = randomUUID();
    const payload: WebhookPayload = {
      eventType,
      eventId,
      timestamp: new Date().toISOString(),
      data,
    };

    await db.insert(webhookDeliveries).values(
      webhooks.map((webhook) => ({
        id: randomUUID(),
        webhookId: webhook.id,
        eventType,
        payload,
        status: "pending",
      }))
    );

    console.log(`[Webhook] Queued ${webhooks.length} deliveries for event ${eventType}`);
  }

  /**
   * Process pending webhook deliveries
   */
  async processPendingDeliveries(): Promise<void> {
    const pending = await db
      .select({
        delivery: webhookDeliveries,
        webhook: webhookConfigurations,
      })
      .from(webhookDeliveries)
      .innerJoin(webhookConfigurations, eq(webhookConfigurations.id, webhookDeliveries.webhookId))
      .where(eq(webhookDeliveries.status, "pending"))
      .limit(100); // Process in batches

    for (const { delivery, webhook } of pending) {
      await this.deliverWebhook(delivery, webhook);
    }
  }

  /**
   * Deliver a single webhook
   */
  private async deliverWebhook(
    delivery: typeof webhookDeliveries.$inferSelect,
    webhook: typeof webhookConfigurations.$inferSelect
  ): Promise<void> {
    const retryConfig = webhook.retryConfig as {
      maxRetries: number;
      backoffMultiplier: number;
      initialDelayMs: number;
    };

    // Check if max retries exceeded
    if (delivery.attempts >= retryConfig.maxRetries) {
      await this.moveToDeadLetter(delivery.id, "Max retries exceeded");
      return;
    }

    try {
      // Generate HMAC signature
      const signature = this.generateSignature(JSON.stringify(delivery.payload), webhook.secret);

      // Prepare headers
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": delivery.eventType,
        "X-Webhook-Delivery": delivery.id,
        "User-Agent": "ARUS-Webhook/1.0",
        ...((webhook.headers as Record<string, string>) || {}),
      };

      // Make HTTP request with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: JSON.stringify(delivery.payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseBody = await response.text();

      // Update delivery record
      if (response.ok) {
        await db
          .update(webhookDeliveries)
          .set({
            status: "delivered",
            attempts: delivery.attempts + 1,
            lastAttemptAt: new Date(),
            deliveredAt: new Date(),
            responseStatus: response.status,
            responseBody: responseBody.substring(0, 1000), // Limit size
          })
          .where(eq(webhookDeliveries.id, delivery.id));

        console.log(`[Webhook] Delivered ${delivery.id} to ${webhook.url}`);
      } else {
        throw new Error(`HTTP ${response.status}: ${responseBody}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Calculate next retry delay
      const delayMs =
        retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, delivery.attempts);

      await db
        .update(webhookDeliveries)
        .set({
          status: delivery.attempts + 1 >= retryConfig.maxRetries ? "dead_letter" : "pending",
          attempts: delivery.attempts + 1,
          lastAttemptAt: new Date(),
          errorMessage,
        })
        .where(eq(webhookDeliveries.id, delivery.id));

      console.error(
        `[Webhook] Delivery ${delivery.id} failed (attempt ${delivery.attempts + 1}):`,
        errorMessage
      );

      // Schedule retry with exponential backoff
      if (delivery.attempts + 1 < retryConfig.maxRetries) {
        setTimeout(() => {
          this.deliverWebhook(delivery, webhook).catch(console.error);
        }, delayMs);
      }
    }
  }

  /**
   * Move delivery to dead letter queue
   */
  private async moveToDeadLetter(deliveryId: string, reason: string): Promise<void> {
    await db
      .update(webhookDeliveries)
      .set({
        status: "dead_letter",
        errorMessage: reason,
      })
      .where(eq(webhookDeliveries.id, deliveryId));

    console.warn(`[Webhook] Moved delivery ${deliveryId} to dead letter queue: ${reason}`);
  }

  /**
   * Generate HMAC signature for webhook verification
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac("sha256", secret).update(payload).digest("hex");
  }

  /**
   * Verify webhook signature (for testing endpoints)
   */
  public verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }
}

export const webhookService = new WebhookService();

// Start background processor
setInterval(() => {
  webhookService.processPendingDeliveries().catch(console.error);
}, 10000); // Process every 10 seconds
```

### Step 3: Integrate with Inventory Events (15 min)

```typescript
// server/inventory.ts

// After optimization completes
export async function optimizeInventoryLevels(...) {
  // ... existing optimization logic ...

  // Trigger webhooks for critical items
  const criticalItems = results.filter(r => r.recommendation === 'critical_reorder');

  for (const item of criticalItems) {
    await webhookService.queueEvent(orgId, 'inventory.critical_stock', {
      partNo: item.partNo,
      partName: item.partName,
      currentStock: item.currentStock,
      reorderPoint: item.reorderPoint,
      economicOrderQuantity: item.economicOrderQuantity,
      urgency: 'critical',
      estimatedDaysUntilStockout: Math.floor(
        item.currentStock / (item.averageUsagePerMonth / 30)
      ),
    });
  }

  // Webhook for optimization complete
  await webhookService.queueEvent(orgId, 'inventory.optimization_complete', {
    partsOptimized: results.length,
    criticalCount: criticalItems.length,
    totalPotentialSavings: results.reduce((sum, r) => sum + (r.potentialSavings || 0), 0),
    timestamp: new Date().toISOString(),
  });

  return results;
}

// After supplier evaluation
export async function evaluateSupplierPerformance(...) {
  // ... existing evaluation logic ...

  // Trigger webhook for poor performers
  const poorPerformers = results.filter(r => r.performanceScore < 60);

  for (const supplier of poorPerformers) {
    await webhookService.queueEvent(orgId, 'supplier.performance_degraded', {
      supplierId: supplier.supplierId,
      supplierName: supplier.name,
      performanceScore: supplier.performanceScore,
      onTimeRate: supplier.onTimeRate,
      qualityRate: supplier.qualityRate,
      previousScore: null, // TODO: Track historical scores
    });
  }

  return results;
}
```

### Step 4: Management API Endpoints (30 min)

```typescript
// server/routes.ts

/**
 * GET /api/webhooks
 * List all webhook configurations for organization
 */
app.get("/api/webhooks", requireOrgId, async (req: Request, res: Response) => {
  const orgId = (req as AuthRequest).orgId;

  const webhooks = await db
    .select()
    .from(webhookConfigurations)
    .where(eq(webhookConfigurations.orgId, orgId))
    .orderBy(desc(webhookConfigurations.createdAt));

  res.json(webhooks);
});

/**
 * POST /api/webhooks
 * Create new webhook configuration
 */
app.post("/api/webhooks", requireOrgId, async (req: Request, res: Response) => {
  const orgId = (req as AuthRequest).orgId;

  const schema = z.object({
    name: z.string().min(1).max(100),
    url: z.string().url(),
    events: z
      .array(
        z.enum([
          "inventory.critical_stock",
          "inventory.reorder_point",
          "inventory.optimization_complete",
          "supplier.performance_degraded",
          "parts.substitution_created",
        ])
      )
      .min(1),
    headers: z.record(z.string()).optional(),
  });

  const validated = schema.parse(req.body);

  // Generate secure secret
  const secret = crypto.randomBytes(32).toString("hex");

  const webhook = await db
    .insert(webhookConfigurations)
    .values({
      id: randomUUID(),
      orgId,
      ...validated,
      secret,
      isActive: true,
    })
    .returning();

  res.status(201).json(webhook[0]);
});

/**
 * POST /api/webhooks/:id/test
 * Send test event to webhook
 */
app.post("/api/webhooks/:id/test", requireOrgId, async (req: Request, res: Response) => {
  const orgId = (req as AuthRequest).orgId;
  const webhookId = req.params.id;

  await webhookService.queueEvent(orgId, "inventory.test_event", {
    message: "This is a test webhook event",
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, message: "Test event queued" });
});

/**
 * GET /api/webhooks/:id/deliveries
 * Get delivery history for webhook
 */
app.get("/api/webhooks/:id/deliveries", requireOrgId, async (req: Request, res: Response) => {
  const webhookId = req.params.id;

  const deliveries = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhookId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(100);

  res.json(deliveries);
});

/**
 * POST /api/webhooks/:id/retry-failed
 * Retry all failed deliveries for webhook
 */
app.post("/api/webhooks/:id/retry-failed", requireOrgId, async (req: Request, res: Response) => {
  const webhookId = req.params.id;

  const updated = await db
    .update(webhookDeliveries)
    .set({ status: "pending", attempts: 0 })
    .where(
      and(eq(webhookDeliveries.webhookId, webhookId), eq(webhookDeliveries.status, "dead_letter"))
    )
    .returning();

  res.json({ retriedCount: updated.length });
});
```

---

## Example Webhook Payloads

### Critical Stock Alert

```json
{
  "eventType": "inventory.critical_stock",
  "eventId": "evt_abc123",
  "timestamp": "2025-11-06T12:00:00Z",
  "data": {
    "partNo": "PUMP-100",
    "partName": "Hydraulic Pump Type A",
    "currentStock": 1,
    "reorderPoint": 3,
    "economicOrderQuantity": 5,
    "urgency": "critical",
    "estimatedDaysUntilStockout": 15
  }
}
```

### Supplier Performance Degraded

```json
{
  "eventType": "supplier.performance_degraded",
  "eventId": "evt_def456",
  "timestamp": "2025-11-06T12:00:00Z",
  "data": {
    "supplierId": "uuid",
    "supplierName": "Acme Parts Co",
    "performanceScore": 55,
    "onTimeRate": 60,
    "qualityRate": 70,
    "previousScore": 85
  }
}
```

---

## Testing

### Unit Tests

```typescript
describe("WebhookService", () => {
  test("should generate valid HMAC signature", () => {
    const payload = '{"test":"data"}';
    const secret = "my-secret-key";
    const signature = webhookService.generateSignature(payload, secret);

    expect(webhookService.verifySignature(payload, signature, secret)).toBe(true);
  });

  test("should queue webhook events", async () => {
    await webhookService.queueEvent("org-1", "inventory.critical_stock", {
      partNo: "PUMP-100",
    });

    const deliveries = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.eventType, "inventory.critical_stock"));

    expect(deliveries).toHaveLength(1);
  });
});
```

### Integration Tests

```typescript
describe("Webhook Integration", () => {
  test("should trigger webhook on critical stock", async () => {
    // Mock webhook endpoint
    const mockServer = startMockServer();

    // Create webhook
    await request(app)
      .post("/api/webhooks")
      .set("x-org-id", "test-org")
      .send({
        name: "Test Webhook",
        url: `http://localhost:${mockServer.port}/webhook`,
        events: ["inventory.critical_stock"],
      });

    // Trigger optimization that finds critical stock
    await request(app).post("/api/inventory/optimize").set("x-org-id", "test-org").send({
      /* ... payload with critical part ... */
    });

    // Wait for webhook delivery
    await sleep(2000);

    // Verify webhook was called
    expect(mockServer.requests).toHaveLength(1);
    expect(mockServer.requests[0].body.eventType).toBe("inventory.critical_stock");
  });
});
```

---

## Rollout Plan

**Week 1**: Infrastructure setup

- Deploy webhook schema and service
- Create management UI (optional)
- Test with internal webhook endpoint

**Week 2**: Beta testing

- Enable for 3-5 pilot organizations
- Monitor delivery success rate
- Gather feedback on payload structure

**Week 3**: General availability

- Document webhook integration guide
- Enable for all organizations
- Provide example integrations (Slack, Zapier, etc.)

---

## Integration Examples

### Slack Integration

```javascript
// Example: Forward critical stock alerts to Slack
app.post("/webhook/inventory", (req, res) => {
  const { eventType, data } = req.body;

  if (eventType === "inventory.critical_stock") {
    fetch("https://hooks.slack.com/services/YOUR/WEBHOOK/URL", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🚨 Critical Stock Alert`,
        attachments: [
          {
            color: "danger",
            fields: [
              { title: "Part", value: data.partName, short: true },
              { title: "Current Stock", value: data.currentStock, short: true },
              { title: "Reorder Point", value: data.reorderPoint, short: true },
              { title: "Days Until Stockout", value: data.estimatedDaysUntilStockout, short: true },
            ],
          },
        ],
      }),
    });
  }

  res.json({ received: true });
});
```

### Auto-Create Purchase Orders

```javascript
// Example: Automatically create PO when critical stock detected
app.post("/webhook/inventory", async (req, res) => {
  const { eventType, data } = req.body;

  if (eventType === "inventory.critical_stock") {
    // Call your ERP system to create PO
    await createPurchaseOrder({
      supplierId: data.primarySupplierId,
      items: [
        {
          partNo: data.partNo,
          quantity: data.economicOrderQuantity,
        },
      ],
      priority: "urgent",
    });
  }

  res.json({ received: true });
});
```

---

## Security Considerations

1. **HMAC Verification**: All webhook receivers should verify signatures
2. **HTTPS Only**: Enforce HTTPS for webhook URLs in production
3. **Rate Limiting**: Limit webhook deliveries per organization
4. **Payload Size**: Cap payload size at 100KB
5. **Secret Rotation**: Support secret rotation without downtime

---

## Monitoring

**Metrics to Track**:

- Delivery success rate per webhook
- Average delivery latency
- Dead letter queue size
- Event volume by type

**Alerts**:

- Delivery success rate < 95%
- Dead letter queue > 100 items
- Webhook timeout rate > 10%
