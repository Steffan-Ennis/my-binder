import type { ProviderInfo } from '@my-binder/core';
import type { CardProvider } from './interface';

export class ProviderRegistryNotFoundError extends Error {
  constructor(name: string) {
    super(`No provider registered with name "${name}".`);
    this.name = 'ProviderRegistryNotFoundError';
  }
}

export class ProviderRegistryUnreachableError extends Error {
  constructor(name: string) {
    super(`Provider "${name}" failed reachability check. Active provider unchanged.`);
    this.name = 'ProviderRegistryUnreachableError';
  }
}

export class ProviderRegistry {
  private readonly providers = new Map<string, CardProvider>();
  private activeName: string | null = null;

  register(name: string, provider: CardProvider): void {
    this.providers.set(name, provider);
  }

  getActive(): CardProvider {
    if (this.activeName === null) throw new Error('No active provider set');
    const provider = this.providers.get(this.activeName);
    if (!provider) throw new Error(`Active provider "${this.activeName}" not found in registry`);
    return provider;
  }

  async setActive(name: string): Promise<void> {
    const provider = this.providers.get(name);
    if (!provider) throw new ProviderRegistryNotFoundError(name);
    const reachable = await provider.isReachable();
    if (!reachable) throw new ProviderRegistryUnreachableError(name);
    this.activeName = name;
  }

  async getProviderInfo(): Promise<ProviderInfo> {
    if (this.activeName === null) {
      return { name: 'none', active: false, reachable: false };
    }
    const provider = this.providers.get(this.activeName)!;
    const reachable = await provider.isReachable();
    return { name: this.activeName, active: true, reachable };
  }
}

// Singleton registry — initialised once at server startup.
export const registry = new ProviderRegistry();
