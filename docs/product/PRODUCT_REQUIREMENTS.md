# Product Requirements Document (PRD)

> **Product:** OpsPilot  
> **Version:** 1.0  
> **Status:** Proposed Specification  
> **Priorities:** P0 (MVP Must-Have), P1 (Post-MVP Should-Have), P2 (Future Enhancement)

---

## 1. Authentication & Organization Management (AUTH)

### AUTH-001: User Registration and Password Authentication
- **Priority:** P0
- **Actor:** Unauthenticated User
- **Preconditions:** User has a valid, non-disposable email address.
- **Expected Behavior:** User can register with email and a secure password (minimum 12 characters, including uppercase, lowercase, numbers, and symbols). System hashes password using `bcrypt` (work factor 12) or Argon2id.
- **Acceptance Criteria:**
  - JWT session token (or secure HTTP-only cookie) issued upon successful registration.
  - Organization creation prompt immediately follows first-time registration.
  - Duplicate email registrations are rejected with an appropriate generic error to prevent user enumeration.
- **Failure Conditions:** Weak password, invalid email format, network partition with PostgreSQL.
- **Security Considerations:** Rate limit registration attempts (max 5 requests/minute per IP) to prevent account creation spam.

### AUTH-002: Organization & Tenant Creation
- **Priority:** P0
- **Actor:** Authenticated User
- **Preconditions:** User is logged in.
- **Expected Behavior:** User creates an organization representing their company or team. The creator is automatically assigned the `Owner` role.
- **Acceptance Criteria:**
  - Organization entity created with a unique `slug` and `UUID`.
  - Membership record created linking user and organization with role `Owner`.
  - All subsequent entity creations (projects, services, integrations) are strictly bounded to this `organization_id`.
- **Failure Conditions:** Organization slug collision.
- **Security Considerations:** Slug sanitized to prevent path traversal or XSS in subdomains/routes.

### AUTH-003: Role-Based Access Control (RBAC)
- **Priority:** P0
- **Actor:** Organization Member
- **Preconditions:** User is authenticated and a member of the organization.
- **Expected Behavior:** System strictly enforces permissions across four roles:
  1. `Owner`: Full management of organization, billing, members, and destructive actions.
  2. `Admin`: Manage projects, services, integrations, and deployment configurations.
  3. `Engineer`: Trigger deployments, view logs, inspect incidents, and initiate AI investigations.
  4. `Viewer`: Read-only access to services, deployments, metrics, and incident reports.
- **Acceptance Criteria:**
  - Backend authorization guards reject unauthorized requests with HTTP `403 Forbidden`.
  - Role enforcement occurs in backend middleware; UI visibility is purely cosmetic.
- **Failure Conditions:** User attempts actions outside their role permission scope.
- **Security Considerations:** Prevent privilege escalation; `Admin` cannot promote themselves or others to `Owner`.

### AUTH-004: Team Member Invitations
- **Priority:** P1
- **Actor:** Organization Owner or Admin
- **Preconditions:** Actor has permission to manage members.
- **Expected Behavior:** Sends an invitation link with a cryptographically secure token (valid for 7 days) to the invitee's email.
- **Acceptance Criteria:**
  - Token is hashed at rest in PostgreSQL.
  - Acceptance assigns the invitee directly to the organization with the pre-configured role.
- **Failure Conditions:** Token expired, token already claimed.

---

## 2. Project & Service Management (PROJ)

### PROJ-001: Project Entity Management
- **Priority:** P0
- **Actor:** Organization Admin or Owner
- **Preconditions:** User belongs to an active organization.
- **Expected Behavior:** Create, update, list, and soft-delete projects. A project serves as a logical grouping of related services (e.g., "E-Commerce Suite" containing API, Worker, and Web).
- **Acceptance Criteria:**
  - Project contains `name`, `description`, `slug`, and `organization_id`.
  - Deleting a project soft-deletes associated child services and cancels active deployment jobs.
- **Failure Conditions:** Duplicate project name within the same organization.

### PROJ-002: Service Definition & Configuration
- **Priority:** P0
- **Actor:** Organization Admin or Engineer
- **Preconditions:** Project exists.
- **Expected Behavior:** Configure a deployable service unit.
- **Acceptance Criteria:**
  - Service specifies: repository reference, branch, Dockerfile path, build context, port, and health-check endpoint (`/health`).
  - Resource allocations defined (CPU, Memory limits).
  - Target environment selected (`production`, `staging`).
- **Failure Conditions:** Invalid repository or malformed health-check path.
- **Security Considerations:** Health-check endpoint must be a relative URL path (prevent SSRF).

---

## 3. Integration Management (INT)

