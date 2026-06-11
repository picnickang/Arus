# STEP 2: Actionable Insights Pipeline - Architecture Design

**Date:** November 24, 2025  
**Status:** Design Phase  
**Objective:** Design end-to-end pipeline from ML predictions to operator actions

---

## 🎯 DESIGN GOALS

1. **Lightweight Integration:** Minimal disruption to existing systems
2. **Dual-Mode Compatible:** Works in cloud (PostgreSQL) and vessel (SQLite) modes
3. **Rule-Based:** Simple JSON-configurable rules, no complex AI
4. **Operator-Friendly:** Plain language, actionable recommendations
5. **Tenant-Isolated:** Respects multi-tenant architecture (org_id)

---

## 🏗️ END-TO-END PIPELINE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DATA SOURCES (Existing Systems)                             │
├─────────────────────────────────────────────────────────────────┤
│ • Telemetry Ingestion  → EquipmentTelemetry DB                 │
│ • RUL Engine           → FailurePredictions DB                 │
│ • ML Prediction        → MLPredictions (in-memory/DB)          │
│ • Alert System         → AlertNotifications DB                 │
│ • Sensor Quality       → SensorMappings + Telemetry gaps       │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. TRIGGER EVENTS (New Integration Points)                     │
├─────────────────────────────────────────────────────────────────┤
│ Event 1: After RUL calculation                                 │
│   → rul-engine.ts: calculateRul() → insightEngine.evaluate()  │
│                                                                 │
│ Event 2: After ML prediction                                   │
│   → ml-prediction-service.ts → insightEngine.evaluate()       │
│                                                                 │
│ Event 3: After alert created                                   │
│   → alerts/service.ts → insightEngine.createFromAlert()       │
│                                                                 │
│ Event 4: Scheduled evaluation (cron)                           │
│   → Every hour → insightEngine.evaluateAll(orgId)             │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. INSIGHT ENGINE (NEW - Core Logic)                           │
├─────────────────────────────────────────────────────────────────┤
│ server/core/insights/insightEngine.ts                          │
│                                                                 │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ Rule Evaluation Engine                                    │ │
│ │ • Load rules from JSON config                            │ │
│ │ │• Apply rules to equipment                                │ │
│ │ • Multi-signal fusion (RUL + trends + quality)           │ │
│ └───────────────────────────────────────────────────────────┘ │
│                       ↓                                         │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ Insight Generator                                         │ │
│ │ • Create structured insight objects                       │ │
│ │ • Attach supporting signals                              │ │
│ │ • Generate recommended actions                            │ │
│ │ • Estimate work duration/parts                            │ │
│ └───────────────────────────────────────────────────────────┘ │
│                       ↓                                         │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ Knowledge Base Integration (Optional)                     │ │
│ │ • Fetch relevant procedures via vector search            │ │
│ │ • Enrich recommended actions                              │ │
│ └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. DATABASE PERSISTENCE (NEW TABLE)                            │
├─────────────────────────────────────────────────────────────────┤
│ actionable_insights (PostgreSQL + SQLite)                      │
│ • id, equipmentId, orgId, vesselId                            │
│ • type, severity, title, message                               │
│ • supportingSignals (JSONB)                                    │
│ • recommendedAction (JSONB)                                    │
│ • acknowledged, acknowledgedAt, acknowledgedBy                 │
│ • resolved, resolvedAt, resolvedBy                             │
│ • createdAt, updatedAt                                         │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. NOTIFICATION LAYER (Leverage Existing)                      │
├─────────────────────────────────────────────────────────────────┤
│ • WebSocket broadcast → Real-time UI update                   │
│ • MQTT sync → Vessel/cloud sync                                │
│ • Email/SMS (optional) → Critical insights                     │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. REST API ENDPOINTS (NEW)                                    │
├─────────────────────────────────────────────────────────────────┤
│ GET    /api/insights?severity=&status=&equipmentId=           │
│ GET    /api/insights/:id                                       │
│ POST   /api/insights/:id/acknowledge                           │
│ POST   /api/insights/:id/schedule-maintenance                  │
│ POST   /api/insights/:id/dismiss                               │
│ DELETE /api/insights/:id                                       │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. FRONTEND UI (NEW COMPONENT)                                 │
├─────────────────────────────────────────────────────────────────┤
│ client/src/components/ActionableInsightsPanel.tsx             │
│                                                                 │
│ • Displays insights sorted by severity                         │
│ • Filters: severity, status, vessel, equipment                 │
│ • Action buttons:                                               │
│   - [Schedule Maintenance] → Creates work order               │
│   - [Add to Watchlist] → Adds to monitoring                   │
│   - [Dismiss] → Marks as acknowledged                          │
│                                                                 │
│ Integration points:                                             │
│ • Dashboard (overview panel)                                   │
│ • Equipment Detail Page (equipment-specific insights)          │
│ • Dedicated /insights page                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 DATABASE SCHEMA DESIGN

