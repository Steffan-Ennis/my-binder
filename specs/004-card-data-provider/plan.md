# Implementation Plan: Card Data Provider

**Branch**: `004-card-data-provider` | **Date**: 2026-03-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-card-data-provider/spec.md`

## Summary

Build a provider abstraction layer on the API server that wraps card data sources behind a
common interface. The first and default provider is MTGJSON, accessed via the `mtgjson-sdk`
npm package. The SDK operates fully offline using a local DuckDB database synced from the
MTGJSON CDN — delivering sub-millisecond query latency with no rate limits or network
dependency at query time. The abstraction ensures that switching providers in future requires
only a configuration change, not a code change.

## Technical Context

**Language/Version**: TypeScript 5 (Node 22); compiled with `tsc`; `strict: true`
**Workspace**: `apps/server` within the my-binder pnpm monorepo
**Primary Dependencies**:
- `mtgjson-sdk` (MTGJSON official SDK; ships compiled JS + `.d.ts` declarations; no TS
  build step required from the SDK — types are consumed directly)
- `@my-binder/core` — shared TypeScript interfaces (`CardRecord`, `LegalityResult`, etc.)
  and schema constants from `packages/core`
**Storage**: Local DuckDB file managed by the SDK (synced from MTGJSON CDN on initialisation;
no external DB required for this feature)
**Testing**: Node 22 built-in test runner (`node:test`) — no additional test framework needed
**Target Platform**: Linux container (API server, per spec 001)
**Project Type**: service — provider abstraction module within the API server
**Performance Goals**: lookup <2s, legality <1s, search (first page) <3s — all comfortably
exceeded by sub-millisecond DuckDB local queries
**Constraints**: Single active provider at runtime; provider switching via config only; mobile
app MUST NOT call the provider directly (Principle VI)
**Scale/Scope**: Single-user personal application; card catalogue ~30,000+ cards across all
MTG sets

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | ✅ PASS | Provider abstraction is justified: eliminates future lock-in without adding speculative features. SDK is a single `npm install`. |
| II. Data Integrity | ✅ PASS | Normalised `CardRecord` model; "not found" returns clean result; provider unavailability returns typed error — no silent failures. |
| III. Test-First Development | ✅ PASS | Tests written before implementation. SDK's local DuckDB enables real integration tests without mocking; no stubs needed for known cards. |
| IV. Single Responsibility | ✅ PASS | Provider module: data sourcing only. Service layer: business logic. Router: HTTP. Three clearly scoped concerns. |
| V. Transparency & Legibility | ✅ PASS | Provider interface is a typed TypeScript interface; card field names match domain language; no magic strings or numeric codes. |
| VI. Layered Architecture | ✅ PASS | Provider called only from server service layer. Mobile app routes through server API. SDK DuckDB file is local to the server container — no mobile access. |
| VII. Strong Typing & Schema Validation | ✅ PASS | TypeScript `strict: true` enforces no-implicit-any and null safety throughout. `CardRecord`, `LegalityResult`, `SearchQuery`, and `ProviderInfo` defined as TypeScript interfaces in `packages/core`. Mapper output is typed; HTTP route schemas (spec 001) enforce the outbound runtime boundary. |

**Note — TypeScript SDK interop**: `mtgjson-sdk` is authored in TypeScript and ships compiled
JavaScript with `.d.ts` declarations. It is imported directly into the TypeScript server with
full type safety — no additional `@types/*` package is needed.

*Post-design re-check: no violations introduced. Complexity Tracking table not required.*

## Project Structure

### Documentation (this feature)

```text
specs/004-card-data-provider/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── card-lookup.md
│   ├── card-search.md
│   ├── card-legality.md
│   └── provider-management.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
my-binder/                          # Repo root
├── apps/
│   └── server/                     # This workspace
│       ├── src/
│       │   ├── providers/
│       │   │   ├── interface.ts    # CardProvider type: lookup(name, opts?), checkLegality, search, isReachable
│       │   │   ├── registry.ts     # Provider registry: registration + active provider
│       │   │   └── mtgjson/
│       │   │       ├── index.ts    # MtgjsonProvider: implements ICardProvider
│       │   │       └── mapper.ts   # Maps SDK response → normalised CardRecord
│       │   └── services/
│       │       └── cardService.ts  # Business logic: lookup, legality, search
│       └── tests/
│           ├── unit/
│           │   ├── providers/
│           │   │   ├── registry.test.ts
│           │   │   └── mtgjson/mapper.test.ts
│           │   └── services/cardService.test.ts
│           └── integration/
│               └── providers/mtgjson.test.ts  # Real SDK queries
└── packages/
    └── core/                       # Shared across workspaces
        └── src/
            └── types/
                └── card.ts         # CardRecord, Printing, LegalityResult,
                                    # SearchQuery, SearchResult, ProviderInfo interfaces
```

**Structure Decision**: The provider abstraction lives in `apps/server/src/providers/`.
Shared domain types (`CardRecord`, `LegalityResult`, etc.) are defined in `packages/core`
so that `apps/mobile` can reference the same types when consuming the server's API responses
(Principle VII — no type duplication across workspace boundaries). The mobile app (spec 002)
consumes the server's HTTP API; it MUST NOT access the provider or DuckDB directly.
