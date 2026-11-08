# OpsPilot — Local Development Guide

> **Audience:** Contributors, Platform Engineers, Systems Developers  
> **Status:** Authoritative Development Guide  
> **Date:** November 2026

---

## 1. Prerequisites

Before setting up OpsPilot locally, ensure your workstation meets the following requirements:

- **Operating System:** Linux (Ubuntu 22.04+ or similar) or macOS. Windows is supported via WSL2.
- **Node.js:** `v20.x` LTS (`v20.20.2` verified)
- **NPM:** `v10.x` or later (`10.8.2` verified)
- **PostgreSQL:** Version 16+ (PostgreSQL 18.6 verified via Unix socket `/var/run/postgresql:5432`)
- **Redis (Optional / Future Scale):** Version 7.x+ (superseded by Decision 7 for v0.1.0; PostgreSQL-backed queues are used initially)
- **Docker:** Docker Engine 24.x+ with Buildx (required for executing isolated build runners)
- **Git:** 2.40+

---

## 2. Quickstart & Local Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/anwar/OpsPilot.git
cd OpsPilot
```

### Step 2: Install Workspace Dependencies
OpsPilot uses npm workspaces. Run the installation from the monorepo root:
```bash
npm install
```

### Step 3: Configure Environment Variables
Copy the development template to `.env`:
```bash
cp .env.example .env
```
Generate a cryptographically secure 256-bit master key for local envelope encryption:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Set the resulting 64-character string as `OPSPILOT_MASTER_KEY` in `.env`.

> [!WARNING]
> OpsPilot enforces fail-closed cryptographic security. If `OPSPILOT_MASTER_KEY` is missing or has fewer than 32 bytes of entropy, core services and tests will refuse to start.

### Step 4: Initialize the PostgreSQL Database
If running a local PostgreSQL instance:
```bash
createdb opspilot_dev
createdb opspilot_test
```
Apply the database migrations:
```bash
npm run db:migrate
```

Alternatively, use Docker Compose to start local backing services (see [Docker Compose Local Development Guide](../deployment/DOCKER_COMPOSE_DEVELOPMENT.md)):
```bash
docker compose -f infrastructure/docker-compose.dev.yml up -d
```

### Step 5: Build Monorepo Packages
Compile TypeScript packages in dependency order:
```bash
npm run build
```

---

## 3. Running Tests

### Running Fast Unit Tests
Run in-memory domain, contract, and security unit tests:
```bash
npm run test
```

### Running with Watch Mode
```bash
npx vitest
```

### Running Database Integration Tests
Ensure PostgreSQL is active and point the test runner to your test database:
```bash
DATABASE_URL="postgresql://$(whoami)@localhost:5432/opspilot_test" npm test
```

### Running Monorepo Verification
Before pushing code, run the full verification pipeline:
```bash
npm run verify
```
This executes:
1. `npm run lint` — ESLint strict rules.
2. `npm run typecheck` — `tsc --build` checking all project references.
3. `npm run test` — All unit and integration test suites.

---

## 4. Common Local Development Workflows

### Developing a New Provider Adapter
1. Provider adapters reside in `packages/deployment-providers/src/providers/`.
2. Implement the `DeploymentProvider` interface defined in `@opspilot/domain`.
3. Add contract tests in `packages/deployment-providers/tests/` using mocked network fixtures.

### Database Migrations
1. Schema files reside in `packages/database/src/migrations/`.
2. Always author matching up and down migrations:
   - `000X_migration_name.sql`
   - `000X_migration_name.down.sql`
3. Test migration rollbacks locally before committing.
