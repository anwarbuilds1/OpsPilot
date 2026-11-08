# OpsPilot — Canonical Project Context & Architecture Reference

> **Audience:** AI Coding Assistants (e.g., Antigravity, ChatGPT, Claude Code, GitHub Copilot) and Human Systems Engineers
> **Status:** Canonical Living Specification & Repository Ground Truth
> **Effective Date:** November 2026 (Phase 0 Closed; Phase 1 Awaiting Authorization)
> **License:** Apache License 2.0 ([`LICENSE`](../LICENSE))

---

## ⭐️ Implementation Maturity & Production Approval

OpsPilot currently contains foundational domain entities, data schemas, driven ports, application use cases, and provider adapter code. However, **the platform is not yet production-ready**, and **no deployment provider or security module is currently approved for production use**.

### Verification Dimensions Defined:
- **Code Exists:** Source files are present on disk in workspace packages.
- **Package Dependency:** Package-level imports or contract implementation across workspace package boundaries (e.g. `@opspilot/domain`, `@opspilot/contracts`, `@opspilot/application`, `@opspilot/database`, `@opspilot/deployment-providers`, `@opspilot/security`).
- **Composition Wiring:** Concrete implementations assembled and injected together into a production composition root or higher-level consumer. *Mock test-fixture injection does not constitute production composition wiring.*
- **Executable Runtime:** Composition launched inside an actual application process, HTTP server daemon, or background worker daemon (`apps/api` or `apps/workers`).
- **Unit Tests:** Automated unit test suites passing in memory.
- **Integration Tests:** Automated tests executed against external services (e.g. real PostgreSQL 18.6 with connection-isolated schemas).
- **Security Assessment:** Distinguishes between automated adversarial tests executed, manual security assessments, static code review findings, and failed security validations.
- **Production Approval:** Formal authorization for production deployment. Statuses are strictly restricted to:
  - **NOT ASSESSED**: Where no production assessment has occurred.
  - **NOT APPROVED**: Where implementation has been assessed or explicitly remains unauthorized.
  - **APPROVED**: Only with explicit verification evidence (currently 0 components).

The table below establishes the verified status of every major architectural component across these independent verification dimensions:

| Component | Code Exists | Package Dependency | Composition Wiring | Executable Runtime | Unit Tests | Integration Tests | Security Assessment | Production Approval | Notes & Identified Limitations |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **Domain State Machine** | **Yes** | **Yes** | **No** | **No** | **Yes** (6 tests) | **No** | None | **NOT ASSESSED** | 11 states; strictly validates transitions and terminal states. Awaits end-to-end platform validation. |
| **PostgreSQL Schema & Repos** | **Yes** | **Yes** | **No** | **No** | **No** | **Yes** (PostgreSQL 18.6) | Schema isolation validated; missing atomic outbox | **NOT APPROVED** | Tenant-scoped CRUD verified; lacks transactional outbox (`DEBT-01`). |
| **Application Use Cases** | **Yes** | **Yes** | **No** | **No** | **Yes** (4 tests) | **No** | Static Code Review (Identified dual-write risk `DEBT-01`) | **NOT APPROVED** | `TriggerDeploymentUseCase` executes dual-writes without atomic queue transaction (`DEBT-01`). |
| **Execution Engine Orchestrator** | **Yes** | **Yes** | **No** | **No** | **Yes** (3 tests) | **No** | Static Code Review (Identified stabilization gap `ENG-01`) | **NOT APPROVED** | In-memory orchestrator; lacks stabilization polling before health probes (`ENG-01`). |
| **AWS ECS Provider** | **Yes** | **Yes** | **No** | **No** | **Yes** (6 tests) | **No** (Mock I/O only) | Static Code Review (Simulated registry; hardcoded ARNs) | **NOT APPROVED** | Uses `MockContainerRegistryClient`; real `@aws-sdk/client-ecs` is not installed. |
| **VPS Docker Provider** | **Yes** | **Yes** | **No** | **No** | **Yes** (5 tests) | **No** (Mock I/O only) | Static Code Review (Simulated SSH pool; no real sockets) | **NOT APPROVED** | Uses `MockSshClientPool`; real `ssh2` sockets are not installed. |
| **Cloudflare Workers Provider** | **Yes** | **Yes** | **No** | **No** | **Yes** (6 tests) | **No** (Mock Fetch only) | Manual Security Assessment (Failed validation: `WRK-01`, `API-02`, `API-04`) | **NOT APPROVED** | Retained under Phase 0 Scope Exception; secrets mutate live scripts prematurely (`WRK-01`). |
| **Cloudflare Pages Provider** | **Yes** | **Yes** | **No** | **No** | **Yes** (9 tests) | **No** (Mock Fetch only) | Manual Security Assessment (Failed validation: `API-01`, `PGS-01`, `PGS-02`) | **NOT APPROVED** | Retained under Phase 0 Scope Exception; skips Direct Upload asset negotiation protocol (`API-01`). |
| **Envelope Encryption Service** | **Yes** | **Yes** | **No** | **No** | **Yes** (6 tests) | **Yes** (7 repo tests) | Manual Security Assessment (Failed validation: `SEC-01`, `SEC-02`, `SEC-03`, `SEC-04`) | **NOT APPROVED** | Retained under Phase 0 Scope Exception; uses static HKDF derivation, hardcoded fallback key (`SEC-01`, `SEC-02`). |
| **Secret Redactor** | **Yes** | **Yes** | **No** | **No** | **Yes** (5 tests) | **No** | Static Code Review (Pattern sanitization evaluated) | **NOT ASSESSED** | In-memory regex scrubber for tokens, keys, URLs; functional unit module awaiting formal production assessment. |
| **Build Runner Sandbox** | **Partial** | **No** | **No** | **No** | **Yes** (8 tests) | **No** | Static Code Review (Identified unenforced `eval`; 5 automated tests pending Phase 1) | **NOT APPROVED** | Dockerfiles and parameter validator exist; no package imports or invokes `HardenedBuildRunner`; host Docker Engine controller not implemented. |
| **PostgreSQL Queue Worker** | **No** | **No** | **No** | **No** | **No** | **No** | None (Implementation pending) | **NOT ASSESSED** | PostgreSQL-backed queue — selected architecture, implementation pending (Scheduled for Phase 2). |
| **Core HTTP API Server** | **No** | **No** | **No** | **No** | **No** | **No** | None (Not scaffolded) | **NOT ASSESSED** | NestJS controllers, JWT auth, and routing not yet scaffolded (`apps/api`). |
| **Web Dashboard** | **No** | **No** | **No** | **No** | **No** | **No** | None (Not scaffolded) | **NOT ASSESSED** | React / Vite UI not yet scaffolded (`apps/dashboard`). |
| **AI Investigation Engine** | **No** | **No** | **No** | **No** | **No** | **No** | None (Specification only) | **NOT ASSESSED** | Specification and prompts only ([`docs/ai/`](ai/)); zero implementation code. |

---

## 1. Document Purpose and Maintenance Rules

### 1.1 Purpose
This document is the authoritative, repository-grounded reference for **OpsPilot**. It establishes the complete end-to-end understanding of the platform, including product scope, monorepo architecture, deployment provider adapters, database schema, security boundaries, and technical debt.

Future AI assistants and human engineers must read this document first before proposing, modifying, or auditing code. It eliminates the need to rediscover repository facts, prevents contradictory architectural shifts, and enforces strict operational boundaries.

### 1.2 Maintenance Rules
1. **Repository Ground Truth:** Never document aspirational features as existing code. Every component documented as "implemented" must point to verified source files and passing automated tests.
2. **Current vs. Planned Clarity:** Every architectural diagram, component specification, and capability matrix must explicitly distinguish between **Current Architecture** (verified on disk) and **Planned Architecture** (future roadmap phases).
3. **Relative Path Integrity:** Use repository-relative paths (e.g., `../packages/domain/src/deployment/`) rather than machine-specific absolute paths.
4. **Change Management:** Any modification to this document must be ratified through architectural review. When an implementation phase completes, update the corresponding capability rows and Git state records herein.

---

## 2. Project Identity and Product Vision

### 2.1 Project Identity
- **Project Name:** OpsPilot
- **Repository:** `opspilot`
- **Monorepo Architecture:** Modular Monolith managed via `npm` workspaces and TypeScript Project References
- **Package Scope:** `@opspilot/*`
- **Repository License:** Apache License 2.0 ([`LICENSE`](../LICENSE))
- **Primary Runtime:** Node.js `>=20.0.0` (Verified on `v20.20.2`)
- **Language:** TypeScript 5.x / 7.x (`"strict": true` across all packages)

### 2.2 Product Vision
OpsPilot is an open-source, deployment-aware AI operations platform. It bridges the gap between software delivery (CI/CD) and production operations (telemetry and observability).

Small software engineering teams struggle with fragmented troubleshooting during production outages: correlating errors across disparate cloud consoles, guessing which commit triggered an anomaly, and manually executing rollbacks. OpsPilot unifies deployment tracking with runtime telemetry to:
1. Track and coordinate deployments across heterogeneous infrastructure targets.
2. Maintain durable, immutable deployment history and state transitions in PostgreSQL.
3. Detect anomalous production health degradations immediately following releases.
4. Investigate root causes using a strictly bounded, read-only AI investigation engine.
5. Propose evidence-backed, human-approved remediation pull requests.

---

## 3. Target Customers and Users

### 3.1 Target Profile
- **Team Size:** Small engineering teams consisting of 2 to 20 software engineers.
- **Organizational Context:** Startups, scale-ups, and lean product teams lacking dedicated Platform Engineering, SRE, or 24/7 DevOps personnel.
- **Infrastructure Footprint:** Multi-target or hybrid environments running on AWS (ECS/Fargate), bare-metal/VPS instances (Docker Compose), and Cloudflare edge networks (Workers & Pages).

### 3.2 Key Personas
1. **Product Engineer / Full-Stack Developer:** Needs simple, reliable deployment workflows without managing Kubernetes manifests, Terraform state, or cloud console permissions.
2. **Lead Architect / CTO:** Demands tenant isolation, cryptographically secured credentials, reproducible builds, and an audit trail for all changes.
3. **On-Call Engineer:** Seeks instant correlation between recent deployments and error spikes, fast automated rollbacks, and AI-assisted root-cause hypotheses with verified log citations.

---

## 4. Product Scope and Boundaries

