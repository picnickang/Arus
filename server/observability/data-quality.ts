/**
 * Wave 6.8 — Data quality monitoring for telemetry feeds.
 *
 * Homegrown assertion suite (Great Expectations would be overkill for
 * the current channel count and adds a Python runtime dependency we
 * don't otherwise want). Three assertion classes cover the failure
 * modes the gap doc named:
 *
 *   1. Freshness — gap between samples exceeds the channel's expected
 *      cadence (gauge: seconds since last sample; counter on breach).
 *   2. Range — value outside [min, max] for the channel.
 *   3. Monotonicity — channels declared monotonic (e.g. running hours,
 *      fuel-totalizer) must never decrease except by a wraparound
 *      threshold.
 *
 * Failed assertions feed Prometheus counters and (when wired) emit a
 * structured log line that Sentry/Loki can index. We deliberately do
 * NOT block ingestion on a failed assertion — the data still lands;
 * the operator sees an alert and decides whether to quarantine.
 */

import client from "prom-client";
import { createLogger } from "../lib/structured-logger";

const logger = createLogger("Observability:DataQuality");

export const dqAssertionBreaches = new client.Counter({
  name: "arus_dq_assertion_breaches_total",
  help: "Data-quality assertion breaches by channel and rule.",
  labelNames: ["channel", "rule", "vessel_id"],
});

export const dqChannelFreshnessSeconds = new client.Gauge({
  name: "arus_dq_channel_freshness_seconds",
  help: "Seconds since the most recent sample for a channel.",
  labelNames: ["channel", "vessel_id"],
});

export const dqChannelValue = new client.Gauge({
  name: "arus_dq_channel_last_value",
  help: "Most recent observed value per channel (for range debugging).",
  labelNames: ["channel", "vessel_id"],
});

export interface RangeRule {
  min?: number;
  max?: number;
}

export interface FreshnessRule {
  /** Maximum allowed gap between samples in seconds before a breach fires. */
  maxGapSeconds: number;
}

export interface MonotonicityRule {
  /** Permitted "wraparound" backwards step (e.g. counter rollover at 65535). */
  wraparoundThreshold?: number;
}

export interface ChannelRules {
  range?: RangeRule;
  freshness?: FreshnessRule;
  monotonic?: MonotonicityRule;
}

interface ChannelState {
  lastValue?: number;
  lastTsMs?: number;
}

export type AssertionRule = "range" | "freshness" | "monotonicity";

export interface AssertionBreach {
  channel: string;
  vesselId: string;
  rule: AssertionRule;
  value?: number;
  message: string;
}

export class DataQualityMonitor {
  private readonly rules = new Map<string, ChannelRules>();
  private readonly state = new Map<string, ChannelState>();

  registerChannel(channel: string, rules: ChannelRules): void {
    this.rules.set(channel, rules);
  }

  /**
   * Evaluate a single sample. Returns any breaches detected. Always
   * updates the channel state regardless of breach status — the goal
   * is to track reality, not the assertion-passing subset.
   */
  evaluate(channel: string, vesselId: string, value: number, tsMs: number): AssertionBreach[] {
    const key = `${vesselId}|${channel}`;
    const rules = this.rules.get(channel);
    const prev = this.state.get(key);
    const breaches: AssertionBreach[] = [];

    dqChannelValue.set({ channel, vessel_id: vesselId }, value);

    if (rules?.range) {
      const { min, max } = rules.range;
      if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
        breaches.push({
          channel,
          vesselId,
          rule: "range",
          value,
          message: `Value ${value} outside [${min ?? "-∞"}, ${max ?? "∞"}]`,
        });
      }
    }

    if (rules?.freshness && prev?.lastTsMs !== undefined) {
      const gapSec = (tsMs - prev.lastTsMs) / 1000;
      dqChannelFreshnessSeconds.set({ channel, vessel_id: vesselId }, Math.max(0, gapSec));
      if (gapSec > rules.freshness.maxGapSeconds) {
        breaches.push({
          channel,
          vesselId,
          rule: "freshness",
          value,
          message: `Gap of ${gapSec.toFixed(1)}s exceeds maxGapSeconds ${rules.freshness.maxGapSeconds}`,
        });
      }
    }

    if (rules?.monotonic && prev?.lastValue !== undefined) {
      const drop = prev.lastValue - value;
      const wrap = rules.monotonic.wraparoundThreshold;
      const isWraparound = wrap !== undefined && drop > wrap;
      if (drop > 0 && !isWraparound) {
        breaches.push({
          channel,
          vesselId,
          rule: "monotonicity",
          value,
          message: `Monotonic channel decreased by ${drop} (prev=${prev.lastValue}, now=${value})`,
        });
      }
    }

    this.state.set(key, { lastValue: value, lastTsMs: tsMs });

    for (const b of breaches) {
      dqAssertionBreaches.inc({ channel: b.channel, rule: b.rule, vessel_id: b.vesselId });
      logger.warn(`DQ breach: ${b.message}`, {
        channel: b.channel,
        vesselId: b.vesselId,
        rule: b.rule,
        value: b.value,
      });
    }

    return breaches;
  }

  /** Sweep all channels: emit freshness-since-last-sample gauges. Call from a periodic timer. */
  sweep(nowMs: number = Date.now()): void {
    for (const [key, st] of this.state) {
      if (!st.lastTsMs) {continue;}
      const [vesselId = '', channel = ''] = key.split("|");
      const gapSec = (nowMs - st.lastTsMs) / 1000;
      dqChannelFreshnessSeconds.set({ channel, vessel_id: vesselId }, Math.max(0, gapSec));
      const rules = this.rules.get(channel);
      if (rules?.freshness && gapSec > rules.freshness.maxGapSeconds) {
        dqAssertionBreaches.inc({ channel, rule: "freshness", vessel_id: vesselId });
      }
    }
  }
}

export const dataQualityMonitor = new DataQualityMonitor();
