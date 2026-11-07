# OpsPilot — Environment Configuration Catalog

> **Audience:** Contributors, DevOps Engineers, System Administrators  
> **Status:** Authoritative Configuration Specification  
> **Date:** November 2026

---

## 1. Overview & Validation Philosophy

OpsPilot centralizes environment variable validation in `packages/config` using strict Zod schemas. The platform enforces **fail-closed initialization**: if any required variable is missing, malformed, or violates security constraints (e.g. insufficient entropy in cryptographic keys), the application halts immediately during the bootstrap phase.

> [!CAUTION]
> Production deployments strictly forbid default fallbacks for secrets and master keys (`SEC-02`). Any fallback to hardcoded strings is treated as a critical security defect.

---

## 2. Environment Variables Catalog

### 2.1 Core System & Security Configuration

| Variable | Type | Default | Secret? | Description |
|---|---|---|---|---|
| `NODE_ENV` | `string` | `development` | No | Runtime environment (`development`, `test`, `production`). |
| `PORT` | `number` | `3000` | No | Port on which the API server (`apps/api`) listens. |
| `OPSPILOT_MASTER_KEY` | `string (hex)` | *None (Required)* | **YES** | 256-bit Key Encryption Key (KEK) used to wrap per-record DEKs. Must be exactly 64 hex characters (32 bytes). |
| `OPSPILOT_KEK_ID` | `string` | `kek-2026-v1` | No | Key identifier used to tag encrypted records for key rotation. |
| `JWT_SECRET` | `string` | *None (Required)* | **YES** | Secret key used to sign and verify user session JWTs (minimum 32 characters). |
| `ENCRYPTION_ALGORITHM` | `string` | `aes-256-gcm` | No | Authenticated cipher used for envelope encryption. |

### 2.2 Database & Storage Backing Services

| Variable | Type | Default | Secret? | Description |
|---|---|---|---|---|
| `DATABASE_URL` | `string (url)` | `postgresql://localhost:5432/opspilot` | **YES** | PostgreSQL connection string including user credentials. |
| `DATABASE_POOL_MIN` | `number` | `2` | No | Minimum connection pool size. |
| `DATABASE_POOL_MAX` | `number` | `20` | No | Maximum connection pool size. |
| `REDIS_URL` | `string (url)` | `redis://localhost:6379` | **YES** | Redis connection URI for BullMQ job queues and distributed caching. |

### 2.3 Cloud Provider Credentials (Optional / Opt-In Live Tests)

> [!NOTE]
> In production multi-tenant environments, customer cloud credentials are stored encrypted in the database (`integration_credentials`). These environment variables are only used for local platform testing or opt-in live verification.

| Variable | Type | Default | Secret? | Description |
|---|---|---|---|---|
| `OPSPILOT_LIVE_TESTS` | `boolean` | `false` | No | Set to `true` to enable live cloud tests against external APIs. |
| `CLOUDFLARE_API_TOKEN` | `string` | *None* | **YES** | API token for opt-in live Cloudflare provider tests. |
| `CLOUDFLARE_ACCOUNT_ID`| `string` | *None* | No | Target Cloudflare account ID for opt-in tests. |
| `AWS_REGION` | `string` | `us-east-1` | No | AWS region for ECS tests. |
| `AWS_ACCESS_KEY_ID` | `string` | *None* | **YES** | AWS access key for ECS tests. |
| `AWS_SECRET_ACCESS_KEY`| `string` | *None* | **YES** | AWS secret access key for ECS tests. |

### 2.4 AI Investigation Engine (Phase 6)

| Variable | Type | Default | Secret? | Description |
|---|---|---|---|---|
| `AI_PROVIDER` | `string` | `anthropic` | No | Active LLM provider (`anthropic`, `openai`, `gemini`). |
| `ANTHROPIC_API_KEY` | `string` | *None* | **YES** | Anthropic Claude API key for autonomous incident analysis. |
| `OPENAI_API_KEY` | `string` | *None* | **YES** | OpenAI API key. |
| `GEMINI_API_KEY` | `string` | *None* | **YES** | Google Gemini API key. |

### 2.5 Observability & Logging

| Variable | Type | Default | Secret? | Description |
|---|---|---|---|---|
| `LOG_LEVEL` | `string` | `info` | No | Logging verbosity (`debug`, `info`, `warn`, `error`). |
| `OTEL_EXPORTER_OTLP_ENDPOINT`| `string (url)`| *None* | No | OpenTelemetry collector endpoint for traces and metrics. |

---

## 3. Zod Configuration Validation Pattern

All applications validate configuration at startup using the pattern defined in `@opspilot/config`:

```typescript
import { z } from 'zod';

export const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  OPSPILOT_MASTER_KEY: z.string().refine((val) => {
    // Must be exactly 64 hex characters (32 bytes / 256 bits)
    return /^[0-9a-fA-F]{64}$/.test(val);
  }, { message: 'OPSPILOT_MASTER_KEY must be a valid 64-character hex string (32 bytes)' }),
  OPSPILOT_KEK_ID: z.string().default('kek-2026-v1'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(env = process.env): AppConfig {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    console.error('❌ Fatal Configuration Error: Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}
```

---

## 4. Key Rotation Procedures

When rotating `OPSPILOT_MASTER_KEY`:
1. Generate new 32-byte key: `NEW_MASTER_KEY`.
2. Configure application with `NEW_MASTER_KEY` under key ID `kek-2026-v2`, while providing the previous key under `OPSPILOT_PREVIOUS_MASTER_KEYS`.
3. Application writes new credentials using `kek-2026-v2`.
4. Run background migration job `npm run security:re-encrypt` to decrypt records using `kek-2026-v1` and re-wrap DEKs using `kek-2026-v2`.
5. Remove `kek-2026-v1` from configuration once zero records reference it.