### 4.1 What OpsPilot Owns
- **Deployment Orchestration:** Bounded state machine managing deployment progression (`Queued` → `Preparing` → `Building` → `Publishing` → `Deploying` → `HealthChecking` → `Succeeded` / `RolledBack` / `Failed`).
- **Provider Abstraction:** Unified adapter interfaces decoupling application logic from cloud provider APIs.
- **Tenant Isolation & Security:** Cryptographic envelope encryption of customer credentials, secret redaction in logs, and non-root sandboxed build runner specs.
- **Incident Correlation:** Associating deployment versions with runtime health metrics and telemetry.
- **Audit Trails:** Immutable database logging of all state transitions, deployment events, and provider operations.

### 4.2 External Infrastructure Responsibilities
OpsPilot does **not** provision bare-metal servers or managed cloud resources from scratch. External providers own:
- Underlying compute infrastructure (AWS ECS Clusters, EC2 instances, VPS hardware, Cloudflare global edge).
- Physical networks, VPC routing, DNS nameservers, and TLS certificate authorities.
- Primary container registries (Docker Hub, Amazon ECR, GitHub Container Registry).

### 4.3 What OpsPilot Is Not Intended to Replace
- It is **not** a full cloud provisioning tool like Terraform or OpenTofu.
- It is **not** a heavy enterprise workflow orchestration engine like Temporal.
- It is **not** an autonomous agent with unrestricted production write access (Zero Trust for LLMs).

---

## 5. Supported Infrastructure Providers

OpsPilot is architected from the ground up as a **multi-provider platform**. No single cloud provider is privileged. Four distinct deployment targets are supported:

```mermaid
flowchart TD
    subgraph Core [OpsPilot Application Layer]
        Engine["DeploymentExecutionEngine\n(@opspilot/application)"]
        Registry["DeploymentProviderRegistry\n(@opspilot/deployment-providers)"]
    end

    subgraph Adapters [Provider Adapters (Current Codebase)]
        AWS["AwsEcsProvider\n(Mocked Registry Client)"]
        VPS["VpsDockerProvider\n(Mocked SSH Pool)"]
        CFW["CloudflareWorkersProvider\n(Mocked Fetch Client)"]
        CFP["CloudflarePagesProvider\n(Mocked Fetch Client)"]
    end

    Engine --> Registry
    Registry -. Dispatches to .-> AWS
    Registry -. Dispatches to .-> VPS
    Registry -. Dispatches to .-> CFW
    Registry -. Dispatches to .-> CFP

    classDef mock stroke-dasharray: 5 5;
    class AWS,VPS,CFW,CFP mock;
```

1. **AWS (`aws_ecs`):** Serverless container orchestration on AWS ECS with AWS Fargate. Uses OCI container images, task definitions, and Application Load Balancers (ALBs).
2. **VPS (`vps_docker`):** Cost-effective single-node container deployment over SSH using Docker Engine and Docker Compose.
3. **Cloudflare Workers (`cloudflare_workers`):** Serverless V8 isolate execution at Cloudflare's edge. Deploys bundled ESM scripts with custom bindings (KV, D1, R2).
4. **Cloudflare Pages (`cloudflare_pages`):** Static site and frontend application hosting on Cloudflare's global CDN via asset upload.

---

## 6. Current Feature Implementation Matrix

| Capability Area | Feature | Current Status | Implementing Files / Adapters | Test Coverage |
|---|---|:---:|---|:---:|
| **Identity & Multi-Tenancy** | Database schema (`organizations`, `users`, `org_members`) | **Implemented** | [`../packages/database/src/migrations/0001_initial_schema.sql`](../packages/database/src/migrations/0001_initial_schema.sql) | Verified via real PostgreSQL tests |
| | Repository-level organization scoping (`organization_id`) | **Implemented** | [`../packages/database/src/repositories/`](../packages/database/src/repositories/) | Verified in repo integration tests |
| | Authenticated user session & JWT middleware | **Planned** | Not yet implemented (Scheduled for Phase 3 API) | No tests |
| | Organization membership & RBAC enforcement | **Planned** | Schema tables exist; API authorization middleware pending | No tests |
| **Service Management** | Service domain entity & runtime validations | **Implemented** | [`../packages/domain/src/deployment/entities/service.entity.ts`](../packages/domain/src/deployment/entities/service.entity.ts) | 4 unit tests (`service-entity.spec.ts`) |
| | Service database persistence | **Implemented** | [`../packages/database/src/repositories/services.repository.ts`](../packages/database/src/repositories/services.repository.ts) | Schema verified |
| | Service CRUD HTTP endpoints | **Planned** | Scheduled for Phase 3 API | No tests |
| **Deployment Engine** | Deployment state machine (11 states, strict transitions) | **Implemented** | [`../packages/domain/src/deployment/state-machine/`](../packages/domain/src/deployment/state-machine/) | 6 unit tests (`deployment-state-machine.spec.ts`) |
| | Polymorphic deployment configuration schemas (Zod) | **Implemented** | [`../packages/contracts/src/schemas/deployment.schema.ts`](../packages/contracts/src/schemas/deployment.schema.ts) | 5 unit tests (`deployment-schemas.spec.ts`) |
| | Core execution orchestrator | **Implemented** | [`../packages/application/src/orchestrator/`](../packages/application/src/orchestrator/) | 3 unit tests (`deployment-execution-engine.spec.ts`) |
| | Trigger deployment use case | **Implemented** | [`../packages/application/src/use-cases/trigger-deployment.use-case.ts`](../packages/application/src/use-cases/trigger-deployment.use-case.ts) | 4 unit tests (`use-cases.spec.ts`) |
| | Rollback service use case | **Implemented** | [`../packages/application/src/use-cases/rollback-service.use-case.ts`](../packages/application/src/use-cases/rollback-service.use-case.ts) | Unit tested |
| | Transactional Outbox pattern | **Technical Debt** | Identified in audit (`DEBT-01`); uncoordinated dual write exists | Mocked |
| **AWS ECS Provider** | Provider adapter & capabilities | **Implemented (Mock I/O)** | [`../packages/deployment-providers/src/providers/aws-ecs.provider.ts`](../packages/deployment-providers/src/providers/aws-ecs.provider.ts) | 6 unit tests (uses mock registry) |
| | Real AWS SDK integration (`@aws-sdk/client-ecs`) | **Planned** | Pending external SDK installation and wiring | No live AWS tests |
| **VPS Docker Provider** | Provider adapter & compose generator | **Implemented (Mock I/O)** | [`../packages/deployment-providers/src/providers/vps-docker.provider.ts`](../packages/deployment-providers/src/providers/vps-docker.provider.ts) | 5 unit tests (uses mock SSH pool) |
| | Real SSH2 socket execution | **Planned** | Pending `ssh2` client integration | No live server tests |
| **Cloudflare Workers** | Provider adapter & version upload | **Retained Scope Exception** | [`../packages/deployment-providers/src/providers/cloudflare-workers.provider.ts`](../packages/deployment-providers/src/providers/cloudflare-workers.provider.ts) | 6 unit tests (uses mock API client) |
| | Native Cloudflare v4 REST API client | **Retained Scope Exception** | [`../packages/deployment-providers/src/cloudflare/common/cloudflare-api-client.ts`](../packages/deployment-providers/src/cloudflare/common/cloudflare-api-client.ts) | 7 unit tests (mock fetch, 429 backoff) |
| **Cloudflare Pages** | Provider adapter & Direct Upload protocol | **Retained Scope Exception** | [`../packages/deployment-providers/src/providers/cloudflare-pages.provider.ts`](../packages/deployment-providers/src/providers/cloudflare-pages.provider.ts) | 9 unit tests (uses mock API client) |
| | Pages asset negotiation & Functions compilation | **Missing / Incomplete** | Identified in adversarial audit (`API-01`, `PGS-01`); protocol non-compliant | Unit tests pass only against mock |
| **Security & Vault** | Envelope Encryption Service | **Retained Scope Exception** | [`../packages/security/src/encryption/envelope-encryption.service.ts`](../packages/security/src/encryption/envelope-encryption.service.ts) | 6 unit tests (`envelope-encryption.spec.ts`) |
| | Wrapped-DEK per-record architecture | **Missing (Security Finding)** | Identified in audit (`SEC-01`); uses static HKDF derivation, lacks wrapped DEK | Not implemented |
| | Secret Redactor (regex token & key scrubbing) | **Implemented** | [`../packages/security/src/redactor/secret-redactor.ts`](../packages/security/src/redactor/secret-redactor.ts) | 5 unit tests (`secret-redactor.spec.ts`) |
| | Credential database storage (`integration_credentials`) | **Implemented** | [`../packages/database/src/repositories/integrations.repository.ts`](../packages/database/src/repositories/integrations.repository.ts) | 7 real PostgreSQL tests |
| | Isolated build runner configuration spec | **Implemented** | [`../packages/deployment-providers/src/runners/hardened-build-runner.ts`](../packages/deployment-providers/src/runners/hardened-build-runner.ts) | 8 unit tests (`hardened-build-runner.spec.ts`) |
| | Docker Runner Orchestrator (Docker Engine API) | **Planned** | Scheduled for Phase 1 | No tests |
| **Observability & AI** | Telemetry attribute normalization | **Partial (Edge only)** | [`../packages/deployment-providers/src/cloudflare/observability/`](../packages/deployment-providers/src/cloudflare/observability/) | 5 unit tests (`cloudflare-telemetry-service.spec.ts`) |
| | OpenTelemetry OTLP Collector integration | **Planned** | Specification only ([`docs/architecture/OBSERVABILITY_ARCHITECTURE.md`](architecture/OBSERVABILITY_ARCHITECTURE.md)) | No tests |
| | AI Gateway & LLM client abstraction | **Planned** | Specification only ([`docs/ai/AI_GATEWAY.md`](ai/AI_GATEWAY.md)) | No tests |
| | Read-only AI investigation agent & tool runner | **Planned** | Specification only ([`docs/ai/AGENT_EXECUTION_MODEL.md`](ai/AGENT_EXECUTION_MODEL.md)) | No tests |
| **Application Frontends** | NestJS Core API (`apps/api`) | **Planned** | Manifest workspace configured; directory not yet created | No tests |
| | Vite + React Dashboard (`apps/dashboard`) | **Planned** | Manifest workspace configured; directory not yet created | No tests |
| | Background Worker Process (`apps/workers`) | **Planned** | Manifest workspace configured; directory not yet created | No tests |

---

## 7. Complete Repository Directory Tree

