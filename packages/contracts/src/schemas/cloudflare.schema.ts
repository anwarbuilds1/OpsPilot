import { z } from 'zod';
import { DeploymentStatusSchema } from './deployment.schema.js';

export const CloudflareProbedCapabilitiesSchema = z.object({
  workers: z.boolean(),
  pages: z.boolean(),
  tail: z.boolean(),
  customDomains: z.boolean(),
  d1: z.boolean(),
  kv: z.boolean(),
  r2: z.boolean(),
});

export type CloudflareProbedCapabilitiesDto = z.infer<typeof CloudflareProbedCapabilitiesSchema>;

export const ConnectCloudflareAccountRequestSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1, 'Account label is required'),
  apiToken: z.string().min(1, 'API Token is required'),
  accountId: z.string().min(1).optional(),
});

export type ConnectCloudflareAccountRequestDto = z.infer<typeof ConnectCloudflareAccountRequestSchema>;

export const ConnectCloudflareAccountResponseSchema = z.object({
  integrationId: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  accountId: z.string(),
  accountName: z.string(),
  status: z.enum(['active', 'revoked', 'invalid']),
  capabilities: CloudflareProbedCapabilitiesSchema,
  connectedAt: z.string().datetime(),
});

export type ConnectCloudflareAccountResponseDto = z.infer<typeof ConnectCloudflareAccountResponseSchema>;

// ==========================================
// Service Creation Wizards
// ==========================================

export const CloudflareWorkerServiceWizardSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  slug: z.string().min(1, 'Service slug is required'),
  repositoryName: z.string().min(1, 'Repository name is required'),
  branch: z.string().min(1).default('main'),
  integrationId: z.string().uuid('Cloudflare account integration is required'),
  scriptName: z.string().min(1, 'Cloudflare Worker script name is required'),
  mainEntrypoint: z.string().min(1).default('src/index.ts'),
  compatibilityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').default('2026-11-01'),
  compatibilityFlags: z.array(z.string()).default([]),
  routes: z.array(z.string()).optional(),
  customDomains: z.array(z.string()).optional(),
  environmentVariables: z.record(z.string(), z.string()).default({}),
  secrets: z.record(z.string(), z.string()).default({}),
  kvBindings: z.record(z.string(), z.string()).optional(),
  d1Bindings: z.record(z.string(), z.string()).optional(),
  r2Bindings: z.record(z.string(), z.string()).optional(),
});

export type CloudflareWorkerServiceWizardDto = z.infer<typeof CloudflareWorkerServiceWizardSchema>;

export const CloudflarePagesServiceWizardSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  slug: z.string().min(1, 'Service slug is required'),
  repositoryName: z.string().min(1, 'Repository name is required'),
  branch: z.string().min(1).default('main'),
  integrationId: z.string().uuid('Cloudflare account integration is required'),
  projectName: z.string().min(1, 'Cloudflare Pages project name is required'),
  buildCommand: z.string().min(1, 'Build command is required'),
  outputDirectory: z.string().min(1, 'Output directory is required'),
  rootDirectory: z.string().optional(),
  customDomains: z.array(z.string()).optional(),
  environmentVariables: z.record(z.string(), z.string()).default({}),
  secrets: z.record(z.string(), z.string()).default({}),
});

export type CloudflarePagesServiceWizardDto = z.infer<typeof CloudflarePagesServiceWizardSchema>;

// ==========================================
// Deployment Status & Instant Rollback
// ==========================================

export const CloudflareInstantRollbackRequestSchema = z.object({
  deploymentId: z.string().uuid(),
  targetVersionId: z.string().min(1, 'Target version identifier is required'),
  reason: z.string().optional(),
});

export type CloudflareInstantRollbackRequestDto = z.infer<typeof CloudflareInstantRollbackRequestSchema>;

export const CloudflareDeploymentStatusViewSchema = z.object({
  deploymentId: z.string().uuid(),
  serviceId: z.string().uuid(),
  provider: z.enum(['cloudflare_workers', 'cloudflare_pages']),
  status: DeploymentStatusSchema,
  deployedUrl: z.string().url().optional(),
  versionIdentifier: z.string().optional(),
  activeTrafficPercentage: z.number().min(0).max(100).optional(),
  canInstantRollback: z.boolean(),
  previousVersions: z.array(
    z.object({
      versionId: z.string(),
      versionNumber: z.number().optional(),
      deployedAt: z.string().datetime(),
    }),
  ),
  events: z.array(
    z.object({
      timestamp: z.string().datetime(),
      stage: z.string(),
      message: z.string(),
      level: z.enum(['INFO', 'WARN', 'ERROR']),
    }),
  ),
  healthStatus: z.object({
    isHealthy: z.boolean(),
    httpStatusCode: z.number().optional(),
    latencyMs: z.number().optional(),
    cfRayId: z.string().optional(),
  }),
});

export type CloudflareDeploymentStatusViewDto = z.infer<typeof CloudflareDeploymentStatusViewSchema>;

// ==========================================
// Telemetry & Live Tail View Models
// ==========================================

export const CloudflareTelemetryMetricsSchema = z.object({
  scriptName: z.string(),
  timeRangeHours: z.number().positive(),
  requests: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  subrequests: z.number().int().nonnegative(),
  cpuTimeP50Microseconds: z.number().nonnegative(),
  cpuTimeP99Microseconds: z.number().nonnegative(),
  errorRate: z.number().min(0).max(1),
  incidentDetected: z.boolean(),
  incidentReason: z.string().optional(),
});

export type CloudflareTelemetryMetricsDto = z.infer<typeof CloudflareTelemetryMetricsSchema>;

export const CloudflareLiveTailLogMessageSchema = z.object({
  timestamp: z.string().datetime(),
  scriptName: z.string(),
  outcome: z.enum(['ok', 'exception', 'exceededCpu', 'unknown']),
  event: z.object({
    request: z.object({
      url: z.string(),
      method: z.string(),
      headers: z.record(z.string(), z.string()),
    }),
    response: z
      .object({
        status: z.number(),
      })
      .optional(),
  }),
  logs: z.array(
    z.object({
      timestamp: z.string().datetime(),
      level: z.string(),
      message: z.string(),
    }),
  ),
  exceptions: z.array(
    z.object({
      name: z.string(),
      message: z.string(),
      timestamp: z.string().datetime(),
    }),
  ),
});

export type CloudflareLiveTailLogMessageDto = z.infer<typeof CloudflareLiveTailLogMessageSchema>;
