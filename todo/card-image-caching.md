# Card Image Caching

## Background

Card images are sourced from the Scryfall CDN using the `scryfallId` returned in `CardRecord.imageRef`.
The Scryfall API has a hard rate limit and strict usage requirements — images **must not** be fetched
on-demand for every request.

## Scryfall Rate Limits

From https://scryfall.com/docs/api:

- **10 requests/second maximum** (50–100 ms between requests)
- Exceeding this returns `HTTP 429 Too Many Requests`
- Persistent violations result in a **temporary or permanent IP ban**
- Scryfall asks that all data (including images) is **cached for at least 24 hours**

Note: the `*.scryfall.io` file origin (where card images are served from) does not have the same
rate limit as the API endpoints, but caching is still required by their usage policy.

## Requirement

Images must be fetched from Scryfall once and stored locally. On subsequent requests for the same
card, the stored image is served — Scryfall is never called again for that card.

**Only cache images for cards that have a physical printing** — `CardRecord.imageRef` is only set
when the card has `availability: ["paper"]`, so this is already enforced at the data layer. Do not
attempt to cache images for digital-only cards.

## Implementation Sketch

1. On first request for a card image (identified by `scryfallId`):
   - Fetch `https://api.scryfall.com/cards/{scryfallId}?format=image` from Scryfall
   - Store the image bytes to a local path (e.g. `data/images/{scryfallId}.jpg`)
   - Return the stored image
2. On subsequent requests: serve from local storage, no Scryfall call
3. The server exposes `GET /images/:scryfallId` which handles the fetch-or-serve logic
4. The image store path should be configurable via an env var (e.g. `IMAGE_CACHE_DIR`,
   default `./data/images`) and mounted as a Docker volume for persistence

## Bulk Pre-fetch Estimate (small format, all physical printings)

Figures are based on live data queried from Scryfall on 2026-03-22.

| | |
|---|---|
| Physical paper printings | **93,144** (`game:paper`, `unique=prints`) |
| Small image size (146×204 px JPEG) | **~13 KB** (sampled: Lightning Bolt 13.9 KB, Sol Ring 13.4 KB, Plains 12.7 KB) |
| **Total storage** | **~1.2 GB** (93,144 × 13 KB) |
| Time at 10 req/s (API rate limit) | **~2.6 hours** (9,314 seconds) |
| Time at 20 req/s (CDN, no stated limit) | **~1.3 hours** |

Notes:
- `*.scryfall.io` (the CDN serving images) has no stated rate limit — faster bulk fetching is
  possible, but rate-limiting to 10–20 req/s is recommended to avoid IP blocks
- A small number of printings have placeholder/missing images (`image_status: placeholder`) —
  these should be skipped and re-attempted when real scans become available
- New sets release ~4–6 times per year, adding a few hundred printings each time — incremental
  fetching at release is trivial compared to the initial bulk load

## Scryfall Image URL Format

```
https://cards.scryfall.io/normal/front/{first_char}/{second_char}/{scryfallId}.jpg
```

Example:
```
https://cards.scryfall.io/normal/front/e/3/e3285fd6-conf-4b9c-8c77-example.jpg
```

Available sizes: `small`, `normal`, `large`, `png`, `art_crop`, `border_crop`

## Image Usage Rules (from Scryfall)

- Do not cover the artist name or copyright notice
- Do not distort, blur, sharpen, watermark, or alter the colours of card images
- For cropped artwork, the artist and source must be identifiable elsewhere in the UI

## Related

- `CardRecord.imageRef` — the `scryfallId` field populated by `MtgjsonProvider.enrichCard()`
- `apps/server/docs/card-data-provider.md` — provider architecture
