import {
  DeploymentConfig,
  DeploymentResult,
  DeploymentStatus,
  DeploymentStatuses,
  DeploymentStateMachine,
  HealthCheckResult,
  RollbackResult,
  TargetProvider,
} from '@opspilot/domain';
import { ISecretRedactor, SecretRedactor } from '@opspilot/security';
import {
  DeploymentProviderPort,
  IDeploymentProviderRegistryPort,
} from '../ports/deployment-provider.port.js';
import { IDeploymentRepositoryPort } from '../ports/deployment-repository.port.js';

export interface IDbDeploymentsSink {
  transitionStatus(
    deploymentId: string,
    organizationId: string,
    status: DeploymentStatus,
    failureReason?: string,
  ): Promise<any>;
  recordEvent?(event: {
    deploymentId: string;
    organizationId: string;
    stage: string;
    message: string;
    level: 'INFO' | 'WARN' | 'ERROR';
  }): Promise<any>;
}

export type DeploymentSink = IDeploymentRepositoryPort | IDbDeploymentsSink;

export interface IEngineLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface DeploymentExecutionOptions {
  readonly previousVersionId?: string;
  readonly autoRollbackOnFailure?: boolean;
}

export interface DeploymentExecutionSummary {
  readonly deploymentId: string;
  readonly finalStatus: DeploymentStatus;
  readonly targetProvider: string;
  readonly deployedUrl?: string;
  readonly versionIdentifier?: string;
  readonly failureReason?: string;
  readonly rollbackResult?: RollbackResult;
  readonly completedAt: Date;
  readonly durationMs: number;
}

/**
 * Core Deployment Execution Engine.
 * Orchestrates deployment lifecycle across defined state machine stages:
 * QUEUED -> PREPARING -> BUILDING -> PUBLISHING -> DEPLOYING -> HEALTH_CHECKING -> SUCCEEDED / ROLLING_BACK / FAILED.
 *
 * Uses dependency inversion via DeploymentProviderPort, IDeploymentRepositoryPort, and ISecretRedactor.
 */
export class DeploymentExecutionEngine {
  private readonly redactor: ISecretRedactor;

  constructor(
    private readonly registry: IDeploymentProviderRegistryPort,
    private readonly dbSink?: DeploymentSink,
    private readonly logger?: IEngineLogger,
    redactor?: ISecretRedactor,
  ) {
    this.redactor = redactor ?? new SecretRedactor();
  }

  private async stepTransition(
    config: DeploymentConfig,
    currentStatus: DeploymentStatus,
    nextStatus: DeploymentStatus,
    stageMessage: string,
    level: 'INFO' | 'WARN' | 'ERROR' = 'INFO',
    failureReason?: string,
  ): Promise<void> {
    DeploymentStateMachine.validateTransition(currentStatus, nextStatus);

    this.logger?.info(`[${config.deploymentId}] Transition ${currentStatus} -> ${nextStatus}: ${stageMessage}`);

    if (this.dbSink) {
      // Check if sink implements IDeploymentRepositoryPort (with fromStatus) or IDbDeploymentsSink
      if ('transitionStatus' in this.dbSink) {
        const transitionFn = this.dbSink.transitionStatus as (...args: any[]) => Promise<any>;
        // If method accepts 5 parameters, it is IDeploymentRepositoryPort(id, org, fromStatus, toStatus, reason)
        if (transitionFn.length >= 4) {
          await transitionFn.call(
            this.dbSink,
            config.deploymentId,
            config.organizationId,
            currentStatus,
            nextStatus,
            failureReason,
          );
        } else {
          // IDbDeploymentsSink(id, org, nextStatus, reason)
          await transitionFn.call(
            this.dbSink,
            config.deploymentId,
            config.organizationId,
            nextStatus,
            failureReason,
          );
        }
      }

      if (this.dbSink.recordEvent) {
        const recordFn = this.dbSink.recordEvent as (...args: any[]) => Promise<any>;
        if (recordFn.length === 1) {
          await recordFn.call(this.dbSink, {
            deploymentId: config.deploymentId,
            organizationId: config.organizationId,
            stage: nextStatus,
            message: this.redactor.redact(stageMessage),
            level,
          });
        } else {
          await recordFn.call(
            this.dbSink,
            config.organizationId,
            config.deploymentId,
            nextStatus,
            this.redactor.redact(stageMessage),
            level,
          );
        }
      }
    }
  }

