# User Personas & Scenarios

OpsPilot is engineered to solve specific operational bottlenecks experienced by small engineering teams. This document details our primary target personas, their workflows, core frustrations, and how OpsPilot delivers tangible value.

---

## Persona 1: Sarah — The Technical Co-Founder / CTO

### Profile & Background
- **Role:** Co-founder & Chief Technology Officer at a 10-person B2B SaaS startup.
- **Team Size:** 5 engineers (3 backend, 2 frontend/full-stack).
- **Infrastructure:** 4 backend microservices on AWS ECS Fargate, 1 Redis cluster, RDS PostgreSQL.
- **Core Responsibility:** Delivering product features rapidly while keeping production stable, secure, and cost-effective.

### Pain Points & Frustrations
1. **Context Switching:** Sarah is pulled away from coding and hiring every time an alert fires on AWS CloudWatch.
2. **Lack of Dedicated SRE:** Cannot justify hiring a dedicated $180k/year DevOps/SRE engineer, but AWS Console complexity is overwhelming for junior developers.
3. **Deployment Anxiety:** Deployments often happen right before feature demos; failed deployments cause frantic rollbacks and customer downtime.

### How OpsPilot Helps Sarah
- Centralizes application deployment and health status into one clean, non-intimidating dashboard.
- Automatically catches broken deployments within 60 seconds through automated health-check stabilization.
- Instant, deterministic rollbacks to the previous ECS task revision without needing to navigate the AWS Console.

---

## Persona 2: Alex — Senior Backend Engineer

### Profile & Background
- **Role:** Senior Backend Engineer responsible for core API services, data pipelines, and third-party integrations.
- **Experience:** 6+ years in Node.js, Python, PostgreSQL, and Docker.
- **Infrastructure:** 2 core monoliths and 3 background worker services running on a pair of Ubuntu VPS instances managed with Docker Compose.

### Pain Points & Frustrations
1. **Manual Investigation Drudgery:** When an HTTP 500 error spike occurs, Alex has to SSH into multiple VPS instances, inspect Docker container logs with `docker logs --tail 500`, and correlate timestamps with GitHub commit history.
2. **Ambiguous Root Causes:** Difficult to tell whether an outage is caused by a recent code commit, a database connection pool leak, or a third-party payment gateway timeout.
3. **Repetitive Incidents:** The team encounters the same class of database connection exhaustion issues multiple times because post-mortems are rushed.

### How OpsPilot Helps Alex
- Correlates deployment timestamps with runtime log errors and CPU/memory metrics automatically.
- AI Investigation Agent gathers error logs, queries metrics, checks recent commits, and outputs an evidence-backed hypothesis within 2 minutes.
- Alex spends time fixing the root cause rather than gathering logs across SSH terminals.

---

## Persona 3: Marcus — Full-Stack Engineer

### Profile & Background
- **Role:** Full-Stack Engineer shipping user-facing features across Next.js and Node.js APIs.
- **Experience:** 3 years in React, TypeScript, and Express.
- **Infrastructure:** Deploys staging environments on VPS and production on AWS.

### Pain Points & Frustrations
1. **Tooling Fragmentation:** Dislikes juggling the AWS Console, GitHub Actions YAML, and VPS command lines.
2. **Unclear Deployment Status:** Hard to know if a deployment succeeded, is still building, or failed silently in container initialization.
3. **Fear of Breaking Production:** Hesitates to push updates on Friday afternoon due to lack of visibility into post-deployment health.

### How OpsPilot Helps Marcus
- Provides a simple UI where pushing to GitHub triggers an observable build and deployment pipeline with streaming logs.
- Immediate visual indicators of service health (Green / Degraded / Unhealthy).
- Clear, understandable AI incident summaries written in plain engineering terms with direct links to the culprit commit.
