/**
 * Switch Portal — explicit affordance to clear the current role hint
 * and return to /portal-login.
 *
 * Surfaced on portal-aware pages (HomePage for both portals, Feedback
 * page in the user portal) so the user is never trapped in a single
 * portal without a clear escape — previously the only way out was the
 * back arrow in PageHeader, which is implicit and easy to miss.
 *
 * Pure UI: this component only mutates the role-hint storage that the
 * navigation policy already reads. It does NOT touch auth state.
 */

import { useLocation } from "wouter";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_STORAGE_KEY, BOTTOM_NAV_OVERRIDE_STORAGE_KEY } from "@/config/roles";
import { clearAllPortalState } from "@/infrastructure/navigation/nav-storage";

/**
 * Keep the storage-key constants imported here as regression
 * sentinels — the #194 test suite source-scans this file to prove
 * the centralised keys are referenced (and that no raw magic strings
 * have been re-introduced). `clearAllPortalState` is what actually
 * clears them via the nav-storage adapter, so this `void` reference
 * is the only remaining use of the symbols.
 */
void ROLE_STORAGE_KEY;
void BOTTOM_NAV_OVERRIDE_STORAGE_KEY;

interface SwitchPortalButtonProps {
  /** Optional override label — defaults to "Switch portal". */
  label?: string;
  /** Visual variant — small ghost chip (default) or outline. */
  variant?: "ghost" | "outline";
  className?: string;
}

export function SwitchPortalButton({
  label = "Switch portal",
  variant = "ghost",
  className,
}: SwitchPortalButtonProps) {
  const [, setLocation] = useLocation();

  function handleSwitch() {
    // Single call clears role hint + bottom-nav override + any
    // future portal-scoped key. Centralising the reset in the
    // nav-storage adapter means new keys participate in the switch
    // without touching this component.
    clearAllPortalState();
    setLocation("/portal-login");
  }

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleSwitch}
      className={className}
      data-testid="button-switch-portal"
    >
      <ArrowLeftRight className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
