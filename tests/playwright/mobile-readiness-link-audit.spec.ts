import { expect, test, type ConsoleMessage, type Page, type Route } from "@playwright/test";
import { ROLE_STORAGE_KEY } from "../../client/src/config/roles";
import {
  isMobileReadinessReplacementPath,
  getMobileReadinessExpectedScreen,
} from "../../client/src/features/mobile-readiness/mobile-readiness-route-contract";

type AuditRole = "super_admin" | "system_admin" | "deck_officer" | "crew_member" | "viewer";

interface RoleScenario {
  role: AuditRole;
  expectedNavLabels: string[];
  expectedQueueLabel: string;
  expectedVisibleText: string;
  adminCapable: boolean;
}

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const roles: RoleScenario[] = [
  {
    role: "super_admin",
    expectedNavLabels: ["Command", "Vessels", "Tasks", "Reports", "Settings"],
    expectedQueueLabel: "Command Queue",
    expectedVisibleText: "Engine room fire alarm",
    adminCapable: true,
  },
  {
    role: "system_admin",
    expectedNavLabels: ["Command", "Vessels", "Tasks", "Reports", "Settings"],
    expectedQueueLabel: "Command Queue",
    expectedVisibleText: "Engine room fire alarm",
    adminCapable: true,
  },
  {
    role: "deck_officer",
    expectedNavLabels: ["Bridge", "Logs", "Crew", "Maintenance", "Settings"],
    expectedQueueLabel: "Command Queue",
    expectedVisibleText: "Vessel readiness - Good",
    adminCapable: false,
  },
  {
    role: "crew_member",
    expectedNavLabels: ["My Tasks", "Logs", "Safety", "Documents", "Settings"],
    expectedQueueLabel: "My Queue",
    expectedVisibleText: "Clean bilge holding tank",
    adminCapable: false,
  },
  {
    role: "viewer",
    expectedNavLabels: ["My Tasks", "Logs", "Safety", "Documents", "Settings"],
    expectedQueueLabel: "My Queue",
    expectedVisibleText: "Clean bilge holding tank",
    adminCapable: false,
  },
];

const routeBearingControls = [
  { start: "/", testId: "mobile-readiness-nav-vessels", expectedPath: "/fleet" },
  { start: "/", testId: "mobile-readiness-nav-tasks", expectedPath: "/work-orders" },
  { start: "/", testId: "mobile-readiness-nav-reports", expectedPath: "/logs/compliance" },
  { start: "/", testId: "mobile-readiness-nav-settings", expectedPath: "/system" },
  {
    start: "/",
    testId: "today-card-port-generator-vibration",
    expectedPath: "/pdm-platform",
  },
  { start: "/", testId: "today-card-chief-engineer-cert", expectedPath: "/crew-management" },
  { start: "/", testId: "today-card-fuel-filter-unavailable", expectedPath: "/logistics" },
  { start: "/", testId: "today-card-orb-overdue", expectedPath: "/logs" },
  {
    start: "/fleet",
    testId: "fleet-vessel-card-mv-atlas",
    expectedPath: "/vessel-intelligence/mv-atlas/overview",
  },
  { start: "/work-orders", testId: "work-card-so-4481", expectedPath: "/work-orders/so-4481" },
  {
    start: "/pdm-platform",
    testId: "pdm-risk-port-generator",
    expectedPath: "/pdm/equipment/port-generator",
  },
  {
    start: "/pdm/equipment/port-generator",
    testId: "link-pdm-telemetry-advanced",
    expectedPath: "/pdm/equipment/port-generator/telemetry",
  },
] as const;

