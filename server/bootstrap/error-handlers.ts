/**
 * Process Error Handlers
 * Handles uncaught exceptions and unhandled rejections with graceful handling for embedded mode
 */

let startupComplete = false;

export function markStartupComplete(): void {
  startupComplete = true;
}

export function isStartupComplete(): boolean {
  return startupComplete;
}

export function setupErrorHandlers(): void {
  process.on("uncaughtException", (error) => {
    const isMqttConnectionError =
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("ENOTFOUND") ||
      (error as any).code === "ECONNREFUSED" ||
      (error as any).code === "ENOTFOUND";

    const isNeonWebSocketError =
      error.message?.includes("Cannot set property message of") ||
      error.message?.includes("which has only a getter") ||
      error.stack?.includes("@neondatabase/serverless");

    const isEmbeddedMode = process.env.EMBEDDED_MODE === "true";
    const isLocalMode = process.env.LOCAL_MODE === "true";

    if ((isEmbeddedMode || isLocalMode) && isMqttConnectionError) {
      return;
    }

    if (isNeonWebSocketError) {
      console.warn("⚠️ Neon WebSocket connection error (transient, retrying...)");
      return;
    }

    console.error("❌ UNCAUGHT EXCEPTION:", error);
    console.error("Stack trace:", error.stack);

    if (isEmbeddedMode || startupComplete) {
      console.error("⚠️ Error logged but server continuing (embedded/runtime mode)");
      return;
    }

    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ UNHANDLED REJECTION:", reason);
    console.error("Promise:", promise);

    if (process.env.EMBEDDED_MODE === "true" || startupComplete) {
      console.error("⚠️ Rejection logged but server continuing (embedded/runtime mode)");
      return;
    }

    process.exit(1);
  });
}
