/**
 * Build strategies representing how source code is compiled into deployable artifacts.
 */
export const BuildStrategies = {
  DOCKERFILE: 'dockerfile',
  CLOUDFLARE_WORKER_BUNDLE: 'cloudflare_worker_bundle',
  STATIC_EXPORT: 'static_export',
} as const;

export type BuildStrategy = (typeof BuildStrategies)[keyof typeof BuildStrategies];

export function isBuildStrategy(value: unknown): value is BuildStrategy {
  return typeof value === 'string' && Object.values(BuildStrategies).includes(value as BuildStrategy);
}
