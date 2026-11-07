# OpsPilot — Git & Commit Governance Standards

> **Audience:** All Contributors, Maintainers, Automation Agents  
> **Status:** Mandatory Specification  
> **Date:** November 2026

---

## 1. Commit Message Format (Conventional Commits)

OpsPilot adheres strictly to the **Conventional Commits v1.0.0** specification. Automated changelog generation, SemVer bumping, and CI validation rely on this convention.

### 1.1 Commit Anatomy
```text
<type>(<scope>): <short summary in imperative present tense>

[optional body explaining motivation, architectural rationale, and context]

[optional footer(s): BREAKING CHANGE, Closes #123, Fixes SEC-01]
```

### 1.2 Allowed Types

| Type | Purpose | Example |
|---|---|---|
| `feat` | Introduces a new feature or user-facing capability | `feat(api): add deployment rollback endpoint` |
| `fix` | Patches a bug, security flaw, or incorrect behavior | `fix(security): eliminate default master key fallback (SEC-02)` |
| `docs` | Documentation additions or revisions | `docs(architecture): define package boundary rules` |
| `refactor` | Code restructuring without altering external behavior | `refactor(engine): extract deployment state machine` |
| `test` | Adding missing tests or refactoring test fixtures | `test(database): add integration tests for lease expiration` |
| `perf` | Code change that improves performance | `perf(database): add compound index for active deployments` |
| `ci` | Changes to CI workflows, scripts, or tooling | `ci(github): add monorepo boundary linting job` |
| `build` | Changes to build process, workspace configs, or deps | `build(tsconfig): enable exactOptionalPropertyTypes` |
| `chore` | Maintenance tasks, license updates, housekeeping | `chore(governance): add Apache-2.0 license file` |
| `revert` | Reverts a previous commit | `revert: "feat(cloudflare): support direct upload"` |

### 1.3 Allowed Scopes
Scopes must identify the exact workspace package, application, or functional subsystem affected:
- **Applications:** `api`, `dashboard`, `worker`
- **Packages:** `domain`, `contracts`, `application`, `database`, `security`, `deployment-providers`, `deployment-engine`, `observability`, `job-queue`, `ai`, `config`
- **Infrastructure & Cross-Cutting:** `docker`, `ci`, `deps`, `governance`, `release`

---

## 2. Atomic Commits & PR Boundaries

### 2.1 The Atomic Commit Rule
- **Single Responsibility:** Each commit must perform one logical change.
- **Never Mix Concerns:** Do not combine documentation, refactoring, and bug fixing into a single commit.
- **Always Compilable:** Every individual commit on `main` must compile cleanly and pass all unit tests.

### 2.2 Branch Naming Conventions
Branches must follow the format `<type>/<kebab-case-description>`:
- `feat/pages-direct-upload`
- `fix/sec-01-envelope-encryption`
- `docs/project-boundaries`
- `refactor/extract-deployment-engine`

---

## 3. Pull Request & Review Standards

### 3.1 PR Requirements
1. **Title:** Must follow the Conventional Commits format matching the primary change.
2. **PR Template:** Must complete the OpsPilot PR template (`.github/PULL_REQUEST_TEMPLATE.md`), detailing:
   - Problem solved and motivation.
   - Architectural changes / ADR references.
   - Verification evidence (test commands run and results).
   - Security impact assessment (tenant isolation, credential safety).
3. **Automated Checks:** All CI jobs (lint, typecheck, unit tests, security scans) must pass before review.

### 3.2 Review & Merge Policy
- **Minimum Approvals:** Every PR requires at least one approving review from a Core Maintainer (defined in `.github/CODEOWNERS`).
- **Merge Strategy:** **Squash and Merge** is standard for feature branches to keep `main` history linear and clean. The squash commit message must follow Conventional Commits format.

---

## 4. Release Tagging & SemVer

OpsPilot follows **Semantic Versioning 2.0.0 (`MAJOR.MINOR.PATCH`)**:
- **PATCH** (`0.1.X`): Backward-compatible bug fixes and security patches (`fix:`).
- **MINOR** (`0.X.0`): Backward-compatible new features and providers (`feat:`).
- **MAJOR** (`X.0.0`): Breaking changes to API contracts, domain events, or database schemas (`BREAKING CHANGE:`).

Tags are signed using Git tag format `vX.Y.Z` (e.g. `v0.1.0`).
