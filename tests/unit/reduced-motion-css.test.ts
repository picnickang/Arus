/**
 * Reduced-motion contract (WCAG 2.1 SC 2.3.3 — "Animation from Interactions").
 *
 * Maritime operators in heavy seas, and motion-sensitive crew, can request
 * reduced motion at the OS level. ARUS must honour that by collapsing
 * animation/transition durations and stopping looping animations (spinners,
 * skeleton pulses, Radix enter/exit). The rule lives in client/src/index.css,
 * outside @layer, so it overrides Tailwind's animate and transition utilities.
 *
 * This pins the rule so it cannot be silently dropped — it is the enforced
 * artifact backing the reduced-motion claim in the HMI compliance doc.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("Reduced-motion (prefers-reduced-motion) contract", () => {
  let css = "";

  beforeAll(async () => {
    css = await readFile(resolve(process.cwd(), "client/src/index.css"), "utf8");
  });

  it("declares a prefers-reduced-motion: reduce media query", () => {
    expect(css).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
  });

  it("collapses animation and transition durations under reduced motion", () => {
    expect(css).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(css).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });

  it("stops looping animations (spinners/pulses) under reduced motion", () => {
    expect(css).toMatch(/animation-iteration-count:\s*1\s*!important/);
  });

  it("applies to all elements and pseudo-elements (universal selector)", () => {
    // The block targets *, *::before, *::after so no animated element escapes.
    const block = css.slice(css.indexOf("prefers-reduced-motion"));
    expect(block).toMatch(/\*::before/);
    expect(block).toMatch(/\*::after/);
  });
});
