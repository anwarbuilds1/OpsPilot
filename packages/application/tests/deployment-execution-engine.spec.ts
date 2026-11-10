import { describe, expect, it, vi } from 'vitest';
import {
  CloudflareWorkersDeploymentConfig,
  DeploymentStatuses,
  TargetProviders,
} from '@opspilot/domain';
import {
  DeploymentProviderRegistry,
  CloudflareWorkersProvider,
  ICloudflareApiClient,
} from '@opspilot/deployment-providers';
import {
  DeploymentExecutionEngine,
  IDbDeploymentsSink,
} from '../src/index.js';

describe('DeploymentExecutionEngine & State Machine Orchestration', () => {
  const dummyToken = 'cf_token_0123456789abcdef0123456789abcdef';
  const dummyAccountId = 'cf_acc_1122334455667788';

  const mockApiClient: ICloudflareApiClient = {
    verifyToken: vi.fn().mockResolvedValue({ valid: true }),
    listAccounts: vi.fn().mockResolvedValue([{ id: dummyAccountId, name: 'Acme' }]),
    probeCapabilities: vi.fn().mockResolvedValue({
      workers: true,
      pages: true,
      tail: true,
      customDomains: true,
      d1: true,
      kv: true,
      r2: true,
    }),
    uploadScriptVersion: vi.fn().mockResolvedValue({ id: 'v2', number: 2, created_on: '2026-11-08' }),
    deployScriptVersion: vi.fn().mockResolvedValue({ id: 'dep-2', created_on: '2026-11-08', versions: [] }),
    getScriptDeployments: vi.fn().mockResolvedValue([]),
    getScriptVersions: vi.fn().mockResolvedValue([]),
    syncScriptSecrets: vi.fn().mockResolvedValue(undefined),
    createTailSession: vi.fn().mockResolvedValue({ id: 't1', url: 'wss://', expiresAt: new Date() }),
    getOrCreatePagesProject: vi.fn(),
    createPagesDirectUploadSession: vi.fn(),
    checkMissingPagesAssets: vi.fn(),
    uploadPagesMissingAssets: vi.fn(),
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
    compatibilityFlags: [],
    environmentVariables: {},
    secrets: {},
  };

  it('orchestrates successful 8-stage state machine transition to Succeeded', async () => {
    const registry = new DeploymentProviderRegistry();
    const workersProvider = new CloudflareWorkersProvider(mockApiClient);
    registry.registerProvider(workersProvider);

    const recordedTransitions: string[] = [];
    const recordedEvents: any[] = [];

    const mockDbSink: IDbDeploymentsSink = {
      transitionStatus: vi.fn().mockImplementation((_id, _org, status) => {
        recordedTransitions.push(status);
        return Promise.resolve();
      }),
      recordEvent: vi.fn().mockImplementation((event) => {
        recordedEvents.push(event);
        return Promise.resolve();
      }),
    };

    const engine = new DeploymentExecutionEngine(registry, mockDbSink);
    const summary = await engine.execute(validConfig, {
      apiToken: dummyToken,
      accountId: dummyAccountId,
    });

    expect(summary.finalStatus).toBe(DeploymentStatuses.SUCCEEDED);
    expect(summary.targetProvider).toBe('cloudflare_workers');
    expect(summary.versionIdentifier).toBe('v2');
    expect(summary.deployedUrl).toContain('payment-processor');
    expect(summary.deployedUrl).toContain('workers.dev');

    // Verify deterministic state machine progression
    expect(recordedTransitions).toEqual([
      DeploymentStatuses.PREPARING,
      DeploymentStatuses.BUILDING,
      DeploymentStatuses.PUBLISHING,
      DeploymentStatuses.DEPLOYING,
      DeploymentStatuses.HEALTH_CHECKING,
      DeploymentStatuses.SUCCEEDED,
    ]);

    // Verify audit logs were persisted for each stage
    expect(recordedEvents).toHaveLength(6);
    expect(mockDbSink.recordEvent).toHaveBeenCalledTimes(6);
  });

  it('executes automated rollback when health check fails and previous version exists', async () => {
    const registry = new DeploymentProviderRegistry();
    const failingApiClient: ICloudflareApiClient = {
      ...mockApiClient,
      deployScriptVersion: vi.fn().mockResolvedValue({ id: 'dep-prev', created_on: '2026-11-08', versions: [] }),
    };
    const workersProvider = new CloudflareWorkersProvider(failingApiClient);
    // Mock failing health check
    workersProvider.checkHealth = vi.fn().mockResolvedValue({
      isHealthy: false,
      httpStatusCode: 502,
      latencyMs: 150,
      errorMessage: 'Bad Gateway: upstream isolate initialization timeout',
    });
    registry.registerProvider(workersProvider);

    const recordedTransitions: string[] = [];
    const mockDbSink: IDbDeploymentsSink = {
      transitionStatus: vi.fn().mockImplementation((_id, _org, status) => {
        recordedTransitions.push(status);
        return Promise.resolve();
      }),
      recordEvent: vi.fn().mockResolvedValue(undefined),
    };

    const engine = new DeploymentExecutionEngine(registry, mockDbSink);
    const summary = await engine.execute(
      validConfig,
      {
        apiToken: dummyToken,
        accountId: dummyAccountId,
      },
      {
        previousVersionId: 'v1',
        autoRollbackOnFailure: true,
      },
    );

    expect(summary.finalStatus).toBe(DeploymentStatuses.ROLLED_BACK);
    expect(summary.failureReason).toContain('Bad Gateway');
    expect(summary.rollbackResult?.success).toBe(true);

    // Verify progression through health check failure into automated rollback
    expect(recordedTransitions).toEqual([
      DeploymentStatuses.PREPARING,
      DeploymentStatuses.BUILDING,
      DeploymentStatuses.PUBLISHING,
      DeploymentStatuses.DEPLOYING,
      DeploymentStatuses.HEALTH_CHECKING,
      DeploymentStatuses.ROLLING_BACK,
      DeploymentStatuses.ROLLED_BACK,
    ]);
  });

  it('transitions to Failed when health check fails and rollback is disabled', async () => {
    const registry = new DeploymentProviderRegistry();
    const workersProvider = new CloudflareWorkersProvider(mockApiClient);
    workersProvider.checkHealth = vi.fn().mockResolvedValue({
      isHealthy: false,
      httpStatusCode: 500,
      latencyMs: 200,
      errorMessage: 'Internal Server Error: Unhandled Worker Exception',
    });
    registry.registerProvider(workersProvider);

    const recordedTransitions: string[] = [];
    const mockDbSink: IDbDeploymentsSink = {
      transitionStatus: vi.fn().mockImplementation((_id, _org, status) => {
        recordedTransitions.push(status);
        return Promise.resolve();
      }),
      recordEvent: vi.fn().mockResolvedValue(undefined),
    };

    const engine = new DeploymentExecutionEngine(registry, mockDbSink);
    const summary = await engine.execute(
      validConfig,
      {
        apiToken: dummyToken,
        accountId: dummyAccountId,
      },
      {
        autoRollbackOnFailure: false,
      },
    );

    expect(summary.finalStatus).toBe(DeploymentStatuses.FAILED);
    expect(summary.failureReason).toContain('Unhandled Worker Exception');
    expect(recordedTransitions[recordedTransitions.length - 1]).toBe(DeploymentStatuses.FAILED);
  });
});
