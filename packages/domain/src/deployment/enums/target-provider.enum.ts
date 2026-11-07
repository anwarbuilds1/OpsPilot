/**
 * Target infrastructure providers supported by OpsPilot.
 */
export const TargetProviders = {
  AWS_ECS: 'aws_ecs',
  VPS_DOCKER: 'vps_docker',
  CLOUDFLARE_WORKERS: 'cloudflare_workers',
  CLOUDFLARE_PAGES: 'cloudflare_pages',
} as const;

export type TargetProvider = (typeof TargetProviders)[keyof typeof TargetProviders];

export function isTargetProvider(value: unknown): value is TargetProvider {
  return typeof value === 'string' && Object.values(TargetProviders).includes(value as TargetProvider);
}
