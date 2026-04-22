import { Equipment } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Calendar, User, FileText, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { equipmentKeys } from "@/utils/queryKeys";
import { format } from "date-fns";

interface EquipmentHistoryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
}

interface LifecycleEvent {
  id: string;
  eventType: string;
  eventDate: string;
  reason?: string;
  notes?: string;
  performedBy?: string;
  createdAt: string;
}

export function EquipmentHistoryDialog({
  isOpen,
  onOpenChange,
  equipment,
}: EquipmentHistoryDialogProps) {
  const { data: history = [], isLoading } = useQuery<LifecycleEvent[]>({
    queryKey: equipmentKeys.history(equipment?.id || ""),
    queryFn: () => apiRequest("GET", `/api/equipment/${equipment?.id}/history`),
    enabled: isOpen && !!equipment?.id,
  });

  if (!equipment) {
    return null;
  }

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "decommissioned":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "reinstated":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "created":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const formatEventType = (eventType: string) => {
    return eventType.charAt(0).toUpperCase() + eventType.slice(1);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Equipment History
          </DialogTitle>
          <DialogDescription>Lifecycle history for {equipment.name}</DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 rounded-md p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-muted-foreground">Equipment:</span>{" "}
              <span className="font-medium">{equipment.name}</span>
            </div>
            <Badge variant={equipment.isActive ? "default" : "secondary"}>
              {equipment.isActive ? "Active" : "Decommissioned"}
            </Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Type:</span>{" "}
            <span className="font-medium">{equipment.type}</span>
          </div>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <History className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No History Available</p>
              <p className="text-sm">No lifecycle events have been recorded for this equipment.</p>
            </div>
          ) : (
            <div className="relative space-y-0">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
              {history.map((event, index) => (
                <div key={event.id} className="relative pl-10 pb-6">
                  <div className="absolute left-2 w-4 h-4 rounded-full bg-background border-2 border-primary" />
                  <div className="bg-card border rounded-md p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Badge className={getEventColor(event.eventType)}>
                        {formatEventType(event.eventType)}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(event.eventDate), "MMM d, yyyy 'at' h:mm a")}
                      </div>
                    </div>
                    {event.reason && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Reason:</span>{" "}
                        <span>{event.reason}</span>
                      </div>
                    )}
                    {event.notes && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{event.notes}</span>
                      </div>
                    )}
                    {event.performedBy && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{event.performedBy}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
