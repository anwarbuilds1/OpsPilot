import { SecretRedactor } from '@opspilot/security';
import {
  CloudflareAccountInfo,
  CloudflarePagesDeploymentResponse,
  CloudflarePagesProjectResponse,
  CloudflareProbedCapabilities,
  CloudflareTokenVerification,
  CloudflareWorkerAnalyticsSummary,
  CloudflareWorkerBundlePayload,
  CloudflareWorkerDeploymentResponse,
  CloudflareWorkerVersionResponse,
  ICloudflareApiClient,
} from '../../collaborators/cloudflare-api-client.interface.js';
import { ILogger } from '../../interfaces/logger.interface.js';

export interface CloudflareApiClientOptions {
  readonly baseUrl?: string;
  readonly fetchFn?: typeof fetch;
  readonly logger?: ILogger;
  readonly maxRetries?: number;
  readonly baseBackoffMs?: number;
}

export class CloudflareApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errors: unknown[] = [],
  ) {
    super(message);
    this.name = 'CloudflareApiError';
  }
}

export class CloudflareApiClient implements ICloudflareApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly logger?: ILogger;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;

  constructor(options: CloudflareApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'https://api.cloudflare.com/client/v4').replace(/\/$/, '');
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.logger = options.logger;
    this.maxRetries = options.maxRetries ?? 3;
    this.baseBackoffMs = options.baseBackoffMs ?? 500;
  }

  /**
   * Internal HTTP execution with automatic rate-limit (429) backoff, retry, and secret redaction.
   */
  private async request<T>(
    endpoint: string,
    token: string,
    init: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      attempt++;
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
      }

      try {
        const response = await this.fetchFn(url, {
          ...init,
          headers,
        });

        if (response.status === 429) {
          const retryAfterSec = Number(response.headers.get('Retry-After')) || 1;
          const jitter = Math.random() * 200;
          const waitMs = Math.max(retryAfterSec * 1000, this.baseBackoffMs * Math.pow(2, attempt - 1)) + jitter;

          this.logger?.warn(
            `[CloudflareApiClient] Rate limit 429 received on ${endpoint}. Retrying in ${Math.round(waitMs)}ms (attempt ${attempt}/${this.maxRetries})`,
          );

          if (attempt > this.maxRetries) {
            throw new CloudflareApiError(`Cloudflare rate limit exceeded after ${this.maxRetries} retries`, 429);
          }

          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        if (!response.ok) {
          let errBody: any;
          try {
            errBody = await response.json();
          } catch {
            errBody = { errors: [{ message: response.statusText }] };
          }

          const rawMsg = errBody?.errors?.[0]?.message ?? `HTTP ${response.status} ${response.statusText}`;
          const safeMsg = SecretRedactor.redactText(rawMsg);
          throw new CloudflareApiError(safeMsg, response.status, errBody?.errors ?? []);
        }

        const data = await response.json();
        return data as T;
      } catch (error: any) {
        if (error instanceof CloudflareApiError) {
          throw error;
        }

        if (attempt <= this.maxRetries) {
          const waitMs = this.baseBackoffMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        const safeErr = SecretRedactor.redactText(error?.message ?? String(error));
        throw new CloudflareApiError(`Network failure while contacting Cloudflare API: ${safeErr}`, 0);
      }
    }

    throw new CloudflareApiError('Cloudflare API request failed after max retries', 500);
  }

  // ==========================================
  // Authentication & Capability Probing
  // ==========================================

  async verifyToken(apiToken: string): Promise<CloudflareTokenVerification> {
    try {
      const res = await this.request<{
        success: boolean;
        result?: { id: string; status: string };
      }>('/user/tokens/verify', apiToken, { method: 'GET' });

      return {
        valid: res.success === true && res.result?.status === 'active',
        status: res.result?.status,
        tokenId: res.result?.id,
      };
    } catch {
      return { valid: false };
    }
  }

  async listAccounts(apiToken: string): Promise<CloudflareAccountInfo[]> {
    const res = await this.request<{
      success: boolean;
      result: Array<{ id: string; name: string }>;
    }>('/accounts', apiToken, { method: 'GET' });

    return res.result.map((acc) => ({ id: acc.id, name: acc.name }));
  }

  async probeCapabilities(accountId: string, apiToken: string): Promise<CloudflareProbedCapabilities> {
    const checkEndpoint = async (endpoint: string): Promise<boolean> => {
      try {
        await this.request(endpoint, apiToken, { method: 'GET' });
        return true;
      } catch (err: any) {
        if (err instanceof CloudflareApiError && (err.statusCode === 401 || err.statusCode === 403)) {
          return false;
        }
        // Non-auth errors (e.g. 404 or empty list) indicate the token has permission to access the resource
        return true;
      }
    };

    const [workers, pages, kv, d1, r2] = await Promise.all([
      checkEndpoint(`/accounts/${accountId}/workers/scripts?per_page=1`),
      checkEndpoint(`/accounts/${accountId}/pages/projects?per_page=1`),
      checkEndpoint(`/accounts/${accountId}/storage/kv/namespaces?per_page=1`),
      checkEndpoint(`/accounts/${accountId}/d1/database?per_page=1`),
      checkEndpoint(`/accounts/${accountId}/r2/buckets?per_page=1`),
    ]);

    return {
      workers,
      pages,
      tail: workers, // Workers tail is tied to worker script permissions
      customDomains: workers || pages,
      kv,
      d1,
      r2,
    };
  }

  // ==========================================
  // Cloudflare Workers Methods
  // ==========================================

  async uploadScriptVersion(
    accountId: string,
    scriptName: string,
    bundle: CloudflareWorkerBundlePayload,
    apiToken: string,
  ): Promise<CloudflareWorkerVersionResponse> {
    const formData = new FormData();

    const metadata = {
      main_module: 'index.js',
      compatibility_date: bundle.compatibilityDate,
      compatibility_flags: bundle.compatibilityFlags ?? [],
      bindings: bundle.bindings ?? [],
    };

    formData.append('metadata', JSON.stringify(metadata));
    formData.append(
      'index.js',
      new Blob([bundle.esmContent], { type: 'application/javascript+module' }),
      'index.js',
    );

    const res = await this.request<{
      success: boolean;
      result: {
        id: string;
        number: number;
        metadata?: Record<string, unknown>;
        created_on: string;
      };
    }>(`/accounts/${accountId}/workers/scripts/${scriptName}/versions`, apiToken, {
      method: 'POST',
      body: formData,
    });

    return {
      id: res.result.id,
      number: res.result.number,
      metadata: res.result.metadata,
      created_on: res.result.created_on,
    };
  }

  async deployScriptVersion(
    accountId: string,
    scriptName: string,
    versions: ReadonlyArray<{ versionId: string; percentage: number }>,
    apiToken: string,
  ): Promise<CloudflareWorkerDeploymentResponse> {
    const payload = {
      versions: versions.map((v) => ({
        version_id: v.versionId,
        percentage: v.percentage,
      })),
    };

    const res = await this.request<{
      success: boolean;
      result: {
        id: string;
        created_on: string;
        versions: Array<{ version_id: string; percentage: number }>;
      };
    }>(`/accounts/${accountId}/workers/scripts/${scriptName}/deployments`, apiToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return {
      id: res.result.id,
      created_on: res.result.created_on,
      versions: res.result.versions,
    };
  }

  async getScriptDeployments(
    accountId: string,
    scriptName: string,
    apiToken: string,
  ): Promise<CloudflareWorkerDeploymentResponse[]> {
    const res = await this.request<{
      success: boolean;
      result: {
        deployments: Array<{
          id: string;
          created_on: string;
          versions: Array<{ version_id: string; percentage: number }>;
        }>;
      };
    }>(`/accounts/${accountId}/workers/scripts/${scriptName}/deployments`, apiToken, {
      method: 'GET',
    });

    return (res.result?.deployments ?? []).map((dep) => ({
      id: dep.id,
      created_on: dep.created_on,
      versions: dep.versions,
    }));
  }

  async getScriptVersions(
    accountId: string,
    scriptName: string,
    apiToken: string,
  ): Promise<CloudflareWorkerVersionResponse[]> {
    const res = await this.request<{
      success: boolean;
      result: {
        items: Array<{
          id: string;
          number: number;
          metadata?: Record<string, unknown>;
          created_on: string;
        }>;
      };
    }>(`/accounts/${accountId}/workers/scripts/${scriptName}/versions`, apiToken, {
      method: 'GET',
    });

    return (res.result?.items ?? []).map((v) => ({
      id: v.id,
      number: v.number,
      metadata: v.metadata,
      created_on: v.created_on,
    }));
  }

  async syncScriptSecrets(
    accountId: string,
    scriptName: string,
    secrets: Readonly<Record<string, string>>,
    apiToken: string,
  ): Promise<void> {
    for (const [key, value] of Object.entries(secrets)) {
      await this.request(
        `/accounts/${accountId}/workers/scripts/${scriptName}/secrets`,
        apiToken,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: key,
            text: value,
            type: 'secret_text',
          }),
        },
      );
    }
  }

  async createTailSession(
    accountId: string,
    scriptName: string,
    apiToken: string,
  ): Promise<{ id: string; url: string; expiresAt: Date }> {
    const res = await this.request<{
      success: boolean;
      result: { id: string; url: string; expires_at: string };
    }>(`/accounts/${accountId}/workers/scripts/${scriptName}/tails`, apiToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    return {
      id: res.result.id,
      url: res.result.url,
      expiresAt: new Date(res.result.expires_at),
    };
  }

  // ==========================================
  // Cloudflare Pages Methods (Direct Upload)
  // ==========================================

  async getOrCreatePagesProject(
    accountId: string,
    projectName: string,
    config: { productionBranch?: string },
    apiToken: string,
  ): Promise<CloudflarePagesProjectResponse> {
    try {
      const res = await this.request<{
        success: boolean;
        result: {
          id: string;
          name: string;
          subdomain: string;
          production_branch: string;
          created_on: string;
        };
      }>(`/accounts/${accountId}/pages/projects/${projectName}`, apiToken, {
        method: 'GET',
      });

      return res.result;
    } catch (err: any) {
      if (err instanceof CloudflareApiError && err.statusCode === 404) {
        // Project does not exist, create it
        const createRes = await this.request<{
          success: boolean;
          result: {
            id: string;
            name: string;
            subdomain: string;
            production_branch: string;
            created_on: string;
          };
        }>(`/accounts/${accountId}/pages/projects`, apiToken, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: projectName,
            production_branch: config.productionBranch ?? 'main',
          }),
        });
        return createRes.result;
      }
      throw err;
    }
  }

  async createPagesDirectUploadSession(
    accountId: string,
    projectName: string,
    apiToken: string,
  ): Promise<{ jwt: string; uploadUrl?: string }> {
    const res = await this.request<{
      success: boolean;
      result: {
        id: string;
        jwt?: string;
        upload_url?: string;
      };
    }>(`/accounts/${accountId}/pages/projects/${projectName}/direct_upload`, apiToken, {
      method: 'POST',
    });

    const jwt = res.result.jwt ?? res.result.id;
    return {
      jwt,
      uploadUrl: res.result.upload_url,
    };
  }

  async checkMissingPagesAssets(
    hashes: readonly string[],
    sessionJwt: string,
  ): Promise<string[]> {
    if (hashes.length === 0) {
      return [];
    }

    const res = await this.request<{
      success: boolean;
      result: string[];
    }>('/pages/assets/check-missing', sessionJwt, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hashes }),
    });

    return res.result ?? [];
  }

  async uploadPagesMissingAssets(
    missingFiles: ReadonlyArray<{ hash: string; content: Buffer }>,
    sessionJwt: string,
  ): Promise<void> {
    if (missingFiles.length === 0) {
      return;
    }

    const payload = missingFiles.map((file) => ({
      key: file.hash,
      value: file.content.toString('base64'),
      metadata: { contentType: 'application/octet-stream' },
      base64: true,
    }));

    await this.request<{ success: boolean }>('/pages/assets/upload', sessionJwt, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async createPagesDirectUploadDeployment(
    accountId: string,
    projectName: string,
    manifest: Readonly<Record<string, string>>,
    files: Map<string, Buffer>,
    environment: 'production' | 'preview',
    apiToken: string,
  ): Promise<CloudflarePagesDeploymentResponse> {
    const fileCount = Object.keys(manifest).length;
    const MAX_FILES = 20_000;
    const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MiB

    if (fileCount > MAX_FILES) {
      throw new Error(
        `Cloudflare Pages Direct Upload limit exceeded: maximum ${MAX_FILES} files allowed, received ${fileCount}`,
      );
    }

    for (const [filePath, buffer] of files.entries()) {
      if (buffer.length > MAX_FILE_SIZE_BYTES) {
        throw new Error(
          `Cloudflare Pages asset exceeds 25 MiB file size limit: ${filePath} (${buffer.length} bytes)`,
        );
      }
    }

    // Stage 1: Acquire Direct Upload session (JWT token)
    const session = await this.createPagesDirectUploadSession(accountId, projectName, apiToken);

    // Stage 2: Deduplicate and check missing asset hashes
    const allHashes = Array.from(new Set(Object.values(manifest)));
    const missingHashes = await this.checkMissingPagesAssets(allHashes, session.jwt);

    // Stage 3: Upload only missing assets
    if (missingHashes.length > 0) {
      const missingSet = new Set(missingHashes);
      const missingFilesToUpload: Array<{ hash: string; content: Buffer }> = [];

      for (const [filePath, buffer] of files.entries()) {
        const cleanPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
        const hash = manifest[cleanPath] ?? manifest[filePath];
        if (hash && missingSet.has(hash)) {
          missingFilesToUpload.push({ hash, content: buffer });
          missingSet.delete(hash); // only upload unique hash once
        }
      }

      if (missingFilesToUpload.length > 0) {
        await this.uploadPagesMissingAssets(missingFilesToUpload, session.jwt);
      }
    }

    // Stage 4: Finalize deployment with manifest and target environment
    const formData = new FormData();
    formData.append('manifest', JSON.stringify(manifest));
    formData.append('environment', environment);

    const res = await this.request<{
      success: boolean;
      result: CloudflarePagesDeploymentResponse;
    }>(`/accounts/${accountId}/pages/projects/${projectName}/deployments`, apiToken, {
      method: 'POST',
      body: formData,
    });

    return res.result;
  }

  async getPagesDeployment(
    accountId: string,
    projectName: string,
    deploymentId: string,
    apiToken: string,
  ): Promise<CloudflarePagesDeploymentResponse> {
    const res = await this.request<{
      success: boolean;
      result: CloudflarePagesDeploymentResponse;
    }>(`/accounts/${accountId}/pages/projects/${projectName}/deployments/${deploymentId}`, apiToken, {
      method: 'GET',
    });

    return res.result;
  }

  async rollbackPagesDeployment(
    accountId: string,
    projectName: string,
    deploymentId: string,
    apiToken: string,
  ): Promise<CloudflarePagesDeploymentResponse> {
    const res = await this.request<{
      success: boolean;
      result: CloudflarePagesDeploymentResponse;
    }>(
      `/accounts/${accountId}/pages/projects/${projectName}/deployments/${deploymentId}/rollback`,
      apiToken,
      {
        method: 'POST',
      },
    );

    return res.result;
  }

  // ==========================================
  // Observability & Analytics
  // ==========================================

  async queryWorkersAnalytics(
    accountId: string,
    scriptName: string,
    timeRangeHours: number,
    apiToken: string,
  ): Promise<CloudflareWorkerAnalyticsSummary> {
    const query = `
      query GetWorkerAnalytics($accountTag: String!, $scriptName: String!, $datetimeStart: String!) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            workersInvocationsAdaptive(
              limit: 1000
              filter: { scriptName: $scriptName, datetime_geq: $datetimeStart }
            ) {
              sum {
                requests
                errors
                subrequests
              }
              quantiles {
                cpuTimeP50
                cpuTimeP99
              }
            }
          }
        }
      }
    `;

    const datetimeStart = new Date(Date.now() - timeRangeHours * 3600 * 1000).toISOString();

    const res = await this.request<{
      data?: {
        viewer?: {
          accounts?: Array<{
            workersInvocationsAdaptive?: Array<{
              sum?: { requests: number; errors: number; subrequests: number };
              quantiles?: { cpuTimeP50: number; cpuTimeP99: number };
            }>;
          }>;
        };
      };
    }>('/graphql', apiToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { accountTag: accountId, scriptName, datetimeStart },
      }),
    });

    const adaptive = res.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive?.[0];
    return {
      requests: adaptive?.sum?.requests ?? 0,
      errors: adaptive?.sum?.errors ?? 0,
      subrequests: adaptive?.sum?.subrequests ?? 0,
      cpuTimeP50Microseconds: adaptive?.quantiles?.cpuTimeP50 ?? 0,
      cpuTimeP99Microseconds: adaptive?.quantiles?.cpuTimeP99 ?? 0,
    };
  }
}
