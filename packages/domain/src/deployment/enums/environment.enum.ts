/**
 * Deployment target environments.
 */
export const DeploymentEnvironments = {
  PRODUCTION: 'production',
  STAGING: 'staging',
  PREVIEW: 'preview',
} as const;

export type DeploymentEnvironment = (typeof DeploymentEnvironments)[keyof typeof DeploymentEnvironments];

export function isDeploymentEnvironment(value: unknown): value is DeploymentEnvironment {
  return typeof value === 'string' && Object.values(DeploymentEnvironments).includes(value as DeploymentEnvironment);
}