### PostgreSQL Schema (shared/schema.ts)

```typescript
import { pgTable, varchar, text, boolean, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const actionableInsights = pgTable("actionable_insights", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  equipmentId: varchar("equipment_id")
    .notNull()
    .references(() => equipment.id),
  vesselId: varchar("vessel_id").references(() => vessels.id),

  // Insight classification
  type: varchar("type").notNull(), // "impending_failure", "degrading_health", "sensor_quality", "maintenance_overdue"
  severity: varchar("severity").notNull(), // "low", "medium", "high", "critical"

  // Content
  title: varchar("title").notNull(), // "Impending Bearing Failure Detected"
  message: text("message").notNull(), // Plain-language explanation

  // Supporting data (JSONB for flexibility)
  supportingSignals: jsonb("supporting_signals"), // { rulDays: 6, vibrationTrend: 52, sensorQuality: 0.6 }

  // Recommended action (JSONB)
  recommendedAction: jsonb("recommended_action"), // { type: "schedule_maintenance", description: "...", parts: [...] }

  // Knowledge base enrichment
  relatedProcedures: jsonb("related_procedures"), // [{ id: "...", title: "...", url: "..." }]

  // Status tracking
  acknowledged: boolean("acknowledged").default(false),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: varchar("acknowledged_by"), // User ID

  resolved: boolean("resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"),
  resolutionNotes: text("resolution_notes"),

  // Work order linkage (optional)
  workOrderId: varchar("work_order_id").references(() => workOrders.id),

  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod schemas
export const insertActionableInsightSchema = createInsertSchema(actionableInsights).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectActionableInsightSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  equipmentId: z.string(),
  vesselId: z.string().nullable(),
  type: z.string(),
  severity: z.string(),
  title: z.string(),
  message: z.string(),
  supportingSignals: z.any(),
  recommendedAction: z.any(),
  relatedProcedures: z.any(),
  acknowledged: z.boolean(),
  acknowledgedAt: z.date().nullable(),
  acknowledgedBy: z.string().nullable(),
  resolved: z.boolean(),
  resolvedAt: z.date().nullable(),
  resolvedBy: z.string().nullable(),
  resolutionNotes: z.string().nullable(),
  workOrderId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ActionableInsight = z.infer<typeof selectActionableInsightSchema>;
export type InsertActionableInsight = z.infer<typeof insertActionableInsightSchema>;
```

