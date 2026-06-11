import { useCallback, useState } from "react";
import { shouldInterceptClose } from "@/lib/discard-guard";
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

interface DiscardGuardOptions {
  /** Usually react-hook-form's `formState.isDirty`, or a computed draft-vs-initial flag. */
  isDirty: boolean;
  /** The dialog's original open-state setter (e.g. the `onOpenChange`/`onClose` prop). */
  onOpenChange: (open: boolean) => void;
}

/**
 * Intercepts dialog close while the form has unsaved edits. Closing a clean
 * dialog stays instant; a dirty close opens a confirm step instead. Render the
 * returned state through `DiscardConfirmDialog` next to the guarded dialog.
 */
export function useDiscardGuard({ isDirty, onOpenChange }: DiscardGuardOptions) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (shouldInterceptClose(open, isDirty)) {
        setConfirmOpen(true);
        return;
      }
      onOpenChange(open);
    },
    [isDirty, onOpenChange]
  );

  const onConfirm = useCallback(() => {
    setConfirmOpen(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const onCancel = useCallback(() => setConfirmOpen(false), []);

  return { handleOpenChange, confirmOpen, onConfirm, onCancel };
}

interface DiscardConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DiscardConfirmDialog({ open, onConfirm, onCancel }: DiscardConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent data-testid="dialog-discard-guard">
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>
            Your edits haven&apos;t been saved and will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} data-testid="button-discard-cancel">
            Keep editing
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-discard-confirm"
          >
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
