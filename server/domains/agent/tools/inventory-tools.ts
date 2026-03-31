import { db } from "../../../db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { registerTool } from "./registry";

registerTool({
  name: "getInventoryStatus",
  description: "Get inventory and parts status summary.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  inputSchema: z.object({}),
  requiresApproval: false,
  async execute(_input: any, ctx) {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as total_parts,
               COALESCE(SUM(CASE WHEN quantity_on_hand <= min_stock_level THEN 1 ELSE 0 END), 0) as low_stock_count
        FROM parts_inventory
        WHERE org_id = ${ctx.orgId}
      `);
      const row = (result as any).rows?.[0] || {};
      return {
        totalParts: Number(row.total_parts || 0),
        lowStockCount: Number(row.low_stock_count || 0),
      };
    } catch {
      return { note: "Inventory data unavailable or table does not exist yet" };
    }
  },
});
