import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

import {
  getMobileReadinessExpectedScreen,
  isMobileReadinessReplacementPath,
} from "../../client/src/features/mobile-readiness/mobile-readiness-route-contract";
import {
  hideDevPerfOverlay,
  installRoleFixtures,
  loginRole,
  navigateWithinAuthenticatedSpa,
  type PermissionMatrix,
} from "./helpers/spa-auth";

/**
 * Permission matrix that mirrors the controls an admin-capable role exposes in
 * the mobile shell (kept verbatim from the pre-helper crawl so the same set of
 * route/state controls is enumerated).
 */
const CRAWL_ADMIN_PERMISSIONS: PermissionMatrix = {
  crew_members: { view: true, create: true, edit: true, delete: true, export: true },
  inventory: { view: true, create: true, edit: true, delete: true, export: true },
  permission_management: { view: true, edit: true },
  safety_bulletins: { view: true, create: true },
  vessels: { view: true, edit: true },
  work_orders: { view: true, create: true, edit: true, delete: true, export: true },
};

type AuditRole = "super_admin" | "system_admin" | "deck_officer" | "crew_member" | "viewer";

interface RoleScenario {
  role: AuditRole;
  adminCapable: boolean;
  startRoutes: string[];
}

interface RouteControlDescriptor {
  auditId: string;
  tagName: string;
  testId: string | null;
  label: string;
  href: string;
  expectedPath: string;
}

interface StateButtonDescriptor {
  auditId: string;
  label: string;
  testId: string | null;
}

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const adminRoutes = [
  "/",
  "/fleet",
  "/vessel-intelligence/mv-atlas/overview",
  "/vessel-intelligence/mv-atlas/diagrams",
  "/pdm-platform",
  "/pdm/equipment/port-generator",
  "/pdm/equipment/port-generator/telemetry",
  "/work-orders",
  "/work-orders/so-4481",
  "/logs",
  "/crew-management",
  "/logistics",
  "/system",
] as const;

const roleScenarios: RoleScenario[] = [
  { role: "super_admin", adminCapable: true, startRoutes: [...adminRoutes] },
  { role: "system_admin", adminCapable: true, startRoutes: [...adminRoutes] },
  {
    role: "deck_officer",
    adminCapable: false,
    startRoutes: ["/", "/logs", "/crew-management", "/pdm-platform"],
  },
  { role: "crew_member", adminCapable: false, startRoutes: ["/", "/logs"] },
  { role: "viewer", adminCapable: false, startRoutes: ["/", "/logs"] },
];

const documentedStateOnlyButton =
  /^(?:Open menu|Pull to refresh|Refresh|Legend|Zones|View section|Filters?|Overview|Machinery|Work|Alerts|Crew|Inventory|Documents|Summary|Health|Trend|Maintenance|Info|Telemetry|Events|Advanced Graph|Raw Data|Sensors|1d|7d|30d|Custom|Compare|Actions|Save Draft|Save Draft Offline|Complete Work|Add|View All|History|Logistics|Vendors|Card view|Table view|View More History|Log Out|Details|Linked|Daily|Engine|Deck|Safety|Compliance|All|Mine|My Work|Overdue|Watch|Blocked|Parts|Review|Done|Open|In Progress|Waiting|Ready|Closed|Intake|Triage|Assigned|CSV|Side elevation|Deck plan|Machinery arrangement|Fire safety|Electrical single-line|Engine Log|Deck Watch|Condition Log|Signoff)$/i;

function normalizedStateButtonLabel(label: string): string {
  return label
    .replace(/\s*\(\d+\)\s*$/g, "")
    .replace(/([A-Za-z])\d+$/g, "$1")
    .trim();
}

function escapedRouteRegex(path: string): RegExp {
  return new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[?#].*)?$`);
}

function markerForPath(path: string): string | null {
  const marker = getMobileReadinessExpectedScreen(path);
  return marker ? `mobile-readiness-screen-${marker}` : null;
}

async function expectHealthyPage(page: Page, expectedPath: string): Promise<void> {
  await expect(page).toHaveURL(escapedRouteRegex(expectedPath));
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByText("404 Page Not Found")).toHaveCount(0);
  await expect(page.getByTestId("shell-admin-hubs")).toHaveCount(0);
  await expect(page.getByTestId("text-admin-hubs-title")).toHaveCount(0);

  if (isMobileReadinessReplacementPath(expectedPath)) {
    const marker = markerForPath(expectedPath);
    expect(marker).not.toBeNull();
    await expect(page.getByTestId("mobile-readiness-shell")).toBeVisible();
    await expect(page.getByTestId(marker!)).toBeVisible();
    return;
  }

  if (expectedPath === "/profile") {
    await expect(page.getByTestId("page-profile")).toBeVisible();
    return;
  }

  if (expectedPath === "/my-tasks") {
    await expect(page.getByTestId("page-my-tasks")).toBeVisible();
  }
}

