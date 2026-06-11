import { and, eq } from "drizzle-orm";

import { db } from "../../db";
import { createLogger } from "../../lib/structured-logger";
import { equipment } from "@shared/schema";

const logger = createLogger("shipmate-import");

export async function syncShipmateRunningHours(
  orgId: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  let synced = 0;
  for (const row of rows) {
    const id = row["id"] as string;
    const hours = row["runningHours"] as number;
    if (!id || hours == null) {
      continue;
    }

    try {
      await db
        .update(equipment)
        .set({ runningHours: hours, updatedAt: new Date() } as object as never)
        .where(and(eq(equipment.id, id), eq(equipment.orgId, orgId)));
      synced++;
    } catch {
      // Non-fatal
    }
  }
  if (synced > 0) {
    logger.info("Running hours synced from SHIPMATE", { orgId, count: synced });
  }
}
