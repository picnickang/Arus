import {
  expect,
  test,
  type ConsoleMessage,
  type Locator,
  type Page,
  type Request,
  type Response,
} from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

interface ProductionAuditConfig {
  baseURL: string;
  username: string;
  password: string;
  portal: "admin" | "user";
  runPrefix: string;
  evidenceDir: string;
}

interface ProductionAuditEvent {
  area: string;
  status: "passed" | "failed" | "skipped";
  detail: string;
  route?: string;
  screenshotPath?: string;
}

interface RouteControlDescriptor {
  auditId: string;
  label: string;
  href: string;
  expectedPath: string;
}

const PRODUCTION_AUDIT_ROOT = "/private/tmp/arus-production-e2e-audit";
const auditRoutes = [
  "/",
  "/fleet",
  "/work-orders",
  "/pdm-platform",
  "/logs",
  "/crew-management",
  "/logistics",
  "/system",
] as const;

function requiredProductionConfig(): ProductionAuditConfig {
  const baseURL = process.env["PLAYWRIGHT_BASE_URL"];
  const username = process.env["ARUS_PROD_E2E_USERNAME"];
  const password = process.env["ARUS_PROD_E2E_PASSWORD"];
  const allowWrites = process.env["ARUS_PROD_E2E_ALLOW_WRITES"];
  const missing = [
    !baseURL && "PLAYWRIGHT_BASE_URL",
    !username && "ARUS_PROD_E2E_USERNAME",
    !password && "ARUS_PROD_E2E_PASSWORD",
    allowWrites !== "1" && "ARUS_PROD_E2E_ALLOW_WRITES=1",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Production E2E audit requires explicit production config: ${missing.join(", ")}`
    );
  }
  if (!baseURL || !username || !password) {
    throw new Error("Production E2E audit config narrowing failed after validation");
  }

  const shortId = Math.random().toString(36).slice(2, 8);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const runPrefix = process.env["ARUS_PROD_E2E_RUN_PREFIX"] ?? `ARUS-E2E-${date}-${shortId}`;
  return {
    baseURL,
    username,
    password,
    portal: process.env["ARUS_PROD_E2E_PORTAL"] === "user" ? "user" : "admin",
    runPrefix,
    evidenceDir: path.join(PRODUCTION_AUDIT_ROOT, runPrefix),
  };
}

function installRuntimeMonitors(page: Page): {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  badResponses: string[];
} {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const badResponses: string[] = [];

  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(`${error.name}: ${error.message}`));
  page.on("requestfailed", (request: Request) => {
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`);
  });
  page.on("response", (response: Response) => {
    if (response.status() >= 400) {
      badResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  return { consoleErrors, pageErrors, failedRequests, badResponses };
}

async function firstVisible(locators: Locator[]): Promise<Locator | null> {
  for (const locator of locators) {
    if (
      (await locator.count()) > 0 &&
      (await locator
        .first()
        .isVisible()
        .catch(() => false))
    ) {
      return locator.first();
    }
  }
  return null;
}

async function login(page: Page, config: ProductionAuditConfig): Promise<void> {
  await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
  if (config.portal === "admin") {
    await page.getByTestId("button-card-portal-admin").click();
    await page.getByTestId("input-admin-username").fill(config.username);
    await page.getByTestId("input-admin-password").fill(config.password);
    await page.getByTestId("button-admin-login").click();
  } else {
    await page.getByTestId("button-card-portal-user").click();
    await page.getByTestId("input-login-username").fill(config.username);
    await page.getByTestId("input-login-password").fill(config.password);
    await page.getByTestId("button-login").click();
  }
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByText("404 Page Not Found")).toHaveCount(0);
}

async function assertHealthyPage(page: Page): Promise<void> {
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByText("404 Page Not Found")).toHaveCount(0);
  await expect(page.getByText(/loading/i)).toHaveCount(0, { timeout: 15_000 });
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
      .filter(isVisible)
      .map((element) => {
        const rawHref =
          element.getAttribute("href") ?? element.getAttribute("data-route-target") ?? "";
        if (
          !rawHref ||
          rawHref.startsWith("#") ||
          rawHref.startsWith("mailto:") ||
          rawHref.startsWith("tel:")
        ) {
          return null;
        }
        const url = new URL(rawHref, window.location.origin);
        if (url.origin !== window.location.origin) {
          return null;
        }
        const auditId = `prod-route-control-${index}`;
        index += 1;
        element.setAttribute("data-prod-route-control", auditId);
        return {
          auditId,
          label: (element.textContent ?? element.getAttribute("aria-label") ?? "").trim(),
          href: rawHref,
          expectedPath: url.pathname,
        };
      })
      .filter((control): control is RouteControlDescriptor => control !== null);
  });
}

