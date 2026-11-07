import {
  Deployment,
  DeploymentProps,
  DeploymentStatus,
} from '@opspilot/domain';

export interface DeploymentEventRecord {
  readonly organizationId: string;
  readonly deploymentId: string;
  readonly stage: string;
  readonly message: string;
  readonly level?: 'INFO' | 'WARN' | 'ERROR';
}

/**
 * Driven port for deployment persistence operations.
 * Concrete repository adapters in @opspilot/database implement this interface.
 */
export interface IDeploymentRepositoryPort {
  create(props: DeploymentProps): Promise<Deployment>;
  findById(id: string, organizationId: string): Promise<Deployment | null>;
  transitionStatus(
    deploymentId: string,
    organizationId: string,
    fromStatus: DeploymentStatus,
    toStatus: DeploymentStatus,
    failureReason?: string,
  ): Promise<Deployment | null>;
  recordEvent(
    organizationId: string,
    deploymentId: string,
    stage: string,
    message: string,
    level?: 'INFO' | 'WARN' | 'ERROR',
  ): Promise<void>;
  findLatestSuccessful?(
    serviceId: string,
    organizationId: string,
  ): Promise<Deployment | null>;
}
