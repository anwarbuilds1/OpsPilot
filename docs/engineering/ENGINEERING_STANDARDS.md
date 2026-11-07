# OpsPilot — Engineering Standards Specification

> **Audience:** All Software Engineers, Systems Architects, AI Agents  
> **Status:** Mandatory Engineering Specification  
> **Date:** November 2026

---

## 1. Overview & Core Philosophy

OpsPilot is an infrastructure-critical platform that orchestrates deployments, manages cloud credentials, and investigates production incidents. Consequently, code quality, reliability, and security take absolute precedence over implementation speed.

This specification details the mandatory engineering standards across five domains:
1. **Code Quality & Architecture**
2. **API Engineering**
3. **Database Engineering**
4. **Security Engineering**
5. **Reliability Engineering**

---

## 2. Code Quality & Architecture Standards

### 2.1 File & Directory Conventions
- **Kebab-Case Naming:** All source files, directories, test files, and documentation must use lowercase `kebab-case` (e.g., `deployment-execution-engine.ts`, `integrations.repository.ts`).
- **Semantic Suffixes:** Suffix files by architectural role:
  - `*.entity.ts`: Pure domain entities.
  - `*.value-object.ts`: Domain value objects.
  - `*.use-case.ts`: Application workflows.
  - `*.port.ts`: Abstract interfaces.
  - `*.repository.ts`: Database adapters.
  - `*.provider.ts`: Cloud deployment adapters.
  - `*.spec.ts`: Unit and integration test suites.

### 2.2 Error Handling & Domain Exceptions
- **No Generic Errors:** Never throw raw `new Error("something broke")`. All domain failures must throw custom domain exceptions inheriting from `OpsPilotException`:
  ```typescript
  export abstract class OpsPilotException extends Error {
    abstract readonly code: string;
    abstract readonly httpStatus: number;
    constructor(message: string, public readonly details?: Record<string, unknown>) {
      super(message);
      Object.setPrototypeOf(this, new.target.prototype);
    }
  }
  ```
- **Never Leak Stack Traces:** Client-facing responses must return the standard error format; internal stack traces must only be logged to secure control plane logging streams.

### 2.3 Logging Standards
- **Structured JSON Logging:** Use structured key-value logging exclusively. Unstructured string concatenation (`console.log("Starting " + id)`) is strictly forbidden.
- **Mandatory Correlation IDs:** Every log entry must include `organizationId`, `traceId`, and `deploymentId` (or `incidentId`) when operating within an asynchronous job.
- **Automatic Secret Redaction:** All loggers must route through the `SecretRedactor` pipeline to prevent accidental token or password leakage.

### 2.4 Configuration & Validation
- **Fail-Closed Startup:** All environment configuration must be validated at application startup using Zod schemas (`packages/config`). If any required variable is missing, malformed, or has weak entropy, the application must terminate with a fatal error immediately.
- **No Hardcoded Defaults for Secrets:** Never provide fallback strings for master keys, API credentials, or encryption keys in production.

### 2.5 Async Behavior & Resource Cleanup
- **Strict Promise Handling:** Floating promises (`void asyncFn()`) without deliberate `.catch()` handlers are forbidden.
- **Deterministic Cleanup:** File handles, database transactions, child processes, and temporary build directories must use `try...finally` blocks or `AsyncDisposable` (`using` keyword) to prevent resource leaks.

---

## 3. API Engineering Standards

### 3.1 Versioning & Routing
- **URI Versioning:** All public endpoints must be prefixed with `/api/v1/`.
- **Resource-Oriented URLs:** Use plural nouns for resources:
  - `POST /api/v1/projects/:projectId/services`
  - `GET /api/v1/services/:serviceId/deployments`
  - `POST /api/v1/deployments/:deploymentId/rollback`

### 3.2 Request & Response Contracts
- **Schema Single Source of Truth:** All endpoints must define their input DTOs and response DTOs using Zod schemas in `packages/contracts`.
- **Validation Pipes:** Controllers must reject untyped or unexpected properties (`strip` or `strict` mode in Zod).

### 3.3 Authentication & Authorization
- **Bearer JWT Tokens:** Stateless API requests authenticate via signed JWTs or scoped Personal Access Tokens (PATs).
- **Mandatory Tenant Scoping:** Every authenticated request resolves an `organizationId`. Controllers and application services must deterministically verify that the user is an active member of that organization before processing any operation.

