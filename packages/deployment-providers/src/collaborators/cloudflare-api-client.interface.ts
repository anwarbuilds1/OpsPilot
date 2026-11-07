/**
 * Contract specification for the future Cloudflare API client.
 * (Not implemented in foundational phase pursuant to strict rules).
 */
export interface ICloudflareApiClient {
  verifyToken(apiToken: string): Promise<{ valid: boolean; accountId?: string }>;
  probeCapabilities(
    accountId: string,
    apiToken: string
  ): Promise<{ workers: boolean; pages: boolean; tail: boolean; customDomains: boolean }>;
}
