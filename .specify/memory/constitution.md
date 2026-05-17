<!--
SYNC IMPACT REPORT
==================
Version change: 1.25.0 → 1.26.0
Bump type: MINOR — adds a new "Data-fetching hook composition rule"
  sub-section to Principle X (Component Architecture, Mobile), placed
  between the existing "Hook return-value memoisation rule" and
  "State locality rule". The sub-section codifies the canonical shape
  of a feature hook that wraps a TanStack Query primitive
  (`useCardImagesQuery`, `useCardsInfiniteQuery`, `useMeQuery`,
  etc.) using `apps/mobile/src/components/card/` (spec 017) as the
  reference implementation. Seven non-negotiable rules:

    1. **Destructure the query result at the hook boundary.** Pull
       only the fields the feature consumes (`data`, `error`,
       `isLoading`, `isSuccess`, `refetch`); passing the entire
       `UseQueryResult` through to the container or view is
       prohibited (it leaks the TanStack surface across layer
       boundaries).
    2. **Derive view-shaped data with `useMemo` or TanStack
       `select`.** Transformation between `query.data` and the shape
       the view consumes MUST happen at the hook boundary; view-side
       transformation is prohibited.
    3. **Pass `error` through without redeclaring it.** The view
       consumes the query's `error` directly via the view-props type
       (rule 5); wrapping the query error in a feature-specific error
       model is prohibited on both sides.
    4. **Encapsulate side effects (animations, subscriptions,
       listeners) in the hook.** Animation refs (`Animated.Value`),
       timing loops, gesture handlers, and native API subscriptions
       MUST be constructed in `use<Feature>.ts` and surfaced to the
       view as a stable handle (a `RefObject<Animated.Value>`, a
       memoised callback, a subscription token). View-layer effects
       remain prohibited per the existing Layer rules table.
    5. **Derive view props from the query result type via `Pick`.**
       The `<Feature>ViewProps` type MUST compose
       `Pick<UseXxxQueryResult, 'error' | 'isLoading' | 'isSuccess'
       | ...>` joined with feature-specific additions via `&`;
       redeclaring `error`, `isLoading`, or any other field TanStack
       already types on its result is prohibited (silent drift on
       library upgrade or API schema change).
    6. **Name hook options as `Use<Feature>Options`.** Hooks that
       accept parameters MUST receive a single options object typed
       with a named `Use<Feature>Options` type living in the feature
       directory's `types.ts` (or as a named export from the hook
       file if no `types.ts` exists). Inline parameter destructuring
       without a named type is prohibited.
    7. **Feature-local `types.ts` for non-wire types.** Component
       directories that compose a query hook MAY add a sibling
       `types.ts` to host Pick'd view-props types, options types, and
       feature-specific typedefs. The file MUST NOT import from
       another feature directory (Principle IV) and MUST NOT
       redeclare types already in `packages/core` (Principle IX).

  The trigger was the spec 017 reusable card component review of
  `apps/mobile/src/components/card/{CardContainer.tsx,CardView.tsx,
  types.ts,useCard.ts}`. The card feature collapses cleanly into a
  three-file unit (plus `types.ts`) whose type contract composes
  end-to-end: query result → hook options → view props → container
  destructure → view render. The amendment codifies that shape so
  every future data-fetching feature in `apps/mobile` follows the
  same pattern from the first commit.

  No principle is removed or redefined; no version-pin language is
  altered. The rule applies project-wide from this amendment forward;
  existing data-fetching components that pre-date the rule are
  surfaced as carry-over TODOs and MUST be migrated before any new
  task touches the file in question.

Last amended: 2026-05-17

Added principles:
  (none — Principle X expanded, not added)

Modified sections:
  - Principle X. Component Architecture (Mobile) — added
    "Data-fetching hook composition rule" sub-section between the
    "Hook return-value memoisation rule" and "State locality rule"
    sub-sections, codifying the seven rules listed above with a
    canonical compliant pattern (drawn verbatim from
    `apps/mobile/src/components/card/`) and a prohibited-pattern
    catalogue.

Removed sections:
  (none)

Templates reviewed:
  ✅ .specify/templates/plan-template.md  — No change required. The
     Constitution Check section already directs plans to verify
     compliance with every principle; the new Data-fetching hook
     composition rule is a Principle X refinement caught by the
     existing gate.
  ✅ .specify/templates/spec-template.md  — No change required
     (specs are technology-agnostic; hook composition is an
     implementation concern surfaced in plan.md).
  ✅ .specify/templates/tasks-template.md — No change required (the
     new rule surfaces as ordinary code-review work inside the
     existing task categorisation; data-fetching feature plans MUST
     state in their Unit Testing Phase how the hook, view, and
     options types compose end-to-end).

Deferred TODOs (new in 1.26.0 — code-side migrations):
  (none — `apps/mobile/src/components/card/` is the reference
   implementation and is already compliant. Future data-fetching
   features MUST adopt the sub-section's pattern from the first
   commit. The 1.25.0 trigger TODO for
   `apps/mobile/src/components/card/useCard.ts` line 27 — rename
   `const state = useMemo<CardViewState>(...)` to `cardViewState` —
   is resolved by the present code, which returns the differently-
   named primitives `imageUrl`, `pulseRef`, `error`, `isLoading`,
   `isSuccess`, and `onRetry` directly. The stale JSDoc reference to
   `{ state, footprint }` at lines 18–20 MUST be rewritten to
   describe the actual return shape; tracked as a v1.25.0 carry-over
   item below.)

Carry-over from 1.25.0 (updated):
  ✅ apps/mobile/src/components/card/useCard.ts — Resolved. The
     identifier `state` from the trigger TODO no longer exists in
     this file; the hook returns named view-prop primitives directly.
  ⚠ apps/mobile/src/components/card/useCard.ts — JSDoc at lines 18-20
     still references `{ state, footprint }` as the returned shape.
     The actual return is `{ pulseRef, imageUrl, error, isLoading,
     isSuccess, onRetry }`. The JSDoc MUST be rewritten to describe
     the current return shape and to point at `CardViewProps` from
     `./types.ts` as the type-level source of truth.
  ⚠ apps/mobile/src/components/binder-home/useBinderHome.ts —
     `const [state, dispatch] = useReducer(binderHomeReducer, ...)`
     (line 129) and the reducer parameter `state: BinderHomeState`
     (line 46). Rename both to `binderHomeState` so the reducer
     signature reads `(binderHomeState, action) => ...` and the hook
     body reads `const [binderHomeState, dispatch] = useReducer(...)`.
  ⚠ apps/mobile/src/components/binder-home/useBinderHome.ts —
     `(p) => p.cards` short-form callback parameter (line 125).
     Rename to `(page) => page.cards`. Update the JSDoc example at
     `apps/mobile/src/hooks/useCardsInfiniteQuery.ts` line 40 to
     match.
  ⚠ apps/mobile/src/services/auth/googleAuth.ts — `(e) => log.warn(...)`
     JSDoc example (line 55). Rename to `(error) => log.warn(...)`.
  ⚠ apps/server/src/providers/mtgjson/MtgjsonProvider.ts —
     `(c) => c.availability...` (line 78), `(c) => c.toUpperCase()`
     (line 101), `(c) => !commanderColorSet.has(c)` (line 102).
     Rename each to `(card)` / `(color)` per its domain meaning.
  ⚠ apps/server/src/routes/cards.ts — `(c) => c.trim()...` (lines
     177, 206). Rename to `(color) => color.trim()...`.

Carry-over from 1.24.0 (unchanged):
  ⚠ Audit existing `apps/mobile/src/**/*View.test.tsx` files for
    helper-style `renderView` / `renderComponent` functions and
    migrate each to a sibling `<ComponentName>WithDefaults` FC.

Carry-over from 1.23.0 (unchanged):
  ⚠ apps/server/src/routes/cards.test.ts — extract inline
     `dataSource.getRepository(UserEntity).upsert(...)` seed into
     `apps/server/testing/userFactory.ts` exporting
     `createTestUser(dataSource, overrides)`.
  ⚠ apps/server/src/routes/auth.test.ts — extract inline
     `AllowedUserEntity.save(...)` / `UserEntity.upsert(...)` seeds
     into `apps/server/testing/allowedUserFactory.ts` exporting
     `createTestAllowedUser(dataSource, overrides)`.

Carry-over from 1.22.0 (unchanged):
  ⚠ apps/server/src/routes/docs.test.ts — still uses `jest.mock(...)`
     against `apps/server/src/services/` and `apps/server/src/db/`.
     MUST be rewritten as an E2E test against real services,
     repositories, the real TypeORM `DataSource`, and the offline-mode
     MTGJSON SDK, with data setup through the rule-5 factories.

Carry-over from 1.21.0 (unchanged):
  ⚠ CLAUDE.md — Stale references to `binderStore` remain at line 50
     (folder tree) and line 200 (Active Technologies list). MUST be
     updated to remove the `binderStore` mentions and note that
     `currentPage` plus search state now live in `useBinderHome.ts`.

Carry-over from 1.20.0 (unchanged):
  ⚠ apps/mobile theme files — LoginView, AccessDeniedView, and
     ComingSoonView MUST migrate inline `StyleSheet.create` blocks
     into sibling `<Component>.theme.ts` files.

Carry-over from 1.19.0 (unchanged):
  ⚠ apps/mobile/src/services/auth/googleAuth.ts — uses
     `expo-auth-session/providers/google` (deprecated by Expo).
     Migration tracked in
     `todo/migrate-google-auth-to-google-signin.md`.

Carry-over from 1.17.0 (unchanged):
  ⚠ apps/mobile/package-lock.json — npm lockfile from the
     create-expo-app bootstrap; delete and re-resolve via
     `pnpm install`.
  ⚠ apps/mobile/tsconfig.json — currently declares
     `paths: { "@/*": ["./*"] }`; Principle VII requires `@root/*`
     and `@src/*` aliases.
  ⚠ apps/mobile/hooks/{use-color-scheme.ts,use-color-scheme.web.ts,
     use-theme-color.ts}, apps/mobile/scripts/reset-project.js,
     apps/mobile/app/modal.tsx — leftover create-expo-app template
     files outside the Principle X four-layer structure.

Carry-over from 1.14.0 (unchanged):
  ⚠ specs/001-server-architecture/plan.md — JSDoc → TypeScript
     migration.
  ⚠ specs/004-card-data-provider/plan.md — JSDoc → TypeScript
     migration.
-->

<!-- PREVIOUS SYNC IMPACT REPORT (v1.24.0 → v1.25.0) follows for archival reference.
==================
Version change: 1.24.0 → 1.25.0
Bump type: MINOR — materially expands Principle V (Transparency &
  Legibility) with a new "Identifier intent rule" sub-section that
  codifies two non-negotiable identifier-naming rules applying to
  every TypeScript source file across the monorepo (`apps/server`,
  `apps/mobile`, `packages/core`, `packages/infrastructure`):

    1. **Generic placeholder nouns are prohibited.** Identifier names
       like `state`, `data`, `value`, `result`, `info`, `obj`, `item`,
       `thing`, `temp`, `tmp`, `foo`, `bar` (and their plurals) MUST
       NOT be used. They name what the value *is to the language*
       (a piece of state, a piece of data) rather than what the value
       *means in the domain* (a `cardCount`, a `searchTerm`, a
       `signInError`). Every reducer has state, every fetch returns
       data, every handler produces a result — the placeholder noun
       communicates nothing the reader cannot already infer from the
       surrounding code.
    2. **Short-form acronyms and contractions are prohibited.**
       Identifier names like `usr`, `cfg`, `mgr`, `svc`, `mod`, `idx`,
       `lst`, `len`, `cnt`, `qry`, `txn`, `cb`, `req`/`res` (inside
       handler bodies), `e` (for events or errors), `pwd`, `addr`,
       single-letter parameter names in `.map` / `.filter` / `.find` /
       `.flatMap` callbacks (e.g. `(p) => p.cards`, `(c) => c.id`),
       and similar contractions MUST NOT be used. Write the full
       word: `user`, `config`, `manager`, `service`, `module`,
       `index`, `list`, `length`, `count`, `query`, `transaction`,
       `callback`, `event` / `error`, `password`, `address`,
       `(page) => page.cards`, `(card) => card.id`.

  Carve-outs (explicitly permitted): widely-standardised industry
  acronyms whose expanded form is rarely written (`url`, `http`,
  `https`, `json`, `xml`, `id`, `uuid`, `jwt`, `api`, `sdk`, `dto`,
  `ui`, `uri`, `iso`, `utc`, `jsx`, `tsx`, `db`) MAY appear as full
  identifier tokens (`userId`, `apiClient`, `jwtSecret`,
  `dbConnection`). Single-letter loop indices (`i`, `j`, `k`) inside
  tight numeric `for` loops over a known-finite range are also
  permitted. Reducer signatures MUST type the state parameter with
  the domain noun, not the generic word `state` —
  `(binderHomeState, action)` instead of `(state, action)`.

  The trigger was the spec 017 reusable card component work, which
  introduced `const state = useMemo<CardViewState>(() => { ... })` in
  `apps/mobile/src/components/card/useCard.ts` (line 27). The
  identifier `state` says nothing about which slice of state the
  memo produces; renaming it to `cardViewState` makes the hook's
  return shape self-documenting and aligns it with the existing
  `<Component>Props` / `<Component>State` naming pattern.

  No principle is removed or redefined; no version-pin language is
  altered. The rule applies project-wide from this amendment forward.
  Existing in-tree violations are surfaced as carry-over TODOs and
  MUST be migrated before any new task touches the file in question.

Last amended: 2026-05-17

Added principles:
  (none — Principle V expanded, not added)

Modified sections:
  - Principle V. Transparency & Legibility — added "Identifier intent
    rule" sub-section codifying the two prohibitions above plus the
    carve-out list and a compliant/prohibited code-pattern pair.

Removed sections:
  (none)

Templates reviewed:
  ✅ .specify/templates/plan-template.md  — No change required. The
     Constitution Check section already directs plans to verify
     compliance with every principle; the new Identifier intent rule
     is a Principle V refinement caught by the existing gate. No new
     template scaffolding is needed.
  ✅ .specify/templates/spec-template.md  — No change required
     (specs are technology-agnostic; naming is an implementation
     concern).
  ✅ .specify/templates/tasks-template.md — No change required (the
     Identifier intent rule surfaces as ordinary code-review work
     inside the existing task categorisation).

Deferred TODOs (new in 1.25.0 — code-side migrations):
  ⚠ apps/mobile/src/components/card/useCard.ts — `const state =
     useMemo<CardViewState>(...)` (line 27). Rename to
     `cardViewState` and update the hook's return shape accordingly.
     Trigger file for this amendment; MUST be migrated before any
     follow-up task touches the file.
  ⚠ apps/mobile/src/components/binder-home/useBinderHome.ts —
     `const [state, dispatch] = useReducer(binderHomeReducer, ...)`
     (line 129) and the reducer parameter `state: BinderHomeState`
     (line 46). Rename both to `binderHomeState` so the reducer
     signature reads `(binderHomeState, action) => ...` and the hook
     body reads `const [binderHomeState, dispatch] = useReducer(...)`.
  ⚠ apps/mobile/src/components/binder-home/useBinderHome.ts —
     `(p) => p.cards` short-form callback parameter (line 125).
     Rename to `(page) => page.cards`. Update the JSDoc example at
     `apps/mobile/src/hooks/useCardsInfiniteQuery.ts` line 40 to
     match.
  ⚠ apps/mobile/src/services/auth/googleAuth.ts — `(e) => log.warn(...)`
     JSDoc example (line 55). Rename to `(error) => log.warn(...)`.
  ⚠ apps/server/src/providers/mtgjson/MtgjsonProvider.ts —
     `(c) => c.availability...` (line 78), `(c) => c.toUpperCase()`
     (line 101), `(c) => !commanderColorSet.has(c)` (line 102).
     Rename each to `(card)` / `(color)` per its domain meaning.
  ⚠ apps/server/src/routes/cards.ts — `(c) => c.trim()...` (lines
     177, 206). Rename to `(color) => color.trim()...`.

