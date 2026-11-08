# OpsPilot — Project Governance Specification

> **Status:** Authoritative Governance Specification  
> **Maintainer Model:** Founder-Led Open-Source Project with Codeowners

This document outlines the governance model for **OpsPilot**. The goal is to provide a transparent, lightweight decision-making framework that balances agility during early development with clear paths for community participation, maintainership, and cryptographic safety.

---

## 1. Governance Principles

1. **Safety & Security First:** Because OpsPilot coordinates deployment infrastructure and production incident response, architectural safety, tenant isolation, and cryptographic integrity take precedence over rapid, untested feature addition.
2. **Open Architectural Review:** Significant architectural shifts must be proposed via Architecture Decision Records (ADRs) in `docs/decisions/` and reviewed publicly.
3. **Meritocratic Evolution:** Contributors who demonstrate consistent quality, architectural rigor, and adherence to security principles will be invited into maintainer roles.
4. **Owner Approval Gates:** Core licensing decisions (e.g. Apache-2.0 adoption) and destructive schema migrations require explicit sign-off from the Project Owner.

---

## 2. Roles & Responsibilities

### 2.1 Project Lead / Owner (@anwar)
- Sets overall product direction, scope, and release milestones.
- Final authority on controversial technical disputes, licensing decisions, and governance amendments.
- Manages security escalation, CVE disclosures, and confidential security embargoes.
- Approves production releases, release tags, and schema migrations.

### 2.2 Core Maintainers
- Defined in [`.github/CODEOWNERS`](.github/CODEOWNERS).
- Review, approve, and merge Pull Requests within their designated subsystem ownership areas.
- Ensure incoming PRs adhere to [Engineering Standards](docs/engineering/ENGINEERING_STANDARDS.md), [Coding Conventions](docs/engineering/CODING_CONVENTIONS.md), and [Testing Standards](docs/engineering/TESTING_STANDARDS.md).
- Maintain CI/CD pipelines, documentation, and dependency security updates.
- Triage GitHub issues and facilitate community discussions.

### 2.3 Contributors & AI Coding Agents
- Anyone who submits an issue, pull request, documentation fix, or test scenario.
- Must adhere to the [Code of Conduct](CODE_OF_CONDUCT.md), [Contributing Guide](CONTRIBUTING.md), and [AI Coding Guidelines](AGENTS.md).

---

## 3. Decision-Making & Review Process

- **Standard Code Changes:** Require approval from at least one Core Maintainer and passing CI checks.
- **Architectural Changes:** Require a written ADR submitted as a PR to `docs/decisions/`. The ADR must remain open for discussion for a minimum of **5 business days** to allow community feedback before maintainer sign-off.
- **Breaking Changes:** Require explicit sign-off from the Project Lead and must include a documented migration path in `docs/releases/RELEASE_PROCESS.md`.
- **Pre-Implementation Remediation:** The 10 blockers identified in [Project Foundation Remediation Plan](docs/reports/PROJECT_FOUNDATION_REMEDIATION_PLAN.md) must be addressed before general feature development.

---

## 4. Release Process & Cadence

- OpsPilot follows [Semantic Versioning (SemVer 2.0.0)](docs/releases/RELEASE_PROCESS.md).
- Releases are tagged on the `main` branch by Core Maintainers after automated security and regression test verification.
- Release containers are keylessly signed via Sigstore Cosign with SPDX SBOMs published alongside release notes.

---

## 5. Security Escalation

Security vulnerabilities follow the confidential disclosure path defined in [SECURITY.md](SECURITY.md). Security advisories, envelope encryption reviews, and patch releases take immediate priority over roadmap features.
