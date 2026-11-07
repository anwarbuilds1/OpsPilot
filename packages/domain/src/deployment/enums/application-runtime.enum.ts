/**
 * Application runtime execution paradigms.
 */
export const ApplicationRuntimes = {
  CONTAINER: 'container',
  V8_ISOLATE: 'v8_isolate',
  STATIC_CDN: 'static_cdn',
} as const;

export type ApplicationRuntime = (typeof ApplicationRuntimes)[keyof typeof ApplicationRuntimes];

export function isApplicationRuntime(value: unknown): value is ApplicationRuntime {
  return typeof value === 'string' && Object.values(ApplicationRuntimes).includes(value as ApplicationRuntime);
}
