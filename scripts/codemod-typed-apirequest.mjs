#!/usr/bin/env node
// Codemod: in every useQuery<TYPE>({...queryFn: () => apiRequest("GET", url)...})
// rewrite the inline apiRequest call to apiRequest<TYPE>("GET", url) so the
// queryFn return type matches TQueryFnData. Safe text transform that only
// touches calls that match the precise pattern.

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const files = execSync(
  "rg -l -g '*.ts' -g '*.tsx' 'queryFn: \\(\\) => apiRequest\\(\"GET\"' client/src",
  { encoding: "utf8" }
)
  .split("\n")
  .filter(Boolean);

let totalChanged = 0;
for (const file of files) {
  const src = readFileSync(file, "utf8");
  // Find useQuery<TYPE>({ ... queryFn: () => apiRequest("GET", X ...) ... })
  // Capture the TYPE generic and the immediately-following apiRequest call's args.
  const re =
    /useQuery<([A-Za-z0-9_$.<>,\s\[\]?|&]+?)>\s*\(\s*\{([^{}]*?queryFn:\s*\(\)\s*=>\s*apiRequest)\(("GET",\s*[^)]+)\)/gs;
  let count = 0;
  const next = src.replace(re, (_match, type, pre, args) => {
    count += 1;
    return `useQuery<${type}>({${pre}<${type.trim()}>(${args})`;
  });
  if (count > 0) {
    writeFileSync(file, next);
    console.log(`[typed-apirequest] ${file}: ${count}`);
    totalChanged += count;
  }
}
console.log(`Total apiRequest call sites typed: ${totalChanged}`);
