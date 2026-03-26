# ARUS Frontend — Part 2: Hub Pages & Operations
Generated: 2026-03-26T02:38:14Z

### `client/src/pages/home.tsx` (256 lines)

```tsx
import { useState, useEffect } from "react";
import { Anchor, X, GripHorizontal, Plus, Check } from "lucide-react";
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
        <Link href={category.hubRoute}>
          <div
            className={cn(
              "group flex flex-col items-center justify-center cursor-pointer",
              "transition-all duration-200 ease-out",
              "hover:scale-105 active:scale-95"
            )}
            data-testid={`category-card-${category.id}`}
          >
            <div className={cn(
              "w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center",
              "bg-primary shadow-lg",
              "group-hover:shadow-xl group-hover:bg-primary/90",
              "transition-all duration-200"
            )}>
              <Icon className="h-8 w-8 sm:h-10 sm:w-10 text-primary-foreground" strokeWidth={2} />
            </div>
            <span className="mt-2 text-xs sm:text-sm font-medium text-center text-foreground line-clamp-1 max-w-[80px] sm:max-w-[100px]">
              {category.name}
            </span>
            <span className="text-[10px] text-muted-foreground text-center line-clamp-1 max-w-[80px] sm:max-w-[100px] hidden sm:block">
              {category.description}
            </span>
          </div>
        </Link>
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
  const { toast } = useToast();
  
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
      
      {dockItems.length === 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/80 backdrop-blur-sm rounded-full text-xs text-muted-foreground">
            <GripHorizontal className="h-4 w-4" />
            <span>Right-click any category to add to dock</span>
          </div>
        </div>
      )}
    </div>
  );
}

```

### `client/src/pages/operations-hub.tsx` (58 lines)

```tsx
import { Suspense, lazy } from "react";
import { IconGridLayout, PageLoader, type GridItem } from "@/components/layouts";
import { Gauge, Lightbulb, Activity } from "lucide-react";

const Dashboard = lazy(() => import("./dashboard-improved"));
const ActiveTelemetry = lazy(() => import("./active-telemetry"));
const ActionableInsights = lazy(() => import("./actionable-insights"));

const operationsItems: GridItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Gauge,
    description: "Fleet overview and alerts",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <Dashboard />
      </Suspense>
    ),
    legacyRoutes: ["/dashboard", "/alerts"],
  },
  {
    id: "active-telemetry",
    label: "Active Telemetry",
    icon: Activity,
    description: "Live sensor streams",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <ActiveTelemetry />
      </Suspense>
    ),
    legacyRoutes: ["/active-telemetry"],
  },
  {
    id: "insights",
    label: "Actionable Insights",
    icon: Lightbulb,
    description: "AI recommendations",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <ActionableInsights />
      </Suspense>
    ),
    legacyRoutes: ["/actionable-insights"],
  },
];

export default function OperationsHub() {
  return (
    <IconGridLayout
      title="Operations"
      description="Dashboard, telemetry, and insights"
      items={operationsItems}
      defaultItemId="dashboard"
      baseRoute="/operations"
    />
  );
}

```

### `client/src/pages/fleet-hub.tsx` (45 lines)

```tsx
import { Suspense, lazy } from "react";
import { IconGridLayout, PageLoader, type GridItem } from "@/components/layouts";
import { Ship, Server } from "lucide-react";

const VesselManagement = lazy(() => import("./vessel-management"));
const Equipment = lazy(() => import("./equipment"));

const fleetItems: GridItem[] = [
  {
    id: "vessels",
    label: "Vessels",
    icon: Ship,
    description: "Fleet overview and vessel details",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <VesselManagement />
      </Suspense>
    ),
    legacyRoutes: ["/vessel-management", "/fleet-overview"],
  },
  {
    id: "equipment",
    label: "Equipment",
    icon: Server,
    description: "Equipment registry and health",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <Equipment />
      </Suspense>
    ),
    legacyRoutes: ["/equipment", "/health"],
  },
];

export default function FleetHub() {
  return (
    <IconGridLayout
      title="Fleet"
      description="Vessels and equipment management"
      items={fleetItems}
      defaultItemId="vessels"
      baseRoute="/fleet"
    />
  );
}

```

### `client/src/pages/maintenance-hub.tsx` (97 lines)

```tsx
import { Suspense, lazy } from "react";
import { IconGridLayout, PageLoader, type GridItem } from "@/components/layouts";
import { Wrench, Calendar, FileSpreadsheet, Target, Zap, TrendingUp } from "lucide-react";

const WorkOrders = lazy(() => import("./work-orders"));
const MaintenanceSchedules = lazy(() => import("./maintenance-schedules"));
const MaintenanceTemplates = lazy(() => import("./MaintenanceTemplatesPage"));
const OptimizationTools = lazy(() => import("./optimization-tools"));
const PdmPack = lazy(() => import("./pdm-pack"));
const PdmDashboard = lazy(() => import("./pdm-dashboard"));

const maintenanceItems: GridItem[] = [
  {
    id: "work-orders",
    label: "Work Orders",
    icon: Wrench,
    description: "Active work orders",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <WorkOrders />
      </Suspense>
    ),
    legacyRoutes: ["/work-orders"],
  },
  {
    id: "schedules",
    label: "Schedules",
    icon: Calendar,
    description: "Maintenance schedule",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <MaintenanceSchedules />
      </Suspense>
    ),
    legacyRoutes: ["/maintenance"],
  },
  {
    id: "templates",
    label: "Templates",
    icon: FileSpreadsheet,
    description: "Task templates",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <MaintenanceTemplates />
      </Suspense>
    ),
    legacyRoutes: ["/maintenance-templates"],
  },
  {
    id: "optimization",
    label: "Optimization",
    icon: Target,
    description: "Optimize planning",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <OptimizationTools />
      </Suspense>
    ),
    legacyRoutes: ["/optimization-tools"],
  },
  {
    id: "pdm-pack",
    label: "PdM Pack",
    icon: Zap,
    description: "Predictive maintenance tools",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <PdmPack />
      </Suspense>
    ),
    legacyRoutes: ["/pdm-pack"],
  },
  {
    id: "pdm-dashboard",
    label: "PdM Dashboard",
    icon: TrendingUp,
    description: "Risk queue & fleet health",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <PdmDashboard />
      </Suspense>
    ),
    legacyRoutes: ["/pdm-dashboard"],
  },
];

export default function MaintenanceHub() {
  return (
    <IconGridLayout
      title="Maintenance"
      description="Work orders, schedules, templates, and optimization tools"
      items={maintenanceItems}
      defaultItemId="work-orders"
      baseRoute="/maint"
    />
  );
}

```

### `client/src/pages/logistics-hub.tsx` (71 lines)

```tsx
import { Suspense, lazy } from "react";
import { IconGridLayout, PageLoader, type GridItem } from "@/components/layouts";
import { Boxes, Wrench, Building, ClipboardCheck } from "lucide-react";

const InventoryManagement = lazy(() => import("./inventory-management"));
const PurchaseRequestsPage = lazy(() => import("@/features/purchaseRequests").then(m => ({ default: m.PurchaseRequestsPage })));
const ServiceOrdersPage = lazy(() => import("@/features/serviceOrders").then(m => ({ default: m.ServiceOrdersPage })));
const VendorsPage = lazy(() => import("@/features/suppliers").then(m => ({ default: m.VendorsPage })));

const logisticsItems: GridItem[] = [
  {
    id: "inventory",
    label: "Inventory",
    icon: Boxes,
    description: "Stock levels",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <InventoryManagement />
      </Suspense>
    ),
    legacyRoutes: ["/inventory-management"],
  },
  {
    id: "purchasing",
    label: "Purchasing",
    icon: ClipboardCheck,
    description: "Requests & orders",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <PurchaseRequestsPage />
      </Suspense>
    ),
    legacyRoutes: ["/purchase-requests", "/purchase-orders"],
  },
  {
    id: "service-orders",
    label: "Service Orders",
    icon: Wrench,
    description: "External services",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <ServiceOrdersPage />
      </Suspense>
    ),
    legacyRoutes: ["/service-orders"],
  },
  {
    id: "vendors",
    label: "Vendors",
    icon: Building,
    description: "Suppliers & providers",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <VendorsPage />
      </Suspense>
    ),
    legacyRoutes: ["/vendors", "/suppliers", "/service-providers"],
  },
];

export default function LogisticsHub() {
  return (
    <IconGridLayout
      title="Logistics"
      description="Inventory, purchasing, service orders, and supplier management"
      items={logisticsItems}
      defaultItemId="inventory"
      baseRoute="/logistics"
    />
  );
}

```

