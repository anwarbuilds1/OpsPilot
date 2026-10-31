# Engineering Implementation Plan

> **Status:** Authoritative Execution Roadmap  
> **Sequence:** Phase 0 through Phase 8

This document translates the OpsPilot Product Requirements Document and Technical Architecture into an ordered, actionable engineering implementation plan. Each task includes dependencies, affected modules, acceptance criteria, and testing requirements.

---

## Phase 0: Architecture & Foundation Bootstrap

### Task 0.1: Monorepo & Workspaces Configuration
- **Task ID:** `FOUND-01`
- **Objective:** Configure npm/pnpm workspaces for `apps/api`, `apps/dashboard`, `apps/workers`, and `packages/*`. Set up unified TypeScript configuration (`tsconfig.base.json`), ESLint, and Prettier.
- **Dependencies:** None.
- **Affected Paths:** `package.json`, `tsconfig.json`, `apps/*`, `packages/*`.
- **Acceptance Criteria:** `npm install` installs dependencies across all packages; `npm run typecheck` succeeds.
- **Definition of Done:** Monorepo builds cleanly; CI workflow validates workspace integrity.

### Task 0.2: Local Development Docker Services
- **Task ID:** `FOUND-02`
- **Objective:** Create `docker/docker-compose.dev.yml` provisioning PostgreSQL 16 (port 5432) and Redis 7 (port 6379) with health checks.
- **Dependencies:** `FOUND-01`.
- **Affected Paths:** `docker/docker-compose.dev.yml`, `.env.example`.
- **Acceptance Criteria:** `docker compose -f docker/docker-compose.dev.yml up -d` starts both services in healthy state.
- **Definition of Done:** Documented in `DEVELOPMENT_SETUP.md` and verified.

---

## Phase 1: Multi-Tenant Platform & Core Auth

### Task 1.1: PostgreSQL Schema & Database Package
- **Task ID:** `AUTH-01`
- **Objective:** Implement PostgreSQL schema defined in `DATABASE_DESIGN.md` using Prisma/Kysely. Include migrations for `users`, `organizations`, `organization_members`, and `audit_logs`.
- **Dependencies:** `FOUND-02`.
- **Affected Paths:** `packages/database/`.
- **Acceptance Criteria:** Migrations run cleanly (`npm run db:migrate:up`); rollback script verified.
- **Testing:** Unit tests verifying schema constraints and unique indices.

### Task 1.2: Authentication & RBAC Service
- **Task ID:** `AUTH-02`
- **Objective:** Implement `AuthModule` and `OrganizationsModule` in `apps/api`. Support user registration, password hashing (bcrypt), JWT issuance, and RBAC guards.
- **Dependencies:** `AUTH-01`.
- **Affected Paths:** `apps/api/src/modules/auth/`, `apps/api/src/modules/organizations/`.
- **Acceptance Criteria:** Endpoints `POST /auth/register` and `POST /auth/login` issue valid JWTs; RBAC guards enforce role permissions (Owner, Admin, Engineer, Viewer).
- **Testing:** Unit tests for password validation; integration tests for JWT issuance and tenant access rejection.

---

## Phase 2: Deployment Foundation & Build Runner

### Task 2.1: Deployment Domain & State Machine
- **Task ID:** `DEP-01`
- **Objective:** Define deployment entities, value objects, and the deployment state machine in `packages/domain` and `apps/api/src/modules/deployments`.
- **Dependencies:** `AUTH-02`.
- **Affected Paths:** `packages/domain/`, `apps/api/src/modules/deployments/`.
- **Acceptance Criteria:** Validates allowed state transitions (e.g., Queued -> Preparing -> Building -> Succeeded); rejects invalid transitions (e.g., Queued -> Succeeded).
- **Testing:** Exhaustive state machine transition unit tests.

### Task 2.2: Ephemeral Docker Build Runner
- **Task ID:** `DEP-02`
- **Objective:** Create the isolated build runner container (`docker/build-runner.Dockerfile`) capable of cloning a repo at a commit SHA, building a Docker image as non-root, and pushing to a registry.
- **Dependencies:** `DEP-01`.
- **Affected Paths:** `docker/build-runner.Dockerfile`, `apps/workers/deployment-worker/`.
- **Acceptance Criteria:** Runner builds sample Dockerfile within resource limits; captures stdout/stderr logs; terminates on timeout.
- **Testing:** Integration test executing a dummy container build inside a Docker-in-Docker or Testcontainers environment.

---

## Phase 3: Cloud & Bare-Metal Deployment Adapters

### Task 3.1: Deployment Provider Interface & Factory
- **Task ID:** `PROV-01`
- **Objective:** Implement the `DeploymentProvider` interface in `packages/deployment-providers`.
- **Dependencies:** `DEP-01`.
- **Affected Paths:** `packages/deployment-providers/src/provider.interface.ts`.
- **Acceptance Criteria:** Clear contract for `validateConnection`, `deploy`, `getStatus`, `rollback`, and `checkHealth`.

