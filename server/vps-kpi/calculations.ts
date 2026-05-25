/**
 * VPS KPI Calculation Functions
 */

import type { VPSPayload, VPSConfiguration, VPSKPIResult, PowerVsSTW } from "./types";

export function quantile(arr: number[], p: number): number {
  const sorted = Float64Array.from(arr).sort();
  const pos = (sorted.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  const baseVal = sorted[base] ?? 0;
  const nextVal = sorted[base + 1] ?? baseVal;
  return baseVal + (nextVal - baseVal) * rest;
}

export function movingAverage(arr: number[], windowSize: number = 7): number[] {
  const result: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const slice = arr.slice(start, i + 1);
    const avg = slice.reduce((sum, val) => sum + val, 0) / slice.length;
    result.push(avg);
  }
  return result;
}

export function torqueToNm(value: number, unit: "Nm" | "kNm"): number {
  return unit === "kNm" ? value * 1000 : value;
}

export async function computeVPSKPIs(
  payload: VPSPayload,
  config: VPSConfiguration = {}
): Promise<VPSKPIResult> {
  const t = payload.timestamp ?? [];
  const rpm = payload.rpm ?? [];
  const tqRaw = payload.shaft_torque ?? [];
  const fuelLh = payload.fuel_rate ?? [];
  const unit = config.torque_unit ?? payload.torque_unit ?? "Nm";

  const tqNm = tqRaw.map((v) => torqueToNm(v ?? 0, unit));
  const maxTorque =
    config.max_torque_nm && config.max_torque_nm > 0
      ? config.max_torque_nm
      : tqNm.length > 0
        ? quantile(tqNm, 0.95)
        : 1;

  const loadPct = tqNm.map((v) => Math.max(0, Math.min(100, (100 * v) / maxTorque)));
  const powerKw = rpm.map((r, i) => (2 * Math.PI * (tqNm[i] ?? 0) * (r ?? 0)) / 60 / 1000);

  const rho = config.fuel_density_kg_per_l ?? 0.84;
  const fuelKgh = fuelLh.map((x) => (x ?? 0) * rho);
  const sfoc = powerKw.map((p, i) => (p > 1e-6 ? ((fuelKgh[i] ?? 0) * 1000) / p : NaN));
  const sfocSmoothed = movingAverage(sfoc, 7);

  const stw =
    payload.stw && payload.stw.length === rpm.length
      ? payload.stw
      : rpm.map((r) => Math.max(0, 10 * Math.pow((r ?? 1) / 1200, 1.5)));

  const bins = [20, 30, 35, 43, 48, 50, 62, 70, 80, 90, 100];
  const counts = bins.map(() => 0);
  for (const load of loadPct) {
    let binIndex = counts.length - 1;
    for (let i = 0; i < bins.length; i++) {
      if (load <= (bins[i] ?? Infinity)) {
        binIndex = i;
        break;
      }
    }
    counts[binIndex] = (counts[binIndex] ?? 0) + 1;
  }
  const hours = counts.map((c) => c / 3600);
  const xTime = t.length > 0 ? t : rpm.map((_, i) => i);

  return {
    meta: { max_torque_nm: maxTorque, fuel_density_kg_per_l: rho, torque_unit: unit },
    series: {
      load_vs_sfoc: loadPct
        .map((load, i) => ({ x: load, y: sfocSmoothed[i] ?? 0 }))
        .filter((d) => Number.isFinite(d.y)),
      fuel_vs_time: xTime.map((time, i) => ({ x: time, y: fuelLh[i] ?? 0 })),
      power_vs_stw: stw.map((speed, i) => ({ x: speed, y: powerKw[i] ?? 0 })),
      load_hist: bins.map((bin, i) => ({ bin, hours: hours[i] ?? 0 })),
    },
  };
}

export function calculatePowerSTWCurve(
  rpm: number[],
  torque: number[],
  stw?: number[]
): PowerVsSTW[] {
  const powerKw = rpm.map((r, i) => (2 * Math.PI * (torque[i] ?? 0) * r) / 60 / 1000);
  const stwKnots =
    stw?.length === rpm.length ? stw : rpm.map((r) => 10 * Math.pow((r ?? 1) / 1200, 1.5));
  return stwKnots.map((speed, i) => ({ x: speed, y: powerKw[i] ?? 0 }));
}
