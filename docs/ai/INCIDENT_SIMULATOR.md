# Incident Simulator & Benchmark Scenarios

> **Framework:** Automated Fault Injection for AI Agent Evaluation  
> **Total Scenarios:** 15 Canonical Production Failure Modes  
> **Safety Rule:** Simulations run exclusively in disposable test environments.

To evaluate, benchmark, and regression-test the OpsPilot AI Investigation Agent without relying on live customer outages, OpsPilot includes an **Incident Simulator**.

---

## 1. Scenario Catalog

### Scenario 1: Redis Unavailable
- **Trigger:** Redis container stopped or network firewall blocks port 6379.
- **Symptoms:** Cache read timeouts; BullMQ workers stall; logs display `ECONNREFUSED 127.0.0.1:6379`.
- **Expected Diagnosis:** Redis backing instance is down or unreachable over network.
- **Evidence Required:** Log citations showing socket connection refusal; Redis metric dropped to zero.
- **Remediation:** Verify Redis container state; restart Redis daemon.

---

### Scenario 2: Database Connection Pool Exhaustion
- **Trigger:** Microservice connection pool ceiling configured lower than peak request concurrency.
- **Symptoms:** HTTP 500 surge; response latency spikes to acquire timeout (10s); logs show `ConnectionAcquireTimeoutError`.
- **Expected Diagnosis:** DB connection pool starvation due to insufficient `max` pool configuration or unclosed connection leak.
- **Evidence Required:** Error logs showing active connections at maximum capacity; correlated recent commit altering pool config.
- **Remediation:** Increase connection pool size or rollback deployment.

---

### Scenario 3: Database Latency & Slow Queries
- **Trigger:** High-volume table missing an index, leading to sequential table scans.
- **Symptoms:** Database CPU utilization reaches 100%; API P95 latency increases from 50ms to 4500ms; health checks intermittently time out.
- **Expected Diagnosis:** Database queries degraded by full table scan.
- **Evidence Required:** Slow query logs (> 1000ms); correlated query text.
- **Remediation:** Add missing database index or rollback schema change.

---

### Scenario 4: Node.js Memory Leak & OOM Crash
- **Trigger:** Global array accumulating request objects on every HTTP request.
- **Symptoms:** Memory usage continuously climbs until reaching container memory limit (1024 MB); container exits with code 137 (SIGKILL / OOMKilled).
- **Expected Diagnosis:** Heap memory leak causing container OOM termination.
- **Evidence Required:** Memory metric graph showing monotonic upward climb; container status `OOMKilled: true`.
- **Remediation:** Rollback to previous deployment; profile heap snapshot.

---

### Scenario 5: CPU Spike & Event Loop Starvation
- **Trigger:** Inefficient regex with catastrophic backtracking (ReDoS) or synchronous cryptographic hashing on the main thread.
- **Symptoms:** Container CPU jumps to 100%; event loop lag exceeds 5000ms; HTTP requests time out.
- **Expected Diagnosis:** Node.js event loop blocked by CPU-intensive synchronous task or ReDoS regex.
- **Evidence Required:** CPU metric sustained at 100%; high event loop latency.
- **Remediation:** Rollback culprit commit; replace regex or offload to worker threads.

---

### Scenario 6: HTTP 500 Unhandled Exception Spike
- **Trigger:** Code change introduces an unhandled `TypeError: Cannot read properties of undefined` in an API controller.
- **Symptoms:** 5xx error rate spikes to > 20%; health check endpoint remains healthy (200), but specific routes fail.
- **Expected Diagnosis:** Unhandled null reference exception introduced in recent release.
- **Evidence Required:** Stack trace citations from application stderr; correlated commit diff.
- **Remediation:** Rollback deployment; open hotfix PR.

---

### Scenario 7: BullMQ Queue Backlog & Worker Starvation
- **Trigger:** Worker processes killed or worker concurrency set too low while job arrival rate spikes.
- **Symptoms:** Redis queue depth increases to > 50,000 jobs; job processing latency increases.
- **Expected Diagnosis:** Insufficient background worker concurrency causing job starvation.
- **Evidence Required:** Queue depth metric; worker heartbeat latency.
- **Remediation:** Scale worker container count; increase worker concurrency.

