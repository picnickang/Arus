/**
 * Environment Configuration & Validation
 * Validates environment variables and generates secure defaults for embedded mode
 */

import { randomBytes } from "node:crypto";

export interface EnvironmentConfig {
  isReplit: boolean;
  isDevelopment: boolean;
  isProduction: boolean;
  isLocalMode: boolean;
  isEmbedded: boolean;
  hasDatabase: boolean;
  hasObjectStorage: boolean;
  hasOpenAI: boolean;
  hasSessionSecret: boolean;
}

function generateEmbeddedSessionSecret(): string {
  return randomBytes(32).toString("hex");
}

function detectEnvironment(): {
  isReplit: boolean;
  isDevelopment: boolean;
  isProduction: boolean;
  localMode: boolean;
  isEmbedded: boolean;
} {
  return {
    isReplit: !!(process.env.REPL_ID || process.env.REPL_SLUG || process.env.REPLIT_DB_URL),
    isDevelopment: !process.env.NODE_ENV || process.env.NODE_ENV === "development",
    isProduction: process.env.NODE_ENV === "production",
    localMode: process.env.LOCAL_MODE === "true",
    isEmbedded: process.env.EMBEDDED_MODE === "true",
  };
}

function validateDatabase(localMode: boolean, isEmbedded: boolean, errors: string[]): void {
  if (process.env.DATABASE_URL) {
    console.log("✓ Database: PostgreSQL configured");
    return;
  }

  if (localMode || isEmbedded) {
    console.log("ℹ Database: Running in local/embedded mode (PostgreSQL optional)");
    return;
  }

  const message = "DATABASE_URL not set (REQUIRED for cloud mode)";
  console.error(`✗ Database: ${message}`);
  errors.push(message);
}

function isKnownDefaultSecret(secret: string): boolean {
  const defaultSecrets = ["dev-secret-key", "development", "change-me", "insecure"];
  return defaultSecrets.includes(secret.toLowerCase());
}

function validateExistingSecret(
  sessionSecret: string,
  isProduction: boolean,
  isEmbedded: boolean,
  errors: string[],
  warnings: string[]
): void {
  if (isKnownDefaultSecret(sessionSecret)) {
    if (isProduction) {
      const message = "SESSION_SECRET is set to a known default value - SECURITY RISK!";
      console.error(`✗ Security: ${message}`);
      errors.push(message);
    } else {
      warnings.push("SESSION_SECRET is using default value (acceptable for development)");
    }
    return;
  }

  if (sessionSecret.length < 32) {
    const message = "SESSION_SECRET is too short (minimum 32 characters recommended)";
    if (isProduction && !isEmbedded) {
      console.error(`✗ Security: ${message}`);
      errors.push(message);
    } else {
      warnings.push(message);
    }
    return;
  }

  console.log("✓ Security: Session secret configured");
}

function validateSessionSecret(
  isEmbedded: boolean,
  localMode: boolean,
  isDevelopment: boolean,
  isProduction: boolean,
  errors: string[],
  warnings: string[]
): void {
  const sessionSecret = process.env.SESSION_SECRET;

  if (!sessionSecret) {
    if (isEmbedded || localMode) {
      process.env.SESSION_SECRET = generateEmbeddedSessionSecret();
      console.log("✓ Security: Generated secure session secret for embedded mode");
      return;
    }

    if (isDevelopment) {
      process.env.SESSION_SECRET = `dev-secret-key-${generateEmbeddedSessionSecret()}`;
      warnings.push("SESSION_SECRET not set (using generated default for development only)");
      console.warn("⚠ Security: Generated development session secret");
      return;
    }

    if (isProduction) {
      const message = "SESSION_SECRET not set (REQUIRED for production)";
      console.error(`✗ Security: ${message}`);
      errors.push(message);
    }
    return;
  }

  validateExistingSecret(sessionSecret, isProduction, isEmbedded, errors, warnings);
}

function validateSyncConfig(localMode: boolean, isEmbedded: boolean, warnings: string[]): void {
  if (!localMode && !isEmbedded) {
    return;
  }

  if (process.env.TURSO_SYNC_URL && process.env.TURSO_AUTH_TOKEN) {
    console.log("✓ Sync: Turso cloud sync enabled");
    return;
  }

  if (isEmbedded) {
    console.log("ℹ Sync: Running offline-only (embedded deployment)");
    return;
  }

  console.warn("⚠ Sync: Running offline-only (no cloud sync configured)");
  warnings.push("Cloud sync not configured for local mode");
}

function logOptionalServices(isReplit: boolean): void {
  if (isReplit) {
    console.log("✓ Object Storage: Replit GCS available");
  } else {
    console.log("ℹ Object Storage: Disabled (not in Replit environment)");
  }

  if (process.env.OPENAI_API_KEY) {
    console.log("✓ AI Features: OpenAI API configured");
  } else {
    console.log("ℹ AI Features: OpenAI API key not set (AI reports disabled)");
  }
}

function outputResults(
  warnings: string[],
  errors: string[],
  isEmbedded: boolean,
  localMode: boolean
): void {
  console.log("======================================");

  if (warnings.length > 0) {
    console.warn("\n⚠️  WARNINGS:");
    warnings.forEach((w) => console.warn(`  - ${w}`));
  }

  if (errors.length > 0 && !isEmbedded && !localMode) {
    console.error("\n❌ CRITICAL CONFIGURATION ERRORS:");
    errors.forEach((e) => console.error(`  - ${e}`));
    console.error("\n⚠️ Application starting with configuration warnings.");
    console.error("Some features may not work correctly. Please review the above errors.\n");
    warnings.push(...errors.map((e) => `CRITICAL: ${e}`));
  }

  console.log("");
}

export function validateEnvironment(): EnvironmentConfig {
  console.log("\n=== ARUS Environment Configuration ===");

  const { isReplit, isDevelopment, isProduction, localMode, isEmbedded } = detectEnvironment();
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log(
    `Environment: ${isReplit ? "Replit" : isEmbedded ? "Embedded (iOS/macOS)" : "External/Self-hosted"}`
  );
  console.log(`Node Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Deployment Mode: ${localMode ? "VESSEL (Offline-First)" : "CLOUD (Online)"}`);

  validateDatabase(localMode, isEmbedded, errors);
  validateSessionSecret(isEmbedded, localMode, isDevelopment, isProduction, errors, warnings);
  validateSyncConfig(localMode, isEmbedded, warnings);
  logOptionalServices(isReplit);

  if (isProduction && isDevelopment) {
    errors.push("NODE_ENV is both production and development — configuration conflict");
  }
  if (isProduction && !process.env.SESSION_SECRET) {
    errors.push("Production deployment without SESSION_SECRET is insecure");
  }
  if (isDevelopment) {
    console.log("ℹ Auth: Development mode — auth bypass enabled for dev-admin-user");
  }

  outputResults(warnings, errors, isEmbedded, localMode);

  return {
    isReplit,
    isDevelopment,
    isProduction,
    isLocalMode: localMode,
    isEmbedded,
    hasDatabase: !!process.env.DATABASE_URL || localMode || isEmbedded,
    hasObjectStorage: isReplit,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasSessionSecret: !!process.env.SESSION_SECRET,
  };
}
