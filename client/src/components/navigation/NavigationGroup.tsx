import { NavigationCard } from "./NavigationCard";
import type { NavigationItem } from "@/config/navigationConfig";

interface NavigationGroupProps {
  name: string;
  items: NavigationItem[];
  onAddToDock?: (item: NavigationItem) => void;
  dockItems?: NavigationItem[];
}

export function NavigationGroup({ name, items, onAddToDock, dockItems = [] }: NavigationGroupProps) {
  return (
    <section className="mb-8" data-testid={`nav-group-${name.toLowerCase().replace(/\s+/g, "-")}`}>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">
        {name}
      </h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4 sm:gap-6">
        {items.map((item) => (
          <NavigationCard
            key={item.href}
            name={item.name}
            href={item.href}
            icon={item.icon}
            description={item.description}
            onAddToDock={onAddToDock ? () => onAddToDock(item) : undefined}
            isInDock={dockItems.some(d => d.href === item.href)}
          />
        ))}
      </div>
    </section>
  );
}
