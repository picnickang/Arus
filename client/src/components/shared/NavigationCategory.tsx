import { useLocation } from "wouter";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavigationCategory as NavigationCategoryType } from "@/config/navigationConfig";
import { NavigationItem } from "./NavigationItem";

interface NavigationCategoryProps {
  category: NavigationCategoryType;
  isExpanded: boolean;
  onToggle: () => void;
  mode?: "desktop" | "mobile";
  onNavigate?: () => void;
}

export function NavigationCategory({
  category,
  isExpanded,
  onToggle,
  mode = "desktop",
  onNavigate,
}: NavigationCategoryProps) {
  const [location] = useLocation();
  const hasActiveItem = category.items.some((item) => location === item.href);
  const Icon = category.icon;

  if (mode === "mobile") {
    return (
      <div className="mb-2">
        <button
          onClick={onToggle}
          className={cn(
            "flex items-center justify-between w-full px-4 py-2.5 text-sm font-semibold rounded-md transition-colors touch-manipulation",
            hasActiveItem
              ? "text-foreground bg-accent/50"
              : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
          )}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${category.name} section`}
          data-testid={`mobile-nav-category-${category.name.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <div className="flex items-center">
            <Icon className="w-4 h-4 mr-2" />
            <span>{category.name}</span>
          </div>
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {isExpanded && (
          <div className="mt-1 ml-2" role="group" aria-label={`${category.name} navigation items`}>
            {category.items.map((item) => (
              <NavigationItem key={item.href} item={item} mode="mobile" onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center justify-between w-full px-4 py-2 text-sm font-semibold rounded-md transition-colors",
          "mx-3 my-1",
          hasActiveItem
            ? "text-sidebar-accent-foreground bg-sidebar-accent/50"
            : "text-muted-foreground hover:bg-sidebar-accent/30 hover:text-sidebar-accent-foreground"
        )}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} ${category.name} section`}
        data-testid={`nav-category-${category.name.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <div className="flex items-center">
          <Icon className="w-4 h-4 mr-2" />
          <span>{category.name}</span>
        </div>
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {isExpanded && (
        <div className="mt-1 ml-3" role="group" aria-label={`${category.name} navigation items`}>
          {category.items.map((item) => (
            <NavigationItem key={item.href} item={item} mode="desktop" />
          ))}
        </div>
      )}
    </div>
  );
}
