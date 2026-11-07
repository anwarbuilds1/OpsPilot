# OpsPilot — Cloudflare Architecture Proposal & Integration Design

> **Document Type:** System Architecture Proposal & Technical Design  
> **Status:** Proposed Specification  
> **Authors:** Principal Platform Engineer, DevOps Architect, Senior Software Engineer  
> **Date:** November 2026  
> **Target Subsystems:** `packages/deployment-providers`, `apps/api/src/modules/deployments`, `apps/workers/deployment-worker`, `packages/database`, `packages/security`

---

## 1. Architectural Vision & Monolith Extension

OpsPilot is engineered as a **modular monolith** with decoupled background workers running on BullMQ. It unifies application deployments and AI-assisted production incident investigation for small SaaS teams.

To date, OpsPilot's deployment architecture has supported two containerized targets:
1. **AWS ECS Fargate:** Serverless container execution with automated Elastic Container Registry (ECR) image publishing, task definition revisioning, and Application Load Balancer routing.
2. **VPS Docker Compose:** Bare-metal or virtual server container execution managed over isolated SSH connections with local Docker daemon orchestration.

This proposal incorporates two non-containerized, edge-native targets into OpsPilot:
1. **Cloudflare Workers:** Serverless JavaScript/TypeScript execution environments powered by the V8 isolate runtime across Cloudflare's global anycast edge.
2. **Cloudflare Pages:** Global edge-hosted static websites, Jamstack frontends, and dynamic full-stack applications powered by Pages Functions.

### 1.1 Core Principles of the Extension

1. **Zero Degradation of Existing Targets:** AWS ECS Fargate and VPS Docker Compose flows must remain 100% operational, backward-compatible, and unencumbered by edge-specific concerns.
2. **Polymorphism over Container Dogmatism:** Decouple the deployment domain model from the assumption that every deployable artifact is an OCI container image running on a TCP port.
3. **Control Plane Sovereignty:** Build execution, artifact generation, log collection, secret injection, and state transitions remain strictly within OpsPilot's sovereign control plane. Cloudflare-managed Git hooks are rejected in favor of **Direct Uploads** to preserve unified tenant audit logs, ephemeral build sandboxing, and deterministic rollback histories.
4. **Tenant Isolation & Zero Trust:** Cloudflare credentials (API tokens and Account IDs) are treated as high-risk secrets, stored via AES-256-GCM envelope encryption, validated for least-privilege scoping, and never exposed to the AI investigation engine or untrusted build scripts.

---

## 2. System Architecture & Visual Topology

### 2.1 System Context with Cloudflare Integration

```mermaid
flowchart TD
    subgraph Client["Frontend Tier"]
        UI["OpsPilot Dashboard<br/>(Next.js 14 App Router)"]
        User(["Platform Engineer / Developer"])
        User -->|HTTPS / WSS| UI
    end

    subgraph ControlPlane["OpsPilot Control Plane"]
        API["OpsPilot Core API<br/>(NestJS Modular Monolith)"]
        DB[("PostgreSQL 16<br/>(Durable Multi-Tenant Store)")]
        Redis[("Redis 7.2<br/>(BullMQ Job Queues & Pub/Sub)")]
        Vault["Security Package<br/>(KMS / AES-256-GCM Envelope)"]

        UI -->|REST / GraphQL / SSE| API
        API --> DB
        API --> Redis
        API --> Vault
    end

    subgraph Workers["BullMQ Worker Processes"]
        DepWorker["Deployment Worker<br/>(Lifecycle & Orchestration)"]
        TelWorker["Telemetry Worker<br/>(Metrics & Health Polling)"]
        IncWorker["Incident Worker<br/>(Anomaly Detection & Correlator)"]
        AiWorker["AI Worker<br/>(Read-Only Investigation Agent)"]

        Redis --> DepWorker
        Redis --> TelWorker
        Redis --> IncWorker
        Redis --> AiWorker
    end

    subgraph Sandboxes["Isolated Ephemeral Runners"]
        DockerRunner["Container Build Runner<br/>(Kaniko / Docker-in-Docker)"]
        NodeRunner["Node.js Build Runner<br/>(Wrangler / Esbuild Sandbox)"]
    end

    subgraph Providers["Deployment Targets"]
        AWS["AWS ECS Fargate<br/>(ECR + Task Defs + ALB)"]
        VPS["Ubuntu VPS<br/>(SSH + Docker Compose)"]
        CFWorkers["Cloudflare Workers<br/>(V8 Isolates + Versioning API)"]
        CFPages["Cloudflare Pages<br/>(Direct Upload Assets + Functions)"]
    end

    DepWorker -->|Dispatch Build| DockerRunner
    DepWorker -->|Dispatch Build| NodeRunner
    DockerRunner -->|OCI Image| AWS
    DockerRunner -->|OCI Image| VPS
    NodeRunner -->|Worker Bundle| CFWorkers
    NodeRunner -->|Static Assets + Functions| CFPages

    TelWorker -.->|GraphQL Analytics & Tails| CFWorkers
    TelWorker -.->|HTTP Probing & Analytics| CFPages
    AiWorker -.->|Read-Only Trace Events & Metrics| CFWorkers
```

