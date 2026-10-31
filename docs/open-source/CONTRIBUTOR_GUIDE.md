# Open-Source Contributor Guide

Thank you for contributing to OpsPilot! This guide explains how to propose features, report bugs, set up testing environments, and submit high-quality pull requests.

---

## 1. Community Principles

- **Constructive Collaboration:** We follow the [Contributor Covenant Code of Conduct](../../CODE_OF_CONDUCT.md).
- **Security First:** Infrastructure tooling must be secure by default. Never weaken tenant boundaries, disable input validation, or bypass authorization checks.
- **Architectural Rationale:** Significant changes must be accompanied by an Architecture Decision Record (ADR) in `docs/decisions/`.

---

## 2. Setting Up Your Development Environment

Follow our comprehensive [Development Setup Guide](../engineering/DEVELOPMENT_SETUP.md) to install dependencies, boot local PostgreSQL and Redis containers, and start development servers.

---

## 3. Pull Request Submission Checklist

Before submitting a Pull Request, verify:
- [ ] Code passes TypeScript compilation without errors: `npm run typecheck`
- [ ] Code passes linter: `npm run lint`
- [ ] Unit tests pass: `npm run test`
- [ ] Multi-tenant isolation tests pass: `npm run test:integration`
- [ ] Relevant documentation updated in `docs/`
- [ ] Commit messages adhere to [Conventional Commits](https://www.conventionalcommits.org/)
