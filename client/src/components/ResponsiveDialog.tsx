import { useEffect, useRef } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";

interface ResponsiveDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  className,
}: ResponsiveDialogProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const previousIsMobile = useRef(isMobile);

  // Handle viewport changes while dialog is open
  useEffect(() => {
    if (open && previousIsMobile.current !== isMobile) {
      // Close and reopen to force remount with correct component
      if (onOpenChange) {
        onOpenChange(false);
        setTimeout(() => onOpenChange(true), 50);
      }
    }
    previousIsMobile.current = isMobile;
  }, [isMobile, open, onOpenChange]);

  if (isMobile) {
    return (
      <Sheet key="mobile-sheet" {...(open !== undefined && { open })} {...(onOpenChange !== undefined && { onOpenChange })}>
        {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
        <SheetContent side="bottom" className={`max-h-[90vh] overflow-y-auto ${className || ""}`}>
          <SheetHeader>
            {title && <SheetTitle>{title}</SheetTitle>}
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className="py-4">{children}</div>
          {footer && (
            <SheetFooter className="sticky bottom-0 bg-background pt-4 border-t">
              {footer}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog key="desktop-dialog" {...(open !== undefined && { open })} {...(onOpenChange !== undefined && { onOpenChange })}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={className}>
        <DialogHeader>
          {title && <DialogTitle>{title}</DialogTitle>}
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div>{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