```text
opspilot/
├── AGENTS.md                          # Mandatory agent guidelines and operational specifications
├── CHANGELOG.md                       # Release notes and version change history
├── CODE_OF_CONDUCT.md                 # Contributor Covenant Code of Conduct
├── CONTRIBUTING.md                    # Engineering contribution and workflow guide
├── GOVERNANCE.md                      # Project governance and maintainership policy
├── LICENSE                            # Apache License 2.0 authoritative legal notice
├── package.json                       # Monorepo root manifest (scripts, workspaces, devDeps)
├── package-lock.json                  # Canonical lockfile (npm v10)
├── README.md                          # Public project entry point and overview
├── ROADMAP.md                         # Product delivery milestones
├── SECURITY.md                        # Vulnerability reporting and security disclosure policy
├── SUPPORT.md                         # Community channels and support guidelines
├── tsconfig.json                      # Monorepo root TypeScript configuration (project references)
├── docker/
│   └── runners/                       # Hardened build runner specifications
│       ├── ContainerBuildRunner.Dockerfile  # Alpine container builder (UID 10001)
│       ├── NodeJsBuildRunner.Dockerfile     # Node 20 builder for edge/static (UID 10001)
│       └── scripts/
│           └── build-entrypoint.sh          # Build script for container environments
├── docs/                              # Authoritative documentation suite
│   ├── ai/                            # AI agent specifications, prompts, tools, and evaluation
│   ├── architecture/                  # System architecture, control/execution plane, boundaries
│   ├── decisions/                     # Architecture Decision Records (ADR-0001 to ADR-0018)
│   ├── deployment/                    # Deployment procedures, secrets, rollback specifications
│   ├── development/                   # Local development setup and configuration catalogs
│   ├── engineering/                   # Coding conventions, database design, API contracts
│   ├── integrations/                  # Provider integration specs (AWS, VPS, Cloudflare, GitHub)
│   ├── open-source/                   # Contributor guides and release processes
│   ├── operations/                    # Incident response and troubleshooting runbooks
│   ├── product/                       # Requirements, user flows, personas, MVP scope
│   ├── reference/                     # Configuration reference and error code dictionaries
│   ├── releases/                      # Formal release checklists
│   ├── security/                      # Threat models, credential management, runner security
│   ├── testing/                       # Test strategy and test harness specifications
│   ├── phases/                        # Phased implementation roadmaps and audit acceptance records
│   │   ├── PHASE_0_SCOPE_AND_COMMIT_AUDIT.md
│   │   └── PROJECT_IMPLEMENTATION_ROADMAP.md
│   ├── reports/                       # Foundation audit reports, reviews, and remediation plans
│   │   ├── PROJECT_ARCHITECTURE_FINAL_REVIEW.md
│   │   ├── PROJECT_FOUNDATION_AUDIT.md
│   │   ├── PROJECT_FOUNDATION_DECISIONS.md
│   │   ├── PROJECT_FOUNDATION_RECONCILIATION.md
│   │   └── PROJECT_FOUNDATION_REMEDIATION_PLAN.md
│   ├── PROJECT_CONTEXT.md             # THIS FILE (Canonical reference)
│   └── REPOSITORY_STRUCTURE.md
└── packages/                          # Monorepo packages (TypeScript composite libraries)
    ├── application/                   # Use cases, ports, and execution orchestrator
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── contracts/             # Driving contracts (IDeploymentJobConsumer)
    │   │   ├── orchestrator/          # DeploymentExecutionEngine
    │   │   ├── ports/                 # Driven ports (repository, provider, vault, queue, notification)
    │   │   └── use-cases/             # TriggerDeploymentUseCase, RollbackServiceUseCase
    │   └── tests/                     # Engine and use-case unit tests
    ├── contracts/                     # Shared DTOs, Zod schemas, and public API interfaces
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── src/
    │   │   ├── index.ts
    │   │   └── schemas/               # deployment.schema.ts, cloudflare.schema.ts
    │   └── tests/                     # Schema validation tests
    ├── database/                      # PostgreSQL client, migrations, and repositories
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── db-client.ts           # pg.Pool connection manager with search_path overrides
    │   │   ├── migration-runner.ts    # SQL migration runner
    │   │   ├── migrations/            # 0001_initial_schema.sql, 0001_initial_schema.down.sql
    │   │   └── repositories/          # deployments, integrations, services repositories
    │   └── tests/                     # Migration lifecycle & repository integration tests
    ├── deployment-providers/          # Cloud deployment provider adapters & runners
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── base/                  # BaseDeploymentProvider abstract class
    │   │   ├── cloudflare/            # Cloudflare REST client & telemetry service
    │   │   ├── collaborators/         # SSH pool, container registry, and compose generator
    │   │   ├── interfaces/            # IDeploymentProvider, ILogger
    │   │   ├── providers/             # aws-ecs, vps-docker, cloudflare-workers, cloudflare-pages
    │   │   ├── registry/              # DeploymentProviderRegistry
    │   │   └── runners/               # HardenedBuildRunner parameter validator
    │   └── tests/                     # Provider unit tests
    ├── domain/                        # Pure domain entities, value objects, and state machines
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── src/
    │   │   ├── index.ts
    │   │   └── deployment/            # entities, enums, models, state machine, errors
    │   └── tests/                     # State machine & invariant tests
    └── security/                      # Cryptography, envelope encryption, and secret redactor
        ├── package.json
        ├── tsconfig.json
        ├── src/
        │   ├── index.ts
        │   ├── encryption/            # EnvelopeEncryptionService (HKDF + AES-256-GCM)
        │   └── redactor/              # SecretRedactor (regex scrubber)
        └── tests/                     # Cryptography & redactor tests
```

---

## 8. Package Ownership and Responsibilities

| Package | Ownership & Primary Responsibility | Allowed Imports | Forbidden Imports |
|---|---|---|---|
| **`@opspilot/domain`** | Pure enterprise domain models, enums, exceptions, and the deployment state machine. Contains zero external dependencies. | Node.js built-ins (`crypto`). | Any workspace package; external libraries (`pg`, `zod`, `aws-sdk`, `express`, `nestjs`). |
| **`@opspilot/contracts`** | Shared DTOs and runtime validation schemas (Zod). Acts as the bridge between wire formats and domain models. | `zod`, `@opspilot/domain`. | `@opspilot/database`, `@opspilot/application`, `@opspilot/deployment-providers`. |
| **`@opspilot/security`** | Cryptographic envelope encryption service, AES-256-GCM authenticated encryption, HKDF key derivation, and secret log redaction. | Node.js built-ins (`crypto`), `@opspilot/domain`. | External cloud SDKs, web frameworks, database drivers. |
| **`@opspilot/database`** | PostgreSQL pool management, connection isolation, SQL migrations, and concrete repository persistence. | `pg`, `@types/pg`, `@opspilot/domain`, `@opspilot/security`. | `@opspilot/deployment-providers`, `@opspilot/contracts`, web frameworks. |
| **`@opspilot/application`** | Driving use cases (`TriggerDeploymentUseCase`, `RollbackServiceUseCase`), driven port definitions, and core orchestration (`DeploymentExecutionEngine`). | `@opspilot/domain`, `@opspilot/security`, `@opspilot/contracts`. | Concrete database repositories, concrete provider classes, external cloud SDKs. |
| **`@opspilot/deployment-providers`** | Concrete cloud infrastructure adapters (AWS, VPS, Workers, Pages), registry, and build runner parameter validator. | `@opspilot/domain`, `@opspilot/contracts`, `@opspilot/security`. | `@opspilot/database`, `@opspilot/application` internals. |

---

## 9. Application Architecture

OpsPilot is architected as a **Modular Monolith** adhering to the principles of **Hexagonal Architecture (Ports and Adapters)**.

### Architectural Reality: Composition Roots Not Yet Implemented
Currently, the codebase contains port definitions and concrete adapter implementations, but **no runtime composition root (neither an API server nor a background worker) exists yet** to wire them together. Verification currently occurs via unit test harnesses and integration test fixtures that wire adapters manually.

```mermaid
flowchart TD
    subgraph DrivingLayer [Driving Layer (Inbound Triggers)]
        TestHarness["Test Harness / Scripts\n(Current Verification Wiring)"]
        API["NestJS API Controllers\n(PLANNED - Not Implemented)"]
        Worker["Background Job Worker\n(PLANNED - Not Implemented)"]
    end

    subgraph ApplicationCore [Application Core (@opspilot/application)]
        UseCases["Use Cases:\n- TriggerDeploymentUseCase\n- RollbackServiceUseCase"]
        Engine["DeploymentExecutionEngine"]
        Ports["Driven Ports:\n- IDeploymentRepositoryPort\n- DeploymentProviderPort\n- ISecretVaultPort\n- IJobPublisherPort\n- INotificationPort"]
    end

    subgraph ConcreteAdapters [Concrete Adapters (Code Implemented - Not Composed at Runtime)]
        DB["DeploymentsRepository / IntegrationsRepository\n(@opspilot/database)"]
        Vault["EnvelopeEncryptionService\n(@opspilot/security)"]
        Registry["DeploymentProviderRegistry\n(@opspilot/deployment-providers)"]
        AWS["AwsEcsProvider (Mocked Registry)"]
        VPS["VpsDockerProvider (Mocked SSH)"]
        CFW["CloudflareWorkersProvider (Mocked Fetch)"]
        CFP["CloudflarePagesProvider (Mocked Fetch)"]
    end

    TestHarness --> UseCases
    TestHarness --> Engine
    API -. Planned Inbound .-> UseCases
    Worker -. Planned Inbound .-> Engine

    UseCases --> Ports
    Engine --> Ports

    Ports -. Implemented By (No Runtime Wiring) .-> DB
    Ports -. Implemented By (No Runtime Wiring) .-> Vault
    Ports -. Implemented By (No Runtime Wiring) .-> Registry
    Registry -. Contains .-> AWS
    Registry -. Contains .-> VPS
    Registry -. Contains .-> CFW
    Registry -. Contains .-> CFP

    classDef planned fill:#f9f9f9,stroke:#999,stroke-dasharray: 5 5;
    class API,Worker planned;
```

---

## 10. Dependency Direction and Architectural Boundaries

### 10.1 Dependency Graph (Current Implementation)

```mermaid
graph TD
    subgraph Packages
        Contracts["@opspilot/contracts"]
        Domain["@opspilot/domain"]
        Security["@opspilot/security"]
        Database["@opspilot/database"]
        Providers["@opspilot/deployment-providers"]
        Application["@opspilot/application"]
    end

    Contracts --> Domain
    Security --> Domain
    Database --> Domain
    Database --> Security
    Providers --> Domain
    Providers --> Contracts
    Providers --> Security
    Application --> Domain
    Application --> Contracts
    Application --> Security
```

