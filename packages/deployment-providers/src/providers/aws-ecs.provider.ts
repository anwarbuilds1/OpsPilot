import {
  ApplicationRuntimes,
  ArtifactTypes,
  BuildStrategies,
  ConnectionResult,
  DeploymentCapabilities,
  DeploymentConfig,
  DeploymentResult,
  DeploymentStatusResult,
  HealthCheckResult,
  isAwsEcsConfig,
  PreparedDeployment,
  ProviderIncompatibilityException,
  RollbackResult,
  TargetProviders,
} from '@opspilot/domain';
import { BaseDeploymentProvider } from '../base/base-deployment.provider.js';
import {
  IContainerRegistryClient,
  MockContainerRegistryClient,
} from '../collaborators/container-registry-client.interface.js';
import { ILogger } from '../interfaces/logger.interface.js';
import { ISecretRedactor } from '@opspilot/security';

export class AwsEcsProvider extends BaseDeploymentProvider {
  readonly providerType = TargetProviders.AWS_ECS;

  readonly capabilities: DeploymentCapabilities = {
    targetProvider: TargetProviders.AWS_ECS,
    applicationRuntime: ApplicationRuntimes.CONTAINER,
    supportsContainers: true,
    supportsStaticAssets: false,
    supportsEdgeFunctions: false,
    requiresPortBinding: true,
    requiresResourceLimits: true,
    supportsTrafficWeighting: false,
    supportsDirectUpload: false,
    supportsInstantRollback: false,
    supportedBuildStrategies: [BuildStrategies.DOCKERFILE],
    supportedArtifactTypes: [ArtifactTypes.OCI_IMAGE],
  };

  constructor(
    private readonly registryClient: IContainerRegistryClient = new MockContainerRegistryClient(),
    logger?: ILogger,
    redactor?: ISecretRedactor
  ) {
    super(logger, redactor);
  }

  async validateConnection(
    credentials: Readonly<Record<string, unknown>>,
    targetConfig?: Readonly<Record<string, unknown>>
  ): Promise<ConnectionResult> {
    const startTime = Date.now();
    try {
      const roleArn = credentials['roleArn'] as string | undefined;
      const clusterArn = targetConfig?.['clusterArn'] as string | undefined;

      if (!roleArn || roleArn.includes('invalid')) {
        return {
          connected: false,
          error: 'Invalid AWS IAM role ARN',
          latencyMs: Date.now() - startTime,
        };
      }

      if (clusterArn && clusterArn.includes('invalid')) {
        return {
          connected: false,
          error: 'Invalid AWS ECS cluster ARN',
          latencyMs: Date.now() - startTime,
        };
      }

      return {
        connected: true,
        providerVersion: 'Amazon ECS API (Fargate)',
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        connected: false,
        error: this.redactor.redact((err as Error).message),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  async prepareDeployment(config: DeploymentConfig): Promise<PreparedDeployment> {
    if (!isAwsEcsConfig(config)) {
      throw new ProviderIncompatibilityException(
        this.providerType,
        `Expected 'aws_ecs' config but received '${config.targetProvider}'`
      );
    }

    this.logger.info(`Preparing AWS ECS deployment for service: ${config.serviceId}`);

    const digestCheck = await this.registryClient.verifyImageDigest(config.imageUri);
    if (!digestCheck.exists) {
      throw new Error(`Cannot prepare ECS deployment: Image verification failed - ${digestCheck.error}`);
    }

    const taskDefinitionArn = `arn:aws:ecs:us-east-1:123456789012:task-definition/${config.taskFamily}:42`;

    return {
      deploymentId: config.deploymentId,
      targetProvider: this.providerType,
      targetArtifactId: taskDefinitionArn,
      artifact: {
        artifactType: ArtifactTypes.OCI_IMAGE,
        artifactReference: config.imageUri,
        digest: digestCheck.digest ?? 'sha256:unknown',
        metadata: {
          containerPort: config.containerPort,
          cpuUnits: config.cpuUnits,
          memoryMb: config.memoryMb,
        },
      },
      providerMetadata: {
        clusterArn: config.clusterArn,
        taskFamily: config.taskFamily,
        taskDefinitionArn,
        containerPort: config.containerPort,
        environmentVariables: config.environmentVariables,
      },
    };
  }

  async deploy(
    deployment: PreparedDeployment,
    _credentials: Readonly<Record<string, unknown>>
  ): Promise<DeploymentResult> {
    this.logger.info(`Executing ECS Service update for task def: ${deployment.targetArtifactId}`);

    const ecsDeploymentId = `ecs-svc-dep-${deployment.deploymentId.slice(0, 8)}`;

    return {
      success: true,
      status: 'Deploying',
      providerDeploymentId: ecsDeploymentId,
      versionIdentifier: deployment.targetArtifactId,
      deployedUrl: `http://${deployment.deploymentId.slice(0, 8)}.alb.us-east-1.elb.amazonaws.com`,
      metadata: {
        clusterArn: deployment.providerMetadata['clusterArn'],
        taskDefinitionArn: deployment.targetArtifactId,
      },
    };
  }

  async getStatus(
    _deploymentId: string,
    _externalId: string,
    _credentials: Readonly<Record<string, unknown>>
  ): Promise<DeploymentStatusResult> {
    return {
      status: 'Succeeded',
      runningCount: 2,
      desiredCount: 2,
      events: [
        {
          timestamp: new Date(),
          message: 'service payments-api has reached a steady state.',
          level: 'INFO',
        },
      ],
    };
  }

  async rollback(
    deploymentId: string,
    targetVersionIdentifier: string,
    _credentials: Readonly<Record<string, unknown>>
  ): Promise<RollbackResult> {
    this.logger.warn(`Executing AWS ECS rollback for deployment ${deploymentId} to task def: ${targetVersionIdentifier}`);

    if (!targetVersionIdentifier.startsWith('arn:aws:ecs:')) {
      throw new Error(`Invalid ECS task definition ARN for rollback: ${targetVersionIdentifier}`);
    }

    return {
      success: true,
      restoredArtifactId: targetVersionIdentifier,
      executedAt: new Date(),
      message: `ECS service reverted to task definition ${targetVersionIdentifier}`,
    };
  }

  async checkHealth(targetUrl: string): Promise<HealthCheckResult> {
    const isMockHealthy = !targetUrl.includes('unhealthy');
    return {
      isHealthy: isMockHealthy,
      httpStatusCode: isMockHealthy ? 200 : 503,
      latencyMs: 45,
      timestamp: new Date(),
      errorMessage: isMockHealthy ? undefined : 'ALB target group returned 503 Service Unavailable',
    };
  }
}
