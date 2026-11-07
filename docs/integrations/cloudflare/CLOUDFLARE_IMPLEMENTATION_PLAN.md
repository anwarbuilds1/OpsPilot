# OpsPilot — Cloudflare Support Implementation Plan

> **Document Type:** Engineering Implementation Plan & Execution Roadmap  
> **Status:** Proposed Specification  
> **Authors:** Principal Platform Engineer, DevOps Architect, Senior Software Engineer  
> **Date:** November 2026  
> **Target Subsystems:** Full Monorepo Architecture (`packages/*`, `apps/*`, `docker/*`)

---

## 1. Executive Summary & Phased Roadmap

This engineering plan details the 10 sequential, dependency-aware phases required to incorporate **Cloudflare Workers** and **Cloudflare Pages** into OpsPilot.

Each phase specifies objectives, affected files, pre-requisites, concrete deliverables, acceptance criteria, risk mitigations, and automated testing requirements.

```mermaid
gantt
    title Cloudflare Integration Engineering Roadmap
    dateFormat  YYYY-MM-DD
    section Core Foundations
    Phase 1: Provider Abstraction Refactoring       :p1, 2026-12-01, 5d
    Phase 2: Credentials & Secret Management        :p2, after p1, 3d
    Phase 3: Database Schema Migration              :p3, after p1, 4d
    section Execution Infrastructure
    Phase 4: Isolated Build Runner Extension        :p4, after p2 p3, 5d
    Phase 5: Cloudflare Workers Provider            :p5, after p4, 6d
    Phase 6: Cloudflare Pages Provider              :p6, after p4, 5d
    section Pipeline & Observability
    Phase 7: Deployment Worker Pipeline             :p7, after p5 p6, 5d
    Phase 8: Telemetry & Observability              :p8, after p7, 5d
    section Product Integration
    Phase 9: API & Frontend Dashboard               :p9, after p7, 6d
    Phase 10: Testing, Documentation & Beta         :p10, after p8 p9, 5d
```

---

## 2. Granular Phase Specifications

---

### Phase 1: Provider Abstraction Refactoring

- **Objective:** Decouple the common `DeploymentProvider` interface and deployment configurations from container-only assumptions (`imageUri`, `containerPort`, `cpuUnits`, `memoryMb`) without breaking existing AWS ECS and VPS Docker contracts.
- **Affected Modules & Files:**
  - `packages/domain/src/deployment/`
  - `packages/deployment-providers/src/interfaces/deployment-provider.interface.ts`
  - `packages/contracts/src/dto/deployment/`
- **Dependencies (Pre-requisites):** None.
- **Detailed Deliverables:**
  1. Define `DeploymentCapabilities` interface indicating runtime type, port requirement, traffic weighting, and direct upload capabilities.
  2. Implement polymorphic `DeploymentConfig` union type (`ContainerDeploymentConfig | CloudflareWorkersConfig | CloudflarePagesConfig`).
  3. Refactor `IDeploymentProvider` to accept polymorphic payloads and return standardized `DeploymentResult` and `RollbackResult`.
  4. Ensure existing `AwsEcsProvider` and `VpsDockerProvider` types conform to the new interface via `ContainerDeploymentProvider` base class.
- **Acceptance Criteria:**
  - `npm run typecheck` passes across `packages/domain` and `packages/deployment-providers`.
  - Type narrowing works deterministically via discriminator `runtimeType: 'container' | 'edge_worker' | 'static_pages'`.
  - Zero breaking changes to existing ECS and VPS test harnesses.
- **Risks & Mitigations:**
  - *Risk:* Type complexity breaking existing DTO validation.
  - *Mitigation:* Use Zod discriminated unions (`z.discriminatedUnion('runtimeType', [...])`) to enforce runtime validation.
- **Testing Requirements:**
  - Unit tests verifying compile-time and runtime type narrowing for all 3 deployment configurations.

---

### Phase 2: Credentials and Secret Management

- **Objective:** Introduce secure storage, envelope encryption, and validation for Cloudflare API tokens and Account IDs.
- **Affected Modules & Files:**
  - `packages/security/src/encryption/`
  - `packages/security/src/redaction/secret-redactor.ts`
  - `apps/api/src/modules/integrations/`
- **Dependencies (Pre-requisites):** Phase 1.
- **Detailed Deliverables:**
  1. Add Cloudflare credential schema: `{ accountId: string, apiToken: string }`.
  2. Implement Cloudflare API Token verification service (`GET https://api.cloudflare.com/client/v4/user/tokens/verify`).
  3. Extend envelope encryption service (AES-256-GCM / KMS) to encrypt Cloudflare tokens before writing to `integration_credentials`.
  4. Extend `SecretRedactor` pattern dictionary to scrub Cloudflare tokens (prefix `Bearer `, 40-character hex tokens) from execution logs and traces.
