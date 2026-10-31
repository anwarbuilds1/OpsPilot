# OpsPilot Product & Technical Roadmap

This roadmap outlines the planned development milestones for OpsPilot. Priorities are derived from the [Product Requirements Document](docs/product/PRODUCT_REQUIREMENTS.md) and [MVP Scope](docs/product/MVP_SCOPE.md).

> [!NOTE]
> In alignment with open-source engineering best practices, milestones are organized by capability delivery order rather than arbitrary calendar deadlines.

---

## Phase 0: System Foundation (Current)
*Target: Establish a rock-solid, secure multi-tenant control plane foundation.*

- [x] Complete system architecture, threat modeling, and API contract specifications.
- [x] Database schema design for PostgreSQL with tenant isolation guarantees.
- [ ] Monorepo setup with npm/pnpm workspaces (`apps/api`, `apps/dashboard`, `apps/workers`, `packages/*`).
- [ ] Core authentication & organization management (Session tokens, bcrypt, RBAC).
- [ ] Project and Service entity CRUD with organization scoping.
- [ ] Redis and BullMQ job queue baseline with failure handling.
- [ ] GitHub App registration and webhook ingestion with HMAC-SHA256 verification.

---

## Phase 1: Unified Deployment Engine (MVP Core)
*Target: Deploy containerized applications to AWS ECS and VPS Docker Compose.*

- [ ] Isolated build runner container architecture.
- [ ] Docker image build and push pipeline with Amazon ECR integration.
- [ ] AWS ECS / Fargate deployment adapter (`validateConnection`, `deploy`, `getStatus`, `rollback`).
- [ ] Ubuntu VPS Docker Compose adapter via encrypted SSH runner.
- [ ] Deployment state machine with PostgreSQL audit trail.
- [ ] Post-deployment HTTP health-check polling with automatic stabilization detection.
- [ ] One-click deployment rollback to previous task definition / compose manifest.

---

## Phase 2: Observability & Incident Detection (MVP Core)
*Target: Real-time telemetry ingestion and automated incident detection.*

- [ ] Telemetry ingestion service (OpenTelemetry OTLP collector & CloudWatch metrics fetcher).
- [ ] Container CPU, memory, and error-rate metric aggregation.
- [ ] Application stdout/stderr log stream indexing with time-bounded querying.
- [ ] Automated incident trigger rules:
  - Unhealthy HTTP endpoint (3 consecutive failures).
  - Container crash-loop / OOMKilled events.
  - HTTP 5xx error rate exceeding configured threshold (e.g., > 5% over 5 minutes).
  - Deployment stabilization timeout.
- [ ] Incident timeline generation linking deployments, commit SHAs, and alert triggers.

---

## Phase 3: Read-Only AI Incident Investigation (MVP Core)
*Target: Automated, evidence-backed root-cause analysis by a bounded AI agent.*

- [ ] Provider-independent AI Gateway (Gemini, Claude, OpenAI abstraction).
- [ ] Read-only investigation tool suite:
  - `get_service_details`, `get_recent_deployments`, `get_deployment_details`
  - `get_application_logs`, `query_metrics`, `get_container_status`
  - `get_recent_commits`, `get_health_status`, `get_incident_timeline`
- [ ] Bounded investigation orchestrator (max 10 tool calls, token budgets, execution timeouts).
- [ ] Evidence-backed report generator (Observations vs. Hypotheses with confidence scoring).
- [ ] End-to-end incident verification using the 15 simulated failure scenarios.

---

## Phase 4: Post-MVP Enhancements (P1)
*Target: Enhanced operations, notifications, and guided remediation.*

- [ ] Slack & Discord notification webhooks for deployments and incidents.
- [ ] AI-generated remediation diffs with automated Git branch and GitHub PR creation.
- [ ] Team member invitation workflows with email verification.
- [ ] Incident assignment, acknowledgment, and deduplication logic.
- [ ] Distributed tracing integration via OpenTelemetry traces.
- [ ] VPS lightweight outbound agent (eliminating the need for open inbound SSH ports).

---

## Phase 5: Future & Research Initiatives (P2)
*Target: Scale, advanced deployment strategies, and enterprise compliance.*

- [ ] Blue/Green and Canary deployment pipelines for AWS ECS.
- [ ] Single Sign-On (SAML 2.0 / OIDC) for enterprise teams.
- [ ] Kubernetes (EKS/K8s) deployment adapter.
- [ ] Multi-cloud support (GCP Cloud Run, DigitalOcean App Platform).
- [ ] Multi-agent collaborative investigation benchmarks.
- [ ] Automated post-mortem report generation and incident replay simulation.

---

## Community Contribution Opportunities

We welcome contributions across all phases! See [CONTRIBUTING.md](CONTRIBUTING.md) to get involved. Areas specifically suited for community contributors include:
- Adding failure scenarios to the [Incident Simulator](docs/ai/INCIDENT_SIMULATOR.md).
- Building CLI utilities for developer interaction.
- Enhancing Next.js UI dashboard components and visualization graphs.
- Writing provider integration tests for diverse VPS distributions (Debian, Rocky Linux, Alpine).