### Task 3.2: AWS ECS Fargate Adapter (`AwsEcsProvider`)
- **Task ID:** `PROV-02`
- **Objective:** Implement AWS ECS deployment adapter using `@aws-sdk/client-ecs`, `@aws-sdk/client-sts`, and `@aws-sdk/client-cloudwatch`.
- **Dependencies:** `PROV-01`.
- **Affected Paths:** `packages/deployment-providers/src/aws-ecs/`.
- **Acceptance Criteria:** Assumes cross-account role with External ID; registers Task Definition revision; updates ECS service; polls steady state.
- **Testing:** Integration tests against mocked AWS SDK v3 responses.

### Task 3.3: VPS Docker Compose Adapter (`VpsDockerProvider`)
- **Task ID:** `PROV-03`
- **Objective:** Implement VPS deployment adapter using SSH (via `ssh2`) to manage Docker Compose manifests and local backups.
- **Dependencies:** `PROV-01`.
- **Affected Paths:** `packages/deployment-providers/src/vps-docker/`.
- **Acceptance Criteria:** Verifies Docker on host; uploads compose file; executes `docker compose up -d`; creates `docker-compose.yml.backup` for instant rollback.
- **Testing:** Integration test against an ephemeral local SSH container.

---

## Phase 4: Observability & Incident Detection

### Task 4.1: Health Check Prober & Telemetry Worker
- **Task ID:** `OBS-01`
- **Objective:** Build `telemetry-worker` executing periodic HTTP GET probes against service health endpoints every 30 seconds.
- **Dependencies:** `DEP-01`.
- **Affected Paths:** `apps/workers/telemetry-worker/`, `apps/api/src/modules/observability/`.
- **Acceptance Criteria:** Records response code and latency in partitioned `health_checks` table; emits `telemetry.health_check_failed` on non-200 responses.
- **Testing:** Unit tests for probe timing; integration test verifying partition write performance.

### Task 4.2: Automated Incident Creation & Deduplication
- **Task ID:** `INC-01`
- **Objective:** Implement `IncidentsModule` listening for threshold breach events; deduplicates active alerts; creates incident records and correlates recent deployments.
- **Dependencies:** `OBS-01`.
- **Affected Paths:** `apps/api/src/modules/incidents/`.
- **Acceptance Criteria:** 3 consecutive probe failures trigger incident creation (Severity: Critical); links deployments completed within prior 2 hours; assembles timeline.
- **Testing:** Test scenario verifying alert coalescing and flapping prevention.

---

## Phase 5: AI Incident Investigation Agent

### Task 5.1: Provider-Independent AI Gateway
- **Task ID:** `AI-01`
- **Objective:** Build `packages/ai-gateway` wrapping Gemini, Claude, and OpenAI SDKs behind a unified interface with Zod schema validation and token tracking.
- **Dependencies:** `INC-01`.
- **Affected Paths:** `packages/ai-gateway/`.
- **Acceptance Criteria:** Supports model parameter configuration, structured JSON outputs, and tool schema translation.
- **Testing:** Unit tests validating Zod response schema enforcement.

### Task 5.2: Read-Only Investigation Tools Sandbox
- **Task ID:** `AI-02`
- **Objective:** Implement all 9 read-only diagnostic tools (`get_application_logs`, `query_metrics`, `get_recent_commits`, etc.) with strict tenant boundary enforcement and secret scrubbing.
- **Dependencies:** `AI-01`.
- **Affected Paths:** `apps/api/src/modules/ai-investigation/tools/`.
- **Acceptance Criteria:** Tools enforce 500-line limits; scrub AWS keys and bearer tokens; verify caller organization ID.
- **Testing:** Unit tests verifying regex secret masking; integration tests verifying cross-tenant access rejection.

### Task 5.3: Bounded Investigation Orchestrator
- **Task ID:** `AI-03`
- **Objective:** Implement the multi-turn investigation loop in `apps/workers/ai-worker`. Enforce maximum 10 tool calls, 180s timeout, and format final diagnostic report.
- **Dependencies:** `AI-02`.
- **Affected Paths:** `apps/workers/ai-worker/`.
- **Acceptance Criteria:** Agent stops upon hypothesis confirmation or tool limit; outputs structured report with Observations, Probable Cause, and Evidence.
- **Testing:** Verification against the 15 simulated failure scenarios in `INCIDENT_SIMULATOR.md`.

---

## Phase 6: Human Approval & Remediation Workflows

### Task 6.1: One-Click Rollback Execution
- **Task ID:** `REM-01`
- **Objective:** Wire up `POST /deployments/:id/rollback` endpoint to call provider adapter rollback methods without rebuilding code.
- **Dependencies:** `PROV-02`, `PROV-03`.
- **Affected Paths:** `apps/api/src/modules/deployments/`, `apps/dashboard/`.
- **Acceptance Criteria:** AWS ECS reverts to previous task definition revision; VPS restores backup compose file; service verified healthy.

### Task 6.2: Automated Remediation PR Generator (Post-MVP)
- **Task ID:** `REM-02`
- **Objective:** Implement GitHub branch creation (`opspilot/fix-incident-<id>`) and open Pull Request with AI diagnostic summary upon human request.
- **Dependencies:** `AI-03`.
- **Affected Paths:** `apps/api/src/modules/ai-investigation/remediation/`.
- **Acceptance Criteria:** Opens GitHub PR with code diff; does NOT merge or deploy autonomously.
