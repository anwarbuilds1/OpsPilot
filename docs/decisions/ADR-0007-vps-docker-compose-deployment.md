# ADR-0007: VPS Docker Compose Deployment Adapter

- **Status:** Accepted
- **Date:** 2026-11-01
- **Author:** Principal Software Architect
- **Deciders:** OpsPilot Core Team

---

## Context
Many early-stage startups and small SaaS teams host staging or low-cost production workloads on VPS instances (Hetzner, DigitalOcean, Linode, AWS Lightsail) using Ubuntu and Docker Compose. They need a simple, reliable way to automate deployments without paying for managed cloud container services.

## Problem Statement
How should OpsPilot interact with and deploy applications onto bare Ubuntu VPS servers?

## Decision
We decide to implement the `VpsDockerProvider` using **SSH with isolated public-key authentication** to manage **Docker Compose** services under `/opt/opspilot/services/<service-id>/`. Deployments will maintain a `docker-compose.yml.backup` file for instant local rollback.

## Alternatives Considered
1. **Custom Resident Host Agent:**
   - *Pros:* No inbound SSH port required; outbound polling from the server.
   - *Cons:* Significantly higher engineering effort to build, package, and distribute a multi-arch daemon for MVP.
2. **Direct Raw Docker CLI (`docker run` commands):**
   - *Cons:* Fragile container networking, difficult multi-container service orchestration, lacks declarative configuration files.

## Rationale & Consequences
- **Positive:** Zero software to install on the target server besides Docker and Docker Compose; declarative compose manifests; standard SSH tooling supported by all VPS providers.
- **Negative:** Requires an open SSH port (default 22) on the target host. A lightweight outbound agent can be introduced in Post-MVP.

## References
- [`docs/deployment/VPS_DOCKER_DEPLOYMENT.md`](../deployment/VPS_DOCKER_DEPLOYMENT.md)
