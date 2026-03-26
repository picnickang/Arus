import { useState, useEffect, useCallback } from "react";
import { Anchor, X, GripHorizontal, Plus, Check, Pin } from "lucide-react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";
import { DevModeToggle } from "@/components/DevModeToggle";
import { navigationCategories, getAllNavigationItems, migrateRoute, type NavigationItem, type NavigationCategory } from "@/config/navigationConfig";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const DOCK_STORAGE_KEY = "arus-dock-items";
const DOCK_TOOLTIP_DISMISSED_KEY = "arus-dock-tooltip-dismissed";
const MAX_DOCK_ITEMS = 6;

interface CategoryCardProps {
  category: NavigationCategory;
  onAddToDock: (item: NavigationItem) => void;
  dockItems: NavigationItem[];
}

function CategoryCard({ category, onAddToDock, dockItems }: CategoryCardProps) {
  const Icon = category.icon;
  const hubItem: NavigationItem = {
    name: category.name,
    href: category.hubRoute,
    icon: category.icon,
    description: category.description,
  };
  const isInDock = dockItems.some(d => d.href === category.hubRoute);
  
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group relative flex flex-col items-center justify-center",
            "transition-all duration-200 ease-out",
            "hover:scale-105 active:scale-95"
          )}
          data-testid={`category-card-${category.id}`}
        >
          <div className="relative">
            <Link href={category.hubRoute} className="block">
              <div className={cn(
                "w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center cursor-pointer",
                "bg-primary shadow-lg",
                "group-hover:shadow-xl group-hover:bg-primary/90",
                "transition-all duration-200"
              )}>
                <Icon className="h-8 w-8 sm:h-10 sm:w-10 text-primary-foreground" strokeWidth={2} />
              </div>
            </Link>
            {!isInDock && (
              <button
                type="button"
                className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 rounded-full bg-background border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-muted"
                onClick={(e) => { e.stopPropagation(); onAddToDock(hubItem); }}
                aria-label={`Pin ${category.name} to Dock`}
                data-testid={`button-pin-${category.id}`}
              >
                <Pin className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
            {isInDock && (
              <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 flex items-center justify-center" aria-label="Pinned to Dock">
                <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
              </div>
            )}
          </div>
          <Link href={category.hubRoute}>
            <span className="mt-2 text-xs sm:text-sm font-medium text-center text-foreground line-clamp-1 max-w-[80px] sm:max-w-[100px] block cursor-pointer">
              {category.name}
            </span>
            <span className="text-[10px] text-muted-foreground text-center line-clamp-1 max-w-[80px] sm:max-w-[100px] hidden sm:block">
              {category.description}
            </span>
          </Link>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem 
          onClick={() => onAddToDock(hubItem)} 
          disabled={isInDock}
          data-testid={`menu-add-dock-${category.id}`}
        >
          {isInDock ? (
            <>
              <Check className="h-4 w-4 mr-2 text-green-500" />
              Already in Dock
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Add to Dock
            </>
          )}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function DockIcon({ item, onRemove }: { item: NavigationItem; onRemove: () => void }) {
  const Icon = item.icon;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Link href={item.href}>
          <div
            className="group flex flex-col items-center cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95"
            data-testid={`dock-item-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <div className={cn(
              "w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center",
              "bg-primary shadow-md",
              "group-hover:shadow-lg transition-shadow"
            )}>
              <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground" strokeWidth={2} />
            </div>
            <span className="mt-1 text-[10px] sm:text-xs font-medium text-center text-foreground/80 line-clamp-1 max-w-[60px]">
              {item.name}
            </span>
          </div>
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onRemove} className="text-destructive" data-testid={`menu-remove-dock-${item.name.toLowerCase().replace(/\s+/g, "-")}`}>
          <X className="h-4 w-4 mr-2" />
          Remove from Dock
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function Dock({ items, onRemoveItem }: { items: NavigationItem[]; onRemoveItem: (href: string) => void }) {
  if (items.length === 0) return null;
  
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className={cn(
        "flex items-center gap-2 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4",
        "bg-background/80 backdrop-blur-xl border rounded-2xl shadow-xl",
        "dark:bg-background/60"
      )}>
        {items.map((item) => (
          <DockIcon
            key={item.href}
            item={item}
            onRemove={() => onRemoveItem(item.href)}
          />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [dockItems, setDockItems] = useState<NavigationItem[]>([]);
  const [tooltipDismissed, setTooltipDismissed] = useState(() => localStorage.getItem(DOCK_TOOLTIP_DISMISSED_KEY) === "true");
  const { toast } = useToast();
  
  const dismissTooltip = useCallback(() => {
    setTooltipDismissed(true);
    localStorage.setItem(DOCK_TOOLTIP_DISMISSED_KEY, "true");
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(DOCK_STORAGE_KEY);
    if (saved) {
      try {
        const savedHrefs = JSON.parse(saved) as string[];
        const allItems = getAllNavigationItems();
        const hubItems = navigationCategories.map(cat => ({
          name: cat.name,
          href: cat.hubRoute,
          icon: cat.icon,
          description: cat.description,
        }));
        const combinedItems = [...allItems, ...hubItems];
        const items = savedHrefs
          .map(href => {
            const migratedHref = migrateRoute(href);
            return combinedItems.find(item => item.href === migratedHref);
          })
          .filter((item): item is NavigationItem => item !== undefined);
        setDockItems(items);
        const migratedHrefs = items.map(i => i.href);
        if (JSON.stringify(savedHrefs) !== JSON.stringify(migratedHrefs)) {
          localStorage.setItem(DOCK_STORAGE_KEY, JSON.stringify(migratedHrefs));
        }
      } catch {
        setDockItems([]);
      }
    }
  }, []);
  
  const saveDock = (items: NavigationItem[]) => {
    setDockItems(items);
    localStorage.setItem(DOCK_STORAGE_KEY, JSON.stringify(items.map(i => i.href)));
  };
  
  const addToDock = (item: NavigationItem) => {
    if (dockItems.length >= MAX_DOCK_ITEMS) {
      toast({
        title: "Dock is full",
        description: `Maximum ${MAX_DOCK_ITEMS} items allowed. Remove an item first.`,
        variant: "destructive"
      });
      return;
    }
    if (dockItems.some(d => d.href === item.href)) {
      return;
    }
    saveDock([...dockItems, item]);
    toast({
      title: "Added to Dock",
      description: `${item.name} added to your dock.`
    });
  };
  
  const removeFromDock = (href: string) => {
    const item = dockItems.find(d => d.href === href);
    saveDock(dockItems.filter(d => d.href !== href));
    if (item) {
      toast({
        title: "Removed from Dock",
        description: `${item.name} removed from your dock.`
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-28">
      <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-xl border-b">
        <div className="flex h-14 sm:h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary rounded-xl flex items-center justify-center shadow-md">
              <Anchor className="text-primary-foreground h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold">ARUS</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Marine PdM System</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <DevModeToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 sm:py-12 max-w-4xl">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 sm:gap-8 justify-items-center">
          {navigationCategories.map((category) => (
            <CategoryCard 
              key={category.id} 
              category={category}
              onAddToDock={addToDock}
              dockItems={dockItems}
            />
          ))}
        </div>
      </main>

      <Dock items={dockItems} onRemoveItem={removeFromDock} />
      
      {dockItems.length === 0 && !tooltipDismissed && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50" data-testid="dock-onboarding-tooltip">
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/80 backdrop-blur-sm rounded-full text-xs text-muted-foreground">
            <Pin className="h-4 w-4" />
            <span>Hover over a category and tap the pin icon to add to dock</span>
            <button type="button" onClick={dismissTooltip} className="ml-1 hover:text-foreground transition-colors" aria-label="Dismiss tooltip" data-testid="button-dismiss-tooltip">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
