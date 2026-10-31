# Logging Standards & Structured Diagnostics

> **Logging Engine:** Pino / Fastify-Logger  
> **Format:** JSON (NDJSON) in production, pretty-printed in development  
> **Status:** Mandatory Engineering Standard

Consistent, structured logging is critical for auditing, system observability, and feeding sanitized diagnostic data into the AI Investigation Agent.

---

## 1. Structured Log Format

All logs output single-line JSON adhering to the following schema:

```json
{
  "level": "info",
  "time": "2026-11-01T10:15:30.123Z",
  "pid": 12345,
  "hostname": "api-worker-7b9f",
  "context": "DeploymentsService",
  "requestId": "req_8fa2b109c8d7",
  "organizationId": "8f7e6d5c-4b3a-2f1e-0d9c-8b7a6f5e4d3c",
  "serviceId": "5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b",
  "deploymentId": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
  "msg": "ECS Service update initiated successfully"
}
```

---

## 2. Standard Log Levels

| Level | Usage Criteria | Example |
|---|---|---|
| `DEBUG` | Fine-grained diagnostic information for local debugging. Disabled in production by default. | Cache hits, raw payload sizes, SQL execution time. |
| `INFO` | High-level operational events and milestones. | User logged in, deployment queued, health check passed. |
| `WARN` | Unexpected recoverable condition or intermittent degradation. | Health check probe timed out once; rate limit threshold at 80%. |
| `ERROR` | Operation failed; requires intervention or customer notification. | Build runner exited non-zero; database query failed. |
| `FATAL` | Critical unrecoverable failure that causes a process to terminate. | Cannot connect to PostgreSQL on startup; KMS key inaccessible. |

---

## 3. Mandatory Secret Redaction in Logs

The logger configuration utilizes built-in serializers and string masking to ensure credentials are never written to stdout:

```typescript
export const loggerOptions = {
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'secret',
      'token',
      'accessToken',
      'refreshToken',
      'privateKey',
      'encryptedPayload',
      '*.password',
      '*.token'
    ],
    censor: '[REDACTED]'
  }
};
```
