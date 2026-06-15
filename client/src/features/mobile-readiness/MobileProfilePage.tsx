import { Link } from "wouter";
import { ClipboardList, LifeBuoy, Settings } from "lucide-react";

import { MobilePageShell } from "./MobilePageShell";
import { AppHeader, Content, readRoleHint } from "./MobileReadinessShared";

function formatRole(role: string | null): string {
  if (!role) {
    return "Crew";
  }
  return role.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const QUICK_ACTIONS = [
  { id: "tasks", label: "My Tasks", href: "/work-orders", icon: ClipboardList },
  { id: "settings", label: "Settings", href: "/system", icon: Settings },
  { id: "support", label: "Help & Support", href: "/logs", icon: LifeBuoy },
] as const;

/**
 * Mobile profile screen. Uses the shared mobile shell + AppHeader (so it carries
 * the same brilliance control and nav drawer as the other screens) and exposes
 * real, navigable quick actions instead of the previous placeholder buttons.
 */
export function MobileProfilePage() {
  const roleLabel = formatRole(readRoleHint());
  return (
    <MobilePageShell>
      <AppHeader title="Profile" roleLabel={roleLabel} />
      <Content>
        {/* Mirror the desktop ProfilePage testid so /profile is assertable on both
            viewports (the nav/control crawl asserts page-profile regardless of size). */}
        <div className="space-y-3" data-testid="page-profile">
          <div
            className="rounded-lg border border-slate-200 bg-white p-4"
            data-testid="profile-identity"
          >
            <div className="text-base font-bold text-slate-900">Signed in</div>
            <div className="mt-1 text-sm text-slate-600">
              Role: <span className="font-semibold text-slate-900">{roleLabel}</span>
            </div>
          </div>

          <nav className="space-y-2" aria-label="Profile quick actions">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.id}
                  href={action.href}
                  className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900"
                  data-testid={`profile-link-${action.id}`}
                >
                  <Icon className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                  <span>{action.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </Content>
    </MobilePageShell>
  );
}
