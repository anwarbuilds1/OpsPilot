import { z } from 'zod';

export const TargetProviderSchema = z.enum([
  'aws_ecs',
  'vps_docker',
  'cloudflare_workers',
  'cloudflare_pages',
]);

export const BuildStrategySchema = z.enum([
  'dockerfile',
  'cloudflare_worker_bundle',
  'static_export',
]);

export const ArtifactTypeSchema = z.enum([
  'oci_image',
  'worker_bundle',
  'pages_manifest',
]);

export const ApplicationRuntimeSchema = z.enum([
  'container',
  'v8_isolate',
  'static_cdn',
]);

export const DeploymentStatusSchema = z.enum([
  'Queued',
  'Preparing',
  'Building',
  'Publishing',
  'Deploying',
  'HealthChecking',
  'Succeeded',
  'Failed',
  'RollingBack',
  'RolledBack',
  'Cancelled',
]);

export const DeploymentEnvironmentSchema = z.enum([
  'production',
  'staging',
  'preview',
]);

const BaseDeploymentFields = {
  deploymentId: z.string().uuid(),
  organizationId: z.string().uuid(),
  projectId: z.string().uuid(),
  serviceId: z.string().uuid(),
  deploymentTargetId: z.string().uuid(),
  environment: DeploymentEnvironmentSchema,
  commitSha: z.string().regex(/^[0-9a-f]{40}$/i, 'Must be a 40-character commit SHA'),
  commitMessage: z.string().optional(),
  commitAuthor: z.string().optional(),
  branch: z.string().min(1),
  healthcheckPath: z.string().startsWith('/'),
};

export const AwsEcsConfigSchema = z.object({
  ...BaseDeploymentFields,
  targetProvider: z.literal('aws_ecs'),
  buildStrategy: z.literal('dockerfile'),
  artifactType: z.literal('oci_image'),
  applicationRuntime: z.literal('container'),
  imageUri: z.string().min(1),
  dockerfilePath: z.string().min(1).default('Dockerfile'),
  buildContext: z.string().min(1).default('.'),
  containerPort: z.number().int().positive(),
  cpuUnits: z.number().int().positive(),
  memoryMb: z.number().int().positive(),
  clusterArn: z.string().startsWith('arn:aws:ecs:'),
  taskFamily: z.string().min(1),
  albTargetGroupArn: z.string().startsWith('arn:aws:elasticloadbalancing:').optional(),
  environmentVariables: z.record(z.string(), z.string()).default({}),
  secrets: z.record(z.string(), z.string()).default({}),
});

export const VpsDockerConfigSchema = z.object({
  ...BaseDeploymentFields,
  targetProvider: z.literal('vps_docker'),
  buildStrategy: z.literal('dockerfile'),
  artifactType: z.literal('oci_image'),
  applicationRuntime: z.literal('container'),
  imageUri: z.string().min(1),
  dockerfilePath: z.string().min(1).default('Dockerfile'),
  buildContext: z.string().min(1).default('.'),
  containerPort: z.number().int().positive(),
  cpuUnits: z.number().int().positive(),
  memoryMb: z.number().int().positive(),
  hostIp: z.string().regex(
    /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
    'Must be a valid IPv4 or IPv6 address'
  ),
  sshPort: z.number().int().positive().default(22),
  composeFilePath: z.string().min(1).default('docker-compose.yml'),
  environmentVariables: z.record(z.string(), z.string()).default({}),
  secrets: z.record(z.string(), z.string()).default({}),
});

export const CloudflareWorkersConfigSchema = z.object({
  ...BaseDeploymentFields,
  targetProvider: z.literal('cloudflare_workers'),
  buildStrategy: z.literal('cloudflare_worker_bundle'),
  artifactType: z.literal('worker_bundle'),
  applicationRuntime: z.literal('v8_isolate'),
  scriptName: z.string().min(1),
  mainEntrypoint: z.string().min(1).default('src/index.ts'),
  compatibilityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  compatibilityFlags: z.array(z.string()).default([]),
  routes: z.array(z.string()).optional(),
  customDomains: z.array(z.string()).optional(),
  environmentVariables: z.record(z.string(), z.string()).default({}),
  secrets: z.record(z.string(), z.string()).default({}),
  kvBindings: z.record(z.string(), z.string()).optional(),
  d1Bindings: z.record(z.string(), z.string()).optional(),
  r2Bindings: z.record(z.string(), z.string()).optional(),
});

export const CloudflarePagesConfigSchema = z.object({
  ...BaseDeploymentFields,
  targetProvider: z.literal('cloudflare_pages'),
  buildStrategy: z.literal('static_export'),
  artifactType: z.literal('pages_manifest'),
  applicationRuntime: z.literal('static_cdn'),
  projectName: z.string().min(1),
  buildCommand: z.string().min(1),
  outputDirectory: z.string().min(1),
  rootDirectory: z.string().optional(),
  customDomains: z.array(z.string()).optional(),
  environmentVariables: z.record(z.string(), z.string()).default({}),
  secrets: z.record(z.string(), z.string()).default({}),
});

export const DeploymentConfigSchema = z.discriminatedUnion('targetProvider', [
  AwsEcsConfigSchema,
  VpsDockerConfigSchema,
  CloudflareWorkersConfigSchema,
  CloudflarePagesConfigSchema,
]);

export type DeploymentConfigDto = z.infer<typeof DeploymentConfigSchema>;

export const DeploymentCapabilitiesSchema = z.object({
  targetProvider: TargetProviderSchema,
  applicationRuntime: ApplicationRuntimeSchema,
  supportsContainers: z.boolean(),
  supportsStaticAssets: z.boolean(),
  supportsEdgeFunctions: z.boolean(),
  requiresPortBinding: z.boolean(),
  requiresResourceLimits: z.boolean(),
  supportsTrafficWeighting: z.boolean(),
  supportsDirectUpload: z.boolean(),
  supportsInstantRollback: z.boolean(),
  supportedBuildStrategies: z.array(BuildStrategySchema),
  supportedArtifactTypes: z.array(ArtifactTypeSchema),
});

export type DeploymentCapabilitiesDto = z.infer<typeof DeploymentCapabilitiesSchema>;
