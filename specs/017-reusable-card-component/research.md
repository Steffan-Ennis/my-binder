# Phase 0 Research: Reusable Card Component

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Purpose: resolve every uncertain technical choice surfaced by the plan
*before* design artifacts are produced. Each entry pins a **Decision**, a
**Rationale**, and the **Alternatives considered** so future contributors
understand *why* the implementation looks the way it does.

The Technical Context section of `plan.md` contains zero `NEEDS
CLARIFICATION` markers — Q1-Q5 of `/speckit.clarify` resolved the visible
unknowns. This document covers the remaining *design-time* questions
implied by Q4 (per-query retry override), Q3 (cache scope), FR-014
(server schema-tightening), and the existing repo's component conventions.

---

## R1 — Per-query retry override (5 attempts) without forking the queryClient

**Decision**: Override `retry` and `retryDelay` on the per-query options
object passed to `useQuery({ ... })` inside `useCardImagesQuery.ts`. Reuse
the existing `computeRetryDelay` and `isFourXX` helpers from
`apps/mobile/src/services/api/queryClient.ts` (exported newly as named
exports — they are currently file-private).

```ts
// apps/mobile/src/hooks/useCardImagesQuery.ts
const RETRY_BUDGET = 5;
const shouldRetry = (failureCount: number, error: unknown): boolean =>
  failureCount < RETRY_BUDGET && !isFourXX(error);

return useQuery({
  queryKey: ['cards', 'images', id],
  queryFn: () => apiClient.getCardImages(id),
  retry: shouldRetry,
  retryDelay: computeRetryDelay,
  enabled: status === 'active' && Boolean(id),
  staleTime: STALE_TIME_MS,
  gcTime: GC_TIME_MS,
});
```

**Rationale**:
1. The queryClient.ts default of 3 retries is a project-wide setting that
   we explicitly do not want to change globally — every other query (cards
   list, /me, sign-in) is correctly tuned at 3, and bumping the global to
   5 would burn 60% more bandwidth on every failure for unrelated calls.
2. TanStack Query 5 respects per-query `retry` over the QueryClient
   default — this is the library's documented override mechanism.
3. `computeRetryDelay` already handles attempts beyond index 2: the
   formula `Math.min(MAX_RETRY_DELAY_MS, RETRY_DELAYS_MS[2] * 2 **
   (attemptIndex - 2))` produces 8s for attempt 4, 16s for attempt 5,
   capped at 30s. The full back-off schedule is 1s → 2s → 4s → 8s → 16s
   — exactly matching FR-006.
4. Re-implementing `isFourXX` inline in the new hook would duplicate the
   `ApiError.status` check — a guaranteed drift point. Exporting it from
   `queryClient.ts` keeps the single source of truth.

**Alternatives considered**:
- **Bump global default to 5.** Rejected: bleeds the +2 retry budget onto
  every unrelated query and inflates worst-case loading time across the
  app for no benefit.
- **Build a new `imageQueryClient` for image queries only.** Rejected:
  introduces a second QueryClient instance, fragmenting the cache and
  breaking SC-005's "every state is testable" gate (tests would need to
  pick which client to inject).
- **Duplicate `computeRetryDelay`/`isFourXX` inline.** Rejected: drift
  hazard — a future change to the project retry policy would silently
  miss the image hook copy.
- **Use TanStack's `retry: 5` shorthand (number form).** Rejected: the
  shorthand does not let us skip 4xx via `isFourXX`, so a 401 or 404
  would burn the full 5-attempt budget before surfacing.

---

## R2 — Cache scope (in-memory only) and how to enforce it under tests

**Decision**: Use the existing singleton `queryClient` from
`apps/mobile/src/services/api/queryClient.ts` — no persister, no
`@tanstack/react-query-persist-client` wiring. Per FR-015, cross-session
persistence is deferred to a future holistic local-storage spec. The
in-memory cache's lifetime is the React Native JS context — i.e., until
the app is killed by the OS or hot-reloaded in dev.

