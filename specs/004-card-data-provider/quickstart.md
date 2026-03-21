# Quickstart: Card Data Provider

**Feature**: 004-card-data-provider
**Date**: 2026-03-21

This guide validates that the card data provider layer is correctly installed and working.

---

## Prerequisites

- Node 22 installed (`node --version` should print `v22.x.x`)
- Server dependencies installed: `cd server && npm install`
- `CARD_PROVIDER` environment variable set (or defaulting to `"mtgjson"`)
- Outbound internet access available for first-run MTGJSON data sync

---

## Step 1 — Start the Server

```bash
cd server
node index.js
```

Expected output:
```
[server] Listening on http://localhost:3000
[provider] Active provider: mtgjson
[provider] MTGJSON SDK initialised (DuckDB ready)
```

The first start may take 30–60 seconds while the MTGJSON SDK syncs Parquet data from the
CDN. Subsequent starts are fast if the DuckDB cache volume is persisted.

---

## Step 2 — Health Check (includes provider)

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{ "status": "ok", "provider": "mtgjson", "providerReachable": true }
```

---

## Step 3 — Look Up a Known Card

```bash
curl "http://localhost:3000/cards/lookup?name=Lightning+Bolt"
```

Expected response (abbreviated):
```json
{
  "found": true,
  "cards": [
    {
      "name": "Lightning Bolt",
      "set": "M11",
      "cardNumber": "149",
      "manaCost": "{R}",
      "colorIdentity": ["R"],
      "commanderLegal": true,
      "imageRef": "..."
    }
  ]
}
```

---

## Step 4 — Look Up a Non-Existent Card

```bash
curl "http://localhost:3000/cards/lookup?name=Completely+Fake+Card+Name"
```

Expected response:
```json
{ "found": false, "name": "Completely Fake Card Name" }
```

---

## Step 5 — Check Commander Legality

```bash
# Legal card
curl "http://localhost:3000/cards/legality?name=Sol+Ring"
# Expected: { "legal": true, "reason": null, ... }

# Banned card
curl "http://localhost:3000/cards/legality?name=Black+Lotus"
# Expected: { "legal": false, "reason": "Banned in Commander", ... }

# Colour identity conflict (Counterspell in a Red/Green deck)
curl "http://localhost:3000/cards/legality?name=Counterspell&commander_colors=R,G"
# Expected: { "legal": false, "reason": "Colour identity conflict", ... }
```

---

## Step 6 — Search the Catalogue

```bash
# Red cards with CMC ≤ 2
curl "http://localhost:3000/cards/search?colors=R&cmc_max=2"
# Expected: { "cards": [...], "total": N, "page": 1, ... }
```

---

## Step 7 — Check Active Provider

```bash
curl http://localhost:3000/provider
# Expected: { "name": "mtgjson", "active": true, "reachable": true }
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Slow first start | MTGJSON initial sync | Wait; ensure outbound internet access |
| `PROVIDER_UNAVAILABLE` on all requests | SDK failed to initialise | Check logs; ensure DuckDB cache dir is writable |
| Empty search results | Filters too restrictive | Relax one filter at a time |
| `found: false` for a known card | Name typo or card not in MTGJSON | Try fuzzy search or check MTGJSON catalogue |
