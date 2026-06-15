import fs from "node:fs";

const required = [
  ["client/src/routes/operations.ts", "/attention-inbox"],
  ["client/src/config/navigationConfig.ts", "/attention-inbox"],
  ["client/src/pages/home.tsx", "MobileCommandCenterPage"],
  ["client/src/lib/queryClient-request.ts", "headers.Authorization"],
  ["client/src/components/auth/SessionGate.tsx", "Unlock ARUS"],
  ["client/src/features/workflow/pages/AttentionInboxPage.tsx", "Attention Inbox"],
  ["client/src/features/workflow/pages/AttentionInboxPage.tsx", "waitingOnParts"],
  ["client/src/features/workflow/components/ResolveBlockerPanel.tsx", "Save blocker update"],
  ["client/src/features/workflow/components/HandoverNotesPanel.tsx", "/api/attention/handover"],
  ["client/src/features/workflow/components/ReportIssueFlowCard.tsx", "/api/attention/issues"],
  ["server/domains/workflow/interfaces/routes.ts", "/api/attention/items"],
  ["server/domains/workflow/interfaces/routes.ts", "/api/attention/blocker-resolutions"],
  ["server/domains/workflow/interfaces/routes.ts", "/api/attention/handover"],
  ["server/domains/workflow/interfaces/routes.ts", "/api/attention/issues"],
  ["server/domains/workflow/application/attention-service.ts", "AttentionSourceHealth"],
  ["server/domains/workflow/application/attention-service.ts", "saveBlockerResolution"],
  ["server/domains/workflow/application/attention-service.ts", "saveHandover"],
  ["server/domains/workflow/application/attention-service.ts", "reportIssue"],
];

let failed = false;

for (const [file, needle] of required) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes(needle)) {
    console.error(`Workflow guard failed: ${file} is missing ${needle}`);
    failed = true;
  }
}

const attentionService = fs.readFileSync(
  "server/domains/workflow/application/attention-workflow-builder.ts",
  "utf8"
);
if (!attentionService.includes("count: nonPartsBlocked.length")) {
  console.error("Workflow guard failed: Blocked queue count must exclude waiting-on-parts jobs.");
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log("Workflow route/session/action guard passed.");
