/**
 * WidenPartial<T> — a mapped type that makes every property of T optional
 * AND explicitly admits `undefined` as a value. This is the EOPT-friendly
 * analogue of `Partial<T>`, which under `exactOptionalPropertyTypes: true`
 * does NOT permit `undefined` values on its optional properties.
 *
 * Use this for storage / service update method signatures that accept the
 * output of `zodSchema.partial().parse(req.body)` — Zod treats optional
 * properties as `T | undefined`, which is incompatible with plain
 * `Partial<T>` under EOPT.
 */
export type WidenPartial<T> = { [K in keyof T]?: T[K] | undefined };
