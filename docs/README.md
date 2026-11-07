# OpsPilot Documentation Index

Welcome to the comprehensive technical documentation for **OpsPilot**, an open-source, deployment-aware AI operations platform for small SaaS engineering teams.

This documentation serves as the single source of truth for software architects, platform engineers, AI agents, and open-source contributors.

---

## ⭐️ Project Foundation, Governance & Blueprint (November 2026)

These authoritative documents establish the baseline audit, monorepo structure, architectural decisions, and phased implementation roadmap for the platform:

- [**Project Architecture Final Review**](PROJECT_ARCHITECTURE_FINAL_REVIEW.md) — Authoritative final review report establishing architecture corrections, runner security, cryptographic standards, and approval readiness.
- [**Project Foundation Blueprint Reconciliation Report**](PROJECT_FOUNDATION_RECONCILIATION.md) — Master reconciliation of repository evidence, final package ownership, technology matrix, and open questions.
- [**Project Foundation Audit Report**](PROJECT_FOUNDATION_AUDIT.md) — Comprehensive repository state audit and formal classification of the 10 adversarial audit findings (`SEC-01` through `UI-01`).
- [**Project Foundation Architectural Decisions**](PROJECT_FOUNDATION_DECISIONS.md) — Canonical decisions on monorepo topology, engine decoupling, NIST SP 800-57 envelope encryption, and Apache-2.0 licensing.
- [**Project Foundation Remediation Plan**](PROJECT_FOUNDATION_REMEDIATION_PLAN.md) — Dependency-ordered sequencing of the 10 pre-implementation blockers into governance tiers.
- [**Canonical Repository Structure**](REPOSITORY_STRUCTURE.md) — Detailed package responsibility matrix, inclusions/exclusions, dependency rules, and interface ownership.
- [**Phased Implementation Roadmap**](PROJECT_IMPLEMENTATION_ROADMAP.md) — Granular 8-phase execution roadmap (Phases 0–7) with scope, atomic commits, acceptance, and exit criteria.

---

## Documentation Structure

