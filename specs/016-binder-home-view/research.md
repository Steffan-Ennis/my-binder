# Research: Binder Home View

**Feature**: 016-binder-home-view
**Date**: 2026-05-10
**Phase**: 0 (Outline & Research)

The spec is fully clarified — there are no `NEEDS CLARIFICATION` markers to resolve. This
document records the technology and design decisions that shape the implementation,
specifically the ones that are not derivable from the spec alone or from spec 002.

---

## 1. Where the binder-search filter runs (client vs server)

**Decision**: Filter **client-side** in a pure function over the cards already loaded
into the TanStack Query cache.

**Rationale**:

- The spec caps the user's collection at 1 000 cards (SC-007 / spec 002 SC-007). A
  case-insensitive substring scan over 1 000 records is sub-millisecond on every device
  in the SDK 54 minimum target range; it is dominated by the keystroke debounce we are
  not even adding.
- Spec FR-005e mandates *live* filter on every keystroke. A round-trip per keystroke
  would be a fresh `/cards/search?...` request per character — wasteful, race-prone, and
  it would require a new server endpoint that this spec explicitly does not own.
- The collection is already in-memory: spec 002's `apiClient.getCards` returns the entire
  page (or eventually the full cursor-paginated stream) into the TanStack cache. Filtering
  what is already there avoids any new network surface.
- Simpler filter semantics (token AND across three fields) are easier to specify and test
  as a pure function than to coordinate between the mobile and the server.

**Alternatives considered**:

- **Server-side `/cards/search?q=...`**: rejected. Adds a new endpoint the spec doesn't
  own; introduces network latency on each keystroke; race-condition handling adds
  complexity (cancel-in-flight on each input change).
- **Hybrid (server-side at >N keystrokes, client-side under)**: rejected as premature
  optimisation; we have no evidence of the cliff.

---

## 2. Where the search-state lives

**Decision**: `useBinderHome.ts` owns the search state (`isSearchActive: boolean`,
`searchQuery: string`, `preSearchPage: number`) via local `useState`. The state is **not**
promoted to a Zustand store.

**Rationale**:

- Per Principle X, hook layer is the right home for UI state.
- The search state is **scoped to the Binder tab**. It does not need to survive a tab
  switch (Edge Case: "Header buttons … visible only on the Binder tab"); collapsing the
  search input on tab-leave is not a requirement, but the state is naturally scoped to
  the tab's mounted lifetime.
- Promoting it to `binderStore` would make the store a dumping ground for transient UI
  state and pollute its existing single-purpose `currentPage` contract.

**Alternatives considered**:

- **Add `searchQuery` and `isSearchActive` to `binderStore`**: rejected. Mixes UI and
  navigation concerns; makes the store untestable as a pure pagination model.
- **Hold state on a `useRef`**: rejected. The view re-renders on each keystroke must
  trigger; a ref does not.

---

## 3. Restoring the prior page on search-clear

**Decision**: `useBinderHome` captures `binderStore.currentPage` into a local
`preSearchPage` state when `onSearchOpen` fires; on `onSearchClear` it calls
`binderStore.setPage(preSearchPage, totalPages)` and clears `searchQuery`.

**Rationale**:

- Spec FR-005c / FR-005f / US3 acceptance #6 require the user to be returned to the page
  they were on immediately before the search. A local capture is the simplest correct
  model and survives all keystrokes within a search session.
- The capture is per-session (each `onSearchOpen` overwrites the previous capture). This
  matches the spec's "restore the page they were viewing immediately before opening the
  search input" wording — not a stack of historical positions.
- `binderStore.setPage` already clamps against `totalPages`, so a stale `preSearchPage`
  beyond the unfiltered total (which can never happen here, but defensively) is safe.

**Alternatives considered**:

- **Memoise `preSearchPage` from `searchQuery === ''` transitions**: rejected as
  fragile — depends on initialiser ordering and breaks if the view is unmounted between
  open and close.

