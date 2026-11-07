/**
 * Detailed interfaces and contract specifications for the Cloudflare API client.
 * Adheres to ADR-0014, ADR-0015, and ADR-0018.
 */

export interface CloudflareWorkerBinding {
  readonly name: string;
  readonly type: 'plain_text' | 'secret_text' | 'kv_namespace' | 'd1' | 'r2_bucket';
  readonly text?: string;
  readonly namespace_id?: string;
  readonly id?: string;
  readonly bucket_name?: string;
}

export interface CloudflareWorkerBundlePayload {
  readonly esmContent: string;
  readonly compatibilityDate: string;
  readonly compatibilityFlags?: readonly string[];
  readonly bindings?: readonly CloudflareWorkerBinding[];
}

export interface CloudflareWorkerVersionResponse {
  readonly id: string;
  readonly number: number;
  readonly metadata?: Record<string, unknown>;
  readonly created_on: string;
}

export interface CloudflareWorkerDeploymentResponse {
  readonly id: string;
  readonly created_on: string;
  readonly versions: ReadonlyArray<{
    readonly version_id: string;
    readonly percentage: number;
  }>;
}

export interface CloudflarePagesProjectResponse {
  readonly id: string;
  readonly name: string;
  readonly subdomain: string;
  readonly production_branch: string;
  readonly created_on: string;
}

export interface CloudflarePagesDeploymentResponse {
  readonly id: string;
  readonly short_id: string;
  readonly project_id: string;
  readonly project_name: string;
  readonly environment: 'production' | 'preview';
  readonly url: string;
  readonly created_on: string;
  readonly latest_stage?: {
    readonly name: string;
    readonly status: 'queued' | 'active' | 'idle' | 'success' | 'failure';
    readonly started_on?: string;
    readonly ended_on?: string;
  };
  readonly stages?: ReadonlyArray<{
    readonly name: string;
    readonly status: string;
  }>;
}

export interface CloudflareTokenVerification {
  readonly valid: boolean;
  readonly status?: string;
  readonly tokenId?: string;
}

export interface CloudflareAccountInfo {
  readonly id: string;
  readonly name: string;
}

export interface CloudflareProbedCapabilities {
  readonly workers: boolean;
  readonly pages: boolean;
  readonly tail: boolean;
  readonly customDomains: boolean;
  readonly d1: boolean;
  readonly kv: boolean;
  readonly r2: boolean;
}

export interface CloudflareWorkerAnalyticsSummary {
  readonly requests: number;
  readonly errors: number;
  readonly subrequests: number;
  readonly cpuTimeP50Microseconds: number;
  readonly cpuTimeP99Microseconds: number;
}

export interface ICloudflareApiClient {
  // Authentication & Scoping
  verifyToken(apiToken: string): Promise<CloudflareTokenVerification>;
  listAccounts(apiToken: string): Promise<CloudflareAccountInfo[]>;
  probeCapabilities(accountId: string, apiToken: string): Promise<CloudflareProbedCapabilities>;

  // Workers Lifecycle Operations
  uploadScriptVersion(
    accountId: string,
    scriptName: string,
    bundle: CloudflareWorkerBundlePayload,
    apiToken: string,
  ): Promise<CloudflareWorkerVersionResponse>;

  deployScriptVersion(
    accountId: string,
    scriptName: string,
    versions: ReadonlyArray<{ versionId: string; percentage: number }>,
    apiToken: string,
  ): Promise<CloudflareWorkerDeploymentResponse>;

  getScriptDeployments(
    accountId: string,
    scriptName: string,
    apiToken: string,
  ): Promise<CloudflareWorkerDeploymentResponse[]>;

  getScriptVersions(
    accountId: string,
    scriptName: string,
    apiToken: string,
  ): Promise<CloudflareWorkerVersionResponse[]>;

  syncScriptSecrets(
    accountId: string,
    scriptName: string,
    secrets: Readonly<Record<string, string>>,
    apiToken: string,
  ): Promise<void>;

  createTailSession(
    accountId: string,
    scriptName: string,
    apiToken: string,
  ): Promise<{ id: string; url: string; expiresAt: Date }>;

  // Pages Lifecycle Operations
  getOrCreatePagesProject(
    accountId: string,
    projectName: string,
    config: { productionBranch?: string },
    apiToken: string,
  ): Promise<CloudflarePagesProjectResponse>;

  createPagesDirectUploadDeployment(
    accountId: string,
    projectName: string,
    manifest: Readonly<Record<string, string>>,
    files: Map<string, Buffer>,
    environment: 'production' | 'preview',
    apiToken: string,
  ): Promise<CloudflarePagesDeploymentResponse>;

  getPagesDeployment(
    accountId: string,
    projectName: string,
    deploymentId: string,
    apiToken: string,
  ): Promise<CloudflarePagesDeploymentResponse>;

  rollbackPagesDeployment(
    accountId: string,
    projectName: string,
    deploymentId: string,
    apiToken: string,
  ): Promise<CloudflarePagesDeploymentResponse>;

  // Observability
  queryWorkersAnalytics(
    accountId: string,
    scriptName: string,
    timeRangeHours: number,
    apiToken: string,
  ): Promise<CloudflareWorkerAnalyticsSummary>;
}