### `client/src/pages/logs-hub.tsx` (71 lines)

```tsx
import { Suspense, lazy } from "react";
import { IconGridLayout, PageLoader, type GridItem } from "@/components/layouts";
import { FileCheck, Anchor, Cog, Activity } from "lucide-react";

const ComplianceConsolidated = lazy(() => import("./compliance-consolidated"));
const DeckLogConsolidated = lazy(() => import("./deck-log-consolidated"));
const EngineLogConsolidated = lazy(() => import("./engine-log-consolidated"));
const EquipmentLogConsolidated = lazy(() => import("./equipment-log-consolidated"));

const logsItems: GridItem[] = [
  {
    id: "compliance",
    label: "Compliance",
    icon: FileCheck,
    description: "Compliance & governance",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <ComplianceConsolidated />
      </Suspense>
    ),
    legacyRoutes: ["/logs-compliance", "/governance", "/governance-dashboard"],
  },
  {
    id: "deck",
    label: "Deck Log",
    icon: Anchor,
    description: "Deck logbook & vessel track",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <DeckLogConsolidated />
      </Suspense>
    ),
    legacyRoutes: ["/deck-logbook", "/vessel-track-log"],
  },
  {
    id: "engine",
    label: "Engine Log",
    icon: Cog,
    description: "Engine room & fuel",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <EngineLogConsolidated />
      </Suspense>
    ),
    legacyRoutes: ["/engine-logbook", "/fuel-emissions-log"],
  },
  {
    id: "equipment",
    label: "Equipment Log",
    icon: Activity,
    description: "Condition & decommissioned",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <EquipmentLogConsolidated />
      </Suspense>
    ),
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

```

### `client/src/pages/logs-compliance-hub.tsx` (58 lines)

```tsx
import { Link } from "wouter";
import { Book, Wrench, FileWarning, Bell, Ship, Calendar, CheckCircle2, AlertTriangle, XCircle, ArrowRight, ClipboardCheck, BarChart3, FileText, CloudSun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useLogsComplianceData } from "@/features/compliance";

const SeverityIcons: Record<string, typeof AlertTriangle> = { critical: XCircle, warning: AlertTriangle, info: CheckCircle2 };
const SeverityColors: Record<string, string> = { critical: "text-red-600 bg-red-100 dark:bg-red-900/30", warning: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30", info: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" };

export default function LogsComplianceHub() {
  const { vessels, findingsLoading, selectedVessel, setSelectedVessel, activeTab, setActiveTab, todayStr, filteredFindings, severityCounts, recentFindings, getVesselName } = useLogsComplianceData();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 mb-6">
        <div className="flex items-center gap-3"><Select value={selectedVessel} onValueChange={setSelectedVessel}><SelectTrigger className="w-[200px]" data-testid="select-vessel-filter"><Ship className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="All Vessels" /></SelectTrigger><SelectContent><SelectItem value="all">All Vessels</SelectItem>{vessels.filter(v => v.id).map((vessel) => <SelectItem key={vessel.id} value={vessel.id}>{vessel.name}</SelectItem>)}</SelectContent></Select></div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Open Findings</CardTitle><FileWarning className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{filteredFindings.length}</div><div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">{severityCounts.critical > 0 && <Badge variant="destructive" className="text-xs">{severityCounts.critical} critical</Badge>}{severityCounts.warning > 0 && <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">{severityCounts.warning} warning</Badge>}</div></CardContent></Card>
        <Link href="/deck-logbook"><Card className="cursor-pointer hover:bg-muted/50 transition-colors h-full"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Deck Logbook</CardTitle><Book className="h-4 w-4 text-blue-600" /></CardHeader><CardContent><div className="text-sm text-muted-foreground">Navigate, weather, watches</div><div className="flex items-center gap-1 mt-2 text-xs text-blue-600">Open <ArrowRight className="h-3 w-3" /></div></CardContent></Card></Link>
        <Link href="/engine-logbook"><Card className="cursor-pointer hover:bg-muted/50 transition-colors h-full"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Engine Logbook</CardTitle><Wrench className="h-4 w-4 text-orange-600" /></CardHeader><CardContent><div className="text-sm text-muted-foreground">Engine room operations</div><div className="flex items-center gap-1 mt-2 text-xs text-orange-600">Open <ArrowRight className="h-3 w-3" /></div></CardContent></Card></Link>
        <Link href="/notification-settings"><Card className="cursor-pointer hover:bg-muted/50 transition-colors h-full"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Notifications</CardTitle><Bell className="h-4 w-4 text-purple-600" /></CardHeader><CardContent><div className="text-sm text-muted-foreground">Email & alert settings</div><div className="flex items-center gap-1 mt-2 text-xs text-purple-600">Configure <ArrowRight className="h-3 w-3" /></div></CardContent></Card></Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList><TabsTrigger value="overview" data-testid="tab-overview"><BarChart3 className="h-4 w-4 mr-2" />Overview</TabsTrigger><TabsTrigger value="findings" data-testid="tab-findings"><FileWarning className="h-4 w-4 mr-2" />Compliance Findings</TabsTrigger><TabsTrigger value="logbooks" data-testid="tab-logbooks"><FileText className="h-4 w-4 mr-2" />Logbook Status</TabsTrigger></TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader><CardTitle className="text-lg">Compliance Status</CardTitle><CardDescription>Summary of compliance findings</CardDescription></CardHeader><CardContent><div className="space-y-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-red-500" /><span className="text-sm">Critical</span></div><span className="font-medium">{severityCounts.critical}</span></div><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-yellow-500" /><span className="text-sm">Warning</span></div><span className="font-medium">{severityCounts.warning}</span></div><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-blue-500" /><span className="text-sm">Info</span></div><span className="font-medium">{severityCounts.info}</span></div><Separator /><div className="flex items-center justify-between font-medium"><span>Total Open</span><span>{filteredFindings.length}</span></div></div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-lg">Recent Findings</CardTitle><CardDescription>Latest compliance items needing attention</CardDescription></CardHeader><CardContent>{findingsLoading ? <div className="text-sm text-muted-foreground">Loading...</div> : recentFindings.length === 0 ? <div className="text-center py-4"><CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" /><p className="text-sm text-muted-foreground">No open findings</p></div> : <div className="space-y-3">{recentFindings.map((finding) => { const SeverityIcon = SeverityIcons[finding.severity] || AlertTriangle; return <div key={finding.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50" data-testid={`finding-${finding.id}`}><div className={`p-1 rounded ${SeverityColors[finding.severity]}`}><SeverityIcon className="h-4 w-4" /></div><div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{finding.ruleName || finding.ruleCode}</div><div className="text-xs text-muted-foreground flex items-center gap-1"><Ship className="h-3 w-3" />{getVesselName(finding.vesselId)}<span>·</span>{finding.logDate}</div></div></div>; })}{filteredFindings.length > 5 && <Button variant="ghost" size="sm" className="w-full" asChild><Link href="/compliance/findings">View all {filteredFindings.length} findings<ArrowRight className="h-4 w-4 ml-2" /></Link></Button>}</div>}</CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle className="text-lg">Quick Actions</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-3"><Button variant="outline" className="justify-start h-auto py-4" asChild><Link href={`/deck-logbook?date=${todayStr}`}><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30"><Book className="h-5 w-5 text-blue-600" /></div><div className="text-left"><div className="font-medium">Today's Deck Log</div><div className="text-xs text-muted-foreground">Open today's entries</div></div></div></Link></Button><Button variant="outline" className="justify-start h-auto py-4" asChild><Link href={`/engine-logbook?date=${todayStr}`}><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30"><Wrench className="h-5 w-5 text-orange-600" /></div><div className="text-left"><div className="font-medium">Today's Engine Log</div><div className="text-xs text-muted-foreground">Open today's entries</div></div></div></Link></Button><Button variant="outline" className="justify-start h-auto py-4" asChild><Link href="/notification-settings"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30"><Bell className="h-5 w-5 text-purple-600" /></div><div className="text-left"><div className="font-medium">Configure Alerts</div><div className="text-xs text-muted-foreground">Email notification rules</div></div></div></Link></Button></div></CardContent></Card>
        </TabsContent>

        <TabsContent value="findings" className="space-y-4">
          <Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>Open Compliance Findings</CardTitle><CardDescription>{filteredFindings.length} finding(s) requiring attention</CardDescription></div><Button variant="outline" size="sm" asChild><Link href="/compliance/findings">View All<ArrowRight className="h-4 w-4 ml-2" /></Link></Button></CardHeader><CardContent>{findingsLoading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : filteredFindings.length === 0 ? <div className="text-center py-8"><CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" /><p className="text-muted-foreground">No open compliance findings</p><p className="text-sm text-muted-foreground">All logbooks are in compliance</p></div> : <div className="space-y-3">{filteredFindings.map((finding) => { const SeverityIcon = SeverityIcons[finding.severity] || AlertTriangle; return <div key={finding.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors" data-testid={`compliance-finding-${finding.id}`}><div className={`p-2 rounded-lg ${SeverityColors[finding.severity]}`}><SeverityIcon className="h-5 w-5" /></div><div className="flex-1 min-w-0"><div className="font-medium">{finding.ruleName || finding.ruleCode}</div><div className="text-sm text-muted-foreground truncate">{finding.message}</div><div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground"><div className="flex items-center gap-1"><Ship className="h-3 w-3" />{getVesselName(finding.vesselId)}</div><div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{finding.logDate}</div><Badge variant="outline" className="text-xs">{finding.sourceType}</Badge></div></div><Badge variant={finding.severity === "critical" ? "destructive" : "outline"} className={finding.severity === "warning" ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : ""}>{finding.severity}</Badge></div>; })}</div>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="logbooks" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Book className="h-5 w-5 text-blue-600" />Deck Logbook</CardTitle><CardDescription>Bridge navigation and weather records</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><div className="flex items-center justify-between text-sm"><span>Last 7 Days Entries</span><span className="text-muted-foreground">-</span></div><div className="flex items-center justify-between text-sm"><span>Unsigned Logs</span><span className="text-muted-foreground">-</span></div><div className="flex items-center justify-between text-sm"><span>Completion Rate</span><span className="text-muted-foreground">-</span></div></div><Separator /><Button className="w-full" asChild><Link href="/deck-logbook">Open Deck Logbook<ArrowRight className="h-4 w-4 ml-2" /></Link></Button></CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5 text-orange-600" />Engine Logbook</CardTitle><CardDescription>Engine room operations and readings</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><div className="flex items-center justify-between text-sm"><span>Last 7 Days Entries</span><span className="text-muted-foreground">-</span></div><div className="flex items-center justify-between text-sm"><span>Unsigned Logs</span><span className="text-muted-foreground">-</span></div><div className="flex items-center justify-between text-sm"><span>Completion Rate</span><span className="text-muted-foreground">-</span></div></div><Separator /><Button className="w-full" variant="secondary" asChild><Link href="/engine-logbook">Open Engine Logbook<ArrowRight className="h-4 w-4 ml-2" /></Link></Button></CardContent></Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><CloudSun className="h-5 w-5 text-cyan-600" />StormGeo Weather Integration</CardTitle><CardDescription>Automatic weather data import for deck logbook auto-fill</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><div className="flex items-center justify-between text-sm"><span>Integration Status</span><Badge variant="secondary">File Import</Badge></div><div className="flex items-center justify-between text-sm"><span>Auto-fill</span><span className="text-green-600">Enabled</span></div></div><Separator /><Button className="w-full" variant="secondary" asChild><Link href="/stormgeo-settings">Configure StormGeo<ArrowRight className="h-4 w-4 ml-2" /></Link></Button></CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-purple-600" />Notification Settings</CardTitle><CardDescription>Email alerts and notification preferences</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><div className="flex items-center justify-between text-sm"><span>Email Alerts</span><Badge variant="secondary">Configured</Badge></div><div className="flex items-center justify-between text-sm"><span>Compliance Alerts</span><span className="text-green-600">Enabled</span></div></div><Separator /><Button className="w-full" variant="secondary" asChild><Link href="/notification-settings">Configure Notifications<ArrowRight className="h-4 w-4 ml-2" /></Link></Button></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

```

