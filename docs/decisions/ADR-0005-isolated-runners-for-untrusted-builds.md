# ADR-0005: Isolated Runners for Untrusted Builds

- **Status:** Accepted
- **Date:** 2026-11-01
- **Author:** Principal Software Architect
- **Deciders:** OpsPilot Core Team

---

## Context
OpsPilot checks out customer Git repositories and builds container images from repository Dockerfiles. Repositories must be treated as completely untrusted input: malicious actors or compromised dependencies could execute arbitrary commands during `docker build` (e.g., via `RUN` instructions).

## Problem Statement
How do we isolate Docker builds to protect the OpsPilot API host and backing infrastructure?

## Decision
We decide that all image builds must execute inside **ephemeral, isolated runner containers** running as non-root users with strict CPU, memory, and networking limits. The host Docker socket (`/var/run/docker.sock`) is never mounted inside the runner.

## Alternatives Considered
1. **In-Process Shell Spawning (`child_process.exec` on API host):**
   - *Rejected:* Fatal security flaw; grants arbitrary remote code execution (RCE) on the core control plane.
2. **Mounting Host Docker Socket into Runner:**
   - *Rejected:* Container escape vulnerability; any process inside the container can control the host Docker daemon and gain root access to the host.
3. **Dedicated Cloud Build Services (AWS CodeBuild, Google Cloud Build):**
   - *Pros:* Fully managed isolation.
   - *Cons:* Breaks self-hosted / on-prem compatibility and adds cloud provider dependency.

## Rationale & Consequences
- **Positive:** Guarantees strong tenant isolation; protects host secrets and filesystem; enables deterministic cancellation of runaway builds.
- **Negative:** Minor performance overhead for spinning up ephemeral runner containers.

## References
- [`docs/security/DEPLOYMENT_RUNNER_SECURITY.md`](../security/DEPLOYMENT_RUNNER_SECURITY.md)
