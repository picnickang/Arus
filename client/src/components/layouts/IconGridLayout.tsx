import { useState, useEffect, useMemo, lazy, Suspense, type ReactNode, type ComponentType } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { ChevronLeft, ChevronRight, Home, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageLoader } from "./PageLoader";

export interface GridItem {
  id: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  legacyRoutes?: string[];
  component?: ReactNode;
  load?: () => Promise<{ default: ComponentType<any> }>;
  loaderVariant?: "default" | "table" | "cards" | "form";
}

export interface IconGridLayoutProps {
  title: string;
  description?: string;
  items: GridItem[];
  defaultItemId?: string;
  baseRoute?: string;
  headerAction?: ReactNode;
}

function GridItemCard({
  item,
  isSelected,
  onClick,
  compact = false,
}: {
  item: GridItem;
  isSelected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const Icon = item.icon;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center justify-center cursor-pointer",
        "transition-all duration-200 ease-out",
        "hover:scale-105 active:scale-95"
      )}
      data-testid={`grid-item-${item.id}`}
      role="tab"
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div
        className={cn(
          "rounded-2xl flex items-center justify-center",
          "shadow-lg transition-all duration-200",
          compact ? "w-12 h-12 sm:w-14 sm:h-14" : "w-16 h-16 sm:w-20 sm:h-20",
          isSelected
            ? "bg-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
            : "bg-primary group-hover:shadow-xl group-hover:bg-primary/90"
        )}
      >
        <Icon
          className={cn(
            "text-primary-foreground",
            compact ? "h-6 w-6 sm:h-7 sm:w-7" : "h-8 w-8 sm:h-10 sm:w-10"
          )}
          strokeWidth={2}
        />
      </div>
      <span
        className={cn(
          "mt-2 font-medium text-center line-clamp-1",
          compact
            ? "text-[10px] sm:text-xs max-w-[70px] sm:max-w-[90px]"
            : "text-xs sm:text-sm max-w-[100px] sm:max-w-[120px]",
          isSelected ? "text-primary" : "text-foreground"
        )}
      >
        {item.label}
      </span>
      {!compact && item.description && (
        <span className="text-[10px] text-muted-foreground text-center line-clamp-1 max-w-[100px] sm:max-w-[120px] hidden sm:block">
          {item.description}
        </span>
      )}
    </div>
  );
}

function useDeferredComponent(item: GridItem | undefined) {
  return useMemo(() => {
    if (!item) return null;

    if (item.component) return item.component;

    if (item.load) {
      const LazyComponent = lazy(item.load);
      return (
        <Suspense fallback={<PageLoader variant={item.loaderVariant || "cards"} />}>
          <LazyComponent />
        </Suspense>
      );
    }

    return null;
  }, [item?.id]);
}

export function IconGridLayout({
  title,
  description,
  items,
  defaultItemId,
  baseRoute = "",
  headerAction,
}: IconGridLayoutProps) {
  const [location, navigate] = useLocation();
  const searchString = useSearch();
  const isMobile = useIsMobile();

  const getTabFromUrl = (): string | null => {
    const params = new URLSearchParams(searchString);
    return params.get("tab");
  };

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const urlTab = getTabFromUrl();
    if (urlTab && items.some((item) => item.id === urlTab)) {
      return urlTab;
    }
    return defaultItemId || null;
  });

  useEffect(() => {
    const urlTab = getTabFromUrl();
    if (urlTab && items.some((item) => item.id === urlTab)) {
      setSelectedId(urlTab);
    }
  }, [searchString, items]);

  const selectedItem = items.find((item) => item.id === selectedId);
  const deferredContent = useDeferredComponent(selectedItem);

  const handleSelectItem = (itemId: string) => {
    setSelectedId(itemId);
    if (baseRoute) {
      navigate(`${baseRoute}?tab=${itemId}`, { replace: true });
    }
  };

  const handleBack = () => {
    window.history.back();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div
        className={cn(
          "sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b",
          isMobile ? "px-3 py-2" : "px-6 py-4"
        )}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={handleBack}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
          <div className="flex-1">
            <nav aria-label="Breadcrumb" data-testid="breadcrumb-nav">
              <ol className="flex items-center gap-1 text-sm text-muted-foreground">
                <li>
                  <Link href="/" className="hover:text-foreground transition-colors inline-flex items-center gap-1" aria-label="Home" data-testid="breadcrumb-home">
                    <Home className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Home</span>
                  </Link>
                </li>
                <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
                {selectedItem ? (
                  <>
                    <li>
                      <span className="text-foreground">{title}</span>
                    </li>
                    <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
                    <li><span className="font-medium text-foreground" aria-current="page">{selectedItem.label}</span></li>
                  </>
                ) : (
                  <li>
                    <span className="font-medium text-foreground" aria-current="page">{title}</span>
                  </li>
                )}
              </ol>
            </nav>
            <h1
              className={cn("font-semibold", isMobile ? "text-lg" : "text-xl")}
              data-testid="grid-page-title"
            >
              {title}
            </h1>
            {description && !isMobile && (
              <p
                className="text-sm text-muted-foreground"
                data-testid="grid-page-description"
              >
                {description}
              </p>
            )}
          </div>
          {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
        </div>
      </div>

      <div className="border-b bg-muted/30" role="tablist" aria-label={`${title} navigation`}>
        <div className="container mx-auto px-4 py-4 sm:py-6 max-w-4xl">
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            {items.map((item) => (
              <GridItemCard
                key={item.id}
                item={item}
                isSelected={item.id === selectedId}
                onClick={() => handleSelectItem(item.id)}
                compact
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {deferredContent ? (
          <div className="h-full" data-testid={`grid-content-${selectedId}`}>
            {deferredContent}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Select an option above to get started
          </div>
        )}
      </div>
    </div>
  );
}

export function createIconGridLegacyRedirects(
  items: GridItem[],
  baseRoute: string
): Array<{ from: string; to: string }> {
  const redirects: Array<{ from: string; to: string }> = [];
  for (const item of items) {
    if (item.legacyRoutes) {
      for (const legacyRoute of item.legacyRoutes) {
        redirects.push({ from: legacyRoute, to: `${baseRoute}?tab=${item.id}` });
      }
    }
  }
  return redirects;
}

export type { GridItem as IconGridItem };
