# OpsPilot Documentation Index

Welcome to the comprehensive technical documentation for **OpsPilot**, an open-source, deployment-aware AI operations platform for small SaaS engineering teams.

This documentation serves as the single source of truth for software architects, platform engineers, AI agents, and open-source contributors.

---

## Documentation Structure

```text
docs/
├── product/          # Product Requirements, Personas, User Flows, MVP Scope
├── architecture/     # System Blueprints, Module Boundaries, Data Flows, Lifecycles
├── decisions/        # Architecture Decision Records (ADRs)
├── engineering/      # Schemas, REST APIs, Job Contracts, Implementation Plan
├── deployment/       # AWS ECS, VPS Docker, Local Dev, CI/CD, Rollback
├── integrations/     # GitHub, AWS, VPS, CloudWatch, OpenTelemetry
├── ai/               # AI Gateway, Tool Specs, Incident Simulation & Evaluation
├── security/         # Threat Model (STRIDE), Envelope Encryption, Runner Security
├── testing/          # Testing Pyramid, Multi-Tenant Tests, E2E Verification
├── operations/       # Monitoring, Incident Response, Troubleshooting Runbooks
├── open-source/      # Contributor Workflows, Release Policies, Governance
└── reference/        # Configuration, Environment Variables, Error Codes
```

---

## 1. Product Documentation (`docs/product/`)
Learn about why OpsPilot exists, the problems it solves, who uses it, and the precise functional requirements.
- [Product Overview](product/PRODUCT_OVERVIEW.md) — Mission, value proposition, problem statement, and architectural boundaries.
- [Product Requirements Document (PRD)](product/PRODUCT_REQUIREMENTS.md) — Detailed functional (AUTH, PROJ, DEP, OBS, INC, AI) and non-functional specifications.
- [User Personas & Scenarios](product/USER_PERSONAS.md) — Detailed profiles of Founders, Backend Engineers, and Full-Stack Engineers.
- [User Flows](product/USER_FLOWS.md) — End-to-end user journeys from registration to automated remediation.
- [MVP Scope & Boundaries](product/MVP_SCOPE.md) — Strict categorization of P0 (MVP), P1 (Post-MVP), and P2 (Future) capabilities.
- [Feature Specifications](product/FEATURE_SPECIFICATIONS.md) — Granular breakdown of platform modules.
- [Glossary of Terms](product/GLOSSARY.md) — Canonical definitions of domain terminology.

---

## 2. System Architecture (`docs/architecture/`)
Deep dive into the modular monolith design, container topology, module boundaries, and lifecycles.
- [System Architecture Blueprint](architecture/SYSTEM_ARCHITECTURE.md) — C4 context diagram, container topology, execution boundaries, and trade-offs.
- [Module Boundaries & Domain Interfaces](architecture/MODULE_BOUNDARIES.md) — Explicit rules for NestJS modules, entity ownership, and cyclic dependency prevention.
- [Data Flow Specifications](architecture/DATA_FLOW.md) — Sequence workflows for Webhooks, Builds, Deployments, Telemetry, and AI Investigations.
- [Deployment Architecture](architecture/DEPLOYMENT_ARCHITECTURE.md) — Unified deployment provider abstraction, AWS ECS/Fargate adapter, and VPS Docker Compose adapter.
- [Observability Architecture](architecture/OBSERVABILITY_ARCHITECTURE.md) — Metrics aggregation, stdout/stderr log stream processing, and OpenTelemetry integration.
- [Incident Architecture](architecture/INCIDENT_ARCHITECTURE.md) — Incident detection triggers, severity rules, state machines, and deduplication.
- [AI Agent Architecture](architecture/AI_AGENT_ARCHITECTURE.md) — Read-only investigation orchestrator, bounded tool calling, and hypothesis generation.
- [Security Architecture](architecture/SECURITY_ARCHITECTURE.md) — Multi-tenant isolation model, trust boundaries, and authorization matrices.
- [Scalability & Reliability](architecture/SCALABILITY_AND_RELIABILITY.md) — High-availability targets, job worker scaling, and disaster recovery.
- [Architecture Decisions Index](architecture/ARCHITECTURE_DECISIONS.md) — Summary and status of all ADRs.

---

## 3. Architecture Decision Records (`docs/decisions/`)
Formal records of critical architectural choices, alternatives considered, and trade-offs.
- [ADR Index & Guidelines](decisions/README.md)
- [ADR Template](decisions/ADR_TEMPLATE.md)
- [ADR-0001: Modular Monolith Architecture](decisions/ADR-0001-modular-monolith-architecture.md)
- [ADR-0002: PostgreSQL as Primary State Store](decisions/ADR-0002-postgresql-as-primary-state-store.md)
- [ADR-0003: Redis and BullMQ for Asynchronous Jobs](decisions/ADR-0003-redis-and-bullmq-for-asynchronous-jobs.md)
- [ADR-0004: Deployment Provider Abstraction](decisions/ADR-0004-deployment-provider-abstraction.md)
- [ADR-0005: Isolated Runners for Untrusted Builds](decisions/ADR-0005-isolated-runners-for-untrusted-builds.md)
- [ADR-0006: AWS ECS Fargate Deployment Adapter](decisions/ADR-0006-aws-ecs-fargate-deployment.md)
- [ADR-0007: VPS Docker Compose Deployment Adapter](decisions/ADR-0007-vps-docker-compose-deployment.md)
- [ADR-0008: GitHub App for Source Control Integration](decisions/ADR-0008-github-app-for-source-control-integration.md)
- [ADR-0009: OpenTelemetry Standard for Telemetry Ingestion](decisions/ADR-0009-opentelemetry-telemetry-standard.md)
- [ADR-0010: Provider-Independent AI Gateway](decisions/ADR-0010-provider-independent-ai-gateway.md)
- [ADR-0011: Read-Only AI Investigation Agent](decisions/ADR-0011-read-only-ai-investigation-agent.md)
- [ADR-0012: Human Approval Gate for Production Remediation](decisions/ADR-0012-human-approval-gate-for-production-remediation.md)
- [ADR-0013: Open-Source License Selection](decisions/ADR-0013-open-source-license-selection.md)