### SQLite Schema (shared/schema-sqlite-vessel.ts)

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const actionableInsights = sqliteTable("actionable_insights", {
  id: text("id").primaryKey(), // UUID string
  org_id: text("org_id").notNull(),
  equipment_id: text("equipment_id").notNull(),
  vessel_id: text("vessel_id"),

  type: text("type").notNull(),
  severity: text("severity").notNull(),

  title: text("title").notNull(),
  message: text("message").notNull(),

  supporting_signals: text("supporting_signals"), // JSON string
  recommended_action: text("recommended_action"), // JSON string
  related_procedures: text("related_procedures"), // JSON string

  acknowledged: integer("acknowledged").default(0), // Boolean as 0/1
  acknowledged_at: integer("acknowledged_at"), // Unix timestamp
  acknowledged_by: text("acknowledged_by"),

  resolved: integer("resolved").default(0),
  resolved_at: integer("resolved_at"),
  resolved_by: text("resolved_by"),
  resolution_notes: text("resolution_notes"),

  work_order_id: text("work_order_id"),

  created_at: integer("created_at").notNull(), // Unix timestamp
  updated_at: integer("updated_at").notNull(),
});
```

---

## 🎯 INSIGHT TYPES & RULES

### Insight Type 1: **Impending Failure**

**Trigger Rule:**

```json
{
  "type": "impending_failure",
  "conditions": {
    "all": [
      { "field": "rulDays", "operator": "<", "value": 7 },
      { "field": "failureProbability", "operator": ">", "value": 0.7 }
    ],
    "any": [
      { "field": "vibrationTrend48h", "operator": ">", "value": 30 },
      { "field": "temperatureTrend48h", "operator": ">", "value": 20 },
      { "field": "sensorQuality", "operator": "<", "value": 0.8 }
    ]
  },
  "severity": "critical",
  "title": "Impending ${componentType} Failure Detected",
  "message": "Multiple failure indicators suggest ${componentType} replacement needed within ${rulDays} days",
  "recommendedAction": {
    "type": "schedule_maintenance",
    "description": "Schedule ${componentType} replacement within ${Math.ceil(rulDays * 0.5)} days",
    "priority": "high"
  }
}
```

### Insight Type 2: **Degrading Health**

**Trigger Rule:**

```json
{
  "type": "degrading_health",
  "conditions": {
    "all": [
      { "field": "healthScore", "operator": "<", "value": 70 },
      { "field": "healthScoreTrend7d", "operator": "<", "value": -10 }
    ]
  },
  "severity": "medium",
  "title": "Equipment Health Declining",
  "message": "Health score dropped ${Math.abs(healthScoreTrend7d)}% over the past week",
  "recommendedAction": {
    "type": "add_to_watchlist",
    "description": "Monitor daily for further degradation"
  }
}
```

### Insight Type 3: **Sensor Quality Issue**

**Trigger Rule:**

```json
{
  "type": "sensor_quality",
  "conditions": {
    "any": [
      { "field": "sensorQuality", "operator": "<", "value": 0.6 },
      { "field": "missingReadings24h", "operator": ">", "value": 10 }
    ]
  },
  "severity": "low",
  "title": "Sensor Quality Degraded",
  "message": "Missing ${missingReadings24h} sensor readings in past 24 hours",
  "recommendedAction": {
    "type": "inspect_sensor",
    "description": "Inspect ${sensorType} sensor for ${equipmentName}"
  }
}
```

### Insight Type 4: **Maintenance Overdue**

**Trigger Rule:**

```json
{
  "type": "maintenance_overdue",
  "conditions": {
    "all": [
      { "field": "daysSinceLastMaintenance", "operator": ">", "value": 90 },
      { "field": "operatingHours", "operator": ">", "value": 2000 }
    ]
  },
  "severity": "medium",
  "title": "Scheduled Maintenance Overdue",
  "message": "Last maintenance was ${daysSinceLastMaintenance} days ago (recommended: 90 days)",
  "recommendedAction": {
    "type": "schedule_maintenance",
    "description": "Schedule routine maintenance inspection"
  }
}
```

### Insight Type 5: **Anomaly Detected**

**Trigger Rule:**

```json
{
  "type": "anomaly_detected",
  "conditions": {
    "all": [
      { "field": "anomalyScore", "operator": ">", "value": 0.8 },
      { "field": "consecutiveAnomalies", "operator": ">", "value": 3 }
    ]
  },
  "severity": "high",
  "title": "Unusual Operating Patterns Detected",
  "message": "Equipment operating outside normal parameters for ${consecutiveAnomalies} consecutive measurements",
  "recommendedAction": {
    "type": "investigate",
    "description": "Investigate cause of anomalous behavior"
  }
}
```

---

## 🔧 INSIGHT ENGINE CORE LOGIC

### File: `server/core/insights/insightEngine.ts`

```typescript
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db";
import { actionableInsights } from "@shared/schema-runtime";
import type { RulPrediction } from "../../rul-engine";
import type { MLPredictionResult } from "../../ml-prediction-service";

// Rule engine configuration
interface InsightRule {
  type: string;
  conditions: {
    all?: Condition[];
    any?: Condition[];
  };
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  recommendedAction: RecommendedAction;
}

interface Condition {
  field: string;
  operator: "<" | ">" | "=" | "!=";
  value: number | string | boolean;
}

interface RecommendedAction {
  type: "schedule_maintenance" | "add_to_watchlist" | "inspect_sensor" | "investigate";
  description: string;
  priority?: "low" | "medium" | "high";
  estimatedDuration?: string;
  requiredParts?: string[];
  requiredTechnicians?: number;
}

export class InsightEngine {
  constructor(private db: any) {}

