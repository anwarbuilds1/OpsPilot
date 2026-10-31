# Investigation Tool Specifications

> **Package:** `apps/api/src/modules/ai-investigation/tools`  
> **Security Classification:** Strict Read-Only  
> **Tenant Enforcement:** Mandatory `organizationId` validation

This document provides the exhaustive specification, JSON schemas, limits, and error handling for all 9 investigation tools accessible to the AI Agent.

---

## 1. `get_service_details`
Retrieves metadata, configuration, environment, and resource allocations for the affected service.

- **Permissions:** Read access to service within organization.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "serviceId": { "type": "string", "description": "The unique UUID of the service" }
  },
  "required": ["serviceId"]
}
```
- **Output Schema:**
```json
{
  "serviceId": "5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b",
  "name": "Payments API",
  "repository": "acme-corp/payments-service",
  "branch": "main",
  "containerPort": 8080,
  "healthcheckPath": "/health",
  "resources": { "cpuUnits": 512, "memoryMb": 1024 },
  "activeDeploymentId": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d"
}
```

---

## 2. `get_recent_deployments`
Retrieves a list of recent deployments for the service, including commit SHAs, timestamps, authors, and final status.

- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "serviceId": { "type": "string" },
    "limit": { "type": "integer", "default": 5, "maximum": 10 }
  },
  "required": ["serviceId"]
}
```
- **Output Schema:**
```json
{
  "deployments": [
    {
      "deploymentId": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
      "commitSha": "8fa2b10",
      "commitMessage": "Refactor database pool configuration",
      "commitAuthor": "Marcus",
      "status": "Succeeded",
      "completedAt": "2026-11-01T10:20:00Z"
    }
  ]
}
```

---

## 3. `get_deployment_details`
Retrieves granular build metadata, configuration diffs, and deployment events for a specific deployment ID.

- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "deploymentId": { "type": "string" }
  },
  "required": ["deploymentId"]
}
```
- **Output Schema:**
```json
{
  "deploymentId": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
  "imageUri": "123456789012.dkr.ecr.us-east-1.amazonaws.com/payments:8fa2b10",
  "provider": "aws_ecs",
  "environmentVariablesChanged": ["DATABASE_POOL_MAX"],
  "events": [
    { "timestamp": "2026-11-01T10:19:30Z", "stage": "Deploying", "message": "Fargate tasks transitioned to RUNNING" }
  ]
}
```

---

## 4. `get_application_logs`
Queries sanitized application `stdout` and `stderr` logs within a bounded time window.

- **Limits:** Max 500 lines or 100 KB. Secret scrubbers applied automatically.
- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "serviceId": { "type": "string" },
    "fromTimestamp": { "type": "string", "description": "ISO 8601 start time" },
    "toTimestamp": { "type": "string", "description": "ISO 8601 end time" },
    "searchQuery": { "type": "string", "description": "Optional keyword or regex filter" }
  },
  "required": ["serviceId", "fromTimestamp"]
}
```
- **Output Schema:**
```json
{
  "logLines": [
    {
      "timestamp": "2026-11-01T10:24:12Z",
      "stream": "stderr",
      "message": "SequelizeConnectionError: ResourceRequest timed out after 30000ms"
    }
  ],
  "truncated": false,
  "lineCount": 1
}
```

---

## 5. `query_metrics`
Retrieves time-series data for CPU, memory, P95 latency, and error counts.

- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "serviceId": { "type": "string" },
    "metricName": { "type": "string", "enum": ["cpu", "memory", "latency_p95", "error_rate_5xx"] },
    "fromTimestamp": { "type": "string" },
    "toTimestamp": { "type": "string" }
  },
  "required": ["serviceId", "metricName", "fromTimestamp"]
}
```
- **Output Schema:**
```json
{
  "metricName": "error_rate_5xx",
  "dataPoints": [
    { "timestamp": "2026-11-01T10:20:00Z", "value": 0.01 },
    { "timestamp": "2026-11-01T10:25:00Z", "value": 0.45 }
  ]
}
```

---

## 6. `get_container_status`
Checks runtime container status across ECS tasks or VPS Docker Compose instances (e.g., exit codes, restart counts, OOM events).

- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "serviceId": { "type": "string" }
  },
  "required": ["serviceId"]
}
```
- **Output Schema:**
```json
{
  "runningTasks": 2,
  "desiredTasks": 2,
  "containers": [
    {
      "containerId": "task-7b9f",
      "status": "RUNNING",
      "lastExitCode": null,
      "oomKilled": false
    }
  ]
}
```

---

## 7. `get_recent_commits`
Retrieves recent Git commit metadata, commit messages, and code diff summaries from GitHub.

- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "serviceId": { "type": "string" },
    "commitSha": { "type": "string", "description": "Target commit SHA to inspect" }
  },
  "required": ["serviceId", "commitSha"]
}
```
- **Output Schema:**
```json
{
  "commitSha": "8fa2b10",
  "author": "Marcus",
  "message": "Refactor database pool configuration",
  "filesChanged": ["src/config/database.ts"],
  "diff": "@@ -12,3 +12,3 @@\n-  max: 20\n+  max: 2"
}
```

---

## 8. `get_health_status`
Retrieves the history of synthetic HTTP health check probes for the service.

- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "serviceId": { "type": "string" },
    "limit": { "type": "integer", "default": 10 }
  },
  "required": ["serviceId"]
}
```
- **Output Schema:**
```json
{
  "healthChecks": [
    { "timestamp": "2026-11-01T10:24:00Z", "statusCode": 500, "latencyMs": 30010, "isHealthy": false },
    { "timestamp": "2026-11-01T10:24:30Z", "statusCode": 500, "latencyMs": 30005, "isHealthy": false },
    { "timestamp": "2026-11-01T10:25:00Z", "statusCode": 500, "latencyMs": 30008, "isHealthy": false }
  ]
}
```

---

## 9. `get_incident_timeline`
Retrieves the unified chronological incident timeline combining alerts, deployments, and configuration events.

- **Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "incidentId": { "type": "string" }
  },
  "required": ["incidentId"]
}
```
- **Output Schema:**
```json
{
  "timeline": [
    { "timestamp": "2026-11-01T10:15:00Z", "type": "git_push", "description": "Commit 8fa2b pushed to main" },
    { "timestamp": "2026-11-01T10:20:00Z", "type": "deployment_succeeded", "description": "Deployment #108 completed" },
    { "timestamp": "2026-11-01T10:25:00Z", "type": "alert_breach", "description": "Health check failed 3 consecutive times" }
  ]
}
```
