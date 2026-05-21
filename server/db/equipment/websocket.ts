/**
 * Equipment - WebSocket Setup
 */

interface EquipmentWebSocketServer {
  broadcastEquipmentChange: (action: "create" | "update" | "delete", payload: unknown) => void;
  broadcast?: (channel: string, payload: unknown, orgId?: string) => void;
}

let wsServer: EquipmentWebSocketServer | null = null;
export function setWebSocketServer(server: EquipmentWebSocketServer): void {
  wsServer = server;
}
export function getWebSocketServer(): EquipmentWebSocketServer | null {
  return wsServer;
}
