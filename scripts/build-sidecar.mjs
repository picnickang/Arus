#!/usr/bin/env node
import { execSync } from "node:child_process";
import { mkdirSync, copyFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { platform, arch } from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const distDir = join(root, "dist");
const binDir = join(root, "src-tauri", "binaries");
const bundleOut = join(distDir, "server-bundle.cjs");
const assetsJson = join(distDir, "pkg-assets.json");
const nmDir = join(root, "node_modules");

const TARGETS = {
  "x86_64-pc-windows-msvc": { pkg: "node20-win-x64", ext: ".exe" },
  "aarch64-apple-darwin": { pkg: "node20-macos-arm64", ext: "" },
  "x86_64-apple-darwin": { pkg: "node20-macos-x64", ext: "" },
  "x86_64-unknown-linux-gnu": { pkg: "node20-linux-x64", ext: "" },
};

function currentTriple() {
  if (platform === "win32") return "x86_64-pc-windows-msvc";
  if (platform === "darwin")
    return arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
  return "x86_64-unknown-linux-gnu";
}

function stage1_bundle() {
  console.log("\n📦 Stage 1 — esbuild bundle…");
  mkdirSync(distDir, { recursive: true });

  const externals = [
    "@libsql/client",
    "@libsql/darwin-arm64",
    "@libsql/darwin-x64",
    "@libsql/linux-x64-gnu",
    "@libsql/win32-x64-msvc",
    "better-sqlite3",
    "sharp",
    "cpu-features",
    "ssh2",
    "../vite",
    "vite",
    "../vite.config",
    "@vitejs/plugin-react",
    "@replit/vite-plugin-runtime-error-modal",
    "@replit/vite-plugin-cartographer",
    "@replit/vite-plugin-dev-banner",
    "lightningcss",
    "fsevents",
    "mock-aws-s3",
    "aws-sdk",
    "nock",
  ]
    .map((p) => `--external:${p}`)
    .join(" ");

  execSync(
    `npx esbuild server/index.ts ` +
      `--platform=node --target=node20 --bundle --format=cjs ` +
      `--loader:.html=text ` +
      `--outfile=${bundleOut} --allow-overwrite ` +
      externals,
    { stdio: "inherit", cwd: root }
  );
  console.log(`  ✅ ${bundleOut}`);
}

function findFiles(dir, matchFn, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["test", "tests", ".bin"].includes(entry.name)) {
        findFiles(full, matchFn, results);
      }
    } else if (entry.isFile() && matchFn(entry.name, full)) {
      results.push(full);
    }
  }
  return results;
}

function relToBundle(absPath) {
  return relative(dirname(bundleOut), absPath).replace(/\\/g, "/");
}

function stage2_assetManifest() {
  console.log("\n📎 Stage 2 — Building asset manifest…");

  const assets = new Set();

  const libsqlDir = join(nmDir, "@libsql");
  const nodeFiles = findFiles(libsqlDir, (name) => extname(name) === ".node");
  for (const f of nodeFiles) {
    assets.add(relToBundle(f));
    console.log(`  + ${relative(root, f)}`);
  }

  const wasmFiles = findFiles(libsqlDir, (name) => extname(name) === ".wasm");
  for (const f of wasmFiles) {
    assets.add(relToBundle(f));
    console.log(`  + ${relative(root, f)} (wasm)`);
  }

  const otherExternals = ["better-sqlite3", "sharp"];
  for (const pkg of otherExternals) {
    const pkgDir = join(nmDir, pkg);
    const pkgNodes = findFiles(pkgDir, (name) => extname(name) === ".node");
    for (const f of pkgNodes) {
      assets.add(relToBundle(f));
      console.log(`  + ${relative(root, f)}`);
    }
  }

  const manifest = { pkg: { assets: Array.from(assets) } };
  writeFileSync(assetsJson, JSON.stringify(manifest, null, 2));
  console.log(`  ✅ Manifest: ${assets.size} asset(s)`);
}

function stage3_compile(triple) {
  const t = TARGETS[triple];
  if (!t) {
    console.error(`Unknown triple: ${triple}`);
    process.exit(1);
  }

  const outFile = join(binDir, `arus-server-${triple}${t.ext}`);
  console.log(`\n🔨 Stage 3 — pkg compile → ${triple}…`);
  mkdirSync(binDir, { recursive: true });

  execSync(
    `npx @yao-pkg/pkg ${bundleOut} ` +
      `--target ${t.pkg} ` +
      `--config ${assetsJson} ` +
      `--output ${outFile} ` +
      `--compress GZip`,
    { stdio: "inherit", cwd: root }
  );
  console.log(`  ✅ ${outFile}`);
  return outFile;
}

function stage4_smokeTest(binPath) {
  if (process.argv.includes("--skip-test")) {
    console.log("\n⏭  Smoke test skipped (--skip-test)");
    return;
  }

  console.log("\n🧪 Stage 4 — Smoke test…");
  try {
    execSync(`"${binPath}" --health-check`, {
      stdio: "inherit",
      timeout: 15_000,
      env: {
        ...process.env,
        DATABASE_PATH: join(distDir, "smoke-test.db"),
        DEPLOYMENT_MODE: "VESSEL",
        EMBEDDED_MODE: "true",
        LOCAL_MODE: "true",
        NODE_ENV: "production",
        PORT: "0",
      },
    });
    console.log("  ✅ Smoke test passed — native modules load correctly");
  } catch (e) {
    console.error("\n❌ Smoke test FAILED.");
    console.error("   The binary could not load its native modules.");
    console.error("   Check that all external packages are in the asset manifest.");
    console.error("   Error:", e.message);
    process.exit(1);
  }
}

async function main() {
  const buildAll = process.argv.includes("--all");

  stage1_bundle();
  stage2_assetManifest();
  mkdirSync(binDir, { recursive: true });

  if (buildAll) {
    const current = currentTriple();
    for (const triple of Object.keys(TARGETS)) {
      const out = stage3_compile(triple);
      if (triple === current) stage4_smokeTest(out);
    }
  } else {
    const triple = currentTriple();
    const outFile = stage3_compile(triple);
    stage4_smokeTest(outFile);

    const devCopy = join(binDir, `arus-server${TARGETS[triple].ext}`);
    copyFileSync(outFile, devCopy);
    console.log(`  ✅ Dev copy → ${devCopy}`);
  }

  console.log("\n✅ Sidecar build complete.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
