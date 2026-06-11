#!/usr/bin/env node
/**
 * Wrapper that uses tsx to run TypeScript source directly
 * This avoids all esbuild ESM bundling issues
 *
 * CRITICAL: We do NOT exit after spawn - tsx keeps running with the HTTP server
 */

const { spawn } = require("child_process");
const path = require("path");

console.log("🚀 Starting ARUS server via tsx...");

// NOSONAR: S4036 - spawn with array args; path is from controlled filesystem
const serverPath = path.join(__dirname, "index.ts");
const tsxProcess = spawn("npx", ["tsx", serverPath], {
  stdio: "inherit",
  env: { ...process.env },
});

tsxProcess.on("error", (error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});

tsxProcess.on("exit", (code, signal) => {
  console.log(`📴 Server exited (code: ${code}, signal: ${signal})`);
  if (code !== 0 && code !== null) {
    process.exit(code);
  }
});

// Keep this process alive - it manages the tsx subprocess
console.log("✅ Server wrapper running, managing tsx subprocess");
