import { ApplicationRuntime } from '../enums/application-runtime.enum.js';
import { ArtifactType } from '../enums/artifact-type.enum.js';
import { BuildStrategy } from '../enums/build-strategy.enum.js';
import { TargetProvider } from '../enums/target-provider.enum.js';
import { ConfigurationValidationException } from '../errors/configuration-validation.exception.js';

export interface ServiceProps {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  slug: string;
  repositoryName: string;
  branch?: string;
  targetProvider: TargetProvider;
  buildStrategy: BuildStrategy;
  artifactType: ArtifactType;
  applicationRuntime: ApplicationRuntime;
  dockerfilePath?: string;
  buildContext?: string;
  containerPort?: number;
  healthcheckPath?: string;
  cpuUnits?: number;
  memoryMb?: number;
  config?: Record<string, unknown>;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Service {
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly name: string;
  readonly slug: string;
  readonly repositoryName: string;
  readonly branch: string;
  readonly targetProvider: TargetProvider;
  readonly buildStrategy: BuildStrategy;
  readonly artifactType: ArtifactType;
  readonly applicationRuntime: ApplicationRuntime;
  readonly dockerfilePath?: string;
  readonly buildContext: string;
  readonly containerPort?: number;
  readonly healthcheckPath: string;
  readonly cpuUnits?: number;
  readonly memoryMb?: number;
  readonly config: Readonly<Record<string, unknown>>;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: ServiceProps) {
    Service.validateContainerInvariants(props);

    this.id = props.id;
    this.organizationId = props.organizationId;
    this.projectId = props.projectId;
    this.name = props.name;
    this.slug = props.slug;
    this.repositoryName = props.repositoryName;
    this.branch = props.branch ?? 'main';
    this.targetProvider = props.targetProvider;
    this.buildStrategy = props.buildStrategy;
    this.artifactType = props.artifactType;
    this.applicationRuntime = props.applicationRuntime;
    this.dockerfilePath = props.dockerfilePath;
    this.buildContext = props.buildContext ?? '.';
    this.containerPort = props.containerPort;
    this.healthcheckPath = props.healthcheckPath ?? '/health';
    this.cpuUnits = props.cpuUnits;
    this.memoryMb = props.memoryMb;
    this.config = Object.freeze({ ...(props.config ?? {}) });
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  private static validateContainerInvariants(props: ServiceProps): void {
    const isContainer = props.targetProvider === 'aws_ecs' || props.targetProvider === 'vps_docker';
    if (isContainer) {
      if (!props.dockerfilePath) {
        throw new ConfigurationValidationException(
          `Service for provider '${props.targetProvider}' requires 'dockerfilePath'`,
          'dockerfilePath'
        );
      }
      if (props.containerPort === undefined || props.containerPort === null || props.containerPort <= 0) {
        throw new ConfigurationValidationException(
          `Service for provider '${props.targetProvider}' requires positive 'containerPort'`,
          'containerPort'
        );
      }
      if (props.cpuUnits === undefined || props.cpuUnits === null || props.cpuUnits <= 0) {
        throw new ConfigurationValidationException(
          `Service for provider '${props.targetProvider}' requires positive 'cpuUnits'`,
          'cpuUnits'
        );
      }
      if (props.memoryMb === undefined || props.memoryMb === null || props.memoryMb <= 0) {
        throw new ConfigurationValidationException(
          `Service for provider '${props.targetProvider}' requires positive 'memoryMb'`,
          'memoryMb'
        );
      }
    }
  }
}
