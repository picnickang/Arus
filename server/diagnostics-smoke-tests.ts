/**
 * Diagnostics smoke tests — legacy stub.
 */

export interface SmokeTest {
  id: string;
  name: string;
  description: string;
  run: () => Promise<{ ok: boolean; message?: string }>;
}

export interface SmokeTestSuite {
  id: string;
  name: string;
  description: string;
  tests: SmokeTest[];
}

export const smokeTestSuites: SmokeTestSuite[] = [];
