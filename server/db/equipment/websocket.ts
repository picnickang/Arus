/**
 * Equipment - WebSocket Setup
 */

let wsServer: any = null;
export function setWebSocketServer(server: any) { wsServer = server; }
export function getWebSocketServer() { return wsServer; }
