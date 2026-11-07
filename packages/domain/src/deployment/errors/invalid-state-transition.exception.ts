import { DeploymentStatus } from '../enums/deployment-status.enum.js';
import { DomainException } from './domain.exception.js';

export class InvalidStateTransitionException extends DomainException {
  constructor(currentStatus: DeploymentStatus, attemptedStatus: DeploymentStatus) {
    super(
      `Cannot transition deployment from status '${currentStatus}' to '${attemptedStatus}'`,
      'INVALID_STATE_TRANSITION',
      { currentStatus, attemptedStatus }
    );
  }
}
