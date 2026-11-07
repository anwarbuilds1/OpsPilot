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
  isVpsDockerConfig,
  PreparedDeployment,
  ProviderIncompatibilityException,
  RollbackResult,
  TargetProviders,
} from '@opspilot/domain';
import { BaseDeploymentProvider } from '../base/base-deployment.provider.js';
import { DockerComposeGenerator } from '../collaborators/docker-compose-generator.js';
import {
  ISshClientPool,
  MockSshClientPool,
} from '../collaborators/ssh-client-pool.interface.js';
import { ILogger } from '../interfaces/logger.interface.js';
import { ISecretRedactor } from '@opspilot/security';

export class VpsDockerProvider extends BaseDeploymentProvider {
  readonly providerType = TargetProviders.VPS_DOCKER;

  readonly capabilities: DeploymentCapabilities = {
    targetProvider: TargetProviders.VPS_DOCKER,
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
    private readonly sshPool: ISshClientPool = new MockSshClientPool(),
    private readonly composeGenerator: DockerComposeGenerator = new DockerComposeGenerator(),
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
      const privateKey = (credentials['sshPrivateKey'] as string | undefined) ?? '';
      const hostIp = (targetConfig?.['hostIp'] as string | undefined) ?? '127.0.0.1';
      const port = (targetConfig?.['sshPort'] as number | undefined) ?? 22;
      const user = (targetConfig?.['sshUser'] as string | undefined) ?? 'root';

      const isConnected = await this.sshPool.testConnection(hostIp, port, user, privateKey);

      if (!isConnected) {
        return {
          connected: false,
          error: 'SSH authentication failed or host unreachable',
          latencyMs: Date.now() - startTime,
        };
      }

      return {
        connected: true,
        providerVersion: 'Docker Engine 26.0 (Compose v2.27)',
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
    if (!isVpsDockerConfig(config)) {
      throw new ProviderIncompatibilityException(
        this.providerType,
        `Expected 'vps_docker' config but received '${config.targetProvider}'`
      );
    }

    this.logger.info(`Preparing VPS Docker Compose configuration for: ${config.serviceId}`);

    const composeContent = this.composeGenerator.generate({
      serviceName: 'app',
      imageUri: config.imageUri,
      containerPort: config.containerPort,
      environmentVariables: { ...config.environmentVariables },
    });

    const targetArtifactId = `/etc/opspilot/${config.serviceId}/docker-compose.${config.commitSha.slice(0, 8)}.yml`;

    return {
      deploymentId: config.deploymentId,
      targetProvider: this.providerType,
      targetArtifactId,
      artifact: {
        artifactType: ArtifactTypes.OCI_IMAGE,
        artifactReference: config.imageUri,
        digest: 'sha256:vps_digest_placeholder',
        metadata: {
          containerPort: config.containerPort,
          cpuUnits: config.cpuUnits,
          memoryMb: config.memoryMb,
        },
      },
      providerMetadata: {
        hostIp: config.hostIp,
        sshPort: config.sshPort,
        composeFilePath: config.composeFilePath,
        composeContent,
      },
    };
  }

  async deploy(
    deployment: PreparedDeployment,
    credentials: Readonly<Record<string, unknown>>
  ): Promise<DeploymentResult> {
    this.logger.info(`Deploying via SSH to VPS: ${deployment.targetArtifactId}`);

    const privateKey = (credentials['sshPrivateKey'] as string | undefined) ?? '';
    const hostIp = (deployment.providerMetadata['hostIp'] as string) ?? '127.0.0.1';
    const port = (deployment.providerMetadata['sshPort'] as number) ?? 22;

    const result = await this.sshPool.executeCommand(
      hostIp,
      port,
      'root',
      `docker compose -f ${deployment.targetArtifactId} up -d`,
      privateKey
    );

    if (result.exitCode !== 0) {
      throw new Error(`VPS deployment failed with exit code ${result.exitCode}: ${result.stderr}`);
    }

    return {
      success: true,
      status: 'Deploying',
      versionIdentifier: deployment.targetArtifactId,
      deployedUrl: `http://${hostIp}:8080`,
      metadata: {
        composeFilePath: deployment.targetArtifactId,
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
      runningCount: 1,
      desiredCount: 1,
      events: [
        {
          timestamp: new Date(),
          message: 'Container app-1 Started',
          level: 'INFO',
        },
      ],
    };
  }

  async rollback(
    deploymentId: string,
    targetVersionIdentifier: string,
    credentials: Readonly<Record<string, unknown>>
  ): Promise<RollbackResult> {
    this.logger.warn(`Executing VPS rollback for deployment ${deploymentId} to: ${targetVersionIdentifier}`);

    const privateKey = (credentials['sshPrivateKey'] as string | undefined) ?? '';
    const hostIp = '127.0.0.1';

    const result = await this.sshPool.executeCommand(
      hostIp,
      22,
      'root',
      `docker compose -f ${targetVersionIdentifier} up -d`,
      privateKey
    );

    if (result.exitCode !== 0) {
      throw new Error(`VPS rollback failed with exit code ${result.exitCode}: ${result.stderr}`);
    }

    return {
      success: true,
      restoredArtifactId: targetVersionIdentifier,
      executedAt: new Date(),
      message: `VPS Docker Compose restored to ${targetVersionIdentifier}`,
    };
  }

  async checkHealth(targetUrl: string): Promise<HealthCheckResult> {
    const isMockHealthy = !targetUrl.includes('unhealthy');
    return {
      isHealthy: isMockHealthy,
      httpStatusCode: isMockHealthy ? 200 : 500,
      latencyMs: 15,
      timestamp: new Date(),
      errorMessage: isMockHealthy ? undefined : 'Docker container returned 500 Internal Server Error',
    };
  }
}
