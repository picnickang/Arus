#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, extname, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const apply = process.argv.includes("--apply");

const SCAN_DIRS = ["server", "shared"];

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

const REPLACEMENTS = [
  [/from\s+['"]bcrypt['"]/g, "from 'bcryptjs'"],
  [/import\s+(\w+)\s+from\s+['"]bcrypt['"]/g, "import $1 from 'bcryptjs'"],
  [/require\(['"]bcrypt['"]\)/g, "require('bcryptjs')"],
  [/from\s+['"]bcrypt\/types['"]/g, "from 'bcryptjs'"],
];

function* walkDir(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["node_modules", "dist", ".git", "coverage"].includes(entry.name)) {
        yield* walkDir(full);
      }
    } else if (entry.isFile() && EXTENSIONS.has(extname(entry.name))) {
      yield full;
    }
  }
}

let filesChanged = 0;
let filesSkipped = 0;

for (const scanDir of SCAN_DIRS) {
  const absDir = join(root, scanDir);
  for (const filePath of walkDir(absDir)) {
    const original = readFileSync(filePath, "utf8");

    if (!original.includes("'bcrypt'") && !original.includes('"bcrypt"')) {
      continue;
    }

    if (original.includes("bcryptjs") && !original.includes("'bcrypt'")) {
      filesSkipped++;
      continue;
    }

    let updated = original;
    for (const [pattern, replacement] of REPLACEMENTS) {
      updated = updated.replace(pattern, replacement);
    }

    if (updated === original) {
      console.warn(`⚠️  Manual review needed: ${relative(root, filePath)}`);
      console.warn(`   Contains 'bcrypt' but no known import pattern matched.`);
      continue;
    }

    const rel = relative(root, filePath);
    if (apply) {
      writeFileSync(filePath, updated, "utf8");
      console.log(`✅ Migrated: ${rel}`);
    } else {
      console.log(`📝 Would migrate: ${rel}`);
      const origLines = original.split("\n");
      const newLines = updated.split("\n");
      origLines.forEach((line, i) => {
        if (line !== newLines[i]) {
          console.log(`   Line ${i + 1}:`);
          console.log(`     - ${line.trim()}`);
          console.log(`     + ${newLines[i].trim()}`);
        }
      });
    }
    filesChanged++;
  }
}

console.log("");
if (apply) {
  console.log(
    `✅ Migration complete — ${filesChanged} file(s) updated, ${filesSkipped} already migrated.`
  );
  if (filesChanged > 0) {
    console.log("\nNext: npm uninstall bcrypt && npm install   (removes native addon)");
  }
} else {
  console.log(`Dry run — ${filesChanged} file(s) would be updated.`);
  console.log("Run with --apply to apply changes:");
  console.log("  node scripts/migrate-bcrypt.mjs --apply");
}
