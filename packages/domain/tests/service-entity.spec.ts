import { describe, expect, it } from 'vitest';
import {
  ApplicationRuntimes,
  ArtifactTypes,
  BuildStrategies,
  ConfigurationValidationException,
  Service,
  TargetProviders,
} from '../src/index.js';

describe('Service Entity & Invariant Enforcement', () => {
  it('instantiates valid container service for aws_ecs', () => {
    const service = new Service({
      id: 'srv-1',
      organizationId: 'org-1',
      projectId: 'proj-1',
      name: 'Payments API',
      slug: 'payments-api',
      repositoryName: 'acme/payments',
      targetProvider: TargetProviders.AWS_ECS,
      buildStrategy: BuildStrategies.DOCKERFILE,
      artifactType: ArtifactTypes.OCI_IMAGE,
      applicationRuntime: ApplicationRuntimes.CONTAINER,
      dockerfilePath: 'Dockerfile',
      containerPort: 8080,
      cpuUnits: 512,
      memoryMb: 1024,
    });

    expect(service.targetProvider).toBe('aws_ecs');
    expect(service.containerPort).toBe(8080);
    expect(service.dockerfilePath).toBe('Dockerfile');
  });

  it('rejects container service with missing dockerfile', () => {
    expect(
      () =>
        new Service({
          id: 'srv-1',
          organizationId: 'org-1',
          projectId: 'proj-1',
          name: 'Payments API',
          slug: 'payments-api',
          repositoryName: 'acme/payments',
          targetProvider: TargetProviders.AWS_ECS,
          buildStrategy: BuildStrategies.DOCKERFILE,
          artifactType: ArtifactTypes.OCI_IMAGE,
          applicationRuntime: ApplicationRuntimes.CONTAINER,
          containerPort: 8080,
          cpuUnits: 512,
          memoryMb: 1024,
        })
    ).toThrow(ConfigurationValidationException);
  });

  it('rejects container service with non-positive port or memory', () => {
    expect(
      () =>
        new Service({
          id: 'srv-1',
          organizationId: 'org-1',
          projectId: 'proj-1',
          name: 'Payments API',
          slug: 'payments-api',
          repositoryName: 'acme/payments',
          targetProvider: TargetProviders.VPS_DOCKER,
          buildStrategy: BuildStrategies.DOCKERFILE,
          artifactType: ArtifactTypes.OCI_IMAGE,
          applicationRuntime: ApplicationRuntimes.CONTAINER,
          dockerfilePath: 'Dockerfile',
          containerPort: 0,
          cpuUnits: 512,
          memoryMb: 1024,
        })
    ).toThrow(ConfigurationValidationException);
  });

  it('allows non-container service (edge) to omit dockerfile and port', () => {
    const workerService = new Service({
      id: 'srv-2',
      organizationId: 'org-1',
      projectId: 'proj-1',
      name: 'Edge Auth Gateway',
      slug: 'edge-auth-gateway',
      repositoryName: 'acme/edge-auth',
      targetProvider: TargetProviders.CLOUDFLARE_WORKERS,
      buildStrategy: BuildStrategies.CLOUDFLARE_WORKER_BUNDLE,
      artifactType: ArtifactTypes.WORKER_BUNDLE,
      applicationRuntime: ApplicationRuntimes.V8_ISOLATE,
      config: {
        compatibilityDate: '2024-11-01',
        mainEntrypoint: 'src/index.ts',
      },
    });

    expect(workerService.targetProvider).toBe('cloudflare_workers');
    expect(workerService.dockerfilePath).toBeUndefined();
    expect(workerService.containerPort).toBeUndefined();
    expect(workerService.config.compatibilityDate).toBe('2024-11-01');
  });
});
