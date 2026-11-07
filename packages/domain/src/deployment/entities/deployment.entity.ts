import { DeploymentEnvironment } from '../enums/environment.enum.js';
import { DeploymentStatus, DeploymentStatuses } from '../enums/deployment-status.enum.js';
import { TargetProvider } from '../enums/target-provider.enum.js';
import { DeploymentStateMachine } from '../state-machine/deployment-state-machine.js';

export interface DeploymentProps {
  id: string;
  organizationId: string;
  projectId: string;
  serviceId: string;
  deploymentTargetId: string;
  targetProvider: TargetProvider;
  environment: DeploymentEnvironment;
  commitSha: string;
  commitMessage?: string;
  commitAuthor?: string;
  imageUri?: string;
  artifactReference?: string;
  status?: DeploymentStatus;
  failureReason?: string;
  startedAt?: Date;
  completedAt?: Date;
  triggeredBy?: string;
  createdAt?: Date;
}

export class Deployment {
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
  readonly imageUri?: string;
  readonly artifactReference?: string;
  readonly status: DeploymentStatus;
  readonly failureReason?: string;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly triggeredBy?: string;
  readonly createdAt: Date;

  constructor(props: DeploymentProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.projectId = props.projectId;
    this.serviceId = props.serviceId;
    this.deploymentTargetId = props.deploymentTargetId;
    this.targetProvider = props.targetProvider;
    this.environment = props.environment;
    this.commitSha = props.commitSha;
    this.commitMessage = props.commitMessage;
    this.commitAuthor = props.commitAuthor;
    this.imageUri = props.imageUri;
    this.artifactReference = props.artifactReference;
    this.status = props.status ?? DeploymentStatuses.QUEUED;
    this.failureReason = props.failureReason;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.triggeredBy = props.triggeredBy;
    this.createdAt = props.createdAt ?? new Date();
  }

  /**
   * Evaluates and applies an immutable transition to the next state.
   */
  transitionTo(nextStatus: DeploymentStatus, failureReason?: string): Deployment {
    DeploymentStateMachine.validateTransition(this.status, nextStatus);

    const now = new Date();
    const isStarting = this.status === DeploymentStatuses.QUEUED && nextStatus === DeploymentStatuses.PREPARING;
    const isFinishing =
      nextStatus === DeploymentStatuses.SUCCEEDED ||
      nextStatus === DeploymentStatuses.FAILED ||
      nextStatus === DeploymentStatuses.ROLLED_BACK ||
      nextStatus === DeploymentStatuses.CANCELLED;

    return new Deployment({
      ...this,
      status: nextStatus,
      failureReason: failureReason ?? this.failureReason,
      startedAt: isStarting ? (this.startedAt ?? now) : this.startedAt,
      completedAt: isFinishing ? now : this.completedAt,
    });
  }
}