---

## 4. Multi-token AND semantics across three fields

**Decision**: Implement a small pure function `binderSearch(cards, query)` that:

1. Trims and splits `query` on whitespace into tokens (`/\s+/`); empty input → return
   `cards` unchanged (no filter).
2. Lowercases each token once.
3. For each card, builds a single lowercased haystack of `name + " " + (setName ?? "") +
   " " + (setCode ?? "") + " " + (typeLine ?? "")`.
4. Card matches iff every token is a substring of that haystack.

**Rationale**:

- Concatenating the three fields into one haystack lets each token match against any of
  the three fields independently, which is exactly the semantics of spec FR-005a Clarification
  ("each token can match independently against any of the three fields").
- A single lowercased haystack per card avoids per-token, per-field branching and keeps
  the algorithm O(cards × tokens × len(haystack)), which is bounded by 1 000 × ~5 × ~80 =
  ~400 000 charcode compares per keystroke — well under one frame at 60Hz on the SDK 54
  target range.
- No quoted-phrase syntax (out of scope per spec).

**Alternatives considered**:

- **Per-field weighted scoring**: rejected. Spec explicitly says "no per-field weighting
  or ranking" (Clarifications §2026-05-10).
- **Trigram or fuzzy matching**: rejected. Substring is what the spec asks for; fuzzy
  introduces "why didn't this match?" surprises.

---

## 5. Forward-compatible mobile `Card` schema for the filter fields

**Decision**: Extend the mobile-side `CARD_SCHEMA` in `apps/mobile/src/services/api/schemas.ts`
to declare `setName`, `setCode`, and `typeLine` as **optional** strings. Keep
`additionalProperties: true` (already present) so the server can begin returning these
without a coordinated mobile deploy. The `Card` TypeScript type extends with the same
three optional fields.

**Rationale**:

- Spec FR-005a requires the filter to consider all three fields, but the server's
  `/cards` endpoint today returns only `{ id, name, createdAt, updatedAt }`. Treating the
  three filter fields as optional is correct: the spec's *Assumptions* delegate
  card-image and card-data sourcing to spec 001/014, and the binder will simply degrade
  to "name only" matching when the fields are absent.
- Marking them required would block this spec on a server-side enrichment, which is out
  of scope.

**Alternatives considered**:

- **Block this spec on a server-side `/cards` enrichment**: rejected. Introduces an
  inter-spec ordering dependency the user did not ask for. The spec's binder-home work
  can be tested end-to-end against a server that returns only `name`; the search will
  match only by name in that mode, which is still useful and observable.

---

## 6. Header bar rendered inside the BinderHomeView (not via Expo Router header)

**Decision**: Disable the default Expo Router header on the Binder tab only by setting
`headerShown: false` on `<Tabs.Screen name="binder" options={{ ... headerShown: false }} />`
in `apps/mobile/src/app/(authenticated)/(tabs)/_layout.tsx`. Render the binder-home
header bar **inside** `BinderHomeView`.

**Rationale**:

- Spec FR-005 requires the search input to **inline-replace** the masthead within the
  same crimson header bar, with the cream canvas + summary caption + binder page visible
  behind it. That kind of in-place collapse/expand is impossible with a per-screen header
  configured via `Tabs.Screen options.headerTitle` / `headerRight` because each is a
  separate `react-navigation` slot.
- The other tabs (`search`, `scan`, `profile`) currently render `<ComingSoonContainer />`
  which is happy with or without the default header; the spec only changes the binder
  tab so the other three are untouched.
- Keeping the header in-feature also lets the view host the whole search affordance
  (input, cancel control, focus management) without leaking handlers up into the layout
  file (which would breach the "Layout MUST NOT host feature business logic" half of
  Principle X).

**Alternatives considered**:

- **`Tabs.Screen options.header={() => <BinderHomeHeader />}`**: rejected. Adds an extra
  React tree boundary between the header and the canvas; complicates state plumbing
  (the header would need its own access to `useBinderHome`, breaking the single-hook
  rule).
- **Shared global header at the root Stack**: rejected. The other tabs do not need the
  binder masthead; a shared header would be conditionally rendered, which is the same
  complexity at a worse layer.

---

## 7. Paging mechanism (swipe + buttons)

**Decision**: Use `react-native-pager-view` ~7.0 (already installed) inside
`BinderHomeView`. The view binds:

- `<PagerView initialPage={currentPage - 1} onPageSelected={(e) => onPageChange(e.nativeEvent.position + 1)}>`
- `prev` / `next` pill buttons fire `onPrevPage` / `onNextPage` from the hook, which call
  `binderStore.{prevPage,nextPage}` (defined in spec 002).
- `offscreenPageLimit={1}` so only the immediately adjacent pages keep their decoded
  images in memory — bounds the binder's image-cache footprint at ≈3 pages × 9 cards.

**Rationale**:

- `react-native-pager-view` was selected by spec 002 specifically for this binder-home
  use case (60fps native paging at 1000-card scale). Using it now is the most
  spec-faithful path.
- The native pager's `onPageSelected` event fires after the swipe settles, which keeps
  the Zustand store and the pager in sync without re-rendering during the swipe itself.

**Alternatives considered**:

- **`FlatList horizontal pagingEnabled`**: rejected. Lacks the dedicated lifecycle for
  an active "current" page (no equivalent of `offscreenPageLimit`), and per-frame
  scrollEvents would force the hook to throttle / debounce the store update.
- **`react-native-reanimated` + custom gesture-handler swipe**: rejected. Adds bespoke
  animation code for a use case the off-the-shelf pager already covers.

---

## 8. Sign-out reset of `binderStore.currentPage`

**Decision**: Have `useSignOutMutation.onSuccess` (spec 002 owner) call
`useBinderStore.getState().reset()` before the existing `queryClient.clear()` /
`useSessionStore.clearSession()` chain. This is a one-line addition to the existing
hook and is in scope for this spec because spec 002 left it out (the store existed
without a consumer).

**Rationale**:

- SC-007 / FR-023 require page-position memory to **survive backgrounding within the
  active session** but **reset on sign-out**. Backgrounding is free (the JS runtime
  retains the in-memory store); the sign-out reset must be explicit.

**Alternatives considered**:

- **Persist `currentPage` to `expo-secure-store`**: rejected. The spec only requires
  in-session persistence, not across launches; secure-store is overkill and would force
  an `await` on every page change.

---

## 9. No new dependencies

**Decision**: This spec adds **no new entries** under `dependencies`,
`devDependencies`, or `peerDependencies` in any `package.json`. Every required package
is already installed at the SDK 54-mandated version by spec 002.

**Rationale**: per Principle XI, the dependency-currency table is therefore intentionally
empty. The Constitution Check has nothing to flag.

---

## Summary of decisions

| # | Decision | Rationale tag |
|---|----------|---------------|
| 1 | Filter client-side (no new server endpoint) | Simplicity, latency, scope |
| 2 | Search state in `useBinderHome` (not Zustand) | Single-purpose store, scope |
| 3 | Capture `preSearchPage` on open, restore on close | Spec FR-005c / FR-005f |
| 4 | Multi-token AND, lowercased haystack | Spec FR-005a clarifications |
| 5 | Optional filter fields on the mobile `Card` schema | Forward-compatible, no inter-spec block |
| 6 | Header bar inside `BinderHomeView`, default header off | Spec FR-005 inline replacement |
| 7 | `react-native-pager-view` for paging + swipe | Spec 002 already selected it for this use case |
| 8 | Sign-out resets `binderStore.currentPage` | Spec FR-023 / SC-007 |
| 9 | No new dependencies | Principle XI clean |