const regularRouteBearingControls = [
  {
    role: "deck_officer",
    controls: [
      { start: "/", testId: "mobile-readiness-nav-bridge", expectedPath: "/" },
      { start: "/", testId: "mobile-readiness-nav-logs", expectedPath: "/logs" },
      { start: "/", testId: "mobile-readiness-nav-crew", expectedPath: "/crew-management" },
      { start: "/", testId: "mobile-readiness-nav-maintenance", expectedPath: "/pdm-platform" },
      { start: "/", testId: "mobile-readiness-nav-settings", expectedPath: "/profile" },
      { start: "/", testId: "today-card-vessel-ready", expectedPath: "/fleet" },
      { start: "/", testId: "today-card-log-signoff", expectedPath: "/logs" },
      { start: "/", testId: "today-card-active-alert", expectedPath: "/logs/compliance" },
      { start: "/", testId: "today-card-crew-ready", expectedPath: "/crew-management" },
      { start: "/", testId: "today-card-weather-log", expectedPath: "/logs" },
    ],
  },
  {
    role: "crew_member",
    controls: [
      { start: "/", testId: "mobile-readiness-nav-my-tasks", expectedPath: "/" },
      { start: "/", testId: "mobile-readiness-nav-logs", expectedPath: "/logs" },
      { start: "/", testId: "mobile-readiness-nav-safety", expectedPath: "/logs/compliance" },
      { start: "/", testId: "mobile-readiness-nav-documents", expectedPath: "/profile" },
      { start: "/", testId: "mobile-readiness-nav-settings", expectedPath: "/profile" },
      { start: "/", testId: "today-card-clean-bilge", expectedPath: "/my-tasks" },
      { start: "/", testId: "today-card-engine-log-draft", expectedPath: "/logs" },
      { start: "/", testId: "today-card-safety-instruction", expectedPath: "/logs/compliance" },
      { start: "/", testId: "today-card-medical-certificate", expectedPath: "/profile" },
      { start: "/", testId: "today-card-offline-draft", expectedPath: "/logs" },
    ],
  },
] as const;

async function installRoleFixtures(page: Page, scenario: RoleScenario): Promise<void> {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.addInitScript(
    ({ key, role }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(key, role);
      localStorage.setItem("arus-ui-theme", "dark");
      localStorage.setItem("arus-setup-complete", "true");
    },
    { key: ROLE_STORAGE_KEY, role: scenario.role }
  );

  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/portal/login" && request.method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sessionToken: `playwright-${scenario.role}`,
          expiresIn: 3600,
          mustChangePassword: false,
          user: { id: `user-${scenario.role}`, name: scenario.role, role: scenario.role },
        }),
      });
      return;
    }

    if (path === "/api/permissions/me") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          userId: `user-${scenario.role}`,
          orgId: "org-playwright",
          roles: [{ id: `role-${scenario.role}`, name: scenario.role, displayName: scenario.role }],
          permissions: {},
          hubAdmin: scenario.adminCapable,
          hubAccess: scenario.adminCapable ? null : [],
          isDevMode: false,
        }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

async function loginScenario(page: Page, scenario: RoleScenario): Promise<void> {
  await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
  if (scenario.role === "super_admin") {
    await page.getByTestId("button-card-portal-admin").click();
    await page.getByTestId("input-admin-username").fill(`playwright-${scenario.role}`);
    await page.getByTestId("input-admin-password").fill("playwright-password");
    await page.getByTestId("button-admin-login").click();
  } else {
    await page.getByTestId("button-card-portal-user").click();
    await page.getByTestId("input-login-username").fill(`playwright-${scenario.role}`);
    await page.getByTestId("input-login-password").fill("playwright-password");
    await page.getByTestId("button-login").click();
  }
  await expect(page.getByTestId("mobile-readiness-screen-command")).toBeVisible();
}

