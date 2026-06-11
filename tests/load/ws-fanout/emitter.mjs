#!/usr/bin/env node
// Task 92 — out-of-band emitter for the WS fan-out load proof.
//
// Publishes numbered events directly via Redis using the exact wire
// format that server/websocket-fanout-redis.ts uses (XADD to the
// per-(orgId, channel) stream + PUBLISH on the per-(orgId, channel)
// pub/sub channel). That way the running app servers receive the
// events through their normal subscriber path and dispatch them to
// their local WS clients — proving cross-server delivery without
// requiring a publish-side HTTP endpoint on the app.
//
// Stream / pub-sub key shapes mirror the constants in
// server/websocket-fanout-redis.ts; update both if they change.
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.error("[emitter] REDIS_URL is required");
  process.exit(2);
}

const CHANNEL = process.env.WS_CHANNEL || "loadtest";
const ORG = process.env.WS_ORG || "default-org-id";
const RATE_HZ = Number.parseFloat(process.env.EMIT_RATE_HZ || "10");
const DURATION_MS = Number.parseInt(process.env.EMIT_DURATION_MS || "120000", 10);
const STREAM_MAXLEN = 10_000;

const STREAM_KEY = `arus:wsstream:${ORG}:${CHANNEL}`;
const PUBSUB_KEY = `arus:ws:${ORG}:${CHANNEL}`;
const ORIGIN = `emitter-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

const redis = new Redis(REDIS_URL, { lazyConnect: true });

async function main() {
  await redis.connect();
  console.log(
    `[emitter] org=${ORG} channel=${CHANNEL} rate=${RATE_HZ}Hz duration=${DURATION_MS}ms`
  );

  const intervalMs = Math.max(1, Math.round(1000 / RATE_HZ));
  const deadline = Date.now() + DURATION_MS;
  let tag = 0;
  let publishFailures = 0;

  while (Date.now() < deadline) {
    const t0 = Date.now();
    const payload = { tag, type: "loadtest", emittedAtMs: t0 };
    const baseEvent = { orgId: ORG, channel: CHANNEL, payload, timestampMs: t0 };
    try {
      const streamId = await redis.xadd(
        STREAM_KEY,
        "MAXLEN",
        "~",
        STREAM_MAXLEN,
        "*",
        "p",
        JSON.stringify(baseEvent)
      );
      const tagged = { ...baseEvent, eventId: streamId, _origin: ORIGIN };
      await redis.publish(PUBSUB_KEY, JSON.stringify(tagged));
    } catch (err) {
      publishFailures += 1;
      console.error(`[emitter] publish failed at tag ${tag}: ${err}`);
    }
    tag += 1;
    const elapsed = Date.now() - t0;
    const sleep = Math.max(0, intervalMs - elapsed);
    if (sleep > 0) await new Promise((r) => setTimeout(r, sleep));
  }

  console.log(`[emitter] done. emitted=${tag} failures=${publishFailures}`);
  await redis.quit();
}

const shuttingDown = { value: false };
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    if (shuttingDown.value) return;
    shuttingDown.value = true;
    console.log(`[emitter] received ${sig}, shutting down`);
    redis.quit().finally(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error("[emitter] fatal", err);
  process.exit(1);
});
