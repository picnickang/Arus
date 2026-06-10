import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Ship, Cog, Wrench, FileText, Plus } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useGlobalSearchResults } from "./useGlobalSearchResults";
import { getPageItems, getVerbActions } from "./search-actions";

export const OPEN_COMMAND_PALETTE_EVENT = "arus:open-command-palette";

/**
 * Global quick-switcher (Cmd/Ctrl-K on desktop, search-button sheet on
 * mobile). One content component, two shells; results jump laterally —
 * vessels, equipment, work orders, pages and verb actions — without
 * walking the hub tree.
 */
export default function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { permissions } = usePermissions();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    };
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      setLocation(href);
    },
    [setLocation]
  );

  const { active, debounced, vesselMatches, equipmentMatches, workOrderMatches } =
    useGlobalSearchResults(query, open);
  const pageItems = active ? getPageItems(debounced, permissions.hubAccess) : [];
  const verbActions = active ? getVerbActions(debounced) : [];
  const hasResults =
    vesselMatches.length > 0 ||
    equipmentMatches.length > 0 ||
    workOrderMatches.length > 0 ||
    pageItems.length > 0 ||
    verbActions.length > 0;

  const content = (
    <>
      <CommandInput
        placeholder="Search vessels, equipment, work orders, pages…"
        value={query}
        onValueChange={setQuery}
        data-testid="input-global-search"
      />
      <CommandList data-testid="global-search-results">
        {active && !hasResults && <CommandEmpty>No results for “{debounced}”.</CommandEmpty>}
        {!active && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Type at least 2 characters to search.
          </div>
        )}
        {vesselMatches.length > 0 && (
          <CommandGroup heading="Vessels">
            {vesselMatches.map((v) => (
              <CommandItem
                key={v.id}
                value={`vessel-${v.id}-${v.name}`}
                onSelect={() => go(`/vessels/${v.id}`)}
                data-testid={`search-vessel-${v.id}`}
              >
                <Ship className="mr-2 h-4 w-4 text-muted-foreground" /> {v.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {equipmentMatches.length > 0 && (
          <CommandGroup heading="Equipment">
            {equipmentMatches.map((eq) => (
              <CommandItem
                key={eq.id}
                value={`equipment-${eq.id}-${eq.name}`}
                onSelect={() => go(`/equipment/${eq.id}`)}
                data-testid={`search-equipment-${eq.id}`}
              >
                <Cog className="mr-2 h-4 w-4 text-muted-foreground" /> {eq.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {workOrderMatches.length > 0 && (
          <CommandGroup heading="Work orders">
            {workOrderMatches.map((wo) => (
              <CommandItem
                key={wo.id}
                value={`wo-${wo.id}-${wo.woNumber ?? ""}`}
                onSelect={() => go(`/work-orders?search=${encodeURIComponent(wo.woNumber ?? "")}`)}
                data-testid={`search-wo-${wo.id}`}
              >
                <Wrench className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="truncate">
                  {wo.woNumber ?? wo.id} · {wo.reason ?? wo.description ?? ""}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {pageItems.length > 0 && (
          <CommandGroup heading="Pages">
            {pageItems.map((p) => (
              <CommandItem
                key={p.id}
                value={p.id + p.label}
                onSelect={() => go(p.href)}
                data-testid={`search-${p.id}`}
              >
                <FileText className="mr-2 h-4 w-4 text-muted-foreground" /> {p.label}
                <span className="ml-2 text-xs text-muted-foreground">{p.sublabel}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {verbActions.length > 0 && (
          <CommandGroup heading="Actions">
            {verbActions.map((a) => (
              <CommandItem
                key={a.id}
                value={a.id + a.label}
                onSelect={() => go(a.href)}
                data-testid={`search-${a.id}`}
              >
                <Plus className="mr-2 h-4 w-4 text-muted-foreground" /> {a.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-dvh p-0" data-testid="global-search-sheet">
          <SheetHeader className="sr-only">
            <SheetTitle>Search</SheetTitle>
          </SheetHeader>
          <Command shouldFilter={false} className="h-full">
            {content}
          </Command>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-lg" data-testid="global-search-dialog">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-12"
        >
          {content}
        </Command>
      </DialogContent>
    </Dialog>
  );
}
