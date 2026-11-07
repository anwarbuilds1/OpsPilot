# OpsPilot Deployment Lifecycle & State Machine Specification

> **Document Type:** Architecture & Operational Specification  
> **Package:** `@opspilot/domain`, `@opspilot/database`, `@opspilot/deployment-providers`  
> **Status:** Implemented & Verified (November 2026)

This document specifies the lifecycle stages, state transitions, idempotency guarantees, and concrete execution flows for container and serverless/edge workloads in OpsPilot.

---

## 1. Universal Deployment State Machine

OpsPilot enforces an 8-stage deployment state machine governed by `DeploymentStateMachine` (`packages/domain/src/deployment/state-machine/deployment-state-machine.ts`).

```mermaid
stateDiagram-v2
    [*] --> Queued
    Queued --> Preparing
    Queued --> Cancelled
    Queued --> Failed

    Preparing --> Building
    Preparing --> Cancelled
    Preparing --> Failed

    Building --> Publishing
    Building --> Cancelled
    Building --> Failed

    Publishing --> Deploying
    Publishing --> Cancelled
    Publishing --> Failed

    Deploying --> HealthChecking
    Deploying --> Cancelled
    Deploying --> Failed

    HealthChecking --> Succeeded: Health Probe 200 OK
    HealthChecking --> RollingBack: Health Check Failed (Instant Rollback Supported)
    HealthChecking --> Failed: Health Check Failed (No Rollback Configured)

    RollingBack --> RolledBack: Previous Version Restored
    RollingBack --> Failed: Rollback Execution Error

    Succeeded --> [*]
    RolledBack --> [*]
    Failed --> [*]
    Cancelled --> [*]
```

### Idempotency & Concurrency Rules
1. **Idempotent Self-Transitions:** Attempting to transition a deployment to its current status (e.g. `Deploying` $\to$ `Deploying`) is treated as a valid, idempotent no-op.
2. **Conditional Atomic State Updates:** Database state updates in `DeploymentsRepository.transitionStatus` use optimistic concurrency checks:
   ```sql
   UPDATE deployments
   SET status = $1::deployment_status,
       failure_reason = $2,
       updated_at = NOW()
   WHERE id = $3 AND organization_id = $4 AND status = $5::deployment_status
   RETURNING *;
   ```
   If another worker has already transitioned the state, the update affects 0 rows, triggering an `InvalidStateTransitionException` and preventing race conditions.

---

## 2. Cloudflare Workers Deployment Lifecycle

Cloudflare Workers uses modern immutable Script Versioning and Deployments APIs:

```mermaid
sequenceDiagram
    participant Engine as DeploymentExecutionEngine
    participant Provider as CloudflareWorkersProvider
    participant CF as Cloudflare REST API
    participant Edge as Global Edge Network

    Engine->>Provider: prepareDeployment(config)
    Provider-->>Engine: PreparedDeployment (ESM + Bindings + SHA-256 Digest)
    Engine->>Provider: deploy(prepared, credentials)
    Provider->>CF: PUT /accounts/{id}/workers/scripts/{name}/secrets
    Provider->>CF: POST /accounts/{id}/workers/scripts/{name}/versions (Multipart ESM)
    CF-->>Provider: Version Created (ID: v2, Number: 2)
    Provider->>CF: POST /accounts/{id}/workers/scripts/{name}/deployments ({ version_id: v2, percentage: 100 })
    CF-->>Provider: Deployment Activated (ID: dep-2)
    Provider-->>Engine: DeploymentResult (deployedUrl)
    Engine->>Edge: checkHealth(deployedUrl)
    Edge-->>Engine: HTTP 200 OK
    Engine->>Engine: Transition -> Succeeded
```

### Instant Rollback Flow
If the edge health probe fails:
1. `DeploymentExecutionEngine` transitions to `RollingBack`.
2. `CloudflareWorkersProvider.rollback(deploymentId, targetVersionId)` calls `POST /accounts/{id}/workers/scripts/{name}/deployments` with `{ version_id: targetVersionId, percentage: 100 }`.
3. Cloudflare immediately switches global edge traffic back to the previous version with zero build latency.
4. `DeploymentExecutionEngine` transitions to `RolledBack`.

---

## 3. Cloudflare Pages Deployment Lifecycle (Direct Upload)

Pursuant to ADR-0015, OpsPilot strictly rejects Cloudflare-managed Git builds, retaining control plane sovereignty through the **Direct Upload Strategy**:

```mermaid
sequenceDiagram
    participant Runner as NodeJsBuildRunner (Isolated)
    participant Engine as DeploymentExecutionEngine
    participant Provider as CloudflarePagesProvider
    participant CF as Cloudflare Pages API

    Runner->>Runner: Execute Build (`npm run build`)
    Runner->>Engine: Artifact Output Directory
    Engine->>Provider: prepareDeployment(config)
    Note over Provider: Enforce <= 20,000 files<br/>Enforce <= 25 MiB per file<br/>Compute SHA-256 Manifest
    Provider-->>Engine: PreparedDeployment (manifest + files)
    Engine->>Provider: deploy(prepared, credentials)
    Provider->>CF: GET /accounts/{id}/pages/projects/{name} (Ensure Project)
    Provider->>CF: POST /accounts/{id}/pages/projects/{name}/deployments (Multipart Manifest + Files)
    CF-->>Provider: Deployment Created (ID: dep-pages-1, URL)
    Provider-->>Engine: DeploymentResult
    Engine->>CF: Poll /accounts/{id}/pages/projects/{name}/deployments/{id}
    CF-->>Engine: Stage: 'deploy' Status: 'success'
    Engine->>Engine: Transition -> Succeeded
```

---

## 4. Lifecycle Comparison Across All Providers

| Lifecycle Stage | AWS ECS (`aws_ecs`) | VPS Docker (`vps_docker`) | Cloudflare Workers (`cloudflare_workers`) | Cloudflare Pages (`cloudflare_pages`) |
|---|---|---|---|---|
| **Build & Packaging** | Docker build $\to$ OCI Image | Docker build $\to$ OCI Image | Wrangler/esbuild $\to$ ESM Bundle | Framework build $\to$ Static Directory |
| **Artifact Storage** | Amazon ECR | Private Docker Registry | Cloudflare Script Versions | Direct Upload Manifest |
| **Deployment Mechanism** | ECS Service update (new Task Definition) | SSH Compose transfer $\to$ `docker compose up -d` | Workers Deployments API (100% traffic shift) | Pages Direct Upload Multipart API |
| **Stabilization Wait** | Polling ECS Task desired/running counts | Polling Docker container health status | Instant edge propagation | Polling Pages build stage status |
| **Rollback Execution** | Revert ECS Service to previous Task Def | SSH Compose transfer of previous compose file | Instant 100% traffic shift to previous Version ID | Pages Rollback API call |
| **Rollback Speed** | 1 - 3 minutes (container pull/drain) | 10 - 30 seconds | Sub-second (< 1s) | 2 - 5 seconds |
