import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Trash2, Loader2, Calendar, Clock, Building2, Wrench, Pencil } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface ServiceOrderCardData {
  id: string;
  soNumber: string;
  status: string;
  serviceProviderId?: string;
  serviceProviderName?: string;
  scope?: string;
  equipmentName?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  estimatedDurationHours?: number;
}

interface ServiceOrderCardProps {
  serviceOrder: ServiceOrderCardData;
  onDelete?: (id: string) => void;
  onEdit?: (serviceOrder: ServiceOrderCardData) => void;
  isDeleting?: boolean;
  isReadOnly?: boolean;
  canApprove?: boolean;
  canEditPermission?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  confirmed: "bg-purple-100 text-purple-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function ServiceOrderCard({
  serviceOrder,
  onDelete,
  onEdit,
  isDeleting,
  isReadOnly = false,
  canApprove = false,
  canEditPermission = false,
}: ServiceOrderCardProps) {
  const isDraft = serviceOrder.status === "draft";
  const isDraftOrCancelled = isDraft || serviceOrder.status === "cancelled";
  const canDelete = isDraftOrCancelled ? canEditPermission : canApprove;
  const canEditRecord = isDraft ? canEditPermission : canApprove;

  return (
    <div className="p-4 rounded-lg border bg-muted/30" data-testid={`so-item-${serviceOrder.id}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{serviceOrder.soNumber}</span>
            <Badge className={STATUS_COLORS[serviceOrder.status] || "bg-gray-100"}>
              {serviceOrder.status.replace("_", " ")}
            </Badge>
          </div>

          {serviceOrder.scope && (
            <p className="text-sm text-foreground line-clamp-2">{serviceOrder.scope}</p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {serviceOrder.serviceProviderName && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {serviceOrder.serviceProviderName}
              </span>
            )}
            {serviceOrder.equipmentName && (
              <span className="flex items-center gap-1">{serviceOrder.equipmentName}</span>
            )}
            {serviceOrder.scheduledStartDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(serviceOrder.scheduledStartDate), "MMM d, yyyy")}
              </span>
            )}
            {serviceOrder.estimatedDurationHours && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {serviceOrder.estimatedDurationHours}h estimated
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isReadOnly && canEditRecord && onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(serviceOrder)}
              data-testid={`btn-edit-so-${serviceOrder.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {!isReadOnly && canDelete && onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  disabled={isDeleting}
                  data-testid={`btn-delete-so-${serviceOrder.id}`}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Service Order?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete service order {serviceOrder.soNumber}. This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(serviceOrder.id)}
                    className="bg-destructive text-destructive-foreground"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                data-testid={`btn-view-so-${serviceOrder.id}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  {serviceOrder.soNumber}
                </DialogTitle>
                <DialogDescription>Service order details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge className={STATUS_COLORS[serviceOrder.status] || "bg-gray-100"}>
                    {serviceOrder.status.replace("_", " ")}
                  </Badge>
                </div>
                {serviceOrder.scope && (
                  <div>
                    <span className="text-sm font-medium">Scope</span>
                    <p className="text-sm text-muted-foreground mt-1">{serviceOrder.scope}</p>
                  </div>
                )}
                {serviceOrder.serviceProviderName && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{serviceOrder.serviceProviderName}</span>
                  </div>
                )}
                {serviceOrder.equipmentName && (
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{serviceOrder.equipmentName}</span>
                  </div>
                )}
                {serviceOrder.scheduledStartDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Scheduled: {format(new Date(serviceOrder.scheduledStartDate), "MMM d, yyyy")}
                      {serviceOrder.scheduledEndDate &&
                        ` - ${format(new Date(serviceOrder.scheduledEndDate), "MMM d, yyyy")}`}
                    </span>
                  </div>
                )}
                {serviceOrder.estimatedDurationHours && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {serviceOrder.estimatedDurationHours} hours estimated
                    </span>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