In tests, each `useCardImagesQuery.test.ts` `it` block creates a fresh
`new QueryClient({ defaultOptions: { queries: { retry: false } } })` and
wraps the hook under test in a `QueryClientProvider`. This is the
canonical TanStack 5 test pattern and matches the existing
`useCardsInfiniteQuery.test.ts` setup in the same workspace.

**Rationale**:
1. The spec is explicit (Q3): "In-memory only for this feature, handled
   by the existing TanStack Query cache."
2. The existing queryClient.ts already constructs a singleton at module
   load — no additional configuration is needed. The new hook just calls
   `useQuery` under the existing provider mounted at
   `apps/mobile/app/_layout.tsx`.
3. Test isolation via fresh QueryClient per `it` block prevents inter-test
   bleed of cached responses — a constitution Principle III phase-gate
   concern. Reusing the production singleton in tests would let a
   `404` response cached by test A poison test B.

**Alternatives considered**:
- **Persist via `@tanstack/react-query-persist-client` to AsyncStorage.**
  Rejected: out of scope per Q3; explicitly deferred to a future
  holistic local-storage initiative.
- **Persist via `expo-secure-store`.** Rejected: same scope concern;
  also overkill for image URLs (non-sensitive data).
- **Per-component `useRef` cache.** Rejected: defeats FR-007 (request
  deduplication across multiple instances of the same card id) — every
  instance would maintain its own in-flight state.

---

## R3 — Server schema tightening: scope of `frontFaceImageUrl` removal

**Decision**: Drop `frontFaceImageUrl` from **both** `GET /cards` (list,
already implicit) **and** `GET /cards/:id` (single, currently populated by
`enrichCard`) response payloads. Also drop from the `Card` interface in
`packages/core/src/types/crud.ts` and from `CARD_RESPONSE_SCHEMA` in
`packages/core/src/schemas/card.ts`. Remove the now-orphaned
`scryfallNormalImageUrl` helper from `apps/server/src/services/cardService.ts`
(its only caller was `enrichCard`).

**Rationale**:
1. FR-014's "exclusive responsibility" wording: "Image-URL retrieval is
   the exclusive responsibility of the reusable card component (via
   `/cards/images/:id`)." Leaving `/cards/:id` returning the URL violates
   the "exclusive" framing — two paths to the same data.
2. The `Card` type is shared between server and mobile via
   `@my-binder/core`. Keeping `frontFaceImageUrl?: string` on the type
   while no endpoint returns it creates a phantom field — consuming code
   that reads `card.frontFaceImageUrl` would silently get `undefined`,
   which is worse than a TypeScript error.
3. The `scryfallNormalImageUrl` helper duplicates the URL construction
   already inside `providers/mtgjson/scryfallImages.ts:buildScryfallImageUrls`.
   Removing the duplicate (single source of truth in the provider) is
   in line with Principle I (Simplicity First) and IV (Single
   Responsibility).
4. The existing test at `cards.test.ts:137-153` is renamed and inverted to
   assert `body.frontFaceImageUrl === undefined` — this is the
   compliance test for the new contract.

**Alternatives considered**:
- **Keep `frontFaceImageUrl` on `/cards/:id` but drop from list.** Rejected:
  weakens FR-014's exclusivity, leaves two ways to fetch the same image,
  and forces every mobile consumer to choose between the lazy and eager
  paths case-by-case.
- **Keep `frontFaceImageUrl?` optional on the `Card` type even after
  removing the endpoint return.** Rejected: phantom field. Type safety
  is most valuable when it tracks the actual runtime contract.
- **Add a server-side env flag (`ENRICH_CARD_IMAGES=false`) to make the
  removal reversible.** Rejected: speculative complexity per Principle
  I; the spec is unambiguous (FR-014 + Q1).

---

## R4 — Four-layer component structure for `<Card />`

**Decision**: Use the established `apps/mobile/src/components/<feature>/`
four-layer pattern (Container → Hook → View + co-located theme), exactly
mirroring `apps/mobile/src/components/binder-home/`. The public export is
a barrel re-export of the container as `Card`:

