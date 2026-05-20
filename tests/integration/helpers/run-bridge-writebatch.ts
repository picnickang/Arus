/**
 * Task #89 — Bridge-path test helper.
 *
 * Executed via `npx tsx` from a Jest integration test so we can drive
 * the real `telemetryBatchWriter.writeBatch()` (which transitively
 * pulls in modules that use top-level await — incompatible with
 * @swc/jest's CJS transform). Reads a JSON payload from argv[2]:
 *
 *   { equipmentId: string; orgId: string }
 *
 * Calls writeBatch with a single reading for that org, listens for
 * `quotaBlocked`, and prints a JSON result on stdout:
 *
 *   { blocked: { total: number; perOrg: Record<string,number> } | null }
 *
 * stderr is left for log spew. Exit code is always 0 on a clean run —
 * the calling test inspects the JSON to decide pass/fail.
 */

import process from "node:process";

type Payload = { equipmentId: string; orgId: string };

// Marker sentinels so the calling test can locate the JSON payload
// even if any imported module writes log lines to stdout during boot.
const BEGIN = "<<<T89_RESULT_BEGIN>>>";
const END = "<<<T89_RESULT_END>>>";

function emit(result: unknown): void {
  process.stdout.write(`\n${BEGIN}${JSON.stringify(result)}${END}\n`);
}

async function main(): Promise<void> {
  const raw = process.argv[2];
  if (!raw) {
    emit({ error: "missing payload arg" });
    process.exit(2);
  }
  const payload = JSON.parse(raw) as Payload;

  const { telemetryBatchWriter } = await import(
    "../../../server/telemetry-batch-writer"
  );

  let blocked: { total: number; perOrg: Record<string, number> } | null = null;
  telemetryBatchWriter.on(
    "quotaBlocked",
    (p: { total: number; perOrg: Record<string, number> }) => {
      blocked = p;
    },
  );

  await telemetryBatchWriter.writeBatch(
    [
      {
        equipmentId: payload.equipmentId,
        sensorType: "vibration",
        value: 1.23,
        timestamp: new Date(),
        orgId: payload.orgId,
      },
    ],
    { source: "sqlite-bridge" },
  );

  emit({ blocked });
}

main()
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    emit({ error: message });
  })
  .finally(() => {
    // Force exit to release any open PG handles in transitively-imported modules.
    setTimeout(() => process.exit(0), 50).unref();
  });
