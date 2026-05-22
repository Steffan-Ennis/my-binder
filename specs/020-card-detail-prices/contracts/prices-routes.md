# Contract — Server price routes (spec 020)

The mobile `apiClient` already **calls** these paths (`getCardPrices`, `getCardPriceHistory`), and
the wire response types/schemas exist in `@my-binder/core`. The **routes themselves do not yet
exist** server-side, and `MtgjsonProvider.getPrices` / `getPriceHistory` currently throw. This
feature implements all three layers (route → service → provider).

## `GET /cards/:id/prices`

- **Auth**: required (same gate as `GET /cards/:id`). 401 `AUTH_INVALID_TOKEN` / 403 `AUTH_NOT_ALLOWLISTED`.
- **Params**: `id` — MTGJSON printing UUID.
- **200** → `CardPricesResponse`:
  ```json
  {
    "printingId": "6ca7af0b-…",
    "cardKingdom": { "source": "CARD_KINGDOM", "amountCents": 1723, "currency": "USD", "observedOn": "2026-05-22" },
    "tcgPlayer":  { "source": "TCG_PLAYER",  "amountCents": 1638, "currency": "USD", "observedOn": "2026-05-22" }
  }
  ```
  - A source with no observation → that field is `null` (FR-004). Never `0`, never a Goldfish field.
  - Latest **paper-retail** observation per source, finish `normal`, priceType `retail`. **Physical only** (FR-006/SC-003).
- **404** `NOT_FOUND` — unknown printing id.
- Validated against `CARD_PRICES_RESPONSE_SCHEMA` (Fastify response schema + mobile Ajv).

## `GET /cards/:id/prices/history?days=30`

- **Auth**: required (as above).
- **Params**: `id` — printing UUID. **Query**: `days` — window length; default `30`.
- **200** → `CardPriceHistoryResponse`:
  ```json
  {
    "printingId": "6ca7af0b-…",
    "days": 30,
    "cardKingdom": [ { "observedOn": "2026-04-23", "amountCents": 1699 }, … ],
    "tcgPlayer":   [ { "observedOn": "2026-04-23", "amountCents": 1610 }, … ]
  }
  ```
  - Each series is the source's observations over the last `days` calendar days ending today.
  - Missing days are simply absent points (the mobile layer renders them as gaps, FR-004).
  - Both series empty is a valid `200` (mobile renders the "no recent price data" annotation).
- **404** `NOT_FOUND` — unknown printing id.
- Validated against `CARD_PRICE_HISTORY_RESPONSE_SCHEMA`.

## Layering

```
routes/cards.ts            GET /cards/:id/prices            → cardService.getPrices(id)
                           GET /cards/:id/prices/history    → cardService.getPriceHistory(id, days)
services/cardService.ts    getPrices(id) / getPriceHistory(id, days)   → providerRegistry.getActive().getPrices / getPriceHistory
providers/mtgjson/         getPrices(uuid)        → sdk.prices.today  (cardkingdom, tcgplayer; normal/retail; physical)
  MtgjsonProvider.ts       getPriceHistory(uuid, days) → sdk.prices.history (same keys; window = days)
```

- Route registration order: register `/cards/:id/prices` and `/cards/:id/prices/history` **before**
  the generic `/cards/:id` so Fastify matches the literal segments first (same precaution the
  existing `/cards/:id/images` route uses).
- Provider JSDoc (Principle IX) updated: replace the "not implemented (pending spec 018 US3)"
  `@throws` note with the real `@returns` / `@example` for each method.
- Server route tests (`cards.test.ts`): real `DataSource` + offline-mode MTGJSON SDK as the active
  provider; seed via `apps/server/testing/*Factory.ts`; assert the validated shapes, the `null`/`[]`
  no-observation cases, the auth gate, and 404.