- **Acceptance Criteria:**
  - Valid API tokens return `HTTP 200` with active account metadata; invalid tokens return structured `400 Bad Request` domain errors.
  - Plaintext tokens never appear in database tables, application logs, or error responses.
- **Risks & Mitigations:**
  - *Risk:* Over-permissioned tokens supplied by users.
  - *Mitigation:* Perform token permission pre-flight checks and warn users if required scopes are missing.
- **Testing Requirements:**
  - Mocked Cloudflare API tests verifying valid and expired token flows.
  - Security redaction unit tests confirming complete scrubbing of authorization tokens.

---

### Phase 3: Database Schema Migration

- **Objective:** Evolve the PostgreSQL database schema to accommodate Cloudflare targets while preserving backward compatibility and tenant isolation.
- **Affected Modules & Files:**
  - `packages/database/src/schema/`
  - `packages/database/prisma/migrations/` (or Kysely / TypeORM migrations)
- **Dependencies (Pre-requisites):** Phase 1.
- **Detailed Deliverables:**
  1. Add migration adding `'cloudflare'` to `integration_type` ENUM.
  2. Add migration adding `'cloudflare_workers'` and `'cloudflare_pages'` to `target_provider` ENUM.
  3. Add `runtime_type VARCHAR(32) NOT NULL DEFAULT 'container'` to `services`.
  4. Relax NOT NULL constraints on `services.dockerfile_path`, `services.container_port`, `services.cpu_units`, `services.memory_mb` for services where `runtime_type != 'container'`.
  5. Add `config JSONB NOT NULL DEFAULT '{}'` to `services` for provider-specific settings (compatibility date, routes, build commands).
  6. Relax NOT NULL constraint on `deployments.image_uri` and add `artifact_reference TEXT` to store Worker version IDs or Pages deployment IDs.
- **Acceptance Criteria:**
  - Migration runs up and down cleanly against PostgreSQL 16.
  - Existing AWS ECS and VPS Docker rows remain completely intact and valid.
  - Foreign key constraints, tenant scoping (`organization_id`), and check constraints are enforced.
- **Risks & Mitigations:**
  - *Risk:* Data corruption or migration locks on existing production databases.
  - *Mitigation:* All column alterations use non-blocking additive operations (`ADD COLUMN ... DEFAULT`, `ALTER COLUMN ... DROP NOT NULL`).
- **Testing Requirements:**
  - Automated migration test suite validating schema upgrade, rollback, and data integrity.

---

### Phase 4: Isolated Build Runner Extension

- **Objective:** Implement a dedicated, ephemeral Node.js build runner container for Cloudflare Workers and Cloudflare Pages that securely compiles code without root privileges or host daemon access.
- **Affected Modules & Files:**
  - `docker/runners/nodejs-build-runner.Dockerfile`
  - `docker/runners/scripts/build-entrypoint.sh`
  - `apps/workers/deployment-worker/src/runners/`
- **Dependencies (Pre-requisites):** Phase 2, Phase 3.
- **Detailed Deliverables:**
  1. Author `nodejs-build-runner.Dockerfile` with Node.js 20, unprivileged user `builder` (UID 10001), `wrangler`, and `esbuild`.
  2. Implement build orchestration script: clones git repository, runs `npm ci`, executes customer-configured build command, and extracts bundle or static directory.
  3. Enforce container sandboxing: `read-only rootfs`, `CapDrop=ALL`, `tmpfs` mounts, and resource constraints (1 CPU, 2048 MB RAM max).
  4. Implement artifact tarball exporter writing to tenant-scoped shared volumes.
- **Acceptance Criteria:**
  - Malicious build scripts attempting `sudo`, host socket mounting, or writing outside `/tmp` and `/workspace` fail immediately.
  - Produces valid Worker bundle (`dist/index.js`) or Pages static directory (`dist/` or `out/`).
- **Risks & Mitigations:**
  - *Risk:* Memory exhaustion during large Next.js/Webpack builds.
  - *Mitigation:* Configure hard memory limits with graceful error reporting to OpsPilot dashboard.
- **Testing Requirements:**
  - Container security audit tests confirming UID 10001 enforcement and read-only rootfs validation.
  - Build test suite running sample Vite, Next.js SSG, and Worker repos.

---

### Phase 5: Cloudflare Workers Provider Implementation

- **Objective:** Implement `CloudflareWorkersProvider` adhering to `IDeploymentProvider` using Cloudflare's modern Versioning & Deployments REST API.
- **Affected Modules & Files:**
  - `packages/deployment-providers/src/cloudflare/cloudflare-workers.provider.ts`
  - `packages/deployment-providers/src/cloudflare/cloudflare-client.ts`
