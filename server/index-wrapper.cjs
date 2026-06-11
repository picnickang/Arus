#!/usr/bin/env node
/**
 * Wrapper for bundled CommonJS server
 *
 * The bundled server (index.cjs) is in CommonJS format.
 * This wrapper is also CommonJS and simply requires the bundle.
 *
 * CRITICAL: We do NOT exit after require completes - the HTTP server
 * inside index.cjs is listening and will keep the process alive.
 */

try {
  console.log("🚀 Loading ARUS server...");
  require("./index.cjs");
  console.log("✅ Server loaded successfully, HTTP server is running");
  // DO NOT call process.exit() - the HTTP server is listening and keeps the process alive
} catch (error) {
  console.error("❌ Server initialization failed:", error);
  console.error("Error name:", error.name);
  console.error("Error message:", error.message);
  console.error("Stack trace:", error.stack);
  process.exit(1);
}
