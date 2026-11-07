/**
 * Immutable artifact types produced by build pipelines.
 */
export const ArtifactTypes = {
  OCI_IMAGE: 'oci_image',
  WORKER_BUNDLE: 'worker_bundle',
  PAGES_MANIFEST: 'pages_manifest',
} as const;

export type ArtifactType = (typeof ArtifactTypes)[keyof typeof ArtifactTypes];

export function isArtifactType(value: unknown): value is ArtifactType {
  return typeof value === 'string' && Object.values(ArtifactTypes).includes(value as ArtifactType);
}
