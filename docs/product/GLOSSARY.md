# Glossary of Terms

To maintain architectural clarity and cross-document consistency, this glossary establishes canonical definitions for all core domain concepts in OpsPilot.

---

### Organization (Tenant)
The top-level multi-tenant boundary representing a company or software team. All users, projects, integrations, credentials, and audit logs belong to an Organization. Cross-organization access is strictly prohibited.

### Project
A logical collection of related deployable services (e.g., "Customer Portal", "Core Billing Suite"). Projects group services for unified visibility, metrics, and access control.

### Service
The atomic unit of deployment, configuration, and monitoring in OpsPilot. Represents a single containerized application or worker (e.g., `payments-api`, `notification-worker`). A service defines its source repository, Dockerfile, build parameters, runtime port, and health check.

### Environment
The operational stage of a service, such as `production` or `staging`. Environments govern resource allocations, domain bindings, and deployment approval policies.

### Deployment Target
A physical or logical infrastructure destination configured to receive container deployments. Supported targets include:
- `aws_ecs`: Amazon Web Services Elastic Container Service using AWS Fargate serverless compute.
- `vps_docker`: An Ubuntu Linux Virtual Private Server managed via SSH and Docker Compose.

### Deployment
An immutable record of a specific attempt to build, publish, and deploy a service at a specific Git commit SHA to a deployment target.

### Rollback
A deterministic recovery procedure that re-activates the immediately preceding known-good deployment artifact (Task Definition revision in ECS, or backup Compose file in VPS) without rebuilding source code.

### Health Check
A periodic HTTP probe (e.g., `GET /health`) issued to a running service container to assess readiness and liveness.

### Incident
An unexpected operational state of degradation or downtime detected through threshold breaches (e.g., 3 consecutive failed health checks, 5xx error spikes, container crash-loops).

### Incident Timeline
A unified chronological sequence of events spanning the 2 hours before and during an incident, correlating Git commits, deployments, configuration updates, alert triggers, and log anomalies.

### AI Investigation Agent
A bounded, autonomous software agent running in an isolated worker process that uses a provider-independent AI gateway to query read-only infrastructure tools, gather evidence, and diagnose incident root causes.

### Tool Call
An authorized request by the AI agent to query specific operational data (e.g., `get_application_logs`, `get_recent_deployments`). Every tool call is deterministic, time-bounded, permission-checked, and logged.

### Evidence Citation
A verifiable, concrete data reference (log snippet with timestamp, metric threshold breach, commit diff) attached to an AI investigation report to substantiate a diagnostic hypothesis.

### Remediation
A proposed operational fix (such as a configuration update, deployment rollback, or code patch) generated to resolve an incident. Remediation proposals require explicit human approval.

### Envelope Encryption
A cryptographic methodology where data (credentials, SSH keys) is encrypted with a unique data encryption key (DEK), and the DEK is encrypted with a master key-encrypting key (KEK) managed by a Key Management Service (KMS) or local master secret.
