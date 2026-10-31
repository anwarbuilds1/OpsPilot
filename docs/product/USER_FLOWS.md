# User Flows & System Journeys

This document outlines the core end-to-end user journeys within OpsPilot.

---

## 1. Onboarding & First Service Deployment

```mermaid
sequenceDiagram
    autonumber
    actor User as Engineer / Founder
    participant UI as Next.js Dashboard
    participant API as OpsPilot API
    participant GH as GitHub
    participant Infra as AWS / VPS Target
    participant Worker as Deployment Worker

    User->>UI: Register Account & Create Organization
    UI->>API: POST /auth/register & POST /organizations
    API-->>UI: JWT Session Token & Org Context
    
    User->>UI: Connect GitHub App
    UI->>GH: Install OpsPilot GitHub App
    GH-->>API: Webhook: installation.created
    API-->>UI: Connected Repositories Available

    User->>UI: Connect Infrastructure Target (AWS IAM / VPS SSH)
    UI->>API: POST /integrations/aws/connect (or /vps/connect)
    API->>Infra: Validate Connection & Permissions
    Infra-->>API: Connection Verified
    API-->>UI: Target Ready

    User->>UI: Create Project & Register Service
    UI->>API: POST /projects/:id/services (Repo, Branch, Target)
    API-->>UI: Service Initialized

    User->>UI: Trigger First Deployment
    UI->>API: POST /services/:id/deployments
    API->>Worker: Enqueue Deployment Job (BullMQ)
    Worker->>Infra: Build Image, Update ECS/Compose, Check Health
    Worker-->>API: Deployment Succeeded
    API-->>UI: Real-Time Status: Healthy (Green)
```

---

## 2. Automated Incident Detection & AI Investigation

```mermaid
sequenceDiagram
    autonumber
    actor User as On-Call Engineer
    participant App as Customer Application
    participant Tel as Telemetry Worker
    participant Inc as Incident Engine
    participant AI as AI Investigation Worker
    participant LLM as AI Gateway (LLM)
    participant UI as Next.js Dashboard

    Note over App: App experiences DB Pool Exhaustion after deployment
    App->>Tel: Health check endpoint /health returns HTTP 500
    Tel->>Tel: Detect 3 consecutive health check failures
    Tel->>Inc: Trigger Incident Event (Severity: Critical)
    
    Inc->>Inc: Create Incident Record & Correlate Recent Deployments
    Inc->>UI: Push Real-Time Incident Alert (WebSocket / UI Notification)
    Inc->>AI: Enqueue Investigation Job

    rect rgb(240, 248, 255)
        Note over AI,LLM: Bounded AI Investigation Loop
        AI->>LLM: Prompt with Incident Context & Tool Definitions
        LLM-->>AI: Tool Call: get_application_logs(service_id, window)
        AI->>AI: Fetch logs & mask sensitive credentials
        AI-->>LLM: Return sanitized logs (Connection timeout detected)
        LLM-->>AI: Tool Call: get_recent_commits(service_id)
        AI-->>LLM: Return commits (Commit 8fa2b: 'Update pool size to 2')
        LLM-->>AI: Final Report (Hypothesis: Pool size too small)
    end

    AI->>Inc: Attach Structured Evidence Report
    Inc-->>UI: Display Evidence, Probable Cause, & Recommended Actions
    User->>UI: Review Investigation & Click 'Trigger Rollback'
```

---

## 3. Rollback & Human-Approved Remediation

```mermaid
sequenceDiagram
    autonumber
    actor User as Engineer
    participant UI as Next.js Dashboard
    participant API as OpsPilot API
    participant Worker as Deployment Worker
    participant Infra as AWS / VPS Target
    participant GH as GitHub

    User->>UI: Click 'Rollback to Previous Deployment'
    UI->>API: POST /deployments/:id/rollback
    API->>Worker: Enqueue Rollback Job
    
    alt AWS ECS Target
        Worker->>Infra: Revert ECS Service to previous Task Definition Revision
    else VPS Target
        Worker->>Infra: Restore docker-compose.yml.backup & run docker compose up -d
    end
    
    Worker->>Infra: Poll health check until HTTP 200 confirmed
    Worker-->>API: Rollback Succeeded
    API-->>UI: Service Status Restored to Healthy

    opt Autonomous Remediation PR (Post-MVP)
        User->>UI: Click 'Generate Remediation PR'
        UI->>API: POST /incidents/:id/remediation/prepare
        API->>GH: Create branch 'opspilot/fix-incident-123' & Open PR
        GH-->>UI: PR Link Created: github.com/org/repo/pull/45
        User->>GH: Review Code Diff, Approve, and Merge
    end
```