### 10.2 Boundary Rules
1. **Domain Isolation:** `@opspilot/domain` has **zero** dependencies on any other package.
2. **No Inward Leaks:** `@opspilot/application` does **not** import from `@opspilot/database` or `@opspilot/deployment-providers`. It interacts solely through driven ports (`IDeploymentRepositoryPort`, `DeploymentProviderPort`).
3. **No Circular Dependencies:** Package references in `tsconfig.json` form a strictly acyclic directed graph. TypeScript composite project builds (`tsc -b`) verify this on every compile.
4. **Boundary Verification:** Boundary violations are checked via `.eslintrc.cjs` using `eslint-plugin-import` and `@babel/eslint-parser`.

---

## 11. Deployment Lifecycle

The deployment lifecycle is governed by the formal state machine in [`DeploymentStateMachine`](../packages/domain/src/deployment/state-machine/deployment-state-machine.ts).

### 11.1 Lifecycle States
1. `Queued`: Deployment record created; background job payload emitted.
2. `Preparing`: Provider validates configuration, checks target connectivity, and computes artifact hashes.
3. `Building`: Sandboxed runner builds the OCI image, Worker bundle, or static assets (Specification only; live runner daemon planned for Phase 1).
4. `Publishing`: Artifact verified and pushed to container registry or staged for upload.
5. `Deploying`: Provider dispatches update to target infrastructure (ECS task update, compose restart, Cloudflare version activation).
6. `HealthChecking`: System probes target URL to verify service health.
7. `Succeeded`: Terminal success state; health check verified.
8. `RollingBack`: Initiated automatically upon health check failure (if supported by provider).
9. `RolledBack`: Terminal rollback state; previous version restored.
10. `Failed`: Terminal failure state; deployment aborted or unrecoverable error occurred.
11. `Cancelled`: Terminal state; deployment manually aborted before completion.

### 11.2 Sequence Diagram (Current Code Structure vs. Planned Wiring)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Test Harness / (Planned API)
    participant UC as TriggerDeploymentUseCase
    participant Repo as IDeploymentRepositoryPort (PostgreSQL)
    participant Pub as IJobPublisherPort (Port Only)
    participant Engine as DeploymentExecutionEngine
    participant Provider as DeploymentProviderPort (Adapter)

    Client->>UC: execute(command)
    UC->>Repo: create(deployment [status: Queued])
    Note over UC,Pub: Dual-write risk (DEBT-01): Not in atomic transaction
    UC->>Pub: publishDeploymentJob(payload)
    UC->>Repo: recordEvent(Queued)
    UC-->>Client: Deployment Entity

    Note over Engine: Current state: Engine invoked manually in tests.<br/>Planned state: Background worker consumes job queue.

    Client->>Engine: execute(config, credentials)
    Engine->>Repo: transitionStatus(Queued -> Preparing)
    Engine->>Provider: prepareDeployment(config)
    Provider-->>Engine: PreparedDeployment

    Engine->>Repo: transitionStatus(Preparing -> Building)
    Note over Engine: Live sandboxed container build not yet executing (Phase 1)
    Engine->>Repo: transitionStatus(Building -> Publishing)
    Engine->>Repo: transitionStatus(Publishing -> Deploying)
    Engine->>Provider: deploy(prepared, credentials)
    Provider-->>Engine: DeploymentResult (deployedUrl, versionId)

    Note over Engine,Provider: Reliability Gap (ENG-01): Engine probes immediately without waiting for edge/container stabilization
    Engine->>Repo: transitionStatus(Deploying -> HealthChecking)
    Engine->>Provider: checkHealth(probeTargetUrl)

    alt Health Check Succeeded
        Provider-->>Engine: HealthCheckResult (isHealthy: true)
        Engine->>Repo: transitionStatus(HealthChecking -> Succeeded)
        Engine-->>Client: DeploymentExecutionSummary (Succeeded)
    else Health Check Failed & Auto-Rollback Enabled
        Provider-->>Engine: HealthCheckResult (isHealthy: false)
        Engine->>Repo: transitionStatus(HealthChecking -> RollingBack)
        Engine->>Provider: rollback(deploymentId, previousVersionId)
        Provider-->>Engine: RollbackResult (success: true)
        Note over Engine: Gap (ENG-02): Engine does not re-probe health of restored version
        Engine->>Repo: transitionStatus(RollingBack -> RolledBack)
        Engine-->>Client: DeploymentExecutionSummary (RolledBack)
    else Health Check Failed & No Rollback
        Engine->>Repo: transitionStatus(HealthChecking -> Failed)
        Engine-->>Client: DeploymentExecutionSummary (Failed)
    end
