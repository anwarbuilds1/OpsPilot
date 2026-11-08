# Threat Model (STRIDE Methodology)

> **Methodology:** Microsoft STRIDE Threat Modeling  
> **Classification:** Confidential Architectural Review  
> **Status:** Approved Baseline

Because OpsPilot operates as an infrastructure control plane with elevated access to AWS accounts, VPS servers, and GitHub codebases, it is a high-value attack target. This document identifies assets, threat actors, attack vectors, mitigations, and residual risks.

---

## 1. Asset Catalog

1. **Customer Cloud Credentials:** Temporary AWS STS session tokens, SSH private keys for VPS access, GitHub App installation tokens.
2. **Customer Source Code & Intellectual Property:** Git repositories, commit histories, proprietary algorithms, and Dockerfiles.
3. **Production Application Telemetry:** Application logs, health check metrics, error stack traces (which may contain PII or tokens).
4. **OpsPilot System Integrity:** PostgreSQL state store and queue table (PostgreSQL-backed queue — selected architecture, implementation pending), build runner sandboxes, API availability.

---

## 2. Threat Actors & Attacker Profiles

- **Malicious Multi-Tenant (Insider):** A legitimate customer attempting to read logs, steal credentials, or trigger deployments in another organization.
- **Supply-Chain / Compromised Dependency:** Malicious npm packages or upstream Docker base images executing malicious scripts during build time.
- **Adversarial External User:** External actors sending prompt injection payloads through public API endpoints, resulting in malicious log lines.
- **Untrusted Repository Author:** An engineer submitting a PR containing an adversarial `Dockerfile` designed to escape containers.

---

## 3. STRIDE Threat Analysis Matrix

| STRIDE Category | Threat Description | Attack Vector | OpsPilot Mitigation |
|---|---|---|---|
| **Spoofing** | Attacker impersonates an organization member or submits fake GitHub webhooks. | Forged JWT tokens; forged webhook delivery headers. | Cryptographic verification of JWT sessions; constant-time HMAC-SHA256 signature verification on GitHub webhooks. |
| **Tampering** | Attacker tampers with deployment state or alters build artifacts. | In-transit tampering; SQL injection in deployment parameters. | TLS 1.3 encryption on all connections; parameterized SQL queries / ORM; SHA-256 digest pinning on Docker images in ECR. |
| **Repudiation** | User denies triggering an unauthorized rollback or destructive action. | Lack of action traceability. | Immutable, append-only `audit_logs` table recording actor ID, IP address, timestamp, and action parameters. |
| **Information Disclosure** | Cross-tenant data leakage; secrets exposed in logs or AI context. | IDOR vulnerability; plaintext secret logging. | Enforced `organization_id` scoping on all queries; envelope encryption (AES-256-GCM); streaming regex secret scrubber. |
| **Denial of Service** | Resource starvation in API or workers; runaway build loops. | Spammed deployment requests; fork-bomb in repository Dockerfile. | Queue concurrency limits (PostgreSQL-backed queue — selected architecture, implementation pending); 15-minute hard timeout on builds; cgroup CPU/memory quotas on build runners. |
| **Elevation of Privilege** | Container escape from build runner; AI agent tricked into executing write commands. | Mounted Docker socket; indirect prompt injection. | Non-root build runner without Docker socket mount; strictly read-only AI tools; mandatory human approval gate. |

---

## 4. Threat Boundaries & Security Perimeters

```mermaid
flowchart TD
    subgraph UntrustedZone [Zone 0: Untrusted World]
        Internet[Public Internet / Webhook Senders]
        UntrustedCode[Customer Git Repositories & Dockerfiles]
        UntrustedLogs[Customer Application Error Logs]
    end

    subgraph DMZ [Zone 1: Perimeter DMZ]
        WAF[WAF / Reverse Proxy]
        HMAC[Webhook Signature Check]
        Auth[JWT & RBAC Guards]
    end

    subgraph CorePlane [Zone 2: Core Control Plane]
        API[NestJS API Service\n(PLANNED - Phase 3)]
        Queue[("PostgreSQL-Backed Queue\n(Selected Architecture - Implementation Pending)")]
        DB[(PostgreSQL Primary Store)]
        Vault[Envelope Encryption Service\n(Target Architecture)]
    end

    subgraph IsolatedExecution [Zone 3: Isolated Execution Sandbox]
        BuildRunner[Ephemeral Build Runner<br/>User: 10001, No Docker Socket, Tmpfs]
        AIGateway[AI Gateway Sandbox<br/>Zero Cloud Credentials, Scrubbed Context]
    end

    subgraph CustomerCloud [Zone 4: Customer Cloud Infrastructure]
        AWS[AWS ECS & CloudWatch]
        VPS[Ubuntu VPS Host]
    end

    Internet -->|TLS 1.3| WAF
    WAF --> HMAC
    HMAC --> Auth
    Auth --> API

    API --> Queue
    API --> DB
    API --> Vault

    Queue --> BuildRunner
    Queue --> AIGateway

    UntrustedCode --> BuildRunner
    UntrustedLogs --> API

    BuildRunner -->|STS AssumeRole| AWS
    BuildRunner -->|Isolated SSH| VPS

    classDef untrusted fill:#ffebee,stroke:#c62828,stroke-width:2px;
    classDef dmz fill:#fff3e0,stroke:#ef6c00,stroke-width:2px;
    classDef core fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef sandbox fill:#e0f7fa,stroke:#00838f,stroke-width:2px;

    class UntrustedZone,UntrustedCode,UntrustedLogs untrusted;
    class DMZ dmz;
    class CorePlane core;
    class IsolatedExecution sandbox;
```

---

## 5. Residual Risks & Ongoing Monitoring

1. **Zero-Day Container Escape in Linux Kernel:** If a zero-day vulnerability in the host Linux kernel allows container escapes, a malicious build runner could theoretically impact the host. *Mitigation:* Keep runner host kernels updated; evaluate gVisor / Firecracker microVMs for Phase 5.
2. **LLM Non-Determinism:** Small probability of the model producing an inaccurate hypothesis. *Mitigation:* Explicit confidence scoring and mandatory human sign-off before remediation.
