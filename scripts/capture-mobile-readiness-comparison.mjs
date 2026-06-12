import { existsSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const outDir = "/private/tmp/arus-visual-comparison";
const viewport = { width: 390, height: 844 };

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  return process.argv[index + 1] ?? fallback;
}

const baseUrl = readArg("--base-url", process.env.ARUS_VISUAL_BASE_URL ?? "http://127.0.0.1:5000");
const referenceDir = readArg("--reference-dir", path.resolve(process.cwd(), ".."));

const captures = [
  { id: "role-today", route: "/", reference: "figma-role-today.png", role: "system_admin" },
  {
    id: "role-today-captain",
    route: "/",
    reference: "figma-role-today.png",
    role: "captain",
  },
  {
    id: "role-today-crew",
    route: "/",
    reference: "figma-role-today.png",
    role: "maintenance_technician",
  },
  { id: "fleet", route: "/fleet", reference: "figma-fleet-vessel.png" },
  {
    id: "vessel-detail",
    route: "/vessel-intelligence/mv-atlas/overview",
    reference: "figma-fleet-vessel.png",
  },
  {
    id: "vessel-diagram",
    route: "/vessel-intelligence/mv-atlas/diagrams",
    reference: "figma-fleet-vessel.png",
  },
  { id: "pdm", route: "/pdm-platform", reference: "figma-telemetry-pdm.png" },
  {
    id: "pdm-asset",
    route: "/pdm/equipment/port-generator",
    reference: "figma-telemetry-pdm.png",
  },
  {
    id: "telemetry-advanced",
    route: "/pdm/equipment/port-generator?view=telemetry",
    reference: "figma-telemetry-pdm.png",
  },
  { id: "work", route: "/work-orders", reference: "figma-work-logs.png" },
  {
    id: "work-execution",
    route: "/work-orders/so-4481",
    reference: "figma-work-logs.png",
  },
  { id: "logs", route: "/logs", reference: "figma-work-logs.png" },
  { id: "crew", route: "/crew-management", reference: "figma-crew-inventory-settings.png" },
  { id: "inventory", route: "/logistics", reference: "figma-crew-inventory-settings.png" },
  { id: "settings", route: "/system", reference: "figma-crew-inventory-settings.png" },
];

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const manifest = [];

for (const capture of captures) {
  const page = await browser.newPage({ viewport });
  await page.addInitScript((role) => {
    window.localStorage.setItem("arus-user-role", role);
    window.localStorage.setItem("arus-landing-redirect-disabled", "true");
    window.sessionStorage.setItem("arus-role-just-selected", "true");
  }, capture.role ?? "system_admin");

  const url = new URL(capture.route, baseUrl).toString();
  const currentName = `current-${capture.id}-390x844.png`;
  const referenceName = `reference-${capture.id}.png`;
  const currentPath = path.join(outDir, currentName);
  const referenceSource = path.join(referenceDir, capture.reference);
  const referencePath = path.join(outDir, referenceName);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(900);
  await page.addStyleTag({
    content:
      '[data-testid="dev-performance-overlay"], [data-testid="button-show-perf-overlay"], [aria-label="Performance monitor"] { display: none !important; }',
  });
  await page.screenshot({ path: currentPath, fullPage: false });

  const hasReference = existsSync(referenceSource);
  if (hasReference) {
    copyFileSync(referenceSource, referencePath);
  }

  manifest.push({
    id: capture.id,
    route: capture.route,
    role: capture.role ?? "system_admin",
    url,
    viewport,
    current: currentPath,
    reference: hasReference ? referencePath : null,
    referenceSource: hasReference ? referenceSource : null,
  });
  await page.close();
}

await browser.close();

const htmlRows = manifest
  .map((entry) => {
    const currentFile = path.basename(entry.current);
    const referenceFile = entry.reference ? path.basename(entry.reference) : "";
    return `
      <section class="comparison">
        <h2>${htmlEscape(entry.id)} <span>${htmlEscape(entry.route)}</span></h2>
        <div class="pair">
          <figure>
            <figcaption>Implemented UI</figcaption>
            <img src="${htmlEscape(currentFile)}" alt="${htmlEscape(entry.id)} implemented UI">
          </figure>
          <figure>
            <figcaption>Figma reference</figcaption>
            ${
              referenceFile
                ? `<img src="${htmlEscape(referenceFile)}" alt="${htmlEscape(entry.id)} Figma reference">`
                : `<div class="missing">Missing ${htmlEscape(entry.referenceSource ?? "reference")}</div>`
            }
          </figure>
        </div>
      </section>`;
  })
  .join("\n");

writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(
  path.join(outDir, "comparison-sheet.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ARUS Mobile Readiness Visual Comparison</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #eef2f7; color: #0f172a; }
      header { padding: 24px; background: #03295a; color: white; }
      h1 { margin: 0; font-size: 22px; }
      p { margin: 8px 0 0; color: #dbeafe; }
      .comparison { margin: 20px auto; max-width: 940px; padding: 16px; background: white; border: 1px solid #cbd5e1; border-radius: 10px; }
      h2 { margin: 0 0 12px; font-size: 16px; }
      h2 span { color: #64748b; font-weight: 400; }
      .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
      figure { margin: 0; min-width: 0; }
      figcaption { margin-bottom: 8px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; }
      img { width: 100%; border: 1px solid #dbe3ef; border-radius: 8px; background: #f8fafc; }
      .missing { display: grid; min-height: 420px; place-items: center; border: 1px dashed #94a3b8; border-radius: 8px; color: #64748b; }
    </style>
  </head>
  <body>
    <header>
      <h1>ARUS Mobile Readiness Visual Comparison</h1>
      <p>Viewport: ${viewport.width}x${viewport.height}. Base URL: ${htmlEscape(baseUrl)}.</p>
    </header>
    ${htmlRows}
  </body>
</html>
`
);

console.log(`Wrote ${manifest.length} comparisons to ${outDir}`);
