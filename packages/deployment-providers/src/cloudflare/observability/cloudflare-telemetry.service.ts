import { SecretRedactor } from '@opspilot/security';
import {
  CloudflareWorkerAnalyticsSummary,
  ICloudflareApiClient,
} from '../../collaborators/cloudflare-api-client.interface.js';
import { ILogger } from '../../interfaces/logger.interface.js';

export interface EdgeSyntheticProbeResult {
  readonly url: string;
  readonly isHealthy: boolean;
  readonly httpStatusCode: number;
  readonly latencyMs: number;
  readonly cfRayId?: string;
  readonly cfWorker?: string;
  readonly cfCacheStatus?: string;
  readonly cloudflareErrorCode?: number;
  readonly cloudflareErrorMessage?: string;
  readonly rawHeaders: Record<string, string>;
  readonly timestamp: Date;
}

export interface LiveTailWindowSession {
  readonly sessionId: string;
  readonly websocketUrl: string;
  readonly expiresAt: Date;
  readonly scriptName: string;
}

export interface NormalizedTelemetryEvent {
  readonly traceId: string;
  readonly spanId: string;
  readonly timestamp: Date;
  readonly serviceName: string;
  readonly provider: 'cloudflare_workers' | 'cloudflare_pages';
  readonly severity: 'INFO' | 'WARN' | 'ERROR';
  readonly message: string;
  readonly attributes: Record<string, unknown>;
}

export interface ICloudflareTelemetryService {
  probeEdgeHealth(url: string, fetchFn?: typeof fetch): Promise<EdgeSyntheticProbeResult>;
  startDeploymentTailWindow(
    accountId: string,
    scriptName: string,
    apiToken: string,
  ): Promise<LiveTailWindowSession>;
  getIncidentTelemetry(
    accountId: string,
    scriptName: string,
    timeRangeHours: number,
    apiToken: string,
  ): Promise<{
    analytics: CloudflareWorkerAnalyticsSummary;
    errorRate: number;
    incidentDetected: boolean;
    incidentReason?: string;
  }>;
  normalizeProbeEvent(probe: EdgeSyntheticProbeResult, serviceName: string): NormalizedTelemetryEvent;
}

export class CloudflareTelemetryService implements ICloudflareTelemetryService {
  constructor(
    private readonly apiClient: ICloudflareApiClient,
    private readonly logger?: ILogger,
  ) {}

  /**
   * Performs an edge synthetic probe and extracts Cloudflare diagnostic headers.
   * Detects edge-level failures including 1101 (Worker Exception) and 1027 (CPU Timeout).
   */
  async probeEdgeHealth(url: string, fetchFn: typeof fetch = globalThis.fetch): Promise<EdgeSyntheticProbeResult> {
    const startTime = Date.now();
    const timestamp = new Date();

    try {
      const response = await fetchFn(url, {
        method: 'GET',
        headers: { 'User-Agent': 'OpsPilot-HealthProbe/1.0' },
      });

      const latencyMs = Date.now() - startTime;
      const headersRecord: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headersRecord[key.toLowerCase()] = value;
      });

      const cfRayId = headersRecord['cf-ray'];
      const cfWorker = headersRecord['cf-worker'];
      const cfCacheStatus = headersRecord['cf-cache-status'];

      let errorCode: number | undefined;
      let errorMessage: string | undefined;

      // Cloudflare edge failure error detection
      const cfErrorCodeHeader = headersRecord['cf-error-code'] ?? headersRecord['x-cf-error-code'];
      if (cfErrorCodeHeader) {
        errorCode = Number(cfErrorCodeHeader);
      }

      if (response.status === 500 && !errorCode) {
        // Inspect body snippet for known error codes if available
        try {
          const bodyText = await response.text();
          if (bodyText.includes('1101')) {
            errorCode = 1101;
            errorMessage = 'Error 1101: Worker threw unhandled JavaScript exception';
          } else if (bodyText.includes('1027')) {
            errorCode = 1027;
            errorMessage = 'Error 1027: Worker CPU runtime limit exceeded';
          }
        } catch {
          // ignore
        }
      }

