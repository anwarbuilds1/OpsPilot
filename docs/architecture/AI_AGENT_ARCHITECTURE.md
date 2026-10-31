# AI Agent Architecture & Tool Execution Sandbox

> **Document Type:** Core AI Architecture Specification  
> **Pattern:** Single Bounded Autonomous Investigation Agent  
> **Status:** Approved Baseline

The OpsPilot AI Agent is an automated operations investigator designed to rapidly identify the root causes of production incidents. It operates under strict security and operational constraints: it is **read-only**, deterministic, bounded by execution limits, and completely separated from destructive infrastructure execution.

---

## 1. AI Investigation Sequence Diagram

The following diagram details the execution flow between the background worker, orchestrator, AI Gateway, external LLM, and read-only tools:

```mermaid
sequenceDiagram
    autonumber
    participant Worker as AI Investigation Worker
    participant Orch as Investigation Orchestrator
    participant Gateway as AI Gateway
    participant LLM as External LLM (Gemini / Claude)
    participant Sandbox as Tool Execution Sandbox
    participant DB as PostgreSQL State Store

    Worker->>DB: Fetch Incident Context, Service Metadata & Recent Deployments
    Worker->>Orch: Initialize Investigation(IncidentContext, Budget: 10 calls)
    
    Orch->>Gateway: Format System Prompt + Tools + Initial Context
    Gateway->>LLM: Send Chat Request with Tool Definitions

    loop Bounded Investigation Loop (Max 10 iterations)
        LLM-->>Gateway: Tool Call Request: get_application_logs(service_id, window)
        Gateway->>Sandbox: Execute Tool Request
        Sandbox->>Sandbox: Validate Permissions, Tenant Scope & Parameters
        Sandbox->>DB: Query Logs & Apply Secret Masking Scrubber
        DB-->>Sandbox: Scrubbed Log Lines (Max 500 lines)
        Sandbox-->>Gateway: Structured Tool Result
        Gateway->>LLM: Return Tool Output to Conversation History
    end

    LLM-->>Gateway: Structured Final Output (Observations, Probable Cause, Evidence)
    Gateway->>Orch: Validate Report Schema with Zod
    Orch->>DB: Persist Investigation Report, Evidence Citations & Token Usage
    Orch-->>Worker: Investigation Complete
```

---

## 2. AI Tool Permission Boundary

To guarantee that the AI model can never accidentally or maliciously alter production infrastructure, OpsPilot categorizes operational capabilities into three strictly segregated tiers:

```mermaid
flowchart TD
    subgraph Tier1 [Tier 1: Read-Only AI Tools - Autonomous Execution]
        T1["get_service_details()"]
        T2["get_recent_deployments()"]
        T3["get_deployment_details()"]
        T4["get_application_logs()"]
        T5["query_metrics()"]
        T6["get_container_status()"]
        T7["get_recent_commits()"]
        T8["get_health_status()"]
        T9["get_incident_timeline()"]
    end

    subgraph SecurityGate [Deterministic Security & Tenant Boundary]
        AuthCheck{Tenant & Role Validation<br/>Time Window Limits<br/>Secret Redaction}
    end

    subgraph Tier2 [Tier 2: AI Proposal Engine - Code/Config Proposals]
        P1["propose_code_fix()"]
        P2["propose_rollback()"]
        P3["propose_env_update()"]
    end

    subgraph HumanApprovalGate [Mandatory Human Engineering Approval Gate]
        Human["Human Reviewer in GitHub / Web UI<br/>(Sign-off Required)"]
    end

    subgraph Tier3 [Tier 3: Execution Engine - Deterministic Application Code]
        E1["execute_rollback()"]
        E2["merge_remediation_pr()"]
        E3["update_ecs_service()"]
        E4["restart_vps_container()"]
    end

    Model([AI Model Reasoning Engine]) --> Tier1
    Tier1 --> SecurityGate
    SecurityGate --> Data[(PostgreSQL / CloudWatch / Docker)]

    Model --> Tier2
    Tier2 --> HumanApprovalGate
    HumanApprovalGate -->|Explicit Approval| Tier3
    Tier3 --> Infra[(AWS ECS / VPS Docker)]

    classDef readonly fill:#e8f5e9,stroke:#388e3c,stroke-width:2px;
    classDef proposal fill:#fff3e0,stroke:#f57c00,stroke-width:2px;
    classDef execution fill:#ffebee,stroke:#d32f2f,stroke-width:2px;
    classDef gate fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px;

    class Tier1 readonly;
    class Tier2 proposal;
    class Tier3 execution;
    class SecurityGate,HumanApprovalGate gate;
```

### Safety Principles:
1. **The Model Has No Credentials:** The LLM receives zero AWS access keys, SSH keys, or database credentials. It only receives sanitized tool responses.
2. **Deterministic Tool Execution:** Tool calls are executed by compiled backend TypeScript code that strictly verifies the caller's `organization_id` against the target resource.
3. **No Direct Execution:** The AI Agent is physically incapable of triggering a rollback or updating a task definition. It can only propose an action for human review.

---

## 3. Investigation Orchestrator Constraints

The investigation orchestrator enforces strict resource budgets to prevent infinite looping, runaway token spend, and latency spikes:

- **Maximum Tool Calls:** Hard ceiling of **10 tool calls** per investigation. If the limit is reached, the model is forced to synthesize its findings with available evidence.
- **Maximum Execution Duration:** 180 seconds total investigation timeout.
- **Token Budget:** Maximum **30,000 prompt tokens** and **4,000 completion tokens** per run.
- **Log Retrieval Bounds:** Maximum **500 log lines** or **100 KB** per tool call.
- **Time Window Ceiling:** Tool queries cannot look back further than **120 minutes** prior to the incident start timestamp.

---

## 4. Distinguishing Observations from Hypotheses

A primary failure mode of LLM troubleshooting is asserting an unverified guess as an absolute fact. OpsPilot prompt engineering strictly enforces the separation of:
- **Observations:** Empirical facts directly supported by tool call output (e.g., *"Application log line 42 at 10:24 UTC shows `ConnectionTimeoutError: pool exhausted`"*).
- **Hypotheses:** Inferences drawn from correlated observations (e.g., *"The recent commit 8fa2b reduced `max_connections` from 20 to 2, which likely caused pool exhaustion under peak load."*).
- **Confidence Scoring:** Explicitly tagged as `High` (direct evidence in code diff and logs), `Medium` (correlated timing but indirect evidence), or `Low` (inconclusive evidence; recommends broader manual investigation).
