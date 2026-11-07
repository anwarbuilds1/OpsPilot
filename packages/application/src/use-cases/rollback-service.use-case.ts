import {
  DeploymentStatuses,
  RollbackResult,
  TargetProvider,
} from '@opspilot/domain';
import { IDeploymentRepositoryPort } from '../ports/deployment-repository.port.js';
import {
  DeploymentProviderPort,
  IDeploymentProviderRegistryPort,
} from '../ports/deployment-provider.port.js';
import { ISecretVaultPort } from '../ports/secret-vault.port.js';
import { INotificationPort } from '../ports/notification.port.js';

export interface RollbackServiceCommand {
  readonly organizationId: string;
  readonly serviceId: string;
  readonly deploymentId: string;
  readonly targetProvider: TargetProvider;
  readonly targetVersionId: string;
  readonly integrationId: string;
  readonly requestedBy: string;
}

export interface RollbackServiceResult {
  readonly serviceId: string;
  readonly targetVersionId: string;
  readonly success: boolean;
  readonly message?: string;
  readonly rollbackResult: RollbackResult;
}

export class RollbackServiceUseCase {
  constructor(
    private readonly deploymentRepo: IDeploymentRepositoryPort,
    private readonly providerRegistry: IDeploymentProviderRegistryPort,
    private readonly secretVault: ISecretVaultPort,
    private readonly notificationPort?: INotificationPort,
  ) {}

  async execute(command: RollbackServiceCommand): Promise<RollbackServiceResult> {
    if (!command.organizationId || !command.serviceId || !command.targetVersionId) {
      throw new Error('organizationId, serviceId, and targetVersionId are required to execute rollback');
    }

    const provider = this.providerRegistry.getProvider(command.targetProvider);
    if (!provider.capabilities.supportsInstantRollback) {
      throw new Error(`Provider ${command.targetProvider} does not support automated rollback`);
    }

    // 1. Retrieve and decrypt provider credentials
    const credentials = await this.secretVault.getDecryptedCredentials(
      command.integrationId,
      command.organizationId,
    );

    // 2. Record rollback initiation in repository
    await this.deploymentRepo.recordEvent(
      command.organizationId,
      command.deploymentId,
      DeploymentStatuses.ROLLING_BACK,
      `Rollback initiated by ${command.requestedBy} to version: ${command.targetVersionId}`,
      'WARN',
    );

    // 3. Execute rollback via provider port
    const rollbackResult = await provider.rollback(
      command.deploymentId,
      command.targetVersionId,
      credentials,
    );

    // 4. Update repository status
    await this.deploymentRepo.transitionStatus(
      command.deploymentId,
      command.organizationId,
      DeploymentStatuses.ROLLING_BACK,
      rollbackResult.success ? DeploymentStatuses.ROLLED_BACK : DeploymentStatuses.FAILED,
      rollbackResult.success ? undefined : rollbackResult.message,
    );

    // 5. Dispatch operational notification if configured
    if (this.notificationPort) {
      await this.notificationPort.sendDeploymentNotification({
        organizationId: command.organizationId,
        deploymentId: command.deploymentId,
        serviceName: command.serviceId,
        targetProvider: command.targetProvider,
        status: rollbackResult.success ? DeploymentStatuses.ROLLED_BACK : DeploymentStatuses.FAILED,
        failureReason: rollbackResult.success ? undefined : rollbackResult.message,
        timestamp: new Date(),
      });
    }

    return {
      serviceId: command.serviceId,
      targetVersionId: command.targetVersionId,
      success: rollbackResult.success,
      message: rollbackResult.message,
      rollbackResult,
    };
  }
}
