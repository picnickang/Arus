/**
 * WebSocket Server Singleton
 * 
 * This module breaks the circular dependency between storage.ts and routes.ts
 * by providing a shared place to store the WebSocket server instance.
 */

import type { TelemetryWebSocketServer } from "./websocket";

let wsServer: TelemetryWebSocketServer | null = null;

export function setWebSocketServer(server: TelemetryWebSocketServer | null): void {
  wsServer = server;
}

export function getWebSocketServer(): TelemetryWebSocketServer | null {
  return wsServer;
}
