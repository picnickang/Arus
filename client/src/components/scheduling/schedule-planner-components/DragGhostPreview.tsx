

import {
  RefreshCw,
  Move,
} from "lucide-react";


import { cn } from "@/lib/utils";






export function DragGhostPreview({
  crewName,
  canAssign,
  isLoading,
  projectedRestHours,
  position,
}: {
  crewName: string;
  canAssign: boolean;
  isLoading: boolean;
  projectedRestHours?: number;
  position: { x: number; y: number };
}) {
  return (
    <div
      className={cn(
        "fixed z-[9999] pointer-events-none select-none",
        "bg-primary text-primary-foreground rounded-md px-3 py-2 shadow-lg",
        "flex items-center gap-2 text-sm font-medium",
        "animate-in fade-in-0 zoom-in-95 duration-100"
      )}
      style={{
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -50%)",
      }}
      data-testid="drag-ghost-preview"
    >
      <Move className="h-3 w-3 shrink-0 opacity-60" />
      <span className="truncate max-w-[120px]">{crewName}</span>
      {isLoading ? (
        <RefreshCw className="h-3 w-3 animate-spin shrink-0" />
      ) : (
        <div
          className={cn("w-3 h-3 rounded-full shrink-0", canAssign ? "bg-green-400" : "bg-red-400")}
        />
      )}
      {!isLoading && projectedRestHours !== undefined && (
        <span className="text-xs opacity-80">{projectedRestHours}h rest</span>
      )}
    </div>
  );
}

