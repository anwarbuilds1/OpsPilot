export interface ConnectionResult {
  readonly connected: boolean;
  readonly providerVersion?: string;
  readonly error?: string;
  readonly latencyMs: number;
}

export interface DeploymentResult {
  readonly success: boolean;
  readonly status: 'Deploying' | 'Succeeded' | 'Failed';
  readonly message?: string;
  readonly providerDeploymentId?: string;
  readonly versionIdentifier: string;
  readonly deployedUrl?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface DeploymentStatusResult {
  readonly status: 'Deploying' | 'HealthChecking' | 'Succeeded' | 'Failed';
  readonly runningCount: number;
  readonly desiredCount: number;
  readonly events: readonly {
    readonly timestamp: Date;
    readonly message: string;
    readonly level?: 'INFO' | 'WARN' | 'ERROR';
  }[];
}

export interface RollbackResult {
  readonly success: boolean;
  readonly restoredArtifactId: string;
  readonly executedAt: Date;
  readonly message?: string;
}

export interface HealthCheckResult {
  readonly isHealthy: boolean;
  readonly httpStatusCode?: number;
  readonly latencyMs?: number;
  readonly errorMessage?: string;
  readonly timestamp: Date;
}
