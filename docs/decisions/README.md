# Architecture Decision Records (ADRs)

This directory contains the formal records of architectural, engineering, and security decisions made for **OpsPilot**.

OpsPilot follows the ADR process to document significant architectural shifts, framework selections, security models, and system boundaries.

---

## ADR Workflow
1. Copy [`ADR_TEMPLATE.md`](ADR_TEMPLATE.md) to a new file named `ADR-XXXX-<descriptive-title>.md`.
2. Propose the decision via a GitHub Pull Request.
3. Allow a minimum 5-day community and maintainer review window.
4. Update status from `Proposed` to `Accepted`, `Rejected`, or `Superseded`.

---

## Canonical ADR Index

| ADR ID | Title | Status | Scope |
|---|---|---|---|
| [**ADR-0001**](ADR-0001-modular-monolith-architecture.md) | Modular Monolith Architecture | Accepted | Monorepo Architecture |
| [**ADR-0002**](ADR-0002-postgresql-as-primary-state-store.md) | PostgreSQL as Primary State Store | Accepted | Database & State |
| [**ADR-0003**](ADR-0003-redis-and-bullmq-for-asynchronous-jobs.md) | Redis and BullMQ for Asynchronous Jobs | Accepted | Background Processing |
| [**ADR-0004**](ADR-0004-deployment-provider-abstraction.md) | Deployment Provider Abstraction | Accepted | Provider Architecture |
| [**ADR-0005**](ADR-0005-isolated-runners-for-untrusted-builds.md) | Isolated Runners for Untrusted Builds | Accepted | Build Security |
| [**ADR-0006**](ADR-0006-aws-ecs-fargate-deployment.md) | AWS ECS Fargate Deployment Adapter | Accepted | Cloud Providers |
| [**ADR-0007**](ADR-0007-vps-docker-compose-deployment.md) | VPS Docker Compose Deployment Adapter | Accepted | Cloud Providers |
| [**ADR-0008**](ADR-0008-github-app-for-source-control-integration.md) | GitHub App for Source Control Integration | Accepted | Version Control |
| [**ADR-0009**](ADR-0009-opentelemetry-telemetry-standard.md) | OpenTelemetry Standard for Telemetry Ingestion | Accepted | Observability |
| [**ADR-0010**](ADR-0010-provider-independent-ai-gateway.md) | Provider-Independent AI Gateway | Accepted | AI Architecture |
| [**ADR-0011**](ADR-0011-read-only-ai-investigation-agent.md) | Read-Only AI Investigation Agent | Accepted | AI Safety |
| [**ADR-0012**](ADR-0012-human-approval-gate-for-production-remediation.md) | Human Approval Gate for Production Remediation | Accepted | Operations & Safety |
| [**ADR-0013**](ADR-0013-open-source-license-selection.md) | Open-Source License Selection (Apache-2.0 Recommended) | Pending Owner | Governance & Licensing |
| [**ADR-0014**](../integrations/cloudflare/CLOUDFLARE_ARCHITECTURE_DECISIONS.md#adr-0014-separate-cloudflare-workers-and-cloudflare-pages-providers) | Separate Cloudflare Workers and Pages Providers | Accepted | Cloudflare Integration |
| [**ADR-0015**](../integrations/cloudflare/CLOUDFLARE_ARCHITECTURE_DECISIONS.md#adr-0015-direct-upload-strategy-for-cloudflare-pages) | Direct Upload Strategy for Cloudflare Pages | Accepted | Cloudflare Integration |
| [**ADR-0016**](../integrations/cloudflare/CLOUDFLARE_ARCHITECTURE_DECISIONS.md#adr-0016-nodejs-isolated-build-runner-for-cloudflare-targets) | Node.js Isolated Build Runner for Cloudflare Targets | Accepted | Build Security |
| [**ADR-0017**](../integrations/cloudflare/CLOUDFLARE_ARCHITECTURE_DECISIONS.md#adr-0017-polymorphic-deployment-configuration-and-database-schema-evolution) | Polymorphic Deployment Configuration & Schema Evolution | Accepted | Database & Domain |
| [**ADR-0018**](../integrations/cloudflare/CLOUDFLARE_ARCHITECTURE_DECISIONS.md#adr-0018-cloudflare-api-token-scoping-and-envelope-encryption) | Cloudflare API Token Scoping & Envelope Encryption | Accepted | Security & Vault |
