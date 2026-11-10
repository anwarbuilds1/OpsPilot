# ADR-0021: Cloudflare Direct Upload Multi-Stage Lifecycle and Worker Secrets Sequencing

- **Status:** Accepted
- **Date:** 2026-11-10
- **Author(s):** OpsPilot Core Engineering
- **Deciders:** Platform Security & Core Architecture Team

---

## Context
OpsPilot provides deployment adapters for Cloudflare Workers and Cloudflare Pages (`packages/deployment-providers`). An adversarial audit identified three critical operational defects:
1. **Fictitious Pages Direct Upload Protocol:** The previous implementation attempted a monolithic single multipart upload directly to `/deployments`. Cloudflare Pages official Direct Upload protocol requires a 4-stage lifecycle (session JWT acquisition, missing asset negotiation, asset chunk upload, and deployment creation).
2. **Workers Secret Mutation Prior to Compilation:** In `CloudflareWorkersProvider.deploy`, secrets were synchronized to the script *before* the immutable version was uploaded. If script compilation or bundle validation failed, production secrets had already been mutated.
3. **Pages Preview Rollback:** The Cloudflare Pages `/rollback` endpoint is only valid for production environments. Attempting to roll back an ephemeral preview deployment leads to upstream API errors.
4. **Pages Functions Compilation:** Pages Direct Upload serves files in `functions/` as static assets unless pre-compiled into a root `_worker.js` bundle.

## Problem Statement
How to align Cloudflare adapters with official upstream API lifecycles, protect production secrets from malformed script updates, prevent invalid rollback states, and validate Functions packaging requirements?

## Decision
1. **Official 4-Stage Pages Direct Upload Lifecycle:**
   - **Stage 1 (Session Acquisition):** Call `POST /accounts/{id}/pages/projects/{name}/direct_upload` to obtain an ephemeral session JWT.
   - **Stage 2 (Asset Hash Negotiation):** Call `POST /pages/assets/check-missing` using the session JWT with unique asset hashes from the manifest to determine which files are not yet cached by Cloudflare.
   - **Stage 3 (Differential Asset Upload):** Call `POST /pages/assets/upload` using the session JWT to upload only missing assets.
   - **Stage 4 (Deployment Instantiation):** Call `POST /accounts/{id}/pages/projects/{name}/deployments` with the manifest and target environment.

2. **Workers Secrets Safe Sequencing:**
   - `uploadScriptVersion` executes **first**. Cloudflare validates syntax, compatibility flags, and bundle structure.
   - `syncScriptSecrets` executes **second**, only after script version creation has succeeded.
   - If version upload fails, secrets are never touched, guaranteeing zero mutation of production configuration on build/compilation errors.
   - Rollback secret behavior is documented: Cloudflare Workers secrets are script-global. Shifting traffic weight does not alter secrets unless explicit `rollbackSecrets` are provided.

3. **Guarded Pages Preview Rollbacks:**
   - `CloudflarePagesProvider.rollback` checks both caller-supplied environment and queries `getPagesDeployment`.
   - If the target deployment is an ephemeral preview deployment, it immediately throws `InvalidRollbackEnvironmentException` ('INVALID_ROLLBACK_ENVIRONMENT').

4. **Explicit Pages Functions Deployment Policy (`functionsMode`):**
   - Direct Upload requires edge functions to be pre-compiled into a root `_worker.js`.
   - `CloudflarePagesDeploymentConfig` introduces a minimal, explicit `functionsMode` policy property:
     - `'required'`: Functions are mandatory. If a compiled `_worker.js` bundle is missing from the output directory, the provider fails closed and throws `ConfigurationValidationException`. A deployment requiring Functions cannot silently succeed as static.
     - `'static_only'`: Pure static CDN deployment. Any files in `/functions/` are ignored and served as static assets without warnings.
     - `'optional_fallback'` (Default): Preserves backward-compatible behavior. Emits a warning if `/functions/` exists without `_worker.js`, but allows deployment to proceed with static fallback.

## Verification Boundaries & Known Limitations

1. **Mock Contract Tests vs Live Verification:**
   - The Cloudflare provider and API client implementations are verified via **mocked unit and contract tests** conforming to Cloudflare API v4 specifications.
   - The integrations have **not been live-verified** against active Cloudflare production infrastructure or enterprise zones in Phase 0. Real edge verification (e.g. rate limit throttling, GraphQL schema evolution, DNS propagation) is scheduled for Phase 1.

2. **Bulk Upload Payload Chunking:**
   - `uploadPagesMissingAssets` sends missing assets in a single batch. For massive initial deployments with thousands of missing files exceeding Cloudflare's request size limits ($>50\text{MB}$), payload batch chunking is required and deferred to Phase 1.

3. **Workers Script-Global Secret Behavior:**
   - Cloudflare Workers API binds secrets at the script level (`/accounts/{id}/workers/scripts/{name}/secrets`). Shifting traffic weight during rollback restores code execution of a previous version, but does not revert script secrets unless `rollbackSecrets` are explicitly provided by the caller.

## Alternatives Considered
1. **Single Monolithic Multipart Upload:** Retaining monolithic upload. Rejected: fails on real Cloudflare Pages infrastructure; does not benefit from asset deduplication across deployments.
2. **Syncing Secrets Before Upload:** Retaining original sequence. Rejected: dangerous operational hazard where invalid code changes production environment variables.

## Rationale & Consequences
### Positive Consequences:
- Conforms accurately to the official Cloudflare Pages Direct Upload protocol.
- Significantly speeds up deployments via differential asset deduplication (only new/changed assets are uploaded).
- Shields production Workers environments from partial/corrupted deployments.
- Provides explicit governance for Pages Functions requirements, preventing silent failures.
- Provides immediate, clear feedback when users attempt unsupported preview rollbacks.

### Negative Consequences / Trade-offs:
- Requires multiple HTTP requests per Pages deployment (session -> check-missing -> upload -> deploy).

## Security Implications
- Ephemeral JWT upload tokens isolate asset upload permissions from broader account management tokens.
- Secret synchronization is strictly gated behind successful immutable code compilation.

## Migration & Implementation Plan
- Implemented in `packages/deployment-providers/src/cloudflare/common/cloudflare-api-client.ts`, `packages/deployment-providers/src/providers/cloudflare-pages.provider.ts`, and `packages/deployment-providers/src/providers/cloudflare-workers.provider.ts`.
- Validated via unit tests in `packages/deployment-providers/tests/cloudflare-api-client.spec.ts`, `packages/deployment-providers/tests/cloudflare-pages-provider.spec.ts`, and `packages/deployment-providers/tests/cloudflare-workers-provider.spec.ts`.

## References
- ADR-0014: Separate Cloudflare Workers and Pages Providers
- ADR-0015: Direct Upload Strategy for Cloudflare Pages
- Cloudflare Pages Direct Upload API Documentation
