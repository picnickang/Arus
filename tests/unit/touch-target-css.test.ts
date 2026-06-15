/**
 * Touch-target floor contract (gloved / coarse-pointer use).
 *
 * Maritime operators tap with gloves on pitching decks. ARUS enforces a 44px
 * minimum touch target for interactive elements on coarse-pointer devices via a
 * media query in client/src/index.css. This pins that floor so it cannot be
 * silently removed — it is the static ("lint") leg of the touch-ergonomics
 * claim; the runtime leg is the boundingBox >=44px assertions in
 * tests/playwright/bridge-conditions.spec.ts and mobile-ops-rail.spec.ts.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("Touch-target floor (coarse-pointer) contract", () => {
  let css = "";
  let block = "";

  beforeAll(async () => {
    css = await readFile(resolve(process.cwd(), "client/src/index.css"), "utf8");
    const i = css.search(/@media\s*\(\s*hover:\s*none\s*\)\s*and\s*\(\s*pointer:\s*coarse\s*\)/);
    block = i >= 0 ? css.slice(i, i + 400) : "";
  });

  it("declares a coarse-pointer (touch) media query", () => {
    expect(css).toMatch(/@media\s*\(\s*hover:\s*none\s*\)\s*and\s*\(\s*pointer:\s*coarse\s*\)/);
  });

  it("enforces a 44px minimum height and width under coarse pointers", () => {
    expect(block).toMatch(/min-height:\s*44px/);
    expect(block).toMatch(/min-width:\s*44px/);
  });

  it("applies the floor to buttons and role=button elements", () => {
    expect(block).toMatch(/\bbutton\b/);
    expect(block).toMatch(/\[role="button"\]/);
  });
});
