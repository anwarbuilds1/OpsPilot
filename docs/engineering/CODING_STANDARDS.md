# Coding Standards & TypeScript Conventions (Deprecated Reference)

> [!NOTE]
> **Canonical Document Location:** [`docs/engineering/CODING_CONVENTIONS.md`](CODING_CONVENTIONS.md)
> This summary document has been consolidated into the comprehensive **OpsPilot Coding Conventions & TypeScript Style Guide**. All strict TypeScript configurations, naming conventions, error handling hierarchies, and directory structures are authoritatively maintained in that document.

Please refer to the canonical specification:

👉 [**OpsPilot Coding Conventions & TypeScript Style Guide**](CODING_CONVENTIONS.md)

---

### Key Standards Summary (Preserved for Reference)
1. **Strict TypeScript:** Enforce `"strict": true`, zero `any` tolerance (use `unknown` with Zod runtime validation).
2. **Explicit Return Types:** Mandatory on all public functions, NestJS service methods, and controllers.
3. **Naming Conventions:** Lowercase `kebab-case` for files/folders, `PascalCase` for classes/types, `camelCase` for functions/variables.
4. **Thin Controllers:** Business logic resides strictly in domain services; controllers solely handle input validation, tenant context injection, and HTTP formatting.