```text
docs/
├── product/          # Product Requirements, Personas, User Flows, MVP Scope
├── architecture/     # System Blueprints, Module Boundaries, Data Flows, Lifecycles
├── decisions/        # Architecture Decision Records (ADRs)
├── engineering/      # Standards, Coding Conventions, CI/CD, Git Rules, Schemas
├── security/         # Threat Model (STRIDE), Envelope Encryption, Runner Security
├── development/      # Contributor Setup, Local PostgreSQL/Redis, Environment Config
├── testing/          # Testing Strategy, Harness Architecture, Coverage Standards
├── releases/         # Release Engineering, SemVer, Signing, Provenance
├── deployment/       # AWS ECS, VPS Docker, Local Dev, CI/CD, Rollback
├── integrations/     # GitHub, AWS, VPS, Cloudflare, OpenTelemetry
├── ai/               # AI Gateway, Tool Specs, Incident Simulation & Evaluation
└── operations/       # Monitoring, Incident Response, Troubleshooting Runbooks
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
- [Architectural Project Boundaries](architecture/PROJECT_BOUNDARIES.md) — Hexagonal boundaries, domain purity, invariants, and enforcement mechanisms.
- [Control Plane vs. Execution Plane](architecture/CONTROL_PLANE_AND_EXECUTION_PLANE.md) — Trust levels, credential firewall, sandboxed runners, and crash recovery.
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
- [ADR-0014: Separate Cloudflare Workers and Cloudflare Pages Providers](integrations/cloudflare/CLOUDFLARE_ARCHITECTURE_DECISIONS.md#adr-0014-separate-cloudflare-workers-and-cloudflare-pages-providers)
- [ADR-0015: Direct Upload Strategy for Cloudflare Pages](integrations/cloudflare/CLOUDFLARE_ARCHITECTURE_DECISIONS.md#adr-0015-direct-upload-strategy-for-cloudflare-pages)
- [ADR-0016: Node.js Isolated Build Runner for Cloudflare Targets](integrations/cloudflare/CLOUDFLARE_ARCHITECTURE_DECISIONS.md#adr-0016-nodejs-isolated-build-runner-for-cloudflare-targets)
- [ADR-0017: Polymorphic Deployment Configuration and Database Schema Evolution](integrations/cloudflare/CLOUDFLARE_ARCHITECTURE_DECISIONS.md#adr-0017-polymorphic-deployment-configuration-and-database-schema-evolution)
- [ADR-0018: Cloudflare API Token Scoping and Envelope Encryption](integrations/cloudflare/CLOUDFLARE_ARCHITECTURE_DECISIONS.md#adr-0018-cloudflare-api-token-scoping-and-envelope-encryption)

---

## 4. Engineering Standards & Governance (`docs/engineering/`)
Concrete engineering standards, coding conventions, testing pyramids, and CI/CD pipelines.
- [Engineering Standards](engineering/ENGINEERING_STANDARDS.md) — Code quality, API engineering, database rules, security and reliability standards.
- [Coding Conventions & TypeScript Guide](engineering/CODING_CONVENTIONS.md) — Strict TypeScript rules, naming conventions, error hierarchy, and import hygiene.
- [Git & Commit Conventions](engineering/GIT_AND_COMMIT_CONVENTIONS.md) — Conventional Commits format, scopes, PR requirements, and atomic commit policy.
- [Testing Standards](engineering/TESTING_STANDARDS.md) — Staged testing pyramid, risk-weighted coverage benchmarks, and anti-deception rules.
- [CI/CD Standards](engineering/CI_CD_STANDARDS.md) — Multi-stage GitHub Actions pipeline, fast static checks, and container signing.
- [Documentation Standards & Taxonomy](engineering/DOCUMENTATION_STANDARDS.md) — Single source of truth, factual rigor, and markdown conventions.
- [Database Design & Schema](engineering/DATABASE_DESIGN.md) — Comprehensive PostgreSQL schema, table definitions, indexes, and ER diagram.
- [REST API Specification](engineering/API_SPECIFICATION.md) — Full API reference with request/response schemas and examples.
- [API Error Contract](engineering/API_ERROR_CONTRACT.md) — Standardized JSON error response format and error codes.
- [Provider Contracts](engineering/PROVIDER_CONTRACTS.md) — Contract definitions for cloud deployment providers.

---

## 5. Development & Configuration (`docs/development/`)
Contributor environment setup, local database initialization, and environment variable references.
- [Local Development Guide](development/LOCAL_DEVELOPMENT.md) — Setting up Node.js, local PostgreSQL (Unix socket or Docker), Redis, and tests.
- [Environment Configuration Catalog](development/ENVIRONMENT_CONFIGURATION.md) — Comprehensive environment variable reference, Zod schema validation, and key rotation.

---

## 6. Testing & Quality Assurance (`docs/testing/`)
Test architecture, mock guidelines, and regression verification.
- [Test Strategy & Test Architecture](testing/TEST_STRATEGY.md) — Vitest test harness architecture, database transaction isolation, and cryptographic tests.

---

## 7. Release Engineering (`docs/releases/`)
Release lifecycle, versioning policies, and supply chain security.
- [Release Process](releases/RELEASE_PROCESS.md) — SemVer rules, automated changelogs, multi-arch containers, and Sigstore Cosign image signing.

---

## 8. Security Specifications (`docs/security/`)
Security specifications ensuring tenant isolation and infrastructure protection.
- [Security Architecture Canonical Reference](security/SECURITY_ARCHITECTURE.md) — Canonical reference to architecture specification.
- [Threat Model (STRIDE)](security/THREAT_MODEL.md) — Asset catalog, threat actors, trust boundary diagram, and attack mitigations.
- [Credential Management](security/CREDENTIAL_MANAGEMENT.md) — Envelope encryption using AES-256-GCM / Master KEK for infrastructure secrets.
- [Deployment Runner Security](security/DEPLOYMENT_RUNNER_SECURITY.md) — Isolating untrusted customer Dockerfiles and build scripts.
- [AI Agent Security](security/AI_AGENT_SECURITY.md) — Defenses against prompt injection, data exfiltration, and unauthorized actions.

---

## 9. Cloud Integrations (`docs/integrations/`)
Specifications for external cloud platforms and providers.
- [GitHub Integration](integrations/GITHUB_INTEGRATION.md) — App manifest, permissions, and webhook signature verification.
- [AWS Integration](integrations/AWS_INTEGRATION.md) — IAM external ID assumption and CloudWatch telemetry integration.
- [VPS Integration](integrations/VPS_INTEGRATION.md) — SSH connectivity validation and Docker socket security.
- [Cloudflare Architecture Decisions](integrations/cloudflare/CLOUDFLARE_ARCHITECTURE_DECISIONS.md) — ADRs 0014–0018 governing Cloudflare Workers & Pages.
- [Cloudflare Adversarial Audit](integrations/cloudflare/CLOUDFLARE_ADVERSARIAL_AUDIT.md) — Independent adversarial audit of Cloudflare implementation.

---

## 10. AI Operations (`docs/ai/`)
Specifications for the AI Gateway, tool execution sandbox, and incident validation test suite.
- [AI System Overview](ai/AI_SYSTEM_OVERVIEW.md) — Gateway architecture, token budgets, prompt engineering, and structured outputs.
- [Tool Specifications](ai/TOOL_SPECIFICATIONS.md) — Full interface definitions, input schemas, and output schemas for investigation tools.
- [Incident Investigation Walkthrough](ai/INCIDENT_INVESTIGATION.md) — Step-by-step example of investigating database pool exhaustion.
- [Incident Simulator (15 Scenarios)](ai/INCIDENT_SIMULATOR.md) — Deterministic failure injection scenarios.
- [AI Agent Evaluation Framework](ai/AI_EVALUATION.md) — Benchmarking methodology for accuracy and evidence quality.
