import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

describe("client tail component extractions", () => {
  it("keeps engine logbook row-components as the public import path", () => {
    const barrel = read("client/src/components/engine-logbook/row-components.tsx");
    const secondary = read("client/src/components/engine-logbook/row-secondary-components.tsx");

    expect(barrel).toContain('export { EngineEventItem, EngineWatchCard }');
    expect(barrel).toContain('export type { WatchData }');
    expect(secondary).toContain("export function EngineEventItem");
    expect(secondary).toContain("export function EngineWatchCard");
    expect(secondary).toContain('data-testid={`event-${event.id}`}');
    expect(secondary).toContain('data-testid={`input-watch-${period}-chief`}');
  });
  it("keeps logs compliance logbook status rendering in a page part", () => {
    const page = read("client/src/pages/logs-compliance-hub.tsx");
    const parts = read("client/src/pages/logs-compliance-hub-parts.tsx");

    expect(page).toContain('from "./logs-compliance-hub-parts"');
    expect(page).toContain("<LogbookStatusTab />");
    expect(page).toContain('data-testid="tab-logbooks"');
    expect(parts).toContain("export function LogbookStatusTab");
    expect(parts).toContain('href="/stormgeo-settings"');
    expect(parts).toContain("Notification Settings");
  });
});
