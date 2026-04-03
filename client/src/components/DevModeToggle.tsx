/**
 * DevModeToggle - Temporary Development Mode Toggle
 * 
 * TEMPORARY: This component is for development/testing purposes only.
 * Remove this file and its usage when RBAC is fully implemented and tested.
 * 
 * Usage: Import and place on any page. Click to toggle dev mode.
 * - Blue (Shield icon): Dev mode ON - all permissions granted
 * - Red (ShieldOff icon): Dev mode OFF - actual role permissions enforced
 */

import { useState, useEffect } from "react";
import { Shield, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const DEV_MODE_KEY = "arus_dev_mode_override";

export function getDevModeOverride(): boolean {
  if (!import.meta.env.DEV) return false;
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEV_MODE_KEY) === "true";
}

export function setDevModeOverride(enabled: boolean): void {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  localStorage.setItem(DEV_MODE_KEY, enabled ? "true" : "false");
  window.dispatchEvent(new CustomEvent("devModeChange", { detail: { enabled } }));
}

export function DevModeToggle() {
  if (!import.meta.env.DEV) return null;
  const [isDevMode, setIsDevMode] = useState(getDevModeOverride);

  useEffect(() => {
    const handleStorageChange = () => {
      setIsDevMode(getDevModeOverride());
    };

    const handleDevModeChange = (e: CustomEvent<{ enabled: boolean }>) => {
      setIsDevMode(e.detail.enabled);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("devModeChange", handleDevModeChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("devModeChange", handleDevModeChange as EventListener);
    };
  }, []);

  const toggle = () => {
    const newValue = !isDevMode;
    setDevModeOverride(newValue);
    setIsDevMode(newValue);
    window.location.reload();
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          onClick={toggle}
          className={isDevMode ? "text-blue-500 hover:text-blue-600" : "text-red-500 hover:text-red-600"}
          data-testid="button-dev-mode-toggle"
        >
          {isDevMode ? <Shield className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isDevMode ? "Dev Mode ON (Full Permissions)" : "Dev Mode OFF (Role Permissions)"}</p>
        <p className="text-xs text-muted-foreground">Click to toggle</p>
      </TooltipContent>
    </Tooltip>
  );
}
