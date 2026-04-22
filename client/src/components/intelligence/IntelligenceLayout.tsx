import { Link, useLocation } from "wouter";
import { Brain, ChevronRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SuggestionBell } from "@/components/agent/SuggestionCards";
import type { ReactNode } from "react";

interface IntelligenceTab {
  label: string;
  href: string;
  testId: string;
}

const tabs: IntelligenceTab[] = [
  { label: "Overview", href: "/equipment-intelligence", testId: "tab-overview" },
  { label: "Maintenance Schedule", href: "/pdm-dashboard", testId: "tab-schedule" },
  { label: "Digital Twin", href: "/digital-twin", testId: "tab-digital-twin" },
  { label: "Diagnostics", href: "/pdm-pack", testId: "tab-diagnostics" },
  { label: "ML Platform", href: "/pdm-platform", testId: "tab-ml-platform" },
];

function isActiveTab(tabHref: string, currentPath: string): boolean {
  const path = currentPath.split("?")[0];
  if (tabHref === "/equipment-intelligence") {
    return path === "/equipment-intelligence";
  }
  return path.startsWith(tabHref);
}

function getActiveTabLabel(currentPath: string): string | null {
  const match = tabs.find((t) => isActiveTab(t.href, currentPath));
  return match && match.href !== "/equipment-intelligence" ? match.label : null;
}

interface IntelligenceLayoutProps {
  children: ReactNode;
}

export function IntelligenceLayout({ children }: IntelligenceLayoutProps) {
  const [location] = useLocation();
  const breadcrumbLabel = getActiveTabLabel(location);

  return (
    <div className="min-h-screen bg-[#080e1a] text-slate-200" data-testid="intelligence-layout">
      <header className="sticky top-0 z-40 border-b border-slate-700/20 bg-[#080e1a]/95 backdrop-blur supports-[backdrop-filter]:bg-[#080e1a]/80">
        <div className="flex h-14 items-center gap-4 px-4 md:px-6">
          <Link href="/">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-slate-400 hover:text-slate-200"
              data-testid="button-home"
            >
              <Home className="h-5 w-5" />
              <span className="sr-only">Home</span>
            </Button>
          </Link>

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Brain className="h-5 w-5 text-sky-400 shrink-0" />
            <div className="flex items-center gap-1.5 min-w-0">
              {breadcrumbLabel ? (
                <>
                  <Link
                    href="/equipment-intelligence"
                    className="text-sm text-slate-400 hover:text-slate-200 transition-colors shrink-0"
                    data-testid="breadcrumb-root"
                  >
                    Equipment Intelligence
                  </Link>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                  <span
                    className="text-sm font-semibold text-slate-100 truncate"
                    data-testid="breadcrumb-current"
                  >
                    {breadcrumbLabel}
                  </span>
                </>
              ) : (
                <h1
                  className="text-lg font-semibold text-slate-100 truncate"
                  data-testid="text-page-title"
                >
                  Equipment Intelligence
                </h1>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SuggestionBell />
            <ThemeToggle />
          </div>
        </div>

        <nav
          className="flex items-center gap-1 px-4 md:px-6 pb-2 overflow-x-auto"
          data-testid="intelligence-tabs"
        >
          {tabs.map((tab) => {
            const active = isActiveTab(tab.href, location);
            return (
              <Link key={tab.href} href={tab.href}>
                <button
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? "bg-sky-500/15 text-sky-400 border border-sky-500/25"
                      : "text-slate-500 hover:text-slate-300 hover:bg-slate-700/30"
                  }`}
                  data-testid={tab.testId}
                >
                  {tab.label}
                </button>
              </Link>
            );
          })}
        </nav>
      </header>

      <main>{children}</main>
    </div>
  );
}
