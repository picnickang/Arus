/**
 * Work Orders - Types and WebSocket Setup
 */

import type {
  WorkOrder,
  WorkOrderPart,
  WorkOrderTask,
  WorkOrderChecklist,
  WorkOrderWorklog,
  WorkOrderCompletion,
} from "@shared/schema";

export type {
  WorkOrder,
  WorkOrderPart,
  WorkOrderTask,
  WorkOrderChecklist,
  WorkOrderWorklog,
  WorkOrderCompletion,
};

export interface WorkOrderFilters {
  vesselId?: string;
  assignedCrewId?: string;
  status?: string;
  priority?: number;
  equipmentId?: string;
}

export interface WorkOrderPaginationResult {
  items: WorkOrder[];
  total: number;
}

interface WebSocketServerLike {
  broadcastWorkOrderChange(
    action: "create" | "update" | "delete",
    data: Record<string, unknown>
  ): void;
}

let wsServer: WebSocketServerLike | null = null;

export function setWorkOrderWebSocketServer(server: WebSocketServerLike | null) {
  wsServer = server;
}

export function getWebSocketServer(): WebSocketServerLike | null {
  return wsServer;
}

export function broadcastChange(
  action: "create" | "update" | "delete",
  data: Record<string, unknown>
) {
  const ws = getWebSocketServer();
  ws?.broadcastWorkOrderChange(action, data);
}
