/**
 * Discard-guard close interception (client/src/lib/discard-guard.ts) — the
 * pure decision consumed by useDiscardGuard: closing a dirty dialog is
 * intercepted with a confirm step; clean closes and opens pass through.
 */

import { shouldInterceptClose } from "@/lib/discard-guard";

describe("shouldInterceptClose", () => {
  it("intercepts a close attempt while the form is dirty", () => {
    expect(shouldInterceptClose(false, true)).toBe(true);
  });

  it("lets a clean close pass through", () => {
    expect(shouldInterceptClose(false, false)).toBe(false);
  });

  it("never intercepts an open transition, dirty or not", () => {
    expect(shouldInterceptClose(true, true)).toBe(false);
    expect(shouldInterceptClose(true, false)).toBe(false);
  });
});