---

### 2.2 Provider Class Hierarchy

To incorporate non-container edge environments, the `packages/deployment-providers` package is structured into an extensible, capability-driven class hierarchy:

```mermaid
classDiagram
    class DeploymentCapabilities {
        +boolean supportsContainers
        +boolean supportsStaticAssets
        +boolean supportsEdgeFunctions
        +boolean requiresPortBinding
        +boolean supportsTrafficWeighting
        +boolean supportsDirectUpload
        +boolean supportsInstantRollback
    }

    class IDeploymentProvider {
        <<interface>>
        +providerType: TargetProvider
        +capabilities: DeploymentCapabilities
        +validateConnection(credentials): Promise~ConnectionResult~
        +prepareDeployment(config): Promise~PreparedDeployment~
        +deploy(prepared): Promise~DeploymentResult~
        +getStatus(deploymentId): Promise~DeploymentStatus~
        +rollback(deploymentId, targetArtifact): Promise~RollbackResult~
        +checkHealth(deploymentId): Promise~HealthCheckResult~
    }

    class BaseDeploymentProvider {
        <<abstract>>
        #logger: Logger
        #auditLogger: AuditLogService
        #redactor: SecretRedactor
        +providerType: TargetProvider
        +capabilities: DeploymentCapabilities
        #validateTenantContext(context: TenantContext): void
        #normalizeError(error: unknown): DomainException
    }

    class ContainerDeploymentProvider {
        <<abstract>>
        #registryClient: ContainerRegistryClient
        +validatePortMapping(port: number): boolean
        +resolveResourceLimits(limits: ResourceLimits): ValidatedLimits
    }

    class AwsEcsProvider {
        -ecsClient: ECSClient
        -ecrClient: ECRClient
        -cwClient: CloudWatchClient
        +deploy()
        +rollback()
    }

    class VpsDockerProvider {
        -sshClient: SshConnectionPool
        -composeGenerator: DockerComposeGenerator
        +deploy()
        +rollback()
    }

    class EdgeDeploymentProvider {
        <<abstract>>
        #cloudflareClient: CloudflareApiClient
        +validateCompatibilityDate(date: string): boolean
        +validateBindings(bindings: BindingMap): boolean
    }

    class CloudflareWorkersProvider {
        -workersApi: CloudflareWorkersService
        +uploadScriptVersion()
        +setTrafficDistribution()
        +streamTailLogs()
    }

    class CloudflarePagesProvider {
        -pagesApi: CloudflarePagesService
        +createDirectUploadDeployment()
        +uploadAssetManifest()
        +setRollbackTarget()
    }

    IDeploymentProvider <|.. BaseDeploymentProvider
    BaseDeploymentProvider <|-- ContainerDeploymentProvider
    BaseDeploymentProvider <|-- EdgeDeploymentProvider

    ContainerDeploymentProvider <|-- AwsEcsProvider
    ContainerDeploymentProvider <|-- VpsDockerProvider

    EdgeDeploymentProvider <|-- CloudflareWorkersProvider
    EdgeDeploymentProvider <|-- CloudflarePagesProvider

    IDeploymentProvider o-- DeploymentCapabilities
```

---

