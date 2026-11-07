import {
  ConnectionResult,
  DeploymentCapabilities,
  DeploymentConfig,
  DeploymentResult,
  DeploymentStatusResult,
  DomainException,
  HealthCheckResult,
  PreparedDeployment,
  RollbackResult,
  TargetProvider,
  TenantIsolationException,
} from '@opspilot/domain';
import { ISecretRedactor, SecretRedactor } from '@opspilot/security';
import { IDeploymentProvider } from '../interfaces/deployment-provider.interface.js';
import { ConsoleLogger, ILogger } from '../interfaces/logger.interface.js';

export abstract class BaseDeploymentProvider implements IDeploymentProvider {
  abstract readonly providerType: TargetProvider;
  abstract readonly capabilities: DeploymentCapabilities;

  protected readonly logger: ILogger;
  protected readonly redactor: ISecretRedactor;

  constructor(logger?: ILogger, redactor?: ISecretRedactor) {
    this.logger = logger ?? new ConsoleLogger(this.constructor.name);
    this.redactor = redactor ?? new SecretRedactor();
  }

  abstract validateConnection(
    credentials: Readonly<Record<string, unknown>>,
    targetConfig?: Readonly<Record<string, unknown>>
  ): Promise<ConnectionResult>;

  abstract prepareDeployment(config: DeploymentConfig): Promise<PreparedDeployment>;

  abstract deploy(
    deployment: PreparedDeployment,
    credentials: Readonly<Record<string, unknown>>
  ): Promise<DeploymentResult>;

  abstract getStatus(
    deploymentId: string,
    externalId: string,
    credentials: Readonly<Record<string, unknown>>
  ): Promise<DeploymentStatusResult>;

  abstract rollback(
    deploymentId: string,
    targetVersionIdentifier: string,
    credentials: Readonly<Record<string, unknown>>
  ): Promise<RollbackResult>;

  abstract checkHealth(targetUrl: string): Promise<HealthCheckResult>;

  /**
   * Enforces strict multi-tenant boundary. Throws TenantIsolationException on mismatch.
   */
  protected validateTenantContext(expectedOrgId: string, resourceOrgId: string): void {
    if (!expectedOrgId || !resourceOrgId || expectedOrgId !== resourceOrgId) {
      throw new TenantIsolationException(
        'Cross-tenant operation detected: organization_id mismatch',
        expectedOrgId,
        resourceOrgId
      );
    }
  }

  /**
   * Normalizes unknown errors into standard OpsPilot DomainExceptions with sanitized error messages.
   */
  protected normalizeError(error: unknown, fallbackMessage: string): DomainException {
    if (error instanceof DomainException) {
      return error;
    }
    const rawMessage = error instanceof Error ? error.message : String(error);
    const sanitized = this.redactor.redact(rawMessage);

    return new (class ProviderExecutionException extends DomainException {
      constructor(msg: string) {
        super(msg, 'PROVIDER_EXECUTION_FAILURE', { originalError: sanitized });
      }
    })(`${fallbackMessage}: ${sanitized}`);
  }
}
