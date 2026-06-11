// Task 92 — k6 WebSocket fan-out load proof.
//
// Distributes N virtual users across two app servers that share a
// Redis instance, has each VU subscribe to a fan-out channel, and
// reconnects them repeatedly while an out-of-band emitter publishes
// numbered events through Redis.
//
// Pass criteria: every connection that stayed within the documented
// 5-minute replay window must see every emitted event for the channel
// it subscribed to — i.e. the per-VU set of received numeric tags must
// be contiguous from first-seen to last-seen. Any hole counts as a
// dropped event and fails the run.
//
// See tests/load/WS_FANOUT.md for the full runbook (booting two
// servers + Redis + the emitter).
import ws from "k6/ws";
import { check } from "k6";
import { Counter, Gauge } from "k6/metrics";

const URL1 = __ENV.WS_URL_1 || "ws://localhost:5001/ws";
const URL2 = __ENV.WS_URL_2 || "ws://localhost:5002/ws";
const CHANNEL = __ENV.WS_CHANNEL || "loadtest";
const ORG = __ENV.WS_ORG || "default-org-id";
const VUS = parseInt(__ENV.WS_VUS || "20", 10);
const RECONNECTS = parseInt(__ENV.WS_RECONNECTS || "3", 10);
const HOLD_MS = parseInt(__ENV.WS_HOLD_MS || "20000", 10);
const RECONNECT_GAP_MS = parseInt(__ENV.WS_RECONNECT_GAP_MS || "500", 10);

const eventsReceived = new Counter("ws_events_received");
const eventsMissed = new Counter("ws_events_missed");
const gapsDetected = new Counter("ws_gaps_detected");
const handshakeFailures = new Counter("ws_handshake_failures");
const maxSeenTag = new Gauge("ws_max_seen_tag");

export const options = {
  scenarios: {
    fanout: {
      executor: "per-vu-iterations",
      vus: VUS,
      iterations: 1,
      maxDuration: "10m",
    },
  },
  thresholds: {
    ws_events_missed: ["count==0"],
    ws_gaps_detected: ["count==0"],
    ws_handshake_failures: ["count==0"],
  },
};

function connectOnce(url, cursor, seenTags) {
  let lastEventId = cursor;
  const res = ws.connect(url, {}, (socket) => {
    socket.on("open", () => {
      const sub = {
        type: "subscribe",
        channel: CHANNEL,
      };
      if (lastEventId) sub.lastEventIds = { [ORG]: lastEventId };
      socket.send(JSON.stringify(sub));
    });
    socket.on("message", (raw) => {
      let m;
      try {
        m = JSON.parse(raw);
      } catch {
        return;
      }
      // Substrate frames: connection welcome / pong / latest-alerts etc.
      if (!m || m.channel !== CHANNEL) return;
      if (typeof m.tag !== "number") return;
      if (!seenTags.has(m.tag)) {
        seenTags.add(m.tag);
        eventsReceived.add(1);
        if (m.tag > (maxSeenTag.value || 0)) maxSeenTag.add(m.tag);
      }
      if (typeof m.eventId === "string" && m.eventId.length > 0) {
        lastEventId = m.eventId;
      }
    });
    socket.setTimeout(() => {
      try {
        socket.close();
      } catch {
        /* already closing */
      }
    }, HOLD_MS);
  });
  const ok = check(res, { "ws handshake 101": (r) => r && r.status === 101 });
  if (!ok) handshakeFailures.add(1);
  return lastEventId;
}

export default function () {
  // Split VUs evenly across the two servers so each server has both
  // publish-side peers (via Redis SUBSCRIBE→dispatch) and live local
  // subscribers exercised.
  const url = __VU % 2 === 0 ? URL1 : URL2;
  const seenTags = new Set();
  let cursor = null;

  for (let i = 0; i < RECONNECTS; i++) {
    cursor = connectOnce(url, cursor, seenTags);
    // Short dead-time between reconnects exercises the
    // subscribe-with-cursor replay path. Stays well inside the
    // 5-minute replay window documented in ADR 002.
    if (i < RECONNECTS - 1) {
      const until = Date.now() + RECONNECT_GAP_MS;
      // k6 has no sleep inside default(); approximate with a busy
      // wait via a no-op WS connect to /ws would be wasteful, so use
      // a tiny synchronous loop on Date.now() which is exact enough
      // here (sub-second).
      while (Date.now() < until) {
        /* spin */
      }
    }
  }

  // Contiguity check per VU: received tags must form an unbroken
  // sequence from first-seen to last-seen. Any hole means a Redis
  // peer publish failed to deliver AND the subsequent replay-on-
  // reconnect failed to plug it — that is the regression this
  // scenario is designed to catch.
  const tags = Array.from(seenTags).sort((a, b) => a - b);
  if (tags.length >= 2) {
    let gaps = 0;
    for (let i = 1; i < tags.length; i++) {
      const expected = tags[i - 1] + 1;
      if (tags[i] !== expected) {
        const missing = tags[i] - expected;
        gaps += missing;
        console.error(`[vu ${__VU}] gap at tag ${expected}..${tags[i] - 1} (missing ${missing})`);
      }
    }
    if (gaps > 0) {
      gapsDetected.add(1);
      eventsMissed.add(gaps);
    }
  }
}
