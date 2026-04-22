export function readU32LE(buf: Buffer, offset: number): number {
  if (offset + 4 > buf.length) {
    return 0;
  }
  return buf.readUInt32LE(offset);
}

export function readU16LE(buf: Buffer, offset: number): number {
  if (offset + 2 > buf.length) {
    return 0;
  }
  return buf.readUInt16LE(offset);
}

export function readU8(buf: Buffer, offset: number): number {
  if (offset >= buf.length) {
    return 0;
  }
  return buf.readUInt8(offset);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function extractPgn(canId: number): number {
  const pf = (canId >> 16) & 0xff;
  const ps = (canId >> 8) & 0xff;
  return pf < 240 ? pf << 8 : (pf << 8) | ps;
}

export function extractSa(canId: number): number {
  return canId & 0xff;
}
