<!--
SYNC IMPACT REPORT
==================
Version change: 1.8.0 → 1.9.0
Bump type: MINOR — Task verification documentation rule added to Development Workflow.
  Every task MUST include a documentation step as part of its verification criteria.
  Package documentation lives in <package>/docs/*.md.
Last amended: 2026-03-21

Modified principles:
  VII. Strong Typing & Schema Validation — enforcement mechanism updated from JSDoc @ts-check
    to TypeScript strict mode (noImplicitAny, strictNullChecks). Runtime boundary validation
    via Fastify Ajv unchanged.

Added sections / material expansions:
  - Principle VI: Layered Architecture (1.1.0)
  - Technology Stack: multi-component inventory (1.1.0)
  - DATABASE_TYPE resolved to DuckDB (1.2.0)
  - Principle VII: Strong Typing & Schema Validation (1.3.0)
  - Monorepo: Turborepo + pnpm workspaces; apps/server, apps/mobile, packages/core (1.4.0)
  - TypeScript: project-wide language; tsc compilation; strict mode (1.5.0)

Removed sections:
  (none)

Templates reviewed:
  ✅ .specify/templates/plan-template.md  — Language-agnostic; no structural change needed.
     Plans must gate against all seven principles at plan-time.
  ✅ .specify/templates/spec-template.md  — No structural changes required.
  ✅ .specify/templates/tasks-template.md — No structural changes required.
  ⚠  specs/001-server-architecture/plan.md — Language field and file extensions require
     updating from JavaScript/JSDoc to TypeScript. jsconfig.json → tsconfig.json.
  ⚠  specs/004-card-data-provider/plan.md — Language field and type definitions require
     updating from JSDoc @typedef to TypeScript interfaces.
  ✅ CLAUDE.md — Setup section updated to reflect pnpm + Turborepo monorepo.

Deferred TODOs:
  - TODO(MOBILE_PLATFORM): Mobile app framework not yet chosen (spec 002 confirms iOS +
    Android targets; platform choice requires a constitution amendment when made). TypeScript
    is confirmed as the language regardless of framework.
-->

# my-binder Constitution

## Core Principles

### I. Simplicity First

This is a personal project. The minimum complexity needed to solve the problem IS the right
complexity. Features MUST NOT be added speculatively — YAGNI governs all design decisions.
Abstractions MUST earn their place by eliminating real, present duplication; hypothetical
future requirements are not sufficient justification. When two approaches exist, the simpler
one MUST be chosen unless a concrete, documented reason demands otherwise.

### II. Data Integrity

Card collection data is the primary asset of this application. The system MUST never silently
lose or corrupt card records. All write operations MUST validate input before persistence.
Any change to the data schema MUST be accompanied by a documented migration path. Destructive
operations MUST require explicit confirmation.

### III. Test-First Development

Tests MUST be written before implementation code (Red-Green-Refactor). A feature is not
considered complete until its automated tests pass. The `main` branch MUST remain green at
all times. No code reaches `main` without a corresponding test exercising its primary
behaviour.

**Test co-location rule**: Unit and integration tests MUST live in the same directory as
the file they test, named `<filename>.test.ts`. For example, `src/services/cardService.ts`
MUST be tested by `src/services/cardService.test.ts`. The only exception is **E2E tests**,
which MUST live in a dedicated `tests/e2e/` directory at the workspace root (since they
exercise the full system, not a single file). No other `tests/` directories are permitted.

Rationale: co-located tests are discovered immediately alongside the code they cover, making
it obvious when a file has no test and preventing tests from becoming detached from the module
they exercise when files are moved or renamed.

### IV. Single Responsibility

Each module, function, or file MUST have one clear, narrow purpose. Card domain logic MUST be
separated from I/O, rendering, and persistence concerns. Cross-cutting coupling between
unrelated modules is not permitted without explicit written justification in the relevant
plan or PR.

### V. Transparency & Legibility

Code MUST be readable by someone unfamiliar with the project. Identifier names MUST describe
intent, not implementation detail. Magic literals MUST be replaced by named constants.
Comments MUST explain *why*, not *what* — the code itself conveys the what.

### VI. Layered Architecture

The system is composed of four distinct layers: **Mobile App → API Server → Database** and
**API Server → Card Data Provider**. Each layer MUST communicate only with its immediately
adjacent layer. Specifically:

- The mobile app MUST NOT call the card data provider or the database directly.
- The API server is the sole integration point between the mobile app, the database, and
  any external card data provider.
- Card data sources MUST be accessed through a provider abstraction interface — never
  hard-coded to a specific external service. MTGJSON is the current default provider;
  switching providers MUST require only a configuration change, not a code change.
- New external integrations MUST be introduced as providers behind this abstraction, not
  as direct calls embedded in business logic.

Rationale: layer integrity keeps the mobile app deployable independently of provider changes,
makes the system testable at each boundary, and ensures no single external dependency can
cascade failures across all layers.

### VII. Strong Typing & Schema Validation

All source code MUST be written in TypeScript with `strict` mode enabled (`noImplicitAny`,
`strictNullChecks`, `strictFunctionTypes` at minimum). The `any` type is prohibited; use
`unknown` and narrow explicitly where the type cannot be determined statically. TypeScript
provides compile-time enforcement; runtime validation at system boundaries is a separate,
additional requirement.

All data crossing a system boundary MUST also be validated against a declared schema at
runtime. Validation MUST occur at every communication point:

- **Server — inbound requests**: every request body and path/query parameter MUST be
  validated against a JSON schema before the handler runs. Requests that fail validation
  MUST be rejected with a `VALIDATION_ERROR` (HTTP 400) before reaching service or
  repository code. TypeScript types alone are insufficient here — types are erased at
  runtime.
- **Server — outbound responses**: response shapes MUST conform to a declared schema at
  serialisation time. No ad-hoc or unchecked objects may be returned to clients.
- **Mobile — inbound API responses**: every API response MUST be validated against the
  expected schema before the data is passed to application logic or persisted locally. A
  response that does not match the expected shape MUST be treated as an error.
- **Mobile — data persistence**: data MUST be validated before it is written to local storage
  or the local database.

Schema definitions MUST be co-located with the code that owns the boundary and kept in sync
with `data-model.md` and the relevant contract documents. Shared schemas and types MUST live
in `packages/core` and MUST NOT be duplicated across workspaces.

Rationale: TypeScript's type system is erased at runtime. Boundary validation is the runtime
complement to compile-time typing — both are required. Shared types in `packages/core` ensure
mobile and server agree on the same shapes without copy-paste drift.

**File purity rule**: `.ts` and `.js` source files MUST NOT coexist within the same workspace
`src/` directory. Every workspace is either fully TypeScript (`.ts` source, compiled to `dist/`)
or fully JavaScript — never mixed. Import paths inside TypeScript source MUST NOT include `.js`
extensions when using `"module": "CommonJS"` resolution; extensions are only required under
`"module": "NodeNext"` / `"Node16"` ESM resolution. Violating either rule is a constitution
breach requiring explicit justification in the Complexity Tracking table.

**Path alias rule**: Every workspace MUST declare two TypeScript path aliases in its
`tsconfig.json` `compilerOptions.paths`:

- `@root/*` — maps to the package root (e.g., `["./*"]` in `apps/server/tsconfig.json`)
- `@src/*` — maps to the `src/` directory (e.g., `["./src/*"]` in `apps/server/tsconfig.json`)

Aliased paths MUST be used in place of any import that would traverse upward (`../`) out of
the current file's directory. Relative imports (e.g., `./sibling`) are permitted within the
same directory or into a subdirectory. The rule is: if an import path contains `../`, it MUST
be rewritten using `@src/` or `@root/` instead.

```jsonc
// apps/server/tsconfig.json — example
{
  "compilerOptions": {
    "paths": {
      "@root/*": ["./*"],
      "@src/*": ["./src/*"]
    }
  }
}
```

Rationale: upward-traversing relative paths (`../../db/client`) obscure the structural position
of the importing file and break silently when files are moved. Named aliases make every import
self-documenting and refactoring-safe.

## Technology Stack

The system is a **monorepo** managed with **pnpm workspaces** and **Turborepo**. Each
workspace is built and deployed independently. The repository root is not a deployable unit.

### Repository Structure

```
my-binder/                     # Repo root (private — not published)
├── apps/
│   ├── server/                # Fastify API server (spec 001)
│   └── mobile/                # Mobile app (spec 002)
├── packages/
│   └── core/                  # Shared TypeScript types, schemas, and constants
├── turbo.json                 # Turborepo pipeline definition
├── pnpm-workspace.yaml        # pnpm workspace manifest
└── package.json               # Root package (engines, scripts only)
```

### Workspace Responsibilities

- **`apps/server`**: TypeScript (Node 22) Fastify API server. Compiled with `tsc`; output
  runs on Node 22. Depends on `packages/core`. Node built-ins are preferred over third-party
  packages. Deployed as a Docker container. `tsconfig.json` MUST enable `strict: true`.
- **`apps/mobile`**: TypeScript mobile application targeting iOS and Android. Depends on
  `packages/core`. `tsconfig.json` MUST enable `strict: true`.
  TODO(MOBILE_PLATFORM): Framework not yet chosen; requires a constitution amendment when
  decided. TypeScript is confirmed as the language regardless of framework.
- **`packages/core`**: Shared TypeScript code consumed by both apps. Contains: TypeScript
  interfaces and types, JSON Schema constants (Principle VII), and named constants (error
  codes, status values). MUST NOT contain application-specific business logic. MUST NOT
  depend on `apps/*`. Compiled to CommonJS + ESM with declaration files (`.d.ts`).

### Build Tooling

- **TypeScript**: All source files are `.ts`. `tsc` compiles each workspace independently.
  `tsconfig.json` at each workspace root; a root `tsconfig.base.json` provides shared
  compiler settings. `strict: true` is non-negotiable and MUST NOT be disabled or
  selectively suppressed with `@ts-ignore` or `as any` casts without documented justification
  in the relevant plan or PR.
- **pnpm**: Package manager for all workspaces. `pnpm-lock.yaml` is the canonical lock file.
  Direct `node_modules` manipulation outside of pnpm is prohibited.
- **Turborepo**: Task orchestration. `turbo.json` defines the task dependency graph. Tasks:
  `build` (tsc), `test`, `dev`, `typecheck` (tsc --noEmit). Turborepo ensures `packages/core`
  is built before dependents. Remote cache MAY be used to skip unchanged workspaces in CI.
- Apps are deployed separately: `apps/server` deploys as a Docker container; `apps/mobile`
  deploys via the platform app store pipeline.

### Other Stack Components

- **Database**: DuckDB (embedded, file-based). Lives in `apps/server`. The `.duckdb` file is
  persisted via Docker volume mount at `DB_PATH`. No separate database container.
- **Card Data Provider**: MTGJSON is the default provider. Provider abstraction (Principle VI)
  must be in place before any provider-specific code is written. Lives in `apps/server`.
- **Containerisation**: `apps/server` MUST run as a self-contained container. No secrets may
  be baked into container images; all runtime configuration MUST be supplied via environment
  variables. `apps/mobile` is not containerised.

## Development Workflow

All changes merged to `main` MUST pass the full test suite and `tsc --noEmit` across all
workspaces. Features are developed on branches and integrated via pull request. Commits MUST
be atomic and their messages MUST describe the intent of the change (not just the mechanism).
Breaking changes to card data structures MUST include a documented migration path before
merging.

### Feature Design Documentation

Every feature MUST be fully designed and documented before implementation begins. The following
artifacts are required in `specs/<feature>/` before any implementation task is written or
executed:

| Artifact | Purpose |
|---|---|
| `spec.md` | User-facing requirements and acceptance criteria (technology-agnostic) |
| `plan.md` | Technical approach, tech stack, file structure, Constitution Check |
| `data-model.md` | Entity definitions, field types, validation rules, relationships |
| `contracts/` | Interface contracts for every API boundary the feature exposes |
| `quickstart.md` | Concrete integration scenarios and end-to-end success criteria |

`research.md` is required when the plan references unresolved technology decisions. A feature
plan that leaves any of the mandatory artifacts absent MUST NOT proceed to task generation.

Rationale: implementation without a written design produces code that cannot be reviewed
against intent, makes schema drift undetectable, and forces rework when boundary contracts
are discovered late.

### Task Verification Documentation

Every task is not considered complete until a corresponding documentation step has been
fulfilled as part of its verification criteria. Documentation MUST be written or updated
before the task is marked done — it is not a follow-up activity.

Documentation files MUST live in `<package>/docs/*.md` (e.g.,
`apps/server/docs/database.md`, `packages/core/docs/schemas.md`). The `README.md` at the
package root covers orientation and startup; `docs/` is for deeper reference material that
would make `README.md` unwieldy:

- Architecture and design decisions for the component
- Data model and migration notes
- API contract details (beyond what `contracts/` specifies at spec time)
- Configuration reference
- Operational runbooks

A task that introduces a new module, API route, data model change, or configuration option
MUST produce or update at least one `docs/*.md` file that describes what was added. Tasks
that are purely mechanical (dependency bumps, formatting, rename-only refactors) are exempt.

Rationale: documentation written after the fact is rarely written at all. Embedding it as a
verification gate inside each task ensures the codebase and its docs stay in sync
incrementally rather than drifting apart over time.

## Governance

This constitution supersedes all informal practices and verbal agreements. Amendments require
a version bump per semantic versioning:
- **MAJOR**: backward-incompatible removal or redefinition of a principle.
- **MINOR**: new principle added, or existing principle or section materially expanded.
- **PATCH**: clarification, wording improvement, or non-semantic refinement.

Each feature plan MUST include a Constitution Check (as defined in
`.specify/templates/plan-template.md`) verifying compliance with all seven principles before
implementation begins. Violations MUST be justified in the plan's Complexity Tracking table.

**Version**: 1.9.0 | **Ratified**: 2026-03-21 | **Last Amended**: 2026-03-21
