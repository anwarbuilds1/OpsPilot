import { TargetProvider } from '../enums/target-provider.enum.js';
import { PreparedArtifact } from './prepared-artifact.model.js';

/**
 * Value object representing target-specific prepared manifests ready for deployment execution.
 */
export interface PreparedDeployment {
  readonly deploymentId: string;
  readonly targetProvider: TargetProvider;
  readonly targetArtifactId: string;
  readonly artifact: PreparedArtifact;
  readonly providerMetadata: Readonly<Record<string, unknown>>;
}
