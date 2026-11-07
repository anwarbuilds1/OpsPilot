import { ArtifactType } from '../enums/artifact-type.enum.js';

/**
 * Value object representing an immutable build artifact ready for deployment.
 */
export interface PreparedArtifact {
  readonly artifactType: ArtifactType;
  readonly artifactReference: string;
  readonly digest: string;
  readonly sizeBytes?: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}
