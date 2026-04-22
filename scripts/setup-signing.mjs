#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const tauriDir = join(root, "src-tauri");
const keyDir = join(homedir(), ".tauri");
const keyPath = join(keyDir, "arus.key");

const CONF_FILES = [
  join(tauriDir, "tauri.vessel.conf.json"),
  join(tauriDir, "tauri.cloud.conf.json"),
  join(tauriDir, "tauri.conf.json"),
];

const repoArg = (() => {
  const idx = process.argv.indexOf("--repo");
  return idx >= 0 ? process.argv[idx + 1] : null;
})();

console.log("🔑 Generating Tauri updater signing keypair…\n");

if (existsSync(keyPath)) {
  console.log(`ℹ️  Key file already exists at ${keyPath}`);
  console.log("   Delete it first if you want to regenerate.\n");
} else {
  mkdirSync(keyDir, { recursive: true });
  execSync(`npx @tauri-apps/cli signer generate -w "${keyPath}"`, { stdio: "inherit", cwd: root });
  console.log("");
}

const pubKeyPath = `${keyPath}.pub`;
if (!existsSync(pubKeyPath)) {
  console.error(`❌ Public key not found at ${pubKeyPath}`);
  console.error("   Run: npx @tauri-apps/cli signer generate -w ~/.tauri/arus.key");
  process.exit(1);
}

const pubKey = readFileSync(pubKeyPath, "utf8").trim();
console.log(`✅ Public key read from ${pubKeyPath}`);
console.log(`   ${pubKey.slice(0, 40)}…\n`);

const PUBKEY_PLACEHOLDER = /REPLACE_WITH.*?signer generate[^"]*/g;
const REPO_PLACEHOLDER = /YOUR_ORG\/arus-marine/g;

for (const confPath of CONF_FILES) {
  if (!existsSync(confPath)) continue;

  let content = readFileSync(confPath, "utf8");
  let changed = false;

  if (PUBKEY_PLACEHOLDER.test(content)) {
    PUBKEY_PLACEHOLDER.lastIndex = 0;
    content = content.replace(PUBKEY_PLACEHOLDER, pubKey);
    changed = true;
  } else if (!content.includes(pubKey)) {
    console.warn(`⚠️  Could not find pubkey placeholder in ${confPath}`);
    console.warn("   Set plugins.updater.pubkey manually.");
  }

  if (repoArg && REPO_PLACEHOLDER.test(content)) {
    REPO_PLACEHOLDER.lastIndex = 0;
    content = content.replace(REPO_PLACEHOLDER, repoArg);
    changed = true;
  }

  if (changed) {
    writeFileSync(confPath, content, "utf8");
    const rel = confPath.replace(root + "/", "");
    console.log(`✅ Updated ${rel}`);
  }
}

console.log(`
${"─".repeat(60)}
GitHub Actions secrets to add:
${"─".repeat(60)}

Go to: https://github.com/${repoArg ?? "YOUR_ORG/YOUR_REPO"}/settings/secrets/actions

Add these repository secrets:

  TAURI_SIGNING_PRIVATE_KEY
    Value: (contents of ${keyPath})

  TAURI_SIGNING_PRIVATE_KEY_PASSWORD
    Value: (the password you entered during key generation)
`);

if (!repoArg) {
  console.log(`Also run with --repo to set the update endpoint URL:
  node scripts/setup-signing.mjs --repo YOUR_ORG/YOUR_REPO
`);
} else {
  console.log(`✅ Updater endpoint set to:
   https://github.com/${repoArg}/releases/latest/download/latest.json
`);
}

console.log(`${"─".repeat(60)}`);
console.log(`Private key location: ${keyPath}`);
console.log("Copy its contents into the TAURI_SIGNING_PRIVATE_KEY GitHub secret.");
console.log(`${"─".repeat(60)}\n`);
console.log("⚠️  Back up ~/.tauri/arus.key — losing it means users cannot receive updates.\n");
