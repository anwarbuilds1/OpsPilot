# Coding Standards & TypeScript Conventions

> **Target Language:** TypeScript 5.x / Node.js 20 LTS  
> **Linter:** ESLint + Prettier  
> **Status:** Mandatory Engineering Standard

---

## 1. Core TypeScript Standards

1. **Strict Mode Enabled:** `"strict": true` is enforced across all `tsconfig.json` configurations.
2. **Zero `any` Tolerance:** The use of `any` is strictly prohibited in PRs. Use `unknown` with runtime type narrowing (e.g., Zod schemas or type guards) for unvalidated external inputs.
3. **Explicit Return Types:** All public methods in NestJS services, controllers, and utility libraries must declare explicit return types:
   ```typescript
   // CORRECT
   public async getService(serviceId: string): Promise<ServiceDto> { ... }

   // FORBIDDEN
   public async getService(serviceId: string) { ... }
   ```
4. **Immutability by Default:** Prefer `readonly` properties for domain entities and value objects.

---

## 2. Naming Conventions

- **Files & Directories:** `kebab-case.ts` (e.g., `deployment-provider.interface.ts`, `deployments.service.ts`).
- **Classes & Interfaces:** `PascalCase` (e.g., `DeploymentsService`, `DeploymentConfig`).
- **Methods & Variables:** `camelCase` (e.g., `triggerDeployment`, `activeTenantId`).
- **Constants & Enums:** `UPPER_SNAKE_CASE` or `PascalCase` for enum keys:
  ```typescript
  export enum IncidentSeverity {
    Critical = 'Critical',
    High = 'High',
    Medium = 'Medium',
    Low = 'Low'
  }
  ```

---

## 3. Dependency Injection & Service Layer

- Business logic resides strictly within domain services, **never** in HTTP controllers or background worker scripts.
- Controllers are thin adapters responsible solely for:
  1. Validating incoming DTOs.
  2. Extracting tenant context from the request.
  3. Calling the service method.
  4. Formatting the response.

---

## 4. Documentation & Comments

- Preserve all existing technical rationale comments and architectural docstrings.
- Public interfaces and complex algorithms must include JSDoc comments explaining preconditions, failure modes, and security constraints.