### `client/src/pages/system-hub.tsx` (97 lines)

```tsx
import { Suspense, lazy } from "react";
import { IconGridLayout, PageLoader, type GridItem } from "@/components/layouts";
import { Settings, Activity, Shield, Building, Bell, CloudSun } from "lucide-react";

const ConfigurationHub = lazy(() => import("./configuration-hub"));
const SensorsHub = lazy(() => import("./sensors-hub"));
const SystemAdministration = lazy(() => import("./system-administration"));
const OrganizationManagement = lazy(() => import("./organization-management"));
const NotificationsHub = lazy(() => import("./notifications-hub"));
const StormGeoSettings = lazy(() => import("./stormgeo-settings"));

const systemItems: GridItem[] = [
  {
    id: "admin",
    label: "Admin",
    icon: Shield,
    description: "System admin",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <SystemAdministration />
      </Suspense>
    ),
    legacyRoutes: ["/system-administration"],
  },
  {
    id: "configuration",
    label: "Configuration",
    icon: Settings,
    description: "System settings",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <ConfigurationHub embedded />
      </Suspense>
    ),
    legacyRoutes: ["/configuration"],
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    description: "Alerts, preferences & templates",
    component: (
      <Suspense fallback={<PageLoader variant="form" />}>
        <NotificationsHub />
      </Suspense>
    ),
    legacyRoutes: ["/notifications", "/notification-settings", "/email-alerts-settings", "/email-templates"],
  },
  {
    id: "organizations",
    label: "Organizations",
    icon: Building,
    description: "Org management",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <OrganizationManagement />
      </Suspense>
    ),
    legacyRoutes: ["/organization-management"],
  },
  {
    id: "sensors",
    label: "Sensors",
    icon: Activity,
    description: "Sensors & templates",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <SensorsHub />
      </Suspense>
    ),
    legacyRoutes: ["/sensors", "/sensor-templates"],
  },
  {
    id: "stormgeo",
    label: "StormGeo",
    icon: CloudSun,
    description: "Weather integration",
    component: (
      <Suspense fallback={<PageLoader variant="form" />}>
        <StormGeoSettings />
      </Suspense>
    ),
    legacyRoutes: ["/stormgeo-settings"],
  },
];

export default function SystemHub() {
  return (
    <IconGridLayout
      title="System"
      description="Configuration, sensors, administration, and integrations"
      items={systemItems}
      defaultItemId="configuration"
      baseRoute="/system"
    />
  );
}

```

### `client/src/pages/desktop-setup.tsx` (583 lines)

```tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, XCircle, Anchor, Server, ArrowRight, ArrowLeft, Ship, Lock, Eye, EyeOff } from 'lucide-react';
import { testBackendConnection, setBackendUrl, getBackendUrlSync, setVesselId, setVesselName } from '@/lib/desktopFetch';

interface DesktopSetupProps {
  onComplete: () => void;
}

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';
type SetupStep = 'backend' | 'vessel' | 'admin';

interface Vessel {
  id: string;
  name: string;
  imo?: string;
  vesselType?: string;
  active?: boolean;
}

interface AdminStatus {
  configured: boolean;
}

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6" data-testid="step-indicator">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                i < current
                  ? 'bg-primary text-primary-foreground'
                  : i === current
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background'
                  : 'bg-muted text-muted-foreground'
              }`}
              data-testid={`step-dot-${i}`}
            >
              {i < current ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs hidden sm:inline ${i === current ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px ${i < current ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function BackendStep({
  onNext,
}: {
  onNext: (url: string) => void;
}) {
  const existing = getBackendUrlSync();
  const [url, setUrl] = useState(existing || 'http://localhost:5000');
  const [status, setStatus] = useState<ConnectionStatus>(existing ? 'success' : 'idle');
  const [statusMessage, setStatusMessage] = useState(existing ? 'Using saved connection' : '');
  const [testedUrl, setTestedUrl] = useState(existing || '');

  async function handleTest() {
    if (!url.trim()) return;
    setStatus('testing');
    setStatusMessage('Testing connection...');
    const result = await testBackendConnection(url.trim());
    if (result.ok) {
      setStatus('success');
      setStatusMessage(result.message);
      setTestedUrl(url.trim());
    } else {
      setStatus('error');
      setStatusMessage(result.message);
      setTestedUrl('');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Backend Server
        </CardTitle>
        <CardDescription>
          Enter the URL of your ARUS backend server. For vessel deployments, this is typically the local server address.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="backend-url">Server URL</Label>
          <div className="flex gap-2">
            <Input
              id="backend-url"
              data-testid="input-backend-url"
              placeholder="http://localhost:5000"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (status !== 'idle') {
                  setStatus('idle');
                  setTestedUrl('');
                }
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleTest()}
            />
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={status === 'testing' || !url.trim()}
              data-testid="button-test-connection"
            >
              {status === 'testing' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test'}
            </Button>
          </div>
        </div>

        {status !== 'idle' && status !== 'testing' && (
          <div
            className={`flex items-center gap-2 text-sm p-3 rounded-md ${
              status === 'success'
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-destructive/10 text-destructive'
            }`}
            data-testid="text-connection-status"
          >
            {status === 'success' ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 flex-shrink-0" />
            )}
            {statusMessage}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>Common configurations:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>Local vessel server: <code className="text-foreground/80">http://localhost:5000</code></li>
            <li>Network vessel server: <code className="text-foreground/80">http://192.168.x.x:5000</code></li>
            <li>Cloud server: <code className="text-foreground/80">https://your-org.arus.io</code></li>
          </ul>
        </div>

        <Button
          className="w-full"
          onClick={() => onNext(testedUrl)}
          disabled={status !== 'success' || !testedUrl}
          data-testid="button-next-backend"
        >
          Next
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

function VesselStep({
  backendUrl,
  onNext,
  onBack,
}: {
  backendUrl: string;
  onNext: (vesselId: string, vesselName: string) => void;
  onBack: () => void;
}) {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [selectedName, setSelectedName] = useState('');

  useEffect(() => {
    async function fetchVessels() {
      try {
        const res = await fetch(`${backendUrl}/api/vessels`, {
          headers: { 'x-org-id': 'default-org-id' },
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        const vesselList = Array.isArray(data) ? data : data.vessels || [];
        setVessels(vesselList.filter((v: Vessel) => v.active !== false));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(`Could not load vessels: ${msg}`);
      } finally {
        setLoading(false);
      }
    }
    fetchVessels();
  }, [backendUrl]);

  function handleSelect(v: Vessel) {
    setSelectedId(v.id);
    setSelectedName(v.name);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ship className="h-5 w-5" />
          Select Vessel
        </CardTitle>
        <CardDescription>
          Choose which vessel this desktop installation is associated with. This determines which equipment and telemetry data you see.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground" data-testid="loading-vessels">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading vessels...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm p-3 rounded-md bg-destructive/10 text-destructive" data-testid="text-vessel-error">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && vessels.length === 0 && (
          <div className="text-center py-6 text-muted-foreground" data-testid="text-no-vessels">
            <Ship className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No vessels found. You can add vessels after setup from the Fleet management page.</p>
          </div>
        )}

        {!loading && vessels.length > 0 && (
          <div className="grid gap-2 max-h-60 overflow-y-auto" data-testid="vessel-list">
            {vessels.map((v) => (
              <button
                key={v.id}
                onClick={() => handleSelect(v)}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                  selectedId === v.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-muted/50'
                }`}
                data-testid={`button-vessel-${v.id}`}
              >
                <Ship className={`h-5 w-5 flex-shrink-0 ${selectedId === v.id ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{v.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {v.imo && <span>IMO: {v.imo}</span>}
                    {v.imo && v.vesselType && <span> · </span>}
                    {v.vesselType && <span>{v.vesselType}</span>}
                  </div>
                </div>
                {selectedId === v.id && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} data-testid="button-back-vessel">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={() => onNext(selectedId, selectedName)}
            disabled={!selectedId && vessels.length > 0}
            data-testid="button-next-vessel"
          >
            {vessels.length === 0 ? 'Skip' : 'Next'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminStep({
  backendUrl,
  onNext,
  onBack,
}: {
  backendUrl: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch(`${backendUrl}/api/admin/auth/status`, {
          headers: { 'x-org-id': 'default-org-id' },
        });
        if (res.ok) {
          const data = await res.json();
          setAdminStatus(data);
        } else {
          setAdminStatus({ configured: true });
        }
      } catch {
        setAdminStatus({ configured: true });
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, [backendUrl]);

  async function handleSetup() {
    if (!password || password.length < 8) {
      setStatus('error');
      setStatusMessage('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setStatus('error');
      setStatusMessage('Passwords do not match');
      return;
    }

    setStatus('testing');
    setStatusMessage('Setting up admin access...');

    try {
      const res = await fetch(`${backendUrl}/api/admin/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': 'default-org-id' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setStatus('success');
        setStatusMessage('Admin password configured successfully');
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.code === 'ALREADY_CONFIGURED') {
          setStatus('success');
          setStatusMessage('Admin password was already configured');
        } else {
          setStatus('error');
          setStatusMessage(data.error || 'Failed to set admin password');
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setStatus('error');
      setStatusMessage(`Connection error: ${msg}`);
    }
  }

  async function handleVerify() {
    if (!password) return;
    setStatus('testing');
    setStatusMessage('Verifying password...');

    try {
      const res = await fetch(`${backendUrl}/api/admin/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': 'default-org-id' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setStatus('success');
        setStatusMessage('Admin access verified');
      } else {
        setStatus('error');
        setStatusMessage('Incorrect password');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setStatus('error');
      setStatusMessage(`Connection error: ${msg}`);
    }
  }

  const isNewSetup = adminStatus && !adminStatus.configured;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          {loading ? 'Admin Access' : isNewSetup ? 'Set Admin Password' : 'Verify Admin Access'}
        </CardTitle>
        <CardDescription>
          {loading
            ? 'Checking admin configuration...'
            : isNewSetup
            ? 'Create an admin password to secure system settings and critical operations.'
            : 'Enter your admin password to verify access. You can skip this step and unlock admin later.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Checking configuration...
          </div>
        )}

        {!loading && (
          <>
            <div className="space-y-2">
              <Label htmlFor="admin-password">{isNewSetup ? 'New Password' : 'Password'}</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  data-testid="input-admin-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isNewSetup ? 'Minimum 8 characters' : 'Enter admin password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (status !== 'idle') setStatus('idle');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (isNewSetup ? handleSetup() : handleVerify())}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {isNewSetup && (
              <div className="space-y-2">
                <Label htmlFor="admin-confirm-password">Confirm Password</Label>
                <Input
                  id="admin-confirm-password"
                  data-testid="input-admin-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (status !== 'idle') setStatus('idle');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSetup()}
                />
              </div>
            )}

            {status !== 'idle' && status !== 'testing' && (
              <div
                className={`flex items-center gap-2 text-sm p-3 rounded-md ${
                  status === 'success'
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-destructive/10 text-destructive'
                }`}
                data-testid="text-admin-status"
              >
                {status === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                )}
                {statusMessage}
              </div>
            )}

            {status !== 'success' && (
              <Button
                className="w-full"
                variant="outline"
                onClick={isNewSetup ? handleSetup : handleVerify}
                disabled={status === 'testing' || !password}
                data-testid="button-admin-action"
              >
                {status === 'testing' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {isNewSetup ? 'Set Password' : 'Verify'}
              </Button>
            )}
          </>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onBack} data-testid="button-back-admin">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={onNext}
            disabled={loading}
            data-testid="button-finish-setup"
          >
            {status === 'success' || (!isNewSetup && status === 'idle')
              ? 'Finish Setup'
              : isNewSetup
              ? 'Skip for Now'
              : 'Skip'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DesktopSetup({ onComplete }: DesktopSetupProps) {
  const [step, setStep] = useState<SetupStep>('backend');
  const [backendUrl, setConnectedUrl] = useState('');

  const stepIndex = step === 'backend' ? 0 : step === 'vessel' ? 1 : 2;
  const stepLabels = ['Connection', 'Vessel', 'Admin'];

  function handleBackendNext(url: string) {
    setBackendUrl(url);
    setConnectedUrl(url);
    setStep('vessel');
  }

  function handleVesselNext(vesselIdVal: string, vesselNameVal: string) {
    if (vesselIdVal) {
      setVesselId(vesselIdVal);
      setVesselName(vesselNameVal);
    } else {
      localStorage.removeItem('arus-vessel-id');
      localStorage.removeItem('arus-vessel-name');
    }
    setStep('admin');
  }

  function handleFinish() {
    onComplete();
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="desktop-setup-page">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
            <Anchor className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-setup-title">ARUS Setup</h1>
          <p className="text-muted-foreground text-sm">Configure your desktop application</p>
        </div>

        <StepIndicator current={stepIndex} steps={stepLabels} />

        {step === 'backend' && <BackendStep onNext={handleBackendNext} />}
        {step === 'vessel' && (
          <VesselStep
            backendUrl={backendUrl}
            onNext={handleVesselNext}
            onBack={() => setStep('backend')}
          />
        )}
        {step === 'admin' && (
          <AdminStep
            backendUrl={backendUrl}
            onNext={handleFinish}
            onBack={() => setStep('vessel')}
          />
        )}
      </div>
    </div>
  );
}

```

### `client/src/pages/not-found.tsx` (21 lines)

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

```

### `client/src/components/dashboard-tabs.tsx` (45 lines)

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Cpu, Wrench } from "lucide-react";

interface DashboardTabsProps {
  overviewContent: React.ReactNode;
  devicesContent: React.ReactNode;
  maintenanceContent: React.ReactNode;
}

export function DashboardTabs({
  overviewContent,
  devicesContent,
  maintenanceContent,
}: DashboardTabsProps) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex mb-6">
        <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
          <LayoutDashboard className="h-4 w-4" />
          <span className="hidden sm:inline">Overview</span>
        </TabsTrigger>
        <TabsTrigger value="devices" className="gap-2" data-testid="tab-devices">
          <Cpu className="h-4 w-4" />
          <span className="hidden sm:inline">Devices</span>
        </TabsTrigger>
        <TabsTrigger value="maintenance" className="gap-2" data-testid="tab-maintenance">
          <Wrench className="h-4 w-4" />
          <span className="hidden sm:inline">Maintenance</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6 mt-0">
        {overviewContent}
      </TabsContent>

      <TabsContent value="devices" className="space-y-6 mt-0">
        {devicesContent}
      </TabsContent>

      <TabsContent value="maintenance" className="space-y-6 mt-0">
        {maintenanceContent}
      </TabsContent>
    </Tabs>
  );
}

```

### `client/src/components/dashboard/FleetRisksCard.tsx` (231 lines)

```tsx
import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ArrowRight, Clock, Ship, Wrench } from "lucide-react";
import { Link } from "wouter";

interface EquipmentHealth {
  id: string;
  name: string;
  type: string;
  vesselName?: string;
  healthScore: number;
  rul: number | null;
  pFail30d?: number;
  status: "healthy" | "warning" | "critical" | "unknown";
}

interface FleetRisksCardProps {
  limit?: number;
  showVessel?: boolean;
  className?: string;
  "data-testid"?: string;
  prefetchedHealthData?: EquipmentHealth[] | null;
}

const STATUS_VARIANTS: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  critical: "destructive",
  warning: "default",
  healthy: "secondary",
  unknown: "outline",
};

const STATUS_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  warning: "bg-yellow-500",
  healthy: "bg-green-500",
  unknown: "bg-gray-400",
};

export const FleetRisksCard = memo(function FleetRisksCard({
  limit = 5,
  showVessel = true,
  className = "",
  "data-testid": testId = "card-fleet-risks",
  prefetchedHealthData,
}: FleetRisksCardProps) {
  const { data: healthData, isLoading, error } = useQuery<EquipmentHealth[]>({
    queryKey: ["/api/equipment/health"],
    staleTime: 120000,
    refetchInterval: 120000,
    initialData: prefetchedHealthData ?? undefined,
  });

  if (isLoading && !healthData) {
    return (
      <Card className={className} data-testid={testId}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Top Fleet Risks
          </CardTitle>
          <CardDescription>Loading equipment health data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(limit)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !healthData || !Array.isArray(healthData)) {
    return (
      <Card className={className} data-testid={testId}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Top Fleet Risks
          </CardTitle>
          <CardDescription>Unable to load risk data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Could not retrieve equipment health data. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sortedRisks = [...healthData]
    .filter((eq) => eq.healthScore !== undefined)
    .sort((a, b) => {
      const healthRiskA = 100 - (a.healthScore ?? 100);
      const pFailRiskA = (a.pFail30d ?? 0) * 100;
      const rulRiskA = a.rul !== null && a.rul < 90 ? Math.max(0, 90 - a.rul) : 0;
      const riskA = healthRiskA * 0.4 + pFailRiskA * 0.4 + rulRiskA * 0.2;

      const healthRiskB = 100 - (b.healthScore ?? 100);
      const pFailRiskB = (b.pFail30d ?? 0) * 100;
      const rulRiskB = b.rul !== null && b.rul < 90 ? Math.max(0, 90 - b.rul) : 0;
      const riskB = healthRiskB * 0.4 + pFailRiskB * 0.4 + rulRiskB * 0.2;

      return riskB - riskA;
    })
    .slice(0, limit);

  const criticalCount = healthData.filter((eq) => eq.status === "critical").length;
  const warningCount = healthData.filter((eq) => eq.status === "warning").length;

  return (
    <Card className={className} data-testid={testId}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Top {limit} Fleet Risks
          </CardTitle>
          <div className="flex gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} Critical
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="default" className="text-xs">
                {warningCount} Warning
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          Equipment requiring immediate attention based on health, failure probability, and RUL
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {sortedRisks.length === 0 ? (
          <div className="py-8 text-center">
            <Ship className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">All equipment operating within safe parameters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedRisks.map((equipment, index) => (
              <Link
                key={equipment.id}
                href={`/pdm/equipment/${equipment.id}`}
                className="block hover:bg-muted/50 rounded-lg p-3 -m-3 transition-colors"
                data-testid={`link-risk-${equipment.id}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 relative">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${STATUS_COLORS[equipment.status]}`}
                    >
                      {index + 1}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{equipment.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{equipment.type}</span>
                          {showVessel && equipment.vesselName && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Ship className="h-3 w-3" />
                                {equipment.vesselName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge variant={STATUS_VARIANTS[equipment.status]} className="text-xs flex-shrink-0">
                        {equipment.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Health</span>
                        <span className="font-medium">{equipment.healthScore}%</span>
                      </div>
                      <Progress
                        value={equipment.healthScore}
                        className="h-1.5"
                        data-testid={`progress-health-${equipment.id}`}
                      />
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs">
                      {equipment.rul !== null && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          RUL: {equipment.rul} days
                        </span>
                      )}
                      {equipment.pFail30d !== undefined && equipment.pFail30d > 0 && (
                        <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                          <Wrench className="h-3 w-3" />
                          {(equipment.pFail30d * 100).toFixed(0)}% failure risk
                        </span>
                      )}
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

```

### `client/src/pages/notifications-hub.tsx` (83 lines)

```tsx
import { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, AlertTriangle, Mail } from "lucide-react";

const NotificationSettings = lazy(() => import("./notification-settings"));
const EmailAlertsSettings = lazy(() => import("./email-alerts-settings"));
const EmailTemplatesPage = lazy(() => import("./email-templates"));

function TabLoader() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[300px] w-full" />
    </div>
  );
}

function getTabFromUrl(): string {
  if (typeof window === "undefined") return "preferences";
  const params = new URLSearchParams(window.location.search);
  return params.get("tab") || "preferences";
}

export default function NotificationsHub() {
  const [activeTab, setActiveTab] = useState(() => getTabFromUrl());

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tabId);
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromUrl());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <div className="flex flex-col h-full p-4">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="preferences" className="flex items-center gap-2" data-testid="tab-preferences">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Preferences</span>
            </TabsTrigger>
            <TabsTrigger value="alert-rules" className="flex items-center gap-2" data-testid="tab-alert-rules">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Alert Rules</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2" data-testid="tab-templates">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preferences" className="mt-4">
            <Suspense fallback={<TabLoader />}>
              <NotificationSettings embedded />
            </Suspense>
          </TabsContent>

          <TabsContent value="alert-rules" className="mt-4">
            <Suspense fallback={<TabLoader />}>
              <EmailAlertsSettings embedded />
            </Suspense>
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <Suspense fallback={<TabLoader />}>
              <EmailTemplatesPage embedded />
            </Suspense>
          </TabsContent>
        </Tabs>
    </div>
  );
}

```

### `client/src/pages/sensors-hub.tsx` (87 lines)

```tsx
import { Brain, Activity, FileText } from "lucide-react";
import { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SensorOptimization = lazy(() => import("./sensor-optimization"));
const SensorManagement = lazy(() => import("./sensor-management"));
const SensorTemplatesPage = lazy(() => import("./sensor-templates"));

function PageLoader() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-[400px] w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[200px]" />
      </div>
    </div>
  );
}

function getTabFromUrl(): string {
  if (typeof window === "undefined") return "optimization";
  const params = new URLSearchParams(window.location.search);
  return params.get("tab") || "optimization";
}

export default function SensorsHub() {
  const [activeTab, setActiveTab] = useState(() => getTabFromUrl());

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tabId);
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromUrl());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <div className="flex flex-col h-full p-4">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="optimization" className="flex items-center gap-2" data-testid="tab-optimization">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">AI Optimization</span>
          </TabsTrigger>
          <TabsTrigger value="management" className="flex items-center gap-2" data-testid="tab-management">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Management</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2" data-testid="tab-templates">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="optimization" className="mt-4">
          <Suspense fallback={<PageLoader />}>
            <SensorOptimization />
          </Suspense>
        </TabsContent>

        <TabsContent value="management" className="mt-4">
          <Suspense fallback={<PageLoader />}>
            <SensorManagement />
          </Suspense>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <Suspense fallback={<PageLoader />}>
            <SensorTemplatesPage />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

```

### `client/src/pages/sensor-templates.tsx` (42 lines)

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings, Lock, Search } from "lucide-react";
import { TableSkeleton, ErrorState } from "@/components/patterns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SensorTemplateCreateDialog, SensorTemplateEditDialog } from "@/components/sensors/SensorTemplateFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useSensorTemplatesPage } from "@/features/telemetry";

const SENSOR_KINDS = ["vibration", "pressure", "temperature", "flow", "level", "voltage", "current", "frequency", "rpm", "oil_debris", "acoustic", "position"];
const EQUIPMENT_TYPES = ["main_engine", "auxiliary_engine", "gearbox", "marine_pump", "compressor", "generator", "boiler", "heat_exchanger", "propeller", "rudder", "thruster", "winch", "crane", "ballast_pump", "fire_pump", "hvac", "navigation_system"];

const getKindBadge = (kind: string) => { const colorMap: Record<string, string> = { vibration: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", pressure: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", temperature: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", flow: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200", level: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", voltage: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", current: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200", frequency: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200", rpm: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", oil_debris: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", acoustic: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" }; return <Badge variant="secondary" className={colorMap[kind] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"}>{kind}</Badge>; };

export default function SensorTemplatesPage() {
  const { selectedTemplate, isCreateDialogOpen, setIsCreateDialogOpen, isEditDialogOpen, setIsEditDialogOpen, deleteTemplate, setDeleteTemplate, searchQuery, setSearchQuery, kindFilter, setKindFilter, equipmentTypeFilter, setEquipmentTypeFilter, page, setPage, isLoading, error, systemTemplates, customTemplates, paginatedCustomTemplates, paginationMeta, handleEdit, handleDelete, clearFilters, hasActiveFilters, deleteMutation } = useSensorTemplatesPage();

  if (isLoading) {return <div className="container mx-auto p-6 space-y-6"><Card><CardHeader><CardTitle>Loading Templates...</CardTitle></CardHeader><CardContent><TableSkeleton rows={5} columns={6} /></CardContent></Card></div>;}
  if (error) {return <div className="container mx-auto p-6 space-y-6"><ErrorState error={error} onRetry={() => globalThis.location.reload()} /></div>;}

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-end"><Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-template"><Plus className="h-4 w-4 mr-2" />Create Template</Button></div>

      <Card><CardHeader><CardTitle className="text-lg">Filters</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="space-y-2"><Label htmlFor="search">Search</Label><div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="search" placeholder="Search templates..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8" data-testid="input-search" /></div></div><div className="space-y-2"><Label htmlFor="kind-filter">Sensor Kind</Label><Select value={kindFilter} onValueChange={setKindFilter}><SelectTrigger id="kind-filter" data-testid="select-kind-filter"><SelectValue placeholder="All kinds" /></SelectTrigger><SelectContent><SelectItem value="all">All kinds</SelectItem>{SENSOR_KINDS.map((kind) => <SelectItem key={kind} value={kind}>{kind}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="equipment-filter">Equipment Type</Label><Select value={equipmentTypeFilter} onValueChange={setEquipmentTypeFilter}><SelectTrigger id="equipment-filter" data-testid="select-equipment-filter"><SelectValue placeholder="All types" /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem>{EQUIPMENT_TYPES.map((type) => <SelectItem key={type} value={type}>{type.replaceAll('_', " ")}</SelectItem>)}</SelectContent></Select></div></div>{hasActiveFilters && <div className="mt-4"><Button variant="outline" size="sm" onClick={clearFilters} data-testid="button-clear-filters">Clear Filters</Button></div>}</CardContent></Card>

      {systemTemplates.length > 0 && <Card><CardHeader><div className="flex items-center gap-2"><Lock className="h-5 w-5 text-muted-foreground" /><CardTitle>System Templates</CardTitle></div><CardDescription>Read-only templates provided by the system ({systemTemplates.length} templates)</CardDescription></CardHeader><CardContent><div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Template ID</TableHead><TableHead>Name</TableHead><TableHead>Kind</TableHead><TableHead>Unit</TableHead><TableHead>Equipment Types</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader><TableBody>{systemTemplates.map((template) => <TableRow key={template.id} data-testid={`row-template-${template.templateId}`}><TableCell className="font-medium font-mono text-sm">{template.templateId}</TableCell><TableCell>{template.name}</TableCell><TableCell>{getKindBadge(template.kind)}</TableCell><TableCell>{template.unit || "-"}</TableCell><TableCell>{template.equipmentTypes && template.equipmentTypes.length > 0 ? <div className="flex flex-wrap gap-1">{template.equipmentTypes.slice(0, 3).map((type) => <Badge key={type} variant="outline" className="text-xs">{type.replaceAll('_', " ")}</Badge>)}{template.equipmentTypes.length > 3 && <Badge variant="outline" className="text-xs">+{template.equipmentTypes.length - 3} more</Badge>}</div> : "-"}</TableCell><TableCell className="max-w-xs truncate text-sm">{template.notes || "-"}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>}

      <Card><CardHeader><CardTitle>Custom Templates</CardTitle><CardDescription>Organization-specific templates ({customTemplates.length} templates)</CardDescription></CardHeader><CardContent>{customTemplates.length === 0 ? <div className="text-center py-12 text-muted-foreground"><Settings className="h-12 w-12 mx-auto mb-4 opacity-50" /><p className="font-medium">No custom templates yet</p><p className="text-sm mt-2">Create your first template to get started.</p></div> : <><div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Template ID</TableHead><TableHead>Name</TableHead><TableHead>Kind</TableHead><TableHead>Unit</TableHead><TableHead>Equipment Types</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{paginatedCustomTemplates.map((template) => <TableRow key={template.id} data-testid={`row-template-${template.templateId}`}><TableCell className="font-medium font-mono text-sm">{template.templateId}</TableCell><TableCell>{template.name}</TableCell><TableCell>{getKindBadge(template.kind)}</TableCell><TableCell>{template.unit || "-"}</TableCell><TableCell>{template.equipmentTypes && template.equipmentTypes.length > 0 ? <div className="flex flex-wrap gap-1">{template.equipmentTypes.slice(0, 2).map((type) => <Badge key={type} variant="outline" className="text-xs">{type.replaceAll('_', " ")}</Badge>)}{template.equipmentTypes.length > 2 && <Badge variant="outline" className="text-xs">+{template.equipmentTypes.length - 2}</Badge>}</div> : "-"}</TableCell><TableCell className="max-w-xs truncate text-sm">{template.notes || "-"}</TableCell><TableCell className="text-right"><div className="flex gap-2 justify-end"><Button size="sm" variant="outline" onClick={() => handleEdit(template)} data-testid={`button-edit-${template.templateId}`}>Edit</Button><Button size="sm" variant="destructive" onClick={() => setDeleteTemplate(template)} data-testid={`button-delete-${template.templateId}`}>Delete</Button></div></TableCell></TableRow>)}</TableBody></Table></div>{paginationMeta.totalPages > 1 && <div className="flex items-center justify-between mt-4"><div className="text-sm text-muted-foreground">Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, paginationMeta.total)} of {paginationMeta.total} custom templates</div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} data-testid="button-prev-page">Previous</Button><Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(paginationMeta.totalPages, p + 1))} disabled={page === paginationMeta.totalPages} data-testid="button-next-page">Next</Button></div></div>}</>}</CardContent></Card>

      <SensorTemplateCreateDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
      {selectedTemplate && <SensorTemplateEditDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} template={selectedTemplate} />}
      <AlertDialog open={!!deleteTemplate} onOpenChange={(open) => !open && setDeleteTemplate(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Template</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete template "{deleteTemplate?.name}"? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" data-testid="button-confirm-delete">{deleteMutation.isPending ? "Deleting..." : "Delete"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </div>
    </div>
  );
}

```

### `client/src/pages/manual-telemetry-upload.tsx` (38 lines)

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, Database, CheckCircle, AlertCircle, Download, Trash2, RefreshCw } from "lucide-react";
import { formatDateTimeSgt } from "@/lib/time-utils";
import { useManualTelemetryUpload, type RawTelemetry } from "@/features/telemetry";
import { PageHeader } from "@/components/navigation";

export default function ManualTelemetryUpload() {
  const { csvData, setCsvData, jsonData, setJsonData, uploadProgress, lastResult, telemetryData, dataLoading, csvImportMutation, jsonImportMutation, handleCsvImport, handleJsonImport, downloadSampleCsv, downloadSampleJson, clearData, handleRefresh } = useManualTelemetryUpload();

  return (
    <div className="min-h-screen">
      <PageHeader title="Manual Telemetry Upload" />
      <div className="p-6 space-y-6">

      {uploadProgress > 0 && <Card><CardContent className="pt-6"><div className="flex items-center space-x-4"><div className="flex-1"><div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">Import Progress</span><span className="text-sm text-muted-foreground">{uploadProgress}%</span></div><Progress value={uploadProgress} className="h-2" /></div></div></CardContent></Card>}

      {lastResult && <Card className={lastResult.ok ? "border-green-500" : "border-destructive"}><CardContent className="pt-6"><div className="flex items-start space-x-4">{lastResult.ok ? <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" /> : <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />}<div className="flex-1"><p className="font-medium">{lastResult.ok ? "Import Successful" : "Import Failed"}</p><p className="text-sm text-muted-foreground">{lastResult.message}</p>{lastResult.processed && <p className="text-sm text-muted-foreground">Processed {lastResult.processed} rows, inserted {lastResult.inserted} records</p>}</div></div></CardContent></Card>}

      <Tabs defaultValue="csv" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="csv" data-testid="tab-csv-upload"><FileText className="w-4 h-4 mr-2" />CSV Upload</TabsTrigger><TabsTrigger value="json" data-testid="tab-json-upload"><Database className="w-4 h-4 mr-2" />JSON Upload</TabsTrigger></TabsList>

        <TabsContent value="csv"><Card><CardHeader><CardTitle className="flex items-center justify-between">CSV Data Import<div className="flex items-center space-x-2"><Button variant="outline" size="sm" onClick={downloadSampleCsv} data-testid="button-download-csv-sample"><Download className="w-4 h-4 mr-2" />CSV Template</Button><Button variant="outline" size="sm" onClick={() => clearData("csv")} data-testid="button-clear-csv"><Trash2 className="w-4 h-4 mr-2" />Clear</Button></div></CardTitle><CardDescription>Upload telemetry data in CSV format. Required columns: ts, vessel, src, sig. Optional: value, unit.</CardDescription></CardHeader><CardContent className="space-y-4"><div><Label htmlFor="csv-data" className="text-sm font-medium">CSV Data</Label><Textarea id="csv-data" placeholder="ts,vessel,src,sig,value,unit&#10;# Enter your telemetry data here" value={csvData} onChange={(e) => setCsvData(e.target.value)} rows={8} className="font-mono text-sm" data-testid="textarea-csv-data" /></div><Button onClick={handleCsvImport} disabled={!csvData.trim() || csvImportMutation.isPending} className="w-full" data-testid="button-import-csv"><Upload className="w-4 h-4 mr-2" />{csvImportMutation.isPending ? "Importing..." : "Import CSV Data"}</Button></CardContent></Card></TabsContent>

        <TabsContent value="json"><Card><CardHeader><CardTitle className="flex items-center justify-between">JSON Data Import<div className="flex items-center space-x-2"><Button variant="outline" size="sm" onClick={downloadSampleJson} data-testid="button-download-json-sample"><Download className="w-4 h-4 mr-2" />JSON Template</Button><Button variant="outline" size="sm" onClick={() => clearData("json")} data-testid="button-clear-json"><Trash2 className="w-4 h-4 mr-2" />Clear</Button></div></CardTitle><CardDescription>Upload telemetry data in JSON format. Use the "rows" array with telemetry objects.</CardDescription></CardHeader><CardContent className="space-y-4"><div><Label htmlFor="json-data" className="text-sm font-medium">JSON Data</Label><Textarea id="json-data" placeholder='{"rows": [...]}' value={jsonData} onChange={(e) => setJsonData(e.target.value)} rows={8} className="font-mono text-sm" data-testid="textarea-json-data" /></div><Button onClick={handleJsonImport} disabled={!jsonData.trim() || jsonImportMutation.isPending} className="w-full" data-testid="button-import-json"><Upload className="w-4 h-4 mr-2" />{jsonImportMutation.isPending ? "Importing..." : "Import JSON Data"}</Button></CardContent></Card></TabsContent>
      </Tabs>

      <Card><CardHeader><CardTitle className="flex items-center justify-between"><div className="flex items-center"><Database className="mr-2 h-5 w-5" />Imported Telemetry Data</div><Button variant="outline" size="sm" onClick={handleRefresh} data-testid="button-refresh-data"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button></CardTitle><CardDescription>Recently imported raw telemetry data. This data can be processed and transformed into equipment telemetry.</CardDescription></CardHeader><CardContent>{dataLoading ? <div className="text-center py-8 text-muted-foreground">Loading telemetry data...</div> : telemetryData?.length > 0 ? <ScrollArea className="h-96"><div className="space-y-2">{telemetryData.slice(0, 50).map((item: RawTelemetry) => <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg"><div className="flex-1"><div className="flex items-center space-x-4"><Badge variant="outline">{item.vessel}</Badge><span className="font-mono text-sm">{item.src}</span><span className="text-sm text-muted-foreground">{item.sig}</span></div><div className="flex items-center space-x-4 mt-1"><span className="text-sm font-medium">{item.value === null ? "N/A" : `${item.value} ${item.unit || ""}`}</span><span className="text-xs text-muted-foreground">{formatDateTimeSgt(item.ts)}</span></div></div></div>)}{telemetryData.length > 50 && <div className="text-center py-4 text-muted-foreground">... and {telemetryData.length - 50} more records</div>}</div></ScrollArea> : <div className="text-center py-8 text-muted-foreground">No telemetry data imported yet. Upload some data using the tabs above.</div>}</CardContent></Card>
      </div>
    </div>
  );
}

```

### `client/src/components/ActiveDtcsPanel.tsx` (177 lines)

```tsx
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, Clock, AlertTriangle, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow, format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import type { DtcFault, DtcDefinition } from "@shared/schema";

interface EnrichedDtcFault extends DtcFault {
  definition?: DtcDefinition;
}

interface ActiveDtcsPanelProps {
  equipmentId: string;
  equipmentName?: string;
}

export function ActiveDtcsPanel({ equipmentId, equipmentName }: ActiveDtcsPanelProps) {
  const {
    data: activeDtcs = [],
    isLoading,
    isError,
  } = useQuery<EnrichedDtcFault[]>({
    queryKey: ["/api/equipment", equipmentId, "dtc", "active"],
    queryFn: () => apiRequest("GET", `/api/equipment/${equipmentId}/dtc/active`),
    refetchInterval: 30000,
  });

  const getSeverityColor = (severity?: number) => {
    switch (severity) {
      case 1:
      case 2:
        return "destructive";
      case 3:
        return "default";
      case 4:
        return "secondary";
      default:
        return "outline";
    }
  };

  const getSeverityIcon = (severity?: number) => {
    switch (severity) {
      case 1:
      case 2:
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 3:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSeverityLabel = (severity?: number) => {
    switch (severity) {
      case 1:
        return "critical";
      case 2:
        return "high";
      case 3:
        return "moderate";
      case 4:
        return "low";
      default:
        return "unknown";
    }
  };

  const criticalFaults = activeDtcs.filter(
    (dtc) => dtc.definition?.severity === 1 || dtc.definition?.severity === 2
  ).length;
  const warningFaults = activeDtcs.filter((dtc) => dtc.definition?.severity === 3).length;

  return (
    <Card data-testid={`active-dtcs-panel-${equipmentId}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Active Fault Codes
            </CardTitle>
            <CardDescription>
              {equipmentName
                ? `Diagnostic trouble codes for ${equipmentName}`
                : "Current active DTCs"}
            </CardDescription>
          </div>
          {activeDtcs.length > 0 && (
            <div className="flex items-center gap-2">
              {criticalFaults > 0 && (
                <Badge variant="destructive" data-testid="badge-critical-count">
                  {criticalFaults} Critical
                </Badge>
              )}
              {warningFaults > 0 && (
                <Badge variant="default" data-testid="badge-warning-count">
                  {warningFaults} Warning
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-destructive" />
            <p>Failed to load fault codes</p>
          </div>
        ) : activeDtcs.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-muted-foreground">No active fault codes - system healthy!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeDtcs.map((dtc, index) => (
              <div
                key={`${dtc.spn}-${dtc.fmi}-${index}`}
                className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors"
                data-testid={`dtc-item-${index}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {getSeverityIcon(dtc.definition?.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="font-mono font-semibold text-foreground whitespace-nowrap">
                          SPN {dtc.spn} / FMI {dtc.fmi}
                        </span>
                        <Badge
                          variant={getSeverityColor(dtc.definition?.severity)}
                          className="capitalize"
                        >
                          {getSeverityLabel(dtc.definition?.severity)}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground mb-2">
                        {dtc.definition?.description || "No description available"}
                      </p>
                      {dtc.oc && dtc.oc > 1 && (
                        <p className="text-xs font-medium text-yellow-600">{dtc.oc} occurrences</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground whitespace-nowrap">
                    {dtc.firstSeen && (
                      <div className="flex items-center gap-1 justify-end mb-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(dtc.firstSeen), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                    {dtc.lastSeen && (
                      <div className="text-xs">
                        Last: {format(new Date(dtc.lastSeen), "MMM d, HH:mm")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

```

### `client/src/components/HealthLegend.tsx` (85 lines)

```tsx
import { memo } from "react";
import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const HealthLegend = memo(function HealthLegend() {
  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-foreground">Health Index Guide</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-chart-3"></div>
                <span className="text-muted-foreground">75-100% = Healthy (Good condition)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-chart-2"></div>
                <span className="text-muted-foreground">50-74% = Warning (Monitor closely)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-destructive"></div>
                <span className="text-muted-foreground">0-49% = Critical (Service required)</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export const HealthIndexTooltip = memo(function HealthIndexTooltip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2 text-xs">
            <p className="font-semibold">Health Index (0-100%)</p>
            <div className="space-y-1">
              <p>
                <span className="text-chart-3">●</span> 75-100%: Healthy - Equipment in good
                condition
              </p>
              <p>
                <span className="text-chart-2">●</span> 50-74%: Warning - Monitor closely, service
                soon
              </p>
              <p>
                <span className="text-destructive">●</span> 0-49%: Critical - Immediate service
                required
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

export const StatusLegend = memo(function StatusLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
      <div className="flex items-center gap-1.5">
        <span className="status-indicator status-healthy"></span>
        <span>Healthy</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="status-indicator status-warning"></span>
        <span>Warning</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="status-indicator status-critical"></span>
        <span>Critical</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="status-indicator status-offline"></span>
        <span>Offline</span>
      </div>
    </div>
  );
});

```

### `client/src/components/context/OperatingModeChip.tsx` (123 lines)

```tsx
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Activity, Info } from "lucide-react";

interface OperatingModeChipProps {
  vesselId: string;
  className?: string;
}

interface ModeDetectionResult {
  mode: "DP" | "Transit" | "Harbor" | "Cargo_Ops" | "Standby" | "Docking" | "Unknown";
  confidence: number;
  indicators: string[];
  timestamp: string;
  color: string;
  label: string;
}

export function OperatingModeChip({ vesselId, className = "" }: OperatingModeChipProps) {
  const {
    data: modeData,
    isLoading,
    error,
  } = useQuery<ModeDetectionResult>({
    queryKey: ["/api/vessels", vesselId, "operating-mode"],
    enabled: !!vesselId,
    staleTime: 60000,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Badge
        variant="outline"
        className={`gap-1.5 ${className}`}
        data-testid={`chip-mode-loading-${vesselId}`}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Mode</span>
      </Badge>
    );
  }

  if (error || !modeData) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`gap-1.5 ${className}`}
              data-testid={`chip-mode-unavailable-${vesselId}`}
            >
              <Info className="h-3 w-3" />
              <span>Mode: N/A</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>No recent telemetry data available</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const getModeStyle = (mode: string): string => {
    const baseStyles = "text-white font-medium";

    switch (mode) {
      case "DP":
        return `${baseStyles} bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600`;
      case "Transit":
        return `${baseStyles} bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600`;
      case "Harbor":
        return `${baseStyles} bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600`;
      case "Cargo_Ops":
        return `${baseStyles} bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600`;
      case "Standby":
        return `${baseStyles} bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600`;
      case "Docking":
        return `${baseStyles} bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600`;
      default:
        return `${baseStyles} bg-gray-400 hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-700`;
    }
  };

  const confidencePercent = Math.round(modeData.confidence * 100);

  const tooltipText = `
    Operating Mode Detection
    
    Mode: ${modeData.label}
    Confidence: ${confidencePercent}%
    
    Indicators:
    ${modeData.indicators.map((i) => `• ${i}`).join("\n")}
    
    Last updated: ${new Date(modeData.timestamp).toLocaleTimeString()}
  `.trim();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={`gap-1.5 ${getModeStyle(modeData.mode)} ${className}`}
            data-testid={`chip-mode-${vesselId}`}
          >
            <Activity className="h-3 w-3" />
            <span>{modeData.label}</span>
            {confidencePercent < 70 && (
              <span className="text-xs opacity-70">({confidencePercent}%)</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs whitespace-pre-line">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

```