---

## 4. Engineering & Specifications (`docs/engineering/`)
Concrete implementation guidelines, database schemas, API specs, and execution sequences.
- [Database Design & Schema](engineering/DATABASE_DESIGN.md) — Comprehensive PostgreSQL schema, table definitions, indexes, foreign keys, and Mermaid ER diagram.
- [REST API Specification](engineering/API_SPECIFICATION.md) — Full API reference with request/response schemas, auth rules, and examples.
- [API Error Contract](engineering/API_ERROR_CONTRACT.md) — Standardized JSON error response format and error codes.
- [Background Job Specification](engineering/BACKGROUND_JOB_SPECIFICATION.md) — BullMQ queue names, job payloads, retries, and dead-letter handling.
- [Domain Event Contracts](engineering/EVENT_CONTRACTS.md) — Internal event schemas, producers, and consumers.
- [Multi-Tenancy & Authorization Model](engineering/MULTI_TENANCY.md) — Organization boundary enforcement, RBAC, and middleware checks.
- [Environment Variables](engineering/ENVIRONMENT_VARIABLES.md) — Complete environment reference for all deployment environments.
- [Testing Strategy](engineering/TESTING_STRATEGY.md) — Unit, integration, multi-tenant isolation, and E2E testing framework.
- [Implementation Plan](engineering/IMPLEMENTATION_PLAN.md) — Phased engineering breakdown (Phase 0 through Phase 6) with tasks and acceptance criteria.

---

## 5. Deployment & Integrations (`docs/deployment/` & `docs/integrations/`)
Runbooks and specifications for running and connecting OpsPilot.
- [Local Development Guide](deployment/LOCAL_DEVELOPMENT.md) — Setting up Docker Compose, local PostgreSQL, and Redis.
- [AWS ECS Deployment Guide](deployment/AWS_ECS_DEPLOYMENT.md) — Cross-account IAM role setup, ECR image pushing, and task definition lifecycle.
- [VPS Docker Deployment Guide](deployment/VPS_DOCKER_DEPLOYMENT.md) — Ubuntu server preparation, SSH key isolation, and docker-compose deployment.
- [CI/CD Pipeline](deployment/CI_CD.md) — GitHub Actions pipeline stages, secret scanning, and automated releases.
- [Rollback Procedures](deployment/ROLLBACK_PROCEDURES.md) — Safe, deterministic rollback execution for ECS and VPS targets.
- [GitHub Integration](integrations/GITHUB_INTEGRATION.md) — App manifest, permissions, and webhook signature verification.
- [AWS Integration](integrations/AWS_INTEGRATION.md) — IAM external ID assumption and CloudWatch telemetry integration.
- [VPS Integration](integrations/VPS_INTEGRATION.md) — SSH connectivity validation and Docker socket security.

---

## 6. AI Systems & Incident Simulation (`docs/ai/`)
Specifications for the AI Gateway, tool execution sandbox, and incident validation test suite.
- [AI System Overview](ai/AI_SYSTEM_OVERVIEW.md) — Gateway architecture, token budgets, prompt engineering, and structured outputs.
- [Tool Specifications](ai/TOOL_SPECIFICATIONS.md) — Full interface definitions, input schemas, validation rules, and output schemas for all 9 investigation tools.
- [Incident Investigation Walkthrough](ai/INCIDENT_INVESTIGATION.md) — Concrete step-by-step example of investigating a database connection pool exhaustion incident.
- [Incident Simulator (15 Scenarios)](ai/INCIDENT_SIMULATOR.md) — Deterministic failure injection scenarios (Redis failure, memory leak, 500 error spike, bad deployment, etc.) for testing the AI agent.
- [AI Agent Evaluation Framework](ai/AI_EVALUATION.md) — Benchmarking methodology for accuracy, evidence quality, hallucination prevention, and cost tracking.

---

## 7. Security (`docs/security/`)
Security specifications ensuring tenant isolation and infrastructure protection.
- [Threat Model (STRIDE)](security/THREAT_MODEL.md) — Asset catalog, threat actors, trust boundary diagram, and attack mitigations.
- [Credential Management](security/CREDENTIAL_MANAGEMENT.md) — Envelope encryption using AES-256-GCM / AWS KMS for infrastructure secrets.
- [Deployment Runner Security](security/DEPLOYMENT_RUNNER_SECURITY.md) — Isolating untrusted customer Dockerfiles and build scripts.
- [AI Agent Security](security/AI_AGENT_SECURITY.md) — Defenses against prompt injection, data exfiltration, and unauthorized actions.