```

---

## 12. AWS Architecture

### 12.1 Implementation Details
- **Provider Class:** [`AwsEcsProvider`](../packages/deployment-providers/src/providers/aws-ecs.provider.ts)
- **Target Provider Key:** `'aws_ecs'`
- **Application Runtime:** `'container'`
- **Build Strategy:** `'dockerfile'`
- **Artifact Type:** `'oci_image'`
- **Capabilities:**
  - `supportsContainers: true`
  - `requiresPortBinding: true`
  - `requiresResourceLimits: true`
  - `supportsInstantRollback: false` (requires full task definition redeployment)

### 12.2 Execution Flow
1. **Prepare:** Validates `AwsEcsDeploymentConfig`, verifies image digest via `IContainerRegistryClient`, and synthesizes AWS ECS Task Definition metadata (`taskFamily`, CPU units, memory limits).
2. **Deploy:** Dispatches service update to ECS cluster with target task definition ARN and returns synthesized ALB endpoint URL.
3. **Status:** Queries ECS service stabilization; checks `runningCount` versus `desiredCount`.
4. **Rollback:** Reverts ECS service to previous Task Definition ARN.
5. **Health Check:** Probes ALB target URL.

### 12.3 Current Reality & Gaps
- **Current Reality:** `AwsEcsProvider` is implemented using simulated collaborators (`MockContainerRegistryClient`) and hardcoded ARN templates (`arn:aws:ecs:us-east-1:123456789012:...`).
- **Gaps:** The real AWS SDK (`@aws-sdk/client-ecs`, `@aws-sdk/client-ecr`, `@aws-sdk/client-sts`) is **not installed** in dependencies. Cross-account IAM role assumption via STS External ID is documented in [`integrations/AWS_INTEGRATION.md`](integrations/AWS_INTEGRATION.md) but not wired to live AWS endpoints.

---

## 13. VPS Architecture

### 13.1 Implementation Details
- **Provider Class:** [`VpsDockerProvider`](../packages/deployment-providers/src/providers/vps-docker.provider.ts)
- **Target Provider Key:** `'vps_docker'`
- **Application Runtime:** `'container'`
- **Build Strategy:** `'dockerfile'`
- **Artifact Type:** `'oci_image'`
- **Capabilities:**
  - `supportsContainers: true`
  - `requiresPortBinding: true`
  - `requiresResourceLimits: true`
  - `supportsInstantRollback: false`

### 13.2 Execution Flow
1. **Prepare:** Validates `VpsDockerDeploymentConfig`, generates standalone `docker-compose.yml` manifest via [`DockerComposeGenerator`](../packages/deployment-providers/src/collaborators/docker-compose-generator.ts), and specifies host artifact path (`/etc/opspilot/{serviceId}/docker-compose.{sha}.yml`).
2. **Deploy:** Executes remote deployment command over SSH (`docker compose -f ... up -d`) using [`ISshClientPool`](../packages/deployment-providers/src/collaborators/ssh-client-pool.interface.ts).
3. **Status:** Inspects container state on host; parses exit code and health status.
4. **Rollback:** Executes `docker compose -f {previousManifest} up -d` over SSH.
5. **Health Check:** Probes host IP and container port.

### 13.3 Current Reality & Gaps
- **Current Reality:** Uses `MockSshClientPool` to simulate SSH command execution in unit tests.
- **Gaps:** Live SSH socket connectivity (`ssh2` library) is **not installed**. Host-level SSH key provisioning, remote directory creation, and non-root Docker socket permissions on target VPS hosts remain unintegrated manual tasks.

---

## 14. Cloudflare Workers Architecture

### 14.1 Implementation Details
- **Provider Class:** [`CloudflareWorkersProvider`](../packages/deployment-providers/src/providers/cloudflare-workers.provider.ts)
- **Target Provider Key:** `'cloudflare_workers'`
- **Application Runtime:** `'v8_isolate'`
- **Build Strategy:** `'cloudflare_worker_bundle'`
- **Artifact Type:** `'worker_bundle'`
- **Capabilities:**
  - `supportsContainers: false`
  - `supportsEdgeFunctions: true`
  - `supportsTrafficWeighting: true`
  - `supportsDirectUpload: true`
  - `supportsInstantRollback: false` (Traffic shift is fast via API, but edge convergence is not instantaneous or sub-second)

### 14.2 Execution Flow
1. **Prepare:** Maps environment variables, KV bindings, D1 databases, and R2 buckets into standard Cloudflare Worker binding structures. Computes SHA-256 digest of ESM bundle.
2. **Deploy:**
   - Synchronizes secret bindings to script via Cloudflare API.
   - Uploads immutable Worker version via `POST /accounts/{id}/workers/scripts/{name}/versions`.
   - Dispatches version deployment with 100% traffic shift via `POST /accounts/{id}/workers/scripts/{name}/deployments`.
3. **Status:** Queries script deployments; verifies edge propagation.
4. **Rollback:** Reallocates 100% traffic to previous version ID via `deployScriptVersion`.
5. **Health Check:** Probes `*.workers.dev` or custom edge domain.

### 14.3 Unresolved Findings & Production Status
- **Status:** **Retained under Phase 0 Scope Exception (`dc80d2a`); NOT approved for production.**
- **Premature Secret Mutation (`WRK-01`):** In `CloudflareWorkersProvider.deploy()`, secrets are synchronized to Cloudflare **before** the new version is uploaded and deployed. If version upload or deployment fails, live production scripts run with un-deployed secret values.
- **Missing Deployment Strategy (`API-02`):** `POST /deployments` payload omits `"strategy": "percentage"`, which is required by Cloudflare's API schema.
- **Rollback Parameter Blocking (`API-04`):** Rollback calls omit `force=true`, causing Cloudflare to reject rollbacks when environment variables or bindings differ between versions.
- **Rollback Latency Reality:** While traffic allocation is a single API call, worldwide propagation across hundreds of Cloudflare edge datacenters takes seconds and has not been verified or benchmarked. It must not be advertised as "sub-second" or "instant".

---

## 15. Cloudflare Pages Architecture

### 15.1 Implementation Details
- **Provider Class:** [`CloudflarePagesProvider`](../packages/deployment-providers/src/providers/cloudflare-pages.provider.ts)
- **Target Provider Key:** `'cloudflare_pages'`
- **Application Runtime:** `'static_cdn'`
- **Build Strategy:** `'static_export'`
- **Artifact Type:** `'pages_manifest'`
- **Capabilities:**
  - `supportsContainers: false`
  - `supportsStaticAssets: true`
  - `supportsDirectUpload: false` (Current code fails to implement the official protocol)
  - `supportsInstantRollback: false` (Deployment alias update is fast, but edge propagation is not sub-second)

### 15.2 Execution Flow & Protocol Non-Compliance
- **Status:** **Retained under Phase 0 Scope Exception (`dc80d2a`); NOT approved for production.**
- **Fictitious Direct Upload Protocol (`API-01`):** In [`CloudflareApiClient.createPagesDirectUploadDeployment`](../packages/deployment-providers/src/cloudflare/common/cloudflare-api-client.ts#L416-L454), all assets are packed into a single multipart `FormData` body sent directly to `POST /accounts/{id}/pages/projects/{name}/deployments`.
  - The **actual Cloudflare Pages Direct Upload protocol** requires:
    1. Requesting an upload JWT (`POST /pages/projects/{name}/upload-token`).
    2. Checking missing asset hashes via `POST /pages/assets/check-missing`.
    3. Uploading only missing binary chunks in batches to `POST /pages/assets/upload`.
    4. Creating the deployment using the verified manifest.
  - The current implementation skips this entire negotiation and will fail on live Cloudflare servers with HTTP 400 Bad Request.
- **Missing Functions Compilation (`PGS-01`):** Full-stack Pages applications with a `/functions` directory require compiling edge functions into `_worker.js`. The current provider only uploads static files from `outputDirectory`; any dynamic API routes will return HTTP 404.
- **Preview Rollback Failure (`PGS-02`):** Cloudflare Pages API only allows rollbacks on production environments. Rollbacks triggered on preview deployments fail with HTTP 400.

---

## 16. Cross-Provider Abstractions

### 16.1 Common Provider Contract
All deployment targets implement [`IDeploymentProvider`](../packages/deployment-providers/src/interfaces/deployment-provider.interface.ts) via [`BaseDeploymentProvider`](../packages/deployment-providers/src/base/base-deployment.provider.ts).

### 16.2 Cross-Provider Comparison Table

| Feature / Dimension | AWS (`aws_ecs`) | VPS (`vps_docker`) | Cloudflare Workers | Cloudflare Pages |
|---|---|---|---|---|
| **Runtime Model** | OCI Container (Docker) | OCI Container (Docker) | V8 Isolate (Serverless) | Static CDN / Edge Assets |
| **Build Strategy** | `dockerfile` | `dockerfile` | `cloudflare_worker_bundle` | `static_export` |
| **Artifact Format** | OCI Image (Registry) | OCI Image (Registry) | ESM JavaScript Bundle | SHA-256 Asset Manifest |
| **Target Binding** | Port, CPU units, RAM | Port, CPU units, RAM | Script Name, Routes | Project Name, Branch |
| **Secrets Delivery** | Env vars & Task Def secrets | Host Env & Compose file | Encrypted Secret Bindings | Environment Variables |
| **Deployment Mechanism** | ECS Task Def Service Update | SSH `docker compose up -d` | Version Upload + Traffic Shift | Direct Upload API |
| **Rollback Mechanism** | Redeploy previous Task Def | Redeploy previous Compose | Traffic shift to previous version | Revert deployment alias |
| **Instant / Sub-second Rollback**| **No** | **No** | **No** (Edge propagation latency) | **No** (Edge propagation latency) |
| **Health Verification** | ALB Target Group Probe | Host Port HTTP Probe | Global Edge URL Probe | Global Edge URL Probe |
| **Current Integration Reality** | Mocked Registry Client | Mocked SSH Pool | Mocked Fetch (API Defects) | Mocked Fetch (Protocol Non-compliant) |
| **Production Approved** | **NO** | **NO** | **NO** | **NO** |

---

## 17. API Architecture and Status

- **Status:** **Planned (Not Implemented)**
- **Scheduled Phase:** Phase 3
- **Framework:** NestJS + TypeScript
- **Target Path:** `apps/api/`
- **Current State:** The workspace `apps/*` is declared in root `package.json`, but `apps/api` has not been scaffolded. Composition roots wiring database repositories to application use cases do not yet exist.

---

## 18. Dashboard Architecture and Status

- **Status:** **Planned (Not Implemented)**
- **Scheduled Phase:** Phase 5
- **Framework:** Vite + React + TypeScript
- **Target Path:** `apps/dashboard/`
- **Current State:** Directory does not exist yet.

---

## 19. Worker and Queue Architecture

### 19.1 Initial Queue Decision
- **Ratified Technology:** **PostgreSQL-backed queue — selected architecture, implementation pending** (Project Foundation Decision 7).
- **Rationale:** Consolidates operational state into a single PostgreSQL container for small engineering teams. Eliminates Redis maintenance overhead.
- **High-Throughput Scale Tier:** BullMQ and Redis are preserved as a future scale tier if queue throughput exceeds 5,000 jobs/minute.

### 19.2 Queue Abstractions vs. Implementation Reality
- **Publisher Port:** [`IJobPublisherPort`](../packages/application/src/ports/job-publisher.port.ts) is an abstract TypeScript interface.
- **Consumer Contract:** [`IDeploymentJobConsumer`](../packages/application/src/contracts/job-consumer.contract.ts) is an abstract interface.
- **Current Reality:** **No background worker process or durable queue daemon exists.** In automated tests, use cases interact with an in-memory mock job publisher.

### 19.3 Planned Reliable Queue Architecture

```mermaid
flowchart TD
    subgraph Transaction [Single Atomic SQL Transaction]
        InsertDep["INSERT INTO deployments\n(status: Queued)"]
        InsertJob["INSERT INTO job_queue\n(type: deploy, state: available)"]
        InsertEvent["INSERT INTO deployment_events\n(stage: Queued)"]
    end

    subgraph WorkerPool [OpsPilot Background Worker Process (PLANNED)]
        Poll["Acquire Job:\nSELECT ... FOR UPDATE SKIP LOCKED\nSET state = 'active', lease_expires_at = NOW() + 5m"]
        Heartbeat["Periodic Lease Renewal\n(Worker Heartbeat)"]
        Process["Invoke IDeploymentJobConsumer\n(DeploymentExecutionEngine)"]
        Complete["SET state = 'completed'\n(or 'failed' on max attempts)"]
    end

    subgraph Reaper [Stranded-Job Reaper (PLANNED)]
        Reap["SELECT FROM job_queue\nWHERE state = 'active' AND lease_expires_at < NOW()\nReset to 'available' or emit alert"]
    end

    InsertDep --> InsertJob --> InsertEvent
    InsertJob -. Available .-> Poll
    Poll --> Process
    Process --> Complete
    Poll --> Heartbeat
    Heartbeat -. Extends Lease .-> Poll
    Reaper -. Recovers Stranded Jobs .-> Poll

    classDef planned fill:#f9f9f9,stroke:#999,stroke-dasharray: 5 5;
    class WorkerPool,Reaper planned;
```

### 19.4 Technical Debt & Reliability Risks
- **Dual-Write Vulnerability (`DEBT-01`):** `TriggerDeploymentUseCase` writes to PostgreSQL and calls `jobPublisher.publishDeploymentJob()` in separate, uncoordinated steps. If the database commit succeeds but the queue call fails, the deployment remains stuck in `Queued` forever. A Transactional Outbox or single-transaction PostgreSQL queue table is mandatory before production.
- **Worker Leases & Heartbeats (`DEBT-02`):** Absence of distributed worker leases allows degraded workers to cause split-brain executions.
- **Abandoned-Job Recovery (`DEBT-03`):** Missing periodic reaper process to detect and reschedule jobs left behind by crashed worker processes.
- **Duplicate Execution Protection (`DEBT-04`):** Worker deduplication tokens and atomic status transition locks are required to prevent parallel executions against cloud APIs.

---

## 20. Database Schema and Relationships

### 20.1 Schema Principles
1. **Durable Authority:** PostgreSQL is the single source of truth for business logic and deployment state.
2. **Tenant Scoping:** Every entity carries a foreign key `organization_id` with `ON DELETE CASCADE`.
3. **Database Driver:** `pg` (node-postgres) with parameterized queries.

### 20.2 Entity-Relationship Diagram (Current Architecture)

```mermaid
erDiagram
    users ||--o{ organization_members : "belongs to"
    organizations ||--o{ organization_members : "has"
    organizations ||--o{ projects : "owns"
    organizations ||--o{ integrations : "configures"
    organizations ||--o{ deployment_targets : "provisions"
    organizations ||--o{ deployments : "executes"
    organizations ||--o{ deployment_events : "records"

    projects ||--o{ services : "contains"
    services ||--o{ deployments : "triggers"
    deployment_targets ||--o{ deployments : "targets"
    deployments ||--o{ deployment_events : "generates"
    integrations ||--|| integration_credentials : "secures"

    users {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar full_name
        boolean is_active
        timestamptz created_at
    }

    organizations {
        uuid id PK
        varchar name
        varchar slug UK
        timestamptz created_at
    }

    organization_members {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        org_role role
        timestamptz created_at
    }

    projects {
        uuid id PK
        uuid organization_id FK
        varchar name
        varchar slug
        text description
        timestamptz created_at
    }

    services {
        uuid id PK
        uuid organization_id FK
        uuid project_id FK
        varchar name
        varchar slug
        varchar repository_name
        varchar branch
        target_provider target_provider
        build_strategy build_strategy
        artifact_type artifact_type
        application_runtime application_runtime
        varchar dockerfile_path
        int container_port
        varchar healthcheck_path
        int cpu_units
        int memory_mb
        jsonb config
        boolean is_active
        timestamptz created_at
    }

    integrations {
        uuid id PK
        uuid organization_id FK
        varchar name
        integration_type type
        varchar status
        jsonb metadata
        timestamptz created_at
    }

    integration_credentials {
        uuid id PK
        uuid organization_id FK
        uuid integration_id FK,UK
        text encrypted_payload
        varchar auth_tag
        varchar initialization_vector
        int key_version
        timestamptz created_at
    }

    deployment_targets {
        uuid id PK
        uuid organization_id FK
        varchar name
        target_provider provider
        jsonb configuration
        timestamptz created_at
    }

    deployments {
        uuid id PK
        uuid organization_id FK
        uuid project_id FK
        uuid service_id FK
        uuid deployment_target_id FK
        target_provider provider
        varchar environment
        varchar commit_sha
        text image_uri
        text artifact_reference
        deployment_status status
        text failure_reason
        timestamptz started_at
        timestamptz completed_at
        uuid triggered_by FK
        timestamptz created_at
    }

    deployment_events {
        bigserial id PK
        uuid organization_id FK
        uuid deployment_id FK
        varchar stage
        text message
        varchar level
        timestamptz timestamp
    }
```

---

## 21. Security Architecture & Threat Model

### 21.1 Cryptographic Implementation vs. NIST SP 800-57 Reality
The codebase implements cryptographic primitives in [`EnvelopeEncryptionService`](../packages/security/src/encryption/envelope-encryption.service.ts). However, **this implementation does not establish NIST SP 800-57 compliance and is NOT approved for production**.

#### Architectural Inconsistencies & Security Findings:
1. **Missing Wrapped-DEK Architecture (`SEC-01`):**
   - *Intended NIST Envelope Encryption:* Every credential record is encrypted using a unique, cryptographically random 256-bit Data Encryption Key (`crypto.randomBytes(32)`). That DEK is then wrapped by the Master Key Encryption Key (KEK), and the `wrapped_dek` is stored alongside the ciphertext in the database.
   - *Current Implementation:* No random DEK is generated per record. Instead, `deriveTenantKey` derives a static key using HKDF (`Buffer.from(crypto.hkdfSync('sha256', this.masterKey, organizationId, info, 32))`). Every credential in that organization is encrypted with the same derived key. Furthermore, the `integration_credentials` table has no `wrapped_dek` column.
2. **Critical Security Finding: Hardcoded Fallback Master Key (`SEC-02`):**
   - In `EnvelopeEncryptionService`:
     ```typescript
     const envKey = process.env.OPSPILOT_MASTER_KEY;
     if (envKey && envKey.length === 64) {
       this.masterKey = Buffer.from(envKey, 'hex');
     } else {
       // CRITICAL FLAW: Deterministic fallback for dev/test environments
       this.masterKey = crypto.createHash('sha256').update('opspilot-default-dev-master-key-2026').digest();
     }
     ```
   - *Why It Matters:* If an operator fails to supply `OPSPILOT_MASTER_KEY`, the application fails to crash. Instead, it quietly encrypts all customer infrastructure secrets using a publicly known key hardcoded in open-source code!
   - *Production Requirement:* **Missing or invalid production key material must fail closed.** In production (`NODE_ENV === 'production'`), the service must throw a fatal startup error and refuse to initialize.
3. **Missing Authenticated Additional Data (`SEC-03`):**
   - Neither `cipher.setAAD()` nor `decipher.setAAD()` is called during AES-256-GCM operations. The ciphertext is not cryptographically bound to `organizationId` or `integrationId`.
4. **Key Rotation Is a Cryptographic No-Op (`SEC-04`):**
   - `rotate()` decrypts the payload and calls `this.encrypt(plaintext, organizationId)`. Because `currentKeyVersion` is hardcoded to 1 and `masterKey` is unchanged, it merely generates a new random IV using the exact same derived key. No key material is rotated.

### 21.2 Secret Redaction
[`SecretRedactor`](../packages/security/src/redactor/secret-redactor.ts) implements regex-based sanitization for bearer tokens, 40-character Cloudflare tokens, private keys, database URLs, and password parameters. It is integrated into `BaseDeploymentProvider` error normalization and `DeploymentExecutionEngine` event logging.

---

## 22. Build Runner Architecture & Threat Boundary

### 22.1 Control Plane vs. Execution Plane Boundary
OpsPilot separates the trusted host orchestrator from untrusted customer build containers:

```mermaid
flowchart TD
    subgraph ControlPlane [Trusted Host Control Plane]
        Orchestrator["Runner Orchestrator (PLANNED)\n(Controls Docker via socket)"]
        Workspace["Isolated Host Directory\n(/var/opspilot/builds/{buildId})"]
    end

    subgraph ExecutionPlane [Untrusted Container Sandbox]
        BuildContainer["Build Runner Container\n(alpine / node20-alpine)\n- UID 10001:10001 (non-root builder)\n- Read-only rootfs\n- CapDrop: ALL\n- No new privileges\n- Memory limit: 2048 MB\n- CPU quota: 1.5 CPUs\n- tmpfs /tmp (512MB)\n- tmpfs /workspace (2048MB)"]
    end

    Orchestrator -- "Creates & Starts (NO docker.sock mount!)" --> BuildContainer
    Orchestrator -- "Mounts host workspace" --> Workspace
    BuildContainer -. "Egress Blocked:\n169.254.169.254 (Cloud Metadata)\nRFC 1918 Private Subnets" .-> Firewall["Egress Filter"]

    classDef planned fill:#f9f9f9,stroke:#999,stroke-dasharray: 5 5;
    class Orchestrator planned;
```

### 22.2 Reassessment of Build-Entrypoint `eval` & Unenforced Boundary Risk
Line 34 of [`../docker/runners/scripts/build-entrypoint.sh`](../docker/runners/scripts/build-entrypoint.sh#L34) executes:
```bash
if [ -n "${OPSPILOT_BUILD_COMMAND:-}" ]; then
  eval "${OPSPILOT_BUILD_COMMAND}"
fi
```

#### Forensic Reality: What the Code Enforces vs. Merely Describes:
1. **What the Code Enforces:**
   - In TypeScript, `HardenedBuildRunner.prepareExecutionSpec()` validates task inputs and rejects forbidden environment variable names (`AWS_SECRET_ACCESS_KEY`, etc.) or forbidden volume mount paths (`/`, `/var/run/docker.sock`).
   - In Dockerfiles, `USER 10001:10001` sets the default user in the image, and `build-entrypoint.sh` checks `if [ "$(id -u)" -eq 0 ]; then exit 1; fi`.
2. **What the Code Merely Describes / Generates (Currently Unenforced):**
   - In `HardenedBuildRunner`, flags such as `--read-only`, `--cap-drop=ALL`, `--security-opt=no-new-privileges:true`, `--pids-limit=256`, and tmpfs mounts are **only pushed into an in-memory string array** (`dockerArgs`).
   - **No host-side runner orchestrator exists.** There is no code in OpsPilot that connects to the Docker Engine daemon (via socket or API) to launch containers with these flags.
   - Network egress blocking rules (`blockedEgressSubnets`: `169.254.169.254/32`, RFC 1918) exist only as array literals in TypeScript; they are not translated into iptables/nftables rules or Docker network options anywhere in the codebase.
   - Therefore, the existence of intended Docker security flags does **not** prove that those controls are enforced at runtime.

#### Objective Risk Classification:
- **Classification:** **UNENFORCED TRUST BOUNDARY / UNVERIFIED SHELL EXECUTION (HIGH ARCHITECTURAL RISK until Phase 1 runner is built and tested).**
- **Rationale:**
  - Arbitrary build command execution (`npm run build`, `vite build`, `cargo build`) is fundamentally necessary for any general-purpose build runner.
  - However, the host cannot be assumed protected when the container isolation controller does not yet exist. If an unhardened container runner is spawned without the intended security flags, arbitrary shell `eval` poses a direct host compromise risk.
  - Conversely, `eval` cannot be classified as a confirmed host escape vulnerability on its own, because inside a properly isolated container, it does not breach Linux namespace or cgroup boundaries.
  - The risk is therefore the **absence of an operational host-side enforcement mechanism** guaranteeing that the boundary is always present.

#### Missing Enforcement & Mandatory Adversarial Testing Requirements (Phase 1):
1. **Missing Enforcement:**
   - Host-side Runner Orchestrator (Docker Engine API / Dockerode client) programmatically enforcing `HostConfig.ReadonlyRootfs = true`, `CapDrop = ['ALL']`, `SecurityOpt = ['no-new-privileges:true']`, and process limits.
   - Linux host network firewall or Docker bridge iptables rules actively dropping egress packets to `169.254.169.254`.
   - Structured command execution: Rather than shell `eval` on an unparsed string, execute commands via structured argument passing (`sh -c "$@"` or array arguments) to eliminate shell parsing hazards.
2. **Mandatory Adversarial Test Suite (Required for Phase 1 Exit):**
   - **Rootfs Write Containment:** Malicious script attempting `touch /etc/compromised` must fail with `Read-only file system` (`EROFS`).
   - **Privilege Escalation Containment:** Malicious script attempting `sudo` or setuid escalation must fail.
   - **Metadata Egress Containment:** Malicious script attempting `curl -m 2 http://169.254.169.254/latest/meta-data/` must time out / be dropped.
   - **Process Table Containment:** Fork bomb attempting to exhaust host PIDs must be terminated by `--pids-limit=256`.
   - **Memory Containment:** Memory bomb attempting to allocate 4 GB must be killed by cgroups OOM without degrading the host.

---

## 23. Observability Architecture

- **Standard:** OpenTelemetry (OTel) semantic conventions ([`ADR-0009`](decisions/ADR-0009-opentelemetry-telemetry-standard.md)).
- **Cloudflare Telemetry Service:** [`CloudflareTelemetryService`](../packages/deployment-providers/src/cloudflare/observability/cloudflare-telemetry.service.ts) implements edge probing, `CF-Ray` header extraction, Error 1101 detection, and Live Tail streaming.
- **Current Limitations:** Observability is currently edge-specific. Centralized OpenTelemetry collectors (OTLP), log aggregation (Loki), and Prometheus metric scraping are planned for Phase 6.

---

## 24. AI Architecture

### 24.1 AI Operating Principles
1. **Zero Trust for LLMs:** The AI model is **never** an authorization authority.
2. **Strictly Read-Only:** The AI investigation agent has **zero write permissions** on databases or cloud infrastructure.
3. **Evidence-Backed Hypotheses:** Every root-cause claim must cite specific redacted log lines, commit diffs, or metric thresholds.
4. **Mandatory Human Gate:** Any remediation patch or rollback must be approved by an engineer via a GitHub pull request or dashboard confirmation ([`ADR-0012`](decisions/ADR-0012-human-approval-gate-for-production-remediation.md)).

### 24.2 Planned AI Investigation Flow

```mermaid
flowchart LR
    Alert["Incident Triggered\n(Error Rate > 5%)"] --> Gateway["AI Gateway\n(Provider Independent)"]
    Gateway --> Agent["Read-Only Investigation Agent"]

    subgraph Tools [Bounded Diagnostic Tools (Read-Only)]
        Logs["Fetch Redacted Logs"]
        Diff["Inspect Commit Diffs"]
        Metrics["Query P99 Latencies"]
    end

    Agent --> Tools
    Tools --> Agent
    Agent --> Report["Root Cause Analysis Report"]
    Report --> Gate{"Human Approval Gate"}
    Gate -->|Approved| PR["Remediation Pull Request"]
    Gate -->|Rejected| Close["Incident Closed"]

    classDef planned fill:#f9f9f9,stroke:#999,stroke-dasharray: 5 5;
    class Alert,Gateway,Agent,Tools,Logs,Diff,Metrics,Report,Gate,PR,Close planned;
```

---

## 25. Authentication and Authorization

### Current Reality vs. Planned Architecture
1. **Database Schema:** Tables `users`, `organizations`, and `organization_members` exist with role enum (`Owner`, `Admin`, `Engineer`, `Viewer`).
2. **Repository Scoping:** Repositories require explicit `organizationId` parameters on queries.
3. **Missing Enforcement (PLANNED):**
   - User identity authentication (JWT tokens, Bcrypt password verification) is **not implemented**.
   - API middleware to validate that user A belongs to organization B is **not implemented**.
   - Role-Based Access Control (RBAC) guards are **not implemented**.
   - **Conclusion:** The database schema is tenant-scoped, but the platform cannot be considered securely multi-tenant until the API layer enforces authentication and authorization in Phase 3.

---

## 26. Integrations and External Dependencies

1. **GitHub App:** Source repository webhooks, commit metadata fetching, and automated remediation PR generation ([`integrations/GITHUB_INTEGRATION.md`](integrations/GITHUB_INTEGRATION.md)). Planned for Phase 3.
2. **AWS:** Cross-account IAM role assumption via STS External ID ([`integrations/AWS_INTEGRATION.md`](integrations/AWS_INTEGRATION.md)). Planned for Phase 4.
3. **VPS:** SSH2 key-based execution for Docker Compose hosts ([`integrations/VPS_INTEGRATION.md`](integrations/VPS_INTEGRATION.md)). Planned for Phase 4.
4. **Cloudflare:** v4 REST API tokens scoped with granular permissions (`Workers Scripts: Edit`, `Pages: Edit`). Retained under Phase 0 scope exception.

---

## 27. Testing Architecture and Verified Results

### 27.1 Test Verification Suite
- **Test Runner:** `vitest` v4.1.12
- **Total Test Suites:** 21 test files
- **Total Tests:** 114 passing tests (0 failures, 0 skipped)
- **Parallel Execution:** Deterministic and verified across multiple consecutive runs.
- **Database Test Isolation:** Dedicated connection pool with `search_path=test_migration_lifecycle` ensures zero interference with parallel tests.

### 27.2 Verified Test Breakdown

| Package | Test File | Test Count | Type | Tested Reality |
|---|---|:---:|:---:|---|
| `contracts` | `deployment-schemas.spec.ts` | 5 | Unit | Zod schema validation & discriminated union narrowing |
| `database` | `migration-lifecycle.spec.ts` | 3 | Integration | Real PostgreSQL connection-isolated schema up/down execution |
| `database` | `deployments-repository.spec.ts` | 8 | Integration | Real PostgreSQL state transitions, events, and idempotency |
| `database` | `integrations-repository.spec.ts` | 7 | Integration | Real PostgreSQL encrypted credential storage and rotation |
| `database` | `container-integrity-constraint.spec.ts` | 5 | Integration | Real PostgreSQL conditional CHECK constraint on services |
| `domain` | `deployment-state-machine.spec.ts` | 6 | Unit | State transition matrix validation and terminal states |
| `domain` | `deployment-config.spec.ts` | 2 | Unit | Polymorphic config type guards |
| `domain` | `service-entity.spec.ts` | 4 | Unit | Service domain invariant enforcement |
| `security` | `envelope-encryption.spec.ts` | 6 | Unit | HKDF key derivation, AES-256-GCM encryption/decryption |
| `security` | `secret-redactor.spec.ts` | 5 | Unit | Redaction of tokens, private keys, connection strings |
| `deployment-providers` | `base-deployment-provider.spec.ts` | 4 | Unit | Tenant isolation validation and error normalization |
| `deployment-providers` | `provider-registry.spec.ts` | 4 | Unit | Multi-provider registration and lookup |
| `deployment-providers` | `hardened-build-runner.spec.ts` | 8 | Unit | Build runner security configs & parameter validation |
| `deployment-providers` | `aws-ecs-provider.spec.ts` | 6 | Unit | AWS ECS provider lifecycle (using Mock Registry) |
| `deployment-providers` | `vps-docker-provider.spec.ts` | 5 | Unit | VPS Docker provider lifecycle (using Mock SSH Pool) |
| `deployment-providers` | `cloudflare-workers-provider.spec.ts` | 6 | Unit | Workers provider lifecycle (using Mock API Client) |
| `deployment-providers` | `cloudflare-pages-provider.spec.ts` | 9 | Unit | Pages Direct Upload lifecycle (using Mock API Client) |
| `deployment-providers` | `cloudflare-api-client.spec.ts` | 7 | Unit | Cloudflare REST client, 429 backoff, error scrubbing |
| `deployment-providers` | `cloudflare-telemetry-service.spec.ts` | 5 | Unit | Edge probing, CF-Ray extraction, error 1101 detection |
| `application` | `deployment-execution-engine.spec.ts` | 3 | Unit | Orchestrator step transitions, rollback, and failures |
| `application` | `use-cases.spec.ts` | 4 | Unit | `TriggerDeploymentUseCase` and `RollbackServiceUseCase` |

---

## 28. CI/CD and Developer Workflows

- **Verification Pipeline:** Run on every pull request via GitHub Actions ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).
- **Build Verification:** `npm run build` (`tsc -b`).
- **Lint Verification:** `npm run lint` (`eslint packages/*/src/**/*.ts`).
- **Test Verification:** `npm test` (`vitest run`).
- **Database Test Suite:** `npm run test:db` (executes against PostgreSQL).

---

## 29. Configuration & Environment Variables Reality

Inspection of actual runtime code reveals that **only two packages currently load environment variables**:

| Variable | Loaded By File | Default / Behavior | Production Requirement |
|---|---|---|---|
| `DATABASE_URL` | [`packages/database/src/db-client.ts`](../packages/database/src/db-client.ts#L5) | Falls back to `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` (defaults to local socket `/var/run/postgresql`) | Must point to a production-grade PostgreSQL 16+ instance. |
| `OPSPILOT_MASTER_KEY` | [`packages/security/src/encryption/envelope-encryption.service.ts`](../packages/security/src/encryption/envelope-encryption.service.ts#L28) | **Critical Finding:** If unset or length != 64, falls back to hardcoded string `'opspilot-default-dev-master-key-2026'` | **Must fail closed.** In production, a missing or invalid 64-hex key must throw a fatal startup error. |

*Note on Provider Credentials:* External cloud credentials (AWS Role ARNs, SSH Private Keys, Cloudflare API Tokens) are **not** read from ambient process environment variables (`AWS_REGION` or `CLOUDFLARE_API_TOKEN`). They are passed as explicit arguments (`credentials: Record<string, unknown>`) retrieved from the encrypted `integration_credentials` database table.

---

## 30. Architecture Decision Records

| ADR | Title | Status | Scope |
|---|---|:---:|---|
| [**ADR-0001**](decisions/ADR-0001-modular-monolith-architecture.md) | Modular Monolith Architecture | **Accepted** | Monorepo Structure |
| [**ADR-0002**](decisions/ADR-0002-postgresql-as-primary-state-store.md) | PostgreSQL as Primary State Store | **Accepted** | Database Authority |
| [**ADR-0003**](decisions/ADR-0003-redis-and-bullmq-for-asynchronous-jobs.md) | Redis and BullMQ for Asynchronous Jobs | **Superseded** | Superseded by Decision 7 (PostgreSQL-backed queue — selected architecture, implementation pending) |
| [**ADR-0004**](decisions/ADR-0004-deployment-provider-abstraction.md) | Deployment Provider Abstraction | **Accepted** | Provider Interface |
| [**ADR-0005**](decisions/ADR-0005-isolated-runners-for-untrusted-builds.md) | Isolated Runners for Untrusted Builds | **Accepted** | Build Security |
| [**ADR-0006**](decisions/ADR-0006-aws-ecs-fargate-deployment.md) | AWS ECS Fargate Deployment Adapter | **Accepted** | AWS Provider |
| [**ADR-0007**](decisions/ADR-0007-vps-docker-compose-deployment.md) | VPS Docker Compose Deployment Adapter | **Accepted** | VPS Provider |
| [**ADR-0008**](decisions/ADR-0008-github-app-for-source-control-integration.md) | GitHub App for Source Control Integration | **Accepted** | GitHub SCM |
| [**ADR-0009**](decisions/ADR-0009-opentelemetry-telemetry-standard.md) | OpenTelemetry Telemetry Standard | **Accepted** | Observability |
| [**ADR-0010**](decisions/ADR-0010-provider-independent-ai-gateway.md) | Provider-Independent AI Gateway | **Accepted** | AI Architecture |
| [**ADR-0011**](decisions/ADR-0011-read-only-ai-investigation-agent.md) | Read-Only AI Investigation Agent | **Accepted** | AI Safety |
| [**ADR-0012**](decisions/ADR-0012-human-approval-gate-for-production-remediation.md) | Human Approval Gate for Production Remediation | **Accepted** | Remediation Safety |
| [**ADR-0013**](decisions/ADR-0013-open-source-license-selection.md) | Open-Source License Selection (Apache-2.0) | **Accepted** | Governance |
| [**ADR-0014**](integrations/cloudflare/CLOUDFLARE_ARCHITECTURE_DECISIONS.md#adr-0014) | Separate Workers and Pages Providers | **Accepted** | Cloudflare |
| [**ADR-0015**](integrations/cloudflare/CLOUDFLARE_ARCHITECTURE_DECISIONS.md#adr-0015) | Direct Upload Strategy for Pages | **Accepted** | Cloudflare |
| [**ADR-0016**](integrations/cloudflare/CLOUDFLARE_ARCHITECTURE_DECISIONS.md#adr-0016) | Node.js Isolated Build Runner for Cloudflare Targets | **Accepted** | Build Security |
| [**ADR-0017**](integrations/cloudflare/CLOUDFLARE_ARCHITECTURE_DECISIONS.md#adr-0017) | Polymorphic Deployment Configuration & Schema Evolution | **Accepted** | Database & Domain |
| [**ADR-0018**](integrations/cloudflare/CLOUDFLARE_ARCHITECTURE_DECISIONS.md#adr-0018) | Cloudflare API Token Scoping & Envelope Encryption | **Accepted** | Security |

---

## 31. Current Technical Debt and Risks

1. **`DEBT-01`: Transactional Outbox / Atomic Persistence:** `TriggerDeploymentUseCase` executes dual writes (database insert + queue publish). Must be consolidated into a single database transaction in Phase 2.
2. **`DEBT-02`: Worker Leases & Heartbeats:** Absence of distributed worker leases allows degraded workers to cause split-brain executions.
3. **`DEBT-03`: Abandoned-Job Recovery:** Missing periodic reaper process to detect and reschedule jobs left behind by crashed worker processes.
4. **`DEBT-04`: Duplicate Execution Protection:** Worker deduplication tokens and atomic status transition locks are required to prevent parallel executions against cloud APIs.
5. **`DEBT-05`: Scope Exceptions Retained:** Commits `bfc941a` (envelope encryption) and `dc80d2a` (Cloudflare providers) are retained as non-production pre-existing work.
6. **`DEBT-06`: Missing Real Cloud SDKs:** AWS ECS and VPS Docker adapters currently rely on mocked collaborators.
7. **`DEBT-07`: Cryptographic Key Management Flaws (`SEC-01`, `SEC-02`):** Missing wrapped DEK architecture and presence of insecure hardcoded fallback master key.

---

## 32. Known Limitations

- **No Live Runner Daemon:** Build runner parameter validation exists, but real Docker container orchestration is not yet active (Phase 1).
- **No HTTP API Server:** Use cases are currently verified via automated unit and integration tests; NestJS HTTP server is planned for Phase 3.
- **No Background Queue Daemon:** Worker processes have not yet been implemented; queue publishing is exercised via mock ports in Phase 0.
- **Single Master Key:** Local KEK provider uses a single 256-bit key; AWS KMS / HashiCorp Vault KEK rotation adapters are planned for future phases.

---

## 33. Planned versus Implemented Capabilities

```text
+-----------------------------------+-----------------------------------+
|            IMPLEMENTED            |              PLANNED              |
+-----------------------------------+-----------------------------------+
| - Monorepo TypeScript References  | - Phase 1: Docker Runner Engine   |
| - Domain State Machine (11 states)| - Phase 2: PostgreSQL Queue (Pending) |
| - PostgreSQL Schema & Repositories| - Phase 2: Transactional Outbox   |
| - Connection-Isolated Test Harness| - Phase 3: NestJS Core HTTP API   |
| - Secret Redaction Scrubber       | - Phase 3: GitHub App Webhooks    |
| - Polymorphic Zod Schemas         | - Phase 4: Production Cloud Adapters|
| - Application Orchestrator Engine | - Phase 5: React / Vite Dashboard |
| - AWS ECS Provider (Mock I/O)     | - Phase 6: OpenTelemetry Pipelines|
| - VPS Docker Provider (Mock I/O)  | - Phase 7: Read-Only AI Agent     |
| - Cloudflare Adapters (Defects)   | - Live AWS SDK & SSH Socket Wire  |
| - Envelope Encryption (Static DEK)| - Distributed Worker Leasing      |
+-----------------------------------+-----------------------------------+
```

---

## 34. Current Git and Repository State

- **Current Branch:** `main`
- **Head Commit:** `f49c686f3afe26ae2e461eb8b6c984a6223d41e4`
- **Commits Ahead of `origin/main`:** Exactly 7 commits:
  1. `9e09237`: `test(database): implement connection-pooled schema isolation for migration lifecycle tests`
  2. `665e02e`: `chore(governance): ratify Apache-2.0 license and establish open-source governance guidelines`
  3. `814c9ba`: `feat(application): scaffold @opspilot/application and migrate deployment orchestrator`
  4. `9463e43`: `chore(ci): configure typescript project references and boundary enforcement`
  5. `bfc941a`: `feat(security): implement NIST SP 800-57 envelope encryption and key wrapping`
  6. `dc80d2a`: `feat(integrations): implement Cloudflare Workers and Pages deployment providers`
  7. `f49c686`: `docs: update deployment orchestrator links to packages/application`
- **Working Tree Status:** **DIRTY (Documentation Work In Progress)**.
  - Modified tracked files: `README.md`, `docs/architecture/ARCHITECTURE_DECISIONS.md`, `docs/decisions/ADR-0003-redis-and-bullmq-for-asynchronous-jobs.md`, `docs/decisions/README.md`, `docs/deployment/LOCAL_DEVELOPMENT.md`, `docs/development/LOCAL_DEVELOPMENT.md`, `docs/integrations/cloudflare/CLOUDFLARE_ADVERSARIAL_AUDIT.md`.
  - Untracked files: `docs/PHASE_0_SCOPE_AND_COMMIT_AUDIT.md`, `docs/PROJECT_CONTEXT.md`.
  - No application code or database migrations are modified.

---

## 35. Current Development Phase and Authorization Boundary

```text
================================================================================
CURRENT BOUNDARY: PHASE 0 IS FORMALLY CLOSED. PHASE 1 HAS NOT BEEN AUTHORIZED.
================================================================================
```

No implementation of product features, Docker runner daemons, cloud SDKs, or background worker processes may begin until explicit authorization is issued by the Project Owner.

---

## 36. How to Run the Project Locally

### Prerequisites
- Node.js `v20.x` LTS
- npm `v10.x`
- PostgreSQL 16+ running locally (`postgresql://postgres:postgres@localhost:5432/postgres`)

