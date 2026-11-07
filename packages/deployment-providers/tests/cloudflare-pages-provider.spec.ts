import { describe, expect, it, vi } from 'vitest';
import {
  CloudflarePagesDeploymentConfig,
  ProviderIncompatibilityException,
  TargetProviders,
} from '@opspilot/domain';
import { CloudflarePagesProvider } from '../src/providers/cloudflare-pages.provider.js';
import { ICloudflareApiClient } from '../src/collaborators/cloudflare-api-client.interface.js';

describe('CloudflarePagesProvider', () => {
  const dummyToken = 'cf_token_0123456789abcdef0123456789abcdef';
  const dummyAccountId = 'cf_acc_1122334455667788';

  const mockApiClient: ICloudflareApiClient = {
    verifyToken: vi.fn().mockResolvedValue({ valid: true, status: 'active', tokenId: 'tok-pages-1' }),
    listAccounts: vi.fn().mockResolvedValue([{ id: dummyAccountId, name: 'Acme Corp' }]),
    probeCapabilities: vi.fn().mockResolvedValue({
      workers: true,
      pages: true,
      tail: false,
      customDomains: true,
      d1: false,
      kv: false,
      r2: false,
    }),
    uploadScriptVersion: vi.fn(),
    deployScriptVersion: vi.fn(),
    getScriptDeployments: vi.fn(),
    getScriptVersions: vi.fn(),
    syncScriptSecrets: vi.fn(),
    createTailSession: vi.fn(),
    getOrCreatePagesProject: vi.fn().mockResolvedValue({
      id: 'proj-uuid-1',
      name: 'marketing-portal',
      subdomain: 'marketing-portal.pages.dev',
      production_branch: 'main',
      created_on: '2026-11-08T00:00:00Z',
    }),
    createPagesDirectUploadDeployment: vi.fn().mockResolvedValue({
      id: 'pages-dep-uuid-1',
      short_id: 'dep1234',
      project_id: 'proj-uuid-1',
      project_name: 'marketing-portal',
      environment: 'production',
      url: 'https://dep1234.marketing-portal.pages.dev',
      created_on: '2026-11-08T00:00:00Z',
      latest_stage: { name: 'deploy', status: 'success' },
    }),
    getPagesDeployment: vi.fn().mockResolvedValue({
      id: 'pages-dep-uuid-1',
      short_id: 'dep1234',
      project_id: 'proj-uuid-1',
      project_name: 'marketing-portal',
      environment: 'production',
      url: 'https://dep1234.marketing-portal.pages.dev',
      created_on: '2026-11-08T00:00:00Z',
      latest_stage: { name: 'deploy', status: 'success' },
      stages: [{ name: 'deploy', status: 'success' }],
    }),
    rollbackPagesDeployment: vi.fn().mockResolvedValue({
      id: 'pages-dep-uuid-prev',
      short_id: 'dep0000',
      project_id: 'proj-uuid-1',
      project_name: 'marketing-portal',
      environment: 'production',
      url: 'https://marketing-portal.pages.dev',
      created_on: '2026-11-08T00:00:00Z',
    }),
    queryWorkersAnalytics: vi.fn(),
  };

  const validPagesConfig: CloudflarePagesDeploymentConfig = {
    deploymentId: 'a0000000-0000-4000-8000-000000000002',
    organizationId: 'b0000000-0000-4000-8000-000000000001',
    projectId: 'c0000000-0000-4000-8000-000000000001',
    serviceId: 'd0000000-0000-4000-8000-000000000002',
    deploymentTargetId: 'e0000000-0000-4000-8000-000000000002',
    environment: 'production',
    commitSha: '9876543210fedcba9876543210fedcba98765432',
    branch: 'main',
    healthcheckPath: '/health',
    targetProvider: 'cloudflare_pages',
    buildStrategy: 'static_export',
    artifactType: 'pages_manifest',
    applicationRuntime: 'static_cdn',
    projectName: 'marketing-portal',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    environmentVariables: { NEXT_PUBLIC_API: 'https://api.example.com' },
    secrets: {},
  };

  it('declares accurate capabilities conforming to ADR-0014 and ADR-0015', () => {
    const provider = new CloudflarePagesProvider(mockApiClient);

    expect(provider.providerType).toBe(TargetProviders.CLOUDFLARE_PAGES);
    expect(provider.capabilities.supportsContainers).toBe(false);
    expect(provider.capabilities.supportsStaticAssets).toBe(true);
    expect(provider.capabilities.supportsDirectUpload).toBe(true);
    expect(provider.capabilities.supportsInstantRollback).toBe(true);
  });

  it('validates connection and verifies Pages: Edit permission', async () => {
    const provider = new CloudflarePagesProvider(mockApiClient);
    const conn = await provider.validateConnection(
      { apiToken: dummyToken },
      { accountId: dummyAccountId },
    );

    expect(conn.connected).toBe(true);
    expect(conn.providerVersion).toContain('Cloudflare Pages');
  });

  it('rejects connection if account lacks Pages permission', async () => {
    const limitedClient = {
      ...mockApiClient,
      probeCapabilities: vi.fn().mockResolvedValue({
        workers: true,
        pages: false,
        tail: false,
        customDomains: false,
        d1: false,
        kv: false,
        r2: false,
      }),
    };

    const provider = new CloudflarePagesProvider(limitedClient);
    const conn = await provider.validateConnection(
      { apiToken: dummyToken },
      { accountId: dummyAccountId },
    );

    expect(conn.connected).toBe(false);
    expect(conn.error).toContain("API token lacks 'Pages: Edit' permission");
  });

  it('prepares pages deployment computing asset SHA-256 manifest', async () => {
    const provider = new CloudflarePagesProvider(mockApiClient);
    const prepared = await provider.prepareDeployment(validPagesConfig);

    expect(prepared.targetProvider).toBe(TargetProviders.CLOUDFLARE_PAGES);
    expect(prepared.targetArtifactId).toBe('marketing-portal:98765432');
    expect(prepared.artifact.artifactType).toBe('pages_manifest');
    expect(prepared.artifact.digest).toMatch(/^sha256:[a-f0-9]{64}$/);

    const manifest = prepared.providerMetadata.manifest;
    expect(manifest['/index.html']).toBeDefined();
    expect(manifest['/health']).toBeDefined();
  });

  it('throws ProviderIncompatibilityException for invalid target provider', async () => {
    const provider = new CloudflarePagesProvider(mockApiClient);
    const invalidConfig = { ...validPagesConfig, targetProvider: 'vps_docker' } as any;

    await expect(provider.prepareDeployment(invalidConfig)).rejects.toThrowError(
      ProviderIncompatibilityException,
    );
  });

  it('deploys static site via Direct Upload API', async () => {
    const provider = new CloudflarePagesProvider(mockApiClient);
    const prepared = await provider.prepareDeployment(validPagesConfig);

    const result = await provider.deploy(prepared, {
      apiToken: dummyToken,
      accountId: dummyAccountId,
    });

    expect(mockApiClient.getOrCreatePagesProject).toHaveBeenCalledWith(
      dummyAccountId,
      'marketing-portal',
      { productionBranch: 'main' },
      dummyToken,
    );
    expect(mockApiClient.createPagesDirectUploadDeployment).toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.providerDeploymentId).toBe('pages-dep-uuid-1');
    expect(result.versionIdentifier).toBe('dep1234');
    expect(result.deployedUrl).toBe('https://dep1234.marketing-portal.pages.dev');
  });

  it('tracks deployment status and maps stage outcomes', async () => {
    const provider = new CloudflarePagesProvider(mockApiClient);
    const statusResult = await provider.getStatus(
      validPagesConfig.deploymentId,
      'pages-dep-uuid-1',
      {
        apiToken: dummyToken,
        accountId: dummyAccountId,
        projectName: 'marketing-portal',
      },
    );

    expect(statusResult.status).toBe('Succeeded');
    expect(statusResult.runningCount).toBe(1);
    expect(statusResult.events.length).toBeGreaterThanOrEqual(1);
  });

  it('rolls back Pages project to previous deployment ID', async () => {
    const provider = new CloudflarePagesProvider(mockApiClient);
    const rollbackRes = await provider.rollback(
      validPagesConfig.deploymentId,
      'pages-dep-uuid-prev',
      {
        apiToken: dummyToken,
        accountId: dummyAccountId,
        projectName: 'marketing-portal',
      },
    );

    expect(mockApiClient.rollbackPagesDeployment).toHaveBeenCalledWith(
      dummyAccountId,
      'marketing-portal',
      'pages-dep-uuid-prev',
      dummyToken,
    );
    expect(rollbackRes.success).toBe(true);
    expect(rollbackRes.restoredArtifactId).toBe('pages-dep-uuid-prev');
  });

  it('verifies health check endpoint for Pages', async () => {
    const provider = new CloudflarePagesProvider(mockApiClient);

    const healthy = await provider.checkHealth('https://marketing-portal.pages.dev/health');
    expect(healthy.isHealthy).toBe(true);
    expect(healthy.httpStatusCode).toBe(200);

    const unhealthy = await provider.checkHealth('https://unhealthy-portal.pages.dev/health');
    expect(unhealthy.isHealthy).toBe(false);
    expect(unhealthy.httpStatusCode).toBe(404);
  });
});