### 2.3 Cloudflare Workers Deployment Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer / GitHub Webhook
    participant API as Core API (NestJS)
    participant DB as PostgreSQL
    participant Q as BullMQ (deployments queue)
    participant W as Deployment Worker
    participant Runner as Isolated Node.js Runner
    participant CF as Cloudflare API (v4)
    participant Edge as Cloudflare Anycast Edge

    Dev->>API: Trigger Deployment (Branch / Commit)
    API->>DB: Insert Deployment (State: QUEUED, Provider: cloudflare_workers)
    API->>Q: Enqueue Job `execute-deployment` { deploymentId, orgId }
    API-->>Dev: Return HTTP 202 Accepted { deploymentId }

    Q->>W: Process Job
    W->>DB: Update State: PREPARING
    W->>DB: Fetch Decrypted Credentials (CF API Token, Account ID)

    W->>W: Validate Worker Config (wrangler.jsonc, compatibility_date)
    W->>DB: Update State: BUILDING

    W->>Runner: Dispatch Build Task (Ephemeral Container, UID 10001)
    activate Runner
    Runner->>Runner: Git Clone & Checkout Commit
    Runner->>Runner: npm ci && npm run build
    Runner->>Runner: wrangler deploy --dry-run --outdir=./dist
    Runner-->>W: Return Bundled Script (ESM + SourceMap + AssetManifest)
    deactivate Runner

    W->>DB: Update State: PUBLISHING
    W->>CF: POST /accounts/{acc_id}/workers/scripts/{name}/versions (Script, Metadata, Bindings)
    CF-->>W: Return 201 Created { version_id: "ver_abc123" }

    W->>DB: Update State: DEPLOYING
    W->>CF: POST /accounts/{acc_id}/workers/scripts/{name}/deployments (Traffic: 100% ver_abc123)
    CF->>Edge: Distribute V8 Isolate globally across all PoPs
    CF-->>W: Return 200 OK { deployment_id: "dep_xyz789" }

    W->>DB: Update State: HEALTH_CHECKING
    loop Health Verification (Max 3 attempts, 5s interval)
        W->>Edge: GET https://{script}.{subdomain}.workers.dev/health
        Edge-->>W: Return 200 OK { status: "healthy" }
    end

    W->>DB: Update State: SUCCEEDED, active_version_id = "ver_abc123"
    W->>API: Publish Event `DeploymentCompletedEvent`
```

---

### 2.4 Cloudflare Pages Deployment Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer / GitHub Webhook
    participant API as Core API
    participant DB as PostgreSQL
    participant Q as BullMQ
    participant W as Deployment Worker
    participant Runner as Isolated Node.js Runner
    participant CF as Cloudflare Pages API

    Dev->>API: Trigger Pages Deployment
    API->>DB: Insert Deployment (State: QUEUED, Provider: cloudflare_pages)
    API->>Q: Enqueue Job
    Q->>W: Dequeue Job

    W->>DB: Update State: BUILDING
    W->>Runner: Launch Runner (Node 20, non-root, read-only rootfs)
    activate Runner
    Runner->>Runner: git clone && npm ci
    Runner->>Runner: Execute Custom Build Command (e.g., `npm run build`)
    Runner->>Runner: Hash & Generate Asset Manifest from Output Directory
    Runner-->>W: Stream Build Logs & Return Manifest (Hashes + File Paths)
    deactivate Runner

    W->>DB: Update State: PUBLISHING
    W->>CF: POST /accounts/{acc_id}/pages/projects/{proj}/deployments (Direct Upload Init)
    CF-->>W: Return 200 OK with missing file hashes required for upload
    W->>CF: PUT Missing Files in Parallel (gzip/brotli compressed payloads)
    CF-->>W: Return Upload Complete

    W->>DB: Update State: DEPLOYING
    CF->>CF: Assemble Assets & Compile Functions (/functions)
    CF-->>W: Return Pages Deployment Active { url: "https://dep_id.project.pages.dev" }

    W->>DB: Update State: HEALTH_CHECKING
    W->>CF: GET Health Endpoint / HTTP status check on Preview/Production URL
    CF-->>W: HTTP 200 OK

    W->>DB: Update State: SUCCEEDED
    W->>API: Publish `DeploymentCompletedEvent`
```

---

### 2.5 Security Boundaries & Envelope Encryption