### Setup Instructions
```bash
# 1. Clone repository
git clone https://github.com/anwar/OpsPilot.git
cd OpsPilot

# 2. Install dependencies across all workspace packages
npm install

# 3. Build all packages using TypeScript project references
npm run build
```

---

## 37. How to Run Tests and Verification

```bash
# Run entire test suite (21 files, 114 tests)
npm test

# Run database tests against PostgreSQL
npm run test:db

# Run unit tests only
npm run test:unit

# Run security & runner isolation tests
npm run test:security

# Run ESLint architectural boundary checks
npm run lint

# Run full composite typecheck
npm run typecheck
```

---

## 38. How to Add a New Deployment Provider

To add a new cloud or infrastructure deployment target (e.g., Google Cloud Run, Fly.io, Nomad):

1. **Domain Layer (`packages/domain`):**
   - Add new target key to [`TargetProvider`](../packages/domain/src/deployment/enums/target-provider.enum.ts).
   - Define provider-specific configuration interface extending `BaseDeploymentConfig` in [`deployment-config.model.ts`](../packages/domain/src/deployment/models/deployment-config.model.ts).
   - Add capability declaration and type guards.
2. **Contracts Layer (`packages/contracts`):**
   - Add Zod validation schema in [`deployment.schema.ts`](../packages/contracts/src/schemas/deployment.schema.ts).
   - Add schema to the `DeploymentConfigSchema` discriminated union.
