import { db } from "../../../db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { registerTool } from "./registry";

registerTool({
  name: "getInventoryStatus",
  category: "inventory",
  description: "Get inventory and parts status summary.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  inputSchema: z.object({}),
  requiresApproval: false,
  async execute(_input: Record<string, unknown>, ctx) {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as total_parts,
               COALESCE(SUM(CASE WHEN quantity_on_hand <= min_stock_level THEN 1 ELSE 0 END), 0) as low_stock_count
        FROM parts_inventory
        WHERE org_id = ${ctx.orgId}
      `);
      const rows = (result as { rows?: Array<Record<string, unknown>> }).rows || [];
      const row = rows[0] || {};
      return {
        totalParts: Number(row.total_parts || 0),
        lowStockCount: Number(row.low_stock_count || 0),
      };
    } catch (err) {
      console.warn("[Agent] Inventory query failed:", err instanceof Error ? err.message : "unknown");
      return { note: "Inventory data unavailable or table does not exist yet" };
    }
  },
});
