# Mobile Readiness Gap Closure Scorecard

Scores are evidence-based and should be updated after each full verification run.

| Category                 |                       Current target | Status                                      | Evidence                                                                         |
| ------------------------ | -----------------------------------: | ------------------------------------------- | -------------------------------------------------------------------------------- |
| Role-aware navigation    |                               9.5/10 | Passing locally                             | Curated link audit plus visible-control crawl pass for five personas             |
| Visual fidelity          |                               8.5/10 | Evidence generated, pending manual approval | 78 captures and comparison sheets generated under `/private/tmp`                 |
| Asset fidelity           |                               9.0/10 | Evidence generated, pending manual approval | Registry tests pass and asset contact sheet contains 14 assets                   |
| Production E2E readiness | 8.5/10 before live run, 9.0/10 after | Harness ready, pending live credentials     | Production-gated write audit is discoverable with explicit write opt-in          |
| Responsive layout        |                               9.0/10 | Passing locally                             | Visual gate asserts no horizontal overflow at 360, 375, 390, 414, 430, and 768px |
| Build/test health        |                               9.0/10 | Passing locally                             | TypeScript, test TypeScript, Playwright, nav matrix, and build pass              |

## Gap Closure Conditions

- Overall readiness reaches `9+/10` only after the full local suite passes and production write audit evidence is recorded.
- Visual fidelity cannot be marked complete until every comparison sheet is classified as `accepted` or has a linked follow-up fix.
- Production readiness cannot be marked complete until records created with the audit run prefix are cleaned up or listed in the production audit report.

## Latest Evidence

- Full Chromium Playwright: `49 passed`.
- Nav matrix with quarantine enabled: `9 passed`.
- Visual fidelity run: `/private/tmp/arus-visual-comparison/local-2026-06-12T19-55-19-173Z/visual-fidelity-report.json`.
- Production full-write audit: discoverable, not executed without production URL and dedicated QA credentials.
