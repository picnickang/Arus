import fs from "node:fs";

const required = [
  ["client/src/routes/operations.ts", "/attention-inbox"],
  ["client/src/config/navigationConfig.ts", "/attention-inbox"],
  ["client/src/pages/home.tsx", "WorkflowCommandCenter"],
  ["client/src/lib/queryClient.ts", "headers.Authorization"],
  ["client/src/components/auth/SessionGate.tsx", "Unlock ARUS"],
  ["client/src/features/workflow/pages/AttentionInboxPage.tsx", "Attention Inbox"],
];

let failed = false;

for (const [file, needle] of required) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes(needle)) {
    console.error(`Workflow guard failed: ${file} is missing ${needle}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("Workflow route/session guard passed.");