Carry-over from 1.24.0 (unchanged):
  ⚠ Audit existing `apps/mobile/src/**/*View.test.tsx` files for
    helper-style `renderView` / `renderComponent` functions and
    migrate each to a sibling `<ComponentName>WithDefaults` FC. At
    time of v1.24.0, `BinderHomeView.test.tsx` was the only view
    test in the workspace and already complies; future view tests
    landing in `apps/mobile/src/components/login/`,
    `apps/mobile/src/components/access-denied/`, and
    `apps/mobile/src/components/coming-soon/` MUST follow the v1.24.0
    convention from the first commit.

Carry-over from 1.23.0 (unchanged):
  ⚠ apps/server/src/routes/cards.test.ts — currently seeds the test
     user inline via `dataSource.getRepository(UserEntity).upsert(...)`
     in `beforeAll`. Violates the rule #5 added in v1.23.0. Extract
     the seed into `apps/server/testing/userFactory.ts` exporting
     `createTestUser(dataSource, overrides)` and consume it from the
     test.
  ⚠ apps/server/src/routes/auth.test.ts — currently seeds the
     allowlist row and the test user inline via
     `dataSource.getRepository(AllowedUserEntity).save({ email })`
     and `dataSource.getRepository(UserEntity).upsert(...)`. Violates
     the rule #5 added in v1.23.0. Extract into
     `apps/server/testing/allowedUserFactory.ts` exporting
     `createTestAllowedUser(dataSource, overrides)`, reuse
     `createTestUser` from the user factory, and consume both from
     the test.

Carry-over from 1.22.0 (unchanged):
  ⚠ apps/server/src/routes/docs.test.ts — still uses `jest.mock(...)`
     against modules under `apps/server/src/services/` and
     `apps/server/src/db/`. Violates the Server route test
     conventions sub-section's rules #1-#4 (no service/repository
     mocks; real DataSource; offline-mode SDK; real-data isolation).
     MUST be rewritten as an E2E test against the real services, real
     repositories, the real TypeORM `DataSource`, and the offline-mode
     MTGJSON SDK, AND its data setup MUST go through the factories
     added by rule #5.

Carry-over from 1.21.0 (unchanged):
  ⚠ CLAUDE.md — Stale references to `binderStore` remain at line 50
     (folder structure tree) and line 200 (Active Technologies list).
     The store has been deleted; CLAUDE.md MUST be updated to remove
     the `binderStore` mentions and to note that `currentPage` plus
     search state now live in `useBinderHome.ts`.

Carry-over from 1.20.0 (unchanged):
  ⚠ apps/mobile theme files — the Style co-location rule landed in
     v1.20.0 with `BinderHomeView.theme.ts` as the canonical
     reference. Other view components (LoginView, AccessDeniedView,
     ComingSoonView) MUST migrate inline `StyleSheet.create` blocks
     into sibling `<Component>.theme.ts` files in a follow-up pass.

Carry-over from 1.19.0 (unchanged):
  ⚠ apps/mobile/src/services/auth/googleAuth.ts — uses
     `expo-auth-session/providers/google`, which the Expo docs flag as
     deprecated. Migration is tracked in
     `todo/migrate-google-auth-to-google-signin.md`. Per Principle XI,
     either the migration completes or the deprecated dependency MUST be
     justified in the spec 002 Complexity Tracking table.

Carry-over from 1.17.0 (unchanged):
  ⚠ apps/mobile/package-lock.json — npm lockfile from the create-expo-app
     bootstrap. MUST be deleted and the workspace re-resolved via
     `pnpm install` before merge.
  ⚠ apps/mobile/tsconfig.json — currently declares `paths: { "@/*": ["./*"] }`;
     Principle VII requires `@root/*` and `@src/*` aliases.
  ⚠ apps/mobile/hooks/{use-color-scheme.ts,use-color-scheme.web.ts,
     use-theme-color.ts}, apps/mobile/scripts/reset-project.js,
     apps/mobile/app/modal.tsx — leftover create-expo-app template files
     outside the Principle X four-layer structure.

Carry-over from 1.14.0 (unchanged):
  ⚠ specs/001-server-architecture/plan.md — JSDoc → TypeScript migration.
  ⚠ specs/004-card-data-provider/plan.md — JSDoc → TypeScript migration.
-->

<!-- PREVIOUS SYNC IMPACT REPORT (v1.23.0 → v1.24.0) follows for archival reference.
==================
Version change: 1.23.0 → 1.24.0
Bump type: MINOR — adds a new "Mobile view test conventions" sub-
  section to Principle III (Test-First Development), placed
  immediately after "Mobile mocking conventions" and before "Server
  route test conventions". The sub-section codifies two new
  non-negotiable rules for `apps/mobile` view tests:

    1. `render(...)` from `@testing-library/react-native` MUST be
       called inside an `it(...)` block — never at module scope,
       never inside a `describe`, never inside `beforeAll` /
       `beforeEach` / `afterEach`, and never inside a top-of-file
       helper function such as a `renderView({...overrides})` wrapper
       that the suite calls from every test. The render call is the
       observable starting point of each test and MUST sit at the
       top of the `it` block so the reader sees what was rendered
       without chasing through a helper.
    2. When a view's props need a default baseline that individual
       tests vary, the test file MUST declare a `<ComponentName>WithDefaults`
       function component at module scope (after the props-defaults
       object) typed as `FC<Partial<<ComponentName>Props>>`. The
       component spreads the defaults over the production view and
       then spreads its incoming `overrides` on top. Tests render
       this component directly — `render(<<ComponentName>WithDefaults
       cards={[...]} isLoading />)` — never via an indirection helper.

  The canonical reference is
  `apps/mobile/src/components/binder-home/BinderHomeView.test.tsx`
  (spec 016), where `BinderViewWithDefaults: FC<Partial<BinderHomeViewProps>>`
  wraps `BinderHomeView` with the suite's prop defaults and every
  `it` block invokes `render(<BinderViewWithDefaults ... />)`
  inline. The pattern replaces the older "helper render function"
  shape (`const renderView = (overrides) => render(<View
  {...defaults} {...overrides} />)`) that hides the rendered JSX
  behind a function call, decouples test intent from the component
  shape, and makes it impossible to grep for the actual JSX the
  view receives.

  The trigger was the spec 016 binder-home test cleanup. The first
  pass replaced an outdated `renderView` helper with the
  `BinderViewWithDefaults` component but the wider convention
  remained unwritten — leaving every future view test free to
  reintroduce the helper pattern. Codifying the rule now turns the
  helper-style render into a constitution breach catchable at
  review and pins the `ComponentWithDefaults` shape as the only
  permitted way to share prop defaults across a view test file.

  No principle is removed or redefined; no version-pin language is
  altered. The rule applies only to `apps/mobile` view tests
  (`render` from `@testing-library/react-native`); hook tests via
  `renderHook` are unaffected and may continue to call `renderHook`
  from `beforeEach` or test helpers as needed (the call signature
  there is `() => useHook(args)`, not JSX, and the equivalent
  defaults pattern does not apply).

Last amended: 2026-05-16

Added principles:
  (none — Principle III expanded, not added)

Modified sections:
  - Principle III. Test-First Development — added "Mobile view test
    conventions" sub-section between "Mobile mocking conventions"
    and "Server route test conventions".

Removed sections:
  (none)

Templates reviewed:
  ✅ .specify/templates/plan-template.md  — Unit Testing Phase
     "Mobile mocks" callout extended with a sibling "Mobile view
     tests" callout requiring that every new or updated
     `apps/mobile/src/components/**/*View.test.tsx` file (a) call
     `render(...)` only inside `it(...)` blocks and (b) declare a
     `<ComponentName>WithDefaults: FC<Partial<<ComponentName>Props>>`
     at module scope when prop defaults need to be shared across
     the suite.
  ✅ .specify/templates/spec-template.md  — No change required
     (specs are technology-agnostic).
  ✅ .specify/templates/tasks-template.md — No change required
     (the `ComponentWithDefaults` pattern is a code-author
     decision; it surfaces as ordinary test-file work in the
     existing task categorisation).

Deferred TODOs:
  - Audit existing `apps/mobile/src/**/*View.test.tsx` files for
    helper-style `renderView` / `renderComponent` functions and
    migrate each to a sibling `<ComponentName>WithDefaults` FC. At
    time of amendment, `BinderHomeView.test.tsx` is the only view
    test in the workspace and already complies; future view tests
    landing in `apps/mobile/src/components/login/`,
    `apps/mobile/src/components/access-denied/`, and
    `apps/mobile/src/components/coming-soon/` MUST follow the new
    convention from the first commit.

Carry-over from 1.23.0 (unchanged):
  ⚠ apps/server/src/routes/cards.test.ts — currently seeds the test
     user inline via `dataSource.getRepository(UserEntity).upsert(...)`
     in `beforeAll`. Violates the rule #5 added in v1.23.0. Carried
     forward: extract the seed into
     `apps/server/testing/userFactory.ts` exporting
     `createTestUser(dataSource, overrides)` and consume it from the
     test.
  ⚠ apps/server/src/routes/auth.test.ts — currently seeds the
     allowlist row and the test user inline via
     `dataSource.getRepository(AllowedUserEntity).save({ email })`
     and `dataSource.getRepository(UserEntity).upsert(...)`. Violates
     the rule #5 added in v1.23.0. Carried forward: extract into
     `apps/server/testing/allowedUserFactory.ts` exporting
     `createTestAllowedUser(dataSource, overrides)`, reuse
     `createTestUser` from the user factory, and consume both from
     the test.

Carry-over from 1.22.0 (unchanged):
  ⚠ apps/server/src/routes/docs.test.ts — still uses `jest.mock(...)`
     against modules under `apps/server/src/services/` and
     `apps/server/src/db/`. Violates the Server route test
     conventions sub-section's rules #1-#4 (no service/repository
     mocks; real DataSource; offline-mode SDK; real-data isolation).
     MUST be rewritten as an E2E test against the real services, real
     repositories, the real TypeORM `DataSource`, and the offline-mode
     MTGJSON SDK, AND its data setup MUST go through the factories
     added by rule #5.

Carry-over from 1.21.0 (unchanged):
  ⚠ CLAUDE.md — Stale references to `binderStore` remain at line 50
     (folder structure tree) and line 200 (Active Technologies list).
     The store has been deleted; CLAUDE.md MUST be updated to remove
     the `binderStore` mentions and to note that `currentPage` plus
     search state now live in `useBinderHome.ts`.

Carry-over from 1.20.0 (unchanged):
  ⚠ apps/mobile theme files — the Style co-location rule landed in
     v1.20.0 with `BinderHomeView.theme.ts` as the canonical
     reference. Other view components (LoginView, AccessDeniedView,
     ComingSoonView) MUST migrate inline `StyleSheet.create` blocks
     into sibling `<Component>.theme.ts` files in a follow-up pass.

Carry-over from 1.19.0 (unchanged):
  ⚠ apps/mobile/src/services/auth/googleAuth.ts — uses
     `expo-auth-session/providers/google`, which the Expo docs flag as
     deprecated. Migration is tracked in
     `todo/migrate-google-auth-to-google-signin.md`. Per Principle XI,
     either the migration completes or the deprecated dependency MUST be
     justified in the spec 002 Complexity Tracking table.

Carry-over from 1.17.0 (unchanged):
  ⚠ apps/mobile/package-lock.json — npm lockfile from the create-expo-app
     bootstrap. MUST be deleted and the workspace re-resolved via
     `pnpm install` before merge.
  ⚠ apps/mobile/tsconfig.json — currently declares `paths: { "@/*": ["./*"] }`;
     Principle VII requires `@root/*` and `@src/*` aliases.
  ⚠ apps/mobile/hooks/{use-color-scheme.ts,use-color-scheme.web.ts,
     use-theme-color.ts}, apps/mobile/scripts/reset-project.js,
     apps/mobile/app/modal.tsx — leftover create-expo-app template files
     outside the Principle X four-layer structure.

Carry-over from 1.14.0 (unchanged):
  ⚠ specs/001-server-architecture/plan.md — JSDoc → TypeScript migration.
  ⚠ specs/004-card-data-provider/plan.md — JSDoc → TypeScript migration.
-->

<!-- PREVIOUS SYNC IMPACT REPORT (v1.22.0 → v1.23.0) follows for archival reference.
==================
Version change: 1.22.0 → 1.23.0
Bump type: MINOR — extends the "Server route test conventions" sub-
  section of Principle III (Test-First Development) with a new rule
  requiring that every entity seeded by a route test be inserted
  through a named factory function exported from
  `apps/server/testing/<entity>Factory.ts`. The rule strengthens the
  existing "Per-test isolation via real data, not mocks" rule by
  specifying *how* that real data must be constructed:

    - Inline `dataSource.getRepository(...).save(...)` calls inside a
      route test file are prohibited.
    - Raw `INSERT` SQL inside a route test file is prohibited.
    - One-off seed helpers declared at the top of a test file are
      prohibited.
    - Every required entity MUST go through a factory under
      `apps/server/testing/` accepting a `Partial<Overrides>` argument,
      returning the persisted entity, defaulting every unspecified
      field to a deterministic value, and writing through the
      production repository or `dataSource.getRepository(...)`.
    - If a needed factory does not yet exist, the feature plan MUST
      include a task to create it before any task that depends on the
      seed. Skipping the factory because "we'll extract it later" is a
      constitution breach.

  The trigger was the consolidation of the server test-database setup
  into `apps/server/testing/testDatabase.ts` during the spec 016
  binder-home cleanup, which surfaced a parallel gap: `cards.test.ts`
  and `auth.test.ts` still seeded users and allowed-users via inline
  `dataSource.getRepository(UserEntity).upsert(...)` calls, drifting
  schema defaults across files. Codifying the factory convention turns
  the inline pattern into a constitution breach catchable by review
  and aligns server-side route tests with the offline-mode SDK and
  shared `connectTestDatabase()` helpers that already live next to
  them in the `testing/` directory.

  The new rule lands as rule #5 of the "Server route test
  conventions" sub-section, immediately after "Per-test isolation via
  real data, not mocks" (rule #4) and before what was previously rule
  #5 ("Unit tests for services and repositories live separately"),
  which is renumbered to #6. No principle is removed or redefined; no
  version-pin language is altered. The rule applies only to
  `apps/server`; `apps/mobile` and `packages/core` are unaffected.

Last amended: 2026-05-16

Added principles:
  (none — Principle III expanded, not added)

