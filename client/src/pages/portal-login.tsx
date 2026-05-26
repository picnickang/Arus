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
 *   - The status pill on this screen is a static "All Systems
 *     Operational" indicator — it intentionally makes NO network
 *     calls pre-authentication.
 */

import { useLocation } from "wouter";
import { Shield, User, ArrowRight, Anchor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OpsStatusPill } from "@/components/ops";
import { ROLE_STORAGE_KEY } from "@/config/roles";
import { getLandingRouteForRole } from "@/application/navigation/role-navigation-policy";

type PortalChoice = {
  roleHint: "system_admin" | "deck_officer";
  title: string;
  subtitle: string;
  cta: string;
  icon: typeof Shield;
  variant: "primary" | "secondary";
  testId: string;
};

const PORTALS: PortalChoice[] = [
  {
    roleHint: "system_admin",
    title: "Admin Portal",
    subtitle: "System administration, fleet management, and advanced tools.",
    cta: "Admin Login",
    icon: Shield,
    variant: "primary",
    testId: "card-portal-admin",
  },
  {
    roleHint: "deck_officer",
    title: "User Portal",
    subtitle: "Operational dashboard, tasks, and feedback.",
    cta: "User Login",
    icon: User,
    variant: "secondary",
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
      className="ops-surface relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12"
      data-testid="page-portal-login"
    >
      {/* Decorative horizon glow — purely presentational. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-sky-500/10 via-transparent to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl"
      />

      <div className="relative z-10 w-full max-w-3xl">
        <div className="mb-10 text-center text-white">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-inset ring-white/10 backdrop-blur">
            <Anchor className="h-8 w-8 text-sky-300" strokeWidth={1.75} />
          </div>
          <h1
            className="text-3xl font-semibold tracking-tight md:text-4xl"
            data-testid="text-portal-title"
          >
            ARUS
          </h1>
          <p
            className="mt-3 text-sm text-sky-100/80 md:text-base"
            data-testid="text-portal-tagline"
          >
            Operational Intelligence for Maritime Excellence
          </p>
          <p className="mt-1 text-xs text-white/40">
            AI-powered operations. Safer crews. Smarter fleets.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {PORTALS.map((portal) => {
            const Icon = portal.icon;
            const isPrimary = portal.variant === "primary";
            return (
              <Card
                key={portal.roleHint}
                className="ops-card overflow-hidden"
                data-testid={portal.testId}
              >
                <CardContent className="flex flex-col items-center gap-4 p-7 text-center">
                  <div
                    className={
                      isPrimary
                        ? "flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/40"
                        : "flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-500/30"
                    }
                  >
                    <Icon className="h-7 w-7" strokeWidth={1.75} />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-foreground">
                      {portal.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">{portal.subtitle}</p>
                  </div>
                  <Button
                    variant={isPrimary ? "default" : "outline"}
                    className="w-full gap-2"
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

        <div
          className="mt-8 flex flex-col items-center gap-2"
          data-testid="portal-status-row"
        >
          <OpsStatusPill
            label="All Systems Operational"
            severity="success"
            icon={
              <span className="block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            }
            testId="pill-system-status"
          />
          <p className="text-xs text-white/40">Secure. Reliable. Maritime.</p>
        </div>
      </div>
    </div>
  );
}
