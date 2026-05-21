// Task 134 — chaos variant of the WS fan-out load proof.
//
// Same connect/reconnect topology as ws_fanout.js, but the harness
// (tests/load/ws-fanout/run-chaos.mjs) knocks Redis out mid-run for
// CHAOS_DURATION_MS. Every received event carries the emitter-
// supplied `emittedAtMs`; we classify each one against the absolute
// wall-clock chaos window the harness passes in:
//
//   pre    : emittedAtMs <  downAt - GRACE  → contiguity REQUIRED
//   outage : emittedAtMs in [downAt-GRACE, upAt+GRACE] → loss ALLOWED
//   post   : emittedAtMs >  upAt   + GRACE  → contiguity REQUIRED
//
// Pre and post contiguity is enforced independently. Outage-window
// tags are explicitly permitted to be lost — that is the documented
// recovery guarantee being proved (events emitted while Redis was
// down may not survive, but the bus must catch up afterwards).
//
// See tests/load/WS_FANOUT.md ("Chaos variant") for the runbook.
import ws from "k6/ws";
import { check } from "k6";
import { Counter, Gauge } from "k6/metrics";

const URL1 = __ENV.WS_URL_1 || "ws://localhost:5001/ws";
const URL2 = __ENV.WS_URL_2 || "ws://localhost:5002/ws";
const CHANNEL = __ENV.WS_CHANNEL || "loadtest";
const ORG = __ENV.WS_ORG || "default-org-id";
const VUS = parseInt(__ENV.WS_VUS || "20", 10);
// Bias toward more reconnects than the healthy run — a reconnect that
// straddles the outage is exactly what exercises the replay-after-
// recovery path.
const RECONNECTS = parseInt(__ENV.WS_RECONNECTS || "5", 10);
const HOLD_MS = parseInt(__ENV.WS_HOLD_MS || "12000", 10);
const RECONNECT_GAP_MS = parseInt(__ENV.WS_RECONNECT_GAP_MS || "500", 10);

const DOWN_AT_MS = parseInt(__ENV.CHAOS_DOWN_AT_MS || "0", 10);
const UP_AT_MS = parseInt(__ENV.CHAOS_UP_AT_MS || "0", 10);
const GRACE_MS = parseInt(__ENV.CHAOS_GRACE_MS || "1500", 10);
if (!DOWN_AT_MS || !UP_AT_MS || UP_AT_MS <= DOWN_AT_MS) {
  throw new Error(
    "ws_fanout_chaos.js requires CHAOS_DOWN_AT_MS and CHAOS_UP_AT_MS (UP > DOWN). " +
      "Run via tests/load/ws-fanout/run-chaos.mjs.",
  );
}

const eventsReceived = new Counter("ws_events_received");
// Gaps in pre/post windows — MUST be zero. Outage gaps are tracked
// separately as ws_outage_events_lost and are informational only.
const eventsMissedStrict = new Counter("ws_events_missed_strict");
const gapsDetectedStrict = new Counter("ws_gaps_detected_strict");
const outageEventsLost = new Counter("ws_outage_events_lost");
const handshakeFailures = new Counter("ws_handshake_failures");
const maxSeenTag = new Gauge("ws_max_seen_tag");

export const options = {
  scenarios: {
    fanout_chaos: {
      executor: "per-vu-iterations",
      vus: VUS,
      iterations: 1,
      maxDuration: "10m",
    },
  },
  thresholds: {
    // Strict guarantees: zero gaps outside the outage window.
    ws_events_missed_strict: ["count==0"],
    ws_gaps_detected_strict: ["count==0"],
    ws_handshake_failures: ["count==0"],
    // No strict bound on outage losses — recorded only for the runbook.
  },
};

function connectOnce(url, cursor, seenEvents) {
  let lastEventId = cursor;
  const res = ws.connect(url, {}, (socket) => {
    socket.on("open", () => {
      const sub = { type: "subscribe", channel: CHANNEL };
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
      if (!m || m.channel !== CHANNEL) return;
      if (typeof m.tag !== "number") return;
      if (typeof m.emittedAtMs !== "number") return;
      if (!seenEvents.has(m.tag)) {
        seenEvents.set(m.tag, m.emittedAtMs);
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

function classify(emittedAtMs) {
  if (emittedAtMs < DOWN_AT_MS - GRACE_MS) return "pre";
  if (emittedAtMs > UP_AT_MS + GRACE_MS) return "post";
  return "outage";
}

function countGaps(tags) {
  if (tags.length < 2) return 0;
  tags.sort((a, b) => a - b);
  let gaps = 0;
  for (let i = 1; i < tags.length; i++) {
    const expected = tags[i - 1] + 1;
    if (tags[i] !== expected) gaps += tags[i] - expected;
  }
  return gaps;
}

export default function () {
  const url = __VU % 2 === 0 ? URL1 : URL2;
  // Map<tag, emittedAtMs>
  const seenEvents = new Map();
  let cursor = null;

  for (let i = 0; i < RECONNECTS; i++) {
    cursor = connectOnce(url, cursor, seenEvents);
    if (i < RECONNECTS - 1) {
      const until = Date.now() + RECONNECT_GAP_MS;
      while (Date.now() < until) {
        /* spin */
      }
    }
  }

  const preTags = [];
  const postTags = [];
  const outageTags = [];
  for (const [tag, emittedAtMs] of seenEvents) {
    const bucket = classify(emittedAtMs);
    if (bucket === "pre") preTags.push(tag);
    else if (bucket === "post") postTags.push(tag);
    else outageTags.push(tag);
  }

  const preGaps = countGaps(preTags);
  const postGaps = countGaps(postTags);
  // Outage "loss" is the count of *expected* tags missing inside the
  // observed outage band. We can only bound it by what we observed:
  // (last outage tag seen) - (first outage tag seen) + 1 - count.
  // If the VU observed no outage tags at all, we report 0 — the run
  // either had no outage tags in its lifetime window, or all such
  // tags were dropped (a possibility this scenario explicitly allows).
  let outageObservedLoss = 0;
  if (outageTags.length >= 2) {
    outageTags.sort((a, b) => a - b);
    const span = outageTags[outageTags.length - 1] - outageTags[0] + 1;
    outageObservedLoss = span - outageTags.length;
  }

  if (preGaps > 0) {
    gapsDetectedStrict.add(1);
    eventsMissedStrict.add(preGaps);
    console.error(
      `[vu ${__VU}] PRE-OUTAGE gap: ${preGaps} missing tag(s) in pre window ` +
        `(seen ${preTags.length} tags between ${preTags[0]}..${preTags[preTags.length - 1]})`,
    );
  }
  if (postGaps > 0) {
    gapsDetectedStrict.add(1);
    eventsMissedStrict.add(postGaps);
    console.error(
      `[vu ${__VU}] POST-OUTAGE gap: ${postGaps} missing tag(s) in post window ` +
        `(seen ${postTags.length} tags between ${postTags[0]}..${postTags[postTags.length - 1]})`,
    );
  }
  if (outageObservedLoss > 0) {
    outageEventsLost.add(outageObservedLoss);
    console.log(
      `[vu ${__VU}] outage-window loss tolerated: ${outageObservedLoss} tag(s) ` +
        `(seen ${outageTags.length} of ${outageTags.length + outageObservedLoss} observable)`,
    );
  }
}
