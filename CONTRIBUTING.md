# Contributing to OpsPilot

Thank you for your interest in contributing to **OpsPilot**! We are building an open-source, deployment-aware AI operations platform to help small engineering teams operate production services reliably.

This document outlines the developer workflow, coding standards, branch strategies, and pull request guidelines for human contributors and automated agents.

---

## 1. Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to the project maintainers.

---

## 2. Getting Started

### 2.1 Prerequisites
- **Node.js**: `v20.x` LTS (`v20.20.2` verified)
- **NPM**: `v10.x` or later (`10.8.2` verified)
- **PostgreSQL**: Version 16+ (PostgreSQL 18.6 verified)
- **Redis**: Version 7.x+
- **Docker**: For sandboxed build runners
- **Git**

### 2.2 Local Setup
1. Fork the repository on GitHub and clone your fork:
   ```bash
   git clone https://github.com/<your-username>/OpsPilot.git
   cd OpsPilot
   ```
2. Copy environment configuration and install dependencies:
   ```bash
   cp .env.example .env
   npm install
   ```
3. Generate a 256-bit hex master key and configure `OPSPILOT_MASTER_KEY` in `.env`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
4. Initialize the PostgreSQL database and run migrations:
   ```bash
   npm run db:migrate
   ```

For comprehensive instructions, see the authoritative [Local Development Guide](docs/development/LOCAL_DEVELOPMENT.md) and [Environment Configuration Catalog](docs/development/ENVIRONMENT_CONFIGURATION.md).

---

## 3. Branch & Commit Conventions

OpsPilot strictly enforces **Conventional Commits v1.0.0**. Detailed specifications can be found in [Git & Commit Conventions](docs/engineering/GIT_AND_COMMIT_CONVENTIONS.md).

### 3.1 Branch Naming
Use descriptive branch names with appropriate prefixes:
- `feat/<feature-name>`: New user-facing or platform features.
- `fix/<issue-name>`: Bug fixes and security patches.
- `docs/<topic>`: Documentation enhancements or ADR updates.
- `refactor/<scope>`: Code refactoring without behavioral changes.
- `test/<scope>`: Adding or modifying test suites.
- `chore/<task>`: Dependency updates, CI workflows, build tooling.

### 3.2 Commit Messages
```text
<type>(<scope>): <short description in imperative present tense>

[optional body explaining context and rationale]

[optional footer(s) such as Closes #123, Fixes SEC-01]
```

**Allowed types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.  
**Allowed scopes:** `api`, `dashboard`, `worker`, `domain`, `contracts`, `application`, `database`, `security`, `deployment-providers`, `deployment-engine`, `observability`, `job-queue`, `ai`, `config`, `docker`, `ci`, `release`.

---

## 4. Engineering & Architectural Standards

All contributions must adhere to our authoritative engineering standards:
1. **[Engineering Standards](docs/engineering/ENGINEERING_STANDARDS.md)**: Rules for code quality, API contracts, database operations, security engineering, and reliability.
2. **[Coding Conventions](docs/engineering/CODING_CONVENTIONS.md)**: Strict TypeScript (`"strict": true`, no `any`), custom domain error hierarchy, and async cleanup patterns.
3. **[Architectural Project Boundaries](docs/architecture/PROJECT_BOUNDARIES.md)**: Inward dependency flow towards pure `@opspilot/domain` (0 external dependencies).
4. **[Testing Standards](docs/engineering/TESTING_STANDARDS.md)**: Risk-weighted testing pyramid, deterministic mocking rules, and multi-tenant isolation tests.
5. **[Control Plane vs. Execution Plane](docs/architecture/CONTROL_PLANE_AND_EXECUTION_PLANE.md)**: Strict credential firewall; zero secrets inside untrusted build runner containers.

---

## 5. Pull Request (PR) Workflow

1. **Keep PRs Atomic:** Submit focused PRs matching atomic boundaries defined in the [Phased Implementation Roadmap](docs/phases/PROJECT_IMPLEMENTATION_ROADMAP.md).
2. **Include Tests:** All domain logic, state machines, and cryptographic flows require accompanying unit/integration tests.
3. **Run Pre-flight Checks Locally:**
   ```bash
   npm run verify
   ```
   (Runs linting, typechecking, and unit tests).
4. **Complete the PR Template:** Fill out [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md).
5. **Review & Ownership:** PRs are reviewed by designated code owners specified in [`.github/CODEOWNERS`](.github/CODEOWNERS).
6. **Merge Strategy:** Squash and merge is enforced on `main` to maintain linear history.