Modified sections:
  - Principle III. Test-First Development — added rule #5 "Test data
    MUST be seeded via factories in `apps/server/testing/`" to the
    "Server route test conventions" sub-section; renumbered the prior
    rule #5 ("Unit tests for services and repositories live
    separately") to #6.

Removed sections:
  (none)

Templates reviewed:
  ✅ .specify/templates/plan-template.md  — Unit Testing Phase
     "Server route tests" callout amended to require that every
     persisted entity used by a route test be seeded through a
     factory under `apps/server/testing/`, and that any missing
     factory be listed as an explicit plan task before the test that
     consumes it.
  ✅ .specify/templates/spec-template.md  — No change required (specs
     are technology-agnostic).
  ✅ .specify/templates/tasks-template.md — No change required (the
     factory requirement surfaces as ordinary plan tasks; tasks
     categorisation is unchanged).
  ⚠ apps/server/src/routes/cards.test.ts — currently seeds the test
     user inline via `dataSource.getRepository(UserEntity).upsert(...)`
     in `beforeAll`. Violates the new rule #5. Carried forward as a
     deferred TODO: extract the seed into
     `apps/server/testing/userFactory.ts` exporting
     `createTestUser(dataSource, overrides)` and consume it from the
     test.
  ⚠ apps/server/src/routes/auth.test.ts — currently seeds the
     allowlist row and the test user inline via
     `dataSource.getRepository(AllowedUserEntity).save({ email })`
     and `dataSource.getRepository(UserEntity).upsert(...)`. Violates
     the new rule #5. Carried forward as a deferred TODO: extract
     into `apps/server/testing/allowedUserFactory.ts` exporting
     `createTestAllowedUser(dataSource, overrides)`, reuse
     `createTestUser` from the user factory, and consume both from
     the test.

Carry-over from 1.22.0 (unchanged):
  ⚠ apps/server/src/routes/docs.test.ts — still uses `jest.mock(...)`
     against modules under `apps/server/src/services/` and
     `apps/server/src/db/`. Violates the Server route test
     conventions sub-section's rules #1-#4 (no service/repository
     mocks; real DataSource; offline-mode SDK; real-data isolation).
     MUST be rewritten as an E2E test against the real services, real
     repositories, the real TypeORM `DataSource`, and the offline-mode
     MTGJSON SDK, AND its data setup MUST go through the new
     factories per rule #5.

Carry-over from 1.22.0 (unchanged):
  ⚠ apps/server/src/routes/docs.test.ts (and the broader auth.test.ts /
     cards.test.ts rewrite tracked separately): the 1.22.0 directive to
     drop service/repository mocks and run route tests against the real
     pipeline remains in force. `cards.test.ts` and `auth.test.ts` are
     now real-DataSource tests; `docs.test.ts` still violates rules
     #1-#4 and must be rewritten.

Carry-over from 1.21.0 (unchanged):
  ⚠ CLAUDE.md — Stale references to `binderStore` remain at line 50
     (folder structure tree) and line 200 (Active Technologies list).
     The store has been deleted; CLAUDE.md MUST be updated to remove
     the `binderStore` mentions and to note that `currentPage` plus
     search state now live in `useBinderHome.ts`.

Carry-over from 1.20.0 (unchanged):
  ⚠ apps/mobile theme files — the Style co-location rule landed in
     v1.20.0 with `BinderHomeView.theme.ts` as the canonical
     reference. Other view components (LoginView, AccessDeniedView,
     ComingSoonView) MUST migrate inline `StyleSheet.create` blocks
     into sibling `<Component>.theme.ts` files in a follow-up pass.

Carry-over from 1.19.0 (unchanged):
  ⚠ apps/mobile/src/services/auth/googleAuth.ts — uses
     `expo-auth-session/providers/google`, which the Expo docs flag as
     deprecated. Migration is tracked in
     `todo/migrate-google-auth-to-google-signin.md`. Per Principle XI,
     either the migration completes or the deprecated dependency MUST be
     justified in the spec 002 Complexity Tracking table.

Carry-over from 1.17.0 (unchanged):
  ⚠ apps/mobile/package-lock.json — npm lockfile from the create-expo-app
     bootstrap. MUST be deleted and the workspace re-resolved via
     `pnpm install` before merge.
  ⚠ apps/mobile/tsconfig.json — currently declares `paths: { "@/*": ["./*"] }`;
     Principle VII requires `@root/*` and `@src/*` aliases.
  ⚠ apps/mobile/hooks/{use-color-scheme.ts,use-color-scheme.web.ts,
     use-theme-color.ts}, apps/mobile/scripts/reset-project.js,
     apps/mobile/app/modal.tsx — leftover create-expo-app template files
     outside the Principle X four-layer structure.

Carry-over from 1.14.0 (unchanged):
  ⚠ specs/001-server-architecture/plan.md — JSDoc → TypeScript migration.
  ⚠ specs/004-card-data-provider/plan.md — JSDoc → TypeScript migration.

