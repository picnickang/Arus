/**
 * Jest Test Setup
 * 
 * Configures test environment for server-side integration tests.
 */

import { jest } from "@jest/globals";

jest.setTimeout(30000);

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgresql://localhost:5432/test";
process.env.ARUS_DEPLOYMENT_MODE = "CLOUD";
process.env.DISABLE_REDIS = "true";
process.env.DISABLE_JOB_QUEUE = "true";

beforeAll(async () => {
  console.log("[Test Setup] Starting test environment...");
});

afterAll(async () => {
  console.log("[Test Setup] Cleaning up test environment...");
});

beforeEach(() => {
});

afterEach(() => {
  jest.clearAllMocks();
});
