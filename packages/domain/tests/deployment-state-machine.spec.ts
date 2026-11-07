import { describe, expect, it } from 'vitest';
import {
  DeploymentStateMachine,
  DeploymentStatuses,
  InvalidStateTransitionException,
} from '../src/index.js';

describe('DeploymentStateMachine', () => {
  it('allows valid forward transitions from Queued through Succeeded', () => {
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.QUEUED, DeploymentStatuses.PREPARING)).toBe(true);
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.PREPARING, DeploymentStatuses.BUILDING)).toBe(true);
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.BUILDING, DeploymentStatuses.PUBLISHING)).toBe(true);
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.PUBLISHING, DeploymentStatuses.DEPLOYING)).toBe(true);
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.DEPLOYING, DeploymentStatuses.HEALTH_CHECKING)).toBe(true);
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.HEALTH_CHECKING, DeploymentStatuses.SUCCEEDED)).toBe(true);
  });

  it('allows idempotent self-transitions', () => {
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.QUEUED, DeploymentStatuses.QUEUED)).toBe(true);
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.BUILDING, DeploymentStatuses.BUILDING)).toBe(true);
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.SUCCEEDED, DeploymentStatuses.SUCCEEDED)).toBe(true);
  });

  it('allows transitions to Failed or Cancelled from non-terminal states', () => {
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.QUEUED, DeploymentStatuses.CANCELLED)).toBe(true);
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.BUILDING, DeploymentStatuses.FAILED)).toBe(true);
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.DEPLOYING, DeploymentStatuses.FAILED)).toBe(true);
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.HEALTH_CHECKING, DeploymentStatuses.ROLLING_BACK)).toBe(true);
  });

  it('allows rollback execution from Failed and HealthChecking', () => {
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.FAILED, DeploymentStatuses.ROLLING_BACK)).toBe(true);
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.FAILED, DeploymentStatuses.ROLLED_BACK)).toBe(true);
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.ROLLING_BACK, DeploymentStatuses.ROLLED_BACK)).toBe(true);
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.ROLLING_BACK, DeploymentStatuses.SUCCEEDED)).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.QUEUED, DeploymentStatuses.SUCCEEDED)).toBe(false);
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.BUILDING, DeploymentStatuses.HEALTH_CHECKING)).toBe(false);
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.SUCCEEDED, DeploymentStatuses.BUILDING)).toBe(false);
    expect(DeploymentStateMachine.canTransition(DeploymentStatuses.ROLLED_BACK, DeploymentStatuses.PREPARING)).toBe(false);

    expect(() =>
      DeploymentStateMachine.validateTransition(DeploymentStatuses.QUEUED, DeploymentStatuses.SUCCEEDED)
    ).toThrow(InvalidStateTransitionException);
  });

  it('identifies terminal states', () => {
    expect(DeploymentStateMachine.isTerminal(DeploymentStatuses.SUCCEEDED)).toBe(true);
    expect(DeploymentStateMachine.isTerminal(DeploymentStatuses.ROLLED_BACK)).toBe(true);
    expect(DeploymentStateMachine.isTerminal(DeploymentStatuses.CANCELLED)).toBe(true);
    expect(DeploymentStateMachine.isTerminal(DeploymentStatuses.BUILDING)).toBe(false);
    expect(DeploymentStateMachine.isTerminal(DeploymentStatuses.HEALTH_CHECKING)).toBe(false);
  });
});
