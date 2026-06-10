import { createLogger } from "./structured-logger";

const logger = createLogger("Lib:AggregateHelpers");

/**
 * Section loader for dashboard-style aggregate endpoints (precedent:
 * /api/dashboard summary routes). Each named loader runs concurrently; a
 * failed section yields `null` plus an entry in `sectionErrors` instead of
 * failing the whole response, so one slow/broken subsystem can't blank a
 * dashboard. Raw failure messages are logged server-side only — the client
 * sees a generic marker (prod 5xx redaction policy, E4).
 */
export async function loadSections<T extends Record<string, () => Promise<unknown>>>(
  loaders: T,
  context: string
): Promise<{
  sections: { [K in keyof T]: Awaited<ReturnType<T[K]>> | null };
  sectionErrors: Record<string, string>;
}> {
  const names = Object.keys(loaders) as (keyof T & string)[];
  const settled = await Promise.allSettled(names.map((name) => loaders[name]!()));

  const sections = {} as { [K in keyof T]: Awaited<ReturnType<T[K]>> | null };
  const sectionErrors: Record<string, string> = {};

  settled.forEach((result, index) => {
    const name = names[index]!;
    if (result.status === "fulfilled") {
      sections[name] = result.value as Awaited<ReturnType<T[typeof name]>>;
    } else {
      sections[name] = null;
      sectionErrors[name] = "unavailable";
      logger.error(`${context}: section "${name}" failed`, undefined, result.reason);
    }
  });

  return { sections, sectionErrors };
}
