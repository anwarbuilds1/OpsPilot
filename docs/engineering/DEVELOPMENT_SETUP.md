# Development Setup & Contributor Guide

> **Target OS:** Ubuntu / Debian, macOS, Windows (via WSL2)  
> **Prerequisites:** Node.js 20 LTS, npm 10+, Docker Engine 24+

This guide walks an engineer or AI assistant through setting up a complete local development environment for OpsPilot from scratch.

---

## 1. Prerequisites Verification

Verify required tooling before beginning setup:

```bash
# Check Node.js version (Must be >= 20.0.0)
node -v

# Check npm version (Must be >= 10.0.0)
npm -v

# Check Docker & Docker Compose
docker -v
docker compose version

# Check Git
git --version
```

---

## 2. Step-by-Step Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/anwar/OpsPilot.git
cd OpsPilot
```

### Step 2: Configure Local Environment
```bash
cp .env.example .env
```
Generate a secure local 256-bit encryption key and update `MASTER_ENCRYPTION_KEY` in `.env`:
```bash
# Generate 64-char hex key
openssl rand -hex 32
```

### Step 3: Start Backing Services (PostgreSQL & Redis)
OpsPilot provides a pre-configured Docker Compose file for local development:
```bash
docker compose -f docker/docker-compose.dev.yml up -d
```
Verify that containers are healthy:
```bash
docker compose -f docker/docker-compose.dev.yml ps
```
- PostgreSQL should be listening on port `5432`.
- Redis should be listening on port `6379`.

### Step 4: Install Monorepo Dependencies
```bash
npm install
```

### Step 5: Initialize Database Schema & Seed Data
```bash
# Run database migrations
npm run db:migrate:up

# (Optional) Seed with sample projects and services
npm run db:seed
```

### Step 6: Start Application Development Servers
```bash
# Starts API, Workers, and Dashboard concurrently
npm run dev
```
- **Next.js Dashboard:** `http://localhost:3000`
- **NestJS API Server:** `http://localhost:3001/api/v1`
- **API Swagger / OpenAPI Docs:** `http://localhost:3001/api/docs`

---

## 3. Running Test Suites

```bash
# Run unit tests across all packages
npm run test

# Run unit tests in watch mode
npm run test:watch

# Run multi-tenant integration tests
npm run test:integration

# Run linter and type checker
npm run lint
npm run typecheck
```

---

## 4. Common Troubleshooting & Gotchas

### Issue 1: `connect ECONNREFUSED 127.0.0.1:5432`
- **Cause:** PostgreSQL container is not running or port 5432 is in conflict with a host PostgreSQL instance.
- **Fix:** Check `docker ps`. If a local PostgreSQL instance is running on the host, either stop it (`sudo systemctl stop postgresql`) or change the exposed port in `docker-compose.dev.yml` to `5433` and update `DATABASE_URL` in `.env`.

### Issue 2: `Invalid MASTER_ENCRYPTION_KEY length`
- **Cause:** The master key must be exactly 64 hex characters (32 bytes).
- **Fix:** Run `openssl rand -hex 32` and paste the exact output into `.env`.

### Issue 3: Docker Runner Fails with Permission Denied
- **Cause:** Running Docker commands without proper group permissions on Linux.
- **Fix:** Ensure your Linux user belongs to the `docker` group: `sudo usermod -aG docker $USER`.