  /**
   * Evaluate equipment and generate insights based on RUL prediction
   */
  async evaluateEquipment(
    equipmentId: string,
    orgId: string,
    rulPrediction: RulPrediction
  ): Promise<void> {
    // Extract signals from RUL prediction
    const signals = {
      rulDays: rulPrediction.remainingDays,
      failureProbability: rulPrediction.failureProbability,
      healthScore: rulPrediction.healthIndex,
      vibrationTrend48h: await this.calculateTrend(equipmentId, "vibration", "48h"),
      temperatureTrend48h: await this.calculateTrend(equipmentId, "temperature", "48h"),
      sensorQuality: await this.calculateSensorQuality(equipmentId),
    };

    // Load rules from configuration
    const rules = await this.loadRules();

    // Evaluate each rule
    for (const rule of rules) {
      if (this.evaluateRule(rule, signals)) {
        await this.createInsight(equipmentId, orgId, rule, signals);
      }
    }
  }

  /**
   * Check if rule conditions are satisfied
   */
  private evaluateRule(rule: InsightRule, signals: Record<string, any>): boolean {
    const allConditionsMet = rule.conditions.all
      ? rule.conditions.all.every((cond) => this.evaluateCondition(cond, signals))
      : true;

    const anyConditionMet = rule.conditions.any
      ? rule.conditions.any.some((cond) => this.evaluateCondition(cond, signals))
      : true;

    return allConditionsMet && anyConditionMet;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: Condition, signals: Record<string, any>): boolean {
    const value = signals[condition.field];
    if (value === undefined) return false;

    switch (condition.operator) {
      case "<":
        return value < condition.value;
      case ">":
        return value > condition.value;
      case "=":
        return value === condition.value;
      case "!=":
        return value !== condition.value;
      default:
        return false;
    }
  }

