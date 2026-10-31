# ADR-0008: GitHub App for Source Control Integration

- **Status:** Accepted
- **Date:** 2026-11-01
- **Author:** Principal Software Architect
- **Deciders:** OpsPilot Core Team

---

## Context
OpsPilot requires source control integration to receive push notifications, check out code at specific commit SHAs, read repository metadata, and open automated remediation pull requests.

## Problem Statement
What mechanism should OpsPilot use to integrate with GitHub?

## Decision
We decide to integrate exclusively via an official **GitHub App** rather than OAuth Apps or Personal Access Tokens (PATs).

## Alternatives Considered
1. **GitHub OAuth App:**
   - *Pros:* Simpler initial user flow.
   - *Cons:* Permissions are all-or-nothing (e.g., granting read access often requires granting full repo write access); tied to an individual user's account rather than an organization.
2. **Personal Access Tokens (PATs) / Deploy Keys:**
   - *Cons:* Tedious manual configuration per repository; lack webhook automation; high security risk of unrotated static tokens.

## Rationale & Consequences
- **Positive:** Fine-grained permissions (scoped only to selected repositories); short-lived installation access tokens (1 hour expiry); automated webhook delivery with HMAC-SHA256 signature verification; organization-level installation independent of employee turnover.
- **Negative:** Requires registering and maintaining a GitHub App manifest.

## References
- [`docs/integrations/GITHUB_INTEGRATION.md`](../integrations/GITHUB_INTEGRATION.md)
