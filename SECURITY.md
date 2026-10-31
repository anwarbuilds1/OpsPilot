# Security Policy

The OpsPilot team takes the security of our platform, user workloads, and infrastructure integrations seriously. Because OpsPilot manages cloud deployments and executes automated incident investigations, maintaining strong security and tenant isolation is our highest priority.

---

## 1. Supported Versions

Security updates and patches are provided for the following versions:

| Version | Supported | Status |
|---|---|---|
| `0.1.x` (Pre-Alpha / Current Specs) | :white_check_mark: | Active specification & development |
| `< 0.1.0` | :x: | Unsupported |

---

## 2. Reporting a Vulnerability

> [!CAUTION]
> **Do not report security vulnerabilities via public GitHub issues, discussions, or pull requests.**

If you believe you have found a security vulnerability in OpsPilot, please report it privately:

- **GitHub Private Vulnerability Reporting (Preferred):** Use the "Report a vulnerability" button under the **Security** tab of the GitHub repository.
- **Direct Maintainer Contact:** Pending project owner confirmation for a dedicated `security@opspilot.dev` alias, please contact the repository maintainer directly via GitHub profile messaging or at the maintainer email listed in Git commit logs.

### Required Information
To help us triage and resolve the issue quickly, please include:
1. **Description:** A detailed explanation of the vulnerability and its potential impact.
2. **Affected Components:** The affected modules, APIs, worker processes, or adapters (e.g., AWS ECS adapter, Docker build runner, AI gateway).
3. **Step-by-Step Reproduction:** Minimal reproduction steps or Proof of Concept (PoC) code/scripts.
4. **Tenant Isolation Context:** Whether the issue involves cross-organization data leakage or credential exposure.
5. **Mitigation:** Any temporary workarounds or mitigations you have identified.

---

## 3. Vulnerability Response Timeline

Upon receiving a private security report, our team commits to the following SLA:

- **Initial Acknowledgment:** Within **48 hours** of receipt.
- **Triage & Severity Assessment:** Within **5 business days**, classifying severity based on CVSS v3.1.
- **Status Updates:** Every **7 business days** while a fix is being developed and validated.
- **Patch Release:** Target resolution within **30 days** for Critical/High severity vulnerabilities.
- **Public Disclosure:** Coordinated disclosure after the patch has been published and deployed to users.

---

## 4. Scope and Exclusions

### In Scope
- Cross-tenant data leakage or authorization bypasses in REST APIs.
- Credential exposure (AWS IAM role external IDs, SSH private keys, GitHub tokens, database secrets).
- Remote Code Execution (RCE) on the core API or worker hosts.
- Prompt injection vulnerabilities that trick the AI investigation agent into unauthorized operations or tool misuse.
- Container escape vulnerabilities in deployment runners.
- Flaws in webhook signature validation leading to unauthorized deployment execution.

### Out of Scope
- Denial of Service (DoS) attacks requiring massive sustained volumetric bandwidth.
- Social engineering or phishing attacks against OpsPilot contributors.
- Vulnerabilities in third-party services (e.g., GitHub, AWS, Docker Hub) outside of OpsPilot's integration code.
- Reports from automated vulnerability scanners without a verified Proof of Concept.
