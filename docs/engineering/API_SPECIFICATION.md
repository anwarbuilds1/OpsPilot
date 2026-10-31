# REST API Specification (v1)

> **Base URL:** `/api/v1`  
> **Protocol:** HTTPS / TLS 1.3  
> **Content-Type:** `application/json`  
> **Authentication:** Bearer JWT or Secure HTTP-only Cookie (`opspilot_session`)

This document provides the exhaustive specification for all OpsPilot REST API endpoints.

---

## 1. Authentication & Session Endpoints

### 1.1 Register User & Create Organization
- **Route:** `POST /api/v1/auth/register`
- **Auth:** Public
- **Rate Limit:** 5 requests / minute
- **Request Body:**
```json
{
  "email": "sarah@acme.dev",
  "password": "CorrectHorseBatteryStaple123!",
  "fullName": "Sarah Connor",
  "organizationName": "Acme Corp",
  "organizationSlug": "acme-corp"
}
```
- **Response (201 Created):**
```json
{
  "user": {
    "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "email": "sarah@acme.dev",
    "fullName": "Sarah Connor"
  },
  "organization": {
    "id": "8f7e6d5c-4b3a-2f1e-0d9c-8b7a6f5e4d3c",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "role": "Owner"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
- **Errors:** `400 Bad Request` (Validation), `409 Conflict` (Email or Slug in use).

---

### 1.2 Login
- **Route:** `POST /api/v1/auth/login`
- **Auth:** Public
- **Rate Limit:** 10 requests / minute
- **Request Body:**
```json
{
  "email": "sarah@acme.dev",
  "password": "CorrectHorseBatteryStaple123!"
}
```
- **Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "email": "sarah@acme.dev"
  },
  "organizations": [
    {
      "id": "8f7e6d5c-4b3a-2f1e-0d9c-8b7a6f5e4d3c",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "role": "Owner"
    }
  ]
}
```

---

## 2. Project & Service Endpoints

### 2.1 List Projects
- **Route:** `GET /api/v1/projects`
- **Headers:** `X-Organization-Id: 8f7e6d5c-4b3a-2f1e-0d9c-8b7a6f5e4d3c`
- **Auth:** Member (`Owner`, `Admin`, `Engineer`, `Viewer`)
- **Response (200 OK):**
```json
{
  "data": [
    {
      "id": "3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f",
      "name": "E-Commerce Core",
      "slug": "ecommerce-core",
      "description": "Core checkout and billing services",
      "serviceCount": 3,
      "createdAt": "2026-11-01T08:00:00Z"
    }
  ]
}
```

---

### 2.2 Create Service in Project
- **Route:** `POST /api/v1/projects/:projectId/services`
- **Headers:** `X-Organization-Id: <org_id>`
- **Auth:** `Admin` or `Owner`
- **Request Body:**
```json
{
  "name": "Payments API",
  "slug": "payments-api",
  "repositoryName": "acme-corp/payments-service",
  "branch": "main",
  "dockerfilePath": "Dockerfile",
  "buildContext": ".",
  "containerPort": 8080,
  "healthcheckPath": "/health",
  "cpuUnits": 512,
  "memoryMb": 1024,
  "deploymentTargetId": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d"
}
```
- **Response (201 Created):**
```json
{
  "id": "5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b",
  "projectId": "3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f",
  "name": "Payments API",
  "slug": "payments-api",
  "status": "Inactive",
  "createdAt": "2026-11-01T09:00:00Z"
}
```

---

## 3. Deployment Endpoints

### 3.1 Trigger Service Deployment
- **Route:** `POST /api/v1/services/:serviceId/deployments`
- **Headers:** `X-Organization-Id: <org_id>`, `Idempotency-Key: <unique_client_token>`
- **Auth:** `Engineer`, `Admin`, `Owner`
- **Request Body (Optional overrides):**
```json
{
  "commitSha": "8fa2b109c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3",
  "environment": "production"
}
```
- **Response (202 Accepted):**
```json
{
  "deploymentId": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
  "serviceId": "5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b",
  "status": "Queued",
  "commitSha": "8fa2b109c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3",
  "queuedAt": "2026-11-01T10:00:00Z",
  "streamLogsUrl": "/api/v1/deployments/7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d/logs/stream"
}
```