```ts
// apps/mobile/src/components/card/index.ts
export { default as Card } from './CardContainer';
export type { CardFootprint, CardViewProps } from './types';
```

**Rationale**:
1. Constitution Principle X mandates the four-layer split for *every*
   mobile feature component, with the canonical reference being
   `binder-home/`. The new `<Card />` is not exempt.
2. Per Principle IX, the directory's `index.ts` is barrel-only — no
   declarations live there. Consumers write `import { Card } from
   '@src/components/card'`.
3. Co-located `CardView.theme.ts` follows the Style co-location rule
   (constitution v1.20.0). All `StyleSheet.create` for the card lives in
   the theme file; `CardView.tsx` only references the `useStyles()`
   output.

**Alternatives considered**:
- **Single-file component (`Card.tsx`).** Rejected: violates Principle
  X's four-layer rule.
- **Inline `<Card />` inside `BinderHomeView.tsx` (like today's
  `CardPocket`).** Rejected: defeats FR-001's "reusable across screens"
  primary goal.

---

## R5 — Variant selection: footprint → URL mapping

**Decision**: Selection happens **inside** `useCard.ts` after the
`useCardImagesQuery` result resolves. The hook receives `footprint:
'pocket' | 'detail'` from the container and returns the matching URL on
the view-props it emits. `CardView` receives a single `imageUrl: string`
prop (when loaded) and never sees the full `CardImages` object or the
variant logic.

```ts
// apps/mobile/src/components/card/useCard.ts
const variantForFootprint = (footprint: CardFootprint, images: CardImages): string =>
  footprint === 'pocket' ? images.medium : images.large;
```

**Rationale**:
1. Q2 + Q5 pin the mapping: `pocket → medium`, `detail → large`. Two
   footprints, two variants — the function is total.
2. Putting the selection in the hook (not the view) keeps `CardView`
   purely presentational per Principle X — it only ever knows about
   "the URL to render," not about image variants.
3. The hook's return value is memoised per the v1.16.0 Hook return-value
   rule; the URL is a primitive string and inherently identity-stable,
   so no extra `useMemo` is required.

**Alternatives considered**:
- **Pass `CardImages` into `CardView` and let it pick.** Rejected: View
  layer would need to know about footprints AND variant mapping, two
  responsibilities. Violates Principle IV.
- **Pick the variant inside `useCardImagesQuery` via a new
  `useCardImageUrl(id, variant)` signature.** Rejected: blends the
  fetch concern with the footprint concern; also wastes the cache when
  the same card is rendered at two different footprints on the same
  screen (e.g., pocket on the binder + detail in a peek overlay) —
  TanStack would create two cache keys for what is one server call.

---

## R6 — Backwards-compatible test-IDs for SC-006

**Decision**: `CardView.tsx` emits `testID="pocket-occupied"` on its
loaded state when `footprint === 'pocket'`, and `testID="card-loaded"` in
all footprints. Loading state emits both `testID="card-loading"` and (for
backward compat with the existing binder tests) **does not** emit
`pocket-empty` — page-level loading in `BinderHomeView` continues to
render `pocket-empty` for the empty-slot view at the *page* level, not
the card level.

**Rationale**:
1. SC-006 requires the spec 016 behavioural tests on `BinderHomeView`
   continue to pass without modification of the **assertions**. The
   existing test (`BinderHomeView.test.tsx`) looks for
   `screen.getAllByTestId('pocket-occupied').length === 9` on a 9-card
   page. The new `<Card />` rendered at `footprint='pocket'` must emit
   that same testID when loaded.
2. The `pocket-empty` testID is owned by the binder-home view itself
   (for the slot-with-no-card and the page-level-loading cases). The
   `<Card />` component never renders this testID — it's not its
   concern.
3. New testIDs (`card-loading`, `card-loaded`, `card-not-found`,
   `card-retry`) are additive — they coexist with the legacy
   `pocket-occupied` and give targeted hooks for the new
   `CardView.test.tsx` suite without forcing the spec 016 assertions to
   change.

