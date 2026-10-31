# End-to-End Data Flow Specifications

This document details the critical sequence of data events across external systems, the OpsPilot control plane, background workers, and target infrastructure.

---

## 1. GitHub Webhook Ingestion & Deployment Trigger Flow

The following sequence details how GitHub push events are securely received, verified, deduplicated, and converted into deployment jobs:

```mermaid
sequenceDiagram
    autonumber
    participant GH as GitHub
    participant Ingress as API Ingress (/api/v1/integrations/github/webhook)
    participant Auth as Webhook Validator
    participant Dedupe as Redis Idempotency Cache
    participant DB as PostgreSQL State Store
    participant Queue as BullMQ (deployment-queue)
    participant Worker as Deployment Worker

    GH->>Ingress: POST webhook (X-Hub-Signature-256, X-GitHub-Delivery)
    Ingress->>Auth: Verify HMAC-SHA256 signature using App Secret
    alt Invalid Signature
        Auth-->>Ingress: Signature Mismatch
        Ingress-->>GH: HTTP 401 Unauthorized
    else Valid Signature
        Auth->>Dedupe: Check delivery GUID (SETNX github:delivery:<id>)
        alt Duplicate Delivery
            Dedupe-->>Ingress: Key Exists
            Ingress-->>GH: HTTP 200 OK (Ignored duplicate)
        else Fresh Delivery
            Dedupe-->>Auth: Key Set (TTL: 24h)
            Auth->>DB: Lookup Service matching Repository & Branch
            DB-->>Auth: Service Record Found
            Auth->>DB: Insert Deployment (status: 'Queued', commit: SHA)
            Auth->>Queue: Enqueue Job 'deploy-service' {deploymentId, orgId}
            Queue-->>Auth: Job Enqueued
            Auth-->>Ingress: Validated
            Ingress-->>GH: HTTP 202 Accepted
            
            Queue->>Worker: Consume Job 'deploy-service'
            Worker->>DB: Update Deployment (status: 'Preparing')
        end
    end
```

---

## 2. Docker Image Build & Execution Flow

```mermaid
sequenceDiagram
    autonumber
    participant Worker as Deployment Worker
    participant DB as PostgreSQL
    participant Runner as Isolated Docker Runner (Container)
    participant GH as GitHub Git Service
    participant Registry as Target Registry (Amazon ECR)

    Worker->>DB: Update Deployment Status to 'Building'
    Worker->>Runner: Spawn Runner with parameters (RepoURL, CommitSHA, ECR_URI)
    
    rect rgb(245, 245, 245)
        Note over Runner: Isolated Runner Sandbox
        Runner->>GH: git clone --depth 1 at Commit SHA
        Runner->>Runner: docker build -t <tag> -f <dockerfile> .
        Runner-->>Worker: Stream Build Logs (stdout/stderr)
        Worker->>DB: Append Build Log Chunk
        Runner->>Registry: Authenticate via STS / ECR Token & Push Image
        Registry-->>Runner: Push Confirmed (Image Digest)
    end

    Runner-->>Worker: Exit Code 0 (Success)
    Worker->>DB: Update Deployment (status: 'Publishing' -> 'Deploying', image_uri: Digest)
```

---

## 3. AWS ECS / Fargate Deployment Flow

```mermaid
sequenceDiagram
    autonumber
    participant Worker as Deployment Worker
    participant AWS_STS as AWS STS
    participant AWS_ECS as AWS ECS API
    participant AWS_CW as CloudWatch Logs
    participant DB as PostgreSQL

    Worker->>AWS_STS: AssumeRole(RoleArn, ExternalId)
    AWS_STS-->>Worker: Temporary Credentials (AccessKey, Secret, SessionToken)

    Worker->>AWS_ECS: RegisterTaskDefinition(Family, ContainerDefs, ImageURI)
    AWS_ECS-->>Worker: New Revision Registered (e.g., payments:42)

    Worker->>AWS_ECS: UpdateService(Cluster, Service, TaskDefinition: payments:42)
    AWS_ECS-->>Worker: Service Update Initiated

    loop Stabilization Polling (every 10s up to 15m)
        Worker->>AWS_ECS: DescribeServices(Cluster, Service)
        AWS_ECS-->>Worker: Service Details (RunningCount, DesiredCount, Deployments)
        Worker->>AWS_CW: GetEventsForService
        AWS_CW-->>Worker: ECS Deployment Events
        Worker->>DB: Append Deployment Event Log
    end

    Note over Worker: Service reached steady state
    Worker->>DB: Update Deployment Status to 'HealthChecking'
```

