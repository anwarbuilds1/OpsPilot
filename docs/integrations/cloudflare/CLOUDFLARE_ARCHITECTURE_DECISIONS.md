# OpsPilot — Cloudflare Architecture Decision Records (ADRs)

> **Document Type:** Architecture Decision Records (ADRs 0014 – 0018)  
> **Status:** Amended Specifications (Post-Architecture Decision Review)  
> **Authors:** Principal Platform Engineer, DevOps Architect, Senior Software Engineer  
> **Deciders:** OpsPilot Core Engineering Team & Architecture Review Board  
> **Original Date:** November 2026  
> **Last Amended Date:** November 2026 (via `CLOUDFLARE_ARCHITECTURE_REVIEW.md`)

---

## ADR Index

- [ADR-0014: Separate Cloudflare Workers and Cloudflare Pages Providers](#adr-0014-separate-cloudflare-workers-and-cloudflare-pages-providers)
- [ADR-0015: Direct Upload Strategy for Cloudflare Pages](#adr-0015-direct-upload-strategy-for-cloudflare-pages)
- [ADR-0016: Node.js Isolated Build Runner for Cloudflare Targets](#adr-0016-nodejs-isolated-build-runner-for-cloudflare-targets)
- [ADR-0017: Polymorphic Deployment Configuration and Database Schema Evolution](#adr-0017-polymorphic-deployment-configuration-and-database-schema-evolution)
- [ADR-0018: Cloudflare API Token Scoping and Envelope Encryption](#adr-0018-cloudflare-api-token-scoping-and-envelope-encryption)

---

## ADR-0014: Separate Cloudflare Workers and Cloudflare Pages Providers

- **Status:** Implemented & Verified (November 2026) *(Amended via Architecture Review)*
- **Date:** 2026-11-07 (Amended: 2026-11-07, Implemented: 2026-11-08)
- **Author:** Principal Software Architect
- **Deciders:** OpsPilot Core Team & Architecture Review Board

### Context
Cloudflare offers two primary application execution products: **Cloudflare Workers** (low-latency V8 isolate compute designed for microservices, API gateways, and event-driven backends) and **Cloudflare Pages** (Jamstack hosting designed for static frontends, single-page applications, and edge-rendered SSR via Pages Functions). Although both execute on Cloudflare's global edge network and share underlying runtime primitives, their developer workflows, configuration files, APIs, and artifact lifecycles diverge significantly.

### Problem Statement
Should OpsPilot unify Cloudflare support into a single monolithic provider (`CloudflareProvider`), or implement two distinct providers (`CloudflareWorkersProvider` and `CloudflarePagesProvider`)?

### Decision (Original)
We decide to implement two separate deployment providers:
1. `CloudflareWorkersProvider` (Target provider: `cloudflare_workers`)
2. `CloudflarePagesProvider` (Target provider: `cloudflare_pages`)

Both providers inherit from a shared `EdgeDeploymentProvider` base class in `packages/deployment-providers` to reuse Cloudflare HTTP client authentication, rate-limiting, and error mapping logic.

### Alternatives Considered
1. **Single Unified `CloudflareProvider`:**
   - *Rejected:* Conflates disparate APIs (Workers Scripts API vs. Pages Projects API). Forces complex internal branching based on whether an application has static files, dynamic functions, or worker scripts. Complicates UI forms and error handling.
2. **Workers-Only Deployment (serving static assets via Workers KV/Workers Sites):**
   - *Rejected:* Workers Sites is legacy and officially deprecated by Cloudflare in favor of Cloudflare Pages or Workers Static Assets. Pages provides built-in preview deployments, CDN asset caching, and framework presets out-of-the-box.

### Rationale & Consequences
- **Positive:** Clean separation of concerns. Developers explicitly choose between an edge API/worker or a frontend/full-stack Jamstack project. Clear mapping to Cloudflare's official REST endpoints and documentation.
- **Negative:** Minor boilerplate in managing two provider registrations in the dependency injection container and database enum.

### Security Implications
Ensures scoped permissions: a frontend deployment needing Pages access does not require broad Worker script modification privileges if users scope tokens per project.

### Migration & Implementation Plan
Add `'cloudflare_workers'` and `'cloudflare_pages'` to the `target_provider` enum in PostgreSQL and register both providers in `packages/deployment-providers`.

### Amendment & Review Revision (November 2026)
- **Superseded Element:** The intermediate abstract inheritance class `EdgeDeploymentProvider` is **superseded and removed**.
- **Revised Specification (Composition over Inheritance):**
  1. Both `CloudflareWorkersProvider` and `CloudflarePagesProvider` extend `BaseDeploymentProvider` directly (which handles purely universal cross-cutting concerns: logging, secret redactor, tenant context validation, and error normalization).
  2. Common Cloudflare API transport logic (authentication, rate-limiting with 429 exponential backoff, request tracing, and Cloudflare error unwrapping) is encapsulated in an independent `CloudflareApiClient` service located in `packages/deployment-providers/src/cloudflare/common/`.
  3. `CloudflareWorkersProvider` and `CloudflarePagesProvider` inject `CloudflareApiClient` via dependency injection.
- **Justification:** As established in `CLOUDFLARE_ARCHITECTURE_REVIEW.md` (Decision 1), the intermediate inheritance hierarchy introduced leaky abstractions and tight coupling between disparate REST APIs. Composition allows cleaner unit testing, independent mocking, and simpler future extensions.

### References
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [`CLOUDFLARE_ARCHITECTURE_REVIEW.md`](./CLOUDFLARE_ARCHITECTURE_REVIEW.md)

---

## ADR-0015: Direct Upload Strategy for Cloudflare Pages

- **Status:** Implemented & Verified (November 2026) *(Amended via Architecture Review)*
- **Date:** 2026-11-07 (Amended: 2026-11-07, Implemented: 2026-11-08)
- **Author:** DevOps Architect
- **Deciders:** OpsPilot Core Team & Architecture Review Board

### Context
Cloudflare Pages supports two deployment integration models:
1. **Cloudflare-Managed Git Integration:** Cloudflare connects directly to GitHub, listens for push webhooks, and runs builds inside Cloudflare's proprietary build environment.
2. **Direct Upload API:** OpsPilot builds the static assets and functions locally inside an isolated runner and uploads the compiled output directory directly to Cloudflare via the Pages Direct Upload REST API or Wrangler.

### Problem Statement
How should OpsPilot trigger and deliver builds to Cloudflare Pages?

### Decision (Original)
We decide to use the **Direct Upload Strategy** exclusively. OpsPilot will checkout repositories, execute builds in its own isolated runner containers, collect streaming logs, and upload the resulting asset manifest directly to Cloudflare Pages.

### Alternatives Considered
1. **Cloudflare-Managed Git Integration:**
   - *Rejected:* Cloudflare-managed builds bypass OpsPilot's control plane entirely. OpsPilot would lose visibility into build logs, cannot enforce pre-build security policies, cannot inject OpsPilot-managed secrets, and cannot correlate build failures with OpsPilot deployment jobs. Furthermore, it forces users to grant GitHub repository permissions to both OpsPilot and Cloudflare.

### Rationale & Consequences
- **Positive:**
  - Preserves sovereign control plane: OpsPilot owns the build lifecycle, logs, environment injection, and audit trail.
  - Consistent developer experience: build logs stream to the OpsPilot dashboard identically for ECS, VPS, and Pages.
  - Zero requirement for customers to link their GitHub accounts to Cloudflare.
- **Negative:**
  - OpsPilot runners consume compute resources to execute Jamstack builds (e.g. `npm run build`), and must upload static assets over the network to Cloudflare.

### Security Implications
Build scripts execute in OpsPilot's sandboxed, non-root runner environment. Credentials stored in OpsPilot never need to be replicated or synced to Cloudflare Pages environment variables.

### Migration & Implementation Plan
Implement manifest hashing and chunked parallel upload client in `CloudflarePagesProvider`.

### Amendment & Review Revision (November 2026)
- **Augmented Specifications:**
  1. **Pages Functions Compilation:** The isolated `NodeJsBuildRunner` must execute `wrangler pages functions build` (or framework-specific adapters) whenever a `/functions` directory or dynamic edge framework is detected, outputting a compiled root `_worker.js` and `_routes.json` into the upload directory prior to asset packaging.
  2. **Pre-Upload Limit Verification:** The runner must count files and check individual asset sizes before attempting upload. If the output directory exceeds **20,000 files** or any single asset exceeds **25 MiB**, the build aborts with an actionable error.
  3. **Chunked SHA-256 Manifest Client:** The `CloudflarePagesProvider` must implement Cloudflare's two-step manifest negotiation protocol: submit a SHA-256 file manifest, receive the list of missing hashes from Cloudflare's deduplicated cache, and upload only missing files in batched chunks (max 10 concurrent requests) with exponential backoff.
- **Justification:** Resolves technical gaps identified in `CLOUDFLARE_ARCHITECTURE_REVIEW.md` (Decision 4) to ensure dynamic Pages Functions deploy correctly and large deployments do not encounter network timeouts or Cloudflare API rejections.

### References
- [Cloudflare Pages Direct Upload Documentation](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- [`CLOUDFLARE_ARCHITECTURE_REVIEW.md`](./CLOUDFLARE_ARCHITECTURE_REVIEW.md)

---

## ADR-0016: Node.js Isolated Build Runner for Cloudflare Targets

- **Status:** Implemented & Verified (November 2026) *(Amended via Architecture Review)*
- **Date:** 2026-11-07 (Amended: 2026-11-07, Implemented: 2026-11-08)
- **Author:** Senior Platform Security Specialist
- **Deciders:** OpsPilot Core Team & Architecture Review Board

### Context
OpsPilot isolates untrusted customer build scripts using containerized runners (`docker/build-runner.Dockerfile`). Currently, this runner is designed to compile Dockerfiles and push container images using Kaniko or Docker-in-Docker. Cloudflare Workers and Pages require Node.js, npm/pnpm/yarn, esbuild, and Wrangler to package JavaScript/TypeScript ESM bundles and static assets.

### Problem Statement
How should OpsPilot execute builds and packaging for Cloudflare Workers and Pages without compromising runner security or bloating the existing Docker build image?

### Decision (Original)
We decide to create a dedicated, lightweight **`NodeJsBuildRunner`** container image (`docker/runners/nodejs-build-runner.Dockerfile`) specifically tailored for Node.js, Wrangler, and static site generation.

Runner specifications:
- Base image: `node:20-alpine`
- Unprivileged execution: user `builder` (UID 10001, GID 10001)
- Hardened container security: `CapDrop=ALL`, `no-new-privileges: true`, read-only root filesystem
- Ephemeral writable mounts: `tmpfs` mounts at `/tmp` and `/workspace`
- Pre-installed tools: `wrangler`, `esbuild`, `git`

### Alternatives Considered
1. **Single "Fat" Universal Build Runner:**
   - *Rejected:* Combining Docker, Kaniko, Node.js, Python, Rust, and Go into a single runner image results in multi-gigabyte container sizes, high startup latency, and a drastically expanded CVE attack surface.
2. **Running Wrangler Directly on the Host Worker VM:**
   - *Rejected: Critical Security Violation.* Running untrusted `npm install` and build scripts directly on worker host processes enables arbitrary code execution, host file extraction, and privilege escalation.

### Rationale & Consequences
- **Positive:** Strict least-privilege sandboxing. Fast cold starts (< 1 second container spin-up). Zero access to host Docker daemon or Docker socket.
- **Negative:** OpsPilot maintains two runner images (`ContainerBuildRunner` and `NodeJsBuildRunner`) in CI/CD.

### Security Implications
Customer code cannot alter host state, access host networks, or escape the container. Even if a compromised npm package runs post-install hooks, it is trapped within an unprivileged Alpine container with ephemeral `tmpfs` storage.

### Amendment & Review Revision (November 2026)
- **Mandatory Security Hardening Parameters:**
  1. **Egress Firewall & Metadata Blackholing:** Container bridge network MUST explicitly drop traffic to link-local instance metadata (`169.254.169.254/32`) and private RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) via container firewall rules. Untrusted customer scripts cannot steal host AWS/GCP IAM credentials or probe internal databases. Outbound traffic is restricted to public DNS (53), HTTP (80), and HTTPS (443).
  2. **Bounded `tmpfs` Mounts:** To prevent host RAM exhaustion (DoS), `tmpfs` mounts must enforce hard size limits: `--tmpfs /tmp:rw,nosuid,size=512m` and `--tmpfs /workspace:rw,nosuid,size=2048m`.
  3. **Strict Resource & Process Quotas:** Containers must be invoked with `--pids-limit 256` (prevents fork bombs), `--memory 2048m --memory-swap 2048m`, and `--cpus 1.5`.
  4. **Multi-Package Manager Support via Corepack:** Enable Node.js Corepack in the image (`corepack enable`) to support `pnpm` and `yarn` deterministically using immutable lockfile flags (`pnpm install --frozen-lockfile`, `yarn install --immutable`, `npm ci`).
  5. **Wrangler as Bundler Only:** Wrangler in the runner is used strictly as a build and bundling tool (`wrangler build` or `wrangler deploy --dry-run`). The runner exports a standardized `opspilot-build-manifest.json` containing evaluated bindings, entrypoint, and compatibility flags. Cloudflare API tokens are NEVER passed to the runner. The trusted `DeploymentWorker` performs the authenticated REST API deployment.
- **Justification:** Eliminates critical vulnerabilities identified in `CLOUDFLARE_ARCHITECTURE_REVIEW.md` (Decisions 5 and 7) regarding metadata credential theft, host RAM DoS, and runner token exposure.

### References
- [`docs/security/DEPLOYMENT_RUNNER_SECURITY.md`](../../security/DEPLOYMENT_RUNNER_SECURITY.md)
- [`CLOUDFLARE_ARCHITECTURE_REVIEW.md`](./CLOUDFLARE_ARCHITECTURE_REVIEW.md)

---

## ADR-0017: Polymorphic Deployment Configuration and Database Schema Evolution

- **Status:** Implemented & Verified (November 2026) *(Amended via Architecture Review)*
- **Date:** 2026-11-07 (Amended: 2026-11-07, Implemented: 2026-11-08)
- **Author:** Principal Software Architect
- **Deciders:** OpsPilot Core Team & Architecture Review Board

### Context
The baseline OpsPilot schema in `docs/engineering/DATABASE_DESIGN.md` enforces Docker-specific columns (`dockerfile_path`, `container_port`, `cpu_units`, `memory_mb`) on the `services` table and requires `image_uri` on the `deployments` table. These columns are meaningless for Cloudflare Workers and Pages.

### Problem Statement
How should the database schema and domain models evolve to accommodate non-container deployment targets without breaking existing AWS ECS and VPS Docker records?

### Decision (Original)
We decide to evolve the database schema through backward-compatible, additive modifications:
1. Add `runtime_type VARCHAR(32) NOT NULL DEFAULT 'container'` to `services`.
2. Relax `NOT NULL` constraints on `dockerfile_path`, `container_port`, `cpu_units`, and `memory_mb` for services where `runtime_type != 'container'`.
3. Add a generic `config JSONB NOT NULL DEFAULT '{}'` column to `services` to hold provider-specific configuration (e.g. `compatibility_date`, `routes`, `output_directory`).
4. Relax `NOT NULL` on `deployments.image_uri` and introduce `artifact_reference TEXT` to store immutable Worker Version IDs (`ver_...`) or Pages Deployment IDs.
5. In TypeScript, implement `DeploymentConfig` as a discriminated union keyed on `runtimeType`.

### Alternatives Considered
1. **Separate Tables per Target (`container_services`, `worker_services`, `pages_services`):**
   - *Rejected:* Severely fragments queries, foreign keys, telemetry association, and UI presentation across the platform.
2. **Passing Dummy Values to Docker Columns (e.g. `port: 0`, `dockerfile: 'none'`):**
   - *Rejected:* Compromises domain integrity, pollutes the database with misleading data, and creates bugs in validation logic.

### Rationale & Consequences
- **Positive:** Clean, extensible domain model. Full backward compatibility with existing container rows. Easily accommodates future edge runtimes (e.g. Fastly Compute, Deno Deploy).
- **Negative:** Requires Zod validation in application layers to enforce presence of required fields based on `runtime_type`.

### Security Implications
Tenant isolation is strictly maintained as `organization_id` remains the immutable partitioning key on all tables.

### Amendment & Review Revision (November 2026)
- **Superseded Element:** Discriminating configurations and services by `runtime_type` (`container | edge_worker | static_pages`) is **superseded**.
- **Revised Specification:**
  1. **Discrimination by `target_provider`:** The top-level discriminator for `DeploymentConfig` and the `services` table is `target_provider: 'aws_ecs' | 'vps_docker' | 'cloudflare_workers' | 'cloudflare_pages'`. In `packages/domain`, `buildStrategy` (`dockerfile | cloudflare_worker_bundle | static_export`) and `artifactType` (`oci_image | worker_bundle | pages_manifest`) are modeled explicitly as independent domain attributes rather than conflated into an ambiguous "runtime" type.
  2. **Mandatory Conditional Database Integrity Constraint:** To preserve container data integrity when relaxing `NOT NULL` constraints, the PostgreSQL migration must attach a conditional `CHECK` constraint:
     ```sql
     ALTER TABLE services 
       ADD CONSTRAINT check_container_runtime_fields 
       CHECK (
         target_provider NOT IN ('aws_ecs', 'vps_docker') OR (
           dockerfile_path IS NOT NULL AND 
           container_port IS NOT NULL AND 
           cpu_units IS NOT NULL AND 
           memory_mb IS NOT NULL
         )
       );
     ```
- **Justification:** Resolves issues identified in `CLOUDFLARE_ARCHITECTURE_REVIEW.md` (Decisions 2 and 9). Prevents invalid container configurations from being persisted and eliminates the technically inaccurate concept of "static_pages" as an application runtime.

### References
- [`docs/engineering/DATABASE_DESIGN.md`](../../engineering/DATABASE_DESIGN.md)
- [`CLOUDFLARE_ARCHITECTURE_REVIEW.md`](./CLOUDFLARE_ARCHITECTURE_REVIEW.md)

---

## ADR-0018: Cloudflare API Token Scoping and Envelope Encryption

- **Status:** Implemented & Verified (November 2026) *(Amended via Architecture Review)*
- **Date:** 2026-11-07 (Amended: 2026-11-07, Implemented: 2026-11-08)
- **Author:** Senior Platform Security Specialist
- **Deciders:** OpsPilot Core Team & Architecture Review Board

### Context
Cloudflare authentication supports Global API Keys (full account compromise risk) and scoped API Tokens. OpsPilot manages infrastructure credentials on behalf of multiple customer organizations.

### Problem Statement
How should Cloudflare credentials be structured, validated, and secured within OpsPilot?

### Decision (Original)
We decide that:
1. OpsPilot **strictly prohibits Global API Keys** and accepts **Cloudflare API Tokens only**.
2. Tokens must be scoped to the minimal necessary account permissions (`Workers Scripts: Edit`, `Pages: Edit`, `Workers Tail: Read`).
3. Tokens are encrypted at rest using OpsPilot's envelope encryption service (`AES-256-GCM` with tenant-specific Data Encryption Keys managed via AWS KMS or Master Key).
4. Tokens are verified upon entry via Cloudflare's token verification API (`/user/tokens/verify`).
5. Decrypted tokens are held exclusively in volatile memory inside worker processes and are strictly excluded from build runners, AI model contexts, application logs, and API responses.

### Alternatives Considered
1. **Allowing Global API Keys:**
   - *Rejected:* Global API keys grant unrestricted access to account billing, user management, and all zones, creating an unacceptable blast radius in multi-tenant environments.
2. **Cloudflare OAuth Integration:**
   - *Evaluated for future consideration:* Provides seamless UI authorization, but requires OpsPilot to register as a formal Cloudflare Partner application and manage complex refresh token rotations. API Tokens provide immediate, enterprise-grade, self-hosted compatibility.

### Rationale & Consequences
- **Positive:** Complies with Zero-Trust security principles, minimizes blast radius, satisfies SOC2 compliance requirements.
- **Negative:** Requires users to generate an API Token in their Cloudflare dashboard using a template or instructions.

### Security Implications
Even in the event of an SQL injection or database dump, credentials remain cryptographically protected by AES-256-GCM envelope encryption.

### Amendment & Review Revision (November 2026)
- **Augmented Specifications:**
  1. **Tiered Permission Model:** Replace the monolithic permission list with tiered scopes:
     - *Core Workers Scope:* `Account.Workers Scripts: Edit`, `Account.Account Settings: Read`.
     - *Core Pages Scope:* `Account.Pages: Edit`, `Account.Account Settings: Read`.
     - *Custom Domains Scope (Optional):* `Zone.Workers Routes: Edit`, `Zone.Zone: Read`.
     - *Storage Bindings Scope (Optional):* `Account.Workers KV Storage: Edit/Read`, `Account.D1: Edit/Read`, `Account.Workers R2 Storage: Edit/Read`.
     - *Live Diagnostics Scope (Optional):* `Account.Workers Tail: Read`.
     - *Analytics Scope (Optional):* `Account.Analytics: Read`.
  2. **Deep Permission Probing:** Integration connection verification must probe account-level and product-level endpoints (`/accounts/{id}/workers/scripts` and `/accounts/{id}/pages/projects`) in addition to `/user/tokens/verify` to detect missing permission scopes at connection time rather than at deployment time.
  3. **AI Observability Architecture Redesign:** The live Cloudflare Tail API is strictly designated for deployment-window validation (capturing immediate startup crashes). For AI incident investigation of past events, OpsPilot relies on:
     - Synthetic edge probe diagnostics (`CF-Ray`, `CF-Worker`, error codes 1101/1027).
     - Standard OpsPilot OpenTelemetry integration via `@microlabs/otel-cf-workers` streaming traces directly to OpsPilot's OTLP collector.
     - Enterprise Logpush support for durable historical log retention.
- **Justification:** Resolves critical vulnerabilities and functional gaps identified in `CLOUDFLARE_ARCHITECTURE_REVIEW.md` (Decisions 3, 6, and 10). Guarantees least privilege, prevents runtime 403 errors on custom domains/storage bindings, and ensures the AI Agent receives real historical error evidence.

### References
- [Cloudflare API Token Documentation](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [`docs/security/CREDENTIAL_MANAGEMENT.md`](../../security/CREDENTIAL_MANAGEMENT.md)
- [`CLOUDFLARE_ARCHITECTURE_REVIEW.md`](./CLOUDFLARE_ARCHITECTURE_REVIEW.md)
