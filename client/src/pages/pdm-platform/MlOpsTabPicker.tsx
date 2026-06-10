import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

export interface MlOpsTabDef {
  id: string;
  label: string;
  icon: LucideIcon;
}

const GATE_NOTE = "Visible with the Predictive Maintenance manage-config permission";

/**
 * Grouped picker for the ML-engineer tabs. One component, two
 * presentations: a dropdown styled as a trailing tab on desktop, a vaul
 * bottom sheet on mobile. Selecting an item drives the same validated
 * ?tab= URL sync as the flat tab triggers it replaces.
 */
export function MlOpsTabPicker({
  tabs,
  activeTab,
  onSelect,
}: {
  tabs: MlOpsTabDef[];
  activeTab: string;
  onSelect: (tab: string) => void;
}) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const isActiveGroup = tabs.some((t) => t.id === activeTab);
  const triggerClasses = `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
    isActiveGroup ? "bg-sky-500/15 text-sky-400" : "text-slate-400 hover:text-slate-200"
  }`;

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          className={triggerClasses}
          onClick={() => setSheetOpen(true)}
          data-testid="tab-mlops-trigger"
        >
          ML <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
          <DrawerContent data-testid="mlops-sheet">
            <DrawerHeader className="text-left">
              <DrawerTitle>ML Ops</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6 space-y-1">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium ${
                    activeTab === id ? "bg-accent" : ""
                  }`}
                  onClick={() => {
                    setSheetOpen(false);
                    onSelect(id);
                  }}
                  data-testid={`tab-${id}`}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" /> {label}
                </button>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">{GATE_NOTE}</p>
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClasses} data-testid="tab-mlops-trigger">
        ML Ops <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>ML Ops</DropdownMenuLabel>
        {tabs.map(({ id, label, icon: Icon }) => (
          <DropdownMenuItem key={id} onSelect={() => onSelect(id)} data-testid={`tab-${id}`}>
            <Icon className="mr-2 h-4 w-4 text-muted-foreground" /> {label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground">{GATE_NOTE}</div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