3. **Database Migration (`packages/database`):**
   - Add value to `target_provider` Postgres enum in a new migration.
4. **Provider Adapter (`packages/deployment-providers`):**
   - Create `NewProvider` class extending `BaseDeploymentProvider`.
   - Implement `validateConnection`, `prepareDeployment`, `deploy`, `getStatus`, `rollback`, and `checkHealth`.
   - Register provider in [`DeploymentProviderRegistry`](../packages/deployment-providers/src/registry/deployment-provider.registry.ts).
5. **Testing:**
   - Add dedicated provider test suite in `packages/deployment-providers/tests/`.
   - Ensure tenant isolation and error redaction tests pass.

---

## 39. How to Make Architectural Changes Safely

1. **Consult Architecture Decision Records (`docs/decisions/`):** Verify whether the proposed pattern conflicts with existing decisions.
2. **Create or Update an ADR:** Follow [`ADR_TEMPLATE.md`](decisions/ADR_TEMPLATE.md) for any architectural change.
3. **Preserve Inward Dependency Flow:** Never import infrastructure or database packages into domain or application cores.
4. **Verify Boundary Enforcement:** Run `npm run lint` and `npm run build` to verify project references and ESLint boundary rules.
5. **Verify Test Determinism:** Run `npm test` three consecutive times in parallel, followed by sequential verification.

