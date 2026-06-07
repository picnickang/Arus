/**
 * Cryptographically secure random number utilities
 * Replaces Math.random() to address S2245 security hotspots
 */

type CryptoShim = Pick<typeof import("crypto"), "randomUUID" | "getRandomValues">;
let cryptoModule: CryptoShim | null = null;

function getCrypto(): CryptoShim {
  if (cryptoModule) {
    return cryptoModule;
  }

  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    return {
      randomUUID: () => globalThis.crypto.randomUUID(),
      getRandomValues: ((array: ArrayBufferView): ArrayBufferView => {
        globalThis.crypto.getRandomValues(array as Uint8Array);
        return array;
      }) as CryptoShim["getRandomValues"],
    };
  }

  cryptoModule = require("crypto") as CryptoShim;
  return cryptoModule;
}

export function cryptoRandom(): number {
  const array = new Uint32Array(1);
  getCrypto().getRandomValues(array);
  return (array[0] ?? 0) / 0xffffffff;
}

export function cryptoRandomInt(max: number): number {
  return Math.floor(cryptoRandom() * max);
}

export function cryptoRandomInRange(min: number, max: number): number {
  return min + cryptoRandom() * (max - min);
}

export function cryptoRandomId(length: number = 8): string {
  return getCrypto().randomUUID().replace(/-/g, "").slice(0, length);
}

export function cryptoRandomChoice<T>(array: T[]): T {
  if (array.length === 0) {
    throw new Error("cryptoRandomChoice: array must be non-empty");
  }
  const idx = cryptoRandomInt(array.length);
  const value = array[idx];
  if (value === undefined) {
    // Unreachable: idx ∈ [0, array.length); preserved for type safety.
    throw new Error("cryptoRandomChoice: unexpected undefined slot");
  }
  return value;
}

export function cryptoShuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) {continue;}
    result[i] = b;
    result[j] = a;
  }
  return result;
}
