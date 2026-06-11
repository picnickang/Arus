/** Shared permission/status/loading UI primitives for the diagram-registry
 * screen family. Extracted verbatim from the pre-split registry-screens.tsx. */

import { type ReactNode } from "react";
import { Loader2, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDate as formatDateBase } from "@/lib/formatters";

export interface PermissionSet {
  canConfigure: boolean;
  canUploadDiagram: boolean;
  canRollbackDiagram: boolean;
  canEditMap: boolean;
  canPublishMap: boolean;
  canReplaceSectionThumbnail: boolean;
  canReplaceEquipmentThumbnail: boolean;
  canAssignEquipment: boolean;
}

export function PermissionDeniedInline({ message }: { message: string }) {
  return (
    <Alert>
      <AlertTitle>Permission denied</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function DeadControlGuard({
  allowed,
  reason,
  children,
}: {
  allowed: boolean;
  reason: string;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex flex-col gap-1">
      {children}
      {!allowed && <span className="text-xs text-muted-foreground">{reason}</span>}
    </span>
  );
}

export function ActionButton({
  icon: Icon,
  label,
  allowed,
  reason = "Not available",
  loading,
  testId,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  allowed: boolean;
  reason?: string;
  loading?: boolean;
  testId?: string;
  onClick: () => void;
}) {
  return (
    <DeadControlGuard allowed={allowed} reason={reason}>
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={!allowed || loading}
        title={allowed ? label : reason}
        data-testid={testId}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Icon className="mr-2 h-4 w-4" />
        )}
        {label}
      </Button>
    </DeadControlGuard>
  );
}

export function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

export function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {message}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// Output matches the pre-split local helper (browser-locale numeric date,
// "Not recorded" for missing/invalid values) via the canonical formatter.
const REGISTRY_DATE_FORMAT = {
  locale: "auto",
  month: "numeric",
  hour: undefined,
  minute: undefined,
  fallback: "Not recorded",
} as const;

export function formatDate(value: string | Date | null | undefined) {
  return formatDateBase(value, REGISTRY_DATE_FORMAT);
}
