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
 * Universal deployment provider contract.
 * Concrete providers (AWS ECS, VPS Docker, Cloudflare Workers, Cloudflare Pages) implement this interface.
 */
export interface IDeploymentProvider {
  readonly providerType: TargetProvider;
  readonly capabilities: DeploymentCapabilities;

  /**
   * Validates authentication credentials and connectivity to the remote target infrastructure.
   */
  validateConnection(
    credentials: Readonly<Record<string, unknown>>,
    targetConfig?: Readonly<Record<string, unknown>>
  ): Promise<ConnectionResult>;

  /**
   * Validates and prepares target manifests or task definitions.
   */
  prepareDeployment(config: DeploymentConfig): Promise<PreparedDeployment>;

  /**
   * Dispatches the deployment artifact/manifest to the target infrastructure.
   */
  deploy(
    deployment: PreparedDeployment,
    credentials: Readonly<Record<string, unknown>>
  ): Promise<DeploymentResult>;

  /**
   * Queries real-time progress and event streams from the target provider.
   */
  getStatus(
    deploymentId: string,
    externalId: string,
    credentials: Readonly<Record<string, unknown>>
  ): Promise<DeploymentStatusResult>;

  /**
   * Executes an immediate rollback to the preceding immutable artifact version.
   */
  rollback(
    deploymentId: string,
    targetVersionIdentifier: string,
    credentials: Readonly<Record<string, unknown>>
  ): Promise<RollbackResult>;

  /**
   * Probes the deployed service health endpoint until verified or timed out.
   */
  checkHealth(targetUrl: string): Promise<HealthCheckResult>;
}