---

## 4. VPS Docker Compose Deployment Flow

```mermaid
sequenceDiagram
    autonumber
    participant Worker as Deployment Worker
    participant Sec as Encryption Service
    participant Runner as SSH Deployment Runner
    participant VPS as Target Ubuntu VPS Host
    participant DB as PostgreSQL

    Worker->>Sec: Decrypt SSH Private Key for Host
    Sec-->>Worker: Decrypted Key in memory
    
    Worker->>Runner: Initialize Runner with SSH Config & Compose Manifest
    
    Runner->>VPS: SSH: mkdir -p /opt/opspilot/services/<service-id>
    Runner->>VPS: SSH: cp docker-compose.yml docker-compose.yml.backup (if exists)
    Runner->>VPS: SCP: Upload new docker-compose.yml
    Runner->>VPS: SSH: docker compose pull && docker compose up -d --remove-orphans
    VPS-->>Runner: Containers Created & Running
    
    Runner-->>Worker: Command Succeeded
    Worker->>DB: Update Deployment Status to 'HealthChecking'
```

---

## 5. Telemetry Ingestion & Automated Incident Detection Flow

```mermaid
sequenceDiagram
    autonumber
    participant Target as Running Service / Health Endpoint
    participant Worker as Telemetry Worker
    participant DB as PostgreSQL (Telemetry Partition)
    participant Rule as Detection Rule Evaluator
    participant Queue as BullMQ (incident-queue)

    loop Telemetry Evaluation Loop (every 30s)
        Worker->>Target: HTTP GET /health
        alt Response HTTP 200 OK
            Target-->>Worker: 200 OK (latency: 42ms)
            Worker->>DB: Record HealthCheck (is_healthy: true)
        else Non-200 or Timeout
            Target-->>Worker: HTTP 500 / Timeout
            Worker->>DB: Record HealthCheck (is_healthy: false)
            Worker->>Rule: Evaluate Health Check History
            Rule->>DB: Query last 3 HealthChecks for Service
            alt 3 Consecutive Failures Detected
                Rule->>DB: Insert Incident (status: 'Open', severity: 'Critical')
                Rule->>Queue: Enqueue 'start-ai-investigation' {incidentId}
            end
        end
    end
```

---

## 6. AI Incident Investigation Flow

```mermaid
sequenceDiagram
    autonumber
    participant Worker as AI Investigation Worker
    participant Gateway as AI Gateway
    participant LLM as External Model (Gemini / Claude)
    participant Tools as Investigation Tool Executor
    participant DB as PostgreSQL

    Worker->>DB: Fetch Incident Context, Service Metadata & Recent Deployments
    Worker->>Gateway: Execute Agent Loop (Context, AllowedTools, Budgets)

    Gateway->>LLM: Prompt with Incident Timestamps & Tool Definitions
    LLM-->>Gateway: Tool Call: get_application_logs(serviceId, -30m)
    Gateway->>Tools: Execute get_application_logs
    Tools->>DB: Fetch logs & filter secrets
    Tools-->>Gateway: Sanitized log lines
    Gateway-->>LLM: Tool Result (Error log: DB connection pool full)

    LLM-->>Gateway: Tool Call: get_recent_commits(serviceId)
    Gateway->>Tools: Execute get_recent_commits
    Tools->>DB: Fetch commit diff
    Tools-->>Gateway: Git diff showing max_connections reduced from 20 to 2
    Gateway-->>LLM: Tool Result

    LLM-->>Gateway: Structured Report (Probable cause: Connection starvation)
    Gateway-->>Worker: Final Investigation Report Object
    Worker->>DB: Save Investigation Report & Evidence Citations
    Worker->>DB: Update Incident Status to 'Identified'
```
