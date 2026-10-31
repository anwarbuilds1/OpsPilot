# API Error Contract & Standardized Responses

> **Standard:** RFC 7807 (Problem Details for HTTP APIs)  
> **Status:** Mandatory API Specification

To ensure predictable error handling across the web dashboard, CLI tooling, and SDK clients, all non-2xx HTTP responses from OpsPilot adhere to a uniform JSON error contract.

---

## 1. Standard Error Schema

All error responses return a standardized payload matching this TypeScript interface:

```typescript
export interface ApiErrorResponse {
  statusCode: number;        // HTTP Status Code (e.g., 400, 403, 404, 500)
  error: string;             // Short HTTP error name (e.g., "Forbidden")
  code: string;              // Machine-readable OpsPilot error code (e.g., "AUTH_UNAUTHORIZED")
  message: string;           // Human-readable error description
  details?: Record<string, unknown> | Array<{ field: string; message: string }>; // Granular field errors
  timestamp: string;         // ISO 8601 UTC timestamp
  path: string;              // Request URL path
  requestId: string;         // Unique trace ID for log correlation
}
```

---

## 2. Example Error Responses

### 2.1 Validation Error (HTTP 400 Bad Request)
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "VALIDATION_FAILED",
  "message": "Input validation failed for service creation",
  "details": [
    {
      "field": "containerPort",
      "message": "containerPort must be between 1 and 65535"
    },
    {
      "field": "healthcheckPath",
      "message": "healthcheckPath must start with a forward slash (/)"
    }
  ],
  "timestamp": "2026-11-01T10:05:00.123Z",
  "path": "/api/v1/projects/3c4d5e6f/services",
  "requestId": "req_8fa2b109c8d7"
}
```

### 2.2 Tenant Authorization Failure (HTTP 403 Forbidden)
```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "code": "TENANT_ACCESS_DENIED",
  "message": "User does not have permission to trigger deployments in organization acme-corp",
  "timestamp": "2026-11-01T10:05:15.456Z",
  "path": "/api/v1/services/5e6f7a8b/deployments",
  "requestId": "req_1c2d3e4f5a6b"
}
```

### 2.3 Resource Not Found (HTTP 404 Not Found)
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "code": "RESOURCE_NOT_FOUND",
  "message": "Deployment 7a8b9c0d does not exist in the requested organization",
  "timestamp": "2026-11-01T10:05:30.789Z",
  "path": "/api/v1/deployments/7a8b9c0d",
  "requestId": "req_9e8f7a6b5c4d"
}
```

---

## 3. Security Guidelines for Error Responses

1. **No Stack Traces in Production:** Internal stack traces, raw SQL queries, and ORM exceptions must **never** be included in response bodies.
2. **Generic Authentication Failures:** Invalid password attempts return generic messages (`"Invalid email or password"`) to prevent username enumeration.
3. **No Credential Echoing:** If an API key or token is malformed, never echo the submitted token in the `details` field.
