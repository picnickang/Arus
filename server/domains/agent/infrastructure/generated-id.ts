import { randomUUID } from "node:crypto";

export function withGeneratedUuid<T extends object>(data: T): T & { id: string } {
  const id = (data as { id?: unknown }).id;
  return {
    ...data,
    id: typeof id === "string" && id.length > 0 ? id : randomUUID(),
  };
}

export function withGeneratedInsertDefaults<T extends object, K extends string>(
  data: T,
  timestampFields: readonly K[]
): T & { id: string } & Record<K, Date> {
  const output: Record<string, unknown> = withGeneratedUuid(data);
  const now = new Date();

  for (const field of timestampFields) {
    if (output[field] === undefined) {
      output[field] = now;
    }
  }

  return output as T & { id: string } & Record<K, Date>;
}
