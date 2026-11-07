import { describe, expect, it, vi } from 'vitest';
import {
  CloudflareWorkersDeploymentConfig,
  ProviderIncompatibilityException,
  TargetProviders,
} from '@opspilot/domain';
import { CloudflareWorkersProvider } from '../src/providers/cloudflare-workers.provider.js';
import { ICloudflareApiClient } from '../src/collaborators/cloudflare-api-client.interface.js';

describe('CloudflareWorkersProvider', () => {
  const dummyToken = 'cf_token_0123456789abcdef0123456789abcdef';
  const dummyAccountId = 'cf_acc_1122334455667788';

  const mockApiClient: ICloudflareApiClient = {
    verifyToken: vi.fn().mockResolvedValue({ valid: true, status: 'active', tokenId: 'tok-1' }),
    listAccounts: vi.fn().mockResolvedValue([{ id: dummyAccountId, name: 'Acme Corp' }]),
    probeCapabilities: vi.fn().mockResolvedValue({
      workers: true,
      pages: true,
      tail: true,
      customDomains: true,
      d1: true,
      kv: true,
      r2: true,
    }),
    uploadScriptVersion: vi.fn().mockResolvedValue({
      id: 'version-uuid-1',
      number: 1,
      created_on: '2026-11-08T00:00:00Z',
    }),
    deployScriptVersion: vi.fn().mockResolvedValue({
      id: 'deployment-uuid-1',
      created_on: '2026-11-08T00:00:00Z',
      versions: [{ version_id: 'version-uuid-1', percentage: 100 }],
    }),
    getScriptDeployments: vi.fn().mockResolvedValue([
      {
        id: 'deployment-uuid-1',
        created_on: '2026-11-08T00:00:00Z',
        versions: [{ version_id: 'version-uuid-1', percentage: 100 }],
      },
    ]),
    getScriptVersions: vi.fn().mockResolvedValue([]),
    syncScriptSecrets: vi.fn().mockResolvedValue(undefined),
    createTailSession: vi.fn().mockResolvedValue({
      id: 'tail-uuid-1',
      url: 'wss://tail.cloudflare.com/session-1',
      expiresAt: new Date(Date.now() + 3600_000),
    }),
    getOrCreatePagesProject: vi.fn(),
    createPagesDirectUploadDeployment: vi.fn(),
    getPagesDeployment: vi.fn(),
    rollbackPagesDeployment: vi.fn(),
    queryWorkersAnalytics: vi.fn(),
  };

  const validConfig: CloudflareWorkersDeploymentConfig = {
    deploymentId: 'a0000000-0000-4000-8000-000000000001',
    organizationId: 'b0000000-0000-4000-8000-000000000001',
    projectId: 'c0000000-0000-4000-8000-000000000001',
    serviceId: 'd0000000-0000-4000-8000-000000000001',
    deploymentTargetId: 'e0000000-0000-4000-8000-000000000001',
    environment: 'production',
    commitSha: '0123456789abcdef0123456789abcdef01234567',
    branch: 'main',
    healthcheckPath: '/health',
    targetProvider: 'cloudflare_workers',
    buildStrategy: 'cloudflare_worker_bundle',
    artifactType: 'worker_bundle',
    applicationRuntime: 'v8_isolate',
    scriptName: 'payment-processor',
    mainEntrypoint: 'src/index.ts',
    compatibilityDate: '2026-11-01',
    compatibilityFlags: ['nodejs_compat'],
    environmentVariables: { NODE_ENV: 'production' },
    secrets: { STRIPE_KEY: 'sk_live_secret_key' },
    kvBindings: { CACHE: 'kv_namespace_id_1' },
    d1Bindings: { DB: 'd1_db_id_1' },
    r2Bindings: { BUCKET: 'r2_bucket_name_1' },
  };

  it('declares accurate capabilities conforming to ADR-0014', () => {
    const provider = new CloudflareWorkersProvider(mockApiClient);

    expect(provider.providerType).toBe(TargetProviders.CLOUDFLARE_WORKERS);
    expect(provider.capabilities.supportsContainers).toBe(false);
    expect(provider.capabilities.supportsEdgeFunctions).toBe(true);
    expect(provider.capabilities.supportsTrafficWeighting).toBe(true);
    expect(provider.capabilities.supportsInstantRollback).toBe(true);
    expect(provider.capabilities.requiresPortBinding).toBe(false);
  });

  it('validates connection and permissions successfully', async () => {
    const provider = new CloudflareWorkersProvider(mockApiClient);
    const conn = await provider.validateConnection(
      { apiToken: dummyToken },
      { accountId: dummyAccountId },
    );

    expect(conn.connected).toBe(true);
    expect(conn.providerVersion).toContain('Cloudflare Workers');
  });

  it('rejects connection if account lacks Workers Scripts permission', async () => {
    const limitedClient = {
      ...mockApiClient,
      probeCapabilities: vi.fn().mockResolvedValue({
        workers: false,
        pages: true,
        tail: false,
        customDomains: false,
        d1: false,
        kv: false,
        r2: false,
      }),
    };

    const provider = new CloudflareWorkersProvider(limitedClient);
    const conn = await provider.validateConnection(
      { apiToken: dummyToken },
      { accountId: dummyAccountId },
    );

    expect(conn.connected).toBe(false);
    expect(conn.error).toContain("API token lacks 'Workers Scripts: Edit' permission");
  });

  it('prepares worker deployment with mapped bindings and immutable digest', async () => {
    const provider = new CloudflareWorkersProvider(mockApiClient);
    const prepared = await provider.prepareDeployment(validConfig);

    expect(prepared.targetProvider).toBe(TargetProviders.CLOUDFLARE_WORKERS);
    expect(prepared.targetArtifactId).toBe('payment-processor:01234567');
    expect(prepared.artifact.artifactType).toBe('worker_bundle');
    expect(prepared.artifact.digest).toMatch(/^sha256:[a-f0-9]{64}$/);

    const bindings = prepared.providerMetadata.bindings;
    expect(bindings.length).toBe(4); // 1 env var + 1 KV + 1 D1 + 1 R2
    expect(bindings.find((b: any) => b.name === 'CACHE')?.type).toBe('kv_namespace');
    expect(bindings.find((b: any) => b.name === 'DB')?.type).toBe('d1');
    expect(bindings.find((b: any) => b.name === 'BUCKET')?.type).toBe('r2_bucket');
  });

  it('throws ProviderIncompatibilityException for invalid config target', async () => {
    const provider = new CloudflareWorkersProvider(mockApiClient);
    const invalidConfig = { ...validConfig, targetProvider: 'aws_ecs' } as any;

    await expect(provider.prepareDeployment(invalidConfig)).rejects.toThrowError(
      ProviderIncompatibilityException,
    );
  });

  it('deploys worker version with 100% traffic shift and synchronizes secrets', async () => {
    const provider = new CloudflareWorkersProvider(mockApiClient);
    const prepared = await provider.prepareDeployment(validConfig);

    const result = await provider.deploy(prepared, {
      apiToken: dummyToken,
      accountId: dummyAccountId,
    });

    expect(mockApiClient.syncScriptSecrets).toHaveBeenCalledWith(
      dummyAccountId,
      'payment-processor',
      validConfig.secrets,
      dummyToken,
    );
    expect(mockApiClient.uploadScriptVersion).toHaveBeenCalled();
    expect(mockApiClient.deployScriptVersion).toHaveBeenCalledWith(
      dummyAccountId,
      'payment-processor',
      [{ versionId: 'version-uuid-1', percentage: 100 }],
      dummyToken,
    );

    expect(result.success).toBe(true);
    expect(result.providerDeploymentId).toBe('deployment-uuid-1');
    expect(result.versionIdentifier).toBe('version-uuid-1');
    expect(result.deployedUrl).toContain('payment-processor');
  });

  it('executes instant rollback via traffic weighting', async () => {
    const provider = new CloudflareWorkersProvider(mockApiClient);
    const rollbackRes = await provider.rollback(
      validConfig.deploymentId,
      'previous-version-uuid-99',
      {
        apiToken: dummyToken,
        accountId: dummyAccountId,
        scriptName: 'payment-processor',
      },
    );

    expect(mockApiClient.deployScriptVersion).toHaveBeenCalledWith(
      dummyAccountId,
      'payment-processor',
      [{ versionId: 'previous-version-uuid-99', percentage: 100 }],
      dummyToken,
    );

    expect(rollbackRes.success).toBe(true);
    expect(rollbackRes.restoredArtifactId).toBe('previous-version-uuid-99');
  });

  it('verifies health check endpoint status', async () => {
    const provider = new CloudflareWorkersProvider(mockApiClient);

    const healthy = await provider.checkHealth('https://payment-processor.workers.dev/health');
    expect(healthy.isHealthy).toBe(true);
    expect(healthy.httpStatusCode).toBe(200);

    const unhealthy = await provider.checkHealth('https://unhealthy-payment-processor.workers.dev/health');
    expect(unhealthy.isHealthy).toBe(false);
    expect(unhealthy.httpStatusCode).toBe(500);
  });
});