---

### Scenario 8: Third-Party Payment API Timeout
- **Trigger:** Outbound payment gateway (e.g., Stripe sandbox) mock injected with 30s network latency.
- **Symptoms:** Checkout API endpoint times out; upstream client connections severed; database transactions held open.
- **Expected Diagnosis:** Upstream third-party external API failure.
- **Evidence Required:** Outbound HTTP client timeout logs pointing to external API domain.
- **Remediation:** Enable circuit breaker; activate fallback payment provider.

---

### Scenario 9: Bad Deployment (Syntax Error in Compiled Bundle)
- **Trigger:** Missing production dependency in `package.json` causes container to crash on `import` during startup.
- **Symptoms:** Container exits immediately with code 1; ECS service cannot reach steady state; health checks never succeed.
- **Expected Diagnosis:** Missing runtime module dependency causing fatal startup crash.
- **Evidence Required:** Startup error logs (`MODULE_NOT_FOUND`); deployment event showing failed stabilization.
- **Remediation:** Immediate rollback to previous task definition revision.

---

### Scenario 10: Missing Database Index
- **Trigger:** Migration deployed without index on `users.organization_id`.
- **Symptoms:** Elevated query times on tenant lookups under load.
- **Expected Diagnosis:** Unindexed foreign key query degradation.
- **Evidence Required:** PostgreSQL `pg_stat_statements` sequential scan count.
- **Remediation:** Run `CREATE INDEX CONCURRENTLY`.

---

### Scenario 11: Disk Space Exhaustion on VPS
- **Trigger:** Docker build cache and dangling images fill host `/var/lib/docker` to 100%.
- **Symptoms:** `docker compose up` fails with `no space left on device`; container logs cannot be written.
- **Expected Diagnosis:** VPS host disk capacity exhausted.
- **Evidence Required:** VPS disk metrics showing 100% utilization; Docker daemon errors.
- **Remediation:** Run `docker system prune -af` and clean old logs.

---

### Scenario 12: Container Crash-Looping
- **Trigger:** Application throws uncaught exception immediately upon receiving first database connection.
- **Symptoms:** Docker container restarts repeatedly every 5 seconds (CrashLoopBackOff).
- **Expected Diagnosis:** Fatal uncaught exception in initialization sequence.
- **Evidence Required:** Rapid succession of container exit code 1 events; repeated startup log lines.
- **Remediation:** Revert deployment immediately.

---

### Scenario 13: Network Latency & Intermittent Packet Loss
- **Trigger:** Simulated 300ms latency and 15% packet loss between application container and database.
- **Symptoms:** Intermittent health check failures; erratic API response times.
- **Expected Diagnosis:** Network layer degradation between application and backing services.
- **Evidence Required:** Intermittent TCP connection reset logs; fluctuating latency metrics.
- **Remediation:** Investigate VPC routing and cloud provider network health.

---

### Scenario 14: Invalid Environment Variable / Malformed Secret
- **Trigger:** Deployment configured with `PORT=eighty-eighty` (non-numeric) or missing mandatory `JWT_SECRET`.
- **Symptoms:** Application fails Zod schema validation on startup and terminates.
- **Expected Diagnosis:** Startup configuration validation failure due to invalid environment variable.
- **Evidence Required:** Stderr logs displaying Zod validation error for specific environment variable key.
- **Remediation:** Correct environment variable value in service settings and redeploy.

---

### Scenario 15: Database Migration Failure (Deadlock / Lock Timeout)
- **Trigger:** Migration executes `ALTER TABLE orders ADD COLUMN ...` on a locked table, exceeding lock timeout.
- **Symptoms:** Pre-deployment migration job fails; deployment is aborted before updating containers.
- **Expected Diagnosis:** Database migration aborted due to lock acquisition timeout.
- **Evidence Required:** Migration task failure logs with PostgreSQL error `55P03: lock_not_available`.
- **Remediation:** Terminate blocking query; re-run migration with safe lock timeout.
