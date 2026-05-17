// @ts-nocheck
/**
 * PostgreSQL Dump Executor - Handles pg_dump execution with compression
 *
 * Security (S2076, S4036): Uses resolveExecutable from secure-exec module
 * which resolves binaries from compile-time allowlisted names only.
 */

import { spawn } from "node:child_process";
import { BACKUP_CONFIG } from "./types";
import { resolveExecutable } from "../lib/secure-exec";

export async function executePgDump(
  args: string[],
  outputPath: string,
  password: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PGPASSWORD: password };
    // Security (S2076, S4036): resolveExecutable uses constant 'pg_dump' from allowlist
    const pgDumpPath = resolveExecutable("pg_dump");

    const pgDump = spawn(pgDumpPath, args, { env, shell: false });
    let outputStream = pgDump.stdout;
    let gzipProcess: ReturnType<typeof spawn> | null = null;

    if (BACKUP_CONFIG.compression.enabled) {
      // Security (S2076, S4036): resolveExecutable uses constant 'gzip' from allowlist
      const gzipPath = resolveExecutable("gzip");
      gzipProcess = spawn(gzipPath, [`-${BACKUP_CONFIG.compression.level}`], { shell: false });

      gzipProcess.on("error", (error: Error) => {
        reject(new Error(`gzip compression failed: ${error.message}`));
      });

      pgDump.stdout.pipe(gzipProcess.stdin);
      outputStream = gzipProcess.stdout;
    }

    const writeStream = require("node:fs").createWriteStream(outputPath);
    outputStream.pipe(writeStream);

    let totalBytes = 0;
    let stderr = "";
    const errors: Error[] = [];

    outputStream.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
    });

    pgDump.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    pgDump.on("error", (error: Error) => {
      errors.push(new Error(`Failed to spawn pg_dump: ${error.message}`));
    });

    if (gzipProcess) {
      gzipProcess.stderr.on("data", (data: Buffer) => {
        stderr += `[gzip] ${data.toString()}`;
      });
    }

    writeStream.on("error", (error: Error) => {
      errors.push(new Error(`Write stream error: ${error.message}`));
    });

    let processesCompleted = 0;
    const totalProcesses = gzipProcess ? 3 : 2;

    function checkCompletion(processName: string, code?: number) {
      processesCompleted++;

      if (errors.length > 0) {
        reject(errors[0]);
        return;
      }

      if (processName === "pg_dump" && code !== 0) {
        reject(new Error(`pg_dump failed with code ${code}: ${stderr}`));
        return;
      }

      if (processName === "gzip" && code !== 0) {
        reject(new Error(`gzip failed with code ${code}: ${stderr}`));
        return;
      }

      if (processesCompleted === totalProcesses) {
        resolve(totalBytes);
      }
    }

    pgDump.on("close", (code) => {
      checkCompletion("pg_dump", code);
    });

    if (gzipProcess) {
      gzipProcess.on("close", (code: number) => {
        checkCompletion("gzip", code);
      });
    }

    writeStream.on("finish", () => {
      checkCompletion("writeStream");
    });
  });
}
