import { DeploymentStatus, TargetProvider } from '@opspilot/domain';

export interface DeploymentNotification {
  readonly organizationId: string;
  readonly deploymentId: string;
  readonly serviceName: string;
  readonly targetProvider: TargetProvider;
  readonly status: DeploymentStatus;
  readonly deployedUrl?: string;
  readonly failureReason?: string;
  readonly timestamp: Date;
}

/**
 * Driven port for dispatching operational notifications (Slack, Discord, webhooks, email).
 */
export interface INotificationPort {
  sendDeploymentNotification(notification: DeploymentNotification): Promise<void>;
}
