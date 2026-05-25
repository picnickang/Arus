/**
 * Portal Login Split — pilot landing page.
 *
 * Two-card entry that lets the user self-classify into the Admin or
 * User portal before the rest of the app loads. This is a UX
 * affordance ONLY:
 *   - It writes a role hint to localStorage (`arus-user-role`) which
 *     the simplified-nav policy already reads.
 *   - It does NOT bypass `SessionGate`. The real auth flow (admin
 *     password verify against the backend, dev auto-unlock in
 *     `import.meta.env.DEV`) is unchanged.
 *
 * Production safety:
 *   - No credentials are stored or shipped from this page.
 *   - The pilot "admin/admin" account, where it applies, is enforced
 *     entirely by the dev-mode auto-unlock in `AdminAccessContext`
 *     (gated on `import.meta.env.DEV`). In production builds this
 *     page funnels users through the same `SessionGate` password
 *     prompt as before.
 */

import { useLocation } from "wouter";
import { Shield, User, ArrowRight, Anchor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROLE_STORAGE_KEY } from "@/config/roles";
import { getLandingRouteForRole } from "@/application/navigation/role-navigation-policy";

type PortalChoice = {
  roleHint: "system_admin" | "deck_officer";
  title: string;
  subtitle: string;
  cta: string;
  icon: typeof Shield;
  accent: string;
  testId: string;
};

const PORTALS: PortalChoice[] = [
  {
    roleHint: "system_admin",
    title: "Admin Portal",
    subtitle: "System administration, fleet management, and advanced tools.",
    cta: "Admin Login",
    icon: Shield,
    accent: "bg-primary text-primary-foreground hover:bg-primary/90",
    testId: "card-portal-admin",
  },
  {
    roleHint: "deck_officer",
    title: "User Portal",
    subtitle: "Operational dashboard, tasks, and feedback.",
    cta: "User Login",
    icon: User,
    accent: "bg-teal-600 text-white hover:bg-teal-700",
    testId: "card-portal-user",
  },
];

export default function PortalLoginPage() {
  const [, setLocation] = useLocation();

  function choosePortal(choice: PortalChoice) {
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, choice.roleHint);
      // Clear any prior bottom-nav override so the new role's policy
      // takes effect on next render.
      localStorage.removeItem("arus-bottom-nav-items");
    } catch {
      // localStorage may be unavailable (private mode, SSR). The
      // policy will fall back to the "default" branch (user portal).
    }
    setLocation(getLandingRouteForRole(choice.roleHint));
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
      data-testid="page-portal-login"
    >
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10 text-white">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur">
            <Anchor className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome to ARUS</h1>
          <p className="mt-2 text-sm text-white/70">
            Advanced Reliability &amp; Unified Systems
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {PORTALS.map((portal) => {
            const Icon = portal.icon;
            return (
              <Card
                key={portal.roleHint}
                className="overflow-hidden border-white/10 bg-white/95 backdrop-blur transition hover:shadow-xl"
                data-testid={portal.testId}
              >
                <CardContent className="flex flex-col items-center text-center gap-4 p-8">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                    <Icon className="h-7 w-7 text-slate-700" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-slate-900">{portal.title}</h2>
                    <p className="text-sm text-slate-600">{portal.subtitle}</p>
                  </div>
                  <Button
                    className={`w-full ${portal.accent}`}
                    onClick={() => choosePortal(portal)}
                    data-testid={`button-${portal.testId}`}
                  >
                    {portal.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-white/50">
          Secure. Reliable. Maritime.
        </p>
      </div>
    </div>
  );
}
