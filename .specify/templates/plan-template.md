# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

### Dependency Currency Check (Principle XI)

*GATE: REQUIRED for any feature that adds a new entry to `dependencies`,
`devDependencies`, or `peerDependencies` in any `package.json`. Skip the
table entirely if the feature adds no new packages.*

For each new package introduced by this feature, list the chosen version and
confirm it is the registry's current stable (or the framework-mandated version
per Principle XI's framework carve-out). If any chosen version is older than
current stable, or the package is registry-flagged deprecated, populate the
"Justification" column with a concrete blocker (peer-dep ceiling, active CVE
in latest, breaking-change incompatibility, missing types, framework pin,
etc.). "Preference" or "we'll bump later" is not a justification — open a
Complexity Tracking row instead.

| Package | Workspace | Chosen version | Current stable | Justification (only if off-stable) |
|---|---|---|---|---|
| `<pkg>` | `apps/<workspace>` | `^x.y.z` | `^x.y.z` | _all latest stable — no entry needed_ |

> If every new package matches current stable, write a single row stating
> "No off-stable selections" and delete the example row above.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Unit Testing Phase

*GATE: This section is REQUIRED in every plan per Constitution Principle III. A plan
without a completed Unit Testing Phase MUST NOT proceed to task generation
(`/speckit.tasks`).*

**Test framework**: Jest (with `ts-jest` for TypeScript sources). Alternative runners
are not permitted (see Principle III).

### Test files to create or update

List every Jest test file that will be created or updated by this feature, with the full
co-located path (`<filename>.test.ts` next to the file under test, per Principle III's
co-location rule). E2E tests, if any, live under `tests/e2e/`.

> **Mobile mocks (`apps/mobile` only):** any new third-party native or Expo dependency
> introduced by this feature MUST land its mock entry in `apps/mobile/jest.setup.ts` in
> the same PR. Per-test mocks via in-file `jest.mock(...)` are prohibited; use
> `jest.spyOn` against the shared mock instead. See the **Mobile mocking conventions**
> sub-section of Principle III.

| Test file | Status | Behaviours covered (mapped to FR-### where applicable) |
|---|---|---|
| `apps/<workspace>/src/<path>/<file>.test.ts` | new \| update | <bullet list of behaviours> |
| `apps/<workspace>/src/<path>/<file>.test.ts` | new \| update | <bullet list of behaviours> |

### Coverage target

Declare the coverage target for the new code this feature introduces. Express as Jest
`coverageThreshold` values (line %, branch %, function %, statement %). The default
project floor is 80% line / 80% function unless an explicit reason justifies otherwise
in the Complexity Tracking table.

```jsonc
// jest.config.* — coverageThreshold for this feature's new code
{
  "coverageThreshold": {
    "global": { "branches": 80, "functions": 80, "lines": 80, "statements": 80 }
  }
}
```

### Test execution

State how the unit tests will be run locally and in CI (e.g., `pnpm --filter @my-binder/server test`,
`turbo test`). Tests MUST run as part of the standard `turbo test` pipeline so the `main`
branch stays green per Principle III.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
