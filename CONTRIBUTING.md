# Contributing to OpsPilot

Thank you for your interest in contributing to **OpsPilot**! We are building an open-source, deployment-aware AI operations platform to help small engineering teams operate production services reliably.

This document outlines the developer workflow, coding standards, branch strategies, and pull request guidelines for human contributors and automated agents.

---

## 1. Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to the project maintainers.

---

## 2. Getting Started

### 2.1 Prerequisites
- **Node.js**: `v20.x` LTS or later
- **npm**: `v10.x` or later
- **Docker & Docker Compose**: For local PostgreSQL and Redis backing services
- **Git**

### 2.2 Local Setup
1. Fork the repository on GitHub and clone your fork:
   ```bash
   git clone https://github.com/<your-username>/OpsPilot.git
   cd OpsPilot
   ```
2. Create your feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. Start local development infrastructure:
   ```bash
   docker compose -f docker/docker-compose.dev.yml up -d
   ```
4. Copy environment configuration and install dependencies:
   ```bash
   cp .env.example .env
   npm install
   ```

For detailed setup instructions, troubleshooting, and architectural context, see the [Development Setup Guide](docs/engineering/DEVELOPMENT_SETUP.md).

---

## 3. Branch & Commit Conventions

### 3.1 Branch Naming
Use descriptive branch names with appropriate prefixes:
- `feat/<feature-name>`: New user-facing or platform features.
- `fix/<bug-name>`: Bug fixes and patches.
- `docs/<topic>`: Documentation enhancements or ADR updates.
- `refactor/<scope>`: Code refactoring without behavioral changes.
- `test/<scope>`: Adding or modifying test suites.
- `chore/<task>`: Dependency updates, CI workflows, build tooling.

### 3.2 Commit Messages (Conventional Commits)
We enforce the [Conventional Commits](https://www.conventionalcommits.org/) specification:
```text
<type>(<scope>): <short description>

[optional body explaining context and rationale]

[optional footer(s) such as Closes #123]
```

**Allowed types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.  
**Examples:**
- `feat(deployments): add rollback support for VPS Docker Compose`
- `fix(incident-engine): prevent race condition during alert deduplication`
- `docs(adr): document ADR-0013 open-source license evaluation`

---

## 4. Coding & Architecture Standards

1. **Strict TypeScript:** All code must pass `tsc --noEmit` under strict mode. Never use `any`.
2. **Modular Monolith Discipline:** Respect module boundaries in `apps/api/src/modules/`. Modules must not directly import or mutate internal entities of other modules; interact solely through public service interfaces or domain events. See [Module Boundaries](docs/architecture/MODULE_BOUNDARIES.md).
3. **Tenant Isolation:** Every database query, cache key, and event payload must include an `organization_id`. Test tenant isolation explicitly.
4. **Security by Design:** Never log secrets, passwords, or credentials. All infrastructure tools called by AI agents must be read-only and enforce bounds on output length and duration.

---

## 5. Pull Request (PR) Workflow

1. **Keep PRs Focused:** Submit small, targeted PRs rather than sprawling multi-feature submissions.
2. **Include Tests:** Every new feature must be accompanied by unit and/or integration tests.
3. **Run Pre-flight Checks:**
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   ```
4. **Update Documentation:** Update corresponding markdown files in `docs/` and add Architecture Decision Records (`docs/decisions/`) for structural design changes.
5. **PR Description:** Use the provided [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md) to describe:
   - What changed and why.
   - Related issues closed (e.g., `Closes #42`).
   - Testing steps performed.
   - Security considerations.

---

## 6. Review & Release Process

- Every PR requires review and approval from at least one core maintainer.
- Continuous Integration (CI) checks (linting, type checking, unit tests, secret scanning) must pass before merging.
- PRs are merged using **Squash and Merge** to maintain a clean linear git history.
