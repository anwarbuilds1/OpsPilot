# OpsPilot

[![CI Pipeline](https://github.com/anwar/OpsPilot/actions/workflows/ci.yml/badge.svg)](https://github.com/anwar/OpsPilot/actions)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Status: Foundation Complete / Phase 0 Closed](https://img.shields.io/badge/Status-Foundation%20Complete%20%2F%20Phase%200%20Closed-blue.svg)](docs/phases/PROJECT_IMPLEMENTATION_ROADMAP.md)
[![TypeScript: 5.x / 7.x](https://img.shields.io/badge/TypeScript-5.x%20%2F%207.x-blue.svg)](https://www.typescriptlang.org/)
[![Node: >=20.0.0](https://img.shields.io/badge/Node-%3E%3D20.0.0-green.svg)](https://nodejs.org/)

> **A deployment-aware operations platform designed for small engineering teams.**
> *Targeting unified deployment tracking across multi-cloud and edge infrastructure, runtime anomaly detection, and controlled, read-only AI-assisted incident investigation.*

OpsPilot is an open-source, deployment-aware AI operations platform being built for small software engineering teams (2–20 engineers). Its goal is to bridge the gap between software delivery (CI/CD) and production operations (telemetry and observability) into a single cohesive control plane.

> [!IMPORTANT]
> **Project Status (November 2026):** OpsPilot is currently in the **Foundation Complete** stage (**Phase 0 is formally closed; Phase 1 is awaiting authorization**). Core domain entities, data schemas, validation contracts, and provider adapter abstractions are implemented and tested, but **the platform is not yet approved for production use**. Background job workers, HTTP API servers, real cloud SDK wiring, and AI investigation agents are planned for subsequent phases.

---

## 1. What OpsPilot Is

OpsPilot is designed as a centralized control plane to orchestrate application deployments across heterogeneous infrastructure targets and correlate those releases with live production telemetry.

Rather than forcing engineers to navigate disconnected cloud consoles and monitoring dashboards, OpsPilot maintains an immutable, tenant-scoped record of every release in PostgreSQL, enforces a formal 11-stage deployment state machine, coordinates post-deployment health verification, and is designed to provide evidence-backed root cause analysis when deployments fail.

---

## 2. The Problem It Solves

Small engineering teams rarely have dedicated Platform Engineering or 24/7 Site Reliability Engineering (SRE) staff. When production incidents occur following a release, engineers are forced to scramble across disparate systems:
- Reviewing recently merged GitHub pull requests and commit diffs.
- Checking AWS CloudWatch logs, Cloudflare dashboards, or logging into VPS instances via SSH.
- Correlating elevated 500 error rates with CPU/memory spikes and container health status.
- Manually diagnosing whether an incident was caused by configuration drift, a bad code commit, or infrastructure outages.

This fragmented troubleshooting process wastes critical engineering hours, increases Mean Time to Resolution (MTTR), and leads to high-stress debugging sessions.

---

## 3. Who It Is For

- **Startups & Scale-ups:** Fast-moving engineering teams without dedicated DevOps personnel who need structured deployment tracking and safety guardrails.
- **Full-Stack Engineers:** Developers seeking simple, reliable deployments across cloud and edge targets without wrestling with raw Kubernetes manifests, Terraform state locks, or complex cloud consoles.
- **On-Call Engineers:** Teams wanting direct correlation between deployment events and error spikes, fast rollbacks, and AI-assisted investigation citing verified log lines.

---

## 4. Supported Infrastructure & Deployment Targets

OpsPilot is architected from the ground up as a **multi-provider platform**. No single cloud provider is privileged. Four distinct deployment targets are supported by the provider architecture:

| Target Provider | Execution & Runtime Model | Packaging / Artifact | Rollback Mechanism | Health Check Method | Implementation Maturity |
|---|---|---|---|---|---|
| **AWS ECS Fargate** (`aws_ecs`) | OCI Containers on AWS Fargate | Docker Image (ECR/Registry) | Revert ECS Task Definition | ALB Target Group Probe | Implemented with simulated I/O (`MockContainerRegistryClient`); real AWS SDK pending Phase 4. |
| **VPS Docker** (`vps_docker`) | Single-Host Docker Engine via SSH | Docker Compose Manifest | Reapply previous Compose manifest | Host IP & Port HTTP Probe | Implemented with Compose generator and `MockSshClientPool`; live `ssh2` sockets pending Phase 4. |
| **Cloudflare Workers** (`cloudflare_workers`) | V8 Isolate Serverless Edge | Bundled ESM JavaScript | Version traffic shift via API | Global Edge URL Probe | Pre-existing adapter retained under Phase 0 scope exception; unresolved secret-mutation ordering findings (`WRK-01`). |
| **Cloudflare Pages** (`cloudflare_pages`) | Global Edge CDN & Static Assets | SHA-256 Asset Manifest | Revert deployment alias | Published Pages URL Probe | Pre-existing adapter retained under Phase 0 scope exception; Direct Upload protocol non-compliant (`API-01`). |

---

## 5. System Architecture

OpsPilot follows a **Modular Monolith** architecture with strict **Hexagonal (Ports and Adapters)** boundaries:

```mermaid
flowchart TD
    subgraph DrivingLayer ["Client & Trigger Layer"]
        TestHarness["Test Harness / Scripts\n(Current Verification Wiring)"]
        API["NestJS API Layer\n(PLANNED - Phase 3)"]
        Queue["PostgreSQL-Backed Queue\n(Selected Architecture, Implementation Pending)"]
    end

    subgraph ApplicationCore ["Application Core (@opspilot/application)"]
        UseCases["Use Cases:\n- TriggerDeploymentUseCase\n- RollbackServiceUseCase"]
        Engine["DeploymentExecutionEngine\n(11-Stage State Machine Orchestrator)"]
        Ports["Driven Ports:\n- IDeploymentRepositoryPort\n- DeploymentProviderPort\n- ISecretVaultPort\n- IJobPublisherPort"]
    end

    subgraph Adapters ["Infrastructure & Provider Adapters (Code Implemented)"]
        DB["PostgreSQL Repositories\n(@opspilot/database)"]
        Security["Envelope Encryption Service\n(@opspilot/security)"]
        AWS["AwsEcsProvider (Mock I/O)"]
        VPS["VpsDockerProvider (Mock I/O)"]
        CFW["CloudflareWorkersProvider (Mock Fetch)"]
        CFP["CloudflarePagesProvider (Mock Fetch)"]
    end

    TestHarness --> UseCases
    TestHarness --> Engine
    API -. Planned Inbound .-> UseCases
    Queue -. Planned Inbound .-> Engine

    UseCases --> Ports
    Engine --> Ports

    Ports -.->|"Implemented By (No Runtime Wiring)"| DB
    Ports -.->|"Implemented By (No Runtime Wiring)"| Security
    Ports -.->|"Implemented By (No Runtime Wiring)"| AWS
    Ports -.->|"Implemented By (No Runtime Wiring)"| VPS
    Ports -.->|"Implemented By (No Runtime Wiring)"| CFW
    Ports -.->|"Implemented By (No Runtime Wiring)"| CFP

    classDef planned fill:#f9f9f9,stroke:#999,stroke-dasharray: 5 5;
    class API,Queue planned;
```

---

## 6. Core Capabilities: Implemented vs. Planned

To maintain strict engineering accuracy, platform capabilities are classified by their actual verified repository state:

### Implemented in Code
- **Domain State Machine:** 11-stage deterministic state machine with strict transition and terminal state validation ([`DeploymentStateMachine`](packages/domain/src/deployment/state-machine/deployment-state-machine.ts)).
- **Application Orchestration Engine:** Procedural step-by-step orchestrator handling preparation, building, publishing, deploying, health probing, and rollback calls ([`DeploymentExecutionEngine`](packages/application/src/orchestrator/deployment-execution-engine.ts)).
- **Database Schema & Repositories:** PostgreSQL migration (`0001_initial_schema.sql`) and repositories for deployments, services, and integrations with tenant scoping ([`packages/database`](packages/database/)).
- **Secret Redaction:** Regex-based sanitization for bearer tokens, private keys, database URLs, and password assignments ([`SecretRedactor`](packages/security/src/redactor/secret-redactor.ts)).
- **Polymorphic Contracts:** Zod schemas and TypeScript discriminated unions for multi-target deployment configurations ([`packages/contracts`](packages/contracts/)).

### Mocked / Simulated / Retained Exceptions (Not Production Approved)
- **AWS ECS Provider:** Adapter logic implemented but uses `MockContainerRegistryClient`; live AWS SDK is not installed.
- **VPS Docker Provider:** Adapter logic and Docker Compose generator implemented but uses `MockSshClientPool`; live `ssh2` sockets are not installed.
- **Cloudflare Providers:** Implemented but retained under Phase 0 scope exceptions; adversarial audit revealed protocol deviations (`API-01`), secret ordering risks (`WRK-01`), and missing functions compilation (`PGS-01`).
- **Envelope Encryption Service:** Implemented using `node:crypto` HKDF and AES-256-GCM, but uses static tenant derivation rather than random per-record DEKs, and contains an insecure hardcoded dev fallback key (`SEC-01`, `SEC-02`).

### Planned (Not Yet Implemented)
- **Production Build Runner:** Host-side Docker Engine orchestrator for isolated container builds (Phase 1).
- **Asynchronous Queue Worker:** PostgreSQL-backed queue — selected architecture, implementation pending. Background worker daemon and Transactional Outbox are scheduled for Phase 2.
- **Core HTTP API:** NestJS controllers, JWT authentication, and request authorization middleware (Phase 3).
- **Web Dashboard:** Vite + React frontend for deployment monitoring and incident visualization (Phase 5).
- **Centralized Observability:** OpenTelemetry OTLP collectors, log aggregation, and Prometheus metrics (Phase 6).
- **AI Investigation Engine:** Read-only AI agent and human approval remediation workflow (Phase 7).

---

## 7. How Deployments Work at a High Level

1. **Trigger:** A deployment command is validated via Zod schemas against [`DeploymentConfig`](packages/domain/src/deployment/models/deployment-config.model.ts).
2. **Queued:** A record is created in PostgreSQL with status `Queued`, and a job payload is emitted via [`IJobPublisherPort`](packages/application/src/ports/job-publisher.port.ts) (PostgreSQL-backed queue — selected architecture, implementation pending).
3. **Preparing:** The provider validates credentials and prepares artifacts (verifying image digests, generating compose manifests, or computing asset hashes).
4. **Building & Publishing:** Build runners execute immutable builds and stage artifacts (Specification implemented; live daemon planned for Phase 1).
5. **Deploying:** The provider adapter dispatches update commands to the target infrastructure (updating ECS task definitions, executing compose up, or shifting edge traffic).
6. **Health Checking:** Synthetic HTTP health checks probe the deployment endpoint.
7. **Resolution:**
   - If healthy: Transitions to `Succeeded`.
   - If unhealthy and rollback is supported: Initiates automated `RollingBack` to previous version, terminating in `RolledBack`.
   - If unrecoverable: Transitions to `Failed` with redacted error diagnostics.

---

## 8. Technology Stack

- **Monorepo:** `npm` workspaces with TypeScript Project References (`tsc -b`).
- **Language:** TypeScript 5.x / 7.x (`strict: true`).
- **Database:** PostgreSQL 16+ (tested against PostgreSQL 18.6) via `pg` (node-postgres).
- **Validation:** Zod 3.x for runtime DTO contracts and discriminated unions.
- **Cryptography:** Node.js native `crypto` (HKDF, AES-256-GCM).
- **Testing:** Vitest 4.x with connection-pooled schema isolation.
- **Linting & Boundaries:** ESLint 8.x with `eslint-plugin-import` and `@babel/eslint-parser`.
- **Planned Stack:**
  - API: NestJS (`apps/api`).
  - Frontend: Vite + React + TypeScript (`apps/dashboard`).
  - Asynchronous Queue: PostgreSQL-backed queue — selected architecture, implementation pending (`pg-boss` or custom `SKIP LOCKED` worker per Decision 7 scheduled for Phase 2).

---

## 9. Repository Structure

```text
packages/
├── domain/                # Pure domain entities, state machine, enums (Zero dependencies)
├── contracts/             # Zod validation schemas and shared DTOs
├── security/              # Envelope encryption and secret redaction
├── database/              # PostgreSQL client, migrations, and tenant-scoped repositories
├── application/           # Use cases, ports, and DeploymentExecutionEngine orchestrator
└── deployment-providers/  # AWS, VPS, Cloudflare Workers, and Cloudflare Pages adapters
```

For complete details on package boundaries and dependency rules, consult [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md).

---

## 10. Getting Started (Development Setup)

### Prerequisites
- **Node.js:** `v20.x` LTS or later
- **npm:** `v10.x` or later
- **PostgreSQL:** Version 16+ running locally on port 5432 (default: `postgresql://postgres:postgres@localhost:5432/postgres`)

### Setup Instructions
```bash
# 1. Clone the repository
git clone https://github.com/anwar/OpsPilot.git
cd OpsPilot

# 2. Install workspace dependencies
npm install

# 3. Build all packages using TypeScript project references
npm run build
```

---

## 11. Configuration & Environment Requirements

Environment variables currently loaded by the runtime codebase:

| Variable | Loaded By | Default / Fallback | Notes & Security Requirements |
|---|---|---|---|
| `DATABASE_URL` | [`packages/database`](packages/database/src/db-client.ts) | Local Unix socket (`/var/run/postgresql`) | PostgreSQL connection string |
| `OPSPILOT_MASTER_KEY` | [`packages/security`](packages/security/src/encryption/envelope-encryption.service.ts) | Hardcoded dev fallback (Known flaw `SEC-02`) | 64-char hex string (256 bits). **Must fail closed in production.** |

*Note on Provider Credentials:* External cloud credentials (AWS Role ARNs, SSH Private Keys, Cloudflare API Tokens) are **not** read from process environment variables. They are passed as explicit arguments retrieved from the encrypted `integration_credentials` database table.

---

## 12. Running Tests

The test suite runs 21 test files with 114 deterministic tests:

```bash
# Run all unit and integration tests (parallel by default)
npm test

# Run database tests against PostgreSQL
npm run test:db

# Run unit tests only
npm run test:unit

# Run security and build runner isolation tests
npm run test:security

# Run ESLint architectural boundary checks
npm run lint

# Run TypeScript project reference typecheck
npm run typecheck
```

---

## 13. Security Model & Current Limitations

### Security Principles
1. **Multi-Tenant Isolation:** Database queries and mutations require explicit `organization_id` parameters (API-level JWT session enforcement planned for Phase 3).
2. **Zero Trust for LLMs:** AI operations are strictly read-only. No AI agent can execute unreviewed mutations or rollbacks.
3. **Secret Redaction:** Logs, events, and error messages are sanitized before emission or ingestion.

### Current Limitations & Known Flaws
- **Cryptographic Key Management (`SEC-01`, `SEC-02`):** `EnvelopeEncryptionService` uses static HKDF derivation instead of random per-record DEKs, and contains an insecure hardcoded fallback master key. Not approved for production.
- **Mock Collaborators:** AWS ECS and VPS Docker providers currently use mock collaborators; live AWS SDK and live SSH socket wiring are scheduled for Phase 4.
- **Docker Daemon Runner:** Hardened build runner specifications are validated in code; host-side Docker daemon container orchestration is scheduled for Phase 1.
- **Transactional Outbox (`DEBT-01`):** Background jobs and database mutations currently execute in two separate steps; atomic single-transaction persistence is scheduled for Phase 2.

---

## 14. Current Development Status & Roadmap

OpsPilot is currently in the **Foundation Complete** stage. **Phase 0 is formally closed**, and Phase 1 is awaiting project owner authorization.

- **Phase 0 (Closed):** Engineering foundation, schema-isolated test harness, application package scaffolding, TypeScript project references, and Apache-2.0 governance.
- **Phase 1 (Pending Authorization):** Production Build Runner Sandbox & Container Isolation.
- **Phase 2 (Planned):** PostgreSQL-backed queue — selected architecture, implementation pending; Transactional Outbox and worker reliability.
- **Phase 3 (Planned):** NestJS Core Application API & Multi-Tenant Authentication.
- **Phase 4 (Planned):** Production Cloud Deployment Adapters (AWS, VPS, Cloudflare).
- **Phase 5 (Planned):** Vite + React Web Dashboard.
- **Phase 6 (Planned):** OpenTelemetry Telemetry Pipeline & Anomaly Ingestion.
- **Phase 7 (Planned):** Read-Only AI Investigation Engine & Human Approval Gate.

For detailed milestone breakdowns, see [`docs/phases/PROJECT_IMPLEMENTATION_ROADMAP.md`](docs/phases/PROJECT_IMPLEMENTATION_ROADMAP.md).

---

## 15. Documentation Suite

- [**Canonical Project Context**](docs/PROJECT_CONTEXT.md) — Comprehensive 41-section engineering reference.
- [**Phase 0 Scope & Commit Audit**](docs/phases/PHASE_0_SCOPE_AND_COMMIT_AUDIT.md) — Formal audit report ratifying Phase 0 acceptance.
- [**System Architecture**](docs/architecture/SYSTEM_ARCHITECTURE.md) — Architectural patterns and boundaries.
- [**Architecture Decision Records (ADRs)**](docs/decisions/README.md) — Formal ADR index (ADR-0001 to ADR-0018).
- [**Security Architecture**](docs/security/SECURITY_ARCHITECTURE.md) — Threat models and cryptography standards.

---

## 16. Contributing

We welcome contributions from systems engineers, platform developers, and security practitioners! Please review:
- [**Contributing Guide**](CONTRIBUTING.md)
- [**Code of Conduct**](CODE_OF_CONDUCT.md)
- [**Security Policy**](SECURITY.md)

---

## 17. License

OpsPilot is open-source software licensed under the **Apache License 2.0 (`Apache-2.0`)**. See the [`LICENSE`](LICENSE) file for the full license text.