async function captureFailure(
  page: Page,
  config: ProductionAuditConfig,
  name: string
): Promise<string> {
  const screenshotPath = path.join(config.evidenceDir, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

async function auditRouteControls(
  page: Page,
  config: ProductionAuditConfig,
  events: ProductionAuditEvent[],
  startRoute: string
): Promise<void> {
  await page.goto(startRoute, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5_000);
  await assertHealthyPage(page);
  const controls = await collectRouteControls(page);
  events.push({
    area: "inventory",
    status: "passed",
    route: startRoute,
    detail: `${controls.length} visible route-bearing controls found`,
  });

  for (const control of controls) {
    await page.goto(startRoute, { waitUntil: "domcontentloaded" });
    await collectRouteControls(page);
    await page.locator(`[data-prod-route-control="${control.auditId}"]`).click();
    await page.waitForTimeout(5_000);
    try {
      await expect(page).toHaveURL(
        new RegExp(`${control.expectedPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[?#].*)?$`)
      );
      await assertHealthyPage(page);
      events.push({
        area: "navigation",
        status: "passed",
        route: startRoute,
        detail: `${control.label || control.href} -> ${control.expectedPath}`,
      });
    } catch (error) {
      const screenshotPath = await captureFailure(
        page,
        config,
        `failed-${startRoute.replace(/\W+/g, "-")}-${control.auditId}`
      );
      events.push({
        area: "navigation",
        status: "failed",
        route: startRoute,
        detail: `${control.label || control.href} failed: ${String(error)}`,
        screenshotPath,
      });
      throw error;
    }
  }
}

async function auditWorkOrderWritePath(
  page: Page,
  config: ProductionAuditConfig,
  events: ProductionAuditEvent[]
): Promise<void> {
  await page.goto("/work-orders", { waitUntil: "domcontentloaded" });
  await assertHealthyPage(page);

  const createButton = await firstVisible([
    page.getByTestId("button-create-work-order"),
    page.getByRole("button", { name: /create.*work|new work|add work|create/i }),
    page.getByRole("link", { name: /create.*work|new work|add work/i }),
  ]);

  if (!createButton) {
    events.push({
      area: "write-path",
      status: "skipped",
      route: "/work-orders",
      detail: "No visible work-order creation control found for this account/tenant.",
    });
    return;
  }

  await createButton.click();
  await page.waitForTimeout(5_000);

  const title = `${config.runPrefix} Work Order Audit`;
  const visibleTextboxes = page.getByRole("textbox");
  const textboxCount = await visibleTextboxes.count();
  if (textboxCount === 0) {
    events.push({
      area: "write-path",
      status: "failed",
      route: "/work-orders",
      detail: "Create control opened no visible text fields.",
      screenshotPath: await captureFailure(page, config, "work-order-create-no-fields"),
    });
    throw new Error("Create work order flow opened no visible text fields");
  }

  await visibleTextboxes.nth(0).fill(title);
  if (textboxCount > 1) {
    await visibleTextboxes.nth(1).fill(`${config.runPrefix} production E2E audit record`);
  }

  const submitButton = await firstVisible([
    page.getByRole("button", { name: /create|save|submit/i }),
    page.getByRole("button", { name: /approve/i }),
  ]);
  if (!submitButton) {
    events.push({
      area: "write-path",
      status: "failed",
      route: "/work-orders",
      detail: "Create form had no visible submit/save control.",
      screenshotPath: await captureFailure(page, config, "work-order-create-no-submit"),
    });
    throw new Error("Create work order flow had no visible submit/save control");
  }

  await submitButton.click();
  await page.waitForTimeout(5_000);
  await page.goto("/work-orders", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(config.runPrefix)).toBeVisible({ timeout: 15_000 });

  events.push({
    area: "write-path",
    status: "passed",
    route: "/work-orders",
    detail: `Created and reloaded audit-owned work order with prefix ${config.runPrefix}. Cleanup must remove/archive records with this prefix if product controls expose it.`,
  });
}

async function writeReport(
  config: ProductionAuditConfig,
  events: ProductionAuditEvent[],
  monitors: ReturnType<typeof installRuntimeMonitors>
): Promise<void> {
  const report = {
    runPrefix: config.runPrefix,
    baseURL: config.baseURL,
    generatedAt: new Date().toISOString(),
    evidenceDir: config.evidenceDir,
    events,
    consoleErrors: monitors.consoleErrors,
    pageErrors: monitors.pageErrors,
    failedRequests: monitors.failedRequests,
    badResponses: monitors.badResponses,
  };
  await fs.writeFile(
    path.join(config.evidenceDir, "production-full-write-audit-report.json"),
    JSON.stringify(report, null, 2)
  );
  const rows = events
    .map(
      (event) =>
        `| ${event.area} | ${event.route ?? ""} | ${event.status} | ${event.detail.replace(/\|/g, "\\|")} | ${event.screenshotPath ? `\`${event.screenshotPath}\`` : ""} |`
    )
    .join("\n");
  await fs.writeFile(
    path.join(config.evidenceDir, "production-full-write-audit-report.md"),
    `# Production Full Write Audit

Run prefix: \`${config.runPrefix}\`

Base URL: \`${config.baseURL}\`

| Area | Route | Status | Detail | Evidence |
|---|---|---|---|---|
${rows}
`
  );
}

test.describe("production full write interaction audit", () => {
  test("audits production navigation and write paths with explicit opt-in", async ({ browser }) => {
    const config = requiredProductionConfig();
    await fs.mkdir(config.evidenceDir, { recursive: true });
    const context = await browser.newContext({
      baseURL: config.baseURL,
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const monitors = installRuntimeMonitors(page);
    const events: ProductionAuditEvent[] = [];

    try {
      await login(page, config);
      events.push({
        area: "login",
        status: "passed",
        route: "/portal-login",
        detail: `Logged in through ${config.portal} portal.`,
      });

      for (const route of auditRoutes) {
        await auditRouteControls(page, config, events, route);
      }

      await auditWorkOrderWritePath(page, config, events);
    } finally {
      await writeReport(config, events, monitors);
      await context.close();
    }

    expect(events.filter((event) => event.status === "failed")).toEqual([]);
    expect(monitors.consoleErrors).toEqual([]);
    expect(monitors.pageErrors).toEqual([]);
    expect(monitors.failedRequests).toEqual([]);
    expect(monitors.badResponses).toEqual([]);
  });
});