- **Dependencies (Pre-requisites):** Phase 1, Phase 2, Phase 4.
- **Detailed Deliverables:**
  1. Author HTTP client for Cloudflare v4 REST API with rate-limiting, retries, and error mapping.
  2. Implement `prepareDeployment`: inspects `wrangler.jsonc` or service config for compatibility date, flags, and bindings.
  3. Implement `deploy`:
     - Creates script version: `POST /accounts/{account_id}/workers/scripts/{script_name}/versions`.
     - Deploys version with 100% traffic weight: `POST /accounts/{account_id}/workers/scripts/{script_name}/deployments`.
  4. Implement `rollback`: sets traffic weight to previous `version_id` instantly.
  5. Implement `checkHealth`: probes Worker URL or custom domain for HTTP 200 response.
- **Acceptance Criteria:**
  - Deploys sample Worker script to Cloudflare; returns valid `version_id`.
  - Rollback switches traffic globally in sub-second time.
  - API errors (e.g. invalid syntax, syntax errors in script) are mapped to standard OpsPilot domain exceptions.
- **Risks & Mitigations:**
  - *Risk:* Cloudflare API changes or rate limits.
  - *Mitigation:* Strict versioning against Cloudflare v4 REST API; exponential backoff for rate limit responses (HTTP 429).
- **Testing Requirements:**
  - Unit tests with Mock Service Worker (MSW) mocking all Cloudflare REST endpoints.
  - Integration test deploying a live test script in a test Cloudflare account.

---

### Phase 6: Cloudflare Pages Provider Implementation

- **Objective:** Implement `CloudflarePagesProvider` adhering to `IDeploymentProvider` using Cloudflare Pages Direct Upload API.
- **Affected Modules & Files:**
  - `packages/deployment-providers/src/cloudflare/cloudflare-pages.provider.ts`
  - `packages/deployment-providers/src/cloudflare/cloudflare-pages-client.ts`
- **Dependencies (Pre-requisites):** Phase 1, Phase 2, Phase 4.
- **Detailed Deliverables:**
  1. Author Pages client supporting project creation (`POST /accounts/{acc_id}/pages/projects`) and direct upload initialization.
  2. Implement asset manifest generation: hashes all files in the output directory.
  3. Implement Direct Upload flow: queries missing file hashes, uploads missing assets in parallel chunks with gzip compression.
  4. Capture and return production URL (`https://{project}.pages.dev`) and preview URL (`https://{dep_id}.{project}.pages.dev`).
  5. Implement `rollback`: calls Cloudflare Pages rollback API to restore target deployment.
- **Acceptance Criteria:**
  - Static site (HTML/JS/CSS) deploys successfully via Direct Upload.
  - Pages Functions (`/functions`) are packaged and deployed seamlessly alongside assets.
  - Preview deployments generate dedicated ephemeral preview URLs.
- **Risks & Mitigations:**
  - *Risk:* Uploading thousands of small files takes excessive time.
  - *Mitigation:* Parallel chunked uploads (max 10 concurrent requests) and hash verification to upload only modified files.
- **Testing Requirements:**
  - Unit tests mocking manifest negotiation and chunked asset upload.
  - End-to-end deployment verification for a Vite static application.

---

### Phase 7: Deployment Worker Pipeline Integration

- **Objective:** Wire the Cloudflare providers into the BullMQ `deployment-worker` lifecycle and state machine.
- **Affected Modules & Files:**
  - `apps/workers/deployment-worker/src/processors/deployment.processor.ts`
  - `apps/workers/deployment-worker/src/services/build-orchestrator.service.ts`
- **Dependencies (Pre-requisites):** Phase 3, Phase 5, Phase 6.
- **Detailed Deliverables:**
  1. Update `deployment.processor.ts` to dispatch jobs dynamically to `AwsEcsProvider`, `VpsDockerProvider`, `CloudflareWorkersProvider`, or `CloudflarePagesProvider` based on service provider type.
  2. Map lifecycle states: `QUEUED -> PREPARING -> BUILDING -> PUBLISHING -> DEPLOYING -> HEALTH_CHECKING -> SUCCEEDED`.
  3. Implement real-time log ingestion: capture runner output and stream to PostgreSQL and dashboard WebSockets.
  4. Implement failure handling: trigger automated rollback if health check fails after deployment.
- **Acceptance Criteria:**
  - BullMQ job successfully executes end-to-end deployment for both Workers and Pages.
  - Logs are persisted in `deployment_logs` and streamed to the UI in real-time.
  - Failures transition cleanly to `FAILED` or `ROLLED_BACK`.
- **Risks & Mitigations:**
  - *Risk:* Worker crash leaving deployment in perpetual `DEPLOYING` state.
  - *Mitigation:* Enforce job timeout boundaries (max 15 minutes) and heartbeat monitoring.
