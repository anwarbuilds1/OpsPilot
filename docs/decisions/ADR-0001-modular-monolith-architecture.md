# ADR-0001: Modular Monolith Architecture

- **Status:** Accepted
- **Date:** 2026-11-01
- **Author:** Principal Software Architect
- **Deciders:** OpsPilot Core Team

---

## Context
OpsPilot requires tight integration between authentication, deployment management, telemetry ingestion, incident correlation, and AI investigations. The engineering team needs high development velocity during early phases while preserving architectural boundaries to support future scaling.

## Problem Statement
Should OpsPilot be architected as a distributed microservices ecosystem or a modular monolith?

## Decision
We decide to build OpsPilot as a **Modular Monolith** in NestJS and TypeScript, paired with independent background worker processes and isolated execution runners.

## Alternatives Considered
1. **Full Microservices (Auth, Deploy, Telemetry, AI as distinct deployable services):**
   - *Pros:* Independent deployability and localized scaling.
   - *Cons:* High cognitive overhead, distributed transaction complexity, network latency, difficult local development setup, premature optimization for a team of 2–10 engineers.
2. **Unstructured Single Monolith:**
   - *Pros:* Extremely fast initial prototyping.
   - *Cons:* Inevitably devolves into an unmaintainable "big ball of mud" with circular dependencies.

## Rationale & Consequences
- **Positive:** Fast developer feedback loops; shared TypeScript domain models (`packages/domain`); straightforward ACID transactions; simplified local development using a single Docker Compose setup.
- **Negative:** Requires rigorous enforcement of module boundaries through linting rules and code reviews to prevent circular dependencies.

## Security Implications
All cross-module communication must carry explicit tenant context (`organization_id`).

## References
- [`docs/architecture/MODULE_BOUNDARIES.md`](../architecture/MODULE_BOUNDARIES.md)
