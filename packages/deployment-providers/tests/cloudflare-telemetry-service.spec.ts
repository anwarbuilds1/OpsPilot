import { describe, expect, it, vi } from 'vitest';
import { CloudflareTelemetryService } from '../src/cloudflare/observability/cloudflare-telemetry.service.js';
import { ICloudflareApiClient } from '../src/collaborators/cloudflare-api-client.interface.js';

describe('CloudflareTelemetryService', () => {
  const dummyToken = 'cf_token_0123456789abcdef0123456789abcdef';
  const dummyAccountId = 'cf_acc_1122334455667788';

  const mockApiClient: ICloudflareApiClient = {
    verifyToken: vi.fn(),
    listAccounts: vi.fn(),
    probeCapabilities: vi.fn(),
    uploadScriptVersion: vi.fn(),
    deployScriptVersion: vi.fn(),
    getScriptDeployments: vi.fn(),
    getScriptVersions: vi.fn(),
    syncScriptSecrets: vi.fn(),
    createTailSession: vi.fn().mockResolvedValue({
      id: 'tail-sess-100',
      url: 'wss://tail.cloudflare.com/session-100',
      expiresAt: new Date(Date.now() + 1800_000),
    }),
    getOrCreatePagesProject: vi.fn(),
    createPagesDirectUploadDeployment: vi.fn(),
    getPagesDeployment: vi.fn(),
    rollbackPagesDeployment: vi.fn(),
    queryWorkersAnalytics: vi.fn().mockResolvedValue({
      requests: 10_000,
      errors: 650, // 6.5% error rate
      subrequests: 15_000,
      cpuTimeP50Microseconds: 8_000,
      cpuTimeP99Microseconds: 52_000, // 52ms > 45ms SLA
    }),
  };

  it('probes edge endpoint and extracts diagnostic headers (CF-Ray, CF-Worker)', async () => {
    const mockHeaders = new Map([
      ['cf-ray', '8e1234567890abcd-IAD'],
      ['cf-worker', 'checkout-api'],
      ['cf-cache-status', 'DYNAMIC'],
      ['content-type', 'application/json'],
    ]);

    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: {
        forEach: (cb: any) => mockHeaders.forEach((v, k) => cb(v, k)),
      },
      text: async () => JSON.stringify({ status: 'ok' }),
    });

    const telemetry = new CloudflareTelemetryService(mockApiClient);
    const probe = await telemetry.probeEdgeHealth('https://checkout-api.workers.dev/health', mockFetch as any);

    expect(probe.isHealthy).toBe(true);
    expect(probe.httpStatusCode).toBe(200);
    expect(probe.cfRayId).toBe('8e1234567890abcd-IAD');
    expect(probe.cfWorker).toBe('checkout-api');
    expect(probe.cfCacheStatus).toBe('DYNAMIC');
  });

  it('detects Cloudflare Error 1101 (Worker Exception) and marks probe unhealthy', async () => {
    const mockHeaders = new Map([
      ['cf-ray', '8e9999999999aaaa-ORD'],
      ['cf-error-code', '1101'],
      ['content-type', 'text/html'],
    ]);

    const mockFetch = vi.fn().mockResolvedValue({
      status: 500,
      headers: {
        forEach: (cb: any) => mockHeaders.forEach((v, k) => cb(v, k)),
      },
      text: async () => 'Error 1101: Worker threw unhandled JavaScript exception',
    });

    const telemetry = new CloudflareTelemetryService(mockApiClient);
    const probe = await telemetry.probeEdgeHealth('https://crashing-worker.workers.dev', mockFetch as any);

    expect(probe.isHealthy).toBe(false);
    expect(probe.httpStatusCode).toBe(500);
    expect(probe.cloudflareErrorCode).toBe(1101);
  });

  it('starts bounded Live Tail window session for deployment verification', async () => {
    const telemetry = new CloudflareTelemetryService(mockApiClient);
    const session = await telemetry.startDeploymentTailWindow(
      dummyAccountId,
      'checkout-api',
      dummyToken,
    );

    expect(session.sessionId).toBe('tail-sess-100');
    expect(session.websocketUrl).toContain('wss://tail.cloudflare.com');
    expect(session.scriptName).toBe('checkout-api');
  });

  it('evaluates GraphQL analytics and detects incident threshold violations', async () => {
    const telemetry = new CloudflareTelemetryService(mockApiClient);
    const telemetrySummary = await telemetry.getIncidentTelemetry(
      dummyAccountId,
      'checkout-api',
      1,
      dummyToken,
    );

    expect(telemetrySummary.analytics.requests).toBe(10_000);
    expect(telemetrySummary.errorRate).toBe(0.065); // 6.5%
    expect(telemetrySummary.incidentDetected).toBe(true);
    expect(telemetrySummary.incidentReason).toContain('High edge error rate detected');
  });

  it('normalizes synthetic probe to OpenTelemetry attributes', () => {
    const telemetry = new CloudflareTelemetryService(mockApiClient);
    const mockProbe = {
      url: 'https://checkout-api.workers.dev/health',
      isHealthy: true,
      httpStatusCode: 200,
      latencyMs: 38,
      cfRayId: '8e1234567890abcd-IAD',
      cfWorker: 'checkout-api',
      cfCacheStatus: 'HIT',
      rawHeaders: {},
      timestamp: new Date(),
    };

    const otelEvent = telemetry.normalizeProbeEvent(mockProbe, 'checkout-service');

    expect(otelEvent.serviceName).toBe('checkout-service');
    expect(otelEvent.severity).toBe('INFO');
    expect(otelEvent.attributes['cloud.provider']).toBe('cloudflare');
    expect(otelEvent.attributes['cloudflare.ray_id']).toBe('8e1234567890abcd-IAD');
    expect(otelEvent.attributes['http.status_code']).toBe(200);
  });
});
