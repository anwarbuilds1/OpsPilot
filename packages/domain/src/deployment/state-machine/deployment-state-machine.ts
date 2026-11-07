import { DeploymentStatus, DeploymentStatuses, isTerminalStatus } from '../enums/deployment-status.enum.js';
import { InvalidStateTransitionException } from '../errors/invalid-state-transition.exception.js';

export class DeploymentStateMachine {
  private static readonly transitions: Readonly<Record<DeploymentStatus, readonly DeploymentStatus[]>> = {
    [DeploymentStatuses.QUEUED]: [
      DeploymentStatuses.PREPARING,
      DeploymentStatuses.CANCELLED,
      DeploymentStatuses.FAILED,
    ],
    [DeploymentStatuses.PREPARING]: [
      DeploymentStatuses.BUILDING,
      DeploymentStatuses.CANCELLED,
      DeploymentStatuses.FAILED,
    ],
    [DeploymentStatuses.BUILDING]: [
      DeploymentStatuses.PUBLISHING,
      DeploymentStatuses.FAILED,
      DeploymentStatuses.CANCELLED,
    ],
    [DeploymentStatuses.PUBLISHING]: [
      DeploymentStatuses.DEPLOYING,
      DeploymentStatuses.FAILED,
      DeploymentStatuses.CANCELLED,
    ],
    [DeploymentStatuses.DEPLOYING]: [
      DeploymentStatuses.HEALTH_CHECKING,
      DeploymentStatuses.FAILED,
      DeploymentStatuses.CANCELLED,
    ],
    [DeploymentStatuses.HEALTH_CHECKING]: [
      DeploymentStatuses.SUCCEEDED,
      DeploymentStatuses.FAILED,
      DeploymentStatuses.ROLLING_BACK,
      DeploymentStatuses.ROLLED_BACK,
    ],
    [DeploymentStatuses.FAILED]: [
      DeploymentStatuses.ROLLING_BACK,
      DeploymentStatuses.ROLLED_BACK,
    ],
    [DeploymentStatuses.ROLLING_BACK]: [
      DeploymentStatuses.SUCCEEDED,
      DeploymentStatuses.ROLLED_BACK,
      DeploymentStatuses.FAILED,
    ],
    [DeploymentStatuses.SUCCEEDED]: [],
    [DeploymentStatuses.ROLLED_BACK]: [],
    [DeploymentStatuses.CANCELLED]: [],
  };

  /**
   * Returns true if transitioning from currentStatus to nextStatus is allowed.
   * Transitioning to the exact same status is considered an idempotent no-op and returns true.
   */
  static canTransition(currentStatus: DeploymentStatus, nextStatus: DeploymentStatus): boolean {
    if (currentStatus === nextStatus) {
      return true;
    }
    const allowed = this.transitions[currentStatus] ?? [];
    return allowed.includes(nextStatus);
  }

  /**
   * Throws an InvalidStateTransitionException if the transition is prohibited.
   */
  static validateTransition(currentStatus: DeploymentStatus, nextStatus: DeploymentStatus): void {
    if (!this.canTransition(currentStatus, nextStatus)) {
      throw new InvalidStateTransitionException(currentStatus, nextStatus);
    }
  }

  static isTerminal(status: DeploymentStatus): boolean {
    return isTerminalStatus(status);
  }

  static getNextPermittedStatuses(currentStatus: DeploymentStatus): readonly DeploymentStatus[] {
    return this.transitions[currentStatus] ?? [];
  }
}
