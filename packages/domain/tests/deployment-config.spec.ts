import { describe, expect, it } from 'vitest';
import {
  DeploymentConfig,
  isAwsEcsConfig,
  isCloudflarePagesConfig,
  isCloudflareWorkersConfig,
  isVpsDockerConfig,
} from '../src/index.js';

describe('DeploymentConfig Polymorphism', () => {
  it('narrows AWS ECS configuration by targetProvider', () => {
    const config: DeploymentConfig = {
      deploymentId: 'dep-1',
      organizationId: 'org-1',
      projectId: 'proj-1',
      serviceId: 'srv-1',
      deploymentTargetId: 'tgt-1',
      targetProvider: 'aws_ecs',
      buildStrategy: 'dockerfile',
      artifactType: 'oci_image',
      applicationRuntime: 'container',
      environment: 'production',
      commitSha: 'a'.repeat(40),
      branch: 'main',
      healthcheckPath: '/health',
      imageUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/app:latest',
      dockerfilePath: 'Dockerfile',
      buildContext: '.',
      containerPort: 8080,
      cpuUnits: 512,
      memoryMb: 1024,
      clusterArn: 'arn:aws:ecs:us-east-1:123456789012:cluster/prod',
      taskFamily: 'payments-api',
      environmentVariables: { NODE_ENV: 'production' },
      secrets: { DB_PASS: 'secret' },
    };

    expect(isAwsEcsConfig(config)).toBe(true);
    expect(isVpsDockerConfig(config)).toBe(false);
    if (isAwsEcsConfig(config)) {
      expect(config.clusterArn).toContain('arn:aws:ecs');
      expect(config.containerPort).toBe(8080);
    }
  });

  it('narrows Cloudflare Workers configuration by targetProvider', () => {
    const config: DeploymentConfig = {
      deploymentId: 'dep-2',
      organizationId: 'org-1',
      projectId: 'proj-1',
      serviceId: 'srv-2',
      deploymentTargetId: 'tgt-2',
      targetProvider: 'cloudflare_workers',
      buildStrategy: 'cloudflare_worker_bundle',
      artifactType: 'worker_bundle',
      applicationRuntime: 'v8_isolate',
      environment: 'production',
      commitSha: 'b'.repeat(40),
      branch: 'main',
      healthcheckPath: '/health',
      scriptName: 'auth-worker',
      mainEntrypoint: 'src/index.ts',
      compatibilityDate: '2024-11-01',
      compatibilityFlags: ['nodejs_compat'],
      environmentVariables: { API_HOST: 'api.example.com' },
      secrets: { API_KEY: 'secret-token' },
    };

    expect(isCloudflareWorkersConfig(config)).toBe(true);
    expect(isCloudflarePagesConfig(config)).toBe(false);
    if (isCloudflareWorkersConfig(config)) {
      expect(config.scriptName).toBe('auth-worker');
      expect(config.compatibilityDate).toBe('2024-11-01');
    }
  });
});
