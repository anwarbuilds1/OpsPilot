# MVP Scope & Feature Boundaries

To avoid the common pitfall of scope explosion in developer tooling and AI products, OpsPilot enforces strict boundaries for its Minimum Viable Product (MVP).

---

## 1. Prioritization Framework

- **P0 (MVP Must-Have):** Essential features without which the core end-to-end workflow (Connect -> Deploy -> Observe -> Detect -> AI Investigate -> Rollback) cannot function.
- **P1 (Post-MVP Should-Have):** High-value operational enhancements built immediately after MVP validation.
- **P2 (Future / Long-Term):** Advanced enterprise capabilities, alternative cloud providers, and complex deployment topologies.

---

## 2. Priority Classification Matrix

| Functional Area | P0 (MVP Release) | P1 (Post-MVP) | P2 (Future Roadmap) |
|---|---|---|---|
| **Auth & Organizations** | Email/Password, Org creation, 4 core RBAC roles (Owner, Admin, Engineer, Viewer) | Member email invitations, Org settings | SAML 2.0 / OIDC SSO, Multi-Factor Auth (MFA) |
| **Integrations** | GitHub App (webhooks), AWS IAM role assumption, VPS SSH registration | Slack / Discord alerting webhooks | GitLab, Bitbucket, GCP, Azure, DigitalOcean |
| **Deployment Targets** | AWS ECS / Fargate, Ubuntu VPS (Docker Compose) | Automated image cleanup on VPS | Kubernetes (EKS/K8s), HashiCorp Nomad |
| **Deployment Strategies** | Rolling update, Task definition replacement, One-click Rollback | Pre-deployment environment checks | Blue/Green with traffic shaping, Canary deployments |
| **Observability** | HTTP health check polling, Container CPU & Memory metrics, Application log streaming | OpenTelemetry trace ingestion, Custom metric dashboards | Log indexing search engine, Distributed trace graphs |
| **Incident Management** | Threshold detection (Health check, 5xx, OOM/crash), Timeline generation | Incident assignment, Acknowledgment, Deduplication rules | On-call scheduling, Escalation policies |
| **AI Investigation** | Read-only agent, 9 infrastructure tools, Structured evidence report | Automated Git branch & Remediation PR preparation | Multi-agent investigation, Autonomous remediation |
| **Security & Audit** | Envelope encryption for credentials, Tenant isolation in PostgreSQL, Audit logs | Secret scanning in logs | SOC2 compliance reports, Hardware Security Module (HSM) |

---

## 3. Explicit Customer & Capability Exclusions for MVP

To ensure architectural clarity and high execution speed, the following are **strictly excluded** from the MVP:
1. **Kubernetes Support:** OpsPilot will not support Kubernetes (K8s/EKS) in the initial release. Teams using Kubernetes have different operational models that require specialized controllers and CRDs.
2. **Autonomous Production Execution:** The AI model is strictly prohibited from executing destructive or state-changing infrastructure actions (restarts, rollbacks, deletions) autonomously. Human approval is mandatory.
3. **Full Observability Replacement:** OpsPilot is not attempting to replace Datadog or Prometheus. It ingests targeted telemetry necessary for incident detection and correlation.
4. **On-Call Scheduling:** No SMS alerting, phone escalations, or shift rotations. OpsPilot connects to external notification channels.
5. **Multi-Cloud Arbitrary Infrastructure Provisioning:** OpsPilot will deploy containers to pre-existing or Terraform-bootstrapped ECS clusters and VPS instances; it does not provision arbitrary VPCs, subnets, or database clusters dynamically.
