import { DeploymentJobPayload } from '../ports/job-publisher.port.js';
import { DeploymentExecutionSummary } from '../orchestrator/deployment-execution-engine.js';

/**
 * Driving consumer contract specifying the interface that background workers (e.g. BullMQ,
 * pg-boss, or in-memory runner) invoke when consuming a deployment job from the queue.
 */
export interface IDeploymentJobConsumer {
  processDeploymentJob(payload: DeploymentJobPayload): Promise<DeploymentExecutionSummary>;
}
