# ADR-0012: Human Approval Gate for Production Remediation

- **Status:** Accepted
- **Date:** 2026-11-01
- **Author:** Principal Software Architect
- **Deciders:** OpsPilot Core Team

---

## Context
When an incident is investigated and a root cause identified, the remediation phase begins (e.g., rolling back a deployment, patching an invalid environment variable, or applying a code fix).

## Problem Statement
How should OpsPilot balance automated recovery speed with operational safety during incident remediation?

## Decision
We decide that all production state changes and code remediations must pass through an explicit **Human Approval Gate**. OpsPilot prepares remediation proposals as:
1. One-click rollback buttons in the OpsPilot dashboard.
2. Formatted GitHub Pull Requests containing the proposed code diff and diagnostic summary.

A human engineer must explicitly review and approve the action before it executes on production infrastructure.

## Alternatives Considered
1. **Fully Automated Git Push & Deploy:**
   - *Rejected:* AI-generated code fixes can introduce subtle regressions, security flaws, or syntax errors if deployed without human review.
2. **Automated Rollback Only (Autonomous Rollback):**
   - *Consideration:* Feasible in specific low-risk cases, but deferred to Post-MVP (P1) under configurable organization policies. For MVP, rollbacks require a human click.

## Rationale & Consequences
- **Positive:** Preserves the standard software engineering workflow (code reviews, branch permissions, CI/CD checks); ensures human engineers remain accountable for production state.
- **Negative:** Adds human latency to recovery times compared to fully autonomous self-healing.

## References
- [`docs/product/USER_FLOWS.md`](../product/USER_FLOWS.md)