### 3.4 Rate Limiting & Pagination
- **Tiered Rate Limiting:** API endpoints enforce IP-based and organization-based rate limits via Redis token buckets (default: 120 req/min for read endpoints, 30 req/min for mutating actions).
- **Cursor-Based Pagination:** List endpoints returning unbounded datasets (logs, deployment history) must use cursor-based pagination with `limit` (max: 100) and `cursor` (base64 opaque token).

### 3.5 Idempotency
- **Idempotency-Key Header:** Mutating requests (`POST /deployments`, `POST /rollbacks`) accept an `Idempotency-Key` header (UUIDv4). The API caches the processing status in Redis for 24 hours to prevent duplicate deployments during network retries.

---

## 4. Database Engineering Standards

### 4.1 Schema Evolution & Migrations
- **Linear SQL Migrations:** All schema changes must be written in plain SQL migrations (`packages/database/src/migrations/XXXX_description.sql`) accompanied by a matching `XXXX_description.down.sql`.
- **Non-Destructive Evolution:** Never execute destructive DDL (`DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN TYPE`) without a multi-phase transition plan (expand-contract pattern).

### 4.2 Tenant Isolation
- **Row-Level Organization ID:** Every database entity must include an `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`.
- **Parameterized Tenant Scope:** Queries must explicitly filter by `organization_id`:
  ```typescript
  // REQUIRED: Scoped by tenant
  const deployment = await db.query(
    'SELECT * FROM deployments WHERE id = $1 AND organization_id = $2',
    [deploymentId, organizationId]
  );
  ```

### 4.3 Transaction Boundaries & Concurrency
- **Multi-Table Updates:** Any operation mutating multiple tables (e.g. creating a service and registering initial deployment) must execute inside an explicit `BEGIN ... COMMIT` database transaction.
- **Row Locking for Mutations:** Critical state machine transitions must use `SELECT ... FOR UPDATE` or distributed advisory locks to prevent race conditions during concurrent webhook deliveries.

---

## 5. Security Engineering Standards

### 5.1 NIST SP 800-57 Envelope Encryption
- **No Shared Master Keys:** Data is never encrypted directly with a master key.
- **Random Per-Record DEKs:** Every secret row generates a cryptographically random 256-bit DEK (`crypto.randomBytes(32)`), which is wrapped using the KEK via AES-256 Key Wrap and stored alongside the ciphertext.
- **Authenticated Additional Data (AAD):** `organizationId` and `integrationId` are bound to the AES-256-GCM cipher as AAD, mathematically preventing cross-tenant decryption.

### 5.2 Build Sandbox & Untrusted Execution
- **Zero Root Execution:** Build runner containers must run as UID `10001` with `--cap-drop ALL` and `--security-opt no-new-privileges`.
- **Network Egress Firewall:** Reject all traffic to link-local cloud metadata IPs (`169.254.169.254`) and internal RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- **No Shell Eval:** Untrusted customer build scripts must be executed via `exec` argument arrays, never passed to shell `eval`.

### 5.3 AI Tooling Constraints
- **Strictly Read-Only:** All tools exposed to the AI investigation engine must inherit from `BaseInvestigationTool` and perform read-only queries (logs, metrics, git diffs).
- **Mandatory Human Approval:** The AI agent is prohibited from committing code, changing infrastructure, or triggering rollbacks directly. All remediation actions require human approval on a generated pull request.

---

## 6. Reliability Engineering Standards

### 6.1 Timeouts, Retries & Exponential Backoff
- **Explicit Timeouts:** Every external HTTP call (AWS, Cloudflare, GitHub) must specify an explicit timeout (default: 10 seconds for API calls, 300 seconds for asset uploads).
- **Decorrelated Jitter Backoff:** Retries on transient 5xx or network errors must use exponential backoff with full jitter to prevent thundering herd problems.

### 6.2 State Machine Stabilization & Leases
- **Provider Stabilization:** Deployment engines must not initiate health checks immediately after deployment API submission. The engine must poll the provider status until edge propagation and container startup stabilize.
- **Distributed Heartbeat Leases:** Active background worker jobs must renew a database lease every 15 seconds. If a worker crashes, the lease expires after 45 seconds, allowing the reconciliation cron to recover or fail the job cleanly.
