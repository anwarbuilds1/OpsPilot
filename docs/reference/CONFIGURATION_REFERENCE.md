# Service Configuration Reference (`opspilot.yaml`)

> **File:** `opspilot.yaml` (Optional in-repository service manifest)  
> **Status:** Specification

While services can be fully configured via the OpsPilot Dashboard and REST API, teams can also commit an optional `opspilot.yaml` manifest in their repository root.

---

## Example `opspilot.yaml` Specification

```yaml
version: "1.0"

service:
  name: "payments-api"
  environment: "production"

build:
  dockerfile: "Dockerfile"
  context: "."
  args:
    NODE_ENV: "production"
  target_stage: "runner"

runtime:
  port: 8080
  healthcheck:
    path: "/health"
    interval_seconds: 5
    timeout_seconds: 3
    retries: 3
    start_period_seconds: 15

resources:
  cpu: 512       # 512 CPU units = 0.5 vCPU
  memory: 1024   # 1024 MB RAM

deployment:
  provider: "aws_ecs" # "aws_ecs" | "vps_docker"
  auto_rollback: true
  stabilization_timeout_seconds: 600

notifications:
  slack_webhook_url_secret: "SLACK_ALERT_WEBHOOK"
  notify_on:
    - "deployment.succeeded"
    - "deployment.failed"
    - "incident.created"
```
