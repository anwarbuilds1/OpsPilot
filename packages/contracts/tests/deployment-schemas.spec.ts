import { describe, expect, it } from 'vitest';
import {
  DeploymentCapabilitiesSchema,
  DeploymentConfigSchema,
} from '../src/index.js';

describe('Contracts & Schema Validation', () => {
  it('validates a valid AWS ECS deployment config DTO', () => {
    const validEcs = {
      deploymentId: 'a0000000-0000-4000-8000-000000000001',
      organizationId: 'a0000000-0000-4000-8000-000000000002',
      projectId: 'a0000000-0000-4000-8000-000000000003',
      serviceId: 'a0000000-0000-4000-8000-000000000004',
      deploymentTargetId: 'a0000000-0000-4000-8000-000000000005',
      targetProvider: 'aws_ecs',
      buildStrategy: 'dockerfile',
      artifactType: 'oci_image',
      applicationRuntime: 'container',
      environment: 'production',
      commitSha: 'a'.repeat(40),
      branch: 'main',
      healthcheckPath: '/health',
      imageUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/payments:v1',
      dockerfilePath: 'Dockerfile',
      buildContext: '.',
      containerPort: 8080,
      cpuUnits: 512,
      memoryMb: 1024,
      clusterArn: 'arn:aws:ecs:us-east-1:123456789012:cluster/prod',
      taskFamily: 'payments-api',
      environmentVariables: { NODE_ENV: 'production' },
      secrets: {},
    };

    const parsed = DeploymentConfigSchema.parse(validEcs);
    expect(parsed.targetProvider).toBe('aws_ecs');
  });

  it('validates a valid Cloudflare Workers deployment config DTO', () => {
    const validWorker = {
      deploymentId: 'b0000000-0000-4000-8000-000000000001',
      organizationId: 'b0000000-0000-4000-8000-000000000002',
      projectId: 'b0000000-0000-4000-8000-000000000003',
      serviceId: 'b0000000-0000-4000-8000-000000000004',
      deploymentTargetId: 'b0000000-0000-4000-8000-000000000005',
      targetProvider: 'cloudflare_workers',
      buildStrategy: 'cloudflare_worker_bundle',
      artifactType: 'worker_bundle',
      applicationRuntime: 'v8_isolate',
      environment: 'production',
      commitSha: 'b'.repeat(40),
      branch: 'main',
      healthcheckPath: '/health',
      scriptName: 'edge-auth',
      mainEntrypoint: 'src/index.ts',
      compatibilityDate: '2024-11-01',
      compatibilityFlags: ['nodejs_compat'],
      environmentVariables: { API_URL: 'https://api.example.com' },
      secrets: {},
    };

    const parsed = DeploymentConfigSchema.parse(validWorker);
    expect(parsed.targetProvider).toBe('cloudflare_workers');
  });

  it('rejects invalid commit SHA or non-UUID deployment ID', () => {
    const invalidSha = {
      deploymentId: 'not-a-uuid',
      organizationId: '22222222-2222-2222-2222-222222222222',
      projectId: '33333333-3333-3333-3333-333333333333',
      serviceId: '44444444-4444-4444-4444-444444444444',
      deploymentTargetId: '55555555-5555-5555-5555-555555555555',
      targetProvider: 'aws_ecs',
      buildStrategy: 'dockerfile',
      artifactType: 'oci_image',
      applicationRuntime: 'container',
      environment: 'production',
      commitSha: 'short-sha',
      branch: 'main',
      healthcheckPath: '/health',
      imageUri: 'app:latest',
      containerPort: 8080,
      cpuUnits: 512,
      memoryMb: 1024,
      clusterArn: 'arn:aws:ecs:us-east-1:123456789012:cluster/prod',
      taskFamily: 'payments-api',
    };

    expect(() => DeploymentConfigSchema.parse(invalidSha)).toThrow();
  });

  it('validates DeploymentCapabilitiesSchema', () => {
    const capabilities = {
      targetProvider: 'aws_ecs',
      applicationRuntime: 'container',
      supportsContainers: true,
      supportsStaticAssets: false,
      supportsEdgeFunctions: false,
      requiresPortBinding: true,
      requiresResourceLimits: true,
      supportsTrafficWeighting: false,
      supportsDirectUpload: false,
      supportsInstantRollback: false,
      supportedBuildStrategies: ['dockerfile'],
      supportedArtifactTypes: ['oci_image'],
    };

    const parsed = DeploymentCapabilitiesSchema.parse(capabilities);
    expect(parsed.supportsContainers).toBe(true);
    expect(parsed.targetProvider).toBe('aws_ecs');
  });

  it('validates Cloudflare integration and wizard schemas', async () => {
    const {
      ConnectCloudflareAccountRequestSchema,
      ConnectCloudflareAccountResponseSchema,
      CloudflareWorkerServiceWizardSchema,
      CloudflarePagesServiceWizardSchema,
      CloudflareDeploymentStatusViewSchema,
    } = await import('../src/index.js');

    const connectReq = ConnectCloudflareAccountRequestSchema.parse({
      organizationId: 'a0000000-0000-4000-8000-000000000001',
      name: 'Acme Cloudflare',
      apiToken: 'cf_tok_1234567890123456789012345678901234567890',
    });
    expect(connectReq.name).toBe('Acme Cloudflare');

    const workerWizard = CloudflareWorkerServiceWizardSchema.parse({
      name: 'Auth Worker',
      slug: 'auth-worker',
      repositoryName: 'acme/auth',
      branch: 'main',
      integrationId: 'b0000000-0000-4000-8000-000000000001',
      scriptName: 'auth-worker',
      compatibilityDate: '2026-11-01',
    });
    expect(workerWizard.mainEntrypoint).toBe('src/index.ts');

    const pagesWizard = CloudflarePagesServiceWizardSchema.parse({
      name: 'Docs Site',
      slug: 'docs-site',
      repositoryName: 'acme/docs',
      integrationId: 'b0000000-0000-4000-8000-000000000001',
      projectName: 'acme-docs',
      buildCommand: 'npm run build',
      outputDirectory: 'dist',
    });
    expect(pagesWizard.projectName).toBe('acme-docs');

    const statusView = CloudflareDeploymentStatusViewSchema.parse({
      deploymentId: 'c0000000-0000-4000-8000-000000000001',
      serviceId: 'd0000000-0000-4000-8000-000000000001',
      provider: 'cloudflare_workers',
      status: 'Succeeded',
      deployedUrl: 'https://auth-worker.workers.dev',
      canInstantRollback: true,
      previousVersions: [
        {
          versionId: 'v1',
          versionNumber: 1,
          deployedAt: new Date().toISOString(),
        },
      ],
      events: [
        {
          timestamp: new Date().toISOString(),
          stage: 'Succeeded',
          message: 'Deployment complete',
          level: 'INFO',
        },
      ],
      healthStatus: {
        isHealthy: true,
        httpStatusCode: 200,
        latencyMs: 32,
      },
    });
    expect(statusView.canInstantRollback).toBe(true);
  });
});