- **Testing Requirements:**
  - BullMQ integration tests with embedded Redis asserting complete state machine transitions.

---

### Phase 8: Telemetry and Observability Integration

- **Objective:** Ingest Cloudflare edge metrics, real-time Tail logs, and health status into OpsPilot's observability pipeline.
- **Affected Modules & Files:**
  - `apps/workers/telemetry-worker/`
  - `packages/telemetry/src/cloudflare/`
  - `packages/ai-gateway/src/tools/`
- **Dependencies (Pre-requisites):** Phase 7.
- **Detailed Deliverables:**
  1. Author Cloudflare GraphQL Analytics client to pull request counts, 5xx error spikes, and CPU execution time every 5 minutes.
  2. Implement Cloudflare Tail WebSocket client to stream logs during active investigations or incident triage.
  3. Extend `GetLogsTool` and `GetMetricsTool` in the AI gateway to retrieve Cloudflare telemetry transparently for the AI investigation agent.
  4. Implement health check cron probing edge URLs every 60 seconds.
- **Acceptance Criteria:**
  - Cloudflare metrics appear in OpsPilot telemetry dashboards.
  - AI Agent accurately retrieves and analyzes Cloudflare edge 5xx errors and execution timeouts.
- **Risks & Mitigations:**
  - *Risk:* Tail API WebSocket disconnection.
  - *Mitigation:* Implement automated reconnection logic with max retry limits; fall back to GraphQL analytics.
- **Testing Requirements:**
  - Mocked WebSocket tests for Cloudflare Tail log stream processing.
  - AI tool evaluation test asserting correct hypothesis generation for edge worker failures.

---

### Phase 9: API and Frontend Integration

- **Objective:** Expose Cloudflare configuration via the Core REST API and create intuitive UI flows in the Next.js Dashboard.
- **Affected Modules & Files:**
  - `apps/api/src/modules/services/`
  - `apps/api/src/modules/deployments/`
  - `apps/dashboard/src/app/(dashboard)/services/`
  - `apps/dashboard/src/app/(dashboard)/integrations/`
- **Dependencies (Pre-requisites):** Phase 7, Phase 8.
- **Detailed Deliverables:**
  1. Update REST DTOs and OpenAPI documentation for polymorphic service creation.
  2. Author Cloudflare Integration modal in the Dashboard (Account ID and Token input with validation).
  3. Create Service Configuration forms for Workers (compatibility date, main entrypoint, routes) and Pages (build command, output directory).
  4. Author Live Deployment View displaying real-time build logs, preview URLs, and Instant Rollback button.
- **Acceptance Criteria:**
  - User can connect a Cloudflare account in under 60 seconds.
  - User can configure, trigger, monitor, and roll back a Cloudflare Worker or Pages deployment directly from the dashboard.
- **Risks & Mitigations:**
  - *Risk:* Form complexity confusing users.
  - *Mitigation:* Provide smart auto-detection of `wrangler.jsonc` or static frontend frameworks (Next.js, Vite, Astro) during repository scanning.
- **Testing Requirements:**
  - End-to-end Cypress / Playwright tests covering integration setup, service creation, and deployment triggering.

---

### Phase 10: Documentation, Testing, and Beta Release

- **Objective:** Finalize user-facing and technical documentation, complete end-to-end verification, and release Cloudflare deployment support to beta users.
- **Affected Modules & Files:**
  - `docs/integrations/CLOUDFLARE_INTEGRATION.md`
  - `docs/deployment/CLOUDFLARE_WORKERS_DEPLOYMENT.md`
  - `docs/deployment/CLOUDFLARE_PAGES_DEPLOYMENT.md`
  - `docs/README.md`
- **Dependencies (Pre-requisites):** Phases 1 through 9.
- **Detailed Deliverables:**
  1. Author comprehensive setup guides for Cloudflare API tokens, Workers, and Pages.
  2. Document troubleshooting procedures for common edge errors (CPU time exceeded, memory limits, missing compatibility flags).
  3. Run full regression test suite across AWS ECS, VPS Docker, Cloudflare Workers, and Cloudflare Pages.
  4. Tag and release OpsPilot v1.1.0-beta.
- **Acceptance Criteria:**
  - All CI/CD pipeline checks pass with 100% green status.
  - Documentation reviewed and validated by engineering team.
  - Beta testing verified with at least 3 distinct SaaS workloads (Hono API, Next.js Pages, Vite SPA).
- **Risks & Mitigations:**
  - *Risk:* Edge case bugs discovered in production edge environments.
  - *Mitigation:* Gate Cloudflare provider behind a tenant-level feature flag (`enable_cloudflare_providers`) during beta.
- **Testing Requirements:**
  - Complete multi-target automated test suite in GitHub Actions.
