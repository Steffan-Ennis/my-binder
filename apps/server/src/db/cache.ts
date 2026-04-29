// eslint-disable-next-line @typescript-eslint/no-require-imports
const abstractCache = require('abstract-cache') as (opts: { useAwait: boolean }) => unknown;

// abstract-cache in-memory backend — created once, shared across all requests.
// Swap for abstract-cache-redis in future if multi-instance caching is needed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const appCache: any = abstractCache({ useAwait: true });
