/**
 * Secure Command Execution Helper
 *
 * Security (S2076, S4036): This module provides a secure way to execute
 * external commands by:
 * 1. Only allowing explicitly allowlisted executables
 * 2. Resolving executable paths from trusted system locations only
 * 3. Using spawn with argument arrays (no shell interpolation)
 * 4. Validating all file paths to prevent path traversal
 *
 * SonarQube compliance: The allowlist pattern ensures the static analyzer
 * can verify that only constant, trusted executables are invoked.
 */

import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

/**
 * Allowlisted executables that can be invoked.
 * Adding a new executable requires explicit code change.
 */
export type TrustedExecutable =
  | "tar"
  | "node"
  | "tsx"
  | "git"
  | "npm"
  | "pg_dump"
  | "pg_restore"
  | "gzip";

/**
 * Trusted system paths where executables can be resolved.
 * Order matters - first match wins.
 */
const TRUSTED_PATHS = [
  "/usr/bin",
  "/usr/local/bin",
  "/run/current-system/sw/bin",
  "/nix/var/nix/profiles/default/bin",
  "/home/runner/.nix-profile/bin",
] as const;

/**
 * Internal mapping of executable names to their resolved paths.
 * Cached for performance.
 */
const resolvedPaths: Partial<Record<TrustedExecutable, string>> = {};

/**
 * Resolve an executable to its absolute path in trusted locations.
 * Security: Only searches in hardcoded trusted paths, never uses PATH.
 *
 * This function is exported for use cases that require direct spawn access
 * (e.g., piped streams) while still using the allowlisted executable pattern.
 *
 * @param executable - One of the allowlisted executable names
 * @returns Absolute path to the executable
 * @throws Error if executable not found in trusted locations
 */
export function resolveExecutable(executable: TrustedExecutable): string {
  // Return cached path if available
  if (resolvedPaths[executable]) {
    return resolvedPaths[executable];
  }

  // Search in trusted paths only
  for (const basePath of TRUSTED_PATHS) {
    const fullPath = path.join(basePath, executable);
    if (existsSync(fullPath)) {
      resolvedPaths[executable] = fullPath;
      return fullPath;
    }
  }

  throw new Error(
    `Security: Executable '${executable}' not found in trusted locations: ${TRUSTED_PATHS.join(", ")}`
  );
}

/**
 * Validate a file path to prevent path traversal attacks.
 * Security: Ensures the resolved path stays within the allowed base directory.
 *
 * @param basePath - The base directory that paths must be within
 * @param targetPath - The path to validate (can be relative or absolute)
 * @returns The validated absolute path
 * @throws Error if path traversal is detected
 */
export function validatePath(basePath: string, targetPath: string): string {
  const resolvedBase = realpathSync(basePath);
  const resolvedTarget = path.resolve(basePath, targetPath);

  // Normalize both paths for comparison
  const normalizedBase = path.normalize(resolvedBase);
  const normalizedTarget = path.normalize(resolvedTarget);

  // Containment check must be separator-aware: a bare `startsWith(base)` lets a
  // sibling directory through (e.g. base "/app/patches" would accept
  // "/app/patches-evil/x"). Require an exact match or a path *inside* base.
  if (
    normalizedTarget !== normalizedBase &&
    !normalizedTarget.startsWith(normalizedBase + path.sep)
  ) {
    throw new Error(
      `Security: Path traversal detected. Target '${targetPath}' escapes base '${basePath}'`
    );
  }

  return normalizedTarget;
}

/**
 * Options for command execution.
 */
export interface ExecOptions {
  /** Timeout in milliseconds. Default: 60000 (1 minute) */
  timeout?: number;
  /** Working directory for the command */
  cwd?: string;
  /** Environment variables to pass */
  env?: NodeJS.ProcessEnv;
}

/**
 * Result of command execution.
 */
export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a trusted command securely.
 *
 * Security (S2076): Uses spawn with argument array - no shell interpolation.
 * Security (S4036): Executable resolved from trusted paths only.
 *
 * @param executable - One of the allowlisted executable names (compile-time checked)
 * @param args - Array of arguments (each arg is passed as-is, never interpreted)
 * @param options - Execution options
 * @returns Promise resolving to stdout/stderr/exitCode
 * @throws Error on non-zero exit code or timeout
 *
 * @example
 * // Extract a tar archive securely
 * await runTrustedExecutable("tar", ["-xzf", archivePath, "-C", extractDir]);
 *
 * @example
 * // Run a Node script securely
 * await runTrustedExecutable("tsx", ["server/scripts/migrate.ts"]);
 */
export function runTrustedExecutable(
  executable: TrustedExecutable,
  args: string[],
  options: ExecOptions = {}
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    // Resolve executable from trusted paths (compile-time type ensures allowlist)
    const execPath = resolveExecutable(executable);

    const timeout = options.timeout ?? 60000;

    // Spawn with explicit shell: false (default, but being explicit for security)
    const proc = spawn(execPath, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false, // Security: Never use shell interpretation
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    // Set up timeout
    const timer = setTimeout(() => {
      killed = true;
      proc.kill("SIGTERM");
      setTimeout(() => proc.kill("SIGKILL"), 5000); // Force kill after 5s
    }, timeout);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timer);

      if (killed) {
        reject(new Error(`Command timed out after ${timeout}ms: ${executable} ${args.join(" ")}`));
        return;
      }

      const exitCode = code ?? 1;

      if (exitCode === 0) {
        resolve({ stdout, stderr, exitCode });
      } else {
        reject(
          new Error(
            `Command failed with exit code ${exitCode}: ${executable} ${args.join(" ")}\nStderr: ${stderr}`
          )
        );
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to execute ${executable}: ${err.message}`));
    });
  });
}

/**
 * Execute a trusted command and return only stdout.
 * Convenience wrapper around runTrustedExecutable.
 */
export async function execTrusted(
  executable: TrustedExecutable,
  args: string[],
  options: ExecOptions = {}
): Promise<string> {
  const result = await runTrustedExecutable(executable, args, options);
  return result.stdout;
}
