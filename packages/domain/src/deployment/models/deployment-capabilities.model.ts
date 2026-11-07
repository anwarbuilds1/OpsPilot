import { ApplicationRuntime } from '../enums/application-runtime.enum.js';
import { ArtifactType } from '../enums/artifact-type.enum.js';
import { BuildStrategy } from '../enums/build-strategy.enum.js';
import { TargetProvider } from '../enums/target-provider.enum.js';

/**
 * Declares the runtime, build, and operational capabilities of a deployment provider.
 */
export interface DeploymentCapabilities {
  readonly targetProvider: TargetProvider;
  readonly applicationRuntime: ApplicationRuntime;
  readonly supportsContainers: boolean;
  readonly supportsStaticAssets: boolean;
  readonly supportsEdgeFunctions: boolean;
  readonly requiresPortBinding: boolean;
  readonly requiresResourceLimits: boolean;
  readonly supportsTrafficWeighting: boolean;
  readonly supportsDirectUpload: boolean;
  readonly supportsInstantRollback: boolean;
  readonly supportedBuildStrategies: readonly BuildStrategy[];
  readonly supportedArtifactTypes: readonly ArtifactType[];
}