  async execute(
    config: DeploymentConfig,
    credentials: Readonly<Record<string, unknown>>,
    options: DeploymentExecutionOptions = {},
  ): Promise<DeploymentExecutionSummary> {
    const startTime = Date.now();
    let currentStatus: DeploymentStatus = DeploymentStatuses.QUEUED;
    const provider = this.registry.getProvider(config.targetProvider as TargetProvider);

    try {
      // 1. Queued -> Preparing
      await this.stepTransition(
        config,
        currentStatus,
        DeploymentStatuses.PREPARING,
        `Preparing deployment for service ${config.serviceId} on ${config.targetProvider}`,
      );
      currentStatus = DeploymentStatuses.PREPARING;

      const prepared = await provider.prepareDeployment(config);

      // 2. Preparing -> Building
      await this.stepTransition(
        config,
        currentStatus,
        DeploymentStatuses.BUILDING,
        `Building deployment bundle (target: ${prepared.targetArtifactId})`,
      );
      currentStatus = DeploymentStatuses.BUILDING;

      // 3. Building -> Publishing
      await this.stepTransition(
        config,
        currentStatus,
        DeploymentStatuses.PUBLISHING,
        `Publishing verified artifact (digest: ${prepared.artifact.digest})`,
      );
      currentStatus = DeploymentStatuses.PUBLISHING;

      // 4. Publishing -> Deploying
      await this.stepTransition(
        config,
        currentStatus,
        DeploymentStatuses.DEPLOYING,
        `Dispatching deployment to ${config.targetProvider}`,
      );
      currentStatus = DeploymentStatuses.DEPLOYING;

      const deployResult: DeploymentResult = await provider.deploy(prepared, credentials);

      // 5. Deploying -> HealthChecking
      const probeTargetUrl = deployResult.deployedUrl || `http://localhost:${(config as any).containerPort || 8080}`;
      await this.stepTransition(
        config,
        currentStatus,
        DeploymentStatuses.HEALTH_CHECKING,
        `Probing health verification at ${probeTargetUrl}`,
      );
      currentStatus = DeploymentStatuses.HEALTH_CHECKING;

      const healthResult: HealthCheckResult = await provider.checkHealth(probeTargetUrl);

      if (healthResult.isHealthy) {
        // 6a. HealthChecking -> Succeeded
        await this.stepTransition(
          config,
          currentStatus,
          DeploymentStatuses.SUCCEEDED,
          `Deployment verified healthy (HTTP ${healthResult.httpStatusCode}, ${healthResult.latencyMs}ms)`,
        );

        return {
          deploymentId: config.deploymentId,
          finalStatus: DeploymentStatuses.SUCCEEDED,
          targetProvider: config.targetProvider,
          deployedUrl: deployResult.deployedUrl,
          versionIdentifier: deployResult.versionIdentifier,
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        };
      }

      // 6b. Health check failed -> Automated Rollback if supported
      this.logger?.warn(
        `[${config.deploymentId}] Health check failed: ${healthResult.errorMessage}`,
      );

      const canRollback =
        options.autoRollbackOnFailure !== false &&
        options.previousVersionId &&
        provider.capabilities.supportsInstantRollback;

      if (canRollback) {
        await this.stepTransition(
          config,
          currentStatus,
          DeploymentStatuses.ROLLING_BACK,
          `Initiating instant rollback to previous version: ${options.previousVersionId}`,
          'WARN',
        );
        currentStatus = DeploymentStatuses.ROLLING_BACK;

        const rollbackCredentials = {
          ...credentials,
          scriptName: (config as any).scriptName ?? credentials['scriptName'],
          projectName: (config as any).projectName ?? credentials['projectName'],
        };

        const rollbackResult = await provider.rollback(
          config.deploymentId,
          options.previousVersionId!,
          rollbackCredentials,
        );

        await this.stepTransition(
          config,
          currentStatus,
          DeploymentStatuses.ROLLED_BACK,
          `Automated rollback succeeded: ${rollbackResult.message}`,
          'WARN',
          `Health check failure: ${healthResult.errorMessage}`,
        );

        return {
          deploymentId: config.deploymentId,
          finalStatus: DeploymentStatuses.ROLLED_BACK,
          targetProvider: config.targetProvider,
          deployedUrl: deployResult.deployedUrl,
          versionIdentifier: deployResult.versionIdentifier,
          failureReason: `Health check failure: ${healthResult.errorMessage}`,
          rollbackResult,
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        };
      }

      // Rollback not configured or not supported
      await this.stepTransition(
        config,
        currentStatus,
        DeploymentStatuses.FAILED,
        `Health verification failed: ${healthResult.errorMessage}`,
        'ERROR',
        healthResult.errorMessage,
      );

      return {
        deploymentId: config.deploymentId,
        finalStatus: DeploymentStatuses.FAILED,
        targetProvider: config.targetProvider,
        deployedUrl: deployResult.deployedUrl,
        versionIdentifier: deployResult.versionIdentifier,
        failureReason: healthResult.errorMessage,
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      const safeErrorMsg = this.redactor.redact(err.message ?? String(err));
      this.logger?.error(`[${config.deploymentId}] Deployment execution failed: ${safeErrorMsg}`);

      const statusVal = currentStatus as DeploymentStatus;
      if (statusVal !== DeploymentStatuses.FAILED && statusVal !== DeploymentStatuses.ROLLED_BACK) {
        try {
          await this.stepTransition(
            config,
            currentStatus,
            DeploymentStatuses.FAILED,
            `Deployment execution halted: ${safeErrorMsg}`,
            'ERROR',
            safeErrorMsg,
          );
        } catch {
          // Ignore secondary transition error during catch block
        }
      }

      return {
        deploymentId: config.deploymentId,
        finalStatus: DeploymentStatuses.FAILED,
        targetProvider: config.targetProvider,
        failureReason: safeErrorMsg,
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
      };
    }
  }
}
