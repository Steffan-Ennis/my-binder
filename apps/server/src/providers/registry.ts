import type { ProviderInfo } from '@my-binder/core';
import type { CardProvider } from './interface';

/**
 * Thrown by `ProviderRegistry.setActive` when the named provider has not been
 * registered. Distinct from `ProviderRegistryUnreachableError` so callers can
 * differentiate "typo in name" from "provider is down".
 *
 * @example
 * ```ts
 * try {
 *   await registry.setActive('not-registered');
 * } catch (err) {
 *   if (err instanceof ProviderRegistryNotFoundError) {
 *     // 404 — name unknown
 *   }
 * }
 * ```
 */
export class ProviderRegistryNotFoundError extends Error {
  constructor(name: string) {
    super(`No provider registered with name "${name}".`);
    this.name = 'ProviderRegistryNotFoundError';
  }
}

/**
 * Thrown by `ProviderRegistry.setActive` when the named provider's
 * `isReachable()` probe returns false. The active provider is left unchanged.
 *
 * @example
 * ```ts
 * try {
 *   await registry.setActive('mtgjson');
 * } catch (err) {
 *   if (err instanceof ProviderRegistryUnreachableError) {
 *     // 503 — provider data layer is down
 *   }
 * }
 * ```
 */
export class ProviderRegistryUnreachableError extends Error {
  constructor(name: string) {
    super(`Provider "${name}" failed reachability check. Active provider unchanged.`);
    this.name = 'ProviderRegistryUnreachableError';
  }
}

/**
 * In-process registry that maps provider names to `CardProvider` instances and
 * tracks which one is currently active. There is one singleton per process
 * (`registry` below); the class is exported only to make tests easier.
 *
 * Lifetime: created once at server startup; providers register themselves; the
 * active provider is selected via `setActive` and read via `getActive` from
 * route handlers.
 *
 * @example
 * ```ts
 * import { registry } from '@src/providers/registry';
 * import { MtgjsonProvider } from '@src/providers/mtgjson';
 *
 * registry.register('mtgjson', new MtgjsonProvider(sdk));
 * await registry.setActive('mtgjson');
 *
 * const provider = registry.getActive();
 * await provider.lookup('Lightning Bolt');
 * ```
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, CardProvider>();
  private activeName: string | null = null;

  /**
   * Register a `CardProvider` under a given name. Overwrites any existing
   * entry for the same name without warning — caller is responsible for using
   * unique names. Does not change the active provider.
   *
   * @param name - Stable identifier for the provider (e.g. `"mtgjson"`).
   * @param provider - The `CardProvider` implementation instance.
   *
   * @example
   * ```ts
   * registry.register('mtgjson', new MtgjsonProvider(sdk));
   * ```
   */
  register(name: string, provider: CardProvider): void {
    this.providers.set(name, provider);
  }

  /**
   * Return the currently active `CardProvider`. Route handlers call this on
   * every request to obtain the provider to dispatch against.
   *
   * @returns The active `CardProvider` instance.
   * @throws Error when no active provider has been set, or when the active
   *   name has somehow disappeared from the map (defensive — should not
   *   happen in practice).
   *
   * @example
   * ```ts
   * const provider = registry.getActive();
   * const cards = await provider.lookup('Lightning Bolt');
   * ```
   */
  getActive(): CardProvider {
    if (this.activeName === null) throw new Error('No active provider set');
    const provider = this.providers.get(this.activeName);
    if (!provider) throw new Error(`Active provider "${this.activeName}" not found in registry`);
    return provider;
  }

  /**
   * Set the active provider by name. The provider's `isReachable()` probe is
   * invoked first; if it returns false, the active provider is left unchanged
   * and `ProviderRegistryUnreachableError` is thrown so callers get a clear
   * "the new provider is down" signal rather than a silent half-switch.
   *
   * @param name - Name previously passed to `register`.
   * @returns Resolves once `activeName` has been updated.
   * @throws ProviderRegistryNotFoundError when no provider is registered under `name`.
   * @throws ProviderRegistryUnreachableError when the named provider fails its reachability probe.
   *
   * @example
   * ```ts
   * await registry.setActive('mtgjson'); // succeeds → registry.getActive() now returns the mtgjson provider
   * await registry.setActive('typo');    // throws ProviderRegistryNotFoundError
   * ```
   */
  async setActive(name: string): Promise<void> {
    const provider = this.providers.get(name);
    if (!provider) throw new ProviderRegistryNotFoundError(name);
    const reachable = await provider.isReachable();
    if (!reachable) throw new ProviderRegistryUnreachableError(name);
    this.activeName = name;
  }

  /**
   * Describe the current registry state for the `GET /provider` route. Calls
   * `isReachable()` on the active provider so the response reflects live
   * status rather than the cached registration state.
   *
   * @returns A `ProviderInfo` object: `{ name: 'none', active: false, reachable: false }` when nothing is active, otherwise `{ name, active: true, reachable }`.
   *
   * @example
   * ```ts
   * const info = await registry.getProviderInfo();
   * // { name: 'mtgjson', active: true, reachable: true }
   * ```
   */
  async getProviderInfo(): Promise<ProviderInfo> {
    if (this.activeName === null) {
      return { name: 'none', active: false, reachable: false };
    }
    const provider = this.providers.get(this.activeName)!;
    const reachable = await provider.isReachable();
    return { name: this.activeName, active: true, reachable };
  }
}

/**
 * Process-wide singleton registry. Initialised once at server startup; every
 * route handler imports this exact instance.
 *
 * @example
 * ```ts
 * import { registry } from '@src/providers/registry';
 * registry.register('mtgjson', mtgjsonProvider);
 * await registry.setActive('mtgjson');
 * ```
 */
export const registry = new ProviderRegistry();