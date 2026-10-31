## Description
Provide a concise summary of the changes made and the motivation behind them.

Closes # (issue number if applicable)

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update / ADR addition
- [ ] Refactoring / Performance improvement
- [ ] CI / Build tooling update

## Architectural & Security Verification
- [ ] I have read the [AI Coding Agent Guidelines](../AGENTS.md) / [Contributor Guide](../CONTRIBUTING.md).
- [ ] Tenant isolation is preserved: queries, caches, and jobs are explicitly scoped by `organization_id`.
- [ ] No raw credentials, secrets, or decrypted tokens are exposed in API responses or logs.
- [ ] Database schema changes (if any) include structured migrations without destructive DDL.
- [ ] Architecture Decision Record (ADR) added in `docs/decisions/` if an architectural pattern was introduced or modified.

## How Has This Been Tested?
Please describe the tests that you ran to verify your changes. Include details of your testing environment.

- [ ] Unit tests added/updated (`npm run test:unit`)
- [ ] Integration tests added/updated (`npm run test:integration`)
- [ ] Manual verification in local Docker environment

## Checklist:
- [ ] My code follows the style guidelines of this project (`npm run lint`).
- [ ] I have performed a self-review of my own code.
- [ ] I have commented hard-to-understand areas, preserving technical rationale.
- [ ] I have updated corresponding documentation in `docs/`.
- [ ] My changes generate no new TypeScript errors (`npm run typecheck`).
