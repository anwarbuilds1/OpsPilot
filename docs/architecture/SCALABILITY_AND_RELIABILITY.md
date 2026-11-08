# Scalability & Reliability Architecture

> **Document Type:** Non-Functional Architecture Specification  
> **Targets:** 99.5% Control Plane Availability, Linear Horizontal Scaling for Workers

OpsPilot is engineered to scale gracefully from single-server development instances to distributed production workloads supporting dozens of concurrent engineering teams.

---

## 1. Reliability & Availability Targets

- **Control Plane Availability Target:** 99.5% uptime for the REST API and web dashboard.
- **Data Durability:** Zero loss of completed deployment records or audit logs. PostgreSQL Write-Ahead Logging (WAL) and automated snapshots ensure point-in-time recovery.
- **Job Survivability:** Background jobs survive worker restarts (PostgreSQL-backed queue — selected architecture, implementation pending; worker leases and heartbeat scheduled for Phase 2). If a worker process terminates abruptly during an active deployment or AI investigation, worker lease expiration triggers reassignment to a healthy worker.
- **Fail-Open Application Runtimes:** OpsPilot is purely a control plane. If OpsPilot experiences an outage, customer applications deployed on AWS ECS or VPS instances continue running without degradation.

---

## 2. Horizontal Scaling Topology

The architecture separates stateless web/API traffic from resource-intensive background processing:

```mermaid
flowchart TD
    LB[Load Balancer] --> API1[API Node 1]
    LB --> API2[API Node 2]
    LB --> APIn[API Node N]

    API1 --> PG[(PostgreSQL Primary)]
    API2 --> PG
    APIn --> PG

    API1 --> Queue[(PostgreSQL-Backed Queue\nSelected Architecture - Implementation Pending)]
    API2 --> Queue
    APIn --> Queue

    Queue --> Worker1[Deployment Worker 1]
    Queue --> Worker2[Deployment Worker 2]
    Queue --> WorkerAI[AI Investigation Worker]
    Queue --> WorkerTel[Telemetry Worker]

    Worker1 --> RunnerPool[Ephemeral Runner Pool]
    Worker2 --> RunnerPool
```

### Scaling Characteristics:
- **Stateless API Tier:** The NestJS API nodes do not hold local session state (sessions are JWT backed). Nodes scale horizontally behind standard ALB/NLB.
- **Worker Concurrency & Autoscaling:** Workers scale independently based on queue depth (PostgreSQL-backed queue — selected architecture, implementation pending).
- **Database Connection Pooling:** Managed through PgBouncer or NestJS ORM connection pooling to prevent PostgreSQL connection saturation under high concurrency.

---

## 3. Graceful Degradation & Failure Handling

| Failure Scenario | Impact | System Reaction & Recovery |
|---|---|---|
| **Queue Processing Interruption** | Job processing paused. | Existing deployments in AWS/VPS continue running; PostgreSQL state remains durable; workers resume processing upon reconnect. |
| **Worker Process Crash** | Active job stalled. | Stranded-job reaper identifies expired worker lease; re-enqueues job or transitions deployment to `Failed` with diagnostic message (Phase 2). |
| **CloudWatch API Rate Limit (AWS 429)** | Metrics collection delayed. | Telemetry worker applies jittered exponential backoff; caches last known metrics. |
| **LLM Provider Outage** | AI investigations cannot complete. | AI Gateway catches provider timeout; marks investigation as `Inconclusive`; notifies user that manual investigation is required. |
| **PostgreSQL Transient Disconnect** | API read/write errors. | Built-in connection pool retry logic; health check endpoint `/health` flags degraded status to load balancer. |
