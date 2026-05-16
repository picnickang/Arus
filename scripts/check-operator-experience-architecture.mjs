#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function walk(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, predicate);
    return predicate(full) ? [full] : [];
  });
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

const backendFiles = walk(path.join(root, "server/domains/workflow/operator-experience"), (file) => file.endsWith(".ts"));
const routeFiles = backendFiles.filter((file) => rel(file).includes("/interfaces/"));
const appDomainFiles = backendFiles.filter((file) => /\/(domain|application)\//.test(rel(file)));
const frontendUiFiles = walk(path.join(root, "client/src/features/operator-experience"), (file) => file.endsWith(".tsx"));

for (const file of routeFiles) {
  const source = read(file);
  if (/from\s+["'].*\b(db|repositories)\b/.test(source) || /@shared\/schema/.test(source)) {
    failures.push(`${rel(file)}: route/interface code must not import db/repositories/schema directly`);
  }
}

for (const file of appDomainFiles) {
  const source = read(file);
  if (/from\s+["'].*\b(db|repositories)\b/.test(source) || /@shared\/schema/.test(source)) {
    failures.push(`${rel(file)}: domain/application code must stay independent from database/schema imports`);
  }
}

for (const file of frontendUiFiles) {
  const source = read(file);
  if (/apiRequest\s*\(/.test(source) || /\bfetch\s*\(/.test(source)) {
    failures.push(`${rel(file)}: React UI components/pages must call shared hooks, not apiRequest/fetch directly`);
  }
}

const requiredTests = [
  "tests/unit/operator-experience-service.test.ts",
  "tests/integration/operator-experience-routes.test.ts",
  "tests/unit/operator-information-needs-service.test.ts",
  "tests/integration/operator-information-needs-routes.test.ts",
];
for (const testPath of requiredTests) {
  if (!fs.existsSync(path.join(root, testPath))) {
    failures.push(`${testPath}: required unit/integration test is missing`);
  }
}

const packageJson = JSON.parse(read(path.join(root, "package.json")));
const ci = packageJson.scripts?.ci ?? "";
const guards = packageJson.scripts?.["check:guards"] ?? "";
if (!ci.includes("check:guards")) {
  failures.push("package.json: ci must include npm run check:guards");
}
if (!guards.includes("check:operator-experience-architecture")) {
  failures.push("package.json: check:guards must include check:operator-experience-architecture");
}

if (failures.length > 0) {
  console.error("Operator Experience architecture guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Operator Experience architecture guard passed.");
