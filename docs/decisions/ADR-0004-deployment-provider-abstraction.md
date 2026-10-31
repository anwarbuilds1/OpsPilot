# ADR-0004: Deployment Provider Abstraction

- **Status:** Accepted
- **Date:** 2026-11-01
- **Author:** Principal Software Architect
- **Deciders:** OpsPilot Core Team

---

## Context
OpsPilot supports two divergent deployment targets: AWS ECS Fargate (cloud-native serverless containers) and Ubuntu VPS instances (managed via Docker Compose). Implementing these as disconnected silos would lead to duplicated business logic for deployments, health checks, rollbacks, and incident correlation.

## Problem Statement
How should OpsPilot unify deployment execution across divergent cloud and bare-metal environments?

## Decision
We decide to define a standardized `DeploymentProvider` interface in `packages/deployment-providers`. The core `DeploymentsModule` will orchestrate lifecycles against this contract, while provider-specific adapters (`AwsEcsProvider`, `VpsDockerProvider`) implement the low-level infrastructure operations.

## Alternatives Considered
1. **Target-Specific Pipelines:** Separate workflows (`/deployments/aws` vs `/deployments/vps`).
   - *Rejected:* Breeds massive code duplication, inconsistent UI experiences, and higher defect rates.
2. **Unified External Engine (Terraform / Pulumi for all deployments):**
   - *Rejected:* Heavyweight, slow execution times, poor real-time event streaming compared to direct SDK/SSH orchestration.

## Rationale & Consequences
- **Positive:** Adding future deployment targets (e.g., GCP Cloud Run, DigitalOcean, Kubernetes) requires only implementing the standardized interface without modifying core deployment business logic.
- **Negative:** Provider-specific idiosyncrasies must be abstracted carefully into common metadata envelopes without masking vital failure reasons.

## References
- [`docs/architecture/DEPLOYMENT_ARCHITECTURE.md`](../architecture/DEPLOYMENT_ARCHITECTURE.md)
