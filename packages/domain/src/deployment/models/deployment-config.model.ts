import { ApplicationRuntime } from '../enums/application-runtime.enum.js';
import { ArtifactType } from '../enums/artifact-type.enum.js';
import { BuildStrategy } from '../enums/build-strategy.enum.js';
import { DeploymentEnvironment } from '../enums/environment.enum.js';
import { TargetProvider } from '../enums/target-provider.enum.js';

export interface BaseDeploymentConfig {
  readonly deploymentId: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly serviceId: string;
  readonly deploymentTargetId: string;
  readonly environment: DeploymentEnvironment;
  readonly commitSha: string;
  readonly commitMessage?: string;
  readonly commitAuthor?: string;
  readonly branch: string;
  readonly healthcheckPath: string;
}

export interface AwsEcsDeploymentConfig extends BaseDeploymentConfig {
  readonly targetProvider: 'aws_ecs';
  readonly buildStrategy: 'dockerfile';
  readonly artifactType: 'oci_image';
  readonly applicationRuntime: 'container';
  readonly imageUri: string;
  readonly dockerfilePath: string;
  readonly buildContext: string;
  readonly containerPort: number;
  readonly cpuUnits: number;
  readonly memoryMb: number;
  readonly clusterArn: string;
  readonly taskFamily: string;
  readonly albTargetGroupArn?: string;
  readonly environmentVariables: Readonly<Record<string, string>>;
  readonly secrets: Readonly<Record<string, string>>;
}

export interface VpsDockerDeploymentConfig extends BaseDeploymentConfig {
  readonly targetProvider: 'vps_docker';
  readonly buildStrategy: 'dockerfile';
  readonly artifactType: 'oci_image';
  readonly applicationRuntime: 'container';
  readonly imageUri: string;
  readonly dockerfilePath: string;
  readonly buildContext: string;
  readonly containerPort: number;
  readonly cpuUnits: number;
  readonly memoryMb: number;
  readonly hostIp: string;
  readonly sshPort: number;
  readonly composeFilePath: string;
  readonly environmentVariables: Readonly<Record<string, string>>;
  readonly secrets: Readonly<Record<string, string>>;
}

export interface CloudflareWorkersDeploymentConfig extends BaseDeploymentConfig {
  readonly targetProvider: 'cloudflare_workers';
  readonly buildStrategy: 'cloudflare_worker_bundle';
  readonly artifactType: 'worker_bundle';
  readonly applicationRuntime: 'v8_isolate';
  readonly scriptName: string;
  readonly mainEntrypoint: string;
  readonly compatibilityDate: string;
  readonly compatibilityFlags: readonly string[];
  readonly routes?: readonly string[];
  readonly customDomains?: readonly string[];
  readonly environmentVariables: Readonly<Record<string, string>>;
  readonly secrets: Readonly<Record<string, string>>;
  readonly kvBindings?: Readonly<Record<string, string>>;
  readonly d1Bindings?: Readonly<Record<string, string>>;
  readonly r2Bindings?: Readonly<Record<string, string>>;
}

export interface CloudflarePagesDeploymentConfig extends BaseDeploymentConfig {
  readonly targetProvider: 'cloudflare_pages';
  readonly buildStrategy: 'static_export';
  readonly artifactType: 'pages_manifest';
  readonly applicationRuntime: 'static_cdn';
  readonly projectName: string;
  readonly buildCommand: string;
  readonly outputDirectory: string;
  readonly rootDirectory?: string;
  readonly customDomains?: readonly string[];
  readonly environmentVariables: Readonly<Record<string, string>>;
  readonly secrets: Readonly<Record<string, string>>;
}

export type DeploymentConfig =
  | AwsEcsDeploymentConfig
  | VpsDockerDeploymentConfig
  | CloudflareWorkersDeploymentConfig
  | CloudflarePagesDeploymentConfig;

export function isAwsEcsConfig(config: DeploymentConfig): config is AwsEcsDeploymentConfig {
  return config.targetProvider === 'aws_ecs';
}

export function isVpsDockerConfig(config: DeploymentConfig): config is VpsDockerDeploymentConfig {
  return config.targetProvider === 'vps_docker';
}

export function isCloudflareWorkersConfig(config: DeploymentConfig): config is CloudflareWorkersDeploymentConfig {
  return config.targetProvider === 'cloudflare_workers';
}

export function isCloudflarePagesConfig(config: DeploymentConfig): config is CloudflarePagesDeploymentConfig {
  return config.targetProvider === 'cloudflare_pages';
}
