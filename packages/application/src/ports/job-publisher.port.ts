import { TargetProvider } from '@opspilot/domain';

export interface DeploymentJobPayload {
  readonly organizationId: string;
  readonly projectId: string;
  readonly serviceId: string;
  readonly deploymentId: string;
  readonly targetProvider: TargetProvider;
  readonly integrationId: string;
  readonly previousVersionId?: string;
  readonly autoRollbackOnFailure?: boolean;
}

/**
 * Driven port for publishing background jobs.
 * Enforces decoupling from queue implementations (PostgreSQL-backed queue, Redis, BullMQ).
 */
export interface IJobPublisherPort {
  publishDeploymentJob(payload: DeploymentJobPayload): Promise<string>;
}