async function navigateWithinAuthenticatedSpa(page: Page, path: string): Promise<void> {
  await page.evaluate((target) => {
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

function markerForPath(path: string): string {
  const marker = getMobileReadinessExpectedScreen(path);
  return marker ? `mobile-readiness-screen-${marker}` : "universal-ops-shell";
}

function routeRegex(path: string): RegExp {
  return new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[?#].*)?$`);
}

async function expectNoBrokenShell(page: Page): Promise<void> {
  await expect(page.getByText("404 Page Not Found")).toHaveCount(0);
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByTestId("text-admin-hubs-title")).toHaveCount(0);
  await expect(page.getByTestId("shell-admin-hubs")).toHaveCount(0);
}

async function expectMobileReadinessRoute(page: Page, expectedPath: string): Promise<void> {
  await expect(page).toHaveURL(routeRegex(expectedPath));
  if (isMobileReadinessReplacementPath(expectedPath)) {
    await expect(page.getByTestId("mobile-readiness-shell")).toBeVisible();
  }
  await expect(page.getByTestId(markerForPath(expectedPath))).toBeVisible();
  await expectNoBrokenShell(page);
}

async function expectRegularUserRoute(page: Page, expectedPath: string): Promise<void> {
  await expect(page).toHaveURL(routeRegex(expectedPath));
  await expectNoBrokenShell(page);
  await expect(page.getByTestId("universal-ops-shell")).toHaveCount(0);

  if (isMobileReadinessReplacementPath(expectedPath)) {
    await expect(page.getByTestId("mobile-readiness-shell")).toBeVisible();
    await expect(page.getByTestId(markerForPath(expectedPath))).toBeVisible();
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

test.describe("mobile readiness role-aware link audit", () => {
  for (const scenario of roles) {
    test(`${scenario.role} sees the correct role-customized mobile readiness home`, async ({
      page,
    }) => {
      await installRoleFixtures(page, scenario);
      await loginScenario(page, scenario);

      await expect(page.getByTestId("mobile-readiness-screen-command")).toBeVisible();
      await expect(
        page.getByText(scenario.expectedQueueLabel, { exact: true }).first()
      ).toBeVisible();
      await expect(page.getByText(scenario.expectedVisibleText)).toBeVisible();
      await expect(page.getByTestId("mobile-readiness-bottom-nav")).toBeVisible();
      await expect(page.getByTestId("universal-ops-shell")).toHaveCount(0);

      for (const label of scenario.expectedNavLabels) {
        await expect(
          page.getByTestId("mobile-readiness-bottom-nav").getByText(label)
        ).toBeVisible();
      }
    });
  }

  test("admin-visible route-bearing controls land on their expected replacement screens", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (error) => pageErrors.push(`${error.name}: ${error.message}`));

    await installRoleFixtures(page, roles[0]);
    await loginScenario(page, roles[0]);

    for (const control of routeBearingControls) {
      await navigateWithinAuthenticatedSpa(page, control.start);
      await expect(page.getByTestId(markerForPath(control.start))).toBeVisible();
      const target = page.getByTestId(control.testId);
      await expect(target, `${control.testId} should be visible on ${control.start}`).toBeVisible();
      await target.click();
      await expectMobileReadinessRoute(page, control.expectedPath);
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  for (const scenario of regularRouteBearingControls) {
    test(`${scenario.role} visible route-bearing controls land on allowed regular-user pages`, async ({
      page,
    }) => {
      const roleScenario = roles.find((role) => role.role === scenario.role)!;
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      page.on("console", (msg: ConsoleMessage) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });
      page.on("pageerror", (error) => pageErrors.push(`${error.name}: ${error.message}`));

      await installRoleFixtures(page, roleScenario);
      await loginScenario(page, roleScenario);

      for (const control of scenario.controls) {
        await navigateWithinAuthenticatedSpa(page, control.start);
        await expect(page.getByTestId(markerForPath(control.start))).toBeVisible();
        const target = page.getByTestId(control.testId);
        await expect(
          target,
          `${control.testId} should be visible on ${control.start}`
        ).toBeVisible();
        await target.click();
        await expectRegularUserRoute(page, control.expectedPath);
      }

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  }

  test("regular users cannot use admin-only route links to expose admin shell controls", async ({
    page,
  }) => {
    await installRoleFixtures(page, roles.find((scenario) => scenario.role === "crew_member")!);
    await loginScenario(page, roles.find((scenario) => scenario.role === "crew_member")!);
    await navigateWithinAuthenticatedSpa(page, "/system");

    await expect(page.getByTestId("universal-ops-shell")).toHaveCount(0);
    await expect(page.getByTestId("shell-admin-hubs")).toHaveCount(0);
    await expect(page.getByTestId("text-admin-hubs-title")).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("mobile-readiness-screen-command")).toBeVisible();
    await expect(page.getByText("My Queue", { exact: true }).first()).toBeVisible();
  });
});
