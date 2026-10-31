# Deployment Runner Security & Sandbox Isolation

> **Execution Environment:** Ephemeral Containerized Sandboxes  
> **Threats Addressed:** Container Escape, Host Takeover, Runaway Resource Consumption

When OpsPilot builds container images from customer Git repositories, it executes untrusted `Dockerfile` directives (`RUN`, `ADD`, `COPY`). This document specifies the sandbox isolation controls protecting the host system.

---

## 1. Sandbox Hardening Checklist

| Security Control | Implementation | Purpose |
|---|---|---|
| **Non-Root User** | `USER 10001:10001` inside runner container | Prevents privilege escalation on the host in the event of an escape. |
| **No Docker Socket Mounting** | Host `/var/run/docker.sock` is **never** mounted | Eliminates the standard container breakout path to host root. |
| **Read-Only Root Filesystem** | `--read-only` with `tmpfs` mounts for `/tmp` and `/build` | Prevents persistence of malicious payloads or rootkits inside the runner image. |
| **Dropped Linux Capabilities** | `--cap-drop=ALL` (retains only `CHOWN`, `SETUID`, `SETGID`) | Strips dangerous capabilities like `CAP_SYS_ADMIN`, `CAP_NET_RAW`, `CAP_SYS_PTRACE`. |
| **No-New-Privileges** | `--security-opt=no-new-privileges:true` | Prevents setuid binaries inside the customer repo from gaining elevated permissions. |
| **Hard Memory Ceiling** | `--memory=2048m --memory-swap=2048m` | Protects worker node from host Out-Of-Memory (OOM) crashes. |
| **Hard CPU Quotas** | `--cpus=2.0` | Prevents runaway crypto-mining or infinite build loops from starving the host. |
| **Execution Timeout** | Hard 900-second (15-minute) SIGKILL | Automatically kills stalled or hung builds. |

---

## 2. Ephemeral Lifecycle & Workspace Wiping

1. **Dedicated Workspace:** Each build executes inside a unique directory `/tmp/opspilot/builds/<deployment-id>/`.
2. **Deterministic Cleanup:** Immediately upon build completion or failure, the deployment worker executes an unconditioned cleanup routine:
   ```bash
   rm -rf /tmp/opspilot/builds/<deployment-id>
   ```
3. **No Cross-Tenant Cache Sharing:** Build caches are strictly segregated by `organization_id` to prevent malicious cache poisoning between organizations.
