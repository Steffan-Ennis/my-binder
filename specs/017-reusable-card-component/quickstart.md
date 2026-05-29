# Quickstart: Using the reusable `<Card />` component

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data model**: [data-model.md](./data-model.md) | **Contracts**: [contracts/api.md](./contracts/api.md)

This is the field guide for engineers consuming the new
`apps/mobile/src/components/card/` component on any screen. It assumes
the component is built (post-`/speckit.implement`) and you want to drop
it into a new screen.

---

## Minimum viable adoption

```tsx
// apps/mobile/src/components/<feature>/<Feature>View.tsx
import { Card } from '@src/components/card';

// …inside your view…
<Card id="6ca7af0b-4b6a-59ba-90be-6da4f62bcff1" footprint="pocket" />
```

That's the whole API. The component:
- Issues `GET /cards/images/:id` automatically on mount (via TanStack).
- Renders a dashed-border-skeleton frame while loading (FR-002).
- Swaps to the rendered card image when loaded (FR-004).
- Renders a not-found fallback if the server returns 404 (FR-005).
- Renders an error fallback with a retry button if the request fails 5
  times in a row (FR-006).
- Deduplicates simultaneous requests for the same id (FR-007).
- Renders instantly from the warm cache on revisit within the same
  session (FR-008).

You do **not**:
- Fetch the image URL yourself.
- Pass an image URL through props.
- Wire any store or query hook.
- Configure retry policy.
- Handle the dashed-border-skeleton state.

---

## Props

```ts
type CardProps = {
  /** UUID of the owned card. Required. */
  id: string;
  /** Visual footprint preset. */
  footprint: 'pocket' | 'detail';
};
```

| Prop | Type | Required | Effect |
|---|---|---|---|
| `id` | `string` (UUID) | yes | Card id passed verbatim to `GET /cards/images/:id`. Changing `id` mid-render discards the in-flight response and starts fresh (FR-012). |
| `footprint` | `'pocket' \| 'detail'` | yes | `'pocket'` renders the medium image variant at the binder-pocket dimensions; `'detail'` renders the large variant at the single-card-detail dimensions. Two variants only — there is no thumbnail or full-bleed option (spec clarification Q5). |

There are no other props. The component does not expose an
`onPress` — wrap it in your own `<Pressable>` if you need tap
handling (the `<Card />` element is not a button; binder pockets are
tappable as a whole-cell affordance, not on the image alone).

---

## Common patterns

### A binder page (the canonical consumer)

```tsx
// Inside BinderHomeView.tsx
{currentPageCards.map((card) =>
  card === null
    ? <View key={slotIndex} style={styles.pocket} testID="pocket-empty" />
    : <Card key={card.id} id={card.id} footprint="pocket" />,
)}
```

Empty slots (no card assigned) are still rendered by the consuming
screen — the `<Card />` component itself never renders an "empty"
state because there is no card id to associate it with (spec edge
case "Empty slot vs. loading slot").

### A future card-detail screen

```tsx
// Inside CardDetailView.tsx (future spec)
<View style={styles.detailFrame}>
  <Card id={route.params.cardId} footprint="detail" />
</View>
```

The `detail` footprint uses the large image variant. The surrounding
frame controls the outer dimensions — `<Card />` fills its parent.

### A search-results row showing several cards

```tsx
<FlatList
  data={results}
  keyExtractor={(c) => c.id}
  renderItem={({ item }) => (
    <View style={styles.row}>
      <Card id={item.id} footprint="pocket" />
      <Text>{item.name}</Text>
    </View>
  )}
/>
```

Cache deduplication (FR-007) means that if a card already appeared
elsewhere on the screen (e.g., in a recently-viewed strip), the
search-results row renders from the warm cache instantly.

---

## What states will the user see?

| State | Visual | When |
|---|---|---|
| Loading | Dashed border + animated skeleton fill | `id` just changed; image not yet in cache |
| Loaded | Full card image filling the dashed-border footprint | Image successfully retrieved |
| Not found | Dashed border + small "?" glyph + "Card not found" caption | Server returned 404 (FR-005) |
| Error | Dashed border + small "!" glyph + "Couldn't load" caption + tappable "Retry" affordance | 5 retries exhausted (FR-006) |

All four states share the same outer dimensions — there is zero layout
shift when transitioning between them (FR-011, SC-004).

---

## Testing your consumer

Tests for screens that embed `<Card />` MUST wrap their render in a
`QueryClientProvider` (the component issues a `useQuery` under the
hood). The standard pattern:

```tsx
// MyScreenView.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const defaults: MyScreenViewProps = { /* … */ };

const MyScreenViewWithDefaults: FC<Partial<MyScreenViewProps>> = (overrides) => {
  // Per constitution v1.24.0 — wrapper is a real component, not a render helper.
  // QueryClient is re-created per render to keep tests isolated.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <MyScreenView {...defaults} {...overrides} />
    </QueryClientProvider>
  );
};

describe('MyScreenView with embedded Card', () => {
  it('renders the loading state for an unknown card id', () => {
    const screen = render(<MyScreenViewWithDefaults cards={[mockCard]} />);
    expect(screen.getByTestId('card-loading')).toBeTruthy();
  });
});
```

`<Card />` exposes the following test IDs (R6 of `research.md`):

| testID | When |
|---|---|
| `card-loading` | Loading state (all footprints) |
| `card-loaded` | Loaded state (all footprints) |
| `pocket-occupied` | Loaded state at `footprint='pocket'` only — for SC-006 backward compat with spec 016 binder tests |
| `card-not-found` | Server returned 404 |
| `card-error` | All 5 retries exhausted |
| `card-retry` | User-tap retry affordance inside the error state |

To stub the image fetch for a test, **do not** mock `apiClient` — instead
pre-seed the `QueryClient`:

```tsx
queryClient.setQueryData(['cards', 'images', mockCard.id], {
  small: 'https://example/s.jpg',
  medium: 'https://example/m.jpg',
  large: 'https://example/l.jpg',
});
```

This drives the component into the `loaded` state without any network
call, satisfying SC-005's "no real network calls" requirement.

---

## Anti-patterns to avoid

- **Passing image URL as a prop.** The component owns image
  retrieval — passing a URL bypasses the cache, the retry policy, and
  the 404 handling. (FR-001)
- **Adding a third footprint.** Q5 pinned the set at two. If a screen
  needs a thumbnail size, raise it as a new clarification — do not
  silently introduce a `footprint='thumbnail'` value.
- **Using `<Card />` for empty pockets.** The empty-pocket view is the
  consuming screen's concern; passing `id={undefined}` is a type error.
- **Wrapping `<Card />` in a `<Suspense>` boundary.** TanStack Query 5
  supports suspense mode, but this component uses the imperative
  `isLoading` path so consumers can render fallback siblings (e.g., a
  page-level retry banner) at the right granularity.
- **Mocking `apiClient.getCardImages` in a test.** Prefer
  `queryClient.setQueryData` — it exercises the real component code
  paths and matches the constitution's no-mock-the-service-under-test
  principle for view tests.
