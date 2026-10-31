# Domain Event Contracts & Event Bus Specifications

> **Pattern:** Internal Event-Driven Messaging  
> **Engine:** NestJS EventEmitter2 (In-Process) / Redis Pub-Sub  
> **Semantics:** At-Least-Once Delivery with Idempotent Handlers

This document defines the schema contracts for internal domain events emitted across OpsPilot modules and workers.

---

## 1. Domain Event Envelope

All domain events adhere to a standard envelope structure:

```typescript
export interface DomainEvent<T> {
  eventId: string;          // UUID v4
  eventName: string;        // Dot-notated event name (e.g., "deployment.succeeded")
  version: number;          // Semantic schema version (integer, starting at 1)
  organizationId: string;   // Mandatory tenant context
  timestamp: string;        // ISO 8601 UTC string
  producer: string;         // Emitting module (e.g., "DeploymentsModule")
  payload: T;               // Strongly typed payload object
}
```

---

## 2. Event Catalog

### 2.1 `deployment.requested` (v1)
- **Producer:** `DeploymentsModule`
- **Consumers:** `AuditModule`, `deployment-queue` (BullMQ)
- **Payload Schema:**
```typescript
interface DeploymentRequestedPayload {
  deploymentId: string;
  projectId: string;
  serviceId: string;
  commitSha: string;
  environment: string;
  triggeredByUserId?: string;
}
```

---

### 2.2 `deployment.succeeded` (v1)
- **Producer:** `deployment-worker`
- **Consumers:** `AuditModule`, `IncidentsModule` (resolves ongoing deployment failure alerts), `NotificationModule`
- **Payload Schema:**
```typescript
interface DeploymentSucceededPayload {
  deploymentId: string;
  serviceId: string;
  commitSha: string;
  imageUri: string;
  durationSeconds: number;
}
```

---

### 2.3 `deployment.failed` (v1)
- **Producer:** `deployment-worker`
- **Consumers:** `AuditModule`, `IncidentsModule` (evaluates automatic incident trigger), `NotificationModule`
- **Payload Schema:**
```typescript
interface DeploymentFailedPayload {
  deploymentId: string;
  serviceId: string;
  stage: "Building" | "Publishing" | "Deploying" | "HealthChecking";
  failureReason: string;
}
```

---

### 2.4 `deployment.rolled_back` (v1)
- **Producer:** `deployment-worker`
- **Consumers:** `AuditModule`, `IncidentsModule`, `NotificationModule`
- **Payload Schema:**
```typescript
interface DeploymentRolledBackPayload {
  originalDeploymentId: string;
  rollbackDeploymentId: string;
  serviceId: string;
  restoredArtifactId: string;
  triggeredByUserId?: string;
}
```

---

### 2.5 `telemetry.threshold_breached` (v1)
- **Producer:** `telemetry-worker`
- **Consumers:** `IncidentsModule`
- **Payload Schema:**
```typescript
interface TelemetryThresholdBreachedPayload {
  serviceId: string;
  alertType: "health_check_failure" | "5xx_rate_spike" | "oom_crash";
  metricValue: number;
  threshold: number;
  breachWindowMinutes: number;
  sampleCount: number;
}
```

---

### 2.6 `incident.created` (v1)
- **Producer:** `IncidentsModule`
- **Consumers:** `AuditModule`, `ai-investigation-queue` (BullMQ), `NotificationModule`
- **Payload Schema:**
```typescript
interface IncidentCreatedPayload {
  incidentId: string;
  serviceId: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  title: string;
  triggerRule: string;
  correlatedDeploymentId?: string;
}
```

---

### 2.7 `investigation.completed` (v1)
- **Producer:** `ai-worker`
- **Consumers:** `IncidentsModule`, `NotificationModule`
- **Payload Schema:**
```typescript
interface InvestigationCompletedPayload {
  investigationId: string;
  incidentId: string;
  serviceId: string;
  confidence: "High" | "Medium" | "Low";
  probableCauseSummary: string;
  recommendedActionType: "rollback" | "code_fix" | "config_change";
}
```

---

### 2.8 `remediation.approved` (v1)
- **Producer:** `ApprovalsModule`
- **Consumers:** `AuditModule`, `DeploymentsModule`
- **Payload Schema:**
```typescript
interface RemediationApprovedPayload {
  incidentId: string;
  actionType: "rollback" | "remediation_pr";
  approvedByUserId: string;
  targetArtifactId?: string;
  prUrl?: string;
}
```
