/**
 * Cryptographically secure random number utilities
 * Replaces Math.random() to address S2245 security hotspots
 */

let cryptoModule: typeof import('crypto') | null = null;

function getCrypto(): typeof import('crypto') {
  if (cryptoModule) {return cryptoModule;}
  
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    return {
      randomUUID: () => globalThis.crypto.randomUUID(),
      getRandomValues: <T extends ArrayBufferView>(array: T): T => {
        globalThis.crypto.getRandomValues(array);
        return array;
      }
    } as unknown as typeof import('crypto');
  }
  
  cryptoModule = require('crypto');
  return cryptoModule!;
}

export function cryptoRandom(): number {
  const array = new Uint32Array(1);
  getCrypto().getRandomValues(array);
  return array[0] / 0xFFFFFFFF;
}

export function cryptoRandomInt(max: number): number {
  return Math.floor(cryptoRandom() * max);
}

export function cryptoRandomInRange(min: number, max: number): number {
  return min + cryptoRandom() * (max - min);
}

export function cryptoRandomId(length: number = 8): string {
  return getCrypto().randomUUID().replace(/-/g, '').slice(0, length);
}

export function cryptoRandomChoice<T>(array: T[]): T {
  return array[cryptoRandomInt(array.length)];
}

export function cryptoShuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