  /**
   * Create insight in database
   */
  private async createInsight(
    equipmentId: string,
    orgId: string,
    rule: InsightRule,
    signals: Record<string, any>
  ): Promise<void> {
    // Check if insight already exists (avoid duplicates)
    const existing = await this.db
      .select()
      .from(actionableInsights)
      .where(
        and(
          eq(actionableInsights.equipmentId, equipmentId),
          eq(actionableInsights.type, rule.type),
          eq(actionableInsights.resolved, false)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return; // Insight already exists
    }

    // Get equipment and vessel info
    const equipment = await this.db.query.equipment.findFirst({
      where: eq(equipment.id, equipmentId),
    });

    // Create new insight
    await this.db.insert(actionableInsights).values({
      orgId,
      equipmentId,
      vesselId: equipment?.vesselId || null,
      type: rule.type,
      severity: rule.severity,
      title: this.interpolate(rule.title, signals),
      message: this.interpolate(rule.message, signals),
      supportingSignals: signals,
      recommendedAction: rule.recommendedAction,
      acknowledged: false,
      resolved: false,
    });

    // Notify via WebSocket (leverage existing system)
    // await this.notifyInsightCreated(equipmentId, orgId);
  }

  /**
   * Helper: Interpolate template strings with signal values
   */
  private interpolate(template: string, signals: Record<string, any>): string {
    return template.replace(/\${(\w+)}/g, (match, key) => {
      return signals[key]?.toString() || match;
    });
  }

  /**
   * Calculate trend over time window
   */
  private async calculateTrend(
    equipmentId: string,
    sensorType: string,
    window: "24h" | "48h" | "7d"
  ): Promise<number> {
    const hours = window === "24h" ? 24 : window === "48h" ? 48 : 168;
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const readings = await this.db
      .select()
      .from(equipmentTelemetry)
      .where(
        and(
          eq(equipmentTelemetry.equipmentId, equipmentId),
          eq(equipmentTelemetry.sensorType, sensorType),
          sql`${equipmentTelemetry.ts} >= ${cutoff}`
        )
      )
      .orderBy(equipmentTelemetry.ts);

    if (readings.length < 2) return 0;

    const first = readings[0].value;
    const last = readings[readings.length - 1].value;
    const percentChange = ((last - first) / first) * 100;

    return percentChange;
  }

  /**
   * Calculate sensor quality score
   */
  private async calculateSensorQuality(equipmentId: string): Promise<number> {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const totalReadings = await this.db
      .select({ count: sql`count(*)` })
      .from(equipmentTelemetry)
      .where(
        and(
          eq(equipmentTelemetry.equipmentId, equipmentId),
          sql`${equipmentTelemetry.ts} >= ${last24h}`
        )
      );

    const expectedReadings = (24 * 60) / 5; // 5-minute intervals = 288 readings per day
    const actualReadings = totalReadings[0]?.count || 0;
    const quality = Math.min(actualReadings / expectedReadings, 1);

    return quality;
  }

  /**
   * Load insight rules from configuration
   */
  private async loadRules(): Promise<InsightRule[]> {
    // For MVP, hardcode rules
    // Later: Load from database or JSON file
    return [
      {
        type: "impending_failure",
        conditions: {
          all: [
            { field: "rulDays", operator: "<", value: 7 },
            { field: "failureProbability", operator: ">", value: 0.7 },
          ],
          any: [
            { field: "vibrationTrend48h", operator: ">", value: 30 },
            { field: "sensorQuality", operator: "<", value: 0.8 },
          ],
        },
        severity: "critical",
        title: "Impending Equipment Failure Detected",
        message: "Multiple failure indicators suggest maintenance needed within ${rulDays} days",
        recommendedAction: {
          type: "schedule_maintenance",
          description: "Schedule preventive maintenance within 3 days",
          priority: "high",
          estimatedDuration: "8-12 hours",
          requiredTechnicians: 2,
        },
      },
      // Additional rules...
    ];
  }
}

// Export singleton instance
export const insightEngine = new InsightEngine(db);
```

---

## 🔗 INTEGRATION POINTS

### 1. RUL Engine Integration

**File:** `server/rul-engine.ts` (line ~150)

```typescript
async calculateRul(equipmentId: string, orgId: string): Promise<RulPrediction | null> {
  // ... existing RUL calculation logic ...

  // ✅ NEW: Evaluate insights after RUL calculated
  if (rulPrediction) {
    await insightEngine.evaluateEquipment(equipmentId, orgId, rulPrediction);
  }

  return rulPrediction;
}
```

### 2. ML Prediction Integration

**File:** `server/ml-prediction-service.ts` (line ~400)

```typescript
async predict(equipmentId: string, orgId: string): Promise<MLPredictionResult> {
  // ... existing prediction logic ...

  // ✅ NEW: Evaluate insights after ML prediction
  if (prediction.failureProbability > 0.5) {
    await insightEngine.evaluateEquipment(equipmentId, orgId, prediction);
  }

  return prediction;
}
```

### 3. Scheduled Evaluation (New Cron Job)

**File:** `server/cron-jobs/insight-evaluation.ts` (NEW)

```typescript
import cron from "node-cron";
import { insightEngine } from "../core/insights/insightEngine";
import { storage } from "../storage";

// Run every hour
cron.schedule("0 * * * *", async () => {
  console.log("[Insight Cron] Running scheduled insight evaluation");

  try {
    // Get all organizations
    const orgs = await storage.getOrganizations();

    for (const org of orgs) {
      // Get all active equipment for org
      const equipment = await storage.getEquipmentRegistry(org.id);

      // Evaluate each equipment
      for (const eq of equipment) {
        if (eq.isActive) {
          await insightEngine.evaluateEquipment(eq.id, org.id);
        }
      }
    }

    console.log("[Insight Cron] Evaluation complete");
  } catch (error) {
    console.error("[Insight Cron] Error:", error);
  }
});
```

---

## 🌐 API DESIGN

### Endpoint: `GET /api/insights`

**Query Parameters:**

- `severity`: Filter by severity (low, medium, high, critical)
- `status`: Filter by status (open, acknowledged, resolved)
- `equipmentId`: Filter by equipment
- `vesselId`: Filter by vessel
- `type`: Filter by insight type

**Response:**

```json
{
  "insights": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "equipmentId": "main-engine-1",
      "equipmentName": "Main Engine #1",
      "vesselId": "vessel-123",
      "vesselName": "Pacific Explorer",
      "type": "impending_failure",
      "severity": "critical",
      "title": "Impending Bearing Failure Detected",
      "message": "Multiple failure indicators suggest bearing replacement needed within 6 days",
      "supportingSignals": {
        "rulDays": 6,
        "failureProbability": 0.87,
        "vibrationTrend48h": 52,
        "sensorQuality": 0.6
      },
      "recommendedAction": {
        "type": "schedule_maintenance",
        "description": "Schedule bearing replacement within 3 days",
        "priority": "high",
        "estimatedDuration": "8-12 hours",
        "requiredTechnicians": 2
      },
      "acknowledged": false,
      "resolved": false,
      "createdAt": "2025-11-24T14:30:00Z"
    }
  ],
  "count": 1
}
```

### Endpoint: `POST /api/insights/:id/acknowledge`

**Request Body:**

```json
{
  "notes": "Reviewed and scheduled for next port arrival"
}
```

**Response:**

```json
{
  "success": true,
  "insight": { ... }
}
```

### Endpoint: `POST /api/insights/:id/schedule-maintenance`

**Request Body:**

```json
{
  "scheduledDate": "2025-11-27T10:00:00Z",
  "notes": "Scheduled for port arrival in Singapore"
}
```

**Actions Performed:**

1. Create work order with details from `recommendedAction`
2. Reserve parts from inventory (if specified)
3. Notify shore-side coordinator via email/MQTT
4. Mark insight as acknowledged
5. Link work order to insight

**Response:**

```json
{
  "success": true,
  "workOrder": { ... },
  "insight": { ... }
}
```

---

## 🎨 FRONTEND UI DESIGN

### Component: `ActionableInsightsPanel.tsx`

```tsx
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle, Clock, Wrench } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function ActionableInsightsPanel({ equipmentId }: { equipmentId?: string }) {
  const { toast } = useToast();
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");

  const { data: insights, isLoading } = useQuery({
    queryKey: ["/api/insights", { equipmentId, severity: severityFilter, status: statusFilter }],
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (insightId: string) =>
      apiRequest(`/api/insights/${insightId}/acknowledge`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Insight acknowledged" });
      queryClient.invalidateQueries({ queryKey: ["/api/insights"] });
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: (insightId: string) =>
      apiRequest(`/api/insights/${insightId}/schedule-maintenance`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Maintenance scheduled successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/insights"] });
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "warning";
      case "low":
        return "default";
      default:
        return "default";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Actionable Insights</CardTitle>
          <div className="flex gap-2">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div>Loading insights...</div>
        ) : insights?.insights.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
            <p>No actionable insights at this time</p>
          </div>
        ) : (
          <div className="space-y-4">
            {insights?.insights.map((insight: any) => (
              <Alert key={insight.id} variant={getSeverityColor(insight.severity)}>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="flex items-center gap-2">
                  {insight.title}
                  <Badge variant={getSeverityColor(insight.severity)}>
                    {insight.severity.toUpperCase()}
                  </Badge>
                </AlertTitle>
                <AlertDescription>
                  <div className="space-y-3 mt-2">
                    {/* Message */}
                    <p>{insight.message}</p>

                    {/* Supporting signals */}
                    <div className="bg-muted p-3 rounded text-sm">
                      <p className="font-semibold mb-1">⚠️ Indicators:</p>
                      <ul className="list-disc ml-4 space-y-1">
                        {insight.supportingSignals.rulDays && (
                          <li>RUL: {insight.supportingSignals.rulDays} days</li>
                        )}
                        {insight.supportingSignals.vibrationTrend48h && (
                          <li>Vibration trend: +{insight.supportingSignals.vibrationTrend48h}%</li>
                        )}
                        {insight.supportingSignals.sensorQuality && (
                          <li>
                            Sensor quality:{" "}
                            {(insight.supportingSignals.sensorQuality * 100).toFixed(0)}%
                          </li>
                        )}
                      </ul>
                    </div>

                    {/* Recommended action */}
                    <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded">
                      <p className="font-semibold mb-1">📋 Recommended Action:</p>
                      <p>{insight.recommendedAction.description}</p>
                      {insight.recommendedAction.estimatedDuration && (
                        <p className="text-sm mt-1">
                          <Clock className="inline h-3 w-3 mr-1" />
                          Duration: {insight.recommendedAction.estimatedDuration}
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => scheduleMutation.mutate(insight.id)}
                        disabled={insight.acknowledged}
                        data-testid="button-schedule-maintenance"
                      >
                        <Wrench className="h-4 w-4 mr-2" />
                        Schedule Maintenance
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => acknowledgeMutation.mutate(insight.id)}
                        disabled={insight.acknowledged}
                        data-testid="button-acknowledge"
                      >
                        Acknowledge
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## ✅ SUMMARY

This design provides:

1. **Lightweight Integration:** Minimal changes to existing systems
2. **Rule-Based Logic:** Simple JSON-configurable rules
3. **Dual-Mode Support:** Works in both PostgreSQL and SQLite
4. **Operator-Friendly UI:** Plain language, one-click actions
5. **Tenant-Isolated:** Respects multi-tenant architecture
6. **Extensible:** Easy to add new insight types and rules

**Next Step:** Implement the design (Step 3)
