# Deployment Provider Contracts Specification

> **Document Type:** Engineering Specification  
> **Package:** `@opspilot/deployment-providers`  
> **Status:** Implemented & Verified (November 2026)

This document specifies the universal `IDeploymentProvider` contract and the concrete behavioral specifications for all supported deployment providers in OpsPilot:
1. `AwsEcsProvider` (`aws_ecs`)
2. `VpsDockerProvider` (`vps_docker`)
3. `CloudflareWorkersProvider` (`cloudflare_workers`)
4. `CloudflarePagesProvider` (`cloudflare_pages`)

---

## 1. Provider Capabilities Matrix

Each deployment provider advertises its supported capabilities deterministically through its `capabilities: DeploymentCapabilities` property. Application layers and deployment workers query this matrix rather than assuming uniform functionality:

| Feature / Capability | `aws_ecs` | `vps_docker` | `cloudflare_workers` | `cloudflare_pages` |
|---|---|---|---|---|
| **Target Provider Enum** | `aws_ecs` | `vps_docker` | `cloudflare_workers` | `cloudflare_pages` |
| **Application Runtime** | `container` | `container` | `v8_isolate` | `static_cdn` |
| **Supported Build Strategies** | `dockerfile` | `dockerfile` | `cloudflare_worker_bundle` | `static_export` |
| **Supported Artifact Types** | `oci_image` | `oci_image` | `worker_bundle` | `pages_manifest` |
| **Supports Containers** | Yes | Yes | No | No |
| **Supports Static Assets** | No | No | No | Yes |
| **Supports Edge Functions** | No | No | Yes | Yes (Pages Functions) |
| **Requires Port Binding** | Yes | Yes | No | No |
| **Requires Resource Limits (CPU/RAM)** | Yes | Yes | No | No |
| **Supports Traffic Weighting** | No | No | Yes (0 - 100%) | No |
| **Supports Direct Upload** | No | No | Yes | Yes |
| **Supports Instant Rollback** | No (rolling update) | No (compose down/up) | Yes (traffic shift) | Yes (rollback API) |

---

## 2. Universal Provider Interface (`IDeploymentProvider`)

```typescript
export interface IDeploymentProvider {
  readonly providerType: TargetProvider;
  readonly capabilities: DeploymentCapabilities;

  validateConnection(
    credentials: Readonly<Record<string, unknown>>,
    targetConfig?: Readonly<Record<string, unknown>>,
  ): Promise<ConnectionResult>;

  prepareDeployment(config: DeploymentConfig): Promise<PreparedDeployment>;

  deploy(
    deployment: PreparedDeployment,
    credentials: Readonly<Record<string, unknown>>,
  ): Promise<DeploymentResult>;

  getStatus(
    deploymentId: string,
    externalId: string,
    credentials: Readonly<Record<string, unknown>>,
  ): Promise<DeploymentStatusResult>;

  rollback(
    deploymentId: string,
    targetVersionIdentifier: string,
    credentials: Readonly<Record<string, unknown>>,
  ): Promise<RollbackResult>;

  checkHealth(targetUrl: string): Promise<HealthCheckResult>;
}
```

---

## 3. Cloudflare Workers Provider Contract

### 3.1 Overview
- **Class:** `CloudflareWorkersProvider`
- **Location:** `packages/deployment-providers/src/providers/cloudflare-workers.provider.ts`
- **Architecture:** Extends `BaseDeploymentProvider` directly. Injects `ICloudflareApiClient` via composition (ADR-0014).

### 3.2 Method Specifications
- `validateConnection(credentials, targetConfig)`:
  - Verifies token validity via `/user/tokens/verify`.
  - Performs deep permission probing via `/accounts/{id}/workers/scripts` to guarantee `Workers Scripts: Edit` permission.
- `prepareDeployment(config: CloudflareWorkersDeploymentConfig)`:
  - Enforces config discriminator: throws `ProviderIncompatibilityException` if not `cloudflare_workers`.
  - Maps bindings into Cloudflare format:
    - Environment variables $\to$ `plain_text`
    - KV Bindings $\to$ `kv_namespace`
    - D1 Bindings $\to$ `d1`
    - R2 Bindings $\to$ `r2_bucket`
  - Generates immutable target artifact ID (`${scriptName}:${commitSha.slice(0, 8)}`) and computes SHA-256 digest of ESM bundle.
- `deploy(deployment, credentials)`:
  - Synchronizes secrets securely via `/accounts/{id}/workers/scripts/{name}/secrets`.
  - Uploads immutable Worker version via `/accounts/{id}/workers/scripts/{name}/versions` (multipart ESM + metadata).
  - Activates deployment via `/accounts/{id}/workers/scripts/{name}/deployments` with 100% traffic shift.
  - Returns `deployedUrl: https://${scriptName}.${accountPrefix}.workers.dev`.
- `getStatus(deploymentId, externalId, credentials)`:
  - Queries recent deployments from Cloudflare REST API and returns `Succeeded` or `Deploying`.
- `rollback(deploymentId, targetVersionIdentifier, credentials)`:
  - Dispatches immediate 100% traffic allocation to the target version ID via Workers Deployments API.
  - Sub-second instant rollback.
- `checkHealth(targetUrl)`:
  - Performs synthetic HTTP probe and checks for edge errors (1101 exception, 1027 CPU timeout).

---

## 4. Cloudflare Pages Provider Contract

### 4.1 Overview
- **Class:** `CloudflarePagesProvider`
- **Location:** `packages/deployment-providers/src/providers/cloudflare-pages.provider.ts`
- **Architecture:** Extends `BaseDeploymentProvider` directly. Injects `ICloudflareApiClient` via composition (ADR-0014, ADR-0015).

### 4.2 Method Specifications
- `validateConnection(credentials, targetConfig)`:
  - Verifies token validity via `/user/tokens/verify`.
  - Probes `/accounts/{id}/pages/projects` to guarantee `Pages: Edit` permission.
- `prepareDeployment(config: CloudflarePagesDeploymentConfig)`:
  - Enforces config discriminator: throws `ProviderIncompatibilityException` if not `cloudflare_pages`.
  - Enforces Cloudflare limits:
    - Maximum files $\le 20,000$. Throws error if exceeded.
    - Maximum asset size $\le 25\text{ MiB}$ (26,214,400 bytes). Throws error if any individual file exceeds limit.
  - Computes SHA-256 hashes of all assets to build the manifest.
  - Returns `artifactType: 'pages_manifest'`.
- `deploy(deployment, credentials)`:
  - Ensures project exists via `getOrCreatePagesProject`.
  - Dispatches direct upload via `/accounts/{id}/pages/projects/{name}/deployments`.
  - Returns deployed preview or production URL (`https://<short-id>.<project>.pages.dev`).
- `getStatus(deploymentId, externalId, credentials)`:
  - Queries `/accounts/{id}/pages/projects/{name}/deployments/{id}` and maps latest stage status (`success` $\to$ `Succeeded`, `failure` $\to$ `Failed`, active $\to$ `Deploying`).
- `rollback(deploymentId, targetVersionIdentifier, credentials)`:
  - Dispatches rollback request to `/accounts/{id}/pages/projects/{name}/deployments/{id}/rollback`.
- `checkHealth(targetUrl)`:
  - Performs synthetic HTTP probe against deployed URL.
