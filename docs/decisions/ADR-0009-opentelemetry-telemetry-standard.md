# ADR-0009: OpenTelemetry Standard for Telemetry Ingestion

- **Status:** Accepted
- **Date:** 2026-11-01
- **Author:** Principal Software Architect
- **Deciders:** OpsPilot Core Team

---

## Context
OpsPilot ingests telemetry from multiple environments (CloudWatch, Docker metrics, application-level HTTP endpoints). To avoid developing proprietary SDKs and vendor-specific data contracts, a standardized semantic convention is needed.

## Problem Statement
What data standard should OpsPilot adopt for telemetry schemas and application instrumentation?

## Decision
We adopt the **OpenTelemetry (OTel)** semantic conventions and OTLP data format as the canonical standard for application telemetry. OpsPilot will normalize AWS CloudWatch and Docker metrics into OTel data models.

## Alternatives Considered
1. **Proprietary OpsPilot Schema:**
   - *Pros:* Complete control over internal fields.
   - *Cons:* Forces users to instrument their code with custom OpsPilot SDKs; high engineering maintenance.
2. **Prometheus Exposition Format:**
   - *Pros:* Widely used for pull-based metrics.
   - *Cons:* Excellent for metrics, but lacks standardized log and distributed trace semantics.

## Rationale & Consequences
- **Positive:** Customers can use standard OpenTelemetry SDKs in any programming language (Node.js, Python, Go, Java); future support for distributed tracing is built into the data model.
- **Negative:** OTel data structures can be verbose; requires a normalization layer for CloudWatch and Docker socket telemetry.

## References
- [`docs/architecture/OBSERVABILITY_ARCHITECTURE.md`](../architecture/OBSERVABILITY_ARCHITECTURE.md)
