# OpsPilot Self-Troubleshooting Runbook

> **Target Audience:** OpsPilot Platform Maintainers & Self-Hosters  
> **Status:** Operational Runbook

This guide diagnoses and resolves operational issues with the OpsPilot platform itself.

---

## 1. Quick Diagnostic Checklist

| Symptom | Probable Cause | Diagnostic Command / Check |
|---|---|---|
| **API returning HTTP 503** | PostgreSQL connection pool exhausted or Redis down. | `docker compose logs postgres redis` |
| **Deployments stuck in `Queued`** | `deployment-worker` process crashed or Redis connection severed. | Check worker process status: `pm2 status` or `kubectl get pods -l app=opspilot-worker` |
| **Deployments stuck in `Building`** | Build runner container hung or disk out of space. | `docker ps -a` on runner host; check disk: `df -h` |
| **Health checks reporting false failures** | Service health check endpoint misconfigured or wrong port. | Run curl from inside the host: `curl -v http://localhost:<port>/health` |
| **AI investigations timing out** | LLM provider API rate limiting or network egress blocked. | Check worker logs: `grep "AiGateway" logs/worker.log` |

---

## 2. Common Scenarios & Resolutions

### Scenario A: BullMQ Queue Backlog
- **Symptom:** Deployments take several minutes before transitioning from `Queued` to `Preparing`.
- **Diagnosis:** Run BullMQ status check:
  ```bash
  # Check waiting job count in Redis
  redis-cli llen "bull:deployment-queue:wait"
  ```
- **Resolution:** Scale up worker processes by increasing concurrency in `.env` (`WORKER_CONCURRENCY=10`) or deploying additional worker containers.

### Scenario B: Database Connection Errors (`53300: too many connections`)
- **Symptom:** API logs report `PostgresError: remaining connection slots are reserved for non-replication superuser connections`.
- **Diagnosis:** Inspect active connection count in PostgreSQL:
  ```sql
  SELECT count(*), state FROM pg_stat_activity GROUP BY state;
  ```
- **Resolution:** Enable PgBouncer or reduce `DATABASE_POOL_MAX` in `.env` across API and worker instances.

### Scenario C: SSH Authentication Failures on VPS Target
- **Symptom:** Deployment worker reports `SSH authentication failed for user opspilot`.
- **Diagnosis:**
  1. Verify the public key is present in `/home/opspilot/.ssh/authorized_keys` on the target VPS.
  2. Verify directory permissions: `chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`.
  3. Ensure SSH server permits public key authentication (`PubkeyAuthentication yes` in `/etc/ssh/sshd_config`).
