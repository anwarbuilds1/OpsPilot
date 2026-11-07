# OpsPilot — Continuous Integration & Continuous Delivery (CI/CD) Standards

> **Audience:** DevOps Engineers, Platform Engineers, Contributors  
> **Status:** Mandatory Quality Specification  
> **Date:** November 2026

---

## 1. CI/CD Architecture & Pipeline Overview

OpsPilot uses GitHub Actions for continuous integration, security scanning, and deployment automation. The pipeline follows a multi-stage gated architecture designed to catch syntax errors within seconds while reserving heavier integration and container tests for later stages.

```mermaid
flowchart LR
    subgraph Stage 1: Fast Static Checks ["Stage 1: Fast Static Checks (< 2 min)"]
        LINT["Lint (ESLint)"]
        TYPES["Typecheck (tsc --build)"]
        BOUND["Boundary Lint (Dependency Rules)"]
    end

    subgraph Stage 2: Fast Tests ["Stage 2: Fast Tests (< 3 min)"]
        UNIT["Unit Tests (Domain & Security)"]
        CONTRACT["Contract Tests (Zod Schemas)"]
    end

    subgraph Stage 3: Integration & Security ["Stage 3: Integration & Security (< 7 min)"]
        DB_INT["PostgreSQL Integration Tests"]
        DOCKER["Docker Runner Sandbox Tests"]
        SECSCAN["Secret Scanning (Gitleaks)"]
        VULN["Dependency Audit (Trivy / npm audit)"]
    end

    subgraph Stage 4: Artifact & Release ["Stage 4: Build & Release (On main merge)"]
        BUILD["Production Monorepo Build"]
        CONTAINER["Multi-arch Docker Image Build"]
        SBOM["SBOM Generation & Cosign Signing"]
    end

    Stage 1 --> Stage 2
    Stage 2 --> Stage 3
    Stage 3 --> Stage 4
```

---

## 2. Pipeline Execution Stages

### Stage 1: Fast Static Checks (Runs on every PR and push)
- **Execution Time Goal:** `< 2 minutes`
- **Jobs:**
  1. **Linting:** `npm run lint` — ESLint strict checks across all apps and packages.
  2. **Type Checking:** `npm run typecheck` — `tsc --build` verifying project references with `"strict": true`.
  3. **Monorepo Boundary Check:** Automated script verifying packages do not import from forbidden boundaries.
  4. **Formatting:** `npm run format:check` — Prettier validation.

### Stage 2: Fast Unit & Contract Tests (Runs on every PR)
- **Execution Time Goal:** `< 3 minutes`
- **Jobs:**
  1. **Domain & Security Tests:** Executes Vitest unit tests in `packages/domain`, `packages/contracts`, and `packages/security`.
  2. **Fail-Closed Verification:** Validates that unconfigured environments fail immediately.

### Stage 3: Integration & Security Tests (Runs on every PR)
- **Execution Time Goal:** `< 7 minutes`
- **Jobs:**
  1. **PostgreSQL Migration & Integration:**
     - Boots PostgreSQL 18 service container in GitHub Actions.
     - Runs migration `0001` and `0002` up and down to verify rollback safety.
     - Executes repository integration tests verifying multi-tenant isolation.
  2. **Docker Runner Sandbox Verification:**
     - Builds `docker/runners/NodeJsBuildRunner.Dockerfile`.
     - Executes test build inside container verifying non-root UID, read-only filesystem, and metadata IP block.
  3. **Security Audits:**
     - **Gitleaks:** Scans all commits in PR for accidentally committed API keys, tokens, or private keys.
     - **Trivy / npm audit:** Scans production dependencies for known CVEs.

### Stage 4: Release & Container Publishing (Runs on `main` branch merge)
- **Jobs:**
  1. **Production Build:** Builds Next.js frontend (`apps/dashboard`), NestJS API (`apps/api`), and worker (`apps/worker`).
  2. **Container Image Publication:** Builds multi-arch (`linux/amd64`, `linux/arm64`) Docker images pushed to GitHub Container Registry (`ghcr.io/anwar/opspilot-*`).
  3. **Supply Chain Security:** Generates Software Bill of Materials (SBOM) via Syft and signs container digests using Sigstore Cosign.

---

## 3. Scheduled & Live Infrastructure Testing

Live integration tests against actual cloud providers (AWS ECS, Cloudflare Workers/Pages) are **strictly isolated** from standard PR checks:
- **Never Run on Fork PRs:** Public pull requests from external forks do not have access to GitHub repository secrets.
- **Nightly Scheduled Workflow:** A separate workflow (`.github/workflows/live-providers.yml`) runs nightly at 02:00 UTC against a dedicated sandbox Cloudflare account and AWS test sandbox.
- **Automated Resource Teardown:** The workflow executes a teardown script in a `always()` block to delete any test Worker scripts, Pages projects, or ECS task definitions created during the run.

---

## 4. Local Pre-Commit Verification

Contributors should catch issues before pushing via local pre-commit hooks (Husky & lint-staged):
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```
Contributors can run the complete pre-push verification locally:
```bash
npm run verify
```
This executes linting, typechecking, and unit tests in parallel.
