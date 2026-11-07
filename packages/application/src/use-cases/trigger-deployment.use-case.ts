import {
  Deployment,
  DeploymentEnvironment,
  DeploymentStatuses,
  TargetProvider,
} from '@opspilot/domain';
import { IDeploymentRepositoryPort } from '../ports/deployment-repository.port.js';
import { IJobPublisherPort } from '../ports/job-publisher.port.js';

export interface TriggerDeploymentCommand {
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly serviceId: string;
  readonly deploymentTargetId: string;
  readonly targetProvider: TargetProvider;
  readonly environment: DeploymentEnvironment;
  readonly commitSha: string;
  readonly commitMessage?: string;
  readonly commitAuthor?: string;
  readonly triggeredBy?: string;
  readonly imageUri?: string;
  readonly artifactReference?: string;
  readonly integrationId: string;
  readonly previousVersionId?: string;
  readonly autoRollbackOnFailure?: boolean;
}

export class TriggerDeploymentUseCase {
  constructor(
    private readonly deploymentRepo: IDeploymentRepositoryPort,
    private readonly jobPublisher: IJobPublisherPort,
  ) {}

  async execute(command: TriggerDeploymentCommand): Promise<Deployment> {
    if (!command.organizationId || !command.serviceId || !command.id) {
      throw new Error('organizationId, serviceId, and id are required to trigger a deployment');
    }

    // 1. Create durable Queued deployment record in database
    const deployment = await this.deploymentRepo.create({
      id: command.id,
      organizationId: command.organizationId,
      projectId: command.projectId,
      serviceId: command.serviceId,
      deploymentTargetId: command.deploymentTargetId,
      targetProvider: command.targetProvider,
      environment: command.environment,
      commitSha: command.commitSha,
      commitMessage: command.commitMessage,
      commitAuthor: command.commitAuthor,
      imageUri: command.imageUri,
      artifactReference: command.artifactReference,
      status: DeploymentStatuses.QUEUED,
      triggeredBy: command.triggeredBy,
    });

    // 2. Publish deployment job payload to background worker queue
    await this.jobPublisher.publishDeploymentJob({
      organizationId: command.organizationId,
      projectId: command.projectId,
      serviceId: command.serviceId,
      deploymentId: command.id,
      targetProvider: command.targetProvider,
      integrationId: command.integrationId,
      previousVersionId: command.previousVersionId,
      autoRollbackOnFailure: command.autoRollbackOnFailure ?? true,
    });

    // 3. Record queued audit event
    await this.deploymentRepo.recordEvent(
      command.organizationId,
      command.id,
      DeploymentStatuses.QUEUED,
      `Deployment queued for service ${command.serviceId} on ${command.targetProvider}`,
      'INFO',
    );

    return deployment;
  }
}