      const isHealthy = response.status >= 200 && response.status < 400 && !errorCode;

      return {
        url,
        isHealthy,
        httpStatusCode: response.status,
        latencyMs,
        cfRayId,
        cfWorker,
        cfCacheStatus,
        cloudflareErrorCode: errorCode,
        cloudflareErrorMessage: errorMessage,
        rawHeaders: headersRecord,
        timestamp,
      };
    } catch (err: any) {
      return {
        url,
        isHealthy: false,
        httpStatusCode: 0,
        latencyMs: Date.now() - startTime,
        cloudflareErrorMessage: SecretRedactor.redactText(err.message),
        rawHeaders: {},
        timestamp,
      };
    }
  }

  /**
   * Bounded Live Tail diagnostic session for deployment startup verification.
   * NOT intended for durable historical log storage.
   */
  async startDeploymentTailWindow(
    accountId: string,
    scriptName: string,
    apiToken: string,
  ): Promise<LiveTailWindowSession> {
    this.logger?.info(
      `Starting bounded Live Tail diagnostic session for Worker '${scriptName}' (Deployment Verification Window)`,
    );

    const session = await this.apiClient.createTailSession(accountId, scriptName, apiToken);
    return {
      sessionId: session.id,
      websocketUrl: session.url,
      expiresAt: session.expiresAt,
      scriptName,
    };
  }

  /**
   * Queries Cloudflare GraphQL analytics to retrieve invocation telemetry and evaluate incident indicators.
   */
  async getIncidentTelemetry(
    accountId: string,
    scriptName: string,
    timeRangeHours: number,
    apiToken: string,
  ): Promise<{
    analytics: CloudflareWorkerAnalyticsSummary;
    errorRate: number;
    incidentDetected: boolean;
    incidentReason?: string;
  }> {
    const analytics = await this.apiClient.queryWorkersAnalytics(
      accountId,
      scriptName,
      timeRangeHours,
      apiToken,
    );

    const totalRequests = analytics.requests;
    const errorCount = analytics.errors;
    const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

    let incidentDetected = false;
    let incidentReason: string | undefined;

    if (errorRate > 0.05) {
      incidentDetected = true;
      incidentReason = `High edge error rate detected: ${(errorRate * 100).toFixed(2)}% (${errorCount} errors / ${totalRequests} requests)`;
    } else if (analytics.cpuTimeP99Microseconds > 45_000) {
      incidentDetected = true;
      incidentReason = `Elevated P99 CPU time: ${(analytics.cpuTimeP99Microseconds / 1000).toFixed(1)}ms exceeds 45ms SLA`;
    }

    return {
      analytics,
      errorRate,
      incidentDetected,
      incidentReason,
    };
  }

  /**
   * Normalizes a synthetic edge probe result into an OpenTelemetry log/event record.
   */
  normalizeProbeEvent(probe: EdgeSyntheticProbeResult, serviceName: string): NormalizedTelemetryEvent {
    const traceId = probe.cfRayId ? probe.cfRayId.replace(/-.*/, '').padStart(32, '0') : '0'.repeat(32);
    const spanId = (probe.cfRayId ?? '0000000000000000').slice(0, 16).padStart(16, '0');

    return {
      traceId,
      spanId,
      timestamp: probe.timestamp,
      serviceName,
      provider: 'cloudflare_workers',
      severity: probe.isHealthy ? 'INFO' : 'ERROR',
      message: probe.isHealthy
        ? `Edge probe succeeded with HTTP ${probe.httpStatusCode} (${probe.latencyMs}ms)`
        : `Edge probe failed with HTTP ${probe.httpStatusCode}: ${probe.cloudflareErrorMessage ?? 'Unhealthy endpoint'}`,
      attributes: {
        'http.status_code': probe.httpStatusCode,
        'http.url': probe.url,
        'http.response_time_ms': probe.latencyMs,
        'cloud.provider': 'cloudflare',
        'cloudflare.ray_id': probe.cfRayId,
        'cloudflare.worker': probe.cfWorker,
        'cloudflare.cache_status': probe.cfCacheStatus,
        'cloudflare.error_code': probe.cloudflareErrorCode,
      },
    };
  }
}