---

## 40. Source-of-Truth Documentation Map

- **Product Vision & Requirements:** [`docs/product/PRODUCT_REQUIREMENTS.md`](product/PRODUCT_REQUIREMENTS.md)
- **Monorepo Structure & Boundaries:** [`docs/REPOSITORY_STRUCTURE.md`](REPOSITORY_STRUCTURE.md) and [`docs/architecture/MODULE_BOUNDARIES.md`](architecture/MODULE_BOUNDARIES.md)
- **Control Plane vs. Execution Plane:** [`docs/architecture/CONTROL_PLANE_AND_EXECUTION_PLANE.md`](architecture/CONTROL_PLANE_AND_EXECUTION_PLANE.md)
- **Deployment Architecture:** [`docs/architecture/DEPLOYMENT_ARCHITECTURE.md`](architecture/DEPLOYMENT_ARCHITECTURE.md)
- **Security & Runner Isolation:** [`docs/security/DEPLOYMENT_RUNNER_SECURITY.md`](security/DEPLOYMENT_RUNNER_SECURITY.md) and [`docs/security/SECURITY_ARCHITECTURE.md`](security/SECURITY_ARCHITECTURE.md)
- **Database Design:** [`docs/engineering/DATABASE_DESIGN.md`](engineering/DATABASE_DESIGN.md)
- **Implementation Roadmap:** [`docs/phases/PROJECT_IMPLEMENTATION_ROADMAP.md`](phases/PROJECT_IMPLEMENTATION_ROADMAP.md)
- **Architecture Decisions:** [`docs/decisions/README.md`](decisions/README.md)
- **Phase 0 Forensic Audit & Acceptance:** [`docs/phases/PHASE_0_SCOPE_AND_COMMIT_AUDIT.md`](phases/PHASE_0_SCOPE_AND_COMMIT_AUDIT.md)

---

## 41. Unresolved Questions and Items Requiring Owner Decisions

1. **Phase 1 Authorization:** When will formal authorization be granted to begin Phase 1 (Production Build Runner Sandbox & Container Isolation)?
2. **Worker Implementation Choice:** For Phase 2 background processing, should OpsPilot implement a custom PostgreSQL `FOR UPDATE SKIP LOCKED` worker or adopt `pg-boss` as the PostgreSQL queue adapter?
3. **Production Cloud Credentials Strategy:** Will AWS ECS production credentials rely exclusively on IAM role assumption (`sts:AssumeRole`), or will static IAM credentials with automatic rotation be supported for hybrid testing?
4. **Production Key Management Service (KMS):** Is local KEK envelope encryption sufficient for v0.1.0, or should managed cloud KMS adapters (AWS KMS, GCP Cloud KMS) be integrated during Phase 2 to resolve `SEC-01` and `SEC-02`?
