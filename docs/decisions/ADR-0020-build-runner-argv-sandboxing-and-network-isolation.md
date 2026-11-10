# ADR-0020: Build Runner Argv Sandboxing and Network Isolation

- **Status:** Accepted
- **Date:** 2026-11-10
- **Author(s):** OpsPilot Core Engineering
- **Deciders:** Platform Security & Core Architecture Team

---

## Context
OpsPilot executes untrusted customer build workloads in isolated container runners (`HardenedBuildRunner`). The runner specification enforces least privilege via non-root execution (UID/GID 10001), read-only root filesystems, dropped capabilities (`--cap-drop=ALL`), fork-bomb process limits (`--pids-limit=256`), memory limits, and bounded ephemeral tmpfs storage.

An audit identified that `build-entrypoint.sh` contained an unsafe shell evaluation path (`exec bash -c "${OPSPILOT_BUILD_COMMAND}"`), creating an arbitrary shell injection surface for customer-supplied commands. Additionally, default network isolation needed explicit enforcement.

## Problem Statement
How to eliminate shell injection surfaces during build execution, ensure hermetic build environments by default, prevent cloud instance metadata access, and guarantee deterministic container lifecycle cleanup?

## Decision
1. **Validated Argv Array Execution:**
   - `BuildRunnerTask` accepts `commandArgs: readonly string[]` representing explicit argv tokens.
   - `docker/runners/scripts/build-entrypoint.sh` executes customer arguments directly via `exec "$@"` without invoking a shell interpreter.
   - Evaluation of `OPSPILOT_BUILD_COMMAND` via `bash -c` or `eval` is completely removed. Passing shell wrapper strings (`sh -c`, `bash -c`) as `commandArgs` is strictly forbidden and rejected during security audit.
   - Legacy `buildCommand` strings containing shell metacharacters (`;`, `&`, `|`, `` ` ``, `$`, `()`, `<>`, `\n`) are rejected with `SecurityViolationException`.

2. **Network Isolation by Default (`--network=none`):**
   - Build containers default to `--network=none` to guarantee hermetic execution.
   - For workloads requiring package dependencies, explicit isolated bridge mode (`--network=isolated-bridge`) is supported with iptables egress drops for cloud metadata (`169.254.169.254/32`) and private subnets.
   - Host networking (`--network=host`) is strictly forbidden and rejected in `auditTaskSecurity`.

3. **Deterministic Container Naming & Ephemeral Cleanup:**
   - Every build container is named deterministically: `--name=opspilot-build-${task.buildId}`.
   - `HardenedBuildRunner.generateCleanupCommand(buildId)` provides deterministic cleanup (`docker rm -f opspilot-build-${buildId}`) with strict build ID validation to prevent command injection.

4. **Preserved Boundaries:**
   - The build runner remains a decoupled configuration specification and parameter validator in Phase 0. Live host Docker daemon invocation remains scheduled for Phase 1.

## Alternatives Considered
1. **Shell Sanitization / Escaping:** Attempting regex sanitization of shell strings. Rejected: shell escaping is notoriously error-prone; direct `execve` argv execution is provably immune to shell injection.
2. **Allowing Host Networking:** Permitting `--network=host` for builds that need localhost services. Rejected: host networking eliminates network namespace boundaries and exposes host-bound services to untrusted customer code.

## Rationale & Consequences
### Positive Consequences:
- Eliminates shell injection vectors completely from build container entrypoints.
- Enforces hermetic builds by default.
- Prevents container escapes to AWS/GCP/Azure instance metadata services (`169.254.169.254`).
- Provides robust, automated container cleanup primitives.

### Negative Consequences / Trade-offs:
- Customers wishing to chain commands must express them via scripts or Makefile targets within their repo rather than shell one-liners with `;` or `&&`.

## Security Implications & Boundary Classification

To maintain operational integrity and avoid overstating security maturity, the controls are explicitly classified across implementation and runtime tiers:

1. **Enforced by Implementation (Verified in Phase 0):**
   - **Direct Argv Execution:** `docker/runners/scripts/build-entrypoint.sh` executes customer arguments via `exec "$@"`, eliminating shell string evaluation (`eval` and `bash -c`).
   - **Input Validation:** `HardenedBuildRunner.auditTaskSecurity()` strictly rejects shell wrappers (`sh -c`, `bash -c`), null bytes in argv arguments, shell metacharacters in legacy command strings, and dangerous volume mounts (`/var/run/docker.sock`, `/etc`, etc.).
   - **Build ID Sanitization:** `buildId` is strictly restricted to alphanumeric characters, dashes, and underscores (`^[a-zA-Z0-9_-]+$`), preventing container name manipulation or shell injection in cleanup commands.

2. **Represented in Generated Docker Arguments (Configuration Only in Phase 0):**
   - Flags such as `--network=none`, `--user 10001:10001`, `--read-only`, `--cap-drop=ALL`, `--security-opt=no-new-privileges:true`, `--pids-limit=256`, `--memory`, and bounded tmpfs mounts are synthesized into in-memory argument arrays.
   - **Maturity Boundary:** Because Phase 0 does not connect to a host Docker daemon or launch containers, **actual runtime container isolation, resource throttling, and kernel cgroup enforcement are UNVERIFIED at runtime**. The build runner must NOT be characterized as runtime-secure until live container execution is implemented and tested in Phase 1.

3. **Requires Host System Configuration (Deferred to Phase 1):**
   - **Host Firewall Enforcement:** `generateEgressFirewallRules()` returns string templates for `iptables` rules. No host-side daemon or privileged process executes or installs these rules in Phase 0.
   - **Runtime Watchdog & Cleanup:** `generateCleanupCommand()` provides a deterministic cleanup string (`docker rm -f opspilot-build-${buildId}`). Automated process termination, timeout watchdogs, and container lifecycle cleanup are host-level daemon responsibilities scheduled for Phase 1.

## Migration & Implementation Plan
- Updated `docker/runners/scripts/build-entrypoint.sh` and `packages/deployment-providers/src/runners/hardened-build-runner.ts`.
- Added 8 adversarial security unit tests in `packages/deployment-providers/tests/hardened-build-runner.spec.ts`.
- Preserved strict decoupling: `HardenedBuildRunner` remains an in-memory configuration validator without Docker daemon or deployment provider connections.

## References
- ADR-0005: Isolated Runners for Untrusted Builds
- ADR-0016: Node.js Isolated Build Runner for Cloudflare Targets