async function collectRouteControls(page: Page): Promise<RouteControlDescriptor[]> {
  return page.evaluate(() => {
    const isVisible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    };

    let index = 0;
    return Array.from(document.querySelectorAll<HTMLElement>("a[href], [data-route-target]"))
      .filter((element) =>
        Boolean(
          element.closest(
            '[data-testid="mobile-readiness-shell"], [data-testid="mobile-readiness-bottom-nav"], [data-testid^="page-"], [data-testid="universal-ops-shell"]'
          )
        )
      )
      .filter(isVisible)
      .map((element) => {
        const rawHref =
          element.getAttribute("href") ?? element.getAttribute("data-route-target") ?? "";
        if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:")) {
          return null;
        }
        const url = new URL(rawHref, window.location.origin);
        if (url.origin !== window.location.origin) {
          return null;
        }
        const auditId = `route-control-${index}`;
        index += 1;
        element.setAttribute("data-e2e-route-control", auditId);
        return {
          auditId,
          tagName: element.tagName.toLowerCase(),
          testId: element.getAttribute("data-testid"),
          label: (element.textContent ?? element.getAttribute("aria-label") ?? "").trim(),
          href: rawHref,
          expectedPath: url.pathname,
        };
      })
      .filter((control): control is RouteControlDescriptor => control !== null);
  });
}

async function collectStateButtons(page: Page): Promise<StateButtonDescriptor[]> {
  return page.evaluate(() => {
    const isVisible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    };

    let index = 0;
    return Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .filter((button) =>
        Boolean(
          button.closest(
            '[data-testid="mobile-readiness-shell"], [data-testid="mobile-readiness-bottom-nav"], [data-testid^="page-"], [data-testid="universal-ops-shell"]'
          )
        )
      )
      .filter(isVisible)
      .filter((button) => !button.closest("a[href]") && !button.getAttribute("data-route-target"))
      .map((button) => {
        const auditId = `state-button-${index}`;
        index += 1;
        button.setAttribute("data-e2e-state-button", auditId);
        const textLabel = (button.textContent ?? "").trim();
        return {
          auditId,
          label:
            textLabel || button.getAttribute("aria-label") || button.getAttribute("title") || "",
          testId: button.getAttribute("data-testid"),
        };
      });
  });
}

test.describe("mobile readiness visible control crawl", () => {
  for (const scenario of roleScenarios) {
    test(`${scenario.role} visible route-bearing controls and state buttons are wired`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      page.on("console", (msg: ConsoleMessage) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });
      page.on("pageerror", (error) => pageErrors.push(`${error.name}: ${error.message}`));

      await installRoleFixtures(page, {
        role: scenario.role,
        adminCapable: scenario.adminCapable,
        permissions: scenario.adminCapable ? CRAWL_ADMIN_PERMISSIONS : {},
        hidePerfOverlay: true,
        viewport: MOBILE_VIEWPORT,
        serveDiagnostics: false,
        orgId: "org-playwright",
      });
      await loginRole(page, scenario.role, scenario.adminCapable);
      await page.addStyleTag({
        content:
          '[data-testid="button-show-perf-overlay"] { opacity: 0 !important; pointer-events: none !important; }',
      });

      const auditedRouteControls: RouteControlDescriptor[] = [];
      const auditedStateButtons: StateButtonDescriptor[] = [];
      for (const startRoute of scenario.startRoutes) {
        await navigateWithinAuthenticatedSpa(page, startRoute);
        await expectHealthyPage(page, startRoute);

        const stateButtons = await collectStateButtons(page);
        const undocumentedButtons = stateButtons.filter(
          (button) => !documentedStateOnlyButton.test(normalizedStateButtonLabel(button.label))
        );
        expect(
          undocumentedButtons,
          `undocumented state-only buttons on ${scenario.role} ${startRoute}`
        ).toEqual([]);

        for (const button of stateButtons) {
          await hideDevPerfOverlay(page);
          await page.locator(`[data-e2e-state-button="${button.auditId}"]`).click();
          await page.waitForTimeout(50);
          await expect(page.locator("#root")).not.toBeEmpty();
          await expect(page.getByText("404 Page Not Found")).toHaveCount(0);
          auditedStateButtons.push(button);
        }

        const routeControls = await collectRouteControls(page);
        expect(
          routeControls.length,
          `${scenario.role} ${startRoute} should expose route controls`
        ).toBeGreaterThan(0);

        for (const control of routeControls) {
          await navigateWithinAuthenticatedSpa(page, startRoute);
          await hideDevPerfOverlay(page);
          await collectRouteControls(page);
          await page.locator(`[data-e2e-route-control="${control.auditId}"]`).click();
          await expectHealthyPage(page, control.expectedPath);
          auditedRouteControls.push(control);
        }
      }

      expect(auditedRouteControls.length).toBeGreaterThan(0);
      expect(auditedStateButtons.length).toBeGreaterThan(0);
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  }
});