**Alternatives considered**:
- **Replace `pocket-occupied` with `card-loaded` across the board.**
  Rejected: violates SC-006's "assertions unchanged" promise; would
  require touching every `BinderHomeView.test.tsx` test that uses
  `pocket-occupied` (8 sites).
- **Render `pocket-occupied` only when the parent is the binder
  home.** Rejected: requires the view to know its context — the entire
  point of the reusable component is *not* knowing.

---

## R7 — Dashed-border skeleton: visual reuse from `BinderHomeView.theme.ts`

**Decision**: Lift the existing dashed-border styles from
`BinderHomeView.theme.ts`'s `pocket` + `pocketEmpty` rules into the new
`CardView.theme.ts`. The current binder theme keeps a thin pass-through
that delegates to the card component's theme for the dashed-border tokens,
so a future change to the dashed border lands in one place.

The skeleton animation is a subtle pulse using React Native's `Animated`
API — no new dependency. A single `Animated.Value` interpolated against
opacity (0.6 → 1.0 → 0.6 on a 1.2s loop) gives a typical skeleton feel.

**Rationale**:
1. The dashed-border treatment is the canonical loading-state visual
   from the wireframe; reusing the tokens (border width, dash pattern,
   border radius, inner padding) preserves visual consistency across
   the binder and any future consumer.
2. Native `Animated` is already in use across the app (no new package);
   `react-native-reanimated` is mocked in `jest.setup.ts` but not
   required for this simple pulse — opacity interpolation works with
   the bundled `Animated` and runs on the JS thread without measurable
   cost for ≤9 simultaneous animations.
3. Centralising the dashed-border tokens in `CardView.theme.ts` means
   future visual tweaks (e.g., border thickness change, dash spacing
   adjustment) land in exactly one file — Principle IV's "one clear
   purpose per file."

**Alternatives considered**:
- **Add `moti` or `react-native-skeleton-placeholder` for the
  animation.** Rejected: new dependency for a 6-line animation. Fails
  Principle I (Simplicity First) and would require a Dependency
  Currency table entry.
- **Static (non-animated) skeleton.** Rejected: a static box reads as
  "nothing happened" to users on slow networks; the subtle pulse is
  what signals "still working."
- **Keep the tokens in `BinderHomeView.theme.ts` and import from the
  card.** Rejected: inverts the dependency direction (a reusable
  component should not depend on its consumer's theme file).

---

## R8 — Empty-pocket rendering boundary (US edge case)

**Decision**: The empty-pocket view (`testID="pocket-empty"`) stays
inside `BinderHomeView.tsx` — *not* moved into `<Card />`. The
binder-home view renders `<Card id={card.id} footprint="pocket" />` for
occupied slots and a local `<EmptyPocket />` (or the existing inline
`<View testID="pocket-empty" />`) for unoccupied slots.

**Rationale**:
1. Spec edge case ("Empty slot vs. loading slot") explicitly bounds
   empty-slot rendering as a *consuming screen* concern, out of scope
   for the reusable component.
2. The `<Card />` component requires a card id by contract — passing
   `undefined` would defeat its type safety. Empty pockets have no id.
3. The two states look similar (dashed border) but have different
   semantics: "loading" is transient and resolves to an image; "empty"
   is steady-state and never resolves. Conflating them in one component
   would force a confusing API ("if id is undefined, render empty,
   otherwise load and render").

**Alternatives considered**:
- **Add an `empty` footprint to `<Card />`.** Rejected: muddles the
  contract; `<Card empty />` reads as "a card with no card," which is
  not a card. Also adds a third footprint after Q5 explicitly pinned
  the count at two.
- **Make `id` optional on `<Card />`; render empty when absent.**
  Rejected: same conflation problem, plus weakens FR-001's "passing
  only a card id" rule by adding an undocumented "or omit it" path.

---

## Summary

All eight unresolved technical questions are now pinned with concrete
decisions, rationale, and rejected alternatives. The next phase
(`data-model.md`, `contracts/api.md`, `quickstart.md`) consumes these
decisions; the agent context update follows. No `NEEDS CLARIFICATION`
markers remain.
