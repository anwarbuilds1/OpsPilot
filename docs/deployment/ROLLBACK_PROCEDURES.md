# Deployment Rollback Procedures & Runbooks

> **Target:** Mean Time to Rollback < 60 seconds  
> **Status:** Operational Runbook

When a newly deployed release triggers an incident, elevates 500 error rates, or crashes containers, rapid rollback is the highest priority remediation action. This document details the exact rollback procedures for all supported providers.

---

## 1. Rollback Overview & SLA

- **AWS ECS Fargate Target SLA:** Target rollback execution under **60 seconds**.
- **VPS Docker Compose Target SLA:** Target rollback execution under **10 seconds**.
- **Core Principle:** A rollback **never** rebuilds container images from source code or recompiles dependencies. It strictly re-activates the pre-existing, verified deployment artifact.

---

## 2. AWS ECS Fargate Rollback Runbook

### Mechanism
In AWS ECS, every service update references a specific Task Definition Revision (e.g., `family:42`). A rollback simply instructs the ECS service to revert to revision `family:41`.

### Step-by-Step Operator Action:
1. Navigate to the Service Dashboard in OpsPilot (`/services/:id`).
2. Locate the failed or degraded deployment.
3. Click **"Trigger Rollback"** (or issue `POST /api/v1/deployments/:id/rollback`).
4. **Adapter Action:** `AwsEcsProvider` calls:
   ```typescript
   await ecs.updateService({
     cluster: clusterArn,
     service: serviceName,
     taskDefinition: previousTaskDefRevisionArn,
     forceNewDeployment: true
   });
   ```
5. ECS starts new Fargate tasks using the prior image and drains connections from the failing tasks.
6. The deployment status in OpsPilot transitions to `RollingBack` -> `Succeeded`.

---

## 3. VPS Docker Compose Rollback Runbook

### Mechanism
On an Ubuntu VPS, OpsPilot automatically creates `docker-compose.yml.backup` before applying any new deployment. The prior container image remains cached on the server.

### Step-by-Step Operator Action:
1. Click **"Trigger Rollback"** in the OpsPilot UI.
2. **Adapter Action:** `VpsDockerProvider` executes the following via SSH:
   ```bash
   cd /opt/opspilot/services/<service_id>
   cp docker-compose.yml.backup docker-compose.yml
   docker compose up -d --remove-orphans
   ```
3. Docker Compose recreates the containers using the cached prior image.
4. Telemetry worker verifies HTTP 200 responses on `/health`.
5. Rollback completes in under 5 seconds.

---

## 4. Post-Rollback Verification Checklist

- [ ] Confirm that active task/container count matches desired count.
- [ ] Verify that HTTP health check returns `200 OK` for 3 consecutive intervals.
- [ ] Check CloudWatch / Docker logs to ensure error logs have ceased.
- [ ] Verify that the associated incident transitions from `Mitigating` to `Resolved`.
- [ ] Record a post-incident timeline entry noting that the rollback was completed.
