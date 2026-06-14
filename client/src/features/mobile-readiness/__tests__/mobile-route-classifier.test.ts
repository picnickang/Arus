import { describe, it, expect } from "@jest/globals";
import { classifyMobileRoute, isSafeForBottomNav } from '../mobile-readiness-route-contract';

describe('Phase 1 - Mobile Route Classifier', () => {
  it('approves core mobile paths', () => {
    expect(classifyMobileRoute('/fleet').isSafeForMobileBottomNav).toBe(true);
    expect(classifyMobileRoute('/').status).toBe('mobileReplacement');
  });

  it('blocks leaky paths', () => {
    expect(isSafeForBottomNav('/profile')).toBe(false);
    expect(classifyMobileRoute('/attention-inbox').status).toBe('missing');
  });

  it('flags UniversalOpsShell', () => {
    expect(classifyMobileRoute('/admin').isSafeForMobileBottomNav).toBe(false);
  });
});