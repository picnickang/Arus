import { IconGridLayout, type GridItem } from "@/components/layouts";
import { FileCheck, Anchor, Cog, Activity } from "lucide-react";

const logsItems: GridItem[] = [
  {
    id: "compliance",
    label: "Compliance",
    icon: FileCheck,
    description: "Compliance & governance",
    load: () => import("./compliance-consolidated"),
    loaderVariant: "cards",
    legacyRoutes: ["/logs-compliance", "/governance", "/governance-dashboard"],
  },
  {
    id: "deck",
    label: "Deck Log",
    icon: Anchor,
    description: "Deck logbook & vessel track",
    load: () => import("./deck-log-consolidated"),
    loaderVariant: "table",
    legacyRoutes: ["/deck-logbook", "/vessel-track-log"],
  },
  {
    id: "engine",
    label: "Engine Log",
    icon: Cog,
    description: "Engine room & fuel",
    load: () => import("./engine-log-consolidated"),
    loaderVariant: "table",
    legacyRoutes: ["/engine-logbook", "/fuel-emissions-log"],
  },
  {
    id: "equipment",
    label: "Equipment Log",
    icon: Activity,
    description: "Condition & decommissioned",
    load: () => import("./equipment-log-consolidated"),
    loaderVariant: "table",
    legacyRoutes: ["/condition-monitoring-log", "/decommissioned-equipment-log"],
  },
];

export default function LogsHub() {
  return (
    <IconGridLayout
      title="Logs & Compliance"
      description="Maritime logbooks and compliance documentation"
      items={logsItems}
      defaultItemId="compliance"
      baseRoute="/logs"
    />
  );
}
