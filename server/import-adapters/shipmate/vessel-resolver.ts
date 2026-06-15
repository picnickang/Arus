import { and, eq, sql } from "drizzle-orm";

import { vessels } from "@shared/schema-runtime";
import type { db as shipmateDb } from "../../db";
import { VesselResolutionError } from "./types";

// ============================================================================
// Vessel name → ID resolver (no cache — correctness over speed)
// ============================================================================
//
// The previous implementation cached by name. We've removed the cache to
// keep the resolution logic simple and because:
//   - Imports are slow anyway (I/O bound); a few extra SELECTs don't matter
//   - Cached bugs are the worst kind of bugs; a stale cache would silently
//     attach data to a renamed/deleted vessel
// If this becomes a real performance issue, add a per-import cache scoped
// to the importFile() call, not a process-wide cache.
// ============================================================================

type ShipmateDatabase = typeof shipmateDb;

export async function resolveVesselId(
  database: ShipmateDatabase,
  orgId: string,
  vesselName?: string,
  vesselId?: string
): Promise<string | null> {
  // Explicit vessel ID wins — caller took responsibility.
  if (vesselId) {
    return vesselId;
  }

  // No name supplied → no resolution possible. Not an error; some
  // imports legitimately have no vessel scope.
  if (!vesselName) {
    return null;
  }

  const trimmedName = vesselName.trim();
  if (!trimmedName) {
    return null;
  }

  // EXACT case-insensitive match only. No LIKE, no partial, no substring.
  const matches = await database
    .select({ id: vessels.id, name: vessels.name })
    .from(vessels)
    .where(and(eq(vessels.orgId, orgId), sql`LOWER(${vessels.name}) = LOWER(${trimmedName})`));

  if (matches.length === 1 && matches[0]) {
    return matches[0].id;
  }

  if (matches.length === 0) {
    // Give the caller a useful error: include candidates that share a
    // prefix/substring so they can tell whether the name was a typo or
    // whether the vessel genuinely doesn't exist yet.
    const candidates = await database
      .select({ name: vessels.name })
      .from(vessels)
      .where(
        and(eq(vessels.orgId, orgId), sql`LOWER(${vessels.name}) LIKE LOWER(${`%${trimmedName}%`})`)
      )
      .limit(10);

    const candidateNames = candidates.map((c) => c.name);
    const hint =
      candidateNames.length > 0
        ? ` Similar vessels in this org: ${candidateNames.join(", ")}.`
        : " No similar vessels found — create the vessel in ARUS before importing.";

    throw new VesselResolutionError(`Vessel "${vesselName}" not found.${hint}`, candidateNames);
  }

  // matches.length > 1 — should be rare but possible if the name column
  // has no unique constraint. Fail loudly rather than picking the first.
  const matchNames = matches.map((m) => m.name);
  throw new VesselResolutionError(
    `Vessel name "${vesselName}" is ambiguous — matched ${matches.length} vessels. ` +
      `Pass an explicit vesselId instead. Candidates: ${matchNames.join(", ")}.`,
    matchNames
  );
}