Deferred TODOs:
  - Create `apps/server/testing/userFactory.ts` exporting
    `createTestUser(dataSource, overrides)` and refactor
    `apps/server/src/routes/cards.test.ts` and
    `apps/server/src/routes/auth.test.ts` to seed via it instead of
    inline `dataSource.getRepository(UserEntity).upsert(...)`.
  - Create `apps/server/testing/allowedUserFactory.ts` exporting
    `createTestAllowedUser(dataSource, overrides)` and refactor
    `apps/server/src/routes/auth.test.ts` to seed the allowlist via
    it instead of inline `dataSource.getRepository(AllowedUserEntity).save(...)`.
  - Rewrite `apps/server/src/routes/docs.test.ts` to comply with the
    Server route test conventions sub-section (rules #1-#5): drop
    `jest.mock(...)` against `@src/services/*` / `@src/db/repositories`
    / `@src/auth/*`, initialise the real `DataSource` via
    `connectTestDatabase()`, register the offline-mode MTGJSON SDK as
    the active provider, seed any required entities via the new
    factories, and clean up in `afterAll`.
  - Update CLAUDE.md to remove `binderStore` references at lines 50
    and 200, reflecting that `currentPage` plus search state now live
    in `useBinderHome.ts` per the State locality rule introduced in
    v1.21.0.
-->

<!-- PREVIOUS SYNC IMPACT REPORT (v1.20.0 → v1.21.0) follows for archival reference.
==================
Version change: 1.20.0 → 1.21.0
Bump type: MINOR — lands the previously-deferred "State locality rule"
  sub-section in the body of Principle X (Component Architecture —
  Mobile). The rule was drafted in the superseded 1.19.0 → 1.20.0 SIR
  but never inserted; v1.20.0 carried it forward as a deferred TODO;
  this amendment fulfils that TODO. The rule pins a strict hierarchy
  for every state field introduced in `apps/mobile`:

    1. Single-consumer state — read or written by exactly one
       component — MUST live inside that component's `use<Feature>.ts`
       hook via `useState` (simple values) or `useReducer` (non-trivial
       transitions). Lifting single-consumer state into a Zustand
       store under `apps/mobile/src/stores/` is prohibited.
    2. Multi-component state shared across unrelated consumers —
       components that do not sit in a parent → descendant relationship
       — MUST live in a Zustand store under `apps/mobile/src/stores/`.
       The active session is the canonical example.
    3. Parent → descendant shared state MUST stay in the parent's hook
       and flow downward through props (or a feature-scoped React
       context when prop-drilling exceeds three levels). Promotion to a
       Zustand store is permitted only when an additional unrelated
       consumer appears.

  The trigger was the binder-home refactor (spec 016) moving
  `currentPage` and search state out of `binderStore` and into
  `useBinderHome.ts` after the page indicator was collocated inside the
  binder view, leaving the store with a single consumer. The deletion
  of `apps/mobile/src/stores/binderStore.ts` exposed the unwritten
  convention this amendment now codifies: Zustand is reserved for
  genuinely shared state, never for hook-local state lifted "in case"
  another component needs it later.

  No principle is removed or redefined. The State locality rule sits
  immediately after the Hook return-value memoisation rule and before
  the `useEffect` usage discipline sub-section because all three govern
  hook-implementation patterns. The rule applies only to `apps/mobile`;
  `apps/server` and `packages/core` have no React state surface.

Last amended: 2026-05-11

Added principles:
  (none — Principle X expanded, not added)

Modified sections:
  - Principle X. Component Architecture (Mobile) — added "State
    locality rule" sub-section between the Hook return-value
    memoisation rule and the `useEffect` usage discipline sub-section.

Removed sections:
  (none)

Templates reviewed:
  ✅ .specify/templates/plan-template.md  — No change required. The
     Constitution Check section is principle-agnostic; new mobile
     features pull Principle X (including the new sub-section)
     automatically. State-management decisions surface in the existing
     "Project Structure / Source Code" sections of each plan.
  ✅ .specify/templates/spec-template.md  — No change required (specs
     are technology-agnostic).
  ✅ .specify/templates/tasks-template.md — No change required (state
     placement is a code-author decision, not a task category).
  ⚠ CLAUDE.md — Stale references to `binderStore` remain at line 50
     (folder structure tree) and line 200 (Active Technologies list).
     The store has been deleted; CLAUDE.md MUST be updated to remove
     the `binderStore` mentions and to note that `currentPage` plus
     search state now live in `useBinderHome.ts`. Carried forward as a
     deferred TODO.

Carry-over from 1.20.0 (unchanged):
  ⚠ apps/mobile theme files — the Style co-location rule landed in
     v1.20.0 with `BinderHomeView.theme.ts` as the canonical
     reference. Other view components (LoginView, AccessDeniedView,
     ComingSoonView) MUST migrate inline `StyleSheet.create` blocks
     into sibling `<Component>.theme.ts` files in a follow-up pass.

Carry-over from 1.19.0 (unchanged):
  ⚠ apps/mobile/src/services/auth/googleAuth.ts — uses
     `expo-auth-session/providers/google`, which the Expo docs flag as
     deprecated. Migration is tracked in
     `todo/migrate-google-auth-to-google-signin.md`. Per Principle XI,
     either the migration completes or the deprecated dependency MUST be
     justified in the spec 002 Complexity Tracking table.

Carry-over from 1.17.0 (unchanged):
  ⚠ apps/mobile/package-lock.json — npm lockfile from the create-expo-app
     bootstrap. MUST be deleted and the workspace re-resolved via
     `pnpm install` before merge.
  ⚠ apps/mobile/tsconfig.json — currently declares `paths: { "@/*": ["./*"] }`;
     Principle VII requires `@root/*` and `@src/*` aliases.
  ⚠ apps/mobile/hooks/{use-color-scheme.ts,use-color-scheme.web.ts,
     use-theme-color.ts}, apps/mobile/scripts/reset-project.js,
     apps/mobile/app/modal.tsx — leftover create-expo-app template files
     outside the Principle X four-layer structure.

Carry-over from 1.14.0 (unchanged):
  ⚠ specs/001-server-architecture/plan.md — JSDoc → TypeScript migration.
  ⚠ specs/004-card-data-provider/plan.md — JSDoc → TypeScript migration.

Deferred TODOs:
  - Update CLAUDE.md to remove `binderStore` references at lines 50
    and 200, reflecting that `currentPage` plus search state now live
    in `useBinderHome.ts` per the new State locality rule.
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

**Test framework**: **Jest** is the chosen unit testing library across every workspace in
the monorepo. New unit and integration tests MUST be written with Jest. TypeScript sources
MUST be compiled with `ts-jest`. Alternative Jest-compatible runners (Vitest, Mocha, AVA,
node:test) are NOT permitted — alignment on a single tool eliminates configuration drift
between workspaces and keeps coverage tooling, mocking conventions, and CI invocation
identical everywhere.

The per-workspace Jest presets are pinned as follows:

- **`apps/server`**: `ts-jest` (Node test environment).
- **`apps/mobile`**: **`jest-expo`** preset (SDK 54-compatible release), with
  **`@testing-library/react-native` 13.x** for view rendering and `renderHook` for hook
  tests.
- **`packages/core`**: `ts-jest` (Node test environment); pure TypeScript module under test.

Switching any of the above to a different preset or test library requires a fresh
constitution amendment.

**Plan requirement**: Every feature plan (`specs/<feature>/plan.md`) MUST include an
explicit **Unit Testing Phase** section that identifies:

- Which Jest test files will be created or updated, with full paths.
- The behaviours each test file will cover (one bullet per behaviour, mapped back to the
  feature's functional requirements where applicable).
- A coverage target for the new code introduced by the feature (line and branch
  percentages, expressed as a Jest `coverageThreshold` or equivalent).

A plan that omits the Unit Testing Phase MUST NOT proceed to task generation
(`/speckit.tasks`). The Unit Testing Phase complements — but does not replace — Phase 0
research or Phase 1 design artifacts.

**Test co-location rule**: Unit and integration tests MUST live in the same directory as
the file they test, named `<filename>.test.ts`. For example, `src/services/cardService.ts`
MUST be tested by `src/services/cardService.test.ts`. The only exception is **E2E tests**,
which MUST live in a dedicated `tests/e2e/` directory at the workspace root (since they
exercise the full system, not a single file). No other `tests/` directories are permitted.

Rationale: co-located tests are discovered immediately alongside the code they cover, making
it obvious when a file has no test and preventing tests from becoming detached from the module
they exercise when files are moved or renamed. Pinning Jest as the single test runner avoids
the per-workspace tooling drift (separate matchers, separate mocks, separate coverage
formats) that accumulates when each package picks its own framework. Requiring an explicit
Unit Testing Phase in every plan makes the test surface visible at design time rather than
at implementation time, when scope creep has already happened.

**Mobile mocking conventions** (`apps/mobile`). Tests in `apps/mobile` run under the
`jest-expo` preset against React Native and Expo modules that have no implementation in a
Node test environment. Mocks are split between two scopes; mixing them or re-implementing
either scope inside the other is prohibited.

1. **Module-level defaults in `apps/mobile/jest.setup.ts`.** Every third-party native or
   Expo module that the production code imports MUST have a single default mock declared
   at the top of `jest.setup.ts`. The mock MUST cover every method and constant the
   production code reads. The currently-required entries are:

   - `react-native-reanimated` → the official `react-native-reanimated/mock` shim.
   - `expo-secure-store` → all of `getItemAsync`, `setItemAsync`, `deleteItemAsync`, plus
     the `WHEN_UNLOCKED` / `WHEN_UNLOCKED_THIS_DEVICE_ONLY` constants.
   - `@react-native-google-signin/google-signin` → the full `GoogleSignin` surface
     (`configure`, `hasPlayServices`, `signIn`, `signOut`, `revokeAccess`,
     `getCurrentUser`, `getTokens`) and the `statusCodes` enum.
   - `expo-constants` → an `expoConfig.extra` object with deterministic test client IDs
     and API base URL.
   - `expo-router` → `Redirect`, `Stack` (with `Stack.Screen`), `Tabs` (with
     `Tabs.Screen`), `useRouter`, and `usePathname` — enough to render any layout file in
     a unit test without a real router.

   Adding a new native or Expo dependency to `apps/mobile/package.json` MUST land the
   matching mock entry in `jest.setup.ts` *in the same PR*. A test that fails because a
   module mock is missing is a constitution breach against this rule, not a test bug.

2. **Per-test spies via `jest.spyOn`.** Inside each `describe` block, individual tests
   layer call-shape assertions on top of the default mock by spying the already-mocked
   method. The spies MUST follow this shape:

   - **Typed.** Declare each spy as
     `jest.SpyInstance<ReturnType<typeof Module.method>>` so a renamed method or changed
     signature surfaces at `tsc` time, not at runtime.
   - **Installed in `beforeEach`.** Spies are created in a single `beforeEach` per
     `describe`, never at the top of the file or inside individual `it` blocks. This
     gives every test a fresh call history without manual `mockClear` plumbing.
   - **Restored only when behaviour was replaced.** A spy that only observes (no
     `mockImplementation` / `mockResolvedValue`) does not need `mockRestore`. A spy that
     replaces behaviour MUST restore in `afterEach` so the default from `jest.setup.ts`
     comes back for the next test.

   Per-test `jest.mock(...)` calls inside test files are prohibited. If the default mock
   from `jest.setup.ts` does not match a specific test's needs, override the relevant
   method on the shared mock via `mockImplementation` / `mockResolvedValue` /
   `mockRejectedValue` rather than re-mocking the module wholesale.

The compliant pattern (canonical reference:
`apps/mobile/src/services/auth/googleAuth.test.ts`):

```ts
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { renderHook } from '@testing-library/react-native';
import { useGoogleAuthRequest, revokeGoogleGrant } from './googleAuth';

describe('googleAuth', () => {
  let mockedSignIn: jest.SpyInstance<ReturnType<typeof GoogleSignin.signIn>>;
  let mockedRevoke: jest.SpyInstance<ReturnType<typeof GoogleSignin.revokeAccess>>;

  beforeEach(() => {
    mockedSignIn = jest.spyOn(GoogleSignin, 'signIn');
    mockedRevoke = jest.spyOn(GoogleSignin, 'revokeAccess');
  });

  it('invokes GoogleSignin.signIn from the hook', async () => {
    const { result } = renderHook(() => useGoogleAuthRequest());
    await result.current();
    expect(mockedSignIn).toHaveBeenCalledWith();
  });

  it('revokes via GoogleSignin.revokeAccess', async () => {
    await revokeGoogleGrant('access-token');
    expect(mockedRevoke).toHaveBeenCalledWith();
  });
});
```

The prohibited patterns are:

```ts
// PROHIBITED — re-mocking a module that already has a default in jest.setup.ts.
//              The two mocks fight each other and the resulting behaviour is order-
//              dependent.
jest.mock('@react-native-google-signin/google-signin', () => ({ /* ... */ }));

// PROHIBITED — untyped spy. A renamed `signIn` method or a changed return shape
//              compiles cleanly and surfaces only when the test actually runs.
const mockedSignIn = jest.spyOn(GoogleSignin, 'signIn');

// PROHIBITED — spy installed at describe-level. The single instance bleeds call
//              history across `it` blocks and ties test correctness to file order.
describe('googleAuth', () => {
  const mockedSignIn = jest.spyOn(GoogleSignin, 'signIn');
  // ...
});

// PROHIBITED — manual mockClear inside a single `it` block. The beforeEach hook
//              already does this for the whole suite; manual clears mask the very
//              state-bleed bugs the gate is designed to surface.
it('signs in', () => {
  mockedSignIn.mockClear();
  // ...
});
```

Hook tests MUST use `renderHook` from `@testing-library/react-native` (not the older
`@testing-library/react-hooks`, which is unmaintained for RN 0.81 / React 19). View
tests MUST use the `render` export from the same package. No other render utility is
permitted in `apps/mobile`.

Rationale: declaring native and Expo mocks once in `jest.setup.ts` gives every suite a
consistent baseline — a hook's collaborators behave identically across unit, view, and
integration tests, and adding a method to a native module requires editing exactly one
place. Per-test typed spies layered on top of those baselines let individual tests assert
call shape without redefining the mock, and typing each spy with
`jest.SpyInstance<ReturnType<typeof ...>>` ties the test to the production type
contract so a renamed method or changed signature is caught at `tsc` time. Forbidding
in-file `jest.mock(...)` keeps the global mock surface auditable from a single file —
when a future engineer asks "what does Jest think `expo-secure-store` is?" the answer
is always "look at `jest.setup.ts`," never "grep every `*.test.ts`."

**Mobile view test conventions** (`apps/mobile/src/components/**/*View.test.tsx`).
A view test in `apps/mobile` exercises a single presentational React component
(per Principle X's four-layer structure, the View layer). Every such test MUST
follow the two rules below. They are non-negotiable and apply to every existing
and new view test file under `apps/mobile/src/components/**/*View.test.tsx`.

1. **`render(...)` MUST be called inside an `it(...)` block — never elsewhere.**
   The `render` export from `@testing-library/react-native` is the observable
   starting point of each view test and MUST sit at the top of the `it`
   block whose behaviour it underpins. Calling `render(...)` at module scope,
   inside a `describe`, inside `beforeAll` / `beforeEach` / `afterEach`, or
   inside a top-of-file helper function (the typical
   `const renderView = (overrides) => render(<View {...defaults} {...overrides} />)`
   shape) is prohibited. A reader scanning an `it` block MUST be able to see
   exactly what JSX was rendered without chasing through a helper or a
   per-suite fixture. `renderHook` from the same package is unaffected by
   this rule — its argument is a callback, not JSX, and the equivalent
   defaults pattern below does not apply to it.

2. **Shared prop defaults MUST live in a `<ComponentName>WithDefaults` FC
   declared at module scope.** When a view's props need a baseline that
   individual tests vary (the common case for `apps/mobile/src/components/<feature>/<Feature>View.tsx`
   components), the test file MUST:

   - Declare a `defaults: <ComponentName>Props` object at module scope
     holding the baseline prop values for the suite. `jest.fn()` placeholders
     for callbacks live here.
   - Declare a `<ComponentName>WithDefaults: FC<Partial<<ComponentName>Props>>`
     component, also at module scope, defined as
     `(overrides) => <<ComponentName> {...defaults} {...overrides} />`. It
     MUST be typed with React's `FC` generic from `react` (per Principle X's
     FC declaration rule) and MUST accept a `Partial<<ComponentName>Props>`
     argument so each test pins only the props it asserts on.
   - In every `it(...)` block, render the wrapper directly:
     `const screen = render(<<ComponentName>WithDefaults cards={[...]} isLoading />)`.
     Passing overrides as ordinary JSX props (not a single `overrides`
     object) keeps the test readable as a snapshot of how the production
     component is actually instantiated and lets `tsc` enforce the prop
     contract at the call site.

   Wrapper helpers that are *functions* rather than components
   (`const renderView = (overrides) => render(...)`,
   `const makeView = (props) => render(...)`, or any factory that returns
   the `render` result) are prohibited under rule #1. The wrapper is a
   real React component — not a wrapper around `render`.

The compliant pattern (canonical reference:
`apps/mobile/src/components/binder-home/BinderHomeView.test.tsx`):

```tsx
import type { FC } from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import BinderHomeView, { type BinderHomeViewProps } from './BinderHomeView';

const defaults: BinderHomeViewProps = {
  cards: [],
  matchedCards: [],
  currentPage: 1,
  totalPages: 1,
  summaryCaption: '0 CARDS · 1 PAGE',
  isLoading: false,
  isError: false,
  // ...the rest of the props…
  onProfilePress: jest.fn(),
  onSearchOpen: jest.fn(),
  // …callbacks default to jest.fn()…
};

const BinderViewWithDefaults: FC<Partial<BinderHomeViewProps>> = (overrides) => (
  <BinderHomeView {...defaults} {...overrides} />
);

describe('BinderHomeView — US1 surface', () => {
  it('tapping Profile fires onProfilePress', () => {
    const onProfilePress = jest.fn();
    const screen = render(
      <BinderViewWithDefaults onProfilePress={onProfilePress} />,
    );
    fireEvent.press(screen.getByLabelText('Open profile'));
    expect(onProfilePress).toHaveBeenCalled();
  });

  it('renders the loading state with 9 empty pockets', () => {
    const screen = render(<BinderViewWithDefaults isLoading />);
    expect(screen.getAllByTestId('pocket-empty').length).toBe(9);
  });
});
```

The prohibited patterns are:

```tsx
// PROHIBITED — helper function that wraps render. Hides the rendered JSX
//              behind a function call, decouples test intent from the
//              component shape, and makes it impossible to grep for what
//              the view actually receives.
const renderView = (overrides: Partial<BinderHomeViewProps> = {}) =>
  render(<BinderHomeView {...defaults} {...overrides} />);

it('renders the masthead', () => {
  const screen = renderView({ cards: [makeCard('1', 'A')] });
  expect(screen.getByText('MY-BINDER')).toBeTruthy();
});

// PROHIBITED — render called at module / describe scope. The component
//              tree is built once and shared across tests, so state
//              bleeds between `it` blocks and a single test failure
//              cascades through the suite.
const sharedScreen = render(<BinderHomeView {...defaults} />);
describe('BinderHomeView', () => {
  it('renders the masthead', () => {
    expect(sharedScreen.getByText('MY-BINDER')).toBeTruthy();
  });
});

// PROHIBITED — render called from beforeEach. The render result lands in
//              a `let` outside any `it`, hiding the rendered JSX from the
//              test body and tying assertions to setup ordering.
let screen: ReturnType<typeof render>;
beforeEach(() => {
  screen = render(<BinderHomeView {...defaults} />);
});
it('renders the masthead', () => {
  expect(screen.getByText('MY-BINDER')).toBeTruthy();
});

// PROHIBITED — untyped wrapper without the `FC<Partial<Props>>` signature.
//              Overrides drift away from the production prop contract;
//              renaming a prop on the production view compiles cleanly
//              and surfaces only at test runtime.
const BinderViewWithDefaults = (overrides: any) => (
  <BinderHomeView {...defaults} {...overrides} />
);

// PROHIBITED — passing overrides as a single object rather than JSX props.
//              Defeats the type contract at the call site and makes the
//              test read like an opaque payload instead of a component
//              instantiation.
const BinderViewWithDefaults: FC<{ overrides: Partial<BinderHomeViewProps> }> =
  ({ overrides }) => <BinderHomeView {...defaults} {...overrides} />;

it('renders the masthead', () => {
  const screen = render(
    <BinderViewWithDefaults overrides={{ cards: [makeCard('1', 'A')] }} />,
  );
  // …
});
```

Rationale: a view test's job is to prove the *production component* renders
the expected output for a given set of props. The closer the test reads to
the way the component is actually instantiated in `apps/mobile/src/components/<feature>/<Feature>Container.tsx`,
the easier it is to (a) confirm the test is asserting what it claims, (b)
spot when a prop was renamed or removed, and (c) refactor the component
without rewriting every test. A `renderView` helper inverts that property —
it forces the reader to alt-tab between the `it` body and the helper to
understand what JSX was actually rendered, and it lets the helper drift out
of sync with the production prop contract because the helper's `overrides`
parameter is usually untyped or weakly typed. A `<ComponentName>WithDefaults`
component, by contrast, *is* a React component — `tsc` enforces the prop
shape at every render call, the JSX `<MyViewWithDefaults isLoading />`
reads the same as production code, and adding a new required prop to the
production view immediately surfaces as a compile error in `defaults` and
every consumer at once. Pinning the `render` call inside each `it` block
completes the picture: a future engineer reading any single test can see
the entire setup-act-assert flow without scrolling.

**Server route test conventions** (`apps/server/src/routes/**/*.test.ts`). Fastify
route tests are **end-to-end tests** of the full request pipeline. Each route test
MUST exercise the inbound parser, the route handler, the service layer, the
repository layer, and the real database (or the real MTGJSON SDK in offline mode)
exactly as production does. Mocking the layers below the handler defeats the purpose
of the test — a route test that mocks `cardService` or `cardRepository` proves only
that the handler calls the function it was wired to, not that the request actually
flows end-to-end against the real schema and the real provider data. The following
rules are non-negotiable.

1. **No mocking of services or repositories.** A route test under
   `apps/server/src/routes/**/*.test.ts` MUST NOT call `jest.mock(...)` against any
   module under `apps/server/src/services/`,
   `apps/server/src/repositories/`, or `apps/server/src/db/repositories.ts`, and
   MUST NOT use `jest.spyOn` to replace the behaviour of any function exported from
   those modules. The service and repository implementations the route would call in
   production MUST execute in the test exactly as they execute in production.
   `jest.spyOn` is permitted only as a passive call-shape observer (no
   `mockImplementation` / `mockResolvedValue` / `mockRejectedValue`) and only on
   modules outside the services/repositories tree.

2. **Database initialisation is mandatory** for any route whose handler chain reads
   or writes the database. Each affected test file MUST initialise the real TypeORM
   `DataSource` via `initDataSource(...)` in a `beforeAll` hook pointing at the test
   Postgres instance and MUST tear it down in `afterAll` via `getDataSource().destroy()`.
   Tests MUST NOT skip initialisation, swap in an in-memory shim, or stub the
   `DataSource` instance. A handler that throws `"DataSource not initialised. Call
   initDataSource() first."` at test time is a missing `beforeAll`, never a signal
   to mock the data source.

3. **MTGJSON SDK in offline mode is mandatory** for any route whose handler chain
   resolves cards. Each affected test file MUST create the SDK with
   `MtgjsonSDK.create({ cacheDir, offline: true })` against
   `apps/server/data/mtgjson-cache` in `beforeAll`, wrap the SDK in
   `MtgjsonProvider`, register the provider in the shared `ProviderRegistry`, and
   call `registry.setActive('mtgjson')` before any test runs. `afterAll` MUST call
   `sdk.close()`. Tests MUST NOT mock the SDK, the `MtgjsonProvider`, or the
   `ProviderRegistry`, and MUST NOT register a fabricated provider in place of the
   real one.

4. **Per-test isolation via real data, not mocks.** Tests that need a specific
   database state MUST arrange that state by writing rows through the production
   repositories (or by running fixture seeds) and MUST clean up in `afterEach` or
   `afterAll` with explicit deletes — never by deleting the database file or by
   resetting global mocks. Tests that need a specific provider response MUST choose
   fixtures from the offline MTGJSON cache that produce the desired output (e.g.,
   the canonical M11 Lightning Bolt at UUID `6ca7af0b-4b6a-59ba-90be-6da4f62bcff1`
   used by `MtgjsonProvider.test.ts`); they MUST NOT swap in fabricated data via a
   mocked provider method.

5. **Test data MUST be seeded via factories in `apps/server/testing/`.** Every
   entity a route test needs to exist in the database — `UserEntity`,
   `AllowedUserEntity`, `CardEntity`, anything declared under
   `apps/server/src/entities/` — MUST be inserted through a named factory function
   exported from a sibling file under `apps/server/testing/`. The convention is
   `<entity>Factory.ts` exporting `createTest<Entity>(dataSource, overrides?)`
   (e.g., `apps/server/testing/userFactory.ts` exporting
   `createTestUser(dataSource, overrides?)`). Inline
   `dataSource.getRepository(...).save(...)` / `.upsert(...)` calls, raw `INSERT`
   SQL, and one-off seed helpers declared at the top of a test file are
   prohibited. Each factory MUST:

   - **Accept a typed overrides argument** of the shape
     `Partial<Pick<<Entity>, ...assignable-keys>>` so tests can pin only the
     fields they assert on.
   - **Return the persisted entity** typed as the production TypeORM entity so
     test assertions and refactors stay schema-aligned (a column rename surfaces
     as a `tsc` error inside the factory and every consumer at once).
   - **Default every unspecified field to a deterministic value.** No
     `Math.random()`, no `Date.now()`, no `crypto.randomUUID()` — defaults are
     hard-coded constants. Tests requiring uniqueness MUST pass an override.
   - **Persist through the production repository or
     `dataSource.getRepository(<Entity>).save(...) / .upsert(...)`.** The factory
     is the seam that hides persistence from the test, not a parallel persistence
     layer; it MUST NOT execute raw SQL or bypass entity validation.

   If a route test needs an entity for which no factory exists yet, the feature
   plan MUST include a task to create the factory **before** any task that
   depends on the seed. Skipping the factory and seeding inline because "we'll
   extract it later" is a constitution breach against this rule.

   The compliant pattern (canonical reference: the `apps/server/testing/`
   directory that already houses `testDatabase.ts`):

   ```ts
   // apps/server/testing/userFactory.ts
   import type { DataSource } from 'typeorm';
   import { UserEntity } from '@src/entities/UserEntity';

   export type TestUserOverrides = Partial<
     Pick<UserEntity, 'id' | 'email' | 'displayName' | 'avatarUrl'>
   >;

   const DEFAULTS = {
     id: 'a1b2c3d4-e5f6-4789-8abc-def012345678',
     email: 'test-user@example.com',
     displayName: 'Test User',
     avatarUrl: null,
   } as const satisfies TestUserOverrides;

   export async function createTestUser(
     dataSource: DataSource,
     overrides: TestUserOverrides = {},
   ): Promise<UserEntity> {
     const row = { ...DEFAULTS, ...overrides };
     await dataSource.getRepository(UserEntity).upsert(row, ['id']);
     return row as UserEntity;
   }
   ```

   ```ts
   // apps/server/src/routes/cards.test.ts (excerpt)
   import { createTestUser } from '@root/testing/userFactory';

   beforeAll(async () => {
     dataSource = await connectTestDatabase();
     await createTestUser(dataSource, { id: TEST_USER_ID, email: TEST_USER_EMAIL });
   });
   ```

   The prohibited patterns are:

   ```ts
   // PROHIBITED — inline entity construction in a route test.
   //              Drifts schema defaults across files; every test author has to
   //              know every required column; refactors miss test seeds.
   await dataSource.getRepository(UserEntity).upsert(
     { id: TEST_USER_ID, email: TEST_USER_EMAIL, displayName: 'Test User' },
     ['id'],
   );

   // PROHIBITED — raw SQL seed inside a route test.
   //              Bypasses entity validation and the type system entirely; a
   //              schema rename leaves the test silently inserting nothing
   //              into the renamed column.
   await dataSource.query(
     `INSERT INTO "users" (id, email, display_name) VALUES ($1, $2, $3)`,
     [TEST_USER_ID, TEST_USER_EMAIL, 'Test User'],
   );

   // PROHIBITED — a one-off seed helper declared at the top of the test file.
   //              The same helper rewritten three times across three test files
   //              is exactly the duplication the factory rule exists to prevent.
   async function seedUser() {
     await dataSource.getRepository(UserEntity).upsert(
       { id: TEST_USER_ID, email: TEST_USER_EMAIL, displayName: 'Test User' },
       ['id'],
     );
   }
   ```

6. **Unit tests for services and repositories live separately.** Service-level and
   repository-level behaviour is exercised by co-located unit tests next to the
   file under test (per the test co-location rule above). Those unit tests MAY mock
   collaborators — including repositories and external providers — as long as the
   mocking style mirrors the **Mobile mocking conventions** above (single default
   mock per dependency, typed `jest.spyOn` in `beforeEach` for call-shape
   assertions). Route tests are not the venue for exhaustive service-path
   coverage; the unit test for the service is. Route tests prove the wiring, the
   request validation, the response contract, and the end-to-end behaviour — the
   layers below run unmodified.

The compliant pattern (canonical reference: the offline-mode SDK setup already
used by `apps/server/src/providers/mtgjson/MtgjsonProvider.test.ts`):

```ts
import path from 'node:path';
import { MtgjsonSDK } from 'mtgjson-sdk';
import { buildApp } from '@src/app';
import { initDataSource, getDataSource } from '@src/db/dataSource';
import { providerRegistry } from '@src/providers/registry';
import MtgjsonProvider from '@src/providers/mtgjson/MtgjsonProvider';

const CACHE_DIR = path.resolve(__dirname, '../../data/mtgjson-cache');

let sdk: MtgjsonSDK;
let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  await initDataSource(/* test Postgres config */);
  sdk = await MtgjsonSDK.create({ cacheDir: CACHE_DIR, offline: true });
  providerRegistry.register('mtgjson', new MtgjsonProvider(sdk));
  await providerRegistry.setActive('mtgjson');
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  await sdk.close();
  await getDataSource().destroy();
});

describe('GET /cards', () => {
  test('returns rows persisted via the real repository', async () => {
    const response = await app.inject({ method: 'GET', url: '/cards' });
    expect(response.statusCode).toBe(200);
    // Assertions read the JSON the real handler + service + repository produced.
  });
});
```

The prohibited patterns are:

```ts
// PROHIBITED — mocking the service the route depends on.
//              Reduces the test from E2E to a wiring assertion and
//              hides every regression in the real service.
jest.mock('@src/services/cardService', () => ({
  cardService: { search: jest.fn().mockResolvedValue([]) },
}));

// PROHIBITED — mocking the repository module.
//              Skips the database connection entirely; a real schema
//              drift would never surface here.
jest.mock('@src/db/repositories', () => ({
  initRepositories: jest.fn(),
  cardRepository: { find: jest.fn().mockResolvedValue([]) },
}));

// PROHIBITED — mocking the MTGJSON SDK or the active provider.
//              Defeats the rule that the provider runs in offline mode
//              against the real parquet cache.
jest.spyOn(MtgjsonProvider.prototype, 'search').mockResolvedValue([]);
providerRegistry.register('fake', { /* fabricated provider */ } as never);
await providerRegistry.setActive('fake');

// PROHIBITED — running a route test without `initDataSource`.
//              Handler code that hits the repository throws
//              "DataSource not initialised"; the fix is to call
//              `initDataSource` in beforeAll, not to mock the data source.
beforeAll(() => {
  /* no-op — repository will explode at runtime */
});
```

Rationale: the value of a route test comes from the layers it exercises, not the
layers it skips. A route test that mocks `cardService` proves nothing about whether
the service compiles, whether the repository's SQL is correct, whether the SDK
returns the shape the service expects, or whether the request body schema agrees
with what the service consumes. The bugs that route tests need to catch — a renamed
column, a missing migration, a contract drift between the service return shape and
the API response schema, a provider method whose signature has changed — only
surface when the real implementations run. Initialising the real database and the
offline-mode SDK once in `beforeAll` is fast (the SDK loads from a local parquet
cache, Postgres is already running for development), produces a deterministic
environment without external network calls, and keeps route tests as the single
check that proves the API actually works end-to-end. Putting the real
implementations behind the routes also enforces the **Phase completion validation
gate** below at the right layer: a failing E2E catches the bug the unit tests were
structured to miss.

**Phase completion validation gate**: every phase declared in a feature's
`tasks.md` (Setup, Foundational, each User Story, and Polish) MUST be validated by
running the affected workspaces' full Jest suite **and reporting a 100% pass rate**
before the phase is marked complete. The phase's "Checkpoint" line in `tasks.md` is
not satisfied until:

```bash
turbo test --filter=<workspace>      # MUST exit 0 — every test passing
turbo typecheck --filter=<workspace> # MUST exit 0
```

…both succeed across every workspace touched by the phase. A phase that finishes
with even one failing test is incomplete by definition.

A failing test MUST be treated as a signal, not a nuisance, and MUST be investigated
at root cause before the phase advances. Common, non-exhaustive root causes that the
investigator MUST rule out:

- **Bleeding state** between tests — a shared module, a process-level singleton, a
  store left mutated by a previous test, a Jest module-cache survivor, a Zustand
  store with no `beforeEach` reset.
- **Leaky async work** — unawaited promises, timers/intervals not cleaned up,
  subscriptions not unsubscribed, fetches still in flight when the test exits.
- **Fixture ordering** — tests passing only when run in a specific order, or only
  when run in isolation; usually a symptom of bleeding state.
- **Real defects** — the test is correctly catching a regression in code under
  test, or surfacing a pre-existing bug that was previously masked.
- **Test-environment issues** — `jest-expo` / `ts-jest` config drift, mock
  hoisting bugs, transformer order, Node version mismatch.

The acceptable remediations are:

- **Fix the regression** in the code under test if the failure is correct.
- **Fix the test** if the assertion no longer matches the corrected behaviour.
- **Fix the bleed** at source — add a `beforeEach` reset, a shared `afterAll`
  cleanup, a fresh `QueryClient` per test, a `jest.resetModules()`, or
  whatever isolates the failing test from its predecessors.
- **Open a follow-up task and skip the phase exit** if the failure exposes a
  real defect that is genuinely out of scope for the current phase. The phase
  cannot exit while the test is red — it MUST be either fixed in this phase
  or rewritten to assert the corrected (already-shipped) behaviour. Carving
  the bug out into a separate, tracked work item is allowed; advancing past
  it with a still-failing assertion is not.

The prohibited remediations are:

- `it.skip(...)` / `it.todo(...)` / `xit(...)` / `describe.skip(...)` to silence
  the failure.
- Quarantining the test into a separate "flaky" suite that is excluded from
  the phase gate.
- Re-running until green ("flaky test, will retry") — a non-deterministic
  test is a defect, not a fact of life.
- Adding `setTimeout` / `await sleep(N)` to mask a race condition rather than
  awaiting the actual signal.
- Wrapping the assertion in `try { expect(...) } catch {}` or downgrading
  `expect` to `console.warn`.
- Lowering coverage thresholds to make the phase pass.

Rationale: the moment a single failing test is allowed past a phase boundary,
every subsequent phase inherits a degraded signal — "is this test failure new,
or was it already failing?" becomes ambiguous, and bisecting a regression
across multiple phases costs hours that the gate was supposed to save. State
bleeding is the most common and most pernicious cause of intermittent failures;
the bleed is always present, and "passes when re-run" only means the bleed
happens to clear in time on the second run. Treating every failure as a
must-fix root-cause investigation keeps test signal trustworthy and prevents
the gradual accumulation of `.skip`-blocks that turn a green CI badge into a
lie.

### IV. Single Responsibility

Each module, function, or file MUST have one clear, narrow purpose. Card domain logic MUST be
separated from I/O, rendering, and persistence concerns. Cross-cutting coupling between
unrelated modules is not permitted without explicit written justification in the relevant
plan or PR.

### V. Transparency & Legibility

Code MUST be readable by someone unfamiliar with the project. Identifier names MUST describe
intent, not implementation detail. Magic literals MUST be replaced by named constants.
Comments MUST explain *why*, not *what* — the code itself conveys the what.

**Identifier intent rule.** Every variable, parameter, field, function, and type name
MUST describe the *intent* of what it labels — what the value represents in the domain —
not the mechanical role the value plays in the code. The rule applies to every TypeScript
source file across the monorepo (`apps/server`, `apps/mobile`, `packages/core`,
`packages/infrastructure`). Two specific shapes are prohibited outright:

1. **Generic placeholder nouns.** Identifier names like `state`, `data`, `value`,
   `result`, `info`, `obj`, `item`, `thing`, `temp`, `tmp`, `foo`, `bar` (and their
   plurals) MUST NOT be used. They describe what the value *is to the language* (a
   piece of state, a piece of data) rather than what the value *means in the domain*
   (a `cardCount`, a `searchTerm`, a `signInError`). Every reducer has state, every
   fetch returns data, every handler produces a result — the placeholder noun
   communicates nothing the reader cannot already infer from the surrounding code.

2. **Short-form acronyms and contractions.** Identifier names like `usr`, `cfg`,
   `mgr`, `svc`, `mod`, `idx`, `lst`, `len`, `cnt`, `qry`, `txn`, `cb`, `cb1`,
   `req` / `res` (inside handler bodies), `e` (for events or errors), `pwd`, `addr`,
   and single-letter callback parameters in `.map` / `.filter` / `.find` / `.flatMap`
   (e.g. `(p) => p.cards`, `(c) => c.id`) MUST NOT be used. Write the full word:
   `user`, `config`, `manager`, `service`, `module`, `index`, `list`, `length`,
   `count`, `query`, `transaction`, `callback`, `event` / `error`, `password`,
   `address`, `(page) => page.cards`, `(card) => card.id`. Modern editors and the
   type checker make full words free; abbreviations save bytes the codebase does
   not need to save and force every reader to translate.

**Carve-outs.** The following are explicitly permitted because their expanded form
is rarely written in industry, or because the contraction is itself the standard
token:

- Widely-standardised acronyms whose expanded form is rarely written: `url`, `http`,
  `https`, `json`, `xml`, `id`, `uuid`, `jwt`, `api`, `sdk`, `dto`, `ui`, `uri`,
  `iso`, `utc`, `jsx`, `tsx`, `db`. These MAY appear as full identifier tokens
  (`userId`, `apiClient`, `jwtSecret`, `dbConnection`) and as the leading or
  trailing fragment of a compound name (`getUserId`, `apiBaseUrl`).
- Single-letter loop indices (`i`, `j`, `k`) inside tight numeric `for` loops over a
  known-finite range. Anywhere else, prefer a descriptive name.
- Reducer signatures MUST type the state parameter with the domain noun, not the
  generic word `state` — i.e., `(binderHomeState, action) => ...` instead of
  `(state, action) => ...`. The signature is not exempt from this rule.

The compliant patterns are:

```ts
// REQUIRED — names that say what the value means in the domain.
const [signInError, setSignInError] = useState<ApiError | null>(null);
const visibleCards = cardsQuery.data?.pages.flatMap((page) => page.cards) ?? [];
const sessionJwtExpiresAt = decodeJwt(token).exp;
const cardCount = visibleCards.length;

// REQUIRED — reducer signature uses the domain-typed state name.
const binderHomeReducer = (
  binderHomeState: BinderHomeState,
  action: BinderHomeAction,
): BinderHomeState => { /* ... */ };
const [binderHomeState, dispatch] = useReducer(binderHomeReducer, INITIAL_STATE);

// REQUIRED — callback parameters use the domain noun.
const paperCards = cards.filter((card) => card.availability.includes('paper'));
const normalizedColors = commanderColors.map((color) => color.toUpperCase());
```

The prohibited patterns are:

```ts
// PROHIBITED — `state` says nothing about which state.
const [state, setState] = useState<ApiError | null>(null);
const state = useMemo<CardViewState>(() => ({ /* ... */ }), [deps]);

// PROHIBITED — `data` and `info` are placeholder nouns.
const data = cardsQuery.data?.pages.flatMap((page) => page.cards) ?? [];
const info = decodeJwt(token);

// PROHIBITED — short-form acronyms.
const usr = await userRepository.findById(id);
const cfg = loadConfig();
const cb = () => navigate('/login');
const idx = cards.findIndex((card) => card.id === target);

// PROHIBITED — single-letter callback parameters.
cardsQuery.data?.pages.flatMap((p) => p.cards);          // → (page) => page.cards
cards.findIndex((c) => c.id === target);                 // → (card) => card.id === target
commanderColors.map((c) => c.toUpperCase());             // → (color) => color.toUpperCase()
revokeGoogleGrant(accessToken).catch((e) => log.warn('revoke failed', e)); // → (error)
```

Rationale: identifier names are the cheapest documentation in the codebase — they
appear at every read site, every diff, every stack trace, every search result. A
name that describes intent (`signInError`) tells the reader what the value *is* in
the domain without forcing a jump to the declaration; a name that describes
mechanism (`state`, `data`, `result`) forces the reader to read the surrounding
code to recover what the original author already knew. The placeholder ban
eliminates the most common drift mode: a variable that starts as a generic
`state` accumulates concerns over time because the name imposes no semantic
constraint on what may be added. The acronym ban eliminates a second drift mode:
shortened names create per-author dialects (`usr` vs `u` vs `user`) that grep
cannot reconcile and that turn every code review into a translation exercise.
Spelling out `event`, `callback`, `transaction` in full once at declaration is
free; reading `e`, `cb`, `txn` at every call site is not.

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

**Naming rule**: TypeScript type and interface names MUST NOT use Hungarian-style prefixes.
Specifically, the `I` prefix (e.g., `ICardProvider`) is prohibited — names MUST be plain
descriptive nouns (e.g., `CardProvider`). Similarly, suffixes such as `Interface` or `Type`
are not permitted.

**`type` over `interface` rule**: `type` aliases MUST be preferred over `interface` declarations
for all new TypeScript definitions. `interface` is only permitted when declaration merging is
explicitly required (e.g., augmenting a third-party module). All domain types in
`packages/core` and all server/mobile types MUST be declared with `type`.

Rationale: `type` is strictly more expressive than `interface` (it supports unions, intersections,
mapped types, and conditional types that `interface` cannot). Using `type` consistently avoids
the need to decide case-by-case, and eliminates accidental declaration merging which can produce
hard-to-debug type widening.

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

### VIII. Error Transparency

Errors MUST never be silently swallowed. Every caught error MUST result in at least one
observable side effect — a log entry, a re-thrown error, a returned error value, or a
recorded metric. Empty catch blocks and `catch { /* ignore */ }` patterns are prohibited.

When a catch block raises a new error to replace the caught one, the original error MUST
be logged before the new error is thrown. This guarantees the original message and stack
trace are preserved in observability tooling even when the wrapper error is what reaches
the caller. Attaching the cause via `Error`'s `cause` option is encouraged but does not
substitute for logging — `cause` survives in memory but is not always serialised by every
logger or transport.

The acceptable patterns are:

- **Re-throw unchanged**: `catch (err) { throw err; }` — original preserved verbatim.
- **Log and continue**: `catch (err) { console.error(err); /* skip and proceed */ }` —
  permitted when failure of one unit must not abort a batch (the rationale MUST be
  documented in a comment or JSDoc).
- **Log and throw a new error**: `catch (err) { console.error(err); throw new MyError('...', { cause: err }); }`
  — the preferred pattern when wrapping is necessary.
- **Catch and return a sentinel**: `catch { return false; }` — permitted only when the
  absence of error is the intended signal (e.g., a liveness probe). The function MUST
  carry a JSDoc note explaining why the error is intentionally discarded.

The prohibited patterns are:

- `catch (err) { /* nothing */ }` — silent swallow.
- `catch (err) { throw new MyError('...'); }` — original error discarded; the wrapper
  reaches the caller stripped of its cause.
- `catch (err) { return null; }` without a JSDoc note explaining the intentional discard.

Rationale: silent failures produce incidents that cannot be diagnosed from logs alone.
Once an error is discarded, the only signal of its existence is downstream symptoms —
usually hours after the cause occurred. Logging the original before any wrapping or
sentinel-return makes post-incident analysis tractable and keeps stack traces intact.

### IX. Public API Discipline

Two rules govern how the public surface of a workspace is documented and where it lives.

**JSDoc rule for services and providers**: Every public function or method of a class
that lives under `apps/*/src/services/` or `apps/*/src/providers/` MUST carry a JSDoc
block. The block MUST include:

- A short description of the function's intent (the *why*, not a restatement of the
  signature).
- An `@param` entry for every parameter. When a parameter is an options object, each
  recognised sub-field MUST also be described (`@param opts.foo - ...`).
- A `@returns` entry describing the return shape and any sentinels (e.g.,
  `CardNotFoundResult`, `false` from a liveness probe).
- A `@throws` entry for every error the function may throw, including the error code
  if one is attached.
- An `@example` block wrapped in triple-backtick fenced TypeScript showing at least
  one realistic call. Multiple `@example` blocks are encouraged when behaviour varies
  across input shapes (e.g., success vs. not-found, with vs. without optional args).

`apps/server/src/providers/mtgjson/index.ts` is the canonical reference for compliant
JSDoc on a provider class. New services and providers MUST adopt this style; existing
ones MUST be backfilled.

Private methods, internal helpers, and type-only files (interfaces, mappers without
behaviour) are exempt unless their behaviour is non-obvious from a one-line comment.

Rationale: services and providers are the contract that the rest of the application
consumes. Examples-in-source make the contract discoverable from an IDE without a
separate reading pass through call sites, and they remain accurate because they sit
next to the implementation they describe.

**Index file purity rule**: Files named `index.ts` (or `index.js`) MUST be reserved
for re-exporting behaviour declared in *other* files within the same directory. They
MUST NOT declare their own classes, functions, types, constants, or runtime values
beyond the re-exports themselves.

- **Permitted in `index.ts`**: `export { Foo } from './foo';`, `export type { Bar } from './bar';`, `export * from './baz';`.
- **Prohibited in `index.ts`**: class/function/type/const declarations, top-level
  computation, side effects, or local helper definitions.

The compliant pattern is `<Symbol>.ts` containing the declaration, with a sibling
`index.ts` containing only the re-exports. For example:

```ts
// apps/server/src/providers/mtgjson/MtgjsonProvider.ts
export class MtgjsonProvider implements CardProvider { /* ... */ }

// apps/server/src/providers/mtgjson/index.ts
export { MtgjsonProvider } from './MtgjsonProvider';
export { mapCardSetToCardRecord } from './mapper';
```

**Carve-out**: an `index.ts` file referenced by `package.json` `main` or `bin` (i.e.,
the application entry-point) is exempt from this rule. Such a file's purpose is to
bootstrap the runtime, not to aggregate exports — `apps/server/index.ts` is the
canonical example. The carve-out applies only to the package-root entry-point; nested
`src/**/index.ts` files MUST follow the purity rule regardless.

Rationale: index files exist to give a directory a single import path. When they also
declare behaviour, the directory has two competing entry points (the index file and
the file the index would otherwise have re-exported), and refactoring becomes
ambiguous — *"where does `MtgjsonProvider` actually live?"* becomes a question with no
single right answer. Keeping declarations in named files and using `index.ts` strictly
as a barrel preserves a single source of truth per symbol.

### X. Component Architecture (Mobile)

**Every UI feature in `apps/mobile` MUST follow the Screen → Container → Hook → View
pattern. This is non-negotiable.** The pattern applies to every component from first
scaffolding onward — there is no "small component" carve-out.

Each feature lives in its own directory under `src/components/<feature-name>/` and
consists of exactly three files:

```
apps/mobile/src/components/<feature-name>/
├── <Feature>Container.tsx   ← orchestration: calls hook, passes named props to view
├── use<Feature>.ts          ← business logic: state, effects, store calls, handlers
└── <Feature>View.tsx        ← pure JSX: props-only, no store/service imports
```

Screens (Expo Router route files) live under `apps/mobile/app/` at the workspace root.
Each route file is a navigation entry point only — it MUST render exactly one container
and contain no other logic. The default export MUST be a function component with no
local state, declared per the Component declaration rule below:

```tsx
// apps/mobile/app/login.tsx
import { FC } from 'react';
import { LoginContainer } from '@src/components/login/LoginContainer';

const Login: FC = () => <LoginContainer />;
export default Login;
```

Layout files (`apps/mobile/app/**/_layout.tsx`) are permitted to declare the route
hierarchy (e.g., `<Stack />`) and to enforce auth gates with `<Redirect />`, but they
MUST NOT host feature business logic. An auth-gate layout like
`app/(authenticated)/_layout.tsx` may consume `useSession()` and render
`<Redirect href="/login" />` when the session is inactive — this is the canonical
Expo Router pattern and counts as Screen-layer behaviour.

**Layer rules.** Each layer has a fixed responsibility and a fixed list of forbidden
imports. Any import that violates the "Forbidden" column is a constitution breach
requiring justification in the relevant plan's Complexity Tracking table.

| Layer | Location | Responsibility | Forbidden |
|---|---|---|---|
| Screen (route file) | `apps/mobile/app/**/*.tsx` (Expo Router) | Navigation entry point — renders a single container | State, `useState`, `useEffect`, store imports, JSX beyond a single container element |
| Layout (route layout) | `apps/mobile/app/**/_layout.tsx` (Expo Router) | Declare route hierarchy (`<Stack />`, `<Tabs />`) and auth gates (`<Redirect />`) | Feature business logic, view JSX beyond router primitives, direct service calls |
| Container | `src/components/<feature>/<Feature>Container.tsx` | Call hook, destructure result, pass individual named props to the view | Business logic, store imports, service calls, `useState`, `useEffect` |
| Hook | `src/components/<feature>/use<Feature>.ts` | All state, effects, store calls, side-effecting handlers; returns a typed result object | JSX, direct DOM/native API access (use a sub-hook or service) |
| View | `src/components/<feature>/<Feature>View.tsx` | Pure JSX rendering of received props; presentational only | Store imports, service imports, navigation imports, `Alert`, `useState`, `useEffect`, `useReducer` |
| Shared hook | `src/hooks/` | Cross-feature hooks (e.g. `useInference`) | JSX |
| Utility | `src/utils/` | Pure functions (format, parse, math) | React, hooks, JSX, side effects |

**Component declaration rule.** Every functional React component in `apps/mobile`
— Screen, Container, and View — MUST be declared as a `const` arrow function
typed with React's `FC` generic from `react`. Components that render
`children` MUST use `FC<PropsWithChildren<...>>` (importing
`PropsWithChildren` from `react`). Bare-function declarations
(`function Foo(props: FooProps) { ... }`), untyped arrow components
(`const Foo = (props) => ...`), and ad-hoc `JSX.Element` return-type
annotations on plain functions are prohibited.

The compliant patterns are:

```tsx
// REQUIRED — component without children
import { FC } from 'react';

type CardTileProps = {
  title: string;
  onPress: () => void;
};

const CardTile: FC<CardTileProps> = ({ title, onPress }) => (
  <Pressable onPress={onPress}>
    <Text>{title}</Text>
  </Pressable>
);

export { CardTile };

// REQUIRED — component that renders children
import { FC, PropsWithChildren } from 'react';

type ScreenFrameProps = {
  variant: 'light' | 'dark';
};

const ScreenFrame: FC<PropsWithChildren<ScreenFrameProps>> = ({ variant, children }) => (
  <View style={styles[variant]}>{children}</View>
);

export { ScreenFrame };

// REQUIRED — Screen-layer component with no props
import { FC } from 'react';

const Login: FC = () => <LoginContainer />;
export default Login;
```

The prohibited patterns are:

```tsx
// PROHIBITED — bare function declaration, no FC annotation
function CardTile({ title, onPress }: CardTileProps) {
  return <Pressable onPress={onPress}><Text>{title}</Text></Pressable>;
}

// PROHIBITED — untyped arrow component
const CardTile = ({ title, onPress }) => (
  <Pressable onPress={onPress}><Text>{title}</Text></Pressable>
);

// PROHIBITED — manual JSX.Element annotation in place of FC
const CardTile = ({ title, onPress }: CardTileProps): JSX.Element => (
  <Pressable onPress={onPress}><Text>{title}</Text></Pressable>
);

// PROHIBITED — children inlined into the props type instead of PropsWithChildren
type ScreenFrameProps = {
  variant: 'light' | 'dark';
  children: React.ReactNode;
};
const ScreenFrame: FC<ScreenFrameProps> = ({ variant, children }) => (
  <View style={styles[variant]}>{children}</View>
);
```

Props types MUST follow the `type <Component>Props = { ... }` shape (consistent
with Principle VII's `type` over `interface` rule), MUST live in the same file
as the component they describe, and MUST be named with the literal suffix
`Props` so that `tsc` errors and IDE rename actions stay greppable.
Components without props MUST simply use `FC` without a generic argument
(`const Login: FC = () => ...`); explicit empty-object generics
(`FC<{}>`, `FC<Record<string, never>>`) are not required and add noise.

Rationale: `FC` is the contract surface React's type system already provides
for "this is a component, not just a function that returns JSX." Pinning every
component to that contract gives the codebase a single, greppable shape, makes
the children boundary explicit (PropsWithChildren is a positive declaration
rather than a stray `children` field that may or may not be honoured), and
keeps display names attached for React DevTools without requiring per-component
`.displayName` assignments. Restricting prop types to the `<Component>Props`
naming convention means a type-error message naming `LoginViewProps` always
points at exactly one file, keeping refactor blast radius proportional to the
component being changed.

**Container prop-passing rule.** Containers MUST explicitly destructure the hook
result and pass individual named props to the view. Spread operators applied to a
hook's return value are prohibited:

```tsx
// REQUIRED
const { storageInfo, downloadedModels, handleDownload } = useModelManager();
return (
  <ModelManagerView
    storageInfo={storageInfo}
    downloadedModels={downloadedModels}
    onDownload={handleDownload}
  />
);

// PROHIBITED — hides dependencies, breaks static analysis, masks unused fields
return <ModelManagerView {...useModelManager()} />;
```

Spreading hides the contract between the hook and the view. When the hook adds a
field, a spread silently passes it through; when the hook removes a field, the view
breaks at runtime instead of at `tsc` time. Named props make the data flow visible
at the call site and let TypeScript catch every drift.

**Style co-location rule.** Every view component in `apps/mobile` MUST
consume its `StyleSheet` through a sibling `<Component>.theme.ts` file
via a `useStyles` hook. Inline `StyleSheet.create({ ... })` blocks at
the bottom of a view file are prohibited.

Each feature directory MUST follow this shape:

```
apps/mobile/src/components/<feature>/
├── <Feature>View.tsx          ← pure JSX; calls `useStyles()` at top of body
└── <Feature>View.theme.ts     ← StyleSheet + typed shape + `useStyles` hook
```

The theme file MUST satisfy all of the following:

1. **Strongly-typed style shape**: a `<Feature>ViewStyles` type whose
   entries are each `Required<Pick<ViewStyle | TextStyle | ImageStyle,
   ...exact-keys>>` over only the keys actually present in that style.
   Bare `ViewStyle` / `TextStyle` per entry is prohibited — the precise
   `Pick` keeps the type self-documenting and turns "removed a key from
   the sheet without removing it from the type" (and vice-versa) into a
   `tsc` error.
2. **Single typed StyleSheet**: a module-level
   `StyleSheet.create<<Feature>ViewStyles>({ ... })` call. The generic
   argument MUST be supplied so the `create` call validates the literal
   against the shape.
3. **`useStyles` default export**: a hook that returns the typed
   stylesheet. The hook MUST be the file's only `export default`, MUST
   take no arguments, and MUST be named `useStyles`. Named exports are
   limited to the `<Feature>ViewStyles` type for downstream consumers
   (e.g., test helpers); no other named exports are permitted.

The view consumes the hook by calling `const styles = useStyles();` at
the top of the function body and applies entries via
`style={styles.<entry>}`. Calling the local `useStyles()` does **not**
count against the View row's "Forbidden" column in the Layer rules
table — the hook is a pure module-level cache accessor, not a stateful
or effect-bearing primitive. No other hook calls (`useState`,
`useEffect`, `useReducer`, store hooks, query hooks) are permitted in
the view.

**Single Responsibility — no shared theme files.** A `<Component>.theme.ts`
file MUST belong to exactly one component. Reusable design tokens
(colour palette, spacing scale, type roles, radii, motion, touch
targets) live in `apps/mobile/constants/theme.ts` and are imported by
every component-level theme file; the component-level `*.theme.ts`
files themselves MUST NOT be re-imported across component boundaries.
If two components need identical visual treatment, either (a) extract
the shared element into its own component with its own theme file, or
(b) extend `apps/mobile/constants/theme.ts` with a new design token —
not by importing one component's `*.theme.ts` from another.

The compliant pattern (canonical reference:
`apps/mobile/src/components/binder-home/BinderHomeView.theme.ts`):

```ts
// BinderHomeView.theme.ts
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { Colors, Radius, Spacing, Touch, Type } from '@src/constants/theme';

export type BinderHomeViewStyles = {
  root: Required<Pick<ViewStyle, 'flex' | 'backgroundColor'>>;
  title: Required<
    Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'color' | 'fontWeight'>
  >;
  pocketImage: Required<Pick<ImageStyle, 'width' | 'height'>>;
  // …one entry per style, each scoped to the keys it actually uses
};

const styles = StyleSheet.create<BinderHomeViewStyles>({
  root: { flex: 1, backgroundColor: Colors.dark.background },
  title: {
    fontFamily: Type.subtitleItalic.font,
    fontSize: Type.subtitleItalic.size,
    lineHeight: Type.subtitleItalic.lineHeight,
    color: Colors.dark.text,
    fontWeight: Type.subtitleItalic.weight,
  },
  pocketImage: { width: '100%', height: '100%' },
  // …
});

const useStyles = (): BinderHomeViewStyles => styles;

export default useStyles;
```

```tsx
// BinderHomeView.tsx
import type { FC } from 'react';
import { View, Text } from 'react-native';

import useStyles from './BinderHomeView.theme';

const BinderHomeView: FC<BinderHomeViewProps> = (props) => {
  const styles = useStyles();
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{props.title}</Text>
    </View>
  );
};
```

The prohibited patterns are:

```tsx
// PROHIBITED — inline StyleSheet at the bottom of the view file.
//              Splits the view's responsibility (JSX) with styling
//              and forces every reader to scroll past markup to find
//              the style definitions.
const FooView: FC = () => <View style={styles.root} />;
const styles = StyleSheet.create({ root: { flex: 1 } });

// PROHIBITED — sharing one component's theme file with another.
//              Violates Single Responsibility (Principle IV); changes
//              to FooView's visuals silently propagate to BarView.
// BarView.tsx:
import useStyles from '../foo/FooView.theme';

// PROHIBITED — bare ViewStyle/TextStyle per entry.
//              Every property is optional, so removing a key from the
//              sheet does not error and the type stops describing the
//              actual contract.
export type FooViewStyles = {
  root: ViewStyle;
};

// PROHIBITED — non-`useStyles` default export, or sheet exported directly.
//              Breaks the codebase's single shape for style consumption
//              and lets a view skip the hook call entirely.
export default styles;          // sheet, not the hook
export { useStyles as default }; // renamed default
```

Rationale: pulling styles into a sibling theme file keeps the view
file focused on JSX (the View layer's only responsibility per
Principle X's Layer rules table) and lets the styles file stay legible
at any size without the reader scrolling past unrelated markup. Typing
each entry as `Required<Pick<...>>` over its exact keys turns the
`<Feature>ViewStyles` type into a precise contract — adding a key
without listing it in the type fails at `tsc`, removing a key in the
sheet without removing it from the type does the same, and the type
itself documents which CSS-like properties each style sets without
forcing the reader into the full `ViewStyle` declaration. Forbidding
shared `*.theme.ts` files preserves Principle IV (Single
Responsibility) at the styling layer — when one component's visual
contract drifts, only that component's theme file moves, and the
blast radius of a tweak is proportional to the component being
changed.

**Hook return-value memoisation rule.** Every non-primitive value produced inside
an `apps/mobile` hook (any file under `apps/mobile/src/components/<feature>/
use<Feature>.ts` or `apps/mobile/src/hooks/`) MUST be memoised before it is
returned, passed to a child component, or used as a dependency of another hook.

- **Functions** (event handlers, callbacks, factory functions) MUST be wrapped in
  `useCallback` with an exhaustive dependency array.
- **Objects, arrays, class instances, and any other non-primitive value** MUST be
  wrapped in `useMemo` with an exhaustive dependency array.
- **Primitives** — `string`, `number`, `boolean`, `null`, `undefined`, `bigint`,
  `symbol` — are exempt. Their values are compared by value, so a fresh primitive
  per render is identity-stable when the underlying data is unchanged.

The rule applies regardless of whether the value is returned from the hook,
captured in a closure, or passed downward. Values read directly from a Zustand
selector or TanStack Query result are already reference-stable and do not need
re-wrapping; values *derived* from them (e.g., `data.map(transform)`,
`{ ...query.data, foo }`, `() => mutation.mutate(arg)`) MUST be memoised at the
hook boundary.

The compliant patterns are:

```ts
// REQUIRED — function wrapped in useCallback
import { useCallback, useMemo } from 'react';

const useBinderHome = () => {
  const currentPage = useBinderStore((s) => s.currentPage);             // primitive — exempt
  const cards = useCardsInfiniteQuery();                                 // query result — already stable

  const visibleCards = useMemo(
    () => cards.data?.pages.flatMap((p) => p.items) ?? [],
    [cards.data],
  );                                                                     // derived array — useMemo

  const handleSwipeRight = useCallback(() => {
    useBinderStore.getState().setCurrentPage(currentPage + 1);
  }, [currentPage]);                                                     // function — useCallback

  return { currentPage, visibleCards, handleSwipeRight };
};
```

The prohibited patterns are:

```ts
// PROHIBITED — fresh function reference every render breaks React.memo
//              on the view and re-fires every downstream useEffect.
const useBinderHome = () => {
  const handleSwipeRight = () => {
    /* ... */
  };
  return { handleSwipeRight };
};

// PROHIBITED — fresh array literal every render; the view's FlatList
//              re-keys every row even when `data` is unchanged.
const useBinderHome = () => {
  const cards = useCardsInfiniteQuery();
  return { visibleCards: cards.data?.pages.flatMap((p) => p.items) ?? [] };
};

// PROHIBITED — fresh object literal every render forces every consumer
//              that depends on `config` to recompute.
const useBinderHome = () => {
  return { config: { columns: 3, rows: 3 } };
};
```

Rationale: React compares non-primitive values by reference. A new function,
object, or array on every render forces every consumer to re-render even when
the underlying data has not changed, breaks `React.memo` on the view layer,
breaks the dependency arrays of downstream `useEffect` / `useMemo` /
`useCallback` (turning them into "fire every render" hazards), and amplifies
cost across the four-layer split. Memoising at the hook boundary makes the
hook→container→view contract reference-stable by construction and lets the
`react-hooks/exhaustive-deps` lint rule verify that every dependency is
declared. This rule pairs with the **Container prop-passing rule** above —
named props plus stable references give the view a contract the type system
*and* the React reconciler can both rely on.

**Data-fetching hook composition rule.** When a `use<Feature>.ts` hook wraps a
TanStack Query primitive (`useCardImagesQuery`, `useCardsInfiniteQuery`,
`useMeQuery`, etc.) the composition MUST follow the seven rules below. The
canonical reference is `apps/mobile/src/components/card/` (spec 017):
`CardContainer.tsx`, `CardView.tsx`, `useCard.ts`, and the sibling `types.ts`
together form a three-file unit whose types compose end-to-end from the query
result through to the container destructure.

1. **Destructure the query result at the hook boundary.** Read the specific
   fields the feature consumes (`data`, `error`, `isLoading`, `isSuccess`,
   `refetch`, etc.) off the query in a single destructure inside
   `use<Feature>.ts`. Passing the entire `UseQueryResult` through to the
   container or view is prohibited — it leaks the TanStack surface across
   layer boundaries and forces downstream files to depend on a library that
   the View layer should not import.

2. **Derive view-shaped data with `useMemo` or TanStack `select`.** Any
   transformation between the raw `query.data` and the shape the view
   consumes MUST happen at the hook boundary, either as a `useMemo` whose
   deps include the query data (per the Hook return-value memoisation rule
   above) or as TanStack Query's `select` option on the query hook itself.
   View-side transformation is prohibited — the View layer's only
   responsibility is rendering ready-shaped props.

3. **Pass `error` through without redeclaring it.** The view consumes the
   query's `error` directly via the view-props type (see rule 5). The hook
   MUST NOT wrap the query error in a feature-specific error model, and the
   view MUST NOT re-type it. The query library's error type is the single
   source of truth; redeclaring it on either side guarantees drift the
   moment the underlying schema or library version changes.

4. **Encapsulate side effects (animations, subscriptions, listeners) in the
   hook.** Pulse animations for loading states, gesture handlers, timing
   loops, native API subscriptions, and any other stateful or effect-bearing
   primitive MUST be constructed in `use<Feature>.ts` and surfaced to the
   view as a stable handle (a `RefObject<Animated.Value>`, a memoised
   callback, a subscription token, etc.). The view receives ready-to-render
   data and stable handles only; effects in the view layer are prohibited
   (the existing Layer rules table forbids `useEffect` in the view).

5. **Derive view props from the query result type via `Pick`.** The
   `<Feature>ViewProps` type MUST compose `Pick<UseXxxQueryResult, 'error' |
   'isLoading' | 'isSuccess' | ...>` joined with feature-specific additions
   via `&`. Redeclaring `error: ApiError | null`, `isLoading: boolean`, or
   any other field TanStack already types on its result is prohibited —
   silent drift between the two declarations surfaces only at runtime when
   the library is upgraded or the API error shape evolves.

6. **Name hook options as `Use<Feature>Options`.** Every `use<Feature>.ts`
   hook that takes parameters MUST accept a single options object typed
   with a named `Use<Feature>Options` type. Inline parameter destructuring
   without a named type — e.g. `useCard({ id, footprint }: { id: string;
   footprint: CardFootprint })` — is prohibited. The type MUST live in the
   feature directory's `types.ts` (or, if the directory has no `types.ts`,
   as a named export from the hook file itself). A named options type is
   greppable, lets callers forward options without duplicating the parameter
   shape, and gives the test suite a single type to mock against.

7. **Feature-local `types.ts` for non-wire types.** Component directories
   that compose a query hook MAY add a sibling `types.ts` to host Pick'd
   view-props types, options types, and any other domain typedefs the
   feature owns and that never cross the wire. The file MUST NOT import
   from `apps/mobile/src/components/<other-feature>/` (Single Responsibility,
   Principle IV) and MUST NOT redeclare types that already live in
   `packages/core` (Public API Discipline, Principle IX) — re-export from
   `@my-binder/core` instead. Types in `types.ts` are mobile-only; types
   that the server also consumes belong in `packages/core`.

The compliant pattern (canonical reference:
`apps/mobile/src/components/card/`):

```ts
// types.ts
import type { RefObject } from 'react';
import type { Animated } from 'react-native';

import type { UseCardImagesQueryResult } from '@src/hooks/useCardImagesQuery';

export type CardFootprint = 'pocket' | 'detail';

export type UseCardOptions = {
  id: string;
  footprint: CardFootprint;
};

export type CardViewProps = Pick<
  UseCardImagesQueryResult,
  'error' | 'isLoading' | 'isSuccess'
> & {
  onRetry: () => Promise<void>;
  imageUrl?: string;
  pulseRef: RefObject<Animated.Value>;
};
```

```ts
// useCard.ts
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated } from 'react-native';

import { useCardImagesQuery } from '@src/hooks/useCardImagesQuery';

import type { CardViewProps, UseCardOptions } from './types';

export const useCard = ({ id, footprint }: UseCardOptions): CardViewProps => {
  const { isLoading, isSuccess, data, refetch, error } = useCardImagesQuery(id);

  const onRetry = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const imageUrl = useMemo(() => {
    if (isSuccess) return variantForFootprint(footprint, data);
  }, [data, footprint, isSuccess]);

  const pulseRef = useRef(new Animated.Value(PULSE_MIN));
  useEffect(() => {
    if (!isLoading) return;
    const loop = Animated.loop(/* ...pulse sequence... */);
    loop.start();
    return () => loop.stop();
  }, [isLoading]);

  return { pulseRef, imageUrl, error, isLoading, isSuccess, onRetry };
};
```

```tsx
// CardContainer.tsx
import type { FC } from 'react';

import CardView from './CardView';
import { useCard } from './useCard';
import type { CardFootprint } from './types';

export type CardProps = {
  id: string;
  footprint: CardFootprint;
};

const CardContainer: FC<CardProps> = ({ id, footprint }) => {
  const { isSuccess, isLoading, onRetry, imageUrl, pulseRef, error } =
    useCard({ id, footprint });
  return (
    <CardView
      isLoading={isLoading}
      isSuccess={isSuccess}
      pulseRef={pulseRef}
      onRetry={onRetry}
      imageUrl={imageUrl}
      error={error}
    />
  );
};

export default CardContainer;
```

The prohibited patterns are:

```ts
// PROHIBITED — view-props redeclare `error` / `isLoading` instead of
//              Pick'ing them from the query result type. The hook and
//              the view drift the moment TanStack or the API error
//              model changes shape; tsc cannot catch the mismatch.
type CardViewProps = {
  error: ApiError | null;
  isLoading: boolean;
  isSuccess: boolean;
  /* ... */
};

// PROHIBITED — entire query result passed wholesale to the view.
//              Leaks the TanStack surface across layer boundaries;
//              the view now imports `UseQueryResult` and depends on
//              fields it does not consume.
const useCard = (id: string) => useCardImagesQuery(id);
const CardContainer: FC<CardProps> = ({ id }) => {
  const query = useCard(id);
  return <CardView query={query} />;
};

// PROHIBITED — animation lives in the view. Loading-state side
//              effects fight the render loop, the view is no longer
//              pure JSX, and testing it requires mounting it with a
//              working Animated driver.
const CardView: FC<CardViewProps> = ({ isLoading }) => {
  const pulseRef = useRef(new Animated.Value(0.6));
  useEffect(() => { /* start/stop loop on isLoading */ }, [isLoading]);
  return <Animated.View style={{ opacity: pulseRef.current }} />;
};

// PROHIBITED — view transforms query.data. The transformation belongs
//              in the hook (useMemo) or in the query's `select`
//              option. Otherwise the view layer imports domain logic
//              ("medium for pocket, large for detail") it should not
//              own.
const CardView: FC<CardViewProps> = ({ data, footprint }) => {
  const imageUrl = footprint === 'pocket' ? data.medium : data.large;
  return <Image source={{ uri: imageUrl }} />;
};

// PROHIBITED — inline options shape with no named type. Callers
//              cannot import the options type to forward parameters;
//              a rename of one field forces edits in every call site
//              instead of one type.
const useCard = (
  { id, footprint }: { id: string; footprint: CardFootprint },
) => { /* ... */ };
```

Rationale: a data-fetching feature collapses cleanly when the four-layer
split aligns with the query lifecycle. Destructuring at the hook boundary
names exactly which fields the feature consumes, so a TanStack Query
upgrade — or a swap to a hand-rolled client — is a one-file change inside
`use<Feature>.ts`. Deriving view props from the query result type with
`Pick` makes drift a `tsc` error instead of a silent runtime mismatch:
when `UseCardImagesQueryResult` changes shape, `CardViewProps` either
compiles or it does not. Encapsulating animations and other side effects
in the hook keeps the view a pure render function the `@testing-library/
react-native` suite can exercise without faking timers or animation
drivers (Principle III's mobile test convention). Naming hook options as
`Use<Feature>Options` keeps the parameter contract greppable — searching
for `UseCardOptions` lands on the single source of truth — and lets
callers forward options without duplicating the parameter shape.
Together, these rules turn a data-fetching feature into a three-file unit
(`<Feature>Container.tsx`, `use<Feature>.ts`, `<Feature>View.tsx`, with
an optional sibling `types.ts`) whose type contract composes end-to-end:
query result → hook options → view props → container destructure → view
render. Every layer's responsibility is auditable in isolation, and
upgrades to the underlying query library leave the View and Container
layers untouched.

**State locality rule.** State MUST live as close to the component that
consumes it as possible. The placement decision follows a strict hierarchy
and MUST be applied at the moment a state field is introduced:

1. **Single-component state.** If exactly one component reads or writes a
   field, the field MUST live inside that component's `use<Feature>.ts`
   hook. Express it with `useState` for simple values and `useReducer` when
   transitions become non-trivial (multiple actions, derived transitions,
   or invariants between fields). Lifting single-consumer state into a
   Zustand store under `apps/mobile/src/stores/` is prohibited.

2. **Multi-component state across unrelated consumers.** If two or more
   *unrelated* components read or write a field — i.e., consumers that do
   not sit in a parent → descendant relationship that would make
   prop-passing or context viable — the field MUST live in a Zustand
   store under `apps/mobile/src/stores/`. The active session is the
   canonical example: the auth-gate layout
   (`app/(authenticated)/_layout.tsx`), `LoginContainer`, and
   `ProfileContainer` each consume it independently, so `sessionStore` is
   the correct home.

3. **Parent → descendant shared state.** If a field is shared between a
   parent and components rendered inside its tree, the field MUST stay in
   the parent's `use<Feature>.ts` hook and flow downward through props
   (or via a feature-scoped React context when prop-drilling exceeds
   three levels). Promoting such state to a Zustand store is permitted
   ONLY when an additional unrelated consumer (outside the parent →
   descendant chain) starts reading or writing it.

The progression is: start with `useState` in the hook → switch to
`useReducer` in the same hook when state transitions become non-trivial →
promote to a Zustand store ONLY when a second, unrelated consumer
appears. State MUST NOT be added to a Zustand store speculatively, "in
case" another component needs it later. A speculative store entry is a
constitution breach the moment it lands; the entry MUST be removed and
the state MUST be moved into the consuming hook until a second unrelated
consumer actually exists.

A consequence of this rule: when a previously-shared field collapses
back to a single consumer (a screen is removed, two consumers are
merged, an indicator is collocated into its pager), the corresponding
Zustand store MUST be deleted and the state MUST be moved back into the
remaining consumer's hook. Stores do not earn the right to persist by
prior usage — they earn it by current multi-consumer demand.

The compliant patterns are:

```ts
// REQUIRED — single-consumer state in the feature hook.
//            `currentPage` is read and written only by the binder
//            feature, so it lives in `useBinderHome.ts` as `useReducer`
//            state alongside the search fields it interacts with.
const useBinderHome = () => {
  const [state, dispatch] = useReducer(binderReducer, initialState);
  // currentPage flows down to BinderHomeView via the container.
  return { currentPage: state.currentPage /* ... */ };
};

// REQUIRED — multi-consumer shared state in a Zustand store.
//            `session` is consumed by the auth-gate layout, the login
//            container, and the profile container — three unrelated
//            consumers. `sessionStore` is the correct home.
const useSession = () => useSessionStore((s) => s.session);
```

The prohibited patterns are:

```ts
// PROHIBITED — single-consumer state lifted into a Zustand store.
//              `searchTerm` is read only inside the binder feature; it
//              MUST live in `useBinderHome.ts`, not in a store.
const useBinderSearchStore = create<BinderSearchState>((set) => ({
  searchTerm: '',
  setSearchTerm: (term) => set({ searchTerm: term }),
}));

// PROHIBITED — speculative store ("in case another screen needs it
//              later"). The second consumer does not exist; the store
//              MUST NOT be created until it does.
const useDraftBinderEntryStore = create<DraftBinderEntryState>(/* ... */);
```

Rationale: state in a Zustand store is global by construction — every
component can subscribe to every slice, every test must arrange and
reset every store, and every refactor must trace usage across the
workspace. State scoped to a hook is local by construction — its
lifecycle ends at unmount, no test setup is required outside
`renderHook`, and its blast radius is one file. The most common
state-management failure mode in React applications is gradual
globalisation: a store grows, accumulates fields read by exactly one
component each, and slowly couples every screen to a shared mutable
surface no engineer fully understands. Forcing every Zustand entry to
justify itself with at least two unrelated consumers keeps the global
surface tiny by construction and lets the four-layer Principle X split
do its job. This rule pairs with the **Hook return-value memoisation
rule** above — when state lives next to the hook that consumes it, the
hook's return value is the single contract surface a memoisation pass
needs to police.

**`useEffect` usage discipline.** `useEffect` is an escape hatch for synchronising
React state with **external systems** (browser/native APIs, subscriptions, network
resources, third-party widgets). It MUST NOT be used for any of the following
React-internal concerns:

1. **Computing state from props or other state.** Derive the value in the render
   path or with `useMemo`. An effect that watches `propA` and writes
   `setStateDerivedFromA(transform(propA))` is always wrong — it forces an extra
   render and creates a window where state and props disagree.
2. **Handling user events.** Put the logic in the event handler that triggered it.
   Effects that watch a "clicked" or "submitted" flag and react to it are anti-
   patterns; the navigation, mutation, or notification belongs in the handler
   itself.
3. **Resetting state when props change.** Pass a `key` prop to the component so
   React unmounts and remounts it with fresh state. Effects that compare prop
   values to old values via refs and call `setState` to "reset" duplicate React's
   own machinery.
4. **Notifying parent components of state changes.** Call the parent callback from
   the same handler that mutated the state, not from an effect that watches the
   state. Effect-based notification creates ordering bugs and double-fires when
   the parent re-renders.
5. **Chaining effects to drive other effects.** If effect A's only purpose is to
   trigger effect B, derive the result directly or call both updates from one
   event handler. Each link in the chain adds a render cycle.

`useEffect` IS appropriate for: subscribing to a store outside the React tree,
attaching listeners to a native API, fetching when no framework-provided data hook
is available, and starting/stopping animations bound to mount/unmount.

Two technical rules govern every `useEffect` that does ship:

- **Cleanup is mandatory** for every effect that subscribes, opens a connection,
  schedules a timer, or starts an async operation whose result the component will
  consume. The cleanup function MUST cancel the subscription/timer/operation so a
  fast unmount does not leak handles or call `setState` on an unmounted component.
- **Exhaustive dependencies are mandatory.** The `react-hooks/exhaustive-deps` rule
  MUST be enabled at the lint level. Suppression
  (`// eslint-disable-next-line react-hooks/exhaustive-deps`) is permitted only with
  an adjacent comment naming the invariant that makes the missing dependency safe
  (e.g., "ref is stable across renders", "callback intentionally captures the
  initial value"). Suppression without justification is a constitution breach.

Rationale: the four-layer split makes every component testable in three independent
slices — the hook can be unit-tested with renderHook-style tools (Principle III's
Jest mandate), the view can be snapshot-tested with no providers or store mocks,
and the container is a one-line glue file requiring no test of its own. Spreading
hook results hides the hook→view contract; named props make the data flow visible
and let `tsc` enforce it. The `useEffect` rules cut off the most common React bug
class — effects that fight the render loop and produce stale UI — before it enters
the codebase. These rules align with React's official "You Might Not Need an
Effect" guidance and the canonical React `eslint-plugin-react-hooks` ruleset.

### XI. Dependency Currency

Every package introduced into any `package.json` (root or workspace) MUST be
pinned to the **most recent stable release** of that package at the moment it
is added. Selecting a deprecated package, a known end-of-life version, or any
version older than current stable requires an explicit, recorded justification
— preference is not a justification.

**Rules.**

- **Default**: a new dependency MUST resolve to the registry's `latest`
  dist-tag (or the package's documented "stable" channel if it does not use
  npm's `latest`) at the time of addition. The resolver determines this with
  `pnpm view <pkg> version` (or `npm view`); the result is the only sanctioned
  starting point for the version range.
- **Range syntax**: use the package ecosystem's idiomatic carat range
  (`"<pkg>": "^x.y.z"`) where `x.y.z` is the most recent stable. Tilde
  (`~x.y.z`) is required only when the upstream framework's published
  dependency manifest specifies it (e.g., the Expo SDK 54 `expo-*` modules
  ship as tilde ranges — Expo treats minor bumps as breaking).
- **Pre-releases excluded**: alpha, beta, RC, canary, nightly, and `next`
  dist-tag versions are not "stable" for the purpose of this rule and MUST
  NOT be introduced as a default. Adopting a pre-release requires the same
  justification trail as adopting a deprecated version.
- **Workspace links exempt**: `workspace:*` and `workspace:^x.y.z` ranges
  pointing into the monorepo are not external versions and are out of scope
  for this rule.
- **Framework-pinned packages**: when a package's version is dictated by a
  framework already pinned in the Technology Stack section (Expo SDK, React
  Native, React, Expo Router, Jest preset, `@testing-library/react-native`,
  etc.), the framework's recommended version for that SDK is the "stable"
  version. The framework pin overrides the registry-`latest` rule because
  the surrounding stack is itself pinned.
- **Off-stable selections require justification**: if the introduced version
  is older than current stable, or if the package is flagged deprecated by
  the registry, the relevant feature plan's Complexity Tracking table (or,
  for changes outside a feature, the PR description) MUST contain an entry
  naming:
  1. The package and the version chosen.
  2. The current stable version that was *not* chosen.
  3. The concrete blocker (peer-dep ceiling, active CVE in latest,
     breaking-change incompatibility with another pinned dep, lack of types,
     etc.) that forced the off-stable choice. "Preference", "stability
     concerns" without a citation, or "we'll bump it later" are not concrete
     blockers.
  4. The follow-up TODO item or tracked task that will resolve the gap.

**Workarounds prohibited.** Aliasing a missing transitive into a workspace
via `"<helper>": "link:<package>/sub/path"` (or any equivalent
`file:`/`link:` punning) is **never** an acceptable substitute for declaring
the real dependency. If a transitive helper is required at runtime (e.g.,
`@babel/runtime/helpers/interopRequireWildcard`), the package supplying it
(`@babel/runtime`) MUST be added as a direct devDependency at the most
recent stable version per the rule above. Missing-transitive errors are a
diagnostic; the fix is to install the package, not to invent a fake alias
entry.

**Bump cadence.** Drift after introduction is *not* a breach — packages
move, our `package.json` does not auto-track. Planned dependency upgrades
happen via dedicated bump tasks tracked in `todo/` or in a feature plan.
Principle XI governs the moment a dependency *enters* `package.json`; it
does not require continuous re-pinning.

**Process at PR-time.**

1. Identify every new line under `dependencies` / `devDependencies` /
   `peerDependencies` in any `package.json` in the diff.
2. For each, confirm the chosen version is the registry's current stable
   (or the framework-mandated version per the carve-out above).
3. If any chosen version is older than stable, ensure the Complexity
   Tracking entry exists and is concrete; if the version is current stable,
   no entry is required.
4. The reviewer MUST verify (1)–(3) before approving. A PR that adds a
   deprecated or off-stable dependency with no justification fails the
   Constitution Check and MUST NOT be merged.

Rationale: outdated and deprecated dependencies compound migration cost
silently — every month a deprecated package stays in `package.json`, the
gap to its successor widens, and the eventual migration consumes
disproportionate engineering time (the in-flight
`expo-auth-session/providers/google` →
`@react-native-google-signin/google-signin` migration is the canonical
example). Worse, missing or mis-aliased dependencies surface as confusing
test-runner errors ("Cannot find module …/interopRequireWildcard") that
look like tooling bugs but are really schema breaches in `package.json`.
Pinning to current stable by default keeps the cost of upgrade
proportional to the upgrade itself, lets `pnpm audit` produce signal
instead of noise, and forces every off-stable choice to surface a
deliberate rationale at the moment the choice is made — when the context
is fresh — rather than at the moment a future engineer has to reverse-
engineer it.

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
- **`apps/mobile`**: TypeScript mobile application targeting iOS 15.1+ and Android API 24+.
  Depends on `packages/core`. `tsconfig.json` MUST enable `strict: true` and declare the
  `@root/*` + `@src/*` path aliases (Principle VII). Framework: **React Native 0.81.5 +
  Expo SDK ~54.0** (managed workflow) on **React 19.1**. Language: **TypeScript ~5.9**.
  Routing: **Expo Router ~6.0** (file-based, built on `@react-navigation/native-stack` 7
  + `@react-navigation/bottom-tabs` 7) — routes live in `apps/mobile/app/` at the
  workspace root. Store artifacts are produced via EAS Build. Test stack: Jest 30 +
  `jest-expo` preset + `@testing-library/react-native` 13.x (per Principle III). The
  workspace layout MUST follow Principle X:
  `apps/mobile/{app,src/{components,hooks,services,stores,utils}}/`. The
  `npx create-expo-app` bootstrap additionally produces template directories
  (`assets/`, `constants/`, `hooks/`, `scripts/`) and an `eslint.config.js` flat
  config at the workspace root; `assets/` and `constants/theme.ts` are sanctioned to
  stay (the design tokens live in `constants/theme.ts`); the rest MUST be merged into
  `src/` per Principle X or deleted. Package manager: **pnpm only** — any
  `package-lock.json` produced by the bootstrap MUST be deleted before merge.
  Switching the framework, routing library, Jest preset, or view-test library
  requires a constitution amendment.
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
  Direct `node_modules` manipulation outside of pnpm is prohibited. New dependencies MUST
  be selected per Principle XI (Dependency Currency) — most-recent-stable by default,
  off-stable choices justified in the relevant plan's Complexity Tracking table.
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
`.specify/templates/plan-template.md`) verifying compliance with all eleven principles
before implementation begins. Violations MUST be justified in the plan's Complexity
Tracking table.

**Version**: 1.26.0 | **Ratified**: 2026-03-21 | **Last Amended**: 2026-05-17
