import {
  ConnectionResult,
  DeploymentCapabilities,
  DeploymentConfig,
  DeploymentResult,
  DeploymentStatusResult,
  HealthCheckResult,
  PreparedDeployment,
  RollbackResult,
  TargetProvider,
} from '@opspilot/domain';

/**
 * Driven port for deployment provider adapters (e.g. AWS ECS, VPS Docker, Cloudflare Workers/Pages).
 * The application layer orchestrates deployments through this abstraction without coupling to specific cloud CLIs or SDKs.
 */
export interface DeploymentProviderPort {
  readonly providerType: TargetProvider;
  readonly capabilities: DeploymentCapabilities;

  validateConnection(
    credentials: Readonly<Record<string, unknown>>,
    targetConfig?: Readonly<Record<string, unknown>>,
  ): Promise<ConnectionResult>;

  prepareDeployment(config: DeploymentConfig): Promise<PreparedDeployment>;

  deploy(
    deployment: PreparedDeployment,
    credentials: Readonly<Record<string, unknown>>,
  ): Promise<DeploymentResult>;

  getStatus(
    deploymentId: string,
    externalId: string,
    credentials: Readonly<Record<string, unknown>>,
  ): Promise<DeploymentStatusResult>;

  checkHealth(targetUrl: string): Promise<HealthCheckResult>;

  rollback(
    deploymentId: string,
    targetVersionId: string,
    credentials: Readonly<Record<string, unknown>>,
  ): Promise<RollbackResult>;
}

export interface IDeploymentProviderRegistryPort {
  getProvider(providerType: TargetProvider): DeploymentProviderPort;
  hasProvider(providerType: TargetProvider): boolean;
}