### INT-001: GitHub App Integration
- **Priority:** P0
- **Actor:** Organization Admin or Owner
- **Preconditions:** User has administrative access to the GitHub organization/repository.
- **Expected Behavior:** Installs the OpsPilot GitHub App. OpsPilot receives an installation ID, exchanges it for temporary installation access tokens, and lists accessible repositories.
- **Acceptance Criteria:**
  - Webhooks received for `push`, `pull_request`, and `workflow_run` events.
  - Webhook signatures validated using HMAC-SHA256 with the configured webhook secret.
  - Token refresh occurs automatically every 50 minutes.
- **Failure Conditions:** Invalid webhook secret, expired GitHub installation token.
- **Security Considerations:** GitHub tokens must never be logged or exposed to the frontend.

### INT-002: AWS Account Connection via IAM Role Assumption
- **Priority:** P0
- **Actor:** Organization Owner
- **Preconditions:** AWS account with permissions to create IAM roles.
- **Expected Behavior:** OpsPilot provides a CloudFormation/Terraform template to create an IAM role with a unique external ID. OpsPilot assumes this role using AWS STS (`sts:AssumeRole`) with least privilege.
- **Acceptance Criteria:**
  - No permanent AWS Access Key / Secret Key stored in OpsPilot.
  - STS credentials are temporary (1-hour duration) and refreshed by workers.
  - Role validates read/write access to Amazon ECR, ECS, and CloudWatch.
- **Failure Conditions:** Incorrect External ID, insufficient IAM policy attached.
- **Security Considerations:** Enforce external ID validation to eliminate the Confused Deputy problem.

### INT-003: VPS Server Registration
- **Priority:** P0
- **Actor:** Organization Owner or Admin
- **Preconditions:** Target Ubuntu VPS has Docker and Docker Compose installed.
- **Expected Behavior:** User registers VPS by providing hostname/IP, SSH user (e.g., `opspilot`), and an SSH private key or authorized public key pair.
- **Acceptance Criteria:**
  - OpsPilot tests SSH connectivity and verifies Docker Engine (`docker --version`) and Docker Compose (`docker compose version`).
  - SSH private keys are encrypted at rest using envelope encryption (AES-256-GCM).
- **Failure Conditions:** Unreachable host, authentication failure, missing Docker daemon.
- **Security Considerations:** Decryption occurs exclusively in isolated deployment runners.

---

## 4. Deployment Management (DEP)

### DEP-001: Docker Image Build Pipeline
- **Priority:** P0
- **Actor:** OpsPilot Deployment Worker
- **Preconditions:** Valid GitHub commit SHA, connected repository.
- **Expected Behavior:** Deployment runner clones the commit, builds the Docker image in an isolated environment, tags it with the commit SHA and deployment ID, and pushes it to the target container registry (Amazon ECR for AWS; private registry or direct VPS transfer for VPS).
- **Acceptance Criteria:**
  - Build logs streamed to PostgreSQL and UI in real-time.
  - Enforced timeout (default: 15 minutes) to prevent runaway builds.
  - Build cache leveraged to minimize duration.
- **Failure Conditions:** Dockerfile syntax error, failed compilation, disk space exhaustion.
- **Security Considerations:** Build runner executes as non-root with restricted network capabilities.

### DEP-002: AWS ECS / Fargate Deployment Adapter
- **Priority:** P0
- **Actor:** Deployment Engine
- **Preconditions:** Docker image published to ECR, valid ECS cluster and service.
- **Expected Behavior:**
  1. Register a new ECS Task Definition revision with the new container image URI and environment variables.
  2. Update the ECS Service to use the new Task Definition.
  3. Monitor ECS deployment stabilization events (`SERVICE_STEADY_STATE`).
  4. Poll service health check endpoint.
- **Acceptance Criteria:**
  - Deployment completes when service reaches steady state and health check passes.
  - Deployment fails if tasks fail to start or crash within the stabilization window.
- **Failure Conditions:** Task failing health check, memory limit exceeded (OOMKilled).

### DEP-003: VPS Docker Compose Deployment Adapter
- **Priority:** P0
- **Actor:** Deployment Engine
- **Preconditions:** Connected VPS, image built or pulled from registry.
- **Expected Behavior:**
  1. Generate standardized `docker-compose.yml` manifest inside `/opt/opspilot/services/<service-id>/`.
  2. Pull updated images.
  3. Execute `docker compose up -d --remove-orphans`.
  4. Poll container health checks.
- **Acceptance Criteria:**
  - Preserves previous compose file as `docker-compose.yml.backup` for immediate rollback.
  - Polls health check endpoint up to 120 seconds.
- **Failure Conditions:** Container exited with non-zero status, port binding conflict.

### DEP-004: Automated Health Checks & Deployment Stabilization
- **Priority:** P0
- **Actor:** Deployment Engine
- **Preconditions:** Deployment has initiated.
- **Expected Behavior:** Periodically queries the service's configured health check endpoint (e.g., `GET /health` on container port) every 5 seconds.
- **Acceptance Criteria:**
  - Requires 3 consecutive HTTP `200 OK` responses within the timeout window (180s) to mark deployment as `Succeeded`.
  - If timeout is reached or non-200 responses persist, marks deployment as `Failed` and triggers alert.

