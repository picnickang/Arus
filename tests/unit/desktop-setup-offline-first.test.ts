import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  canCompleteDesktopSetup,
  summarizeDesktopSetupReadiness,
} from "../../client/src/lib/desktopFetch";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

describe("desktop setup offline-first readiness", () => {
  it("allows setup completion when the local backend is healthy but cloud is unreachable", () => {
    const readiness = {
      isDesktop: true,
      localSetupComplete: false,
      localBackendHealthy: true,
      cloudReachable: false,
    };

    expect(canCompleteDesktopSetup(readiness)).toBe(true);
    expect(summarizeDesktopSetupReadiness(readiness)).toEqual(
      expect.objectContaining({
        setupComplete: true,
        localReady: true,
        cloudStatus: "pending",
      })
    );
  });

  it("keeps setup incomplete until either local setup was saved or the local backend is healthy", () => {
    expect(
      canCompleteDesktopSetup({
        isDesktop: true,
        localSetupComplete: false,
        localBackendHealthy: false,
        cloudReachable: false,
      })
    ).toBe(false);

    expect(
      canCompleteDesktopSetup({
        isDesktop: true,
        localSetupComplete: true,
        localBackendHealthy: false,
        cloudReachable: false,
      })
    ).toBe(true);
  });

  it("does not gate the browser app behind desktop setup", () => {
    expect(
      canCompleteDesktopSetup({
        isDesktop: false,
        localSetupComplete: false,
        localBackendHealthy: false,
        cloudReachable: false,
      })
    ).toBe(true);
  });
});

describe("desktop setup offline-first source contract", () => {
  const setupPage = read("client/src/pages/desktop-setup.tsx");
  const setupSteps = read("client/src/pages/desktop-setup-steps.tsx");

  it("offers local offline setup without requiring cloud sign-in", () => {
    expect(setupSteps).toContain('data-testid="button-use-local-offline-mode"');
    expect(setupPage).toContain('data-testid="button-finish-offline"');
    expect(setupPage).toContain("Cloud link optional");
  });

  it("explains the first-run flow in local database, cloud link, and sync terms", () => {
    expect(setupPage).toContain("Local Database");
    expect(setupPage).toContain("Cloud Link");
    expect(setupPage).toContain("Sync");
    expect(setupSteps).toContain("local database");
    expect(setupSteps).toContain("queued");
  });
});
