# Canonical Error Codes Reference

> **Standard:** Machine-Readable Platform Error Identifiers  
> **Status:** Authoritative API Contract

Every non-2xx error returned by the OpsPilot REST API or logged by background workers includes a machine-readable `code` string.

---

## Error Code Registry

| Error Code | HTTP Status | Description | User Remediation |
|---|:---:|---|---|
| `VALIDATION_FAILED` | 400 | Request body failed Zod or DTO schema validation. | Check `details` array for malformed field names and constraints. |
| `INVALID_CREDENTIALS` | 401 | Email or password incorrect. | Verify credentials; reset password if forgotten. |
| `SESSION_EXPIRED` | 401 | Access token expired or invalid. | Refresh session via `POST /auth/refresh`. |
| `TENANT_ACCESS_DENIED` | 403 | User is not an active member of the requested organization. | Request an invitation from the organization owner. |
| `ROLE_PERMISSION_DENIED` | 403 | User's role lacks permission for this specific action. | Contact organization admin to upgrade role (e.g., from Viewer to Engineer). |
| `RESOURCE_NOT_FOUND` | 404 | Target entity (project, service, deployment, incident) does not exist in tenant. | Verify UUID parameter and active organization context. |
| `RESOURCE_CONFLICT` | 409 | Unique slug or name collision. | Choose a unique name or slug. |
| `INVALID_STATE_TRANSITION` | 409 | Attempted invalid lifecycle transition (e.g., rolling back an already Succeeded rollback). | Refresh UI to view latest deployment status. |
| `RATE_LIMIT_EXCEEDED` | 429 | Request rate limit exceeded. | Implement exponential backoff in client scripts. |
| `BUILD_FAILED` | 500 | Docker image compilation exited non-zero in the build runner. | Inspect build logs for syntax or dependency compilation errors. |
| `PROVIDER_CONNECTION_FAILED` | 502 | Unable to communicate with AWS STS, ECS, or VPS SSH server. | Validate infrastructure credentials, security groups, and target firewall rules. |
| `HEALTH_CHECK_TIMEOUT` | 504 | Post-deployment synthetic health check timed out. | Check container logs for application startup crashes or wrong container port. |
| `AI_PROVIDER_ERROR` | 502 | LLM provider (Gemini / Claude / OpenAI) returned an error or timed out. | Check provider status; verify API key and quota. |