---

### 3.2 Get Deployment Details & Logs
- **Route:** `GET /api/v1/deployments/:deploymentId`
- **Auth:** All Roles
- **Response (200 OK):**
```json
{
  "id": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
  "serviceId": "5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b",
  "provider": "aws_ecs",
  "environment": "production",
  "status": "Deploying",
  "commitSha": "8fa2b109c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3",
  "startedAt": "2026-11-01T10:00:05Z",
  "completedAt": null,
  "events": [
    { "timestamp": "2026-11-01T10:00:05Z", "stage": "Preparing", "message": "Worker claimed job" },
    { "timestamp": "2026-11-01T10:00:20Z", "stage": "Building", "message": "Docker image built successfully" },
    { "timestamp": "2026-11-01T10:01:10Z", "stage": "Publishing", "message": "Pushed to Amazon ECR" }
  ]
}
```

---

### 3.3 Trigger Rollback
- **Route:** `POST /api/v1/deployments/:deploymentId/rollback`
- **Auth:** `Engineer`, `Admin`, `Owner`
- **Request Body:**
```json
{
  "reason": "Elevated 500 error rates detected after release"
}
```
- **Response (202 Accepted):**
```json
{
  "rollbackDeploymentId": "1b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
  "originalDeploymentId": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
  "status": "RollingBack",
  "restoringRevision": "arn:aws:ecs:us-east-1:123456789012:task-definition/payments-api:41"
}
```

---

## 4. Incident & AI Investigation Endpoints

### 4.1 List Active Incidents
- **Route:** `GET /api/v1/incidents?status=Open,Investigating`
- **Auth:** All Roles
- **Response (200 OK):**
```json
{
  "data": [
    {
      "id": "inc-402a-9b1c-3d2e",
      "serviceId": "5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b",
      "serviceName": "Payments API",
      "title": "Failing Health Checks (HTTP 500)",
      "severity": "Critical",
      "status": "Investigating",
      "correlatedDeploymentId": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
      "startedAt": "2026-11-01T10:25:00Z"
    }
  ]
}
```

---

### 4.2 Trigger AI Investigation
- **Route:** `POST /api/v1/incidents/:incidentId/investigate`
- **Auth:** `Engineer`, `Admin`, `Owner`
- **Response (202 Accepted):**
```json
{
  "investigationId": "inv-801a-4c2d-9e1f",
  "incidentId": "inc-402a-9b1c-3d2e",
  "status": "Running",
  "estimatedDurationSeconds": 120
}
```

---

### 4.3 Get AI Investigation Report
- **Route:** `GET /api/v1/investigations/:investigationId/report`
- **Auth:** All Roles
- **Response (200 OK):**
```json
{
  "investigationId": "inv-801a-4c2d-9e1f",
  "incidentId": "inc-402a-9b1c-3d2e",
  "serviceId": "5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b",
  "summary": "Database connection pool exhaustion following Deployment #108.",
  "timeWindow": {
    "start": "2026-11-01T10:15:00Z",
    "end": "2026-11-01T10:30:00Z"
  },
  "observations": [
    "HTTP 500 errors surged to 45% at 10:23 UTC.",
    "Logs show repeated SequelizeConnectionError: Connection timeout.",
    "Deployment #108 was completed at 10:20 UTC by Marcus."
  ],
  "probableCause": {
    "hypothesis": "Commit 8fa2b reduced max_pool_size from 20 to 2, causing immediate starvation under concurrent request load.",
    "confidence": "High",
    "rationale": "Code diff directly matches error signatures in CloudWatch logs."
  },
  "supportingEvidence": [
    {
      "type": "log",
      "citation": "CloudWatch log stream /ecs/payments-api [10:24:12 UTC]",
      "snippet": "ERROR: ConnectionTimeoutError: ResourceRequest timed out after 30000ms"
    },
    {
      "type": "commit",
      "citation": "Commit 8fa2b on branch main",
      "snippet": "- pool: { max: 20 }\n+ pool: { max: 2 }"
    }
  ],
  "recommendedRemediation": {
    "actionType": "rollback",
    "description": "Execute one-click rollback to previous Task Definition :41 while preparing a hotfix PR.",
    "riskAssessment": "Low risk; previous revision is cached and verified healthy."
  }
}
```