### DEP-005: One-Click & Automated Rollback
- **Priority:** P0
- **Actor:** Organization Engineer / Admin or Automated Policy
- **Preconditions:** Previous successful deployment exists for the service.
- **Expected Behavior:** Immediately switches the active service configuration back to the previous known-good deployment:
  - AWS ECS: Updates ECS service back to the prior Task Definition revision.
  - VPS Docker: Restores backup compose manifest and runs `docker compose up -d`.
- **Acceptance Criteria:**
  - Rollback executes within 60 seconds of trigger.
  - Rollback event recorded in audit logs and deployment timeline.

---

## 5. Observability & Telemetry (OBS)

### OBS-001: Health Check Monitoring
- **Priority:** P0
- **Actor:** Telemetry Worker
- **Preconditions:** Service has an active deployment and defined health endpoint.
- **Expected Behavior:** Executes HTTP GET request against the service endpoint at 30-second intervals.
- **Acceptance Criteria:**
  - Records latency, status code, and timestamp in `health_checks` table.
  - Flags service as `Degraded` on 2 failures; `Unhealthy` on 3 consecutive failures.

### OBS-002: Container Metrics Ingestion
- **Priority:** P0
- **Actor:** Telemetry Worker
- **Preconditions:** Telemetry integration active.
- **Expected Behavior:** Gathers CPU utilization (percentage), Memory usage (megabytes & percent), and network I/O from CloudWatch (for AWS) or Docker daemon (for VPS).
- **Acceptance Criteria:**
  - Aggregated in 1-minute intervals.
  - Retained for 30 days in PostgreSQL time-partitioned tables.

### OBS-003: Application Log Ingestion & Time-Bounded Querying
- **Priority:** P0
- **Actor:** Telemetry Worker
- **Preconditions:** Workloads writing stdout/stderr.
- **Expected Behavior:** Retrieves recent log lines for a service during normal operation and incident investigation.
- **Acceptance Criteria:**
  - Supports time-windowed querying (e.g., `from: now-30m to: now`).
  - Automatic filtering and masking of credit cards, passwords, and API tokens.

---

## 6. Incident Management (INC)

### INC-001: Automated Incident Creation
- **Priority:** P0
- **Actor:** Incident Engine
- **Preconditions:** Telemetry worker detects condition breach.
- **Expected Behavior:** Creates an incident record when:
  1. Service health check fails 3 times consecutively.
  2. Container crashes or exits with non-zero code.
  3. HTTP 5xx error rate exceeds 5% over a 5-minute rolling window.
  4. Memory or CPU exceeds 90% sustained for 3 minutes.
- **Acceptance Criteria:**
  - Unique Incident ID generated.
  - Severity assigned (`Critical`, `High`, `Medium`, `Low`) based on rule criteria.
  - Correlated with the most recent deployment within the preceding 2 hours.

### INC-002: Incident Timeline Generation
- **Priority:** P0
- **Actor:** Incident Engine
- **Preconditions:** Incident created.
- **Expected Behavior:** Assembles a chronological timeline containing:
  - Triggering metric or health check alert.
  - Recent deployment events and commit SHAs.
  - Environment variable updates.
  - Relevant error log snippets.
- **Acceptance Criteria:**
  - Displayed visually in the incident dashboard.

---

## 7. AI Incident Investigation Agent (AI)

### AI-001: Read-Only Incident Investigation
- **Priority:** P0
- **Actor:** AI Investigation Worker
- **Preconditions:** Incident status is `Open` or `Investigating`.
- **Expected Behavior:** Launches a bounded investigation loop. The AI agent invokes authorized read-only tools to collect evidence from logs, metrics, deployments, and git diffs, forming an evidence-backed hypothesis.
- **Acceptance Criteria:**
  - Investigation completes within 3 minutes.
  - Strictly limited to 10 tool calls per run.
  - Produces structured output: Observations, Probable Cause Hypothesis, Supporting Evidence citations, and Recommended Remediation.
- **Security Considerations:** Agent tools are strictly read-only. Model has no access to shell execution or AWS write permissions.

### AI-002: Automated Remediation PR Preparation
- **Priority:** P1
- **Actor:** AI Remediation Engine
- **Preconditions:** Human triggers "Prepare Fix" or approves investigation recommendation.
- **Expected Behavior:**
  1. Checks out repository at the target commit on an isolated branch (`opspilot/fix-incident-<id>`).
  2. Generates minimal code or configuration diff addressing root cause.
  3. Executes unit tests locally.
  4. Opens a GitHub Pull Request with a full diagnostic summary.
- **Acceptance Criteria:**
  - Does NOT merge PR or deploy autonomously.
  - Human engineer must review and approve PR in GitHub.
