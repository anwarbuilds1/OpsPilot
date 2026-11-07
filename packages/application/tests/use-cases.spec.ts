import { describe, expect, it, vi } from 'vitest';
import {
  Deployment,
  DeploymentStatuses,
  TargetProviders,
} from '@opspilot/domain';
import {
  TriggerDeploymentUseCase,
  RollbackServiceUseCase,
  IDeploymentRepositoryPort,
  IJobPublisherPort,
  ISecretVaultPort,
  IDeploymentProviderRegistryPort,
  DeploymentProviderPort,
  INotificationPort,
} from '../src/index.js';

describe('Application Layer Use Cases', () => {
  const orgId = 'c0000000-0000-4000-8000-000000000001';
  const projId = 'd0000000-0000-4000-8000-000000000001';
  const srvId = 'e0000000-0000-4000-8000-000000000001';
  const depId = 'a0000000-0000-4000-8000-000000000001';
  const targetId = 'f0000000-0000-4000-8000-000000000001';
  const integId = '10000000-0000-4000-8000-000000000001';

  describe('TriggerDeploymentUseCase', () => {
    it('creates queued deployment record and dispatches background job payload', async () => {
      const mockRepo: IDeploymentRepositoryPort = {
        create: vi.fn().mockImplementation((props) =>
          Promise.resolve(
            new Deployment({
              ...props,
              status: DeploymentStatuses.QUEUED,
              createdAt: new Date(),
            }),
          ),
        ),
        findById: vi.fn(),
        transitionStatus: vi.fn(),
        recordEvent: vi.fn().mockResolvedValue(undefined),
      };

      const mockJobPublisher: IJobPublisherPort = {
        publishDeploymentJob: vi.fn().mockResolvedValue('job-123'),
      };

      const useCase = new TriggerDeploymentUseCase(mockRepo, mockJobPublisher);
      const result = await useCase.execute({
        id: depId,
        organizationId: orgId,
        projectId: projId,
        serviceId: srvId,
        deploymentTargetId: targetId,
        targetProvider: TargetProviders.CLOUDFLARE_WORKERS,
        environment: 'production',
        commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
        integrationId: integId,
        previousVersionId: 'v1',
      });

      expect(result.id).toBe(depId);
      expect(result.status).toBe(DeploymentStatuses.QUEUED);
      expect(mockRepo.create).toHaveBeenCalledTimes(1);
      expect(mockJobPublisher.publishDeploymentJob).toHaveBeenCalledWith({
        organizationId: orgId,
        projectId: projId,
        serviceId: srvId,
        deploymentId: depId,
        targetProvider: TargetProviders.CLOUDFLARE_WORKERS,
        integrationId: integId,
        previousVersionId: 'v1',
        autoRollbackOnFailure: true,
      });
      expect(mockRepo.recordEvent).toHaveBeenCalledWith(
        orgId,
        depId,
        DeploymentStatuses.QUEUED,
        expect.stringContaining('Deployment queued for service'),
        'INFO',
      );
    });

    it('rejects execution when tenant or service context is missing', async () => {
      const mockRepo: any = {};
      const mockJobPublisher: any = {};
      const useCase = new TriggerDeploymentUseCase(mockRepo, mockJobPublisher);

      await expect(
        useCase.execute({
          id: depId,
          organizationId: '',
          projectId: projId,
          serviceId: srvId,
          deploymentTargetId: targetId,
          targetProvider: TargetProviders.AWS_ECS,
          environment: 'production',
          commitSha: '123456',
          integrationId: integId,
        }),
      ).rejects.toThrow('organizationId, serviceId, and id are required');
    });
  });

  describe('RollbackServiceUseCase', () => {
    it('retrieves credentials, executes provider rollback, transitions status, and emits notification', async () => {
      const mockRepo: IDeploymentRepositoryPort = {
        create: vi.fn(),
        findById: vi.fn(),
        transitionStatus: vi.fn().mockResolvedValue(null),
        recordEvent: vi.fn().mockResolvedValue(undefined),
      };

      const mockProvider: any = {
        providerType: TargetProviders.CLOUDFLARE_WORKERS,
        capabilities: {
          supportsInstantRollback: true,
        },
        validateConnection: vi.fn(),
        prepareDeployment: vi.fn(),
        deploy: vi.fn(),
        getStatus: vi.fn(),
        checkHealth: vi.fn(),
        rollback: vi.fn().mockResolvedValue({
          success: true,
          restoredArtifactId: 'v1',
          message: 'Rollback to v1 complete',
          executedAt: new Date(),
        }),
      };

      const mockRegistry: IDeploymentProviderRegistryPort = {
        getProvider: vi.fn().mockReturnValue(mockProvider),
        hasProvider: vi.fn().mockReturnValue(true),
      };

      const mockSecretVault: ISecretVaultPort = {
        getDecryptedCredentials: vi.fn().mockResolvedValue({ apiToken: 'token123' }),
        storeCredentials: vi.fn(),
      };

      const mockNotificationPort: INotificationPort = {
        sendDeploymentNotification: vi.fn().mockResolvedValue(undefined),
      };

      const useCase = new RollbackServiceUseCase(
        mockRepo,
        mockRegistry,
        mockSecretVault,
        mockNotificationPort,
      );

      const result = await useCase.execute({
        organizationId: orgId,
        serviceId: srvId,
        deploymentId: depId,
        targetProvider: TargetProviders.CLOUDFLARE_WORKERS,
        targetVersionId: 'v1',
        integrationId: integId,
        requestedBy: 'user-engineer@opspilot.local',
      });

      expect(result.success).toBe(true);
      expect(result.targetVersionId).toBe('v1');
      expect(mockSecretVault.getDecryptedCredentials).toHaveBeenCalledWith(integId, orgId);
      expect(mockProvider.rollback).toHaveBeenCalledWith(depId, 'v1', { apiToken: 'token123' });
      expect(mockRepo.transitionStatus).toHaveBeenCalledWith(
        depId,
        orgId,
        DeploymentStatuses.ROLLING_BACK,
        DeploymentStatuses.ROLLED_BACK,
        undefined,
      );
      expect(mockNotificationPort.sendDeploymentNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          deploymentId: depId,
          status: DeploymentStatuses.ROLLED_BACK,
        }),
      );
    });

    it('rejects rollback if provider does not support rollback capabilities', async () => {
      const mockRepo: any = {};
      const mockProvider: any = {
        capabilities: { supportsInstantRollback: false },
      };
      const mockRegistry: any = {
        getProvider: () => mockProvider,
      };
      const mockSecretVault: any = {};

      const useCase = new RollbackServiceUseCase(mockRepo, mockRegistry, mockSecretVault);

      await expect(
        useCase.execute({
          organizationId: orgId,
          serviceId: srvId,
          deploymentId: depId,
          targetProvider: TargetProviders.VPS_DOCKER,
          targetVersionId: 'v1',
          integrationId: integId,
          requestedBy: 'user',
        }),
      ).rejects.toThrow('does not support automated rollback');
    });
  });
});
