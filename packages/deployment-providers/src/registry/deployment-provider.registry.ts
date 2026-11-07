import {
  DeploymentCapabilities,
  ProviderIncompatibilityException,
  TargetProvider,
} from '@opspilot/domain';
import { IDeploymentProvider } from '../interfaces/deployment-provider.interface.js';

export class DeploymentProviderRegistry {
  private readonly providers = new Map<TargetProvider, IDeploymentProvider>();

  registerProvider(provider: IDeploymentProvider): void {
    if (this.providers.has(provider.providerType)) {
      throw new Error(`Deployment provider for '${provider.providerType}' is already registered`);
    }
    this.providers.set(provider.providerType, provider);
  }

  getProvider(targetProvider: TargetProvider): IDeploymentProvider {
    const provider = this.providers.get(targetProvider);
    if (!provider) {
      throw new ProviderIncompatibilityException(
        targetProvider,
        `No deployment provider registered for target provider '${targetProvider}'`
      );
    }
    return provider;
  }

  hasProvider(targetProvider: TargetProvider): boolean {
    return this.providers.has(targetProvider);
  }

  getSupportedProviders(): readonly TargetProvider[] {
    return Array.from(this.providers.keys());
  }

  getAllCapabilities(): readonly DeploymentCapabilities[] {
    return Array.from(this.providers.values()).map((p) => p.capabilities);
  }

  clear(): void {
    this.providers.clear();
  }

  static createDefault(customProviders?: IDeploymentProvider[]): DeploymentProviderRegistry {
    const registry = new DeploymentProviderRegistry();
    if (customProviders) {
      for (const p of customProviders) {
        registry.registerProvider(p);
      }
    }
    return registry;
  }
}
