# Testing Strategy & Quality Assurance Framework (Deprecated Reference)

> [!NOTE]
> **Canonical Document Locations:**
> - **Testing Strategy (Philosophy, Harness Architecture & Execution):** [`docs/testing/TEST_STRATEGY.md`](../testing/TEST_STRATEGY.md)
> - **Testing Standards (Enforceable Gates, Mocks & CI Tiers):** [`docs/engineering/TESTING_STANDARDS.md`](TESTING_STANDARDS.md)
>
> This engineering document has been superseded. Testing responsibilities are divided into:
> 1. **Testing Strategy** ([`docs/testing/TEST_STRATEGY.md`](../testing/TEST_STRATEGY.md)): Authoritative guide for Vitest workspace architecture, test execution commands, database transaction isolation, and flaky-test prevention.
> 2. **Testing Standards** ([`docs/engineering/TESTING_STANDARDS.md`](TESTING_STANDARDS.md)): Mandatory quality gates, branch coverage benchmarks, tenant isolation assertions, and anti-deception rules.

---

## Historical Context & Initial QA Framework (Archived)

> [!WARNING]
> **Historical Artifact Notice:** The section below represents early project planning documentation. Note that OpsPilot standardizes on **Vitest** across all workspaces (not Jest), and executes integration tests against PostgreSQL 18 with schema/transaction isolation rather than Testcontainers.

### 1. Initial Testing Pyramid Overview

```mermaid
flowchart TD
    E2E[End-to-End Tests: Complete Deployment & Investigation Journeys<br/>Coverage: Critical Happy Paths & Rollback]
    Integration[Integration Tests: Multi-Tenant Scoping, Provider Adapters, Database Queries<br/>Coverage: All APIs, Database transactions & Worker Jobs]
    Unit[Unit Tests: Domain Logic, State Machines, Scrubber Regex, Zod Schemas<br/>Coverage: >= 80% Core Logic Coverage]

    E2E --> Integration
    Integration --> Unit

    classDef py fill:#e3f2fd,stroke:#1565c0,stroke-width:2px;
    class E2E,Integration,Unit py;
```

### 2. Historical PR Quality Gates
The initial pipeline executed linting, typecheck, unit tests, tenant isolation integration tests, secret scanning, and container build checks before maintainer review. Current enforceable gates are codified in [`docs/engineering/TESTING_STANDARDS.md`](TESTING_STANDARDS.md).
