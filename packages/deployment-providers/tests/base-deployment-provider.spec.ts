import { describe, expect, it } from 'vitest';
import {
  ConnectionResult,
  DeploymentCapabilities,
  DeploymentConfig,
  DeploymentResult,
  DeploymentStatusResult,
  HealthCheckResult,
  PreparedDeployment,
  RollbackResult,
  TargetProviders,
  TenantIsolationException,
} from '@opspilot/domain';
import { BaseDeploymentProvider } from '../src/index.js';

class TestDeploymentProvider extends BaseDeploymentProvider {
  readonly providerType = TargetProviders.AWS_ECS;
  readonly capabilities = {} as DeploymentCapabilities;

  async validateConnection(): Promise<ConnectionResult> {
    return { connected: true, latencyMs: 1 };
  }
  async prepareDeployment(): Promise<PreparedDeployment> {
    throw new Error('Not implemented');
  }
  async deploy(): Promise<DeploymentResult> {
    throw new Error('Not implemented');
  }
  async getStatus(): Promise<DeploymentStatusResult> {
    throw new Error('Not implemented');
  }
  async rollback(): Promise<RollbackResult> {
    throw new Error('Not implemented');
  }
  async checkHealth(): Promise<HealthCheckResult> {
    throw new Error('Not implemented');
  }

  public testTenantValidation(expectedOrgId: string, resourceOrgId: string): void {
    this.validateTenantContext(expectedOrgId, resourceOrgId);
  }

  public testNormalizeError(error: unknown, fallback: string) {
    return this.normalizeError(error, fallback);
  }
}

describe('BaseDeploymentProvider Cross-Cutting Concerns', () => {
  const provider = new TestDeploymentProvider();

  it('passes tenant validation when organizationIds match', () => {
    expect(() => provider.testTenantValidation('org-123', 'org-123')).not.toThrow();
  });

  it('throws TenantIsolationException when organizationIds do not match', () => {
    expect(() => provider.testTenantValidation('org-123', 'org-456')).toThrow(TenantIsolationException);
  });

  it('throws TenantIsolationException when organizationId is missing', () => {
    expect(() => provider.testTenantValidation('org-123', '')).toThrow(TenantIsolationException);
  });

  it('normalizes errors and sanitizes embedded secrets', () => {
    const rawError = new Error('Failed to connect with Bearer abc123def456secrettoken to https://api.internal');
    const normalized = provider.testNormalizeError(rawError, 'Provider failure');

    expect(normalized.message).toContain('Provider failure');
    expect(normalized.message).not.toContain('abc123def456secrettoken');
    expect(normalized.message).toContain('[REDACTED_TOKEN]');
  });
});
