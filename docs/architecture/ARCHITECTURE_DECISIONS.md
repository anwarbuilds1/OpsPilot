# Architecture Decision Records (ADR) Summary

This document indexes all formal Architecture Decision Records for OpsPilot. Detailed records are maintained in the [`docs/decisions/`](../decisions/) directory.

---

## Architecture Decision Register

| ADR ID | Title | Status | Date | Decision Summary |
|---|---|:---:|:---:|---|
| [ADR-0001](../decisions/ADR-0001-modular-monolith-architecture.md) | Modular Monolith Architecture | **Accepted** | 2026-11-01 | Build core API as a modular monolith in NestJS to accelerate development while enforcing strict module boundaries. |
| [ADR-0002](../decisions/ADR-0002-postgresql-as-primary-state-store.md) | PostgreSQL as Primary State Store | **Accepted** | 2026-11-01 | Use PostgreSQL 16 as the single durable source of truth for business state, deployments, incidents, and audit logs. |
| [ADR-0003](../decisions/ADR-0003-redis-and-bullmq-for-asynchronous-jobs.md) | Redis & BullMQ for Asynchronous Jobs | **Superseded** | 2026-11-01 | PostgreSQL-backed queue — selected architecture, implementation pending (Decision 7); BullMQ/Redis retained as future high-throughput alternative. |
| [ADR-0004](../decisions/ADR-0004-deployment-provider-abstraction.md) | Deployment Provider Abstraction | **Accepted** | 2026-11-01 | Implement a unified `DeploymentProvider` interface to manage diverse targets (AWS ECS, VPS Docker) polymorphically. |
| [ADR-0005](../decisions/ADR-0005-isolated-runners-for-untrusted-builds.md) | Isolated Runners for Untrusted Builds | **Accepted** | 2026-11-01 | Execute customer Docker builds inside isolated ephemeral container sandboxes to prevent RCE attacks on the API host. |
| [ADR-0006](../decisions/ADR-0006-aws-ecs-fargate-deployment.md) | AWS ECS Fargate Deployment Adapter | **Accepted** | 2026-11-01 | Target AWS ECS with Fargate and Amazon ECR via cross-account IAM role assumption using an external ID. |
| [ADR-0007](../decisions/ADR-0007-vps-docker-compose-deployment.md) | VPS Docker Compose Deployment Adapter | **Accepted** | 2026-11-01 | Support Ubuntu VPS deployment via isolated SSH and Docker Compose manifests with automated rollback backups. |
| [ADR-0008](../decisions/ADR-0008-github-app-for-source-control-integration.md) | GitHub App for Source Control Integration | **Accepted** | 2026-11-01 | Use a GitHub App rather than OAuth tokens or SSH deploy keys to achieve granular permissions and webhook automation. |
| [ADR-0009](../decisions/ADR-0009-opentelemetry-telemetry-standard.md) | OpenTelemetry Telemetry Standard | **Accepted** | 2026-11-01 | Adopt OpenTelemetry (OTel) schemas for application observability to avoid vendor lock-in. |
| [ADR-0010](../decisions/ADR-0010-provider-independent-ai-gateway.md) | Provider-Independent AI Gateway | **Accepted** | 2026-11-01 | Decouple the platform from specific LLM vendors by building an internal gateway supporting Gemini, Claude, and OpenAI. |
| [ADR-0011](../decisions/ADR-0011-read-only-ai-investigation-agent.md) | Read-Only AI Investigation Agent | **Accepted** | 2026-11-01 | Strictly restrict the AI agent to read-only diagnostic tools, eliminating autonomous infrastructure write permissions. |
| [ADR-0012](../decisions/ADR-0012-human-approval-gate-for-production-remediation.md) | Human Approval Gate for Production Remediation | **Accepted** | 2026-11-01 | Require explicit human engineering sign-off via GitHub PR or Web UI for all code changes and production rollbacks. |
| [ADR-0013](../decisions/ADR-0013-open-source-license-selection.md) | Open-Source License Selection | **Accepted** | 2026-11-07 | Ratified Apache License 2.0 (Apache-2.0) across repository root and all workspace packages. |
