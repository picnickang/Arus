import { navigationCategories } from "@/config/navigationConfig";
import { filterCategoriesByHubAccess } from "@/application/navigation/role-navigation-policy";
import { matchesQuery } from "./useGlobalSearchResults";

export interface PageActionItem {
  id: string;
  label: string;
  sublabel: string;
  href: string;
}

/**
 * Pages reachable for this account — the same hub allow-list rule the
 * shell applies (hubAccess null = all hubs; [] = none).
 */
export function getPageItems(query: string, hubAccess: string[] | null): PageActionItem[] {
  const categories = filterCategoriesByHubAccess(navigationCategories, hubAccess);
  const items: PageActionItem[] = [];
  for (const category of categories) {
    for (const child of category.children) {
      if (matchesQuery(query, child.name, category.name)) {
        items.push({
          id: `page-${child.href}`,
          label: child.name,
          sublabel: category.name,
          href: child.href,
        });
      }
    }
  }
  return items.slice(0, 5);
}

/** Verb shortcuts — each lands in an already-wired, prefilled flow. */
export function getVerbActions(query: string): PageActionItem[] {
  const actions: PageActionItem[] = [
    {
      id: "action-create-wo",
      label: "Create work order…",
      sublabel: "Action",
      href: "/work-orders?action=create",
    },
  ];
  return actions.filter((a) => matchesQuery(query, a.label, "create work order new"));
}
