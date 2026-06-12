export type Series = number[];

// ============================================================================
// SIGNAL PROCESSING
// ============================================================================

/**
 * Calculate RMS (Root Mean Square)
 * Standard measure for vibration analysis
 */
export function calculateRMS(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sumOfSquares = values.reduce((sum, val) => sum + val * val, 0);
  return Math.sqrt(sumOfSquares / values.length);
}

/**
 * Absolute Envelope - Fast rectified envelope proxy for bearing fault detection
 * Detects impulse patterns typical in bearing defects
 */
export function absEnvelope(x: Series, windowSize: number = 5): number[] {
  if (!x.length) {
    return [];
  }

  const rectified = x.map((val) => Math.abs(val));
  const envelope: number[] = [];

  for (let i = 0; i < rectified.length; i++) {
    let sum = 0;
    let count = 0;

    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j >= 0 && j < rectified.length) {
        const r = rectified[j];
        if (r === undefined) {
          continue;
        }
        sum += r;
        count++;
      }
    }

    envelope.push(sum / Math.max(1, count));
  }

  return envelope;
}

/**
 * Band RMS Analysis - Frequency domain energy in specific bands
 * Critical for ISO 10816 compliance and fault frequency analysis
 */
export function bandRMS(
  freq: number[],
  mag: number[],
  bands: { lo: number; hi: number; name: string }[]
): { name: string; value: number }[] {
  return bands.map((band) => {
    let energySum = 0;
    let count = 0;

    for (let i = 0; i < freq.length; i++) {
      const f = freq[i];
      if (f === undefined) {
        continue;
      }
      if (f >= band.lo && f < band.hi) {
        const magnitude = mag[i] ?? 0;
        energySum += magnitude * magnitude;
        count++;
      }
    }

    return {
      name: band.name,
      value: Math.sqrt(energySum / Math.max(1, count)),
    };
  });
}
