import { describe, expect, it } from 'vitest';
import { TargetProviders } from '@opspilot/domain';
import {
  AwsEcsProvider,
  DeploymentProviderRegistry,
  VpsDockerProvider,
} from '../src/index.js';

describe('DeploymentProviderRegistry', () => {
  it('registers and retrieves providers polymorphically', () => {
    const registry = new DeploymentProviderRegistry();
    const ecsProvider = new AwsEcsProvider();
    const vpsProvider = new VpsDockerProvider();

    registry.registerProvider(ecsProvider);
    registry.registerProvider(vpsProvider);

    expect(registry.hasProvider(TargetProviders.AWS_ECS)).toBe(true);
    expect(registry.hasProvider(TargetProviders.VPS_DOCKER)).toBe(true);
    expect(registry.hasProvider(TargetProviders.CLOUDFLARE_WORKERS)).toBe(false);

    expect(registry.getProvider(TargetProviders.AWS_ECS)).toBe(ecsProvider);
    expect(registry.getProvider(TargetProviders.VPS_DOCKER)).toBe(vpsProvider);
  });

  it('prevents duplicate provider registration', () => {
    const registry = new DeploymentProviderRegistry();
    registry.registerProvider(new AwsEcsProvider());
    expect(() => registry.registerProvider(new AwsEcsProvider())).toThrow(
      "Deployment provider for 'aws_ecs' is already registered"
    );
  });

  it('throws ProviderIncompatibilityException for unregistered providers', () => {
    const registry = new DeploymentProviderRegistry();
    expect(() => registry.getProvider(TargetProviders.CLOUDFLARE_PAGES)).toThrow();
  });

  it('exposes distinct capabilities per registered provider', () => {
    const registry = new DeploymentProviderRegistry();
    registry.registerProvider(new AwsEcsProvider());
    registry.registerProvider(new VpsDockerProvider());

    const capabilities = registry.getAllCapabilities();
    expect(capabilities).toHaveLength(2);
    expect(capabilities.every((c) => c.supportsContainers)).toBe(true);
    expect(capabilities.every((c) => !c.supportsInstantRollback)).toBe(true);
  });
});
