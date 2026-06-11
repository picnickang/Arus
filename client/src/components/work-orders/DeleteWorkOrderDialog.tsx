import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";

interface Dependents {
  workOrderId: string;
  cascade: { parts: number; checklists: number; worklogs: number };
  linked: {
    purchaseRequests: number;
    serviceRequests: number;
    serviceOrders: number;
  };
  totals: { cascade: number; linked: number };
}

interface Props {
  workOrderId: string | null;
  workOrderLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function DeleteWorkOrderDialog({
  workOrderId,
  workOrderLabel,
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: Props) {
  const { data, isLoading, isError } = useQuery<Dependents>({
    queryKey: ["/api/work-orders", workOrderId, "dependents"],
    enabled: !!workOrderId && open,
    staleTime: 0,
  });

  const cascadeRows: Array<[string, number]> = data
    ? (
        [
          ["Parts", data.cascade.parts],
          ["Checklists", data.cascade.checklists],
          ["Worklogs", data.cascade.worklogs],
        ] as Array<[string, number]>
      ).filter(([, n]) => n > 0)
    : [];

  const linkedRows: Array<[string, number]> = data
    ? (
        [
          ["Purchase Requests", data.linked.purchaseRequests],
          ["Service Requests", data.linked.serviceRequests],
          ["Service Orders", data.linked.serviceOrders],
        ] as Array<[string, number]>
      ).filter(([, n]) => n > 0)
    : [];

  const hasLinked = (data?.totals.linked ?? 0) > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="dialog-delete-work-order">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete work order {workOrderLabel}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>This action cannot be undone.</p>

              {isLoading && <Skeleton className="h-16 w-full" />}

              {isError && (
                <p className="text-sm text-destructive">
                  Could not load dependent records. Please retry before deleting.
                </p>
              )}

              {data && cascadeRows.length === 0 && linkedRows.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No dependent records — safe to delete.
                </p>
              )}

              {cascadeRows.length > 0 && (
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <p className="text-sm font-medium mb-1">Will also be deleted:</p>
                  <ul className="text-sm space-y-0.5">
                    {cascadeRows.map(([label, n]) => (
                      <li key={label} data-testid={`cascade-${label.toLowerCase()}`}>
                        • {n} {label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {hasLinked && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                  <p className="text-sm font-medium mb-1 flex items-center gap-1.5 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Linked records that will be orphaned:
                  </p>
                  <ul className="text-sm space-y-0.5">
                    {linkedRows.map(([label, n]) => (
                      <li
                        key={label}
                        data-testid={`linked-${label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        • {n} {label}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    These records will remain but lose their work-order link. Consider reviewing
                    them first.
                  </p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
          <AlertDialogAction
            data-testid="button-confirm-delete"
            disabled={isDeleting || isLoading || isError || !data}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting…" : "Delete work order"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
