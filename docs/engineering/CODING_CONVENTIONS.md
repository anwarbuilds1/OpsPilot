# OpsPilot — Coding Conventions & TypeScript Style Guide

> **Audience:** All Software Engineers, Systems Architects, AI Agents
> **Target Language:** TypeScript 5.x / Node.js 20 LTS
> **Linter:** ESLint + Prettier
> **Status:** Mandatory Specification
> **Date:** November 2026

---

## 1. TypeScript Strictness & Type Safety

OpsPilot enforces maximum TypeScript strictness across all workspaces via root and package `tsconfig.json` configurations:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### 1.1 Ban on `any`
- The `any` type is **strictly forbidden** in all source and test files.
- Where data shape is unknown (e.g. deserializing JSON, external API responses, webhook payloads), use `unknown` accompanied by runtime validation via Zod schemas.

### 1.2 Explicit Return Types
- All public functions, NestJS service methods, repository operations, and controller endpoints **must declare explicit return types**.
- Do not rely on type inference for exported module boundaries.
```typescript
// CORRECT
public async getService(serviceId: string): Promise<ServiceDto> { ... }

// FORBIDDEN
public async getService(serviceId: string) { ... }
```

### 1.3 Immutability by Default
- Prefer `readonly` properties for domain entities and value objects to guarantee immutability across module boundaries.
- Array and object parameters in domain services should use `ReadonlyArray<T>` or `readonly` properties unless explicit mutation is required and justified.

---

## 2. Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| **Files & Directories** | Lowercase `kebab-case` | `deployment-execution-engine.ts`, `auth/` |
| **Classes & Types** | `PascalCase` | `DeploymentExecutionEngine`, `ServiceStatus` |
| **Interfaces** | `PascalCase` (No `I` prefix except pure Ports) | `DeploymentProvider`, `IDeploymentRepository` |
| **Functions & Methods** | `camelCase` | `triggerDeployment()`, `getDecryptedSecret()` |
| **Variables & Properties** | `camelCase` | `organizationId`, `leaseExpiresAt` |
| **Global Constants & Enums**| `UPPER_SNAKE_CASE` | `MAX_DEPLOYMENT_TIMEOUT_MS`, `DEPLOYMENT_STATUS` |
| **Database Tables & Columns**| Lowercase `snake_case` | `deployment_history`, `lease_expires_at` |

---

## 3. Directory Layout & Organization

Every package in `packages/*` and application in `apps/*` must follow this structure:

```text
package-or-app/
├── src/
│   ├── index.ts               # Canonical public exports
│   ├── submodules/            # Grouped by domain concept
│   └── errors/                # Package-specific domain exceptions
├── tests/
│   ├── *.spec.ts              # Unit and integration test suites
│   └── fixtures/              # Static test data and mocks
├── package.json
├── tsconfig.json
└── README.md                  # Package usage documentation
```

---

## 4. Error Handling Contracts

### 4.1 Custom Domain Exception Hierarchy
Every package that raises errors must define specific domain exception classes extending `OpsPilotException`:

```typescript
// packages/domain/src/errors/domain-exception.ts
export abstract class OpsPilotException extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;

  constructor(
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}
```

### 4.2 Standard Error Response Payload
API responses returning errors must conform to the contract defined in `docs/engineering/API_ERROR_CONTRACT.md`:
```json
{
  "error": {
    "code": "INTEGRATION_NOT_ACTIVE",
    "message": "The integration credentials cannot be accessed because the integration is revoked.",
    "details": {
      "integrationId": "d135cbf8-8096-4074-bfe5-f9389280d0d8",
      "status": "revoked"
    },
    "traceId": "7c88b0a9f0e14c38"
  }
}
```

---

## 5. Asynchronous Programming Guidelines

1. **Prefer `async`/`await`:** Always use `async`/`await` over raw `.then()` / `.catch()` callback chains.
2. **Parallel Operations:** Use `Promise.all()` only when all operations must succeed, or `Promise.allSettled()` when failures must be handled individually.
3. **No Unhandled Rejections:** Floating promises (`void someAsyncCall()`) are strictly forbidden unless explicitly wrapped in an error handler with structured logging.

---

## 6. Resource Disposal & Cleanup

When acquiring ephemeral system resources (temporary directories, database pool clients, child processes, file descriptors), always use explicit cleanup logic:

```typescript
// Deterministic resource cleanup pattern
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opspilot-build-'));
try {
  await runBuildInDirectory(tempDir);
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
```

---

## 7. Import Order & Boundary Hygiene

Imports within any TypeScript file must be organized into four distinct groups separated by a single newline:

1. **Node.js Built-in Modules:** `node:crypto`, `node:fs`, `node:path`.
2. **Third-Party Libraries:** `zod`, `pg`, `@nestjs/common`.
3. **Internal OpsPilot Monorepo Packages:** `@opspilot/domain`, `@opspilot/contracts`.
4. **Local Relative Modules:** `./deployment.entity`, `../repositories/base.repository`.

```typescript
// 1. Node.js built-ins
import * as crypto from 'node:crypto';
import * as path from 'node:path';

// 2. Third-party packages
import { z } from 'zod';

// 3. Monorepo packages
import { Deployment, DeploymentStatus } from '@opspilot/domain';
import { CreateDeploymentDto } from '@opspilot/contracts';

// 4. Local relative imports
import { IntegrationsRepository } from './integrations.repository';
```

---

## 8. Layer Boundaries & Controller Responsibilities

- Business logic resides strictly within domain services and use cases (`packages/domain`, `packages/application`), **never** in HTTP controllers or background worker scripts.
- Controllers in `apps/api` are thin adapters responsible solely for:
  1. Validating incoming DTOs using Zod or `class-validator`.
  2. Extracting and validating tenant context from the request session.
  3. Calling the appropriate domain or application use case.
  4. Formatting and serializing the HTTP response.

---

## 9. Documentation & Comment Integrity

- **Preserve Existing Documentation:** Maintain all existing technical rationale comments, architecture docstrings, and license headers when refactoring code.
- **JSDoc Standards:** All public interfaces, exported functions, and complex algorithms must include JSDoc comments explaining preconditions, side effects, failure modes, and security constraints.