```mermaid
flowchart TD
    subgraph ClientReq["Tenant Request"]
        TokenInput["Cloudflare API Token<br/>(User provided in Dashboard)"]
    end

    subgraph SecurityPackage["packages/security (Zero Trust Boundary)"]
        KeyService["EncryptionKeyService<br/>(AWS KMS / Master Key)"]
        Cipher["AES-256-GCM Cipher"]
        Redactor["SecretRedactor<br/>(Scrubs tokens from logs & traces)"]

        TokenInput -->|Encrypted via DEK| Cipher
        KeyService -->|Generate Data Encryption Key| Cipher
        Cipher -->|Store Ciphertext + Nonce + AuthTag| EncryptedRecord[("integration_credentials<br/>encrypted_blob")]
    end

    subgraph RuntimeBoundary["Worker Execution (Tenant-Scoped)"]
        DepJob["Deployment Job<br/>(Has context: org_id, project_id)"]
        DecryptedToken["Decrypted Token in Memory<br/>(Ephemeral, Garbage Collected)"]

        EncryptedRecord -->|Decrypt with tenant validation| DepJob
        DepJob --> DecryptedToken
        DecryptedToken -->|HTTP Authorization: Bearer| CloudflareREST["Cloudflare v4 API"]
    end

    subgraph IsolatedRunnerSandbox["Isolated Build Runner (Untrusted User Code)"]
        RunnerContainer["Docker Runner<br/>(User: 10001, CapDrop ALL, No Sockets)"]
        UserRepo["Customer Repo<br/>(Dockerfile, package.json, scripts)"]

        RunnerContainer --> UserRepo
    end

    DecryptedToken -.->|NEVER PASSED| RunnerContainer
    UserRepo -.->|NO ACCESS| EncryptedRecord
    UserRepo -.->|NO ACCESS| KeyService

    Redactor -->|Sanitize Stderr / Stdout| SafeLogs[("PostgreSQL deployment_logs")]
```

---

## 3. Decoupling the Provider Abstraction

### 3.1 Polymorphic `DeploymentProvider` Interface

The current interface in `docs/architecture/DEPLOYMENT_ARCHITECTURE.md` mandates `imageUri`, `containerPort`, and `resourceLimits`. The updated, decoupled interface definition is detailed below:

```typescript
// packages/deployment-providers/src/interfaces/deployment-provider.interface.ts

export type TargetProvider = 
  | 'aws_ecs' 
  | 'vps_docker' 
  | 'cloudflare_workers' 
  | 'cloudflare_pages';

export type RuntimeType = 'container' | 'edge_worker' | 'static_pages';

export interface DeploymentCapabilities {
  readonly runtimeType: RuntimeType;
  readonly supportsContainers: boolean;
  readonly supportsStaticAssets: boolean;
  readonly supportsEdgeFunctions: boolean;
  readonly requiresPortBinding: boolean;
  readonly supportsTrafficWeighting: boolean;
  readonly supportsDirectUpload: boolean;
  readonly supportsInstantRollback: boolean;
}

export interface BaseDeploymentConfig {
  readonly deploymentId: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly serviceId: string;
  readonly environment: 'production' | 'staging' | 'preview';
  readonly commitSha: string;
  readonly branch: string;
}

export interface ContainerDeploymentConfig extends BaseDeploymentConfig {
  readonly runtimeType: 'container';
  readonly imageUri: string;
  readonly containerPort: number;
  readonly resourceLimits: {
    readonly cpuUnits: number;
    readonly memoryMb: number;
  };
  readonly environmentVariables: Record<string, string>;
  readonly secrets: Record<string, string>;
}

export interface CloudflareWorkersConfig extends BaseDeploymentConfig {
  readonly runtimeType: 'edge_worker';
  readonly scriptName: string;
  readonly mainEntrypoint: string; // e.g. "src/index.ts"
  readonly compatibilityDate: string; // e.g. "2024-11-01"
  readonly compatibilityFlags?: string[];
  readonly routes?: string[];
  readonly customDomains?: string[];
  readonly environmentVariables: Record<string, string>;
  readonly encryptedSecrets: Record<string, string>;
  readonly kvNamespaces?: Record<string, string>;
  readonly d1Databases?: Record<string, string>;
  readonly r2Buckets?: Record<string, string>;
}

export interface CloudflarePagesConfig extends BaseDeploymentConfig {
  readonly runtimeType: 'static_pages';
  readonly projectName: string;
  readonly buildCommand: string; // e.g. "npm run build"
  readonly outputDirectory: string; // e.g. "dist" or "out"
  readonly rootDirectory?: string;
  readonly customDomains?: string[];
  readonly environmentVariables: Record<string, string>;
  readonly encryptedSecrets: Record<string, string>;
}

export type DeploymentConfig = 
  | ContainerDeploymentConfig 
  | CloudflareWorkersConfig 
  | CloudflarePagesConfig;

export interface PreparedArtifact {
  readonly artifactType: 'oci_image' | 'worker_bundle' | 'pages_manifest';
  readonly artifactReference: string; // Image URI or Bundle Hash or Build ID
  readonly metadata: Record<string, unknown>;
}

export interface PreparedDeployment {
  readonly deploymentId: string;
  readonly targetId: string;
  readonly artifact: PreparedArtifact;
  readonly providerPayload: Record<string, unknown>;
}

export interface DeploymentResult {
  readonly success: boolean;
  readonly externalDeploymentId: string;
  readonly deployedUrl?: string;
  readonly versionIdentifier: string; // E.g., ECS task def ARN or Worker version ID
  readonly metadata: Record<string, unknown>;
}

export interface RollbackResult {
  readonly success: boolean;
  readonly activeVersionIdentifier: string;
  readonly executedAt: string; // UTC ISO 8601
  readonly message?: string;
}

export interface DeploymentStatus {
  readonly state: 'queued' | 'preparing' | 'building' | 'publishing' | 'deploying' | 'health_checking' | 'succeeded' | 'failed' | 'rolled_back';
  readonly externalStatusMessage?: string;
  readonly activeReplicas?: number;
  readonly targetUrl?: string;
  readonly timestamp: string;
}

export interface HealthCheckResult {
  readonly isHealthy: boolean;
  readonly httpStatusCode?: number;
  readonly latencyMs?: number;
  readonly errorMessage?: string;
  readonly timestamp: string;
}

export interface IDeploymentProvider {
  readonly providerType: TargetProvider;
  readonly capabilities: DeploymentCapabilities;

  validateConnection(credentials: Record<string, unknown>): Promise<{ valid: boolean; message?: string }>;
  prepareDeployment(config: DeploymentConfig): Promise<PreparedDeployment>;
  deploy(deployment: PreparedDeployment, credentials: Record<string, unknown>): Promise<DeploymentResult>;
  getStatus(deploymentId: string, externalId: string, credentials: Record<string, unknown>): Promise<DeploymentStatus>;
  rollback(deploymentId: string, targetVersionIdentifier: string, credentials: Record<string, unknown>): Promise<RollbackResult>;
  checkHealth(targetUrl: string): Promise<HealthCheckResult>;
}
```

---

## 4. Build Execution & Packaging Strategy

OpsPilot enforces strict sandboxing for untrusted build scripts. Customer repositories contain arbitrary code (`package.json`, custom scripts) that must never run directly on the host machine or have access to Docker sockets.

### 4.1 Node.js Ephemeral Build Runner (`NodeJsBuildRunner`)

For Cloudflare Workers and Cloudflare Pages builds, OpsPilot introduces an ephemeral containerized Node.js runner:

```dockerfile
# docker/runners/nodejs-build-runner.Dockerfile
FROM node:20-alpine AS runner

# Security: drop root privileges, create dedicated unprivileged builder user
RUN addgroup -g 10001 opspilot && \
    adduser -u 10001 -G opspilot -s /bin/sh -D builder

# Install core build utilities and Wrangler globally
RUN apk add --no-cache git bash python3 make g++ && \
    npm install -g wrangler@3.88.0 esbuild@0.24.0

USER builder
WORKDIR /workspace

# Container entrypoint handles repo checkout, environment injection, build, and bundle export
ENTRYPOINT ["/usr/local/bin/build-entrypoint.sh"]
```

