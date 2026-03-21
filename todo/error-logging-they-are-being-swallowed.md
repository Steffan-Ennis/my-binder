# Error Logging — Errors Are Being Swallowed

Errors from the provider layer and service layer are being swallowed silently in some paths.

## Problem

The current error handling catches exceptions and re-throws typed errors (e.g. `ProviderUnavailableError`), but the original error is lost — nothing logs it before it is discarded. This makes debugging production failures difficult.

## Examples

`cardService.ts` — `lookupCard`:
```ts
} catch (err) {
  // Original error is never logged before being replaced
  throw new ProviderUnavailableError();
}
```

`cardService.ts` — `searchCards`:
```ts
} catch {
  // Error is not even captured, let alone logged
  throw new ProviderUnavailableError();
}
```

## What to Fix

- Log the original error (at `error` level) before re-throwing a translated error
- Ensure the Fastify error handler logs unexpected errors it catches
- Consider a structured logging approach so errors include context (route, provider name, card name)

## Scope

- `apps/server/src/services/cardService.ts`
- `apps/server/src/routes/cards.ts` (error handler)
- `apps/server/src/routes/provider.ts` (error handler)
