/**
 * Deployment lifecycle states progressing through the immutable state machine.
 */
export const DeploymentStatuses = {
  QUEUED: 'Queued',
  PREPARING: 'Preparing',
  BUILDING: 'Building',
  PUBLISHING: 'Publishing',
  DEPLOYING: 'Deploying',
  HEALTH_CHECKING: 'HealthChecking',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed',
  ROLLING_BACK: 'RollingBack',
  ROLLED_BACK: 'RolledBack',
  CANCELLED: 'Cancelled',
} as const;

export type DeploymentStatus = (typeof DeploymentStatuses)[keyof typeof DeploymentStatuses];

export function isDeploymentStatus(value: unknown): value is DeploymentStatus {
  return typeof value === 'string' && Object.values(DeploymentStatuses).includes(value as DeploymentStatus);
}

export function isTerminalStatus(status: DeploymentStatus): boolean {
  return (
    status === DeploymentStatuses.SUCCEEDED ||
    status === DeploymentStatuses.FAILED ||
    status === DeploymentStatuses.ROLLED_BACK ||
    status === DeploymentStatuses.CANCELLED
  );
}