### 4.2 Security Constraints for Build Runners:
1. **Unprivileged Execution:** Runs strictly under UID `10001` (builder), `CapDrop=ALL`, and `no-new-privileges: true`.
2. **Filesystem Constraints:** Read-only root filesystem with isolated ephemeral `tmpfs` mounts for `/tmp` and `/workspace`.
3. **Network Isolation:** Outbound access is permitted solely to npm registry (`registry.npmjs.org`), GitHub, and Cloudflare API endpoints. Inbound traffic is blocked.
4. **No Secret Ingestion in Artifacts:** Build-time environment variables are strictly limited to variables marked `is_build_time = true`. Cloudflare API tokens are **never mounted or injected** into the runner container. The runner produces static assets or JS bundles and writes them to a shared volume or output tarball; the `DeploymentWorker` subsequently reads the output and executes authenticated Cloudflare API calls.

---

## 5. Security Architecture & Scoped Credentials

### 5.1 Cloudflare API Token Least-Privilege Policy

OpsPilot integrates with Cloudflare via **API Tokens** rather than Global API Keys. An API Token must be configured with minimal required permissions:

| Permission Group | Scope | Access Level | Purpose |
|---|---|:---:|---|
| **Account.Workers Scripts** | Specific Account | `Edit` | Upload worker versions, set bindings, update scripts |
| **Account.Workers Routes** | Specific Account | `Edit` | Bind workers to custom routes/domains |
| **Account.Workers Tail** | Specific Account | `Read` | Stream real-time log traces for deployment validation |
| **Account.Pages** | Specific Account | `Edit` | Create projects, upload direct upload assets, manage deployments |
| **Zone.Analytics** (Optional) | Specific Zones | `Read` | Query edge invocation metrics, error rates, and latency |

### 5.2 Storage & Envelope Encryption

1. When a user configures a Cloudflare integration in the OpsPilot Dashboard:
   - The user supplies: `accountId` and `apiToken`.
   - Backend validation tests the token against `GET https://api.cloudflare.com/client/v4/user/tokens/verify`.
   - The API Token is encrypted using the `packages/security` envelope encryption service (AES-256-GCM with a tenant-unique Data Encryption Key derived from AWS KMS or the Master Key).
   - Encrypted token, initialization vector (nonce), and authentication tag are stored in `integration_credentials`.
2. When the `DeploymentWorker` executes:
   - Credentials are decrypted in-memory inside the worker process.
   - The token is passed via `Authorization: Bearer <token>` directly to Cloudflare REST APIs.
   - All logs generated by the worker are processed through `SecretRedactor` to ensure API tokens, secrets, and authorization headers are expunged prior to database storage or WebSocket streaming.

---

## 6. Runtime Compatibility & Validation Gate

OpsPilot implements a **Deterministic Runtime Validation Gate** before creating or updating a service. This prevents users from deploying unsupported runtimes to Cloudflare.

```mermaid
flowchart TD
    Repo[Repository Inspected] --> ManifestCheck{Manifests Present?}

    ManifestCheck -->|Dockerfile or docker-compose.yml| ContainerTarget[Compatible with AWS ECS / VPS Docker]
    ManifestCheck -->|wrangler.jsonc or wrangler.toml| WorkerTarget[Compatible with Cloudflare Workers]
    ManifestCheck -->|package.json + SSG / Vite / Next.js| PagesTarget[Compatible with Cloudflare Pages]

    WorkerTarget --> WorkerCompatValidation{Validates Compatibility?}
    WorkerCompatValidation -->|No native C++ addons / No net.createServer| ApprovedWorker[Target: cloudflare_workers Allowed]
    WorkerCompatValidation -->|Uses raw fs / native binary| RejectWorker[Reject with Actionable Diagnostics]

    PagesTarget --> PagesCompatValidation{Validates Output Dir?}
    PagesCompatValidation -->|build command produces valid static directory| ApprovedPages[Target: cloudflare_pages Allowed]
    PagesCompatValidation -->|Requires persistent server disk or background loop| RejectPages[Reject: Suggest ECS / VPS]
```

### 6.1 Validation Rules:
- **Cloudflare Workers:**
  - Mandatory `compatibility_date` formatted as `YYYY-MM-DD`.
  - Prohibits dependencies relying on native Node.js C++ bindings (`sharp` native binaries without wasm, `better-sqlite3`, etc.).
  - Prohibits continuous background daemons or long-running child processes.
- **Cloudflare Pages:**
  - Mandatory verified `build_command` and non-empty `output_directory`.
  - Pages Functions (`/functions`) must use Web Fetch standard signatures (`onRequest`, `onRequestGet`, etc.).

---

## 7. Failure Handling & Instant Rollback Architecture

### 7.1 Cloudflare Workers Instant Version Rollback

Traditional container rollbacks require provisioning new task definitions or executing `docker compose up -d` against an older image, taking between 30 seconds and 3 minutes.

Cloudflare Workers Versioning provides **instant sub-second rollbacks**:
1. During deployment, OpsPilot captures the immutable `version_id` returned by Cloudflare's Version API (`POST /accounts/{acc_id}/workers/scripts/{name}/versions`).
2. When a rollback is triggered (manually or via automated incident remediation):
   - The `CloudflareWorkersProvider` issues:
     ```http
     POST /accounts/{account_id}/workers/scripts/{script_name}/deployments
     Content-Type: application/json
     Authorization: Bearer {token}

     {
       "versions": [
         {
           "version_id": "previous_successful_version_id",
           "percentage": 100
         }
       ],
       "annotations": {
         "opspilot.rollback_from": "failed_version_id",
         "opspilot.reason": "Automated incident remediation health failure"
       }
     }
     ```
   - Cloudflare activates the previous version globally across all edge locations within ~50 milliseconds.
   - OpsPilot updates the `deployments` record to `rolled_back` and records the transition in `audit_logs`.

### 7.2 Cloudflare Pages Rollback
1. OpsPilot stores the immutable `deployment_id` for every Pages direct upload.
2. Rollback invokes:
   ```http
   POST /accounts/{account_id}/pages/projects/{project_name}/deployments/{target_deployment_id}/rollback
   Authorization: Bearer {token}
   ```
3. Cloudflare redirects the project's production domain to the target deployment instant snapshot.

---

## 8. Telemetry, Observability & Incident Detection

OpsPilot's incident detection and AI investigation engine require metrics, logs, and traces.

### 8.1 Observability Ingestion Architecture

| Ingestion Channel | Cloudflare Technology | OpsPilot Component | Telemetry Produced |
|---|---|---|---|
| **Real-Time Deployment Logs** | Cloudflare Workers Tail API (`/tails`) | `DeploymentWorker` / `TelemetryWorker` | `stdout`, `stderr`, unhandled exceptions, console logs |
| **Edge Metrics** | Cloudflare GraphQL Analytics API | `TelemetryWorker` (5-min polling cron) | Request count, HTTP status codes (2xx, 4xx, 5xx), CPU execution duration, wall-clock duration |
| **Active Probing** | HTTP Edge Health Checks | `TelemetryWorker` (1-min interval) | Latency, SSL status, HTTP response status, body assertion |
| **Audit Events** | Cloudflare Audit Logs API | `OpsPilot Audit Engine` | API token modifications, DNS changes, manual config alterations |

### 8.2 AI Agent Investigation Integration

When an incident is detected on a Cloudflare-backed service:
- The AI Agent invokes `GetLogsTool` and `GetMetricsTool` via the `BaseInvestigationTool` contract.
- The tools interface with OpsPilot's local PostgreSQL telemetry tables populated by the `TelemetryWorker`.
- The AI Agent receives structured logs containing Cloudflare request IDs (`cf-ray`), edge colocation IDs (`iad`, `lhr`, `sjc`), status codes, and execution exceptions.
- The AI correlates errors against recent Worker Version deployments and code diffs in GitHub, proposing actionable remediations (e.g. instant rollback or code PR) subject to human approval gates.

---

## 9. Architectural Feasibility Verdict

The proposed architecture integrates Cloudflare Workers and Cloudflare Pages cleanly into OpsPilot:
- **Preserves existing AWS ECS and VPS Docker adapters** without regression.
- **Maintains the modular monolith structure** and BullMQ worker pipeline.
- **Enforces Zero-Trust credential security** and non-root ephemeral runner sandboxing.
- **Provides superior recovery capabilities** (sub-second rollbacks via modern Cloudflare Versioning).

OpsPilot is architecturally suited to become a multi-target deployment platform spanning cloud containers and global edge runtimes.
